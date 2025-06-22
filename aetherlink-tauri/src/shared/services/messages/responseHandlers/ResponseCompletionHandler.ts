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
    // 关键修复：不要覆盖 accumulatedContent，因为它已经通过流式回调正确累积了所有内容
    // 在工具调用场景中，finalContent 只包含最后一次响应，会丢失之前的内容
    console.log(`[ResponseCompletionHandler] 完成处理 - finalContent长度: ${finalContent?.length || 0}, accumulatedContent长度: ${chunkProcessor.content.length}`);

    // 检查是否是对比结果，如果是则不进行常规的完成处理
    if (finalContent === '__COMPARISON_RESULT__' || chunkProcessor.content === '__COMPARISON_RESULT__') {
      console.log(`[ResponseCompletionHandler] 检测到对比结果，跳过常规完成处理`);
      return chunkProcessor.content;
    }

    // 参考 Cline：等待所有工具执行完成
    try {
      console.log(`[ResponseCompletionHandler] 等待所有工具执行完成...`);
      await globalToolTracker.waitForAllToolsComplete(60000); // 60秒超时
      console.log(`[ResponseCompletionHandler] 所有工具执行完成`);
    } catch (error) {
      console.warn(`[ResponseCompletionHandler] 等待工具完成超时:`, error);
      // 继续处理，不阻塞响应完成
    }

    let accumulatedContent = chunkProcessor.content;

    // 只有在 accumulatedContent 为空时才使用 finalContent（非流式响应的情况）
    if (!accumulatedContent.trim() && finalContent) {
      accumulatedContent = finalContent;
      console.log(`[ResponseCompletionHandler] 使用 finalContent 作为最终内容`);
    } else {
      console.log(`[ResponseCompletionHandler] 保持 accumulatedContent 作为最终内容`);
    }

    // 关键：保留 XML 工具调用标签，让 MainTextBlock 处理原位置渲染
    console.log(`[ResponseCompletionHandler] 保留工具标签，支持原位置渲染`);

    // 检查是否包含工具标签（仅用于日志）
    try {
      const hasTools = hasToolUseTags(accumulatedContent);
      if (hasTools) {
        console.log(`[ResponseCompletionHandler] 内容包含工具标签，将在原位置渲染工具块`);
      }
    } catch (error) {
      console.error(`[ResponseCompletionHandler] 检查工具标签失败:`, error);
    }

    const now = new Date().toISOString();

    // 简化完成处理 - 直接更新状态，不使用流处理器
    // 更新消息状态
    store.dispatch(newMessagesActions.updateMessage({
      id: this.messageId,
      changes: {
        status: AssistantMessageStatus.SUCCESS,
        updatedAt: now
      }
    }));

    // 更新消息块状态（确保所有相关块都被更新）
    console.log(`[ResponseCompletionHandler] 完成时更新块状态 - lastBlockType: ${chunkProcessor.blockType}, blockId: ${this.blockId}, mainTextBlockId: ${chunkProcessor.textBlockId}`);

    if (chunkProcessor.blockType === MessageBlockType.MAIN_TEXT) {
      // 只有主文本块，更新原始块
      console.log(`[ResponseCompletionHandler] 更新主文本块 ${this.blockId} 状态为 SUCCESS`);
      store.dispatch(updateOneBlock({
        id: this.blockId,
        changes: {
          content: accumulatedContent,
          status: MessageBlockStatus.SUCCESS,
          updatedAt: now
        }
      }));
    } else if (chunkProcessor.blockType === MessageBlockType.THINKING) {
      // 有思考块，更新思考块状态
      console.log(`[ResponseCompletionHandler] 更新思考块 ${this.blockId} 状态为 SUCCESS`);
      store.dispatch(updateOneBlock({
        id: this.blockId,
        changes: {
          content: chunkProcessor.thinking,
          status: MessageBlockStatus.SUCCESS,
          updatedAt: now
        }
      }));

      // 如果还有主文本块，也要更新主文本块状态
      if (chunkProcessor.textBlockId && chunkProcessor.textBlockId !== this.blockId) {
        console.log(`[ResponseCompletionHandler] 更新主文本块 ${chunkProcessor.textBlockId} 状态为 SUCCESS`);
        store.dispatch(updateOneBlock({
          id: chunkProcessor.textBlockId,
          changes: {
            content: accumulatedContent,
            status: MessageBlockStatus.SUCCESS,
            updatedAt: now
          }
        }));
      }
    } else {
      // 默认情况，更新为主文本块
      console.log(`[ResponseCompletionHandler] 默认更新块 ${this.blockId} 状态为 SUCCESS`);
      store.dispatch(updateOneBlock({
        id: this.blockId,
        changes: {
          content: accumulatedContent,
          status: MessageBlockStatus.SUCCESS,
          updatedAt: now
        }
      }));
    }

    // 设置主题为非流式响应状态
    store.dispatch(newMessagesActions.setTopicStreaming({
      topicId: this.topicId,
      streaming: false
    }));

    // 设置主题为非加载状态
    store.dispatch(newMessagesActions.setTopicLoading({
      topicId: this.topicId,
      loading: false
    }));

    // 处理思考块完成
    if (chunkProcessor.thinkingId) {
      // 获取思考块
      const thinkingBlock = store.getState().messageBlocks.entities[chunkProcessor.thinkingId];

      if (thinkingBlock && thinkingBlock.type === MessageBlockType.THINKING) {
        // 更新思考块状态为完成
        store.dispatch(updateOneBlock({
          id: chunkProcessor.thinkingId,
          changes: {
            status: MessageBlockStatus.SUCCESS,
            updatedAt: now
          }
        }));

        // 保存到数据库
        dexieStorage.updateMessageBlock(chunkProcessor.thinkingId, {
          status: MessageBlockStatus.SUCCESS,
          updatedAt: now
        });

        console.log(`[ResponseCompletionHandler] 更新思考块 ${chunkProcessor.thinkingId} 状态为 SUCCESS`);
        console.log(`[ResponseCompletionHandler] 保存思考块 ${chunkProcessor.thinkingId} 到数据库，内容长度: ${thinkingBlock.content?.length || 0}`);
      }
    }

    // 修复：如果有finalContent但没有主文本块，需要创建主文本块
    if (finalContent && finalContent.trim() && !chunkProcessor.textBlockId) {
      console.log(`[ResponseCompletionHandler] 检测到finalContent但没有主文本块，创建新的主文本块`);

      // 创建新的主文本块
      const newMainTextBlock: MessageBlock = {
        id: uuid(),
        messageId: this.messageId,
        type: MessageBlockType.MAIN_TEXT,
        content: finalContent,
        createdAt: new Date().toISOString(),
        status: MessageBlockStatus.SUCCESS
      };

      const mainTextBlockId = newMainTextBlock.id;

      console.log(`[ResponseCompletionHandler] 创建主文本块 ${mainTextBlockId}，内容: "${finalContent}"`);

      // 添加到Redux状态
      store.dispatch(addOneBlock(newMainTextBlock));
      // 保存到数据库
      await dexieStorage.saveMessageBlock(newMainTextBlock);

      // 将新块添加到消息的blocks数组
      store.dispatch(newMessagesActions.upsertBlockReference({
        messageId: this.messageId,
        blockId: mainTextBlockId,
        status: MessageBlockStatus.SUCCESS
      }));
    }

    // 发送完成事件
    EventEmitter.emit(EVENT_NAMES.STREAM_TEXT_COMPLETE, {
      text: accumulatedContent,
      messageId: this.messageId,
      blockId: this.blockId,
      topicId: this.topicId
    });

    await this.saveBlocksToDatabase(chunkProcessor, accumulatedContent, now);
    await this.updateMessageBlocks(chunkProcessor, now);

    // 发送完成事件
    EventEmitter.emit(EVENT_NAMES.MESSAGE_COMPLETE, {
      id: this.messageId,
      topicId: this.topicId,
      status: 'success'
    });

    // 触发话题自动命名 - 与最佳实例保持一致
    this.triggerTopicNaming();

    // 参考 Cline：清理工具跟踪器
    try {
      globalToolTracker.cleanup();
      console.log(`[ResponseCompletionHandler] 工具跟踪器清理完成`);
    } catch (error) {
      console.error(`[ResponseCompletionHandler] 工具跟踪器清理失败:`, error);
    }

    return accumulatedContent;
  }

  /**
   * 响应被中断时的完成处理
   * @returns 累计的响应内容
   */
  async completeWithInterruption(chunkProcessor: any) {
    console.log(`[ResponseCompletionHandler] 响应被中断 - 消息ID: ${this.messageId}, 当前内容长度: ${chunkProcessor.content.length}`);

    const now = new Date().toISOString();

    try {
      // 如果有内容，添加中断警告
      let finalContent = chunkProcessor.content;
      if (finalContent.trim()) {
        finalContent += '\n\n---\n\n> ⚠️ **此回复已被用户中断**\n> \n> 以上内容为中断前已生成的部分内容。';
      } else {
        finalContent = '> ⚠️ **回复已被中断，未生成任何内容**\n> \n> 请重新发送消息以获取完整回复。';
      }

      // 创建元数据对象
      const interruptedMetadata = {
        interrupted: true,
        interruptedAt: now
      };

      // 更新主文本块内容和状态
      store.dispatch(updateOneBlock({
        id: this.blockId,
        changes: {
          content: finalContent,
          status: MessageBlockStatus.SUCCESS,
          updatedAt: now,
          metadata: {
            ...store.getState().messageBlocks.entities[this.blockId]?.metadata,
            ...interruptedMetadata
          }
        }
      }));

      // 更新消息状态 - 不直接包含metadata
      store.dispatch(newMessagesActions.updateMessage({
        id: this.messageId,
        changes: {
          status: MessageBlockStatus.SUCCESS,
          updatedAt: now
        }
      }));

      // 设置主题为非流式响应状态
      store.dispatch(newMessagesActions.setTopicStreaming({
        topicId: this.topicId,
        streaming: false
      }));

      // 设置主题为非加载状态
      store.dispatch(newMessagesActions.setTopicLoading({
        topicId: this.topicId,
        loading: false
      }));

      // 保存到数据库 - 这里可以包含metadata
      await Promise.all([
        dexieStorage.updateMessageBlock(this.blockId, {
          content: finalContent,
          status: MessageBlockStatus.SUCCESS,
          updatedAt: now,
          metadata: {
            interrupted: true,
            interruptedAt: now
          }
        }),
        dexieStorage.updateMessage(this.messageId, {
          status: MessageBlockStatus.SUCCESS,
          updatedAt: now,
          metadata: interruptedMetadata
        })
      ]);

      // 发送完成事件
      EventEmitter.emit(EVENT_NAMES.STREAM_TEXT_COMPLETE, {
        text: finalContent,
        messageId: this.messageId,
        blockId: this.blockId,
        topicId: this.topicId,
        interrupted: true
      });

      // 发送消息完成事件
      EventEmitter.emit(EVENT_NAMES.MESSAGE_COMPLETE, {
        id: this.messageId,
        topicId: this.topicId,
        status: 'success',
        interrupted: true
      });

      console.log(`[ResponseCompletionHandler] 中断处理完成 - 最终内容长度: ${finalContent.length}`);
      return finalContent;

    } catch (error) {
      console.error(`[ResponseCompletionHandler] 中断处理失败:`, error);
      // 如果处理失败，回退到普通完成处理
      return await this.complete(chunkProcessor.content, chunkProcessor);
    }
  }

  /**
   * 保存块到数据库
   */
  private async saveBlocksToDatabase(chunkProcessor: any, accumulatedContent: string, now: string) {
    const blockUpdatePromises: Promise<void>[] = [];

    // 保存原始块（思考块或主文本块）
    if (chunkProcessor.blockType === MessageBlockType.THINKING) {
      console.log(`[ResponseCompletionHandler] 保存思考块 ${this.blockId} 到数据库，内容长度: ${chunkProcessor.thinking.length}`);
      blockUpdatePromises.push(dexieStorage.updateMessageBlock(this.blockId, {
        type: MessageBlockType.THINKING, // 确保类型被正确保存
        content: chunkProcessor.thinking,
        status: MessageBlockStatus.SUCCESS,
        updatedAt: now
      }));
    } else {
      console.log(`[ResponseCompletionHandler] 保存主文本块 ${this.blockId} 到数据库，内容长度: ${accumulatedContent.length}`);
      blockUpdatePromises.push(dexieStorage.updateMessageBlock(this.blockId, {
        type: MessageBlockType.MAIN_TEXT, // 确保类型被正确保存
        content: accumulatedContent,
        status: MessageBlockStatus.SUCCESS,
        updatedAt: now
      }));
    }

    // 如果有新创建的主文本块，也要保存它
    if (chunkProcessor.textBlockId && chunkProcessor.textBlockId !== this.blockId) {
      console.log(`[ResponseCompletionHandler] 保存新创建的主文本块 ${chunkProcessor.textBlockId} 到数据库，内容长度: ${accumulatedContent.length}`);
      blockUpdatePromises.push(dexieStorage.updateMessageBlock(chunkProcessor.textBlockId, {
        type: MessageBlockType.MAIN_TEXT, // 确保类型被正确保存
        content: accumulatedContent,
        status: MessageBlockStatus.SUCCESS,
        updatedAt: now
      }));
    }

    await Promise.all(blockUpdatePromises);
  }

  /**
   * 更新消息块数组
   */
  private async updateMessageBlocks(chunkProcessor: any, now: string) {
    // 关键修复：正确处理占位符块替换和块ID管理
    const currentMessage = store.getState().messages.entities[this.messageId];
    const existingBlocks = currentMessage?.blocks || [];

    // 修复：正确处理块ID顺序，思考块在前，主文本块在后
    let finalBlockIds: string[] = [];

    if (chunkProcessor.textBlockId && chunkProcessor.textBlockId !== this.blockId) {
      // 情况1：创建了新的主文本块，需要替换占位符块
      console.log(`[ResponseCompletionHandler] 替换占位符块 ${this.blockId} 为主文本块 ${chunkProcessor.textBlockId}`);

      // 遍历现有块，按正确顺序构建新数组
      for (const existingBlockId of existingBlocks) {
        if (existingBlockId === this.blockId) {
          // 如果是思考块转换，按正确顺序添加
          if (chunkProcessor.blockType === MessageBlockType.THINKING) {
            // 思考块在前，主文本块在后
            if (!finalBlockIds.includes(this.blockId)) {
              finalBlockIds.push(this.blockId);
            }
            if (!finalBlockIds.includes(chunkProcessor.textBlockId)) {
              finalBlockIds.push(chunkProcessor.textBlockId);
            }
          } else {
            // 普通情况，只替换为主文本块
            if (!finalBlockIds.includes(chunkProcessor.textBlockId)) {
              finalBlockIds.push(chunkProcessor.textBlockId);
            }
          }
        } else {
          // 保留其他块（避免重复）
          if (!finalBlockIds.includes(existingBlockId)) {
            finalBlockIds.push(existingBlockId);
          }
        }
      }

      // 确保主文本块存在（防止遗漏）
      if (!finalBlockIds.includes(chunkProcessor.textBlockId)) {
        finalBlockIds.push(chunkProcessor.textBlockId);
      }
    } else {
      // 情况2：使用原始块ID（没有创建新块）
      console.log(`[ResponseCompletionHandler] 使用原始块ID ${this.blockId}`);
      finalBlockIds = [...existingBlocks];
      if (!finalBlockIds.includes(this.blockId)) {
        finalBlockIds.push(this.blockId);
      }
    }

    const allBlockIds = finalBlockIds;

    console.log(`[ResponseCompletionHandler] 完成时的所有块ID: [${allBlockIds.join(', ')}]，现有块: [${existingBlocks.join(', ')}]，主文本块: ${chunkProcessor.textBlockId || this.blockId}`);

    // 更新消息的 blocks 数组（保留现有的工具块等）
    store.dispatch(newMessagesActions.updateMessage({
      id: this.messageId,
      changes: {
        blocks: allBlockIds,
        status: AssistantMessageStatus.SUCCESS,
        updatedAt: now
      }
    }));

    // 关键修复：先等待所有块更新完成，然后在事务中保存消息状态
    // 使用事务保存消息状态，确保原子性
    await dexieStorage.transaction('rw', [
      dexieStorage.messages,
      dexieStorage.topics
    ], async () => {
      // 获取当前消息的最新状态（包含所有块引用）
      const currentMessageState = store.getState().messages.entities[this.messageId];
      if (currentMessageState) {
        // 获取最新的消息状态（包含所有块引用）
        const updatedMessage = {
          ...currentMessageState,
          blocks: allBlockIds, // 使用我们计算的完整块ID数组
          status: AssistantMessageStatus.SUCCESS,
          updatedAt: now
        };

        console.log(`[ResponseCompletionHandler] 保存消息状态，更新后的blocks: [${updatedMessage.blocks?.join(', ')}]`);

        // 更新messages表中的消息（包含最新的blocks数组）
        await dexieStorage.updateMessage(this.messageId, {
          status: AssistantMessageStatus.SUCCESS,
          updatedAt: now,
          blocks: allBlockIds // 确保完整的blocks数组被保存
        });

        // 更新topic.messages数组中的消息
        const topic = await dexieStorage.topics.get(this.topicId);
        if (topic) {
          // 确保messages数组存在
          if (!topic.messages) {
            topic.messages = [];
          }

          // 查找消息在数组中的位置
          const messageIndex = topic.messages.findIndex(m => m.id === this.messageId);

          // 更新或添加消息到话题的messages数组
          if (messageIndex >= 0) {
            topic.messages[messageIndex] = updatedMessage;
          } else {
            topic.messages.push(updatedMessage);
          }

          console.log(`[ResponseCompletionHandler] 保存到topic.messages，blocks: [${updatedMessage.blocks?.join(', ')}]`);

          // 保存更新后的话题
          await dexieStorage.topics.put(topic);
        }
      }
    });

    // 基于 Chatbox 原理 - ResponseHandler 不管版本，只负责生成内容
    // 版本管理完全由 messageThunk 在重新生成前处理
    console.log(`[ResponseCompletionHandler] 内容生成完成，版本管理由调用方处理`);
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
