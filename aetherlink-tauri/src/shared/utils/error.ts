/**
 * 错误处理工具类 - 参考最佳实例架构
 * 提供错误格式化、错误详情提取、统一错误处理等功能
 */
import LoggerService from '../services/LoggerService';

/**
 * 从错误对象中提取详细信息
 * @param err 错误对象
 * @param seen 已处理的对象集合，用于处理循环引用
 * @returns 提取的错误详情
 */
export function getErrorDetails(err: any, seen = new WeakSet()): any {
  // 处理空值或非对象
  if (err === null || typeof err !== 'object' || seen.has(err)) {
    return err;
  }

  seen.add(err);
  const result: any = {};

  // 获取所有可枚举属性，包括原型链上的
  const allProps = new Set([...Object.getOwnPropertyNames(err), ...Object.keys(err)]);

  for (const prop of allProps) {
    try {
      const value = err[prop];
      // 跳过函数属性
      if (typeof value === 'function') continue;
      // 递归处理嵌套对象
      result[prop] = getErrorDetails(value, seen);
    } catch (e) {
      result[prop] = '<无法访问属性>';
    }
  }

  return result;
}

/**
 * 格式化错误消息为可读字符串
 * @param error 错误对象
 * @returns 格式化后的错误消息
 */
export function formatErrorMessage(error: any): string {
  console.error('原始错误:', error);

  try {
    const detailedError = getErrorDetails(error);
    // 移除不必要的属性
    delete detailedError?.headers;
    delete detailedError?.stack;
    delete detailedError?.request_id;
    return '```json\n' + JSON.stringify(detailedError, null, 2) + '\n```';
  } catch (e) {
    try {
      return '```\n' + String(error) + '\n```';
    } catch {
      return 'Error: 无法格式化错误消息';
    }
  }
}

/**
 * 格式化错误消息为对象
 * @param error 错误对象
 * @returns 格式化后的错误对象
 */
export function formatMessageError(error: any): Record<string, any> {
  try {
    const detailedError = getErrorDetails(error);
    // 移除不必要的属性
    delete detailedError?.headers;
    delete detailedError?.stack;
    delete detailedError?.request_id;
    return detailedError;
  } catch (e) {
    try {
      return { message: String(error) };
    } catch {
      return { message: 'Error: 无法格式化错误消息' };
    }
  }
}

/**
 * 获取错误消息
 * @param error 错误对象
 * @returns 错误消息字符串
 */
export function getErrorMessage(error: any): string {
  if (!error) {
    return '';
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error?.error) {
    return getErrorMessage(error.error);
  }

  return error?.message || error?.toString() || '';
}

/**
 * 检查是否为中止错误
 * @param error 错误对象
 * @returns 是否为中止错误
 */
export function isAbortError(error: any): boolean {
  // 检查错误消息
  if (error?.message === 'Request was aborted.') {
    return true;
  }

  // 检查是否为 DOMException 类型的中止错误
  if (error instanceof DOMException && error.name === 'AbortError') {
    return true;
  }

  // 检查特定的错误结构
  if (
    error &&
    typeof error === 'object' &&
    (error.message === 'Request was aborted.' || error?.message?.includes('signal is aborted without reason'))
  ) {
    return true;
  }

  return false;
}

/**
 * 统一错误处理函数 - 参考最佳实例架构
 * @param error 错误对象
 * @param context 错误上下文信息
 * @param options 处理选项
 */
