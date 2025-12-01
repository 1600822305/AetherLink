/**
 * 文本回调模块
 * 处理文本流式响应
 * 
 * 参考 Cherry Studio textCallbacks 设计
 */

import { MessageBlockStatus, MessageBlockType } from '../../../types/newMessage';
import type { MessageBlock } from '../../../types/newMessage';
import { v4 as uuid } from 'uuid';
import type { CallbackDependencies, StreamProcessorCallbacks } from './types';

/**
 * 创建文本回调
 */
export function createTextCallbacks(deps: CallbackDependencies): Partial<StreamProcessorCallbacks> {
  const { messageId, blockManager } = deps;
  
  // 内部状态
  let mainTextBlockId: string | null = null;

  /**
   * 创建新的文本块
   */
  const createNewTextBlock = async (): Promise<string> => {
    const newBlockId = uuid();
    const newBlock: MessageBlock = {
      id: newBlockId,
      messageId,
      type: MessageBlockType.MAIN_TEXT,
      content: '',
      createdAt: new Date().toISOString(),
      status: MessageBlockStatus.STREAMING
    };
    
    await blockManager.handleBlockTransition(newBlock, MessageBlockType.MAIN_TEXT);
    return newBlockId;
  };

  return {
    /**
     * 文本开始
     * 参考 Cherry Studio：在 Start 回调中创建/复用块
     */
    onTextStart: async () => {
      console.log('[TextCallbacks] 文本开始');
      
      // 参考 Cherry Studio：在 onTextStart 中创建/复用块
      if (blockManager.hasInitialPlaceholder && blockManager.initialPlaceholderBlockId) {
        // 复用占位符块
        mainTextBlockId = blockManager.initialPlaceholderBlockId;
        blockManager.smartBlockUpdate(
          mainTextBlockId,
          {
            type: MessageBlockType.MAIN_TEXT,
            content: '',
            status: MessageBlockStatus.STREAMING
          },
          MessageBlockType.MAIN_TEXT,
          true  // 关键：标记占位符已被使用
        );
      } else if (!mainTextBlockId) {
        // 创建新文本块
        mainTextBlockId = await createNewTextBlock();
      }
    },

    /**
     * 文本增量
     * 参考 Cherry Studio：直接使用传入的文本，适配器已处理累积
     */
    onTextChunk: async (text: string) => {
      if (!text) return;
      
      // 如果还没有文本块（onTextStart 没被调用），创建一个
      if (!mainTextBlockId) {
        console.warn('[TextCallbacks] onTextChunk 被调用但 mainTextBlockId 为 null，可能 TEXT_START 未发送');
        if (blockManager.hasInitialPlaceholder && blockManager.initialPlaceholderBlockId) {
          mainTextBlockId = blockManager.initialPlaceholderBlockId;
          blockManager.smartBlockUpdate(
            mainTextBlockId,
            {
              type: MessageBlockType.MAIN_TEXT,
              content: '',
              status: MessageBlockStatus.STREAMING
            },
            MessageBlockType.MAIN_TEXT,
            true
          );
        } else {
          mainTextBlockId = await createNewTextBlock();
        }
      }
      
      // 直接使用传入的文本（适配器发送的是累积文本）
      blockManager.smartBlockUpdate(
        mainTextBlockId!,
        {
          content: text,
          status: MessageBlockStatus.STREAMING
        },
        MessageBlockType.MAIN_TEXT,
        false
      );
    },

    /**
     * 文本完成
     */
    onTextComplete: async (finalText: string) => {
      console.log('[TextCallbacks] 文本完成', { blockId: mainTextBlockId, textLength: finalText.length });
      
      if (mainTextBlockId) {
        blockManager.smartBlockUpdate(
          mainTextBlockId,
          {
            content: finalText,
            status: MessageBlockStatus.SUCCESS
          },
          MessageBlockType.MAIN_TEXT,
          true
        );
      }
      
      // 重置状态，允许下一轮创建新块
      mainTextBlockId = null;
    },

    // 暴露内部状态的方法（供外部查询）
    getCurrentTextBlockId: () => mainTextBlockId,
    resetTextBlock: () => {
      mainTextBlockId = null;
    }
  } as any;
}
