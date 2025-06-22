import { createEntityAdapter, createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { MessageBlock } from '../../types/newMessage.ts';
import type { RootState } from '../index';

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

export default messageBlocksSlice.reducer; 