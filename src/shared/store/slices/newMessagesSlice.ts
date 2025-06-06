import { createEntityAdapter, createSlice, createSelector, createAsyncThunk } from '@reduxjs/toolkit';
import type { EntityState, PayloadAction } from '@reduxjs/toolkit';
import type { Message, AssistantMessageStatus } from '../../types/newMessage.ts';
import type { RootState } from '../index';
import { dexieStorage } from '../../services/DexieStorageService';
import { upsertManyBlocks } from './messageBlocksSlice';
import { deduplicateMessages } from '../../utils/messageUtils/filters';

// 1. 创建实体适配器
const messagesAdapter = createEntityAdapter<Message>();

// 错误信息接口
export interface ErrorInfo {
  message: string;
  code?: string | number;
  type?: string;
  timestamp: string;
  details?: string;
  context?: Record<string, any>;
}

// API Key 错误信息接口
export interface ApiKeyErrorInfo {
  message: string;
  originalError: any;
  timestamp: string;
  canRetry: boolean;
}

// 2. 定义状态接口
export interface NormalizedMessagesState extends EntityState<Message, string> {
  messageIdsByTopic: Record<string, string[]>; // 主题ID -> 消息ID数组的映射
  currentTopicId: string | null;
  loadingByTopic: Record<string, boolean>;
  streamingByTopic: Record<string, boolean>;
  displayCount: number;
  errors: ErrorInfo[]; // 错误信息数组，记录多个错误
  errorsByTopic: Record<string, ErrorInfo[]>; // 按主题分组的错误信息
  apiKeyErrors: Record<string, { messageId: string; error: ApiKeyErrorInfo }>; // API Key 错误状态，按主题分组
}

// 3. 定义初始状态
const initialState: NormalizedMessagesState = messagesAdapter.getInitialState({
  messageIdsByTopic: {},
  currentTopicId: null,
  loadingByTopic: {},
  streamingByTopic: {},
  displayCount: 20,
  errors: [],
  errorsByTopic: {},
  apiKeyErrors: {}
});

// 定义 Payload 类型
interface MessagesReceivedPayload {
  topicId: string;
  messages: Message[];
}

interface SetTopicLoadingPayload {
  topicId: string;
  loading: boolean;
}

interface SetTopicStreamingPayload {
  topicId: string;
  streaming: boolean;
}

// 移除了额外的状态跟踪

interface AddMessagePayload {
  topicId: string;
  message: Message;
}

interface UpdateMessagePayload {
  id: string;
  changes: Partial<Message>;
}

interface UpdateMessageStatusPayload {
  topicId: string;
  messageId: string;
  status: AssistantMessageStatus;
}

interface RemoveMessagePayload {
  topicId: string;
  messageId: string;
}

interface SetErrorPayload {
  error: ErrorInfo;
  topicId?: string; // 可选的主题ID，用于按主题分组错误
}

// API Key 错误相关的 Payload 类型
interface SetApiKeyErrorPayload {
  topicId: string;
  messageId: string;
  error: ApiKeyErrorInfo;
}

interface ClearApiKeyErrorPayload {
  topicId: string;
}

// 添加块引用的Payload类型
interface UpsertBlockReferencePayload {
  messageId: string;
  blockId: string;
  status?: string;
}

