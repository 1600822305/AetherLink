/**
 * 引用回调模块
 * 完全参考 Cherry Studio citationCallbacks.ts 实现
 */

import type { CitationMessageBlock, MainTextMessageBlock } from '../../../types/newMessage';
import { MessageBlockStatus, MessageBlockType } from '../../../types/newMessage';
import { createCitationBlock } from '../../../utils/messageUtils/blockFactory';
import type { BlockManager } from '../BlockManager';

/**
 * 引用回调依赖
 * 完全参考 Cherry Studio CitationCallbacksDependencies
 */
interface CitationCallbacksDependencies {
  blockManager: BlockManager;
  assistantMsgId: string;
  getState: any;
}

/**
 * 查找消息中的主文本块
 */
const findMainTextBlocks = (message: any): MainTextMessageBlock[] => {
  if (!message?.blocks) return [];
  return (message.blocks || [])
    .map((blockRef: any) => blockRef)
    .filter((block: any) => block?.type === MessageBlockType.MAIN_TEXT) as MainTextMessageBlock[];
};

/**
 * 创建引用回调
 * 完全参考 Cherry Studio 实现
 */
export const createCitationCallbacks = (deps: CitationCallbacksDependencies) => {
  const { blockManager, assistantMsgId, getState } = deps;

  // 内部维护的状态
  let citationBlockId: string | null = null;

  return {
    onExternalToolInProgress: async () => {
      // 避免创建重复的引用块
      if (citationBlockId) {
        console.warn(`[onExternalToolInProgress] Citation block already exists: ${citationBlockId}`);
        return;
      }
      const citationBlock = createCitationBlock(assistantMsgId, { content: '' }, { status: MessageBlockStatus.PROCESSING });
      citationBlockId = citationBlock.id;
      await blockManager.handleBlockTransition(citationBlock, MessageBlockType.CITATION);
    },

    onExternalToolComplete: (externalToolResult: any) => {
      if (citationBlockId) {
        const changes: Partial<CitationMessageBlock> = {
          response: externalToolResult.webSearch,
          knowledge: externalToolResult.knowledge,
          status: MessageBlockStatus.SUCCESS
        };
        blockManager.smartBlockUpdate(citationBlockId, changes, MessageBlockType.CITATION, true);
      } else {
        console.error('[onExternalToolComplete] citationBlockId is null. Cannot update.');
      }
    },

    onLLMWebSearchInProgress: async () => {
      // 避免创建重复的引用块
      if (citationBlockId) {
        console.warn(`[onLLMWebSearchInProgress] Citation block already exists: ${citationBlockId}`);
        return;
      }
      if (blockManager.hasInitialPlaceholder) {
        console.log(`[CitationCallbacks] blockManager.initialPlaceholderBlockId: ${blockManager.initialPlaceholderBlockId}`);
        citationBlockId = blockManager.initialPlaceholderBlockId!;

        const changes = {
          type: MessageBlockType.CITATION,
          status: MessageBlockStatus.PROCESSING
        };
        blockManager.smartBlockUpdate(citationBlockId, changes, MessageBlockType.CITATION);
      } else {
        const citationBlock = createCitationBlock(assistantMsgId, { content: '' }, { status: MessageBlockStatus.PROCESSING });
        citationBlockId = citationBlock.id;
        await blockManager.handleBlockTransition(citationBlock, MessageBlockType.CITATION);
      }
    },

    onLLMWebSearchComplete: async (llmWebSearchResult: any) => {
      const blockId = citationBlockId || blockManager.initialPlaceholderBlockId;
      if (blockId) {
        const changes: Partial<CitationMessageBlock> = {
          type: MessageBlockType.CITATION,
          response: llmWebSearchResult,
          status: MessageBlockStatus.SUCCESS
        };
        blockManager.smartBlockUpdate(blockId, changes, MessageBlockType.CITATION, true);

        const state = getState();
        const existingMainTextBlocks = findMainTextBlocks(state.messages?.entities?.[assistantMsgId]);
        if (existingMainTextBlocks.length > 0) {
          const existingMainTextBlock = existingMainTextBlocks[0];
          const currentRefs = (existingMainTextBlock as any).citationReferences || [];
          const mainTextChanges = {
            citationReferences: [...currentRefs, { blockId, citationBlockSource: llmWebSearchResult.source }]
          };
          blockManager.smartBlockUpdate(existingMainTextBlock.id, mainTextChanges, MessageBlockType.MAIN_TEXT, true);
        }

        if (blockManager.hasInitialPlaceholder) {
          citationBlockId = blockManager.initialPlaceholderBlockId;
        }
      } else {
        const citationBlock = createCitationBlock(
          assistantMsgId,
          {
            content: '',
            response: llmWebSearchResult
          },
          {
            status: MessageBlockStatus.SUCCESS
          }
        );
        citationBlockId = citationBlock.id;

        const state = getState();
        const existingMainTextBlocks = findMainTextBlocks(state.messages?.entities?.[assistantMsgId]);
        if (existingMainTextBlocks.length > 0) {
          const existingMainTextBlock = existingMainTextBlocks[0];
          const currentRefs = (existingMainTextBlock as any).citationReferences || [];
          const mainTextChanges = {
            citationReferences: [...currentRefs, { citationBlockId, citationBlockSource: llmWebSearchResult.source }]
          };
          blockManager.smartBlockUpdate(existingMainTextBlock.id, mainTextChanges, MessageBlockType.MAIN_TEXT, true);
        }
        await blockManager.handleBlockTransition(citationBlock, MessageBlockType.CITATION);
      }
    },

    // 暴露给外部的方法，用于textCallbacks中获取citationBlockId
    getCitationBlockId: () => citationBlockId
  };
};
