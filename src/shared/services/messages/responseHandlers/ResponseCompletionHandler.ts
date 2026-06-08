import store from '../../../store';
import { dexieStorage } from '../../storage/DexieStorageService';
import { EventEmitter, EVENT_NAMES } from '../../infra/EventService';
import { MessageBlockStatus, AssistantMessageStatus, MessageBlockType } from '../../../types/newMessage';
import type { MessageBlock } from '../../../types/newMessage';
import { newMessagesActions } from '../../../store/slices/newMessagesSlice';
import { updateOneBlock } from '../../../store/slices/messageBlocksSlice';
import { v4 as uuid } from 'uuid';
import { globalToolTracker } from '../../../utils/toolExecutionSync';
import { TopicNamingService } from '../../topics/TopicNamingService';
import type { ChunkProcessorView } from './ResponseChunkProcessor';
import { finalizeNonTerminalBlocks } from './blockFinalization';
import { messageBlockRepository } from '../MessageBlockRepository';

/**
 * 响应完成处理器 - 处理响应完成和中断的逻辑
 * 
 * ============= 完成处理链路 =============
 * 
 * ResponseHandler.complete(finalContent, finalReasoning)
 *   ↓
 * ResponseCompletionHandler.complete
 *   ├─ 等待所有工具执行完成 (waitForToolsCompletion)
 *   ├─ 更新所有块状态为 SUCCESS (updateAllBlockStates)
 *   │     └─ 只更新状态，不覆盖内容（每个块创建时就有正确内容）
 *   ├─ 更新消息和话题状态 (updateStates)
 *   ├─ 发送完成事件 (emitEvents)
 *   └─ 批量保存到数据库 (batchSaveToDatabase)
 * 
 * ============= 关键设计 =============
 * - 非流式多轮时，每个块在 ResponseChunkProcessor 创建时就有正确内容
 * - complete 时只更新状态为 SUCCESS，不覆盖块内容
 * - 块顺序由流式/非流式处理过程中的 upsertBlockReference 顺序决定
 */
export class ResponseCompletionHandler {
  private messageId: string;
  private blockId: string;
  private topicId: string;

  constructor(messageId: string, blockId: string, topicId: string) {
    this.messageId = messageId;
    this.blockId = blockId;
    this.topicId = topicId;
  }

  /**
   * 响应完成处理 - 参考 Cline 的稳定性机制
   * @param finalContent 最终内容
   * @param chunkProcessor 块处理器实例
   * @param finalReasoning 最终思考内容（非流式响应时使用）
   * @returns 累计的响应内容
   */
  async complete(finalContent: string | undefined, chunkProcessor: ChunkProcessorView, finalReasoning?: string) {
    if (this.isComparisonResult(finalContent, chunkProcessor)) {
      return chunkProcessor.content;
    }

    await this.waitForToolsCompletion();

    const accumulatedContent = this.resolveAccumulatedContent(finalContent, chunkProcessor);
    const accumulatedReasoning = finalReasoning || chunkProcessor.thinking;

    await this.handleNonStreamBlockCreation(finalContent, chunkProcessor, accumulatedReasoning);

    return await this.finalizeResponse(accumulatedContent, chunkProcessor, false, undefined, accumulatedReasoning);
  }

  /**
   * 响应被中断时的完成处理
   */
  async completeWithInterruption(chunkProcessor: ChunkProcessorView) {
    console.log(`[ResponseCompletionHandler] 响应被中断 - 消息ID: ${this.messageId}`);

    // 关键修复：先取消所有待处理的节流/RAF 块更新，再收尾。
    // 否则中断时最后一帧 thinking 更新（status=streaming）会在 finalize 之后才触发，
    // 把已收尾的思考块重新写回 streaming → 计时器「死灰复燃」继续走。
    chunkProcessor.cancelPendingUpdates();

    try {
      const interruptedContent = this.createInterruptedContent(chunkProcessor.content);
      const metadata = { interrupted: true, interruptedAt: new Date().toISOString() };

      // 中断情况下的简化处理
      await this.handleInterruptedCompletion(interruptedContent, metadata, chunkProcessor.thinkingDurationMs);

      return interruptedContent;

    } catch (error) {
      console.error(`[ResponseCompletionHandler] 中断处理失败:`, error);
      return await this.complete(chunkProcessor.content, chunkProcessor);
    }
  }

  // ===== 核心处理方法 =====

