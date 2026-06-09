/**
 * 统一参数同步服务
 * 负责在侧边栏设置和助手设置之间同步所有参数
 */

import type { CustomParameter } from '../../types/Assistant';
import { dexieStorage } from '../storage/DexieStorageService';
import { getStorageItem, setStorageItem } from '../../utils/storage';

// 持久化防抖间隔（毫秒）
const SAVE_DEBOUNCE_MS = 300;
// 持久化键名
const STORAGE_KEY = 'appSettings';

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
 *
 * 设置持久化在 Dexie/IndexedDB 中，需异步加载。为兼容大量同步读取的调用点，
 * 服务在内存中维护一份缓存，并提供显式的初始化生命周期：
 * - {@link ensureInitialized} 保证缓存已从存储完成加载（幂等、可并发等待）；
 * - {@link isReady} 表示缓存是否就绪；
 * - {@link subscribe} 配合 {@link getVersion} 让 React 组件可响应式订阅设置变化。
 *
 * 这样消费方（如设置面板）不会在缓存就绪前读取到空对象，从而避免「重启后开关被
 * 重置为默认值」之类的问题。
 */
class ParameterSyncService {
  /** 设置内存缓存 */
  private cache: Record<string, any> = {};
  /** 缓存是否已从存储加载完成 */
  private ready = false;
  /** 进行中的初始化 Promise（用于并发去重） */
  private initPromise: Promise<void> | null = null;
  /** 防抖保存定时器 */
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;
  /** 版本号，每次设置变化递增，供 useSyncExternalStore 使用 */
  private version = 0;
  /** 按参数键划分的监听器 */
  private listeners: Map<string, Set<(data: any) => void>> = new Map();
  /** 全局变化监听器（任意设置变化都会触发） */
  private globalListeners: Set<() => void> = new Set();

  constructor() {
    // 应用启动即开始加载缓存，确保后续同步读取时缓存已就绪
    void this.ensureInitialized();
  }

  /**
   * 确保设置缓存已从存储加载完成。幂等：重复调用复用同一 Promise。
   */
  ensureInitialized(): Promise<void> {
    if (this.ready) return Promise.resolve();
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        const stored = await getStorageItem<Record<string, any>>(STORAGE_KEY);
        // 以存储值为基底，叠加初始化期间可能已发生的写入，避免丢失这些写入
        this.cache = { ...(stored || {}), ...this.cache };
      } catch (error) {
        console.error('[ParameterSyncService] 初始化设置缓存失败:', error);
      } finally {
        this.ready = true;
        // 通知订阅者：缓存已就绪，需要用真实持久化数据重新渲染
        this.notifyChange();
      }
    })();

    return this.initPromise;
  }

  /** 缓存是否就绪 */
  get isReady(): boolean {
    return this.ready;
  }

  /** 当前版本号（每次变化递增） */
  getVersion = (): number => {
    return this.version;
  };

  /**
   * 订阅设置变化。返回取消订阅函数。
   * 与 {@link getVersion} 搭配可用于 React 的 useSyncExternalStore。
   */
  subscribe = (listener: () => void): (() => void) => {
    this.globalListeners.add(listener);
    return () => {
      this.globalListeners.delete(listener);
    };
  };

  /** 递增版本号并通知所有全局订阅者 */
  private notifyChange(): void {
    this.version++;
    this.globalListeners.forEach(listener => listener());
  }

  /** 防抖持久化当前缓存 */
  private schedulePersist(): void {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      void setStorageItem(STORAGE_KEY, this.cache);
    }, SAVE_DEBOUNCE_MS);
  }

  /**
   * 获取 appSettings（同步，使用缓存）
   *
   * 注意：应用刚启动、缓存尚未就绪时可能返回不完整数据。需要可靠数据的场景请先
   * await {@link ensureInitialized} 或使用 {@link getSettingsAsync}/响应式 Hook。
   */
  getSettings(): Record<string, any> {
    if (!this.ready && !this.initPromise) {
      void this.ensureInitialized();
    }
    return this.cache;
  }

  /**
   * 保存 appSettings（内存即时生效，磁盘防抖持久化）
   */
  saveSettings(settings: Record<string, any>): void {
    this.cache = settings;
    this.ready = true;
    this.schedulePersist();
    this.notifyChange();
  }

  /**
   * 异步获取 appSettings（保证缓存已就绪）
   */
  async getSettingsAsync(): Promise<Record<string, any>> {
    await this.ensureInitialized();
    return { ...this.cache };
  }

  /**
   * 异步保存 appSettings（立即写入存储）
   */
  async saveSettingsAsync(settings: Record<string, any>): Promise<void> {
    this.cache = settings;
    this.ready = true;
    await setStorageItem(STORAGE_KEY, settings);
    this.notifyChange();
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
