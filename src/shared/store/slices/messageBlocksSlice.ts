import { createEntityAdapter, createSlice, createSelector } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { MessageBlock, CitationMessageBlock } from '../../types/newMessage';
import { MessageBlockType } from '../../types/newMessage';
import type { RootState } from '../index';

/**
 * Citation 引用类型
 * 参考 Cherry Studio 的 Citation 设计
 */
export interface Citation {
  number: number;
  url: string;
  title?: string;
  hostname?: string;
  content?: string;
  showFavicon?: boolean;
  type?: 'websearch' | 'knowledge' | 'memory';
}

// 创建实体适配器
const messageBlocksAdapter = createEntityAdapter<MessageBlock>();

// 定义初始状态
const initialState = messageBlocksAdapter.getInitialState({
  loadingState: 'idle' as 'idle' | 'loading' | 'succeeded' | 'failed',
  error: null as string | null
});

// 创建Slice
const messageBlocksSlice = createSlice({
  name: 'messageBlocks',
  initialState,
  reducers: {
    // 添加单个块
    addOneBlock: messageBlocksAdapter.addOne,
    
    // 添加多个块
    addManyBlocks: messageBlocksAdapter.addMany,
    
    // 添加或更新单个块
    upsertOneBlock: messageBlocksAdapter.upsertOne,
    
    // 添加或更新多个块
    upsertManyBlocks: messageBlocksAdapter.upsertMany,
    
    // 移除单个块
    removeOneBlock: messageBlocksAdapter.removeOne,
    
    // 移除多个块
    removeManyBlocks: messageBlocksAdapter.removeMany,
    
    // 移除所有块
    removeAllBlocks: messageBlocksAdapter.removeAll,
    
    // 设置加载状态
    setMessageBlocksLoading: (state, action: PayloadAction<'idle' | 'loading' | 'succeeded' | 'failed'>) => {
      state.loadingState = action.payload;
      state.error = null;
    },
    
    // 设置错误状态
    setMessageBlocksError: (state, action: PayloadAction<string>) => {
      state.loadingState = 'failed';
      state.error = action.payload;
    },
    
    // 更新单个块
    updateOneBlock: messageBlocksAdapter.updateOne,
    
    // 更新多个块
    updateManyBlocks: messageBlocksAdapter.updateMany
  }
});

// 导出Actions
export const {
  addOneBlock,
  addManyBlocks,
  upsertOneBlock,
  upsertManyBlocks,
  removeOneBlock,
  removeManyBlocks,
  removeAllBlocks,
  setMessageBlocksLoading,
  setMessageBlocksError,
  updateOneBlock,
  updateManyBlocks
} = messageBlocksSlice.actions;

// 导出Selectors
export const messageBlocksSelectors = messageBlocksAdapter.getSelectors<RootState>(
  (state) => state.messageBlocks
);

// --- Citation 格式化逻辑 ---

/**
 * 从 Citation 块中格式化引用列表
 * 参考 Cherry Studio 的 formatCitationsFromBlock 设计
 * 
 * @param block Citation 消息块
 * @returns 格式化后的引用列表
 */
export const formatCitationsFromBlock = (block: CitationMessageBlock | undefined): Citation[] => {
  if (!block) return [];

  let formattedCitations: Citation[] = [];

  // 1. 处理 Web 搜索响应
  if (block.response) {
    const response = block.response;
    
    // 处理不同来源的搜索结果
    if (response.source === 'gemini' && response.results?.groundingChunks) {
      formattedCitations = response.results.groundingChunks.map((chunk: any, index: number) => ({
        number: index + 1,
        url: chunk?.web?.uri || '',
        title: chunk?.web?.title,
        showFavicon: true,
        type: 'websearch' as const
      }));
    } else if (response.source === 'openai' && Array.isArray(response.results)) {
      formattedCitations = response.results.map((result: any, index: number) => {
        let hostname: string | undefined;
        try {
          hostname = result.title ? undefined : new URL(result.url).hostname;
        } catch {
          hostname = result.url;
        }
        return {
          number: index + 1,
          url: result.url || result.url_citation?.url || '',
          title: result.title || result.url_citation?.title,
          hostname,
          showFavicon: true,
          type: 'websearch' as const
        };
      });
    } else if (Array.isArray(response.results)) {
      // 通用处理
      formattedCitations = response.results.map((result: any, index: number) => ({
        number: index + 1,
        url: result.url || result.link || '',
        title: result.title || '',
        content: result.content || result.snippet || '',
        showFavicon: true,
        type: 'websearch' as const
      }));
    }
  }

  // 2. 处理 sources 数组
  if (block.sources && Array.isArray(block.sources) && block.sources.length > 0) {
    const sourceCitations = block.sources.map((source, index) => ({
      number: formattedCitations.length + index + 1,
      url: source.url || '',
      title: source.title || '',
      content: source.content || '',
      showFavicon: true,
      type: 'websearch' as const
    }));
    formattedCitations.push(...sourceCitations);
  }

  // 3. 处理知识库引用
  if (block.knowledge && Array.isArray(block.knowledge) && block.knowledge.length > 0) {
    const knowledgeCitations = block.knowledge.map((result: any, index: number) => {
      const filePattern = /\[(.*?)]\(http:\/\/file\/(.*?)\)/;
      const fileMatch = result.sourceUrl?.match(filePattern);

      let url = result.sourceUrl || result.url || '';
      let title = result.sourceUrl || result.title || '';

      if (fileMatch) {
        title = fileMatch[1];
        url = `http://file/${fileMatch[2]}`;
      }

      return {
        number: formattedCitations.length + index + 1,
        url,
        title,
        content: result.content || '',
        showFavicon: true,
        type: 'knowledge' as const
      };
    });
    formattedCitations.push(...knowledgeCitations);
  }

  // 4. 去重（按 URL）并重新编号
  const urlSet = new Set<string>();
  return formattedCitations
    .filter((citation) => {
      if (citation.type === 'knowledge') return true;
      if (!citation.url || urlSet.has(citation.url)) return false;
      urlSet.add(citation.url);
      return true;
    })
    .map((citation, index) => ({
      ...citation,
      number: index + 1
    }));
};

// --- Selector 集成 ---

/**
 * 根据块 ID 获取块实体
 */
const selectBlockEntityById = (state: RootState, blockId: string | undefined): MessageBlock | undefined => {
  return blockId ? messageBlocksSelectors.selectById(state, blockId) : undefined;
};

/**
 * 根据块 ID 获取格式化的引用列表（Memoized）
 */
export const selectFormattedCitationsByBlockId = createSelector(
  [selectBlockEntityById],
  (blockEntity): Citation[] => {
    if (blockEntity?.type === MessageBlockType.CITATION) {
      return formatCitationsFromBlock(blockEntity as CitationMessageBlock);
    }
    return [];
  }
);

export default messageBlocksSlice.reducer; 