  /**
   * 中断完成处理 - 简化版本，避免不必要的操作
   */
  private async handleInterruptedCompletion(content: string, metadata: any, thinkingDurationMs?: number): Promise<void> {
    const now = metadata.interruptedAt;

    // 诊断：打印中断时这条消息的块构成，便于定位「计时不停」到底卡在哪个块。
    const dbgMsg = store.getState().messages.entities[this.messageId];
    const dbgBlocks = (dbgMsg?.blocks ?? []).map((id) => {
      const b = store.getState().messageBlocks.entities[id];
      return b ? `${id.slice(0, 6)}:${b.type}/${b.status}` : `${id.slice(0, 6)}:MISSING`;
    });
    console.log(`[ResponseCompletionHandler] 中断收尾 blockId=${this.blockId.slice(0, 6)} blocks=[${dbgBlocks.join(', ')}]`);

    // 1. 主块收尾。
    //    关键修复：初始块在「推理优先 / 纯思考」时可能本身就是思考块（initialBlockId 被
    //    复用为 thinking 块）。此时绝不能用「正文中断内容」覆盖思考文本，否则思考内容丢失；
    //    并且该思考块必须交给 finalize 统一收尾（盖 thinking_millsec），所以不放进 skip。
    const mainBlock = store.getState().messageBlocks.entities[this.blockId];
    const skipBlockIds: string[] = [];
    if (mainBlock && mainBlock.type !== MessageBlockType.THINKING) {
      this.updateSingleBlock(this.blockId, content, now, undefined, metadata);
      skipBlockIds.push(this.blockId);
    }

    // 2. 收尾不变量：把其余所有非终态块（思考块/文本块/工具块）一并结掉
    //    —— 这是「中断后思考计时不停」的根治点：不再只动 this.blockId
    await finalizeNonTerminalBlocks(this.messageId, {
      now,
      thinkingDurationMs,
      skipBlockIds
    });

    this.updateStates(now, metadata);

    // 3. 批量保存主块/消息到数据库（其余块已在 finalize 中落库）
    //    主块仅在「非思考块」时写入中断内容，避免覆盖思考块文本。
    await this.saveInterruptedState(content, metadata, skipBlockIds.includes(this.blockId));

    // 4. 发送事件
    this.emitEvents(content, true);

    // 5. 清理资源（中断情况下也需要清理）
    this.cleanupToolTracker();
  }

  /**
   * 最终完成处理 - 进一步优化
   */
  private async finalizeResponse(
    content: string,
    chunkProcessor: ChunkProcessorView,
    interrupted: boolean = false,
    metadata?: any,
    accumulatedReasoning?: string
  ): Promise<string> {
    const now = new Date().toISOString();

    // 1. 更新Redux状态
    if (!interrupted) {
      this.updateAllBlockStates(chunkProcessor, content, now, accumulatedReasoning);
    }
    this.updateStates(now, metadata);

    // 2. 发送事件
    this.emitEvents(content, interrupted);

    // 3. 批量数据库操作（避免分散的数据库调用）
    if (!interrupted) {
      await this.batchSaveToDatabase(chunkProcessor, content, now, accumulatedReasoning);
      this.triggerTopicNaming();
    }

    // 4. 收尾不变量兑现（幂等安全网）：确保没有任何块被遗漏在非终态
    //    正常路径下各块已置 SUCCESS，此调用为 no-op；仅在出现意外遗漏时兽底
    if (!interrupted) {
      await finalizeNonTerminalBlocks(this.messageId, {
        now,
        thinkingDurationMs: chunkProcessor.thinkingDurationMs
      });
    }

    // 5. 清理资源
    this.cleanupToolTracker();

    return content;
  }

  /**
   * 批量保存到数据库 - 统一处理，避免重复
   */
  private async batchSaveToDatabase(chunkProcessor: ChunkProcessorView, content: string, now: string, accumulatedReasoning?: string): Promise<void> {
    try {
      // 计算最终的块ID数组
      const finalBlockIds = this.calculateFinalBlockIds();

      // 先更新块数据（不在事务中，避免冲突）
      await this.updateBlocksInDatabase(chunkProcessor, content, now, accumulatedReasoning);

      // 然后在事务中更新消息和话题引用
      await this.updateMessageAndTopicReferences(finalBlockIds, now);

      console.log(`[ResponseCompletionHandler] 批量数据库操作完成`);

    } catch (error) {
      console.error(`[ResponseCompletionHandler] 批量数据库操作失败:`, error);
      throw error;
    }
  }

