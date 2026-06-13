/**
 * 统一日志系统 — 默认配置与环境判定
 * 环境判定统一走 import.meta.env.DEV，不使用 process.env.NODE_ENV（浏览器不可靠）
 */
import { LogLevel, type LogLevelName, type Platform } from './types';
import { isTauri, isCapacitor } from '../../../utils/platformDetection';

const DEBUG_FLAG_KEY = 'debug_mode';

/** 运行时调试开关（持久化在 localStorage，刷新后仍生效） */
export function readDebugFlag(): boolean {
  try {
    return (
      typeof localStorage !== 'undefined' &&
      localStorage.getItem(DEBUG_FLAG_KEY) === 'true'
    );
  } catch {
    return false;
  }
}

export function writeDebugFlag(enabled: boolean): void {
  try {
    if (typeof localStorage === 'undefined') return;
    if (enabled) localStorage.setItem(DEBUG_FLAG_KEY, 'true');
    else localStorage.removeItem(DEBUG_FLAG_KEY);
  } catch {
    /* 忽略存储不可用 */
  }
}

/** 默认级别阈值：开发 DEBUG，生产 WARN；手动开调试则强制 DEBUG */
export function getDefaultLevel(): LogLevel {
  if (readDebugFlag()) return LogLevel.DEBUG;
  return import.meta.env.DEV ? LogLevel.DEBUG : LogLevel.WARN;
}

/** 当前运行平台（在 logger 初始化时计算一次即可） */
export function resolvePlatform(): Platform {
  try {
    if (isTauri()) return 'tauri';
    if (isCapacitor()) return 'capacitor';
  } catch {
    /* 探测失败时退回 web */
  }
  return 'web';
}

export const LEVEL_LABEL: Record<LogLevel, LogLevelName> = {
  [LogLevel.SILENT]: 'SILENT',
  [LogLevel.ERROR]: 'ERROR',
  [LogLevel.WARN]: 'WARN',
  [LogLevel.INFO]: 'INFO',
  [LogLevel.DEBUG]: 'DEBUG',
  [LogLevel.TRACE]: 'TRACE',
};
