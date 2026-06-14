/**
 * 错误处理工具类 - 参考最佳实例架构
 * 提供错误格式化、错误详情提取、统一错误处理等功能
 * 添加完整的 AI SDK 错误序列化支持
 */
import { createLogger, LogLevel } from '../services/infra/logger';
const logger = createLogger('Error');
const LOG_LEVEL_MAP: Record<'DEBUG' | 'INFO' | 'WARN' | 'ERROR', LogLevel> = {
  DEBUG: LogLevel.DEBUG,
  INFO: LogLevel.INFO,
  WARN: LogLevel.WARN,
  ERROR: LogLevel.ERROR,
};
import type {
  AiSdkErrorUnion,
  SerializedError,
  SerializedAiSdkError,
  SerializedAiSdkInvalidToolInputError,
  SerializedAiSdkNoSuchToolError,
  Serializable
} from '../types/error';
import { isSerializedAiSdkAPICallError } from '../types/error';

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
  logger.error('原始错误:', error);

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
    logger.debug(`[${context}] 请求被中止`, { error: getErrorMessage(error) });
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

  // 记录错误
  logger.logAt(LOG_LEVEL_MAP[logLevel], `[${context}] ${errorMessage}`, logData);

  // 如果需要显示给用户（可以在这里集成Toast或其他用户通知）
  if (showUser) {
    // 这里可以集成用户通知系统
    logger.warn(`用户错误提示: ${errorMessage}`);
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

/**
 * 安全序列化值为可序列化类型
 * @param value 要序列化的值
 * @returns 序列化后的值
 */
export function safeSerialize(value: unknown): Serializable {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(item => safeSerialize(item));
  }

  if (typeof value === 'object') {
    try {
      const seen = new WeakSet();
      return JSON.parse(
        JSON.stringify(value, (_, val) => {
          if (typeof val === 'object' && val !== null) {
            if (seen.has(val)) {
              return '[Circular]';
            }
            seen.add(val);
          }
          if (val instanceof Date) return val.toISOString();
          if (typeof val === 'function') return '[Function]';
          if (typeof val === 'symbol') return '[Symbol]';
          return val;
        })
      );
    } catch {
      return String(value);
    }
  }

  return String(value);
}

/**
 * 获取基础错误信息
 * @param error 错误对象
 * @returns 基础错误信息
 */
function getBaseError(error: Error) {
  return {
    name: error.name || error.constructor.name || 'Error',
    message: error.message ?? null,
    stack: error.stack ?? null,
    cause: (error as any).cause ? safeSerialize((error as any).cause) : null
  } as const;
}

/**
 * 序列化 InvalidToolInputError
 * @param error InvalidToolInputError 对象
 * @returns 序列化后的错误
 */
function serializeInvalidToolInputError(error: any): SerializedAiSdkInvalidToolInputError {
  const baseError = getBaseError(error);
  return {
    ...baseError,
    toolName: error.toolName,
    toolInput: error.toolInput
  } satisfies SerializedAiSdkInvalidToolInputError;
}

/**
 * 序列化 NoSuchToolError
 * @param error NoSuchToolError 对象
 * @returns 序列化后的错误
 */
function serializeNoSuchToolError(error: any): SerializedAiSdkNoSuchToolError {
  const baseError = getBaseError(error);
  return {
    ...baseError,
    toolName: error.toolName ?? null,
    availableTools: error.availableTools ?? null
  } satisfies SerializedAiSdkNoSuchToolError;
}

/**
 * 序列化错误对象
 * 将 AI SDK 错误转换为可序列化的对象
 * @param error AI SDK 错误对象
 * @returns 序列化后的错误
 */