// 4. 创建 Slice
const newMessagesSlice = createSlice({
  name: 'normalizedMessages',
  initialState,
  reducers: {
    // 设置当前主题
    setCurrentTopicId(state, action: PayloadAction<string | null>) {
      state.currentTopicId = action.payload;
      if (action.payload && !(action.payload in state.messageIdsByTopic)) {
        state.messageIdsByTopic[action.payload] = [];
        state.loadingByTopic[action.payload] = false;
        state.streamingByTopic[action.payload] = false;
      }
    },

    // 设置主题加载状态
    setTopicLoading(state, action: PayloadAction<SetTopicLoadingPayload>) {
      const { topicId, loading } = action.payload;
      state.loadingByTopic[topicId] = loading;
    },

    // 设置主题流式响应状态
    setTopicStreaming(state, action: PayloadAction<SetTopicStreamingPayload>) {
      const { topicId, streaming } = action.payload;
      state.streamingByTopic[topicId] = streaming;
    },

    // 移除了额外的状态跟踪

    // 设置错误信息
    setError(state, action: PayloadAction<SetErrorPayload>) {
      const { error, topicId } = action.payload;

      // 添加到全局错误列表
      state.errors.push(error);

      // 如果超过10个错误，移除最旧的
      if (state.errors.length > 10) {
        state.errors.shift();
      }

      // 如果提供了主题ID，添加到主题错误列表
      if (topicId) {
        if (!state.errorsByTopic[topicId]) {
          state.errorsByTopic[topicId] = [];
        }

        state.errorsByTopic[topicId].push(error);

        // 如果超过5个错误，移除最旧的
        if (state.errorsByTopic[topicId].length > 5) {
          state.errorsByTopic[topicId].shift();
        }
      }
    },

    // 设置 API Key 错误
    setApiKeyError(state, action: PayloadAction<SetApiKeyErrorPayload>) {
      const { topicId, messageId, error } = action.payload;
      state.apiKeyErrors[topicId] = { messageId, error };
    },

    // 清除 API Key 错误
    clearApiKeyError(state, action: PayloadAction<ClearApiKeyErrorPayload>) {
      const { topicId } = action.payload;
      delete state.apiKeyErrors[topicId];
    },

    // 更新消息状态
    updateMessageStatus(state, action: PayloadAction<UpdateMessageStatusPayload>) {
      const { messageId, status } = action.payload;
      const message = state.entities[messageId];
      if (message) {
        message.status = status;
      }
    },

    // 设置显示消息数量
    setDisplayCount(state, action: PayloadAction<number>) {
      state.displayCount = action.payload;
    },

    // 接收消息
    messagesReceived(state, action: PayloadAction<MessagesReceivedPayload>) {
      const { topicId, messages } = action.payload;

      // 添加或更新消息
      messagesAdapter.upsertMany(state as any, messages);

      // 更新主题的消息ID数组
      const messageIds = messages.map(msg => msg.id);

      // 确保不会覆盖现有消息
      if (!state.messageIdsByTopic[topicId]) {
        state.messageIdsByTopic[topicId] = messageIds;
      } else {
        // 合并现有消息ID和新消息ID，确保不重复
        const existingIds = state.messageIdsByTopic[topicId];
        const newIds = messageIds.filter(id => !existingIds.includes(id));
        state.messageIdsByTopic[topicId] = [...existingIds, ...newIds];
      }


    },

    // 添加消息
    addMessage(state, action: PayloadAction<AddMessagePayload>) {
      const { topicId, message } = action.payload;

      // 添加消息
      messagesAdapter.addOne(state as any, message);

      // 更新主题的消息ID数组
      if (!state.messageIdsByTopic[topicId]) {
        state.messageIdsByTopic[topicId] = [];
      }
      state.messageIdsByTopic[topicId].push(message.id);
    },

    // 更新消息
    updateMessage(state, action: PayloadAction<UpdateMessagePayload>) {
      messagesAdapter.updateOne(state as any, {
        id: action.payload.id,
        changes: action.payload.changes
      });
    },

    // 删除消息
    removeMessage(state, action: PayloadAction<RemoveMessagePayload>) {
      const { topicId, messageId } = action.payload;

      // 从实体中删除消息
      messagesAdapter.removeOne(state as any, messageId);

      // 从主题的消息ID数组中删除
      if (state.messageIdsByTopic[topicId]) {
        state.messageIdsByTopic[topicId] = state.messageIdsByTopic[topicId].filter(id => id !== messageId);
      }
    },

    // 清空主题的所有消息
    clearTopicMessages(state, action: PayloadAction<string>) {
      const topicId = action.payload;

      // 获取要删除的消息ID
      const messageIds = state.messageIdsByTopic[topicId] || [];

      // 删除消息
      messagesAdapter.removeMany(state as any, messageIds);

      // 清空主题的消息ID数组
      state.messageIdsByTopic[topicId] = [];
    },

    // 添加或更新块引用
    upsertBlockReference(state, action: PayloadAction<UpsertBlockReferencePayload>) {
      const { messageId, blockId } = action.payload;

      const messageToUpdate = state.entities[messageId];
      if (!messageToUpdate) {
        console.error(`[upsertBlockReference] 消息 ${messageId} 不存在.`);
        return;
      }

      // 获取当前块列表
      const currentBlocks = [...(messageToUpdate.blocks || [])];

      // 如果块ID不在列表中，添加它
      if (!currentBlocks.includes(blockId)) {
        // 更新消息的blocks数组
        messagesAdapter.updateOne(state as any, {
          id: messageId,
          changes: {
            blocks: [...currentBlocks, blockId]
          }
        });
      }
    }
  }
});

