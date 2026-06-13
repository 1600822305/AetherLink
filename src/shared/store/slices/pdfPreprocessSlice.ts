/**
 * PDF 预处理 Redux Slice — 独立隔离存储
 *
 * 企业级设计：
 * - 独立 IndexedDB 键 'pdfPreprocessSettings'，与 settings slice 完全隔离
 * - 每个 reducer 显式调用 saveToStorage，确保持久化
 * - 支持多提供商配置（每个提供商独立存储 apiKey/apiHost/model）
 * - 启动时从 IndexedDB 恢复，不依赖 redux-persist
 */

import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import { getStorageItem, setStorageItem } from '../../utils/storage';
import type { PreprocessProviderId } from '../../services/knowledge/preprocess/types';
import { createLogger } from '../../services/infra/logger';

const logger = createLogger('PdfPreprocess');

// ==================== 存储键 ====================

const STORAGE_KEY = 'pdfPreprocessSettings';

// ==================== 状态类型 ====================

/** 单个提供商的配置 */
export interface PdfProviderConfig {
  id: PreprocessProviderId;
  name: string;
  apiKey: string;
  apiHost: string;
  model: string;
}

/** PDF 解析模式 */
export type PdfParseMode = 'local' | 'auto' | 'cloud';

/** PDF 预处理完整状态 */
export interface PdfPreprocessState {
  /** 解析模式: 'local' 仅本地 | 'auto' 自动降级 | 'cloud' 强制云端 */
  parseMode: PdfParseMode;
  /** 当前选中的提供商 ID（null = 未启用云端） */
  activeProviderId: PreprocessProviderId | null;
  /** 所有提供商的独立配置（按 ID 索引） */
  providers: Record<string, PdfProviderConfig>;
}

// ==================== 默认值 ====================

const getDefaultState = (): PdfPreprocessState => ({
  parseMode: 'auto',
  activeProviderId: null,
  providers: {},
});

// ==================== 持久化 ====================

const saveToStorage = (state: PdfPreprocessState) => {
  // 必须深拷贝为纯对象，Immer Proxy 无法被 IndexedDB structured clone
  const plainProviders: Record<string, PdfProviderConfig> = {};
  for (const [key, p] of Object.entries(state.providers)) {
    plainProviders[key] = {
      id: p.id,
      name: p.name,
      apiKey: p.apiKey,
      apiHost: p.apiHost,
      model: p.model,
    };
  }
  const serializable: PdfPreprocessState = {
    parseMode: state.parseMode,
    activeProviderId: state.activeProviderId,
    providers: plainProviders,
  };

  setStorageItem(STORAGE_KEY, serializable).catch((error) => {
    logger.error('保存设置失败:', error);
  });
};

const loadFromStorage = async (): Promise<PdfPreprocessState> => {
  try {
    const saved = await getStorageItem<PdfPreprocessState>(STORAGE_KEY);
    if (saved) {
      return {
        parseMode: saved.parseMode ?? 'auto',
        activeProviderId: saved.activeProviderId ?? null,
        providers: saved.providers ?? {},
      };
    }
  } catch (error) {
    logger.error('加载设置失败:', error);
  }
  return getDefaultState();
};

// ==================== 初始化 ====================

let isInitialized = false;

export const initializePdfPreprocessSettings = async (): Promise<PdfPreprocessState | null> => {
  if (isInitialized) return null;
  try {
    const settings = await loadFromStorage();
    return settings;
  } catch (err) {
    logger.error('初始化失败:', err);
    return null;
  } finally {
    isInitialized = true;
  }
};

// ==================== Slice ====================

const pdfPreprocessSlice = createSlice({
  name: 'pdfPreprocess',
  initialState: getDefaultState(),
  reducers: {
    /** 从 IndexedDB 恢复状态（启动时调用） */
    setPdfPreprocessSettings: (_, action: PayloadAction<PdfPreprocessState>) => {
      const newState = { ...action.payload };
      saveToStorage(newState);
      return newState;
    },

    /** 设置解析模式 */
    setPdfParseMode: (state, action: PayloadAction<PdfParseMode>) => {
      state.parseMode = action.payload;
      // 如果切到 cloud 但没有活跃提供商，回退到 auto
      if (action.payload === 'cloud' && !state.activeProviderId) {
        state.parseMode = 'auto';
      }
      saveToStorage(state);
    },

    /** 设置活跃提供商（切换时自动加载该提供商配置） */
    setActiveProvider: (state, action: PayloadAction<PreprocessProviderId | null>) => {
      state.activeProviderId = action.payload;
      // 清除提供商时，如果模式是 cloud 则回退
      if (!action.payload && state.parseMode === 'cloud') {
        state.parseMode = 'auto';
      }
      saveToStorage(state);
    },

    /** 更新指定提供商的配置（部分更新） */
    updateProviderConfig: (
      state,
      action: PayloadAction<{ id: PreprocessProviderId; updates: Partial<Omit<PdfProviderConfig, 'id'>> }>
    ) => {
      const { id, updates } = action.payload;
      const existing = state.providers[id] ?? {
        id,
        name: id,
        apiKey: '',
        apiHost: '',
        model: '',
      };
      state.providers[id] = {
        ...existing,
        ...updates,
        id, // id 不可被 updates 覆盖
      };
      saveToStorage(state);
    },

    /** 清除指定提供商的配置 */
    clearProviderConfig: (state, action: PayloadAction<PreprocessProviderId>) => {
      delete state.providers[action.payload];
      if (state.activeProviderId === action.payload) {
        state.activeProviderId = null;
        if (state.parseMode === 'cloud') {
          state.parseMode = 'auto';
        }
      }
      saveToStorage(state);
    },

    /** 重置所有 PDF 预处理设置 */
    resetPdfPreprocessSettings: () => {
      const defaultState = getDefaultState();
      saveToStorage(defaultState);
      return defaultState;
    },
  },
});

export const {
  setPdfPreprocessSettings,
  setPdfParseMode,
  setActiveProvider,
  updateProviderConfig,
  clearProviderConfig,
  resetPdfPreprocessSettings,
} = pdfPreprocessSlice.actions;

export default pdfPreprocessSlice.reducer;
