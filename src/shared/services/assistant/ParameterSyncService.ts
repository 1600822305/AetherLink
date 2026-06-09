/**
 * 统一参数同步服务
 * 负责在侧边栏设置和助手设置之间同步所有参数
 */

import type { CustomParameter } from '../../types/Assistant';
import { dexieStorage } from '../storage/DexieStorageService';
import { getStorageItem, setStorageItem } from '../../utils/storage';

// 内存缓存
let settingsCache: Record<string, any> | null = null;
let cacheInitialized = false;

// 初始化缓存
async function initCache(): Promise<void> {
  if (cacheInitialized) return;
  try {
    const stored = await getStorageItem<Record<string, any>>('appSettings') || {};
    // 若在异步读取期间已有写入初始化了缓存，则不覆盖，避免丢失刚写入的开关状态
    if (cacheInitialized) return;
    settingsCache = stored;
    cacheInitialized = true;
  } catch {
    if (cacheInitialized) return;
    settingsCache = {};
    cacheInitialized = true;
  }
}

// 异步保存（防抖）
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
function debouncedSaveSettings(): void {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    if (settingsCache) {
      await setStorageItem('appSettings', settingsCache);
    }
  }, 300);
}

// 参数同步服务 - 用于在侧边栏和助手设置之间同步参数

/**
 * 所有可同步的参数键
 */
export const SYNCABLE_PARAMETERS = [
  // 基础参数
  'temperature',
  'topP', 
  'maxOutputTokens',
  'topK',
  // 高级参数
  'frequencyPenalty',
  'presencePenalty',
  'seed',
  'stopSequences',
  'responseFormat',
  'parallelToolCalls',
  'user',
  // 推理参数
  'thinkingBudget',
  'reasoningEffort',
  // 应用级设置
  'contextLength',
  'contextCount',
  'defaultThinkingEffort',
  // 其他
  'streamOutput',
  // 自定义参数
  'customParameters',
] as const;

export type SyncableParameterKey = typeof SYNCABLE_PARAMETERS[number];

/**
 * 参数启用开关的键名映射
 */
export const ENABLE_KEY_MAP: Partial<Record<SyncableParameterKey, string>> = {
  temperature: 'enableTemperature',
  topP: 'enableTopP',
  maxOutputTokens: 'enableMaxOutputTokens',
  topK: 'enableTopK',
  frequencyPenalty: 'enableFrequencyPenalty',
  presencePenalty: 'enablePresencePenalty',
  seed: 'enableSeed',
  stopSequences: 'enableStopSequences',
  responseFormat: 'enableResponseFormat',
  parallelToolCalls: 'enableParallelToolCalls',
  user: 'enableUser',
  thinkingBudget: 'enableThinkingBudget',
  reasoningEffort: 'enableReasoningEffort',
  customParameters: 'enableCustomParameters',
};

/**
 * 参数默认值
 */
export const PARAMETER_DEFAULTS: Record<SyncableParameterKey, any> = {
  temperature: 0.7,
  topP: 1.0,
  maxOutputTokens: 8192,
  topK: 40,
  frequencyPenalty: 0,
  presencePenalty: 0,
  seed: null,
  stopSequences: [],
  responseFormat: 'text',
  parallelToolCalls: true,
  user: '',
  thinkingBudget: 1024,
  reasoningEffort: 'medium',
  // 应用级设置默认值
  contextLength: 16000,
  contextCount: 5,
  defaultThinkingEffort: 'medium',
  streamOutput: true,
  customParameters: [],
};

/**
 * 参数变化事件名称映射
 */
