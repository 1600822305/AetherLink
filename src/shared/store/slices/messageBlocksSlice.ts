import { createEntityAdapter, createSlice } from '@reduxjs/toolkit';
import type { PayloadAction, Update } from '@reduxjs/toolkit';
import type { MessageBlock } from '../../types/newMessage.ts';
import { isTerminalBlockStatus } from '../../types/newMessage.ts';
import type { RootState } from '../index';

/**
 * 终态不可逆守卫：已是终态（success/error/paused）的块，
 * 拒绝任何把它改回非终态（pending/processing/streaming）的更新。
 */
function isIllegalRevert(
  state: ReturnType<typeof messageBlocksAdapter.getInitialState>,
  update: Update<MessageBlock, string>
): boolean {
  const nextStatus = (update.changes as Partial<MessageBlock>).status;
  if (nextStatus === undefined) return false;
  if (isTerminalBlockStatus(nextStatus)) return false;
  const prev = state.entities[update.id];
  if (!prev) return false;
  return isTerminalBlockStatus(prev.status);
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
    
    // 更新单个块（终态不可逆：丢弃终态→非终态的回退更新）
    updateOneBlock: (state, action: PayloadAction<Update<MessageBlock, string>>) => {
      if (isIllegalRevert(state, action.payload)) return;
      messageBlocksAdapter.updateOne(state, action.payload);
    },
    
    // 更新多个块（终态不可逆：逐条过滤非法回退）
    updateManyBlocks: (state, action: PayloadAction<Update<MessageBlock, string>[]>) => {
      const legal = action.payload.filter(u => !isIllegalRevert(state, u));
      if (legal.length) messageBlocksAdapter.updateMany(state, legal);
    }
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