export function serializeError(error: AiSdkErrorUnion): SerializedError {
  // 统一所有可能的错误字段
  const serializedError: SerializedError = {
    name: error.name ?? null,
    message: error.message ?? null,
    stack: error.stack ?? null,
    cause: safeSerialize(error.cause)
  };

  if ('url' in error) serializedError.url = error.url;
  if ('requestBodyValues' in error) serializedError.requestBodyValues = safeSerialize(error.requestBodyValues);
  if ('statusCode' in error) serializedError.statusCode = error.statusCode ?? null;
  if ('responseBody' in error) serializedError.responseBody = error.responseBody ?? null;
  if ('isRetryable' in error) serializedError.isRetryable = error.isRetryable;
  if ('data' in error) serializedError.data = safeSerialize(error.data);
  if ('responseHeaders' in error) serializedError.responseHeaders = error.responseHeaders ?? null;
  if ('statusText' in error) serializedError.statusText = error.statusText ?? null;
  if ('parameter' in error) serializedError.parameter = error.parameter;
  if ('value' in error) serializedError.value = safeSerialize(error.value);
  if ('content' in error) serializedError.content = safeSerialize(error.content);
  if ('role' in error) serializedError.role = error.role;
  if ('prompt' in error) serializedError.prompt = safeSerialize(error.prompt);
  if ('toolName' in error) serializedError.toolName = String(error.toolName);
  if ('toolInput' in error) serializedError.toolInput = String(error.toolInput);
  if ('toolArgs' in error) serializedError.toolArgs = String(error.toolArgs); // ai 4.x
  if ('text' in error) serializedError.text = error.text ? String(error.text) : null;
  if ('originalMessage' in error) serializedError.originalMessage = safeSerialize(error.originalMessage);
  if ('response' in error) serializedError.response = safeSerialize(error.response);
  if ('usage' in error) serializedError.usage = safeSerialize(error.usage);
  if ('finishReason' in error) serializedError.finishReason = error.finishReason ?? null;
  if ('modelId' in error) serializedError.modelId = error.modelId;
  if ('modelType' in error) serializedError.modelType = error.modelType;
  if ('providerId' in error) serializedError.providerId = error.providerId;
  if ('availableProviders' in error) serializedError.availableProviders = error.availableProviders;
  if ('availableTools' in error) serializedError.availableTools = error.availableTools ?? null;
  if ('reason' in error) serializedError.reason = error.reason;
  if ('lastError' in error) serializedError.lastError = safeSerialize(error.lastError);
  if ('errors' in error) serializedError.errors = error.errors.map((err: unknown) => safeSerialize(err));
  if ('originalError' in error) {
    // 根据错误类型判断如何序列化
    const originalError = error.originalError as any;
    if (originalError && 'toolInput' in originalError) {
      serializedError.originalError = serializeInvalidToolInputError(originalError);
    } else {
      serializedError.originalError = serializeNoSuchToolError(originalError);
    }
  }
  if ('functionality' in error) serializedError.functionality = error.functionality;
  if ('responses' in error) serializedError.responses = error.responses as string[];
  if ('provider' in error) serializedError.provider = String(error.provider);
  if ('maxEmbeddingsPerCall' in error) serializedError.maxEmbeddingsPerCall = Number(error.maxEmbeddingsPerCall);
  if ('values' in error) serializedError.values = safeSerialize(error.values) as Serializable[];

  return serializedError;
}

/**
 * 安全地将任意值转换为字符串
 * @param value 需要转换的值
 * @returns 转换后的字符串
 */
export function safeToString(value: unknown): string {
  // 处理 null 和 undefined
  if (value == null) {
    return 'null';
  }

  // 字符串直接返回
  if (typeof value === 'string') {
    return value;
  }

  // 数字、布尔值、bigint 等原始类型
  if (typeof value !== 'object' && typeof value !== 'function') {
    return String(value);
  }

  // 处理对象（包括数组）
  if (typeof value === 'object') {
    if (typeof value === 'function') {
      return value.toString();
    }

    try {
      return JSON.stringify(value, getCircularReplacer());
    } catch (err) {
      return '[Unserializable: ' + err + ']';
    }
  }

  return String(value);
}

/**
 * 防止循环引用导致的 JSON.stringify 崩溃
 * @returns 替换函数
 */
function getCircularReplacer() {
  const seen = new WeakSet();

  return (_key: string, value: unknown) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular]';
      }
      seen.add(value);
    }
    return value;
  };
}

/**
 * 格式化序列化后的错误为字符串
 * @param error 序列化后的错误
 * @returns 格式化后的字符串
 */
export function formatSerializedError(error: SerializedError): string {
  return `错误名称: ${error.name}\n错误消息: ${error.message}\n堆栈跟踪: ${error.stack}`;
}

/**
 * 格式化 AI SDK 错误为字符串
 * @param error 序列化后的 AI SDK 错误
 * @returns 格式化后的字符串
 */
export function formatAiSdkError(error: SerializedAiSdkError): string {
  let text = formatSerializedError(error) + '\n';

  if (error.cause) {
    text += `原因: ${safeToString(error.cause)}\n`;
  }

  if (isSerializedAiSdkAPICallError(error)) {
    if (error.statusCode) {
      text += `状态码: ${error.statusCode}\n`;
    }

    text += `请求地址: ${error.url}\n`;
    const requestBodyValues = safeToString(error.requestBodyValues);
    text += `请求体: ${requestBodyValues}\n`;

    if (error.responseHeaders) {
      text += `响应头: ${JSON.stringify(error.responseHeaders, null, 2)}\n`;
    }

    if (error.responseBody) {
      text += `响应体: ${error.responseBody}\n`;
    }

    if (error.data) {
      const data = safeToString(error.data);
      text += `数据: ${data}\n`;
    }
  }

  return text.trim();
}