export const PARAMETER_EVENT_MAP: Record<SyncableParameterKey, string> = {
  temperature: 'temperatureChanged',
  topP: 'topPChanged',
  maxOutputTokens: 'maxOutputTokensChanged',
  topK: 'topKChanged',
  frequencyPenalty: 'frequencyPenaltyChanged',
  presencePenalty: 'presencePenaltyChanged',
  seed: 'seedChanged',
  stopSequences: 'stopSequencesChanged',
  responseFormat: 'responseFormatChanged',
  parallelToolCalls: 'parallelToolCallsChanged',
  user: 'userChanged',
  thinkingBudget: 'thinkingBudgetChanged',
  reasoningEffort: 'reasoningEffortChanged',
  // 应用级设置事件
  contextLength: 'contextLengthChanged',
  contextCount: 'contextCountChanged',
  defaultThinkingEffort: 'defaultThinkingEffortChanged',
  streamOutput: 'streamOutputChanged',
  customParameters: 'customParametersChanged',
};

/**
 * 参数同步服务
 */
class ParameterSyncService {
  private listeners: Map<string, Set<(data: any) => void>> = new Map();

  constructor() {
    // 应用启动时预热缓存，避免首次同步读取 getSettings() 时缓存未就绪
    // 返回空对象，从而丢失已持久化的参数开关状态（如推理努力程度）
    void initCache();
  }

  /**
   * 获取 appSettings（同步，使用缓存）
   */
  getSettings(): Record<string, any> {
    if (!cacheInitialized) {
      initCache();
    }
    return settingsCache || {};
  }

  /**
   * 保存 appSettings
   */
  saveSettings(settings: Record<string, any>): void {
    settingsCache = settings;
    // 标记缓存已就绪，防止仍在进行中的 initCache 用旧数据覆盖刚写入的设置
    cacheInitialized = true;
    debouncedSaveSettings();
  }

  /**
   * 异步获取 appSettings
   */
  async getSettingsAsync(): Promise<Record<string, any>> {
    const stored = await getStorageItem<Record<string, any>>('appSettings');
    settingsCache = stored || {};
    cacheInitialized = true;
    return settingsCache;
  }

  /**
   * 异步保存 appSettings
   */
  async saveSettingsAsync(settings: Record<string, any>): Promise<void> {
    settingsCache = settings;
    await setStorageItem('appSettings', settings);
  }

  /**
   * 获取参数值
   */
  getParameter<T>(key: SyncableParameterKey, defaultValue?: T): T {
    const settings = this.getSettings();
    return settings[key] ?? defaultValue ?? PARAMETER_DEFAULTS[key];
  }

  /**
   * 获取参数是否启用
   */
  isParameterEnabled(key: SyncableParameterKey): boolean {
    const enableKey = ENABLE_KEY_MAP[key];
    if (!enableKey) return true; // 没有开关的参数默认启用
    const settings = this.getSettings();
    // maxOutputTokens 默认启用
    if (key === 'maxOutputTokens') {
      return settings[enableKey] !== false;
    }
    return settings[enableKey] === true;
  }

  /**
   * 设置参数值并触发同步
   */
  setParameter(key: SyncableParameterKey, value: any, enabled?: boolean): void {
    const settings = this.getSettings();
    settings[key] = value;
    
    // 如果提供了 enabled 状态，也保存它
    const enableKey = ENABLE_KEY_MAP[key];
    if (enableKey && enabled !== undefined) {
      settings[enableKey] = enabled;
    }
    
    this.saveSettings(settings);
    
    // 触发事件通知其他组件
    this.dispatchParameterChange(key, value, enabled);
  }

  /**
   * 设置参数启用状态
   */
  setParameterEnabled(key: SyncableParameterKey, enabled: boolean): void {
    const enableKey = ENABLE_KEY_MAP[key];
    if (!enableKey) return;
    
    const settings = this.getSettings();
    settings[enableKey] = enabled;
    this.saveSettings(settings);
    
    // 触发事件，包含当前值
    const value = settings[key] ?? PARAMETER_DEFAULTS[key];
    this.dispatchParameterChange(key, value, enabled);
  }

