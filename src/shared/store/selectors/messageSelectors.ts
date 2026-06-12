import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '../../store';
import {
  selectMessagesByTopicId,
  selectCurrentTopicId as selectNormalizedCurrentTopicId,
  selectTopicLoading as selectNormalizedTopicLoading,
  selectTopicStreaming as selectNormalizedTopicStreaming,
  selectLastMessageForTopic as selectNormalizedLastMessageForTopic
} from '../slices/newMessagesSlice';

// 创建一个稳定的空数组引用
const EMPTY_TOPICS_ARRAY: any[] = [];

// 基础选择器
export const selectMessagesState = (state: RootState) => state.messages;
export const selectMessageBlocksState = (state: RootState) => state.messageBlocks;

// 从 newMessagesSlice 中获取消息
export const selectMessageById = (state: RootState, messageId: string) => {
  return state.messages.entities[messageId];
};

// 选择特定主题的消息 - 使用 newMessagesSlice 中的选择器
export const selectMessagesForTopic = selectMessagesByTopicId;

// 选择话题的最后一条消息
export const selectLastMessageForTopic = selectNormalizedLastMessageForTopic;

// 选择消息块实体 - 使用记忆化避免不必要的重新渲染
export const selectMessageBlockEntities = createSelector(
  [selectMessageBlocksState],
  (messageBlocksState) => {
    // 直接返回entities，createSelector会处理记忆化
    return messageBlocksState?.entities || {};
  }
);

// 数组浅比较工具函数
const shallowArrayEqual = <T>(a: T[], b: T[]): boolean => {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};

// 选择特定消息的块 - 优化版本
// 使用 Map 缓存每个 messageId 的结果
// 🚀 修复内存泄漏：限制缓存大小，避免 Map 无限增长
const BLOCKS_CACHE_MAX_SIZE = 200;
const blocksForMessageCache = new Map<string, {
  blockEntities: Record<string, any>;
  blockIds: string[];
  result: any[];
}>();

export const selectBlocksForMessage = (state: RootState, messageId: string): any[] => {
  const blockEntities = selectMessageBlockEntities(state);
  const message = selectMessageById(state, messageId);
  const blockIds = message?.blocks || EMPTY_TOPICS_ARRAY;

  // 获取缓存
  const cached = blocksForMessageCache.get(messageId);

  if (cached &&
      cached.blockEntities === blockEntities &&
      shallowArrayEqual(cached.blockIds, blockIds)) {
    return cached.result;
  }

  // 计算新结果
  const result = blockIds.map((id: string) => blockEntities[id]).filter(Boolean);

  // 检查结果是否相等（浅比较）
  if (cached && shallowArrayEqual(result, cached.result)) {
    // 更新缓存引用，但返回旧结果
    blocksForMessageCache.set(messageId, {
      blockEntities,
      blockIds,
      result: cached.result
    });
    return cached.result;
  }

  // 更新缓存，超过上限时清理最早的条目
  if (blocksForMessageCache.size >= BLOCKS_CACHE_MAX_SIZE) {
    const firstKey = blocksForMessageCache.keys().next().value;
    if (firstKey !== undefined) {
      blocksForMessageCache.delete(firstKey);
    }
  }
  blocksForMessageCache.set(messageId, {
    blockEntities,
    blockIds,
    result
  });

  return result;
};

// 选择主题的加载状态
export const selectTopicLoading = selectNormalizedTopicLoading;

// 选择主题的流式响应状态
export const selectTopicStreaming = selectNormalizedTopicStreaming;

// 选择当前主题ID
export const selectCurrentTopicId = selectNormalizedCurrentTopicId;

// 选择当前主题 - 使用 createSelector 进行记忆化
export const selectCurrentTopic = createSelector(
  [selectCurrentTopicId],
  (currentTopicId) => {
    if (!currentTopicId) return null;
    // 从数据库获取主题 - 这里只返回ID，实际获取需要在组件中处理
    return { id: currentTopicId };
  }
);

// 选择所有主题 - 返回稳定的常量引用
export const selectTopics = () => EMPTY_TOPICS_ARRAY;

// 选择当前主题的消息 - 使用 createSelector 进行记忆化
export const selectMessagesForCurrentTopic = createSelector(
  [
    selectCurrentTopicId,
    selectMessagesState
  ],
  (currentTopicId, messagesState) => {
    if (!currentTopicId) return EMPTY_TOPICS_ARRAY;
    // 构造完整的state对象来调用selectMessagesForTopic
    const state = { messages: messagesState } as RootState;
    return selectMessagesForTopic(state, currentTopicId);
  }
);

// 选择主题是否正在加载
export const selectIsTopicLoading = selectTopicLoading;

// 选择当前主题是否正在加载 - 使用 createSelector 进行记忆化
export const selectIsCurrentTopicLoading = createSelector(
  [
    selectCurrentTopicId,
    selectMessagesState
  ],
  (currentTopicId, messagesState) => {
    if (!currentTopicId) return false;
    // 构造完整的state对象来调用selectTopicLoading
    const state = { messages: messagesState } as RootState;
    return selectTopicLoading(state, currentTopicId);
  }
);

// 选择主题是否正在流式响应
export const selectIsTopicStreaming = selectTopicStreaming;

// 选择当前主题是否正在流式响应 - 使用 createSelector 进行记忆化
export const selectIsCurrentTopicStreaming = createSelector(
  [
    selectCurrentTopicId,
    selectMessagesState
  ],
  (currentTopicId, messagesState) => {
    if (!currentTopicId) return false;
    // 构造完整的state对象来调用selectTopicStreaming
    const state = { messages: messagesState } as RootState;
    return selectTopicStreaming(state, currentTopicId);
  }
);

// 选择系统提示词 - 返回常量，不需要 createSelector
export const selectSystemPrompt = () => '';

// 选择是否显示系统提示词 - 返回常量，不需要 createSelector
export const selectShowSystemPrompt = () => false;