/**
 * 基础回调模块
 * 完全参考 Cherry Studio baseCallbacks.ts 实现
 */

import { MessageBlockStatus, MessageBlockType, AssistantMessageStatus } from '../../../types/newMessage';
import type { MessageBlock, PlaceholderMessageBlock } from '../../../types/newMessage';
import { newMessagesActions } from '../../../store/slices/newMessagesSlice';
import { EventEmitter, EVENT_NAMES } from '../../EventService';
import { createBaseMessageBlock, createErrorBlock } from '../../../utils/messageUtils/blockFactory';
import type { BlockManager } from '../BlockManager';
import type { AppDispatch, RootState } from '../../../store';
import type { Assistant } from './types';

/**
 * 基础回调依赖
 * 完全参考 Cherry Studio BaseCallbacksDependencies
 */
interface BaseCallbacksDependencies {
  blockManager: BlockManager;
  dispatch: AppDispatch;
  getState: () => RootState;
  topicId: string;
  assistantMsgId: string;
  saveUpdatesToDB: any;
  assistant: Assistant;
}

/**
 * 判断是否为中止错误
 */
const isAbortError = (error: any): boolean => {
  return error?.name === 'AbortError' ||
    error?.message?.includes('aborted') ||
    error?.message?.includes('cancelled');
};

/**
 * 序列化错误对象
 */
const serializeError = (error: any) => {
  return {
    message: error?.message || 'Unknown error',
    name: error?.name || 'Error',
    stack: error?.stack
  };
};

/**
 * 查找所有块
 */
const findAllBlocks = (message: any): MessageBlock[] => {
  if (!message?.blocks) return [];
  return message.blocks;
};

/**
 * 获取主文本内容
 */
const getMainTextContent = (message: any): string => {
  if (!message?.blocks) return '';
  const mainTextBlock = message.blocks.find((b: any) => b?.type === MessageBlockType.MAIN_TEXT);
  return mainTextBlock?.content || '';
};

/**
 * 创建基础回调
 * 完全参考 Cherry Studio 实现
 */
export const createBaseCallbacks = (deps: BaseCallbacksDependencies) => {
  const { blockManager, dispatch, getState, topicId, assistantMsgId, saveUpdatesToDB } = deps;

  const startTime = Date.now();

  // 通用的 block 查找函数
  const findBlockIdForCompletion = (message?: any) => {
    // 优先使用 BlockManager 中的 activeBlockInfo
    const activeBlockInfo = blockManager.activeBlockInfo;

    if (activeBlockInfo) {
      return activeBlockInfo.id;
    }

    // 如果没有活跃的block，从message中查找最新的block作为备选
    const targetMessage = message || getState().messages?.entities?.[assistantMsgId];
    if (targetMessage) {
      const allBlocks = findAllBlocks(targetMessage);
      if (allBlocks.length > 0) {
        return allBlocks[allBlocks.length - 1].id; // 返回最新的block
      }
    }

    // 最后的备选方案：从 blockManager 获取占位符块ID
    return blockManager.initialPlaceholderBlockId;
  };

  return {
    onLLMResponseCreated: async () => {
      const baseBlock = createBaseMessageBlock(assistantMsgId, MessageBlockType.UNKNOWN, {
        status: MessageBlockStatus.PROCESSING
      });
      await blockManager.handleBlockTransition(baseBlock as PlaceholderMessageBlock, MessageBlockType.UNKNOWN);
    },

    onError: async (error: any) => {
      console.error('[BaseCallbacks] onError', error);
      
      const isErrorTypeAbort = isAbortError(error);
      const serializableError = serializeError(error);
      if (isErrorTypeAbort) {
        serializableError.message = 'pause_placeholder';
      }

      const duration = Date.now() - startTime;
      console.log(`[BaseCallbacks] Error after ${duration}ms`);

      const possibleBlockId = findBlockIdForCompletion();

      if (possibleBlockId) {
        // 更改上一个block的状态为ERROR
        const changes = {
          status: isErrorTypeAbort ? MessageBlockStatus.PAUSED : MessageBlockStatus.ERROR
        };
        blockManager.smartBlockUpdate(possibleBlockId, changes, blockManager.lastBlockType!, true);
      }

      const errorBlock = createErrorBlock(assistantMsgId, serializableError, { status: MessageBlockStatus.SUCCESS });
      await blockManager.handleBlockTransition(errorBlock, MessageBlockType.ERROR);
      
      const messageErrorUpdate = {
        status: isErrorTypeAbort ? AssistantMessageStatus.SUCCESS : AssistantMessageStatus.ERROR
      };
      dispatch(
        newMessagesActions.updateMessage({
          topicId,
          messageId: assistantMsgId,
          updates: messageErrorUpdate
        })
      );
      await saveUpdatesToDB(assistantMsgId, topicId, messageErrorUpdate, []);

      EventEmitter.emit(EVENT_NAMES.MESSAGE_COMPLETE, {
        id: assistantMsgId,
        topicId,
        status: isErrorTypeAbort ? 'pause' : 'error',
        error: error.message
      });
    },

    onComplete: async (status: AssistantMessageStatus, response?: any) => {
      const finalStateOnComplete = getState();
      const finalAssistantMsg = finalStateOnComplete.messages?.entities?.[assistantMsgId];

      if (status === AssistantMessageStatus.SUCCESS && finalAssistantMsg) {
        const possibleBlockId = findBlockIdForCompletion(finalAssistantMsg);

        if (possibleBlockId) {
          const changes = {
            status: MessageBlockStatus.SUCCESS
          };
          blockManager.smartBlockUpdate(possibleBlockId, changes, blockManager.lastBlockType!, true);
        }

        const duration = Date.now() - startTime;
        const content = getMainTextContent(finalAssistantMsg);
        console.log(`[BaseCallbacks] Complete after ${duration}ms, content length: ${content.length}`);
      }

      if (response && response.metrics) {
        if (response.metrics.completion_tokens === 0 && response.usage?.completion_tokens) {
          response = {
            ...response,
            metrics: {
              ...response.metrics,
              completion_tokens: response.usage.completion_tokens
            }
          };
        }
      }

      const messageUpdates = { status, metrics: response?.metrics, usage: response?.usage };
      dispatch(
        newMessagesActions.updateMessage({
          topicId,
          messageId: assistantMsgId,
          updates: messageUpdates
        })
      );
      await saveUpdatesToDB(assistantMsgId, topicId, messageUpdates, []);
      EventEmitter.emit(EVENT_NAMES.MESSAGE_COMPLETE, { id: assistantMsgId, topicId, status });
      console.log('[BaseCallbacks] onComplete finished');
    }
  };
};