export function handleError(
  error: any,
  context: string,
  options: {
    logLevel?: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
    showUser?: boolean;
    rethrow?: boolean;
    additionalData?: any;
  } = {}
): void {
  const {
    logLevel = 'ERROR',
    showUser = false,
    rethrow = false,
    additionalData
  } = options;

  // 检查是否为中止错误，如果是则不记录
  if (isAbortError(error)) {
    LoggerService.log('DEBUG', `[${context}] 请求被中止`, { error: getErrorMessage(error) });
    return;
  }

  // 构建错误信息
  const errorMessage = getErrorMessage(error);
  const errorType = getErrorType(error);
  const errorDetails = formatMessageError(error);

  // 构建日志数据
  const logData = {
    context,
    errorType,
    errorMessage,
    errorDetails,
    ...additionalData
  };

  // 使用LoggerService记录错误
  LoggerService.log(logLevel, `[${context}] ${errorMessage}`, logData);

  // 如果需要显示给用户（可以在这里集成Toast或其他用户通知）
  if (showUser) {
    // 这里可以集成用户通知系统
    console.warn(`用户错误提示: ${errorMessage}`);
  }

  // 如果需要重新抛出错误
  if (rethrow) {
    throw error;
  }
}

/**
 * 异步函数错误包装器 - 参考最佳实例架构
 * @param fn 异步函数
 * @param context 错误上下文
 * @param options 处理选项
 * @returns 包装后的函数
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context: string,
  options: {
    logLevel?: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
    showUser?: boolean;
    defaultReturn?: any;
    additionalData?: any;
  } = {}
): T {
  return (async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      handleError(error, context, {
        logLevel: options.logLevel,
        showUser: options.showUser,
        additionalData: options.additionalData
      });

      // 返回默认值而不是抛出错误
      return options.defaultReturn;
    }
  }) as T;
}

/**
 * 同步函数错误包装器
 * @param fn 同步函数
 * @param context 错误上下文
 * @param options 处理选项
 * @returns 包装后的函数
 */
export function withSyncErrorHandling<T extends (...args: any[]) => any>(
  fn: T,
  context: string,
  options: {
    logLevel?: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
    showUser?: boolean;
    defaultReturn?: any;
    additionalData?: any;
  } = {}
): T {
  return ((...args: any[]) => {
    try {
      return fn(...args);
    } catch (error) {
      handleError(error, context, {
        logLevel: options.logLevel,
        showUser: options.showUser,
        additionalData: options.additionalData
      });

      // 返回默认值而不是抛出错误
      return options.defaultReturn;
    }
  }) as T;
}

/**
 * 错误类型常量
 */
export const ErrorType = {
  NETWORK: 'network',
  API: 'api',
  AUTH: 'auth',
  TIMEOUT: 'timeout',
  RATE_LIMIT: 'rate_limit',
  SERVER: 'server',
  CLIENT: 'client',
  UNKNOWN: 'unknown'
} as const;

// 错误类型字符串联合类型
export type ErrorTypeString = typeof ErrorType[keyof typeof ErrorType];

/**
 * 根据错误信息判断错误类型
 * @param error 错误对象
 * @returns 错误类型字符串
 */
export function getErrorType(error: any): string {
  const message = getErrorMessage(error).toLowerCase();
  const status = error?.status || error?.code;

  // 网络错误
  if (message.includes('network') || message.includes('连接') || message.includes('connection')) {
    return ErrorType.NETWORK;
  }

  // 认证错误
  if (
    message.includes('auth') ||
    message.includes('token') ||
    message.includes('api key') ||
    message.includes('密钥') ||
    status === 401 ||
    status === 403
  ) {
    return ErrorType.AUTH;
  }

  // 超时错误
  if (message.includes('timeout') || message.includes('超时') || status === 408) {
    return ErrorType.TIMEOUT;
  }

  // 速率限制
  if (message.includes('rate limit') || message.includes('too many') || status === 429) {
    return ErrorType.RATE_LIMIT;
  }

  // 服务器错误
  if (status >= 500 && status < 600) {
    return ErrorType.SERVER;
  }

  // 客户端错误
  if (status >= 400 && status < 500) {
    return ErrorType.CLIENT;
  }

  // API错误
  if (message.includes('api') || error?.type?.includes('api')) {
    return ErrorType.API;
  }

  return ErrorType.UNKNOWN;
}
