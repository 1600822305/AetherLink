/**
 * 核心中间件集合
 * 包含错误处理、中断处理、最终消费者等基础中间件
 */
import type { Middleware, MiddlewareContext } from '../types';
import { MIDDLEWARE_NAMES } from '../types';
import { ChunkType, type Chunk } from '../../types/chunk';

// ==================== Error Handler ====================

/**
 * 错误处理中间件
 * 捕获下游中间件的错误，进行统一处理
 */
export const ErrorHandlerMiddleware: Middleware = {
  name: MIDDLEWARE_NAMES.ERROR_HANDLER,
  priority: 10,
  description: '统一错误处理',

  execute: async (ctx: MiddlewareContext, next: () => Promise<void>) => {
    try {
      await next();
    } catch (error) {
      console.error('[ErrorHandler] 捕获到错误:', error);

      const errorMessage = error instanceof Error ? error.message : String(error);

      // 分类处理不同类型的错误
      if (isAbortError(error)) {
        console.log('[ErrorHandler] 请求被用户中断');
        ctx.aborted = true;
        return; // 中断不算错误
      }

      if (isRateLimitError(error)) {
        ctx.error = new Error(`API请求频率超限，请稍后重试: ${errorMessage}`);
      } else if (isAuthError(error)) {
        ctx.error = new Error(`API认证失败，请检查密钥: ${errorMessage}`);
      } else if (isNetworkError(error)) {
        ctx.error = new Error(`网络连接失败: ${errorMessage}`);
      } else {
        ctx.error = error instanceof Error ? error : new Error(errorMessage);
      }

      // 发送错误Chunk
      if (ctx.onChunk) {
        await ctx.onChunk({
          type: ChunkType.ERROR,
          error: {
            message: ctx.error.message,
            type: getErrorType(error),
          },
        });
      }

      throw ctx.error;
    }
  },
};

// ==================== Abort Handler ====================

/**
 * 中断处理中间件
 * 监听AbortSignal，支持用户取消请求
 */
export const AbortHandlerMiddleware: Middleware = {
  name: MIDDLEWARE_NAMES.ABORT_HANDLER,
  priority: 20,
  description: '请求中断处理',

  execute: async (ctx: MiddlewareContext, next: () => Promise<void>) => {
    const { abortController } = ctx;

    if (!abortController) {
      return next();
    }

    // 检查是否已经中断
    if (abortController.signal.aborted) {
      console.log('[AbortHandler] 请求已被中断，跳过执行');
      ctx.aborted = true;
      return;
    }

    // 创建中断Promise
    const abortPromise = new Promise<never>((_, reject) => {
      const onAbort = () => {
        reject(new DOMException('请求被用户中断', 'AbortError'));
      };
      abortController.signal.addEventListener('abort', onAbort, { once: true });
    });

    try {
      // 竞速：要么正常完成，要么被中断
      await Promise.race([next(), abortPromise]);
    } catch (error) {
      if (isAbortError(error)) {
        console.log('[AbortHandler] 请求被用户中断');
        ctx.aborted = true;
      }
      throw error;
    }
  },
};

// ==================== Final Consumer ====================

/**
 * 最终消费者中间件
 * 消费Chunk流，累积结果，并通知上层
 */
export const FinalConsumerMiddleware: Middleware = {
  name: MIDDLEWARE_NAMES.FINAL_CONSUMER,
  priority: 0,
  description: '消费最终Chunk流并累积结果',

  execute: async (ctx: MiddlewareContext, next: () => Promise<void>) => {
    // 先执行下游中间件
    await next();

    // 如果有chunk流，消费它
    if (ctx.chunkStream) {
      for await (const chunk of ctx.chunkStream) {
        // 检查是否中断
        if (ctx.aborted) {
          break;
        }
        await processChunk(ctx, chunk);
      }
    }

    // 标记完成
    ctx.completed = true;

    // 发送完成信号
    if (ctx.onChunk && !ctx.aborted) {
      await ctx.onChunk({
        type: ChunkType.BLOCK_COMPLETE,
        response: {
          id: '',
          content: ctx.accumulated?.text || '',
        },
      });
    }
  },
};

// ==================== Logger Middleware ====================

/**
 * 日志中间件
 * 记录请求和响应信息
 */
export const LoggerMiddleware: Middleware = {
  name: MIDDLEWARE_NAMES.LOGGER,
  priority: 30,
  description: '请求响应日志',
  enabled: false, // 默认禁用

  execute: async (ctx: MiddlewareContext, next: () => Promise<void>) => {
    const startTime = Date.now();
    const { model, params } = ctx;

    console.log(`[Logger] 开始请求 - 模型: ${model?.id}, 消息数: ${params.messages?.length}`);

    try {
      await next();

      const duration = Date.now() - startTime;
      console.log(`[Logger] 请求完成 - 耗时: ${duration}ms, 文本长度: ${ctx.accumulated?.text?.length || 0}`);
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[Logger] 请求失败 - 耗时: ${duration}ms, 错误: ${error}`);
      throw error;
    }
  },
};

// ==================== Helper Functions ====================

async function processChunk(ctx: MiddlewareContext, chunk: Chunk): Promise<void> {
  // 累积数据
  switch (chunk.type) {
    case ChunkType.TEXT_DELTA:
    case ChunkType.TEXT_COMPLETE:
      if ('text' in chunk) {
        ctx.accumulated.text += chunk.text;
      }
      break;
    case ChunkType.THINKING_DELTA:
    case ChunkType.THINKING_COMPLETE:
      if ('text' in chunk) {
        ctx.accumulated.thinking = (ctx.accumulated.thinking || '') + chunk.text;
      }
      break;
  }

  // 通知上层
  if (ctx.onChunk) {
    await ctx.onChunk(chunk);
  }
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.message.includes('aborted'))
  );
}

function isRateLimitError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('rate limit') || message.includes('429');
}

function isAuthError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('401') ||
    message.includes('authentication') ||
    message.includes('invalid api key') ||
    message.includes('unauthorized')
  );
}

function isNetworkError(error: unknown): boolean {
  return error instanceof TypeError && error.message.includes('fetch');
}

function getErrorType(error: unknown): string {
  if (isAbortError(error)) return 'ABORTED';
  if (isRateLimitError(error)) return 'RATE_LIMIT';
  if (isAuthError(error)) return 'AUTH_ERROR';
  if (isNetworkError(error)) return 'NETWORK_ERROR';
  return 'UNKNOWN';
}

// ==================== Export All ====================

/**
 * 所有核心中间件
 */
export const coreMiddlewares: Middleware[] = [
  FinalConsumerMiddleware,
  ErrorHandlerMiddleware,
  AbortHandlerMiddleware,
  LoggerMiddleware,
];