  /**
   * 触发参数变化事件
   */
  dispatchParameterChange(key: SyncableParameterKey, value: any, enabled?: boolean): void {
    const eventName = PARAMETER_EVENT_MAP[key];
    const detail = { value, enabled, key };
    
    // 触发 CustomEvent
    window.dispatchEvent(new CustomEvent(eventName, { detail }));
    
    // 触发通用事件
    window.dispatchEvent(new CustomEvent('parameterChanged', { detail }));
    
    // 调用本地监听器
    const listeners = this.listeners.get(key);
    if (listeners) {
      listeners.forEach(cb => cb(detail));
    }
  }

  /**
   * 监听参数变化
   */
  onParameterChange(key: SyncableParameterKey, callback: (data: { value: any; enabled?: boolean }) => void): () => void {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)!.add(callback);
    
    // 返回取消监听的函数
    return () => {
      this.listeners.get(key)?.delete(callback);
    };
  }

  /**
   * 批量获取所有启用的参数
   * 用于传递给 UnifiedParameterManager
   */
  getEnabledParameters(): Record<string, any> {
    const settings = this.getSettings();
    const result: Record<string, any> = {};
    
    for (const key of SYNCABLE_PARAMETERS) {
      if (this.isParameterEnabled(key)) {
        const value = settings[key] ?? PARAMETER_DEFAULTS[key];
        // 跳过默认值或空值
        if (value !== null && value !== undefined) {
          result[key] = value;
        }
      }
    }
    
    return result;
  }

  /**
   * 批量设置参数
   */
  setParameters(params: Partial<Record<SyncableParameterKey, any>>): void {
    const settings = this.getSettings();
    
    for (const [key, value] of Object.entries(params)) {
      if (SYNCABLE_PARAMETERS.includes(key as SyncableParameterKey)) {
        settings[key] = value;
      }
    }
    
    this.saveSettings(settings);
    
    // 触发每个参数的变化事件
    for (const [key, value] of Object.entries(params)) {
      if (SYNCABLE_PARAMETERS.includes(key as SyncableParameterKey)) {
        this.dispatchParameterChange(key as SyncableParameterKey, value);
      }
    }
  }

  /**
   * 获取自定义参数
   */
  getCustomParameters(): CustomParameter[] {
    const settings = this.getSettings();
    return settings.customParameters || [];
  }

  /**
   * 设置自定义参数
   */
  setCustomParameters(params: CustomParameter[]): void {
    const settings = this.getSettings();
    settings.customParameters = params;
    this.saveSettings(settings);
    this.dispatchParameterChange('customParameters', params);
  }

  /**
   * 同步参数到所有助手
   */
  async syncToAssistants(params?: Partial<Record<SyncableParameterKey, any>>): Promise<boolean> {
    try {
      const assistants = await dexieStorage.getAllAssistants();
      
      const paramsToSync = params || this.getEnabledParameters();
      
      for (const assistant of assistants) {
        const updatedAssistant = { ...assistant, ...paramsToSync };
        await dexieStorage.saveAssistant(updatedAssistant);
      }
      
      console.log(`[ParameterSyncService] 已同步 ${Object.keys(paramsToSync).length} 个参数到 ${assistants.length} 个助手`);
      return true;
    } catch (error) {
      console.error('[ParameterSyncService] 同步失败:', error);
      return false;
    }
  }
}

// 导出单例
export const parameterSyncService = new ParameterSyncService();

/**
 * React Hook: 使用参数同步
 */
export function useParameterSync(key: SyncableParameterKey) {
  const getValue = () => parameterSyncService.getParameter(key);
  const getEnabled = () => parameterSyncService.isParameterEnabled(key);
  
  return {
    value: getValue(),
    enabled: getEnabled(),
    setValue: (value: any) => parameterSyncService.setParameter(key, value),
    setEnabled: (enabled: boolean) => parameterSyncService.setParameterEnabled(key, enabled),
    setValueAndEnabled: (value: any, enabled: boolean) => parameterSyncService.setParameter(key, value, enabled),
  };
}
