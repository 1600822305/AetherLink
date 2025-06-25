import store from '../../../store';
import { dexieStorage } from '../../storage/DexieStorageService';
import { EventEmitter, EVENT_NAMES } from '../../EventService';
import { MessageBlockStatus, AssistantMessageStatus, MessageBlockType } from '../../../types/newMessage';
import type { MessageBlock } from '../../../types/newMessage';
import { newMessagesActions } from '../../../store/slices/newMessagesSlice';
import { updateOneBlock, addOneBlock } from '../../../store/slices/messageBlocksSlice';
import { v4 as uuid } from 'uuid';
import { globalToolTracker } from '../../../utils/toolExecutionSync';
import { hasToolUseTags } from '../../../utils/mcpToolParser';
import { TopicNamingService } from '../../topics/TopicNamingService';

/**
 * 响应完成处理器 - 处理响应完成和中断的逻辑
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
   * @returns 累计的响应内容
   */
  async complete(finalContent: string | undefined, chunkProcessor: any) {
    console.log(`[ResponseCompletionHandler] 完成处理 - finalContent长度: ${finalContent?.length || 0}, accumulatedContent长度: ${chunkProcessor.content.length}`);

    // 检查特殊情况
    if (this.isComparisonResult(finalContent, chunkProcessor)) {
      return chunkProcessor.content;
    }

    // 等待工具完成
    await this.waitForToolsCompletion();

    // 处理内容
    const accumulatedContent = this.resolveAccumulatedContent(finalContent, chunkProcessor);

    // 处理可能的新块创建
    await this.handleNewBlockCreation(finalContent, chunkProcessor);

    // 完成响应处理
    return await this.finalizeResponse(accumulatedContent, chunkProcessor, false);
  }

  /**
   * 响应被中断时的完成处理
   */
  async completeWithInterruption(chunkProcessor: any) {
    console.log(`[ResponseCompletionHandler] 响应被中断 - 消息ID: ${this.messageId}`);

    try {
      const interruptedContent = this.createInterruptedContent(chunkProcessor.content);
      const metadata = { interrupted: true, interruptedAt: new Date().toISOString() };

      // 中断情况下的简化处理
      await this.handleInterruptedCompletion(interruptedContent, metadata);

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
  private async handleInterruptedCompletion(content: string, metadata: any): Promise<void> {
    const now = metadata.interruptedAt;

    // 1. 更新Redux状态
    this.updateSingleBlock(this.blockId, content, now, undefined, metadata);
    this.updateStates(now, metadata);

    // 2. 批量保存到数据库（避免重复操作）
    await this.saveInterruptedState(content, metadata);

    // 3. 发送事件
    this.emitEvents(content, true);

    // 4. 清理资源（中断情况下也需要清理）
    this.cleanupToolTracker();
  }

  /**
   * 最终完成处理 - 进一步优化
   */
  private async finalizeResponse(
    content: string,
    chunkProcessor: any,
    interrupted: boolean = false,
    metadata?: any
  ): Promise<string> {
    const now = new Date().toISOString();

    // 1. 更新Redux状态
    if (!interrupted) {
      this.updateAllBlockStates(chunkProcessor, content, now);
    }
    this.updateStates(now, metadata);

    // 2. 发送事件
    this.emitEvents(content, interrupted);

    // 3. 批量数据库操作（避免分散的数据库调用）
    if (!interrupted) {
      await this.batchSaveToDatabase(chunkProcessor, content, now);
      this.triggerTopicNaming();
    }

    // 4. 清理资源
    this.cleanupToolTracker();

    return content;
  }

  /**
   * 批量保存到数据库 - 统一处理，避免重复
   */
  private async batchSaveToDatabase(chunkProcessor: any, content: string, now: string): Promise<void> {
    try {
      // 计算最终的块ID数组
      const finalBlockIds = this.calculateFinalBlockIds(chunkProcessor);

      // 先更新块数据（不在事务中，避免冲突）
      await this.updateBlocksInDatabase(chunkProcessor, content, now);

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
  private async updateBlocksInDatabase(chunkProcessor: any, content: string, now: string): Promise<void> {
    const updateOperations: Promise<any>[] = [];

    // 更新块数据
    if (chunkProcessor.blockType === MessageBlockType.THINKING) {
      updateOperations.push(dexieStorage.updateMessageBlock(this.blockId, {
        type: MessageBlockType.THINKING,
        content: chunkProcessor.thinking,
        status: MessageBlockStatus.SUCCESS,
        updatedAt: now
      }));
    } else {
      updateOperations.push(dexieStorage.updateMessageBlock(this.blockId, {
        type: MessageBlockType.MAIN_TEXT,
        content: content,
        status: MessageBlockStatus.SUCCESS,
        updatedAt: now
      }));
    }

    // 更新新创建的主文本块
    if (chunkProcessor.textBlockId && chunkProcessor.textBlockId !== this.blockId) {
      updateOperations.push(dexieStorage.updateMessageBlock(chunkProcessor.textBlockId, {
        type: MessageBlockType.MAIN_TEXT,
        content: content,
        status: MessageBlockStatus.SUCCESS,
        updatedAt: now
      }));
    }

    await Promise.all(updateOperations);
  }

  // ===== 私有辅助方法 =====

  /**
   * 检查是否为对比结果
   */
  private isComparisonResult(finalContent: string | undefined, chunkProcessor: any): boolean {
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
  private resolveAccumulatedContent(finalContent: string | undefined, chunkProcessor: any): string {
    let accumulatedContent = chunkProcessor.content;

    if (!accumulatedContent.trim() && finalContent) {
      accumulatedContent = finalContent;
      console.log(`[ResponseCompletionHandler] 使用 finalContent 作为最终内容`);
    } else {
      console.log(`[ResponseCompletionHandler] 保持 accumulatedContent 作为最终内容`);
    }

    // 检查工具标签（仅用于日志）
    this.logToolUsage(accumulatedContent);

    return accumulatedContent;
  }

  /**
   * 检查和记录工具使用情况
   */
  private logToolUsage(content: string): void {
    try {
      const hasTools = hasToolUseTags(content);
      if (hasTools) {
        console.log(`[ResponseCompletionHandler] 内容包含工具标签，将在原位置渲染工具块`);
      }
    } catch (error) {
      console.error(`[ResponseCompletionHandler] 检查工具标签失败:`, error);
    }
  }

  /**
   * 处理新块创建（如果需要）
   */
  private async handleNewBlockCreation(finalContent: string | undefined, chunkProcessor: any): Promise<void> {
    if (finalContent && finalContent.trim() && !chunkProcessor.textBlockId) {
      console.log(`[ResponseCompletionHandler] 创建新的主文本块`);

      const newMainTextBlock: MessageBlock = {
        id: uuid(),
        messageId: this.messageId,
        type: MessageBlockType.MAIN_TEXT,
        content: finalContent,
        createdAt: new Date().toISOString(),
        status: MessageBlockStatus.SUCCESS
      };

      // 添加到Redux和数据库
      store.dispatch(addOneBlock(newMainTextBlock));
      await dexieStorage.saveMessageBlock(newMainTextBlock);

      // 更新消息块引用
      store.dispatch(newMessagesActions.upsertBlockReference({
        messageId: this.messageId,
        blockId: newMainTextBlock.id,
        status: MessageBlockStatus.SUCCESS
      }));

      // 更新处理器状态
      chunkProcessor.textBlockId = newMainTextBlock.id;
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
  private async saveInterruptedState(content: string, metadata: any): Promise<void> {
    await Promise.all([
      dexieStorage.updateMessageBlock(this.blockId, {
        content,
        status: MessageBlockStatus.SUCCESS,
        updatedAt: metadata.interruptedAt,
        metadata
      }),
      dexieStorage.updateMessage(this.messageId, {
        status: MessageBlockStatus.SUCCESS,
        updatedAt: metadata.interruptedAt,
        metadata
      })
    ]);
  }

  /**
   * 统一的单个块更新方法
   */
  private updateSingleBlock(
    blockId: string,
    content: string,
    updatedAt: string,
    blockType?: MessageBlockType,
    metadata?: any
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

    console.log(`[ResponseCompletionHandler] 更新块 ${blockId} 状态为 SUCCESS`);
    store.dispatch(updateOneBlock({ id: blockId, changes }));
  }

  /**
   * 统一的块状态更新逻辑 - 消除重复代码
   */
  private updateAllBlockStates(chunkProcessor: any, accumulatedContent: string, now: string): void {
    console.log(`[ResponseCompletionHandler] 更新块状态 - blockType: ${chunkProcessor.blockType}, blockId: ${this.blockId}, textBlockId: ${chunkProcessor.textBlockId}`);

    // 根据块类型更新相应的块
    switch (chunkProcessor.blockType) {
      case MessageBlockType.MAIN_TEXT:
        this.updateSingleBlock(this.blockId, accumulatedContent, now, MessageBlockType.MAIN_TEXT);
        break;

      case MessageBlockType.THINKING:
        // 更新思考块
        this.updateSingleBlock(this.blockId, chunkProcessor.thinking, now, MessageBlockType.THINKING);

        // 更新关联的主文本块（如果存在）
        if (chunkProcessor.textBlockId && chunkProcessor.textBlockId !== this.blockId) {
          this.updateSingleBlock(chunkProcessor.textBlockId, accumulatedContent, now, MessageBlockType.MAIN_TEXT);
        }
        break;

      default:
        // 默认情况，作为主文本块处理
        this.updateSingleBlock(this.blockId, accumulatedContent, now, MessageBlockType.MAIN_TEXT);
        break;
    }

    // 处理额外的思考块（如果存在）
    if (chunkProcessor.thinkingId && chunkProcessor.thinkingId !== this.blockId) {
      const thinkingBlock = store.getState().messageBlocks.entities[chunkProcessor.thinkingId];
      if (thinkingBlock && thinkingBlock.type === MessageBlockType.THINKING) {
        this.updateSingleBlock(chunkProcessor.thinkingId, thinkingBlock.content || '', now, MessageBlockType.THINKING);
        console.log(`[ResponseCompletionHandler] 更新额外思考块 ${chunkProcessor.thinkingId}`);
      }
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
   * 计算最终的块ID数组 - 提取复杂逻辑
   */
  private calculateFinalBlockIds(chunkProcessor: any): string[] {
    const currentMessage = store.getState().messages.entities[this.messageId];
    const existingBlocks = currentMessage?.blocks || [];
    let finalBlockIds: string[] = [];

    if (chunkProcessor.textBlockId && chunkProcessor.textBlockId !== this.blockId) {
      // 有新创建的主文本块
      for (const existingBlockId of existingBlocks) {
        if (existingBlockId === this.blockId) {
          if (chunkProcessor.blockType === MessageBlockType.THINKING) {
            // 思考块在前，主文本块在后
            this.addUniqueBlockId(finalBlockIds, this.blockId);
            this.addUniqueBlockId(finalBlockIds, chunkProcessor.textBlockId);
          } else {
            // 只替换为主文本块
            this.addUniqueBlockId(finalBlockIds, chunkProcessor.textBlockId);
          }
        } else {
          this.addUniqueBlockId(finalBlockIds, existingBlockId);
        }
      }

      // 确保主文本块存在
      this.addUniqueBlockId(finalBlockIds, chunkProcessor.textBlockId);
    } else {
      // 使用原始块
      finalBlockIds = [...existingBlocks];
      this.addUniqueBlockId(finalBlockIds, this.blockId);
    }

    console.log(`[ResponseCompletionHandler] 计算得出的最终块ID: [${finalBlockIds.join(', ')}]`);
    return finalBlockIds;
  }

  /**
   * 更新消息和话题引用
   */
  private async updateMessageAndTopicReferences(finalBlockIds: string[], now: string): Promise<void> {
    // 更新消息
    await dexieStorage.updateMessage(this.messageId, {
      status: AssistantMessageStatus.SUCCESS,
      updatedAt: now,
      blocks: finalBlockIds
    });

    // 更新话题中的消息引用
    const topic = await dexieStorage.topics.get(this.topicId);
    if (topic) {
      if (!topic.messages) topic.messages = [];

      const currentMessageState = store.getState().messages.entities[this.messageId];
      if (currentMessageState) {
        const updatedMessage = {
          ...currentMessageState,
          blocks: finalBlockIds,
          status: AssistantMessageStatus.SUCCESS,
          updatedAt: now
        };

        const messageIndex = topic.messages.findIndex(m => m.id === this.messageId);
        if (messageIndex >= 0) {
          topic.messages[messageIndex] = updatedMessage;
        } else {
          topic.messages.push(updatedMessage);
        }

        await dexieStorage.topics.put(topic);
      }
    }

    // 更新Redux中的消息blocks数组
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
   * 添加唯一的块ID
   */
  private addUniqueBlockId(blockIds: string[], blockId: string): void {
    if (!blockIds.includes(blockId)) {
      blockIds.push(blockId);
    }
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
