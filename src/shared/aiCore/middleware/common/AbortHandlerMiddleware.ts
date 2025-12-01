/**
 * 中止处理中间件
 * 对标 Cherry Studio AbortHandlerMiddleware
 */
import type { CompletionsMiddleware } from '../types';
import type { CompletionsResult } from '../schemas';

export const MIDDLEWARE_NAME = 'AbortHandlerMiddleware';

/**
 * 中止处理中间件
 * 监听 AbortSignal，支持用户取消请求
 */
export const AbortHandlerMiddleware: CompletionsMiddleware = (_api) => (next) =>
  async (context, params): Promise<CompletionsResult> => {
    const { abortSignal } = params;

    // 如果没有 abort signal，直接执行
    if (!abortSignal) {
      return next(context, params);
    }

    // 检查是否已经中止
    if (abortSignal.aborted) {
      console.log('[AbortHandlerMiddleware] Request already aborted');
      if (context._internal.flowControl) {
        context._internal.flowControl.aborted = true;
      }
      return {
        getText: () => '',
        getReasoning: () => undefined,
      };
    }

    // 保存 signal 到 flowControl
    if (!context._internal.flowControl) {
      context._internal.flowControl = {};
    }
    context._internal.flowControl.abortSignal = abortSignal;

    // 创建中止 Promise
    const abortPromise = new Promise<never>((_, reject) => {
      const onAbort = () => {
        reject(new DOMException('Request aborted by user', 'AbortError'));
      };
      abortSignal.addEventListener('abort', onAbort, { once: true });
    });

    try {
      // 竞速：要么正常完成，要么被中止
      return await Promise.race([
        next(context, params),
        abortPromise,
      ]);
    } catch (error) {
      // 检查是否为中止错误
      if (error instanceof DOMException && error.name === 'AbortError') {
        console.log('[AbortHandlerMiddleware] Request aborted');
        if (context._internal.flowControl) {
          context._internal.flowControl.aborted = true;
        }
      }
      throw error;
    }
  };
