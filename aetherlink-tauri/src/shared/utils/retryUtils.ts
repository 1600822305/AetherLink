/**
 * 重试工具函数
 * 提供统一的重试机制，支持指数退避和错误类型检查
 */

// 重试配置
export const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000, // 1秒
  maxDelay: 10000, // 10秒
  retryableErrors: [
    'INTERNAL', // 500 错误
    'UNAVAILABLE', // 503 错误
    'DEADLINE_EXCEEDED', // 超时
    'RESOURCE_EXHAUSTED', // 资源耗尽
    'ABORTED' // 请求中断
  ],
  retryableHttpCodes: [500, 502, 503, 504, 429] // HTTP 状态码
};

/**
 * 检查错误是否可以重试
 */
export function isRetryableError(error: any): boolean {
  // 检查 HTTP 状态码
  if (error?.status && RETRY_CONFIG.retryableHttpCodes.includes(error.status)) {
    return true;
  }

  // 检查错误消息中的状态
  if (error?.message) {
    const message = error.message.toLowerCase();
    return RETRY_CONFIG.retryableErrors.some(retryableError => 
      message.includes(retryableError.toLowerCase())
    );
  }

  // 检查 GoogleGenerativeAI 错误
  if (error?.error?.status && RETRY_CONFIG.retryableErrors.includes(error.error.status)) {
    return true;
  }

  // 检查网络错误
  if (error?.name === 'NetworkError' || error?.code === 'NETWORK_ERROR') {
    return true;
  }

  // 检查 fetch 错误
  if (error?.name === 'TypeError' && error?.message?.includes('fetch')) {
    return true;
  }

  return false;
}

/**
 * 计算重试延迟（指数退避）
 */
export function calculateRetryDelay(attempt: number): number {
  const delay = RETRY_CONFIG.baseDelay * Math.pow(2, attempt);
  return Math.min(delay, RETRY_CONFIG.maxDelay);
}

/**
 * 重试包装器
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  context: string,
  maxRetries: number = RETRY_CONFIG.maxRetries
): Promise<T> {
  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      // 如果是最后一次尝试，或者错误不可重试，直接抛出
      if (attempt === maxRetries || !isRetryableError(error)) {
        if (attempt === maxRetries) {
          console.error(`[${context}] 重试次数已达上限 (${maxRetries + 1} 次)，操作失败:`, error);
        } else {
          console.error(`[${context}] 错误不可重试，操作失败:`, error);
        }
        throw error;
      }

      const delay = calculateRetryDelay(attempt);
      console.warn(`[${context}] 操作失败 (尝试 ${attempt + 1}/${maxRetries + 1})，${delay}ms 后重试:`, error);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * 带有进度回调的重试包装器
 */
export async function withRetryAndProgress<T>(
  operation: () => Promise<T>,
  _context: string,
  onRetry?: (attempt: number, maxRetries: number, delay: number, error: any) => void,
  maxRetries: number = RETRY_CONFIG.maxRetries
): Promise<T> {
  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      // 如果是最后一次尝试，或者错误不可重试，直接抛出
      if (attempt === maxRetries || !isRetryableError(error)) {
        throw error;
      }

      const delay = calculateRetryDelay(attempt);
      
      // 调用进度回调
      onRetry?.(attempt + 1, maxRetries + 1, delay, error);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
