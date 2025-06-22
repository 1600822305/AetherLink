/**
 * 日志记录服务
 * 提供统一的日志记录功能
 */

// 日志级别
export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

// 日志记录函数
export function log(level: LogLevel, message: string, data?: any): void {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    data
  };

  // 根据不同级别使用不同的控制台方法
  // 序列化数据对象，避免[object Object]
  const serializedData = data ? JSON.stringify(data, null, 2) : '';

  switch (level) {
    case 'DEBUG':
      console.log(`[${timestamp}] [DEBUG] ${message}`, serializedData);
      break;
    case 'INFO':
      console.info(`[${timestamp}] [INFO] ${message}`, serializedData);
      break;
    case 'WARN':
      console.warn(`[${timestamp}] [WARN] ${message}`, serializedData);
      break;
    case 'ERROR':
      console.error(`[${timestamp}] [ERROR] ${message}`, serializedData);
      break;
  }

  // 将日志存储到本地存储（仅保留最近的日志）
  try {
    const LOGS_KEY = 'app_logs';
    const MAX_LOGS = 100;

    const logsJson = localStorage.getItem(LOGS_KEY) || '[]';
    const logs = JSON.parse(logsJson);

    logs.push(logEntry);

    // 保留最近的日志
    if (logs.length > MAX_LOGS) {
      logs.splice(0, logs.length - MAX_LOGS);
    }

    localStorage.setItem(LOGS_KEY, JSON.stringify(logs));
  } catch (error) {
    console.error('无法写入日志到本地存储:', error);
  }
}

// 记录API请求
export function logApiRequest(endpoint: string, level: LogLevel, data: any): void {
  // 确保请求数据被完整记录
  console.log(`API请求详情 [${endpoint}]:`, JSON.stringify(data, null, 2));
  log(level, `API请求 [${endpoint}]`, data);
}

// 记录API响应
export function logApiResponse(endpoint: string, statusCode: number, data: any): void {
  const level = statusCode >= 400 ? 'ERROR' : 'INFO';
  // 确保响应数据被完整记录
  console.log(`API响应详情 [${endpoint}] 状态码: ${statusCode}:`, JSON.stringify(data, null, 2));
  log(level, `API响应 [${endpoint}] 状态码: ${statusCode}`, data);
}

// 获取最近的日志
export function getRecentLogs(count: number = 50): any[] {
  try {
    const LOGS_KEY = 'app_logs';
    const logsJson = localStorage.getItem(LOGS_KEY) || '[]';
    const logs = JSON.parse(logsJson);

    return logs.slice(-count);
  } catch (error) {
    console.error('无法从本地存储获取日志:', error);
    return [];
  }
}

// 清除所有日志
export function clearLogs(): void {
  try {
    localStorage.removeItem('app_logs');
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
