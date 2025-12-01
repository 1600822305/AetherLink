/**
 * 思考链回调模块
 * 完全参考 Cherry Studio thinkingCallbacks.ts 实现
 */

import type { MessageBlock } from '../../../types/newMessage';
import { MessageBlockStatus, MessageBlockType } from '../../../types/newMessage';
import { createThinkingBlock } from '../../../utils/messageUtils/blockFactory';
import type { BlockManager } from '../BlockManager';

/**
 * 思考回调依赖
 * 完全参考 Cherry Studio ThinkingCallbacksDependencies
 */
interface ThinkingCallbacksDependencies {
  blockManager: BlockManager;
  assistantMsgId: string;
}

/**
 * 创建思考链回调
 * 完全参考 Cherry Studio 实现
 */
export const createThinkingCallbacks = (deps: ThinkingCallbacksDependencies) => {
  const { blockManager, assistantMsgId } = deps;

  // 内部维护的状态
  let thinkingBlockId: string | null = null;
  let thinking_millsec_now: number = 0;

  return {
    onThinkingStart: async () => {
      if (blockManager.hasInitialPlaceholder) {
        const changes: Partial<MessageBlock> = {
          type: MessageBlockType.THINKING,
          content: '',
          status: MessageBlockStatus.STREAMING,
          thinking_millsec: 0
        };
        thinkingBlockId = blockManager.initialPlaceholderBlockId!;
        blockManager.smartBlockUpdate(thinkingBlockId, changes, MessageBlockType.THINKING, true);
      } else if (!thinkingBlockId) {
        // createThinkingBlock 只接受 2 个参数，额外属性在创建后设置
        const newBlock = createThinkingBlock(assistantMsgId, '');
        (newBlock as any).status = MessageBlockStatus.STREAMING;
        (newBlock as any).thinking_millsec = 0;
        thinkingBlockId = newBlock.id;
        await blockManager.handleBlockTransition(newBlock, MessageBlockType.THINKING);
      }
      thinking_millsec_now = performance.now();
    },

    onThinkingChunk: async (text: string) => {
      if (thinkingBlockId) {
        const blockChanges: Partial<MessageBlock> = {
          content: text,
          status: MessageBlockStatus.STREAMING
        };
        blockManager.smartBlockUpdate(thinkingBlockId, blockChanges, MessageBlockType.THINKING);
      }
    },

    onThinkingComplete: (finalText: string) => {
      if (thinkingBlockId) {
        const now = performance.now();
        const changes: Partial<MessageBlock> = {
          content: finalText,
          status: MessageBlockStatus.SUCCESS,
          thinking_millsec: now - thinking_millsec_now
        };
        blockManager.smartBlockUpdate(thinkingBlockId, changes, MessageBlockType.THINKING, true);
        thinkingBlockId = null;
        thinking_millsec_now = 0;
      } else {
        console.warn(
          `[onThinkingComplete] Received thinking.complete but last block was not THINKING (was ${blockManager.lastBlockType}) or lastBlockId is null.`
        );
      }
    }
  };
};
