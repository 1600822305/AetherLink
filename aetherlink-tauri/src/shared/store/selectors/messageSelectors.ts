import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '../../store';
import {
  selectMessagesByTopicId,
  selectCurrentTopicId as selectNormalizedCurrentTopicId,
  selectTopicLoading as selectNormalizedTopicLoading,
  selectTopicStreaming as selectNormalizedTopicStreaming
} from '../slices/newMessagesSlice';

// 基础选择器
export const selectMessagesState = (state: RootState) => state.messages;
export const selectMessageBlocksState = (state: RootState) => state.messageBlocks;

// 选择特定主题的消息 - 使用 newMessagesSlice 中的选择器
export const selectMessagesForTopic = selectMessagesByTopicId;

// 选择消息块实体 - 使用记忆化避免不必要的重新渲染
export const selectMessageBlockEntities = createSelector(
  [selectMessageBlocksState],
  (messageBlocksState) => {
    // 直接返回entities，createSelector会处理记忆化
    return messageBlocksState?.entities || {};
  }
);

// 选择特定消息的块
export const selectBlocksForMessage = createSelector(
  [
    selectMessageBlockEntities,
    (state: RootState, messageId: string) => {
      // 从 state.messages 中获取消息
      const message = selectMessageById(state, messageId);
      return message?.blocks || EMPTY_TOPICS_ARRAY;
    }
  ],
  (blockEntities, blockIds) => {
    return blockIds.map((id: string) => blockEntities[id]).filter(Boolean);
  }
);

// 从 newMessagesSlice 中获取消息
export const selectMessageById = (state: RootState, messageId: string) => {
  return state.messages.entities[messageId];
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

// 创建一个稳定的空数组引用
const EMPTY_TOPICS_ARRAY: any[] = [];

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