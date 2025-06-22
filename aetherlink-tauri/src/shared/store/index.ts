import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { persistStore, persistReducer } from 'redux-persist';
import storage from 'redux-persist/lib/storage';
// 移除旧的 messagesReducer 导入
import messagesReducer from './slices/newMessagesSlice'; // 使用 normalizedMessagesReducer 作为唯一的消息状态管理
import settingsReducer, { settingsMiddleware, loadSettings } from './settingsSlice';
import groupsReducer, { saveGroups } from './slices/groupsSlice';
import webSearchReducer, { initializeWebSearchSettings } from './slices/webSearchSlice';

import assistantsReducer from './slices/assistantsSlice';
import messageBlocksReducer from './slices/messageBlocksSlice';
import uiReducer from './slices/uiSlice';
import runtimeReducer from './slices/runtimeSlice';
import { eventMiddleware } from './middleware/eventMiddleware';
import { useDispatch, useSelector } from 'react-redux';
import type { TypedUseSelectorHook } from 'react-redux';
import { debounce } from 'lodash';

// 合并所有reducer
const rootReducer = combineReducers({
  messages: messagesReducer,
  settings: settingsReducer,

  groups: groupsReducer,
  webSearch: webSearchReducer,
  assistants: assistantsReducer,
  messageBlocks: messageBlocksReducer,
  ui: uiReducer,
  runtime: runtimeReducer
});

// 配置Redux持久化
const persistConfig = {
  key: 'cherry-studio',
  storage,
  version: 2, // 增加版本号，因为我们添加了新的状态切片
  // 与电脑端保持一致，不持久化messages和messageBlocks
  // 同时排除assistants，因为它包含非序列化的React元素
  // 排除runtime，因为它包含运行时状态
  blacklist: ['messages', 'messageBlocks', 'assistants', 'runtime'],
};

// 创建持久化reducer
const persistedReducer = persistReducer(persistConfig, rootReducer);

// 创建防抖的保存函数
const debouncedSaveGroups = debounce((store: any) => {
  store.dispatch(saveGroups());
}, 500);

// 简单的分组自动保存中间件
const groupsAutoSaveMiddleware = (store: any) => (next: any) => (action: any) => {
  const result = next(action);

  // 监听分组相关的操作
  if (action.type?.startsWith('groups/') &&
      !action.type.includes('loadGroupsSuccess') &&
      !action.type.includes('setError') &&
      !action.type.includes('clearError') &&
      !action.type.includes('setLoading')) {
    debouncedSaveGroups(store);
  }

  return result;
};

// 配置Redux存储
const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      // 完全禁用序列化检查，避免非序列化值警告
      serializableCheck: false
    }).concat(settingsMiddleware, eventMiddleware, groupsAutoSaveMiddleware)
});

// 创建persistor
export const persistor = persistStore(store);

// 加载设置
store.dispatch(loadSettings());

// 初始化网络搜索设置
initializeWebSearchSettings().then(settings => {
  if (settings) {
    // 如果有保存的设置，更新store
    store.dispatch({ type: 'webSearch/setWebSearchSettings', payload: settings });
  }
}).catch(error => {
  console.error('初始化网络搜索设置失败:', error);
});

// 导出类型
export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = typeof store.dispatch;

// 创建类型化的 hooks
export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

export default store;
