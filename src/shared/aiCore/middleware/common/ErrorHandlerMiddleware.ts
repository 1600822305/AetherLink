/**
 * 错误处理中间件
 * 对标 Cherry Studio ErrorHandlerMiddleware
 */
import type { CompletionsMiddleware } from '../types';
import type { CompletionsResult } from '../schemas';
import { ChunkType } from '../../types/chunk';

export const MIDDLEWARE_NAME = 'ErrorHandlerMiddleware';

/**
 * 错误类型
 */
export enum ErrorType {
  ABORT = 'ABORT',
  RATE_LIMIT = 'RATE_LIMIT',
  AUTH = 'AUTH',
  NETWORK = 'NETWORK',
  TIMEOUT = 'TIMEOUT',
  UNKNOWN = 'UNKNOWN',
}

/**
 * 判断是否为中止错误
 */
function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return msg.includes('aborted') || msg.includes('cancelled') || msg.includes('cancel');
  }
  return false;
}

/**
 * 判断是否为频率限制错误
 */
function isRateLimitError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return msg.includes('rate limit') || msg.includes('429') || msg.includes('too many requests');
}

/**
 * 判断是否为认证错误
 */
function isAuthError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return msg.includes('401') || msg.includes('403') || 
         msg.includes('unauthorized') || msg.includes('invalid api key') ||
         msg.includes('authentication');
}

/**
 * 判断是否为网络错误
 */
function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError && error.message.includes('fetch')) return true;
  const msg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return msg.includes('network') || msg.includes('econnrefused') || 
         msg.includes('enotfound') || msg.includes('connection');
}

/**
 * 获取错误类型
 */
function getErrorType(error: unknown): ErrorType {
  if (isAbortError(error)) return ErrorType.ABORT;
  if (isRateLimitError(error)) return ErrorType.RATE_LIMIT;
  if (isAuthError(error)) return ErrorType.AUTH;
  if (isNetworkError(error)) return ErrorType.NETWORK;
  return ErrorType.UNKNOWN;
}

/**
 * 获取用户友好的错误消息
 */
function getUserFriendlyMessage(error: unknown, errorType: ErrorType): string {
  const originalMessage = error instanceof Error ? error.message : String(error);
  
  switch (errorType) {
    case ErrorType.ABORT:
      return '请求已取消';
    case ErrorType.RATE_LIMIT:
      return `API 请求频率超限，请稍后重试: ${originalMessage}`;
    case ErrorType.AUTH:
      return `API 认证失败，请检查密钥配置: ${originalMessage}`;
    case ErrorType.NETWORK:
      return `网络连接失败，请检查网络: ${originalMessage}`;
    case ErrorType.TIMEOUT:
      return `请求超时: ${originalMessage}`;
    default:
      return originalMessage;
  }
}

/**
 * 错误处理中间件
 * 捕获下游中间件的错误，进行统一处理
 */
export const ErrorHandlerMiddleware: CompletionsMiddleware = (_api) => (next) =>
  async (context, params): Promise<CompletionsResult> => {
    const { onChunk, shouldThrow } = params;

    try {
      return await next(context, params);
    } catch (error) {
      const errorType = getErrorType(error);
      const message = getUserFriendlyMessage(error, errorType);

      console.error(`[ErrorHandlerMiddleware] ${errorType}:`, message);

      // 中止错误不算真正的错误
      if (errorType === ErrorType.ABORT) {
        if (context._internal.flowControl) {
          context._internal.flowControl.aborted = true;
        }
        
        // 返回当前累积的结果
        return {
          getText: () => context._internal.accumulated?.text || '',
          getReasoning: () => context._internal.accumulated?.thinking,
          usage: context._internal.accumulated?.usage,
        };
      }

      // 存储错误
      context._internal.error = error instanceof Error ? error : new Error(message);

      // 发送错误 Chunk
      if (onChunk) {
        try {
          await onChunk({
            type: ChunkType.ERROR,
            error: {
              message,
              type: errorType,
            },
          });
        } catch {
          // 忽略发送错误时的异常
        }
      }

      // 根据配置决定是否抛出错误
      if (shouldThrow !== false) {
        throw context._internal.error;
      }

      // 返回带错误的结果
      return {
        getText: () => context._internal.accumulated?.text || '',
        getReasoning: () => context._internal.accumulated?.thinking,
        usage: context._internal.accumulated?.usage,
      };
    }
  };
