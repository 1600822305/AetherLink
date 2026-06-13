/**
 * 调试日志工具（兼容垫片）
 * 现已转发到统一 logger（src/shared/services/infra/logger）。
 * 级别阈值、命名空间、脱敏由统一 logger 负责，此处仅保留旧 API 形态。
 */
import {
  debugLogCompat,
  getLoggerDebugMode,
  setLoggerDebugMode,
} from '../services/infra/logger/compat';

// 日志级别
export type LogLevel = 'log' | 'info' | 'warn' | 'error';

/**
 * 条件日志记录函数
 * 是否输出由统一 logger 的级别阈值决定（开发 DEBUG / 生产 WARN）
 */
export const debugLog = debugLogCompat;

/**
 * 启用/禁用调试模式
 */
export const setDebugMode = (enabled: boolean): void => {
  setLoggerDebugMode(enabled);
};

/**
 * 检查调试模式状态
 */
export const getDebugMode = (): boolean => getLoggerDebugMode();