// 5. 导出 Actions
export const newMessagesActions = newMessagesSlice.actions;

// 6. 导出 Selectors
// 创建一个稳定的选择器函数，避免每次调用都返回新引用
const selectMessagesState = (state: RootState) => {
  if (!state.messages) {
    // 返回一个稳定的初始状态
    return messagesAdapter.getInitialState();
  }
  return state.messages;
};

export const {
  selectAll: selectAllMessages,
  selectById: selectMessageById,
  selectIds: selectMessageIds
} = messagesAdapter.getSelectors<RootState>(selectMessagesState);

// 创建稳定的空数组引用
const EMPTY_MESSAGES_ARRAY: any[] = [];

// 自定义选择器 - 使用 createSelector 进行记忆化
export const selectMessagesByTopicId = createSelector(
  [
    (state: RootState) => state.messages,
    (_state: RootState, topicId: string) => topicId
  ],
  (messagesState, topicId) => {
    if (!messagesState) {
      return EMPTY_MESSAGES_ARRAY;
    }
    const messageIds = messagesState.messageIdsByTopic[topicId] || EMPTY_MESSAGES_ARRAY;
    return messageIds.map((id: string) => messagesState.entities[id]).filter(Boolean);
  }
);

export const selectCurrentTopicId = (state: RootState) =>
  state.messages ? state.messages.currentTopicId : null;

export const selectTopicLoading = (state: RootState, topicId: string) =>
  state.messages ? state.messages.loadingByTopic[topicId] || false : false;

export const selectTopicStreaming = (state: RootState, topicId: string) =>
  state.messages ? state.messages.streamingByTopic[topicId] || false : false;

// 错误相关选择器 - 使用 createSelector 进行记忆化
export const selectErrors = createSelector(
  [(state: RootState) => state.messages],
  (messagesState) => {
    // 确保返回数组，使用稳定的空数组引用
    return messagesState?.errors || EMPTY_MESSAGES_ARRAY;
  }
);

export const selectLastError = createSelector(
  [selectErrors],
  (errors) => {
    // 直接返回最后一个错误，createSelector会处理记忆化
    return errors.length > 0 ? errors[errors.length - 1] : null;
  }
);

export const selectErrorsByTopic = createSelector(
  [
    (state: RootState) => state.messages,
    (_state: RootState, topicId: string) => topicId
  ],
  (messagesState, topicId) => {
    // 确保返回数组，使用稳定的空数组引用
    return messagesState?.errorsByTopic?.[topicId] || EMPTY_MESSAGES_ARRAY;
  }
);

// API Key 错误相关选择器 - 使用 createSelector 进行记忆化
export const selectApiKeyError = createSelector(
  [
    (state: RootState) => state.messages,
    (_state: RootState, topicId: string) => topicId
  ],
  (messagesState, topicId) => {
    // 确保返回值，添加默认值处理
    return messagesState?.apiKeyErrors?.[topicId] || null;
  }
);

export const selectHasApiKeyError = createSelector(
  [
    (state: RootState) => state.messages,
    (_state: RootState, topicId: string) => topicId
  ],
  (messagesState, topicId) => {
    // 转换为布尔值，确保有转换逻辑
    return Boolean(messagesState?.apiKeyErrors?.[topicId]);
  }
);

// 使用createSelector创建记忆化选择器
export const selectOrderedMessagesByTopicId = createSelector(
  [selectMessagesByTopicId],
  (messages) => {
    // 如果消息数组为空，直接返回
    if (messages.length === 0) return messages;

    // 检查消息是否已经按时间排序
    let isAlreadySorted = true;
    for (let i = 1; i < messages.length; i++) {
      const prevTime = new Date(messages[i - 1].createdAt).getTime();
      const currTime = new Date(messages[i].createdAt).getTime();
      if (prevTime > currTime) {
        isAlreadySorted = false;
        break;
      }
    }

    // 如果已经排序，直接返回原数组，避免创建新引用
    if (isAlreadySorted) return messages;

    // 只有在需要排序时才创建新数组
    return [...messages].sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return aTime - bTime;
    });
  }
);