  /**
   * 更新块数据到数据库
   */
  private async updateBlocksInDatabase(chunkProcessor: ChunkProcessorView, content: string, now: string, accumulatedReasoning?: string): Promise<void> {
    const updateOperations: Promise<any>[] = [];
    const finalThinkingMillis = chunkProcessor.thinkingDurationMs;
    const thinkingContent = accumulatedReasoning || chunkProcessor.thinking || '';
    
    // 检查是否是非流式响应
    const isNonStreamResponse = !chunkProcessor.content.trim() && content.trim();

    if (isNonStreamResponse) {
      // 非流式响应：根据是否有思考内容决定块类型
      if (thinkingContent.trim()) {
        // 有思考内容：初始块为思考块
        updateOperations.push(messageBlockRepository.updateBlock(
          this.blockId,
          this.buildThinkingSuccessUpdate(thinkingContent, now, finalThinkingMillis)
        ));
        // 更新文本块（如果已创建）
        if (chunkProcessor.textBlockId && chunkProcessor.textBlockId !== this.blockId) {
          updateOperations.push(messageBlockRepository.updateBlock(chunkProcessor.textBlockId, {
            type: MessageBlockType.MAIN_TEXT,
            content: content,
            status: MessageBlockStatus.SUCCESS,
            updatedAt: now
          }));
        }
      } else {
        // 没有思考内容：初始块为文本块
        updateOperations.push(messageBlockRepository.updateBlock(this.blockId, {
          type: MessageBlockType.MAIN_TEXT,
          content: content,
          status: MessageBlockStatus.SUCCESS,
          updatedAt: now
        }));
      }
    } else {
      // 流式响应：使用原有逻辑
      if (chunkProcessor.blockType === MessageBlockType.THINKING) {
        updateOperations.push(messageBlockRepository.updateBlock(
          this.blockId,
          this.buildThinkingSuccessUpdate(thinkingContent, now, finalThinkingMillis)
        ));
      } else {
        updateOperations.push(messageBlockRepository.updateBlock(this.blockId, {
          type: MessageBlockType.MAIN_TEXT,
          content: content,
          status: MessageBlockStatus.SUCCESS,
          updatedAt: now
        }));
      }

      // 更新新创建的主文本块
      if (chunkProcessor.textBlockId && chunkProcessor.textBlockId !== this.blockId) {
        updateOperations.push(messageBlockRepository.updateBlock(chunkProcessor.textBlockId, {
          type: MessageBlockType.MAIN_TEXT,
          content: content,
          status: MessageBlockStatus.SUCCESS,
          updatedAt: now
        }));
      }
    }

    this.ensureAdditionalThinkingBlockUpdated(updateOperations, chunkProcessor, now, finalThinkingMillis);

    await Promise.all(updateOperations);
  }

  private buildThinkingSuccessUpdate(content: string, now: string, thinkingMillis?: number): Partial<MessageBlock> {
    const update: Partial<MessageBlock> = {
      type: MessageBlockType.THINKING,
      content,
      status: MessageBlockStatus.SUCCESS,
      updatedAt: now
    };

    if (typeof thinkingMillis === 'number') {
      update.thinking_millsec = thinkingMillis;
    }

    return update;
  }

  private getThinkingAdditionalChanges(thinkingMillis?: number): Partial<MessageBlock> | undefined {
    return typeof thinkingMillis === 'number' ? { thinking_millsec: thinkingMillis } : undefined;
  }

  private ensureAdditionalThinkingBlockUpdated(
    updateOperations: Promise<any>[],
    chunkProcessor: ChunkProcessorView,
    now: string,
    thinkingMillis?: number
  ): void {
    if (chunkProcessor.thinkingId && chunkProcessor.thinkingId !== this.blockId) {
      updateOperations.push(
        messageBlockRepository.updateBlock(
          chunkProcessor.thinkingId,
          this.buildThinkingSuccessUpdate(chunkProcessor.thinking, now, thinkingMillis)
        )
      );
    }
  }

  // ===== 私有辅助方法 =====

  /**
   * 检查是否为对比结果
   */
  private isComparisonResult(finalContent: string | undefined, chunkProcessor: ChunkProcessorView): boolean {
    if (finalContent === '__COMPARISON_RESULT__' || chunkProcessor.content === '__COMPARISON_RESULT__') {
      console.log(`[ResponseCompletionHandler] 检测到对比结果，跳过常规完成处理`);
      return true;
    }
    return false;
  }

  /**
   * 等待工具执行完成
   */
  private async waitForToolsCompletion(): Promise<void> {
    try {
      console.log(`[ResponseCompletionHandler] 等待所有工具执行完成...`);
      await globalToolTracker.waitForAllToolsComplete(60000);
      console.log(`[ResponseCompletionHandler] 所有工具执行完成`);
    } catch (error) {
      console.warn(`[ResponseCompletionHandler] 等待工具完成超时:`, error);
    }
  }

