/**
 * useParameterSettings
 *
 * 以响应式的方式消费 {@link parameterSyncService} 中的参数设置。
 *
 * 该 Hook 解决了「设置持久化在异步存储（Dexie），但组件同步读取内存缓存」导致的
 * 竞态问题：应用刚启动、缓存尚未加载完成时，组件若在初始化阶段同步读取缓存会拿到
 * 空对象，从而把非默认开启的开关（如「推理努力程度」）错误地显示为关闭。
 *
 * 通过 useSyncExternalStore 订阅服务的版本号，缓存就绪或任何参数变化时组件都会
 * 重新渲染并读取到最新的持久化值。
 */
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import {
  parameterSyncService,
  type SyncableParameterKey,
} from '../services/assistant/ParameterSyncService';

/** 单个参数的配置：键名、默认值、默认是否启用 */
export interface ParameterConfigItem {
  key: string;
  defaultValue: any;
  defaultEnabled: boolean;
}

/** 由参数键推导其启用开关键名，例如 reasoningEffort -> enableReasoningEffort */
function toEnableKey(key: string): string {
  return `enable${key.charAt(0).toUpperCase()}${key.slice(1)}`;
}

export interface UseParameterSettingsResult {
  /** 各参数的当前值（已回退默认值） */
  values: Record<string, any>;
  /** 各参数的当前启用状态（已回退默认值） */
  enabled: Record<string, boolean>;
  /** 缓存是否已从存储加载完成 */
  ready: boolean;
  /** 设置版本号，每次变化递增。可作为派生其他设置（如自定义参数）的依赖。 */
  version: number;
  /** 设置参数值，可选同时设置启用状态 */
  setValue: (key: string, value: any, isEnabled?: boolean) => void;
  /** 设置参数启用状态 */
  setEnabled: (key: string, isEnabled: boolean) => void;
}

/**
 * 订阅一组参数的值与启用状态，并提供更新方法。
 *
 * @param paramConfig 参数配置数组。建议在调用方用 useMemo 固定其引用以减少重算。
 */
export function useParameterSettings(
  paramConfig: ParameterConfigItem[]
): UseParameterSettingsResult {
  // 订阅服务版本号：缓存就绪或任意参数变化都会触发重渲染
  const version = useSyncExternalStore(
    parameterSyncService.subscribe,
    parameterSyncService.getVersion,
    parameterSyncService.getVersion
  );

  // 仅在配置或版本变化时重算，保证返回引用稳定，避免下游组件无谓重渲染
  const { values, enabled } = useMemo(() => {
    const settings = parameterSyncService.getSettings();
    const nextValues: Record<string, any> = {};
    const nextEnabled: Record<string, boolean> = {};
    for (const { key, defaultValue, defaultEnabled } of paramConfig) {
      nextValues[key] = settings[key] ?? defaultValue;
      nextEnabled[key] = settings[toEnableKey(key)] ?? defaultEnabled;
    }
    return { values: nextValues, enabled: nextEnabled };
    // version 参与依赖：设置变化时（含异步加载完成）触发重算
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramConfig, version]);

  const setValue = useCallback((key: string, value: any, isEnabled?: boolean): void => {
    parameterSyncService.setParameter(key as SyncableParameterKey, value, isEnabled);
  }, []);

  const setEnabled = useCallback((key: string, isEnabled: boolean): void => {
    parameterSyncService.setParameterEnabled(key as SyncableParameterKey, isEnabled);
  }, []);

  return {
    values,
    enabled,
    ready: parameterSyncService.isReady,
    version,
    setValue,
    setEnabled,
  };
}