// 异步Thunk
export const loadTopicMessagesThunk = createAsyncThunk(
  'normalizedMessages/loadTopicMessages',
  async (topicId: string, { dispatch }) => {
    try {
      dispatch(newMessagesActions.setTopicLoading({ topicId, loading: true }));

      // 从数据库加载消息
      const topic = await dexieStorage.getTopic(topicId);
      if (!topic) {
        throw new Error(`Topic ${topicId} not found`);
      }

      // 获取消息
      const messages = await dexieStorage.getMessagesByTopicId(topicId);

      // 去重处理 - 使用统一的去重逻辑
      const sortedMessages = deduplicateMessages(messages);

      // 优化：使用批量查询，一次性获取所有消息块
      const messageIds = sortedMessages.map(msg => msg.id);
      console.log(`[loadTopicMessagesThunk] 加载话题 ${topicId} 的消息，消息数量: ${sortedMessages.length}，消息ID: [${messageIds.join(', ')}]`);

      // 使用新的批量查询方法，一次性获取所有消息块
      const allBlocks = await dexieStorage.getMessageBlocksByMessageIds(messageIds);

      // 按消息ID分组并去重
      const blocks: any[] = [];
      const processedBlockIds = new Set<string>();
      const blocksByMessageId = new Map<string, any[]>();

      // 按消息ID分组
      allBlocks.forEach(block => {
        if (!blocksByMessageId.has(block.messageId)) {
          blocksByMessageId.set(block.messageId, []);
        }
        blocksByMessageId.get(block.messageId)!.push(block);
      });

      // 处理每个消息的块并去重
      messageIds.forEach(messageId => {
        const messageBlocks = blocksByMessageId.get(messageId) || [];
        console.log(`[loadTopicMessagesThunk] 消息 ${messageId} 有 ${messageBlocks.length} 个块: [${messageBlocks.map(b => `${b.id}(${b.type})`).join(', ')}]`);

        // 过滤掉已处理的块
        const uniqueBlocks = messageBlocks.filter(block => {
          if (processedBlockIds.has(block.id)) {
            return false;
          }
          processedBlockIds.add(block.id);
          return true;
        });

        blocks.push(...uniqueBlocks);
      });

      console.log(`[loadTopicMessagesThunk] 总共加载到 ${blocks.length} 个消息块`);

      // 详细记录每个消息的块信息
      for (const message of sortedMessages) {
        const messageBlocks = blocks.filter(block => block.messageId === message.id);
        console.log(`[loadTopicMessagesThunk] 消息 ${message.id} 的 blocks 数组: [${message.blocks?.join(', ') || '空'}]，实际加载的块: [${messageBlocks.map(b => `${b.id}(${b.type})`).join(', ')}]`);
      }

      // 使用 batch 来批量更新 Redux 状态，减少重新渲染
      if (blocks.length > 0) {
        console.log(`[loadTopicMessagesThunk] 将 ${blocks.length} 个块添加到 Redux`);
        // 先更新消息块，再更新消息，这样可以避免组件在没有块数据时的重新渲染
        dispatch(upsertManyBlocks(blocks));
        dispatch(newMessagesActions.messagesReceived({ topicId, messages: sortedMessages }));
      } else {
        console.log(`[loadTopicMessagesThunk] 没有块需要添加到 Redux`);
        dispatch(newMessagesActions.messagesReceived({ topicId, messages: sortedMessages }));
      }

      return messages;
    } catch (error) {
      // 创建错误信息对象
      const errorInfo: ErrorInfo = {
        message: error instanceof Error ? error.message : 'Unknown error',
        code: error instanceof Error && 'code' in error ? (error as any).code : 'UNKNOWN',
        type: 'LOAD_MESSAGES_ERROR',
        timestamp: new Date().toISOString(),
        details: error instanceof Error ? error.stack : undefined,
        context: { topicId }
      };

      // 分发错误
      dispatch(newMessagesActions.setError({
        error: errorInfo,
        topicId
      }));

      throw error;
    } finally {
      dispatch(newMessagesActions.setTopicLoading({ topicId, loading: false }));
    }
  }
);

// 7. 导出 Reducer
export default newMessagesSlice.reducer;