/**
 * 兼容垫片：把旧 LoggerService / debugLogger 的调用转发到统一 logger，
 * 让现有 19+ 个文件无需立即改动即可受益于级别短路与脱敏。
 */
import { logger } from './index';
import { LogLevel } from './types';
import { getDefaultLevel, readDebugFlag, writeDebugFlag } from './config';

type LegacyLoggerLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

const LEGACY_LEVEL: Record<LegacyLoggerLevel, LogLevel> = {
  DEBUG: LogLevel.DEBUG,
  INFO: LogLevel.INFO,
  WARN: LogLevel.WARN,
  ERROR: LogLevel.ERROR,
};

/** 转发旧 LoggerService.log(level, message, data) */
export function forwardLog(
  level: LegacyLoggerLevel,
  message: string,
  data?: unknown,
): void {
  const lvl = LEGACY_LEVEL[level] ?? LogLevel.INFO;
  if (data === undefined) logger.logAt(lvl, message);
  else logger.logAt(lvl, message, data);
}

/** 转发旧 debugLog.* */
export const debugLogCompat = {
  log: (message: string, ...args: unknown[]): void =>
    logger.debug(message, ...args),
  info: (message: string, ...args: unknown[]): void =>
    logger.info(message, ...args),
  warn: (message: string, ...args: unknown[]): void =>
    logger.warn(message, ...args),
  error: (message: string, ...args: unknown[]): void =>
    logger.error(message, ...args),
  component: (componentName: string, action: string, data?: unknown): void => {
    const scoped = logger.withContext(componentName);
    if (data === undefined) scoped.debug(action);
    else scoped.debug(action, data);
  },
};

/** 旧 setDebugMode：持久化开关并即时调整 logger 阈值 */
export function setLoggerDebugMode(enabled: boolean): void {
  writeDebugFlag(enabled);
  logger.setLevel(enabled ? LogLevel.DEBUG : getDefaultLevel());
}

/** 旧 getDebugMode */
export function getLoggerDebugMode(): boolean {
  if (readDebugFlag()) return true;
  if (
    typeof window !== 'undefined' &&
    (window as unknown as { __DEBUG__?: boolean }).__DEBUG__ === true
  ) {
    return true;
  }
  return import.meta.env.DEV;
}
