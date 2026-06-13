/**
 * 视觉识别 Redux Slice — 独立隔离存储
 *
 * 企业级设计：
 * - 独立 IndexedDB 键 'visionRecognitionSettings'，与 settings slice 完全隔离
 * - 每个 reducer 显式调用 saveToStorage，确保持久化
 * - 支持"跟随主API预设模型"与"独立API配置"两种模型来源
 * - 启动时从 IndexedDB 恢复，不依赖 redux-persist
 */

import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import { getStorageItem, setStorageItem } from '../../utils/storage';
import { createLogger } from '../../services/infra/logger';

const logger = createLogger('VisionRecognition');

// ==================== 存储键 ====================

const STORAGE_KEY = 'visionRecognitionSettings';

// ==================== 状态类型 ====================

/** 模型来源：preset = 从已配置供应商选择；custom = 独立API配置 */
export type VisionModelSource = 'preset' | 'custom';

/** 分析失败时的策略 */
export type VisionFailureStrategy = 'abort' | 'continueWithoutImage';

/** 预设模型引用（指向已配置供应商中的某个模型） */
export interface VisionPresetModelRef {
  providerId: string;
  modelId: string;
}

/** 独立API配置（OpenAI 兼容协议） */
export interface VisionCustomConfig {
  modelName: string;
  baseUrl: string;
  apiKey: string;
}

/** 视觉识别完整状态 */
export interface VisionRecognitionState {
  /** 总开关：启用后发送图片给非视觉模型时自动用视觉模型分析 */
  enabled: boolean;
  /** 模型来源 */
  modelSource: VisionModelSource;
  /** 预设模型引用（modelSource = 'preset' 时生效） */
  presetModelRef: VisionPresetModelRef | null;
  /** 独立API配置（modelSource = 'custom' 时生效） */
  custom: VisionCustomConfig;
  /** 图片分析提示词 */
  prompt: string;
  /** 失败策略 */
  onFailure: VisionFailureStrategy;
  /** 分析超时（毫秒） */
  timeoutMs: number;
}

// ==================== 默认值 ====================

export const DEFAULT_VISION_PROMPT =
  '你是一个图片分析助手。请详细描述图片中的内容，包括主体、文字、布局、颜色等关键信息。' +
  '如果图片中包含文字，请完整转录。描述应客观、准确、详尽，以便其他AI模型能仅凭你的描述理解图片并回答用户的问题。';

const getDefaultState = (): VisionRecognitionState => ({
  enabled: false,
  modelSource: 'preset',
  presetModelRef: null,
  custom: {
    modelName: '',
    baseUrl: '',
    apiKey: '',
  },
  prompt: DEFAULT_VISION_PROMPT,
  onFailure: 'abort',
  timeoutMs: 60000,
});

// ==================== 持久化 ====================

const toPlainState = (state: VisionRecognitionState): VisionRecognitionState => ({
  enabled: state.enabled,
  modelSource: state.modelSource,
  presetModelRef: state.presetModelRef
    ? { providerId: state.presetModelRef.providerId, modelId: state.presetModelRef.modelId }
    : null,
  custom: {
    modelName: state.custom.modelName,
    baseUrl: state.custom.baseUrl,
    apiKey: state.custom.apiKey,
  },
  prompt: state.prompt,
  onFailure: state.onFailure,
  timeoutMs: state.timeoutMs,
});

const saveToStorage = (state: VisionRecognitionState) => {
  // 必须深拷贝为纯对象，Immer Proxy 无法被 IndexedDB structured clone
  setStorageItem(STORAGE_KEY, toPlainState(state)).catch((error) => {
    logger.error('保存设置失败:', error);
  });
};

const loadFromStorage = async (): Promise<VisionRecognitionState> => {
  const defaults = getDefaultState();
  try {
    const saved = await getStorageItem<VisionRecognitionState>(STORAGE_KEY);
    if (saved) {
      return {
        enabled: saved.enabled ?? defaults.enabled,
        modelSource: saved.modelSource ?? defaults.modelSource,
        presetModelRef: saved.presetModelRef ?? defaults.presetModelRef,
        custom: {
          modelName: saved.custom?.modelName ?? '',
          baseUrl: saved.custom?.baseUrl ?? '',
          apiKey: saved.custom?.apiKey ?? '',
        },
        prompt: saved.prompt || defaults.prompt,
        onFailure: saved.onFailure ?? defaults.onFailure,
        timeoutMs: saved.timeoutMs ?? defaults.timeoutMs,
      };
    }
  } catch (error) {
    logger.error('加载设置失败:', error);
  }
  return defaults;
};

// ==================== 初始化 ====================

let isInitialized = false;

export const initializeVisionRecognitionSettings = async (): Promise<VisionRecognitionState | null> => {
  if (isInitialized) return null;
  try {
    return await loadFromStorage();
  } catch (err) {
    logger.error('初始化失败:', err);
    return null;
  } finally {
    isInitialized = true;
  }
};

// ==================== Slice ====================

const visionRecognitionSlice = createSlice({
  name: 'visionRecognition',
  initialState: getDefaultState(),
  reducers: {
    /** 从 IndexedDB 恢复状态（启动时调用） */
    setVisionRecognitionSettings: (_, action: PayloadAction<VisionRecognitionState>) => {
      const newState = { ...action.payload };
      saveToStorage(newState);
      return newState;
    },

    setVisionEnabled: (state, action: PayloadAction<boolean>) => {
      state.enabled = action.payload;
      saveToStorage(state);
    },

    setVisionModelSource: (state, action: PayloadAction<VisionModelSource>) => {
      state.modelSource = action.payload;
      saveToStorage(state);
    },

    setVisionPresetModelRef: (state, action: PayloadAction<VisionPresetModelRef | null>) => {
      state.presetModelRef = action.payload;
      saveToStorage(state);
    },

    updateVisionCustomConfig: (state, action: PayloadAction<Partial<VisionCustomConfig>>) => {
      state.custom = { ...state.custom, ...action.payload };
      saveToStorage(state);
    },

    setVisionPrompt: (state, action: PayloadAction<string>) => {
      state.prompt = action.payload;
      saveToStorage(state);
    },

    setVisionFailureStrategy: (state, action: PayloadAction<VisionFailureStrategy>) => {
      state.onFailure = action.payload;
      saveToStorage(state);
    },

    setVisionTimeoutMs: (state, action: PayloadAction<number>) => {
      state.timeoutMs = action.payload;
      saveToStorage(state);
    },

    resetVisionRecognitionSettings: () => {
      const defaultState = getDefaultState();
      saveToStorage(defaultState);
      return defaultState;
    },
  },
});

export const {
  setVisionRecognitionSettings,
  setVisionEnabled,
  setVisionModelSource,
  setVisionPresetModelRef,
  updateVisionCustomConfig,
  setVisionPrompt,
  setVisionFailureStrategy,
  setVisionTimeoutMs,
  resetVisionRecognitionSettings,
} = visionRecognitionSlice.actions;

export default visionRecognitionSlice.reducer;
