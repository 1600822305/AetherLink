/**
 * 引用回调模块
 * 处理网络搜索、知识库引用等引用信息
 * 
 * 参考 Cherry Studio citationCallbacks 设计
 */

import { v4 as uuid } from 'uuid';
import { MessageBlockStatus, MessageBlockType } from '../../../types/newMessage';
import type { CitationMessageBlock, MessageBlock, MainTextMessageBlock } from '../../../types/newMessage';
import type { CallbackDependencies, StreamProcessorCallbacks, KnowledgeReference, Citation } from './types';

/**
 * 创建引用回调
 */
export function createCitationCallbacks(deps: CallbackDependencies): Partial<StreamProcessorCallbacks> {
  const { messageId, blockManager, getState } = deps;
  
  // 内部状态
  let citationBlockId: string | null = null;

  /**
   * 创建新的引用块
   */
  const createNewCitationBlock = (overrides: Partial<CitationMessageBlock> = {}): MessageBlock => {
    return {
      id: uuid(),
      messageId,
      type: MessageBlockType.CITATION,
      content: '',
      createdAt: new Date().toISOString(),
      status: MessageBlockStatus.PROCESSING,
      ...overrides
    } as CitationMessageBlock;
  };

  /**
   * 查找消息中的主文本块
   */
  const findMainTextBlocks = (): MainTextMessageBlock[] => {
    const state = getState();
    const message = state.messages?.entities?.[messageId];
    if (!message?.blocks) return [];
    
    const blockEntities = state.messageBlocks?.entities || {};
    return message.blocks
      .map((blockId: string) => blockEntities[blockId])
      .filter((block: any) => block?.type === MessageBlockType.MAIN_TEXT) as MainTextMessageBlock[];
  };

  return {
    /**
     * 外部工具（搜索等）进行中
     */
    onExternalToolInProgress: async () => {
      console.log('[CitationCallbacks] 外部工具进行中');
      
      // 避免重复创建
      if (citationBlockId) {
        console.warn('[CitationCallbacks] 引用块已存在:', citationBlockId);
        return;
      }
      
      const newBlock = createNewCitationBlock({ status: MessageBlockStatus.PROCESSING });
      citationBlockId = newBlock.id;
      await blockManager.handleBlockTransition(newBlock, MessageBlockType.CITATION);
    },

    /**
     * 外部工具完成
     */
    onExternalToolComplete: async (externalToolResult: any) => {
      console.log('[CitationCallbacks] 外部工具完成');
      
      if (citationBlockId) {
        const changes: Partial<CitationMessageBlock> = {
          response: externalToolResult?.webSearch,
          knowledge: externalToolResult?.knowledge,
          status: MessageBlockStatus.SUCCESS
        };
        blockManager.smartBlockUpdate(citationBlockId, changes, MessageBlockType.CITATION, true);
      } else {
        console.error('[CitationCallbacks] citationBlockId 为空，无法更新');
      }
    },

    /**
     * LLM 网络搜索进行中
     */
    onLLMWebSearchInProgress: async () => {
      console.log('[CitationCallbacks] LLM 网络搜索进行中');
      
      // 避免重复创建
      if (citationBlockId) {
        console.warn('[CitationCallbacks] 引用块已存在:', citationBlockId);
        return;
      }
      
      if (blockManager.hasInitialPlaceholder && blockManager.initialPlaceholderBlockId) {
        // 复用占位符块
        citationBlockId = blockManager.initialPlaceholderBlockId;
        blockManager.smartBlockUpdate(
          citationBlockId,
          {
            type: MessageBlockType.CITATION,
            status: MessageBlockStatus.PROCESSING
          },
          MessageBlockType.CITATION,
          false
        );
      } else {
        // 创建新引用块
        const newBlock = createNewCitationBlock({ status: MessageBlockStatus.PROCESSING });
        citationBlockId = newBlock.id;
        await blockManager.handleBlockTransition(newBlock, MessageBlockType.CITATION);
      }
    },

    /**
     * LLM 网络搜索完成
     */
    onLLMWebSearchComplete: async (llmWebSearchResult: any) => {
      console.log('[CitationCallbacks] LLM 网络搜索完成');
      
      const blockId = citationBlockId || blockManager.initialPlaceholderBlockId;
      
      if (blockId) {
        const changes: Partial<CitationMessageBlock> = {
          type: MessageBlockType.CITATION,
          response: llmWebSearchResult,
          status: MessageBlockStatus.SUCCESS
        };
        blockManager.smartBlockUpdate(blockId, changes, MessageBlockType.CITATION, true);
        
        // 更新主文本块的引用引用
        const mainTextBlocks = findMainTextBlocks();
        if (mainTextBlocks.length > 0) {
          const mainTextBlock = mainTextBlocks[0];
          const currentRefs = (mainTextBlock as any).citationReferences || [];
          const mainTextChanges = {
            citationReferences: [
              ...currentRefs,
              { citationBlockId: blockId, citationBlockSource: llmWebSearchResult?.source }
            ]
          };
          blockManager.smartBlockUpdate(mainTextBlock.id, mainTextChanges, MessageBlockType.MAIN_TEXT, true);
        }
        
        // 更新内部状态
        if (blockManager.hasInitialPlaceholder) {
          citationBlockId = blockManager.initialPlaceholderBlockId;
        }
      } else {
        // 创建新的引用块
        const newBlock = createNewCitationBlock({
          response: llmWebSearchResult,
          status: MessageBlockStatus.SUCCESS
        });
        citationBlockId = newBlock.id;
        
        // 更新主文本块的引用引用
        const mainTextBlocks = findMainTextBlocks();
        if (mainTextBlocks.length > 0) {
          const mainTextBlock = mainTextBlocks[0];
          const currentRefs = (mainTextBlock as any).citationReferences || [];
          const mainTextChanges = {
            citationReferences: [
              ...currentRefs,
              { citationBlockId, citationBlockSource: llmWebSearchResult?.source }
            ]
          };
          blockManager.smartBlockUpdate(mainTextBlock.id, mainTextChanges, MessageBlockType.MAIN_TEXT, true);
        }
        
        await blockManager.handleBlockTransition(newBlock, MessageBlockType.CITATION);
      }
    },

    /**
     * 知识库搜索进行中
     */
    onKnowledgeSearchInProgress: async (query?: string) => {
      console.log('[CitationCallbacks] 知识库搜索进行中', query);
      
      if (!citationBlockId) {
        const newBlock = createNewCitationBlock({
          status: MessageBlockStatus.PROCESSING,
          content: query || ''
        });
        citationBlockId = newBlock.id;
        await blockManager.handleBlockTransition(newBlock, MessageBlockType.CITATION);
      }
    },

    /**
     * 知识库搜索完成
     */
    onKnowledgeSearchComplete: async (references: KnowledgeReference[]) => {
      console.log('[CitationCallbacks] 知识库搜索完成', references?.length || 0);
      
      if (citationBlockId) {
        const changes: Partial<CitationMessageBlock> = {
          knowledge: references,
          status: MessageBlockStatus.SUCCESS
        };
        blockManager.smartBlockUpdate(citationBlockId, changes, MessageBlockType.CITATION, true);
      } else if (references && references.length > 0) {
        const newBlock = createNewCitationBlock({
          knowledge: references,
          status: MessageBlockStatus.SUCCESS
        });
        await blockManager.handleBlockTransition(newBlock, MessageBlockType.CITATION);
      }
    },

    /**
     * 引用增量
     */
    onCitationDelta: async (citations: Citation[]) => {
      if (!citationBlockId) {
        const newBlock = createNewCitationBlock({
          sources: citations.map(c => ({
            title: c.title,
            url: c.url,
            content: c.snippet
          })),
          status: MessageBlockStatus.STREAMING
        });
        citationBlockId = newBlock.id;
        await blockManager.handleBlockTransition(newBlock, MessageBlockType.CITATION);
      } else {
        const changes: Partial<CitationMessageBlock> = {
          sources: citations.map(c => ({
            title: c.title,
            url: c.url,
            content: c.snippet
          })),
          status: MessageBlockStatus.STREAMING
        };
        blockManager.smartBlockUpdate(citationBlockId, changes, MessageBlockType.CITATION, false);
      }
    },

    /**
     * 引用完成
     */
    onCitationComplete: async (citations: Citation[]) => {
      console.log('[CitationCallbacks] 引用完成', citations?.length || 0);
      
      if (citationBlockId) {
        const changes: Partial<CitationMessageBlock> = {
          sources: citations.map(c => ({
            title: c.title,
            url: c.url,
            content: c.snippet
          })),
          status: MessageBlockStatus.SUCCESS
        };
        blockManager.smartBlockUpdate(citationBlockId, changes, MessageBlockType.CITATION, true);
        citationBlockId = null;
      } else if (citations && citations.length > 0) {
        const newBlock = createNewCitationBlock({
          sources: citations.map(c => ({
            title: c.title,
            url: c.url,
            content: c.snippet
          })),
          status: MessageBlockStatus.SUCCESS
        });
        await blockManager.handleBlockTransition(newBlock, MessageBlockType.CITATION);
      }
    },

    // 暴露内部状态
    getCitationBlockId: () => citationBlockId,
    resetCitationBlock: () => {
      citationBlockId = null;
    }
  } as any;
}
