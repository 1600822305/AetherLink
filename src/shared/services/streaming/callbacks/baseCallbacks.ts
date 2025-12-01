/**
 * 基础回调模块
 * 处理 LLM 响应生命周期和错误
 * 
 * 参考 Cherry Studio baseCallbacks 设计
 */

import { MessageBlockStatus, MessageBlockType, AssistantMessageStatus } from '../../../types/newMessage';
import { newMessagesActions } from '../../../store/slices/newMessagesSlice';
import { EventEmitter, EVENT_NAMES } from '../../EventService';
import type { CallbackDependencies, StreamProcessorCallbacks } from './types';

/**
 * 创建基础回调
 */
export function createBaseCallbacks(deps: CallbackDependencies): Partial<StreamProcessorCallbacks> {
  const { dispatch, getState, messageId, topicId, blockManager, saveUpdatesToDB } = deps;
  
  const startTime = Date.now();

  return {
    /**
     * LLM 响应创建
     */
    onLLMResponseCreated: async () => {
      console.log('[BaseCallbacks] LLM 响应创建');
      // 如果没有初始占位符，创建一个
      if (!blockManager.hasInitialPlaceholder) {
        // 占位符块应该已经在 processAssistantResponse 中创建
        console.log('[BaseCallbacks] 使用已有的占位符块');
      }
    },

    /**
     * LLM 响应完成
     */
    onLLMResponseComplete: async (response?: any) => {
      console.log('[BaseCallbacks] LLM 响应完成');
      
      // 更新消息的 usage 和 metrics
      if (response?.usage || response?.metrics) {
        dispatch(newMessagesActions.updateMessage({
          id: messageId,
          changes: {
            usage: response.usage,
            metrics: response.metrics
          }
        }));
      }
    },

    /**
     * 块完成
     */
    onBlockComplete: async (response?: any) => {
      console.log('[BaseCallbacks] 块完成');
      // 块完成的处理由具体的回调模块处理
    },

    /**
     * 错误处理
     */
    onError: async (error: any) => {
      console.error('[BaseCallbacks] 错误:', error);
      
      const isAbortError = error?.name === 'AbortError' || 
                          error?.message?.includes('aborted') ||
                          error?.message?.includes('cancelled');
      
      // 更新当前块状态
      const activeBlock = blockManager.activeBlockInfo;
      if (activeBlock) {
        blockManager.smartBlockUpdate(
          activeBlock.id,
          { 
            status: isAbortError ? MessageBlockStatus.PAUSED : MessageBlockStatus.ERROR 
          },
          activeBlock.type,
          true
        );
      }

      // 更新消息状态
      const messageStatus = isAbortError 
        ? AssistantMessageStatus.SUCCESS  // 用户主动中断视为成功
        : AssistantMessageStatus.ERROR;
      
      dispatch(newMessagesActions.updateMessage({
        id: messageId,
        changes: { status: messageStatus }
      }));
      
      await saveUpdatesToDB(messageId, topicId, { status: messageStatus }, []);

      // 发送完成事件
      EventEmitter.emit(EVENT_NAMES.MESSAGE_COMPLETE, {
        id: messageId,
        topicId,
        status: isAbortError ? 'pause' : 'error',
        error: error?.message
      });

      // 清除加载状态
      dispatch(newMessagesActions.setTopicLoading({ topicId, loading: false }));
      dispatch(newMessagesActions.setTopicStreaming({ topicId, streaming: false }));
    },

    /**
     * 处理完成
     */
    onComplete: async (status: AssistantMessageStatus | string, response?: any) => {
      const duration = Date.now() - startTime;
      console.log(`[BaseCallbacks] 处理完成，状态: ${status}，耗时: ${duration}ms`);

      // 确保活跃块标记为完成
      const activeBlock = blockManager.activeBlockInfo;
      if (activeBlock) {
        blockManager.smartBlockUpdate(
          activeBlock.id,
          { status: MessageBlockStatus.SUCCESS },
          activeBlock.type,
          true
        );
      }

      // 刷新节流更新
      blockManager.flushThrottle?.();

      // 更新消息状态
      const finalStatus = status === 'success' || status === AssistantMessageStatus.SUCCESS
        ? AssistantMessageStatus.SUCCESS
        : status as AssistantMessageStatus;
      
      const messageUpdates = {
        status: finalStatus,
        metrics: response?.metrics,
        usage: response?.usage
      };
      
      dispatch(newMessagesActions.updateMessage({
        id: messageId,
        changes: messageUpdates
      }));
      
      await saveUpdatesToDB(messageId, topicId, messageUpdates, []);

      // 发送完成事件
      EventEmitter.emit(EVENT_NAMES.MESSAGE_COMPLETE, {
        id: messageId,
        topicId,
        status: finalStatus
      });

      // 清除加载状态
      dispatch(newMessagesActions.setTopicLoading({ topicId, loading: false }));
      dispatch(newMessagesActions.setTopicStreaming({ topicId, streaming: false }));
    }
  };
}
