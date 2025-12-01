/**
 * 文本回调模块
 * 完全参考 Cherry Studio textCallbacks.ts 实现
 */

import type { MessageBlock } from '../../../types/newMessage';
import { MessageBlockStatus, MessageBlockType } from '../../../types/newMessage';
import { createMainTextBlock } from '../../../utils/messageUtils/blockFactory';
import type { BlockManager } from '../BlockManager';

/**
 * 文本回调依赖
 * 完全参考 Cherry Studio TextCallbacksDependencies
 */
interface TextCallbacksDependencies {
  blockManager: BlockManager;
  getState: any;
  assistantMsgId: string;
  getCitationBlockId: () => string | null;
  getCitationBlockIdFromTool: () => string | null;
}

/**
 * 创建文本回调
 * 完全参考 Cherry Studio 实现
 */
export const createTextCallbacks = (deps: TextCallbacksDependencies) => {
  const {
    blockManager,
    getState,
    assistantMsgId,
    getCitationBlockId,
    getCitationBlockIdFromTool
  } = deps;

  // 内部维护的状态
  let mainTextBlockId: string | null = null;

  return {
    getCurrentMainTextBlockId: () => mainTextBlockId,
    
    onTextStart: async () => {
      if (blockManager.hasInitialPlaceholder) {
        const changes: Partial<MessageBlock> = {
          type: MessageBlockType.MAIN_TEXT,
          content: '',
          status: MessageBlockStatus.STREAMING
        };
        mainTextBlockId = blockManager.initialPlaceholderBlockId!;
        blockManager.smartBlockUpdate(mainTextBlockId, changes, MessageBlockType.MAIN_TEXT, true);
      } else if (!mainTextBlockId) {
        const newBlock = createMainTextBlock(assistantMsgId, '', {
          status: MessageBlockStatus.STREAMING
        });
        mainTextBlockId = newBlock.id;
        await blockManager.handleBlockTransition(newBlock, MessageBlockType.MAIN_TEXT);
      }
    },

    onTextChunk: async (text: string) => {
      const citationBlockId = getCitationBlockId() || getCitationBlockIdFromTool();
      const citationBlockSource = citationBlockId
        ? getState().messageBlocks?.entities?.[citationBlockId]?.response?.source
        : undefined;
      
      if (text) {
        const blockChanges: Partial<MessageBlock> = {
          content: text,
          status: MessageBlockStatus.STREAMING,
          citationReferences: citationBlockId 
            ? [{ citationBlockId, citationBlockSource }] 
            : []
        };
        blockManager.smartBlockUpdate(mainTextBlockId!, blockChanges, MessageBlockType.MAIN_TEXT);
      }
    },

    onTextComplete: async (finalText: string) => {
      if (mainTextBlockId) {
        const changes: Partial<MessageBlock> = {
          content: finalText,
          status: MessageBlockStatus.SUCCESS
        };
        blockManager.smartBlockUpdate(mainTextBlockId, changes, MessageBlockType.MAIN_TEXT, true);
        mainTextBlockId = null;
      } else {
        console.warn(
          `[onTextComplete] Received text.complete but last block was not MAIN_TEXT (was ${blockManager.lastBlockType}) or lastBlockId is null.`
        );
      }
    }
  };
};
