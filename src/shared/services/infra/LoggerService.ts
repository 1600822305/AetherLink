/**
 * 日志记录服务
 * 提供统一的日志记录功能
 */
import { getStorageItem, setStorageItem, removeStorageItem } from '../../utils/storage';
import { forwardLog } from './logger/compat';

// 日志级别
export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

const LOGS_KEY = 'app_logs';
const MAX_LOGS = 100;

// 内存缓存，避免频繁异步操作
let logsCache: any[] = [];
let cacheInitialized = false;

// 异步初始化日志缓存
async function initLogsCache(): Promise<void> {
  if (cacheInitialized) return;
  try {
    const stored = await getStorageItem<any[]>(LOGS_KEY);
    logsCache = stored || [];
    cacheInitialized = true;
  } catch {
    logsCache = [];
    cacheInitialized = true;
  }
}

// 异步保存日志（防抖）
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
function debouncedSaveLogs(): void {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    try {
      await setStorageItem(LOGS_KEY, logsCache);
    } catch (error) {
      console.error('无法写入日志到存储:', error);
    }
  }, 1000);
}

// 日志记录函数
export function log(level: LogLevel, message: string, data?: any): void {
  // 统一经新 logger 输出（含级别阈值短路与脱敏）
  forwardLog(level, message, data);

  // 保留内存缓存 + 防抖持久化，供应用内日志查看器（getRecentLogs）使用
  const timestamp = new Date().toISOString();
  if (!cacheInitialized) {
    initLogsCache();
  }

  logsCache.push({ timestamp, level, message, data });

  // 保留最近的日志
  if (logsCache.length > MAX_LOGS) {
    logsCache.splice(0, logsCache.length - MAX_LOGS);
  }

  // 防抖保存到Dexie
  debouncedSaveLogs();
}

// 记录API请求
export function logApiRequest(endpoint: string, level: LogLevel, data: any): void {
  log(level, `API请求 [${endpoint}]`, data);
}

// 记录API响应
export function logApiResponse(endpoint: string, statusCode: number, data: any): void {
  const level: LogLevel = statusCode >= 400 ? 'ERROR' : 'INFO';
  log(level, `API响应 [${endpoint}] 状态码: ${statusCode}`, data);
}

// 获取最近的日志（同步，使用缓存）
export function getRecentLogs(count: number = 50): any[] {
  return logsCache.slice(-count);
}

// 获取最近的日志（异步，从存储读取）
export async function getRecentLogsAsync(count: number = 50): Promise<any[]> {
  try {
    const logs = await getStorageItem<any[]>(LOGS_KEY);
    if (logs) {
      logsCache = logs;
      return logs.slice(-count);
    }
    return logsCache.slice(-count);
  } catch (error) {
    console.error('无法从存储获取日志:', error);
    return logsCache.slice(-count);
  }
}

// 清除所有日志
export async function clearLogs(): Promise<void> {
  try {
    logsCache = [];
    await removeStorageItem(LOGS_KEY);
  } catch (error) {
    console.error('无法清除日志:', error);
  }
}

export default {
  log,
  logApiRequest,
  logApiResponse,
  getRecentLogs,
  clearLogs
};
