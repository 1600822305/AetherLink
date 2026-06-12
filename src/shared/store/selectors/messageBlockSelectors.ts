import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '../index';
import type { MessageBlock, CitationMessageBlock } from '../../types/newMessage';
import { MessageBlockType } from '../../types/newMessage';
import type { Citation } from '../../types/citation';
import { extractHostname } from '../../utils/citation';

// 稳定的空数组引用
const EMPTY_CITATIONS_ARRAY: Citation[] = [];

// 数组浅比较工具函数
const shallowArrayEqual = <T>(a: T[], b: T[]): boolean => {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};

// 单块查询
export const selectBlockById = (state: RootState, blockId?: string) =>
  blockId ? state.messageBlocks.entities[blockId] : undefined;

// 根据块ID数组查询块实体 - selector 工厂
// 每个组件实例通过 useMemo(() => makeSelectBlocksByIds(), []) 持有独立缓存槽，
// 避免多个消息组件共用单一缓存时互相失效
export const makeSelectBlocksByIds = () =>
  createSelector(
    [
      (state: RootState) => state.messageBlocks.entities,
      (_state: RootState, blockIds: string[]) => blockIds
    ],
    (entities, blockIds) =>
      blockIds
        .map(id => entities[id])
        .filter((block): block is MessageBlock => block !== undefined),
    {
      memoizeOptions: { resultEqualityCheck: shallowArrayEqual }
    }
  );

// 引用数组等价比较：重算结果与上次一致时复用旧引用，保持组件不重渲染
const citationsArrayEqual = (a: Citation[], b: Citation[]): boolean => {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].number !== b[i].number ||
        a[i].url !== b[i].url ||
        a[i].title !== b[i].title ||
        a[i].content !== b[i].content) {
      return false;
    }
  }
  return true;
};

// 提取某条消息的引用（知识库 + Web 搜索）- selector 工厂
// 每个组件实例通过 useMemo(() => makeSelectCitationsForMessage(), []) 持有独立缓存槽，
// 缓存随组件卸载被 GC，避免模块级 Map 只增不减
export const makeSelectCitationsForMessage = () =>
  createSelector(
    [
      (state: RootState) => state.messageBlocks.entities,
      (state: RootState, messageId?: string) =>
        messageId ? state.messages.entities[messageId]?.blocks : undefined
    ],
    (blockEntities, messageBlocks): Citation[] => {
      if (!messageBlocks) return EMPTY_CITATIONS_ARRAY;

      const citations: Citation[] = [];
      for (const blockId of messageBlocks) {
        const block = blockEntities[blockId];
        if (!block) continue;

        // 统一引用块：从 knowledge[] 和 webSearch[] 提取
        if (block.type === MessageBlockType.CITATION) {
          const citBlock = block as CitationMessageBlock;

          // 知识库引用
          if (citBlock.knowledge && citBlock.knowledge.length > 0) {
            citBlock.knowledge.forEach((k) => {
              citations.push({
                number: k.index,
                url: k.sourceUrl || `knowledge://${k.knowledgeBaseId || 'unknown'}/${k.documentId || k.index}`,
                title: k.knowledgeBaseName || '知识库',
                content: k.content?.substring(0, 800),
                type: 'knowledge',
                showFavicon: false,
                metadata: { similarity: k.similarity }
              });
            });
          }

          // Web 搜索引用
          if (citBlock.webSearch && citBlock.webSearch.length > 0) {
            citBlock.webSearch.forEach((w) => {
              citations.push({
                number: w.index,
                url: w.url,
                title: w.title || '',
                content: (w.snippet || w.content || '').substring(0, 200),
                hostname: extractHostname(w.url),
                type: 'websearch',
                showFavicon: true,
              });
            });
          }
        }
      }

      return citations.length === 0 ? EMPTY_CITATIONS_ARRAY : citations;
    },
    {
      memoizeOptions: { resultEqualityCheck: citationsArrayEqual }
    }
  );
