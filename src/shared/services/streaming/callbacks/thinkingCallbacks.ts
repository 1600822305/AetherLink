/**
 * 思考链回调模块
 * 处理思考/推理内容流式响应
 * 
 * 参考 Cherry Studio thinkingCallbacks 设计
 */

import { MessageBlockStatus, MessageBlockType } from '../../../types/newMessage';
import type { MessageBlock } from '../../../types/newMessage';
import { v4 as uuid } from 'uuid';
import type { CallbackDependencies, StreamProcessorCallbacks } from './types';

/**
 * 创建思考链回调
 */
export function createThinkingCallbacks(deps: CallbackDependencies): Partial<StreamProcessorCallbacks> {
  const { messageId, blockManager } = deps;
  
  // 内部状态
  let thinkingBlockId: string | null = null;

  /**
   * 创建新的思考块
   */
  const createNewThinkingBlock = async (): Promise<string> => {
    const newBlockId = uuid();
    const newBlock: MessageBlock = {
      id: newBlockId,
      messageId,
      type: MessageBlockType.THINKING,
      content: '',
      createdAt: new Date().toISOString(),
      status: MessageBlockStatus.STREAMING,
      thinking_millsec: 0
    } as MessageBlock;
    
    await blockManager.handleBlockTransition(newBlock, MessageBlockType.THINKING);
    return newBlockId;
  };

  return {
    /**
     * 思考开始
     * 参考 Cherry Studio：在 Start 回调中创建/复用块
     */
    onThinkingStart: async () => {
      console.log('[ThinkingCallbacks] 思考开始');
      
      // 参考 Cherry Studio：在 onThinkingStart 中创建/复用块
      if (blockManager.hasInitialPlaceholder && blockManager.initialPlaceholderBlockId) {
        // 复用占位符块
        thinkingBlockId = blockManager.initialPlaceholderBlockId;
        blockManager.smartBlockUpdate(
          thinkingBlockId,
          {
            type: MessageBlockType.THINKING,
            content: '',
            status: MessageBlockStatus.STREAMING,
            thinking_millsec: 0
          },
          MessageBlockType.THINKING,
          true  // 关键：标记占位符已被使用
        );
      } else if (!thinkingBlockId) {
        // 创建新思考块
        thinkingBlockId = await createNewThinkingBlock();
      }
    },

    /**
     * 思考增量
     */
    onThinkingChunk: async (text: string, thinkingMillsec?: number) => {
      if (!text) return;
      
      // 如果还没有思考块（onThinkingStart 没被调用），创建一个
      if (!thinkingBlockId) {
        console.warn('[ThinkingCallbacks] onThinkingChunk 被调用但 thinkingBlockId 为 null，可能 THINKING_START 未发送');
        if (blockManager.hasInitialPlaceholder && blockManager.initialPlaceholderBlockId) {
          thinkingBlockId = blockManager.initialPlaceholderBlockId;
          blockManager.smartBlockUpdate(
            thinkingBlockId,
            {
              type: MessageBlockType.THINKING,
              content: '',
              status: MessageBlockStatus.STREAMING,
              thinking_millsec: 0
            },
            MessageBlockType.THINKING,
            true
          );
        } else {
          thinkingBlockId = await createNewThinkingBlock();
        }
      }
      
      // 直接使用传入的文本（适配器发送的是累积文本）
      blockManager.smartBlockUpdate(
        thinkingBlockId!,
        {
          content: text,
          status: MessageBlockStatus.STREAMING,
          thinking_millsec: thinkingMillsec
        },
        MessageBlockType.THINKING,
        false
      );
    },

    /**
     * 思考完成
     */
    onThinkingComplete: async (finalText: string, thinkingMillsec?: number) => {
      console.log('[ThinkingCallbacks] 思考完成', { blockId: thinkingBlockId, textLength: finalText.length });
      
      if (thinkingBlockId) {
        blockManager.smartBlockUpdate(
          thinkingBlockId,
          {
            content: finalText,
            status: MessageBlockStatus.SUCCESS,
            thinking_millsec: thinkingMillsec
          },
          MessageBlockType.THINKING,
          true
        );
      }
      
      // 重置状态
      thinkingBlockId = null;
    },

    // 暴露内部状态
    getCurrentThinkingBlockId: () => thinkingBlockId
  } as any;
}