  /**
   * 解析累积内容
   */
  private resolveAccumulatedContent(finalContent: string | undefined, chunkProcessor: ChunkProcessorView): string {
    const accumulatedContent = chunkProcessor.content;
    return (!accumulatedContent.trim() && finalContent) ? finalContent : accumulatedContent;
  }

  /**
   * 处理非流式响应的块创建
   */
  private async handleNonStreamBlockCreation(finalContent: string | undefined, chunkProcessor: ChunkProcessorView, accumulatedReasoning?: string): Promise<void> {
    const isNonStreamResponse = !chunkProcessor.content.trim() && finalContent && finalContent.trim();
    if (!isNonStreamResponse) return;
    
    // 有思考内容时，初始块作为思考块，需要创建新的文本块
    if (accumulatedReasoning && accumulatedReasoning.trim() && !chunkProcessor.textBlockId) {
      const newMainTextBlock: MessageBlock = {
        id: uuid(),
        messageId: this.messageId,
        type: MessageBlockType.MAIN_TEXT,
        content: finalContent,
        createdAt: new Date().toISOString(),
        status: MessageBlockStatus.SUCCESS
      };

      await messageBlockRepository.createBlockAndAttach(newMainTextBlock);

      if (typeof chunkProcessor.setTextBlockId === 'function') {
        chunkProcessor.setTextBlockId(newMainTextBlock.id);
      }
    }
  }

  /**
   * 创建中断内容
   */
  private createInterruptedContent(content: string): string {
    if (content.trim()) {
      return content + '\n\n---\n\n> ⚠️ **此回复已被用户中断**\n> \n> 以上内容为中断前已生成的部分内容。';
    } else {
      return '> ⚠️ **回复已被中断，未生成任何内容**\n> \n> 请重新发送消息以获取完整回复。';
    }
  }

  /**
   * 保存中断状态到数据库
   */
  private async saveInterruptedState(content: string, metadata: any, writeMainBlock: boolean = true): Promise<void> {
    const ops: Promise<unknown>[] = [
      dexieStorage.updateMessage(this.messageId, {
        status: MessageBlockStatus.SUCCESS,
        updatedAt: metadata.interruptedAt,
        metadata
      })
    ];
    // 主块为思考块时不写正文中断内容（思考块已由 finalize 落库），避免覆盖思考文本。
    if (writeMainBlock) {
      ops.push(messageBlockRepository.updateBlock(this.blockId, {
        content,
        status: MessageBlockStatus.SUCCESS,
        updatedAt: metadata.interruptedAt,
        metadata
      }));
    }
    await Promise.all(ops);
  }

  /**
   * 统一的单个块更新方法
   */
  private updateSingleBlock(
    blockId: string,
    content: string,
    updatedAt: string,
    blockType?: MessageBlockType,
    metadata?: any,
    additionalChanges?: Partial<MessageBlock>
  ): void {
    const changes: any = {
      content,
      status: MessageBlockStatus.SUCCESS,
      updatedAt
    };

    if (blockType) {
      changes.type = blockType;
    }

    if (metadata) {
      changes.metadata = {
        ...store.getState().messageBlocks.entities[blockId]?.metadata,
        ...metadata
      };
    }

    if (additionalChanges) {
      Object.assign(changes, additionalChanges);
    }

    store.dispatch(updateOneBlock({ id: blockId, changes }));
  }

  /**
   * 统一的块状态更新逻辑 - 支持非流式响应
   * 
   * 🔧 修复：非流式多轮工具调用时，每个块在创建时就已有正确内容
   * complete 时只需要更新状态为 SUCCESS，不要用相同内容覆盖所有块
   */
  private updateAllBlockStates(chunkProcessor: ChunkProcessorView, _accumulatedContent: string, now: string, _accumulatedReasoning?: string): void {
    const finalThinkingMillis = chunkProcessor.thinkingDurationMs;
    const thinkingAdditionalChanges = this.getThinkingAdditionalChanges(finalThinkingMillis);
    
    // 🔧 修复：获取消息的所有块，只更新状态，不覆盖内容
    const currentMessage = store.getState().messages.entities[this.messageId];
    const blockIds = currentMessage?.blocks || [];
    
    // 更新所有块的状态为 SUCCESS
    for (const blockId of blockIds) {
      const block = store.getState().messageBlocks.entities[blockId];
      if (!block) continue;
      
      // 只更新状态和时间，保留原有内容
      const changes: any = {
        status: MessageBlockStatus.SUCCESS,
        updatedAt: now
      };
      
      // 对于思考块，添加思考时间
      if (block.type === MessageBlockType.THINKING && thinkingAdditionalChanges) {
        Object.assign(changes, thinkingAdditionalChanges);
      }
      
      store.dispatch(updateOneBlock({ id: blockId, changes }));
    }
  }

