/**
 * 重试中间件
 * 对标 Cherry Studio 错误重试逻辑
 * 
 * 自动重试失败的请求（可重试错误）
 */
import type { CompletionsMiddleware } from '../types';
import type { CompletionsResult } from '../schemas';

export const MIDDLEWARE_NAME = 'RetryMiddleware';

/**
 * 重试配置
 */
export interface RetryConfig {
  /** 最大重试次数 */
  maxRetries: number;
  /** 初始延迟（毫秒）*/
  initialDelay: number;
  /** 最大延迟（毫秒）*/
  maxDelay: number;
  /** 延迟倍数（指数退避）*/
  backoffMultiplier: number;
  /** 可重试的错误模式 */
  retryablePatterns: string[];
}

const defaultConfig: RetryConfig = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  retryablePatterns: [
    // 网络错误
    'ECONNRESET',
    'ETIMEDOUT',
    'ECONNREFUSED',
    'ENOTFOUND',
    'network',
    'fetch failed',
    
    // 速率限制
    '429',
    'rate limit',
    'too many requests',
    
    // 服务端错误
    '500',
    '502',
    '503',
    '504',
    'internal server error',
    'bad gateway',
    'service unavailable',
    'gateway timeout',
    
    // 超时
    'timeout',
    'timed out',
  ],
};

/**
 * 检查错误是否可重试
 */
function isRetryableError(error: Error, patterns: string[]): boolean {
  const message = error.message.toLowerCase();
  return patterns.some(pattern => message.includes(pattern.toLowerCase()));
}

/**
 * 检查是否为中止错误
 */
function isAbortError(error: Error): boolean {
  return error.name === 'AbortError' || 
         error.message.includes('aborted') ||
         error.message.includes('cancelled');
}

/**
 * 计算延迟时间（指数退避）
 */
function calculateDelay(
  attempt: number,
  initialDelay: number,
  maxDelay: number,
  multiplier: number
): number {
  const delay = initialDelay * Math.pow(multiplier, attempt);
  // 添加抖动 (±10%)
  const jitter = delay * 0.1 * (Math.random() * 2 - 1);
  return Math.min(delay + jitter, maxDelay);
}

/**
 * 延迟函数
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 重试中间件
 * 自动重试可重试的错误
 */
export const RetryMiddleware: CompletionsMiddleware = (_api) => (next) =>
  async (context, params): Promise<CompletionsResult> => {
    const config = defaultConfig;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        // 如果不是第一次尝试，等待
        if (attempt > 0) {
          const delay = calculateDelay(
            attempt - 1,
            config.initialDelay,
            config.maxDelay,
            config.backoffMultiplier
          );
          
          console.log(`[RetryMiddleware] Retry attempt ${attempt}/${config.maxRetries} after ${Math.round(delay)}ms`);
          await sleep(delay);
        }

        return await next(context, params);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // 中止错误不重试
        if (isAbortError(lastError)) {
          console.log('[RetryMiddleware] Request aborted, not retrying');
          throw lastError;
        }

        // 检查是否中止
        if (context._internal.flowControl?.abortSignal?.aborted) {
          console.log('[RetryMiddleware] Abort signal received, not retrying');
          throw lastError;
        }

        // 检查是否可重试
        if (!isRetryableError(lastError, config.retryablePatterns)) {
          console.log(`[RetryMiddleware] Non-retryable error: ${lastError.message}`);
          throw lastError;
        }

        // 如果已达到最大重试次数
        if (attempt >= config.maxRetries) {
          console.error(`[RetryMiddleware] Max retries (${config.maxRetries}) exceeded`);
          throw lastError;
        }

        console.warn(`[RetryMiddleware] Retryable error: ${lastError.message}`);
      }
    }

    // 不应该到达这里
    throw lastError || new Error('Unexpected retry middleware state');
  };

/**
 * 创建带自定义配置的重试中间件
 */
export function createRetryMiddleware(
  customConfig: Partial<RetryConfig>
): CompletionsMiddleware {
  const config = { ...defaultConfig, ...customConfig };

  return (_api) => (next) => async (context, params) => {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const delay = calculateDelay(
            attempt - 1,
            config.initialDelay,
            config.maxDelay,
            config.backoffMultiplier
          );
          
          console.log(`[RetryMiddleware] Retry attempt ${attempt}/${config.maxRetries} after ${Math.round(delay)}ms`);
          await sleep(delay);
        }

        return await next(context, params);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (isAbortError(lastError) || context._internal.flowControl?.abortSignal?.aborted) {
          throw lastError;
        }

        if (!isRetryableError(lastError, config.retryablePatterns)) {
          throw lastError;
        }

        if (attempt >= config.maxRetries) {
          throw lastError;
        }
      }
    }

    throw lastError || new Error('Unexpected retry middleware state');
  };
}