  /**
   * 更新状态（消息和主题）
   */
  private updateStates(now: string, metadata?: any): void {
    const messageChanges: any = {
      status: AssistantMessageStatus.SUCCESS,
      updatedAt: now
    };

    if (metadata) {
      messageChanges.metadata = metadata;
    }

    // 更新消息状态
    store.dispatch(newMessagesActions.updateMessage({
      id: this.messageId,
      changes: messageChanges
    }));

    // 设置主题状态
    store.dispatch(newMessagesActions.setTopicStreaming({
      topicId: this.topicId,
      streaming: false
    }));

    store.dispatch(newMessagesActions.setTopicLoading({
      topicId: this.topicId,
      loading: false
    }));
  }

  /**
   * 发送完成事件
   */
  private emitEvents(content: string, interrupted: boolean = false): void {
    // 构建事件载荷基础数据
    const basePayload = {
      messageId: this.messageId,
      blockId: this.blockId,
      topicId: this.topicId
    };

    // 发送文本完成事件
    EventEmitter.emit(EVENT_NAMES.STREAM_TEXT_COMPLETE, {
      text: content,
      ...basePayload,
      ...(interrupted && { interrupted: true })
    });

    // 发送消息完成事件
    EventEmitter.emit(EVENT_NAMES.MESSAGE_COMPLETE, {
      id: this.messageId,
      topicId: this.topicId,
      status: 'success',
      ...(interrupted && { interrupted: true })
    });
  }

  /**
   * 计算最终的块ID数组 - 简化版：直接使用流式过程中建立的顺序
   * 
   * 关键修复：不再重新组织块顺序，保持流式接收时的原始顺序
   * 参考 cherry-studio：所有块按流式接收顺序依次追加
   */
  private calculateFinalBlockIds(): string[] {
    const currentMessage = store.getState().messages.entities[this.messageId];
    const existingBlocks = currentMessage?.blocks || [];
    
    // 直接使用现有块顺序（流式过程中已按正确顺序添加）
    // 只过滤掉空块或无效块
    const finalBlockIds = existingBlocks.filter(blockId => {
      const block = store.getState().messageBlocks.entities[blockId];
      // 保留所有有效的块
      return block != null;
    });

    console.log(`[ResponseCompletionHandler] 最终块ID（保持流式顺序）: [${finalBlockIds.join(', ')}]`);
    return finalBlockIds;
  }

  /**
   * 更新消息和话题引用
   * 重构：移除冗余的 topic.messages 写入，只使用 messages 表
   */
  private async updateMessageAndTopicReferences(finalBlockIds: string[], now: string): Promise<void> {
    // 更新 messages 表
    await dexieStorage.updateMessage(this.messageId, {
      status: AssistantMessageStatus.SUCCESS,
      updatedAt: now,
      blocks: finalBlockIds
    });

    // 更新 Redux 状态
    store.dispatch(newMessagesActions.updateMessage({
      id: this.messageId,
      changes: {
        blocks: finalBlockIds,
        status: AssistantMessageStatus.SUCCESS,
        updatedAt: now
      }
    }));
  }

  /**
   * 清理工具跟踪器
   */
  private cleanupToolTracker(): void {
    try {
      globalToolTracker.cleanup();
      console.log(`[ResponseCompletionHandler] 工具跟踪器清理完成`);
    } catch (error) {
      console.error(`[ResponseCompletionHandler] 工具跟踪器清理失败:`, error);
    }
  }

  /**
   * 触发话题自动命名
   */
  private triggerTopicNaming() {
    try {
      // 异步执行话题命名，不阻塞主流程
      setTimeout(async () => {
        // 获取最新的话题数据
        const topic = await dexieStorage.topics.get(this.topicId);
        if (topic && TopicNamingService.shouldNameTopic(topic)) {
          console.log(`[ResponseCompletionHandler] 触发话题自动命名: ${this.topicId}`);
          const newName = await TopicNamingService.generateTopicName(topic);
          if (newName) {
            console.log(`[ResponseCompletionHandler] 话题自动命名成功: ${newName}`);
          }
        }
      }, 1000); // 延迟1秒执行，确保消息已完全保存
    } catch (error) {
      console.error('[ResponseCompletionHandler] 话题自动命名失败:', error);
    }
  }
}
