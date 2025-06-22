/**
 * AbortController 工具类
 * 用于管理和中断异步操作，特别是流式响应
 */

// 存储所有活动的中断函数
export const abortMap = new Map<string, (() => void)[]>();

/**
 * 添加中断控制器
 * @param id 唯一标识符（通常是消息ID或askId）
 * @param abortFn 中断函数
 */
export const addAbortController = (id: string, abortFn: () => void) => {
  abortMap.set(id, [...(abortMap.get(id) || []), abortFn]);
};

/**
 * 移除中断控制器
 * @param id 唯一标识符
 * @param abortFn 要移除的中断函数
 */
export const removeAbortController = (id: string, abortFn: () => void) => {
  const callbackArr = abortMap.get(id);
  if (abortFn) {
    callbackArr?.splice(callbackArr?.indexOf(abortFn), 1);
  } else {
    abortMap.delete(id);
  }
};

/**
 * 中断指定ID的所有操作
 * @param id 唯一标识符
 */
export const abortCompletion = (id: string) => {
  const abortFns = abortMap.get(id);
  if (abortFns?.length) {
    for (const fn of [...abortFns]) {
      try {
        fn();
        removeAbortController(id, fn);
      } catch (error) {
        // 静默处理中断错误，避免控制台错误
        if (!isAbortError(error)) {
          console.error('执行中断函数时出错:', error);
        }
      }
    }
  }
};

/**
 * 创建带有中断功能的Promise
 * @param signal AbortSignal
 * @param finallyPromise 最终的Promise
 * @returns 可中断的Promise
 */
export function createAbortPromise(signal: AbortSignal, finallyPromise: Promise<string>) {
  return new Promise<string>((_resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Operation aborted', 'AbortError'));
      return;
    }

    const abortHandler = (e: Event) => {
      console.log('[createAbortPromise] abortHandler', e);
      reject(new DOMException('Operation aborted', 'AbortError'));
    };

    signal.addEventListener('abort', abortHandler, { once: true });

    finallyPromise.finally(() => {
      signal.removeEventListener('abort', abortHandler);
    });
  });
}

/**
 * 创建AbortController和相关的清理函数
 * @param messageId 消息ID
 * @param isAddEventListener 是否添加事件监听器
 * @returns AbortController相关对象
 */
export function createAbortController(messageId?: string, isAddEventListener?: boolean) {
  const abortController = new AbortController();
  const abortFn = () => abortController.abort();

  if (messageId) {
    addAbortController(messageId, abortFn);
  }

  const cleanup = () => {
    if (messageId) {
      signalPromise.resolve?.(undefined);
      removeAbortController(messageId, abortFn);
    }
  };

  const signalPromise: {
    resolve: (value: unknown) => void;
    promise: Promise<unknown>;
  } = {
    resolve: () => {},
    promise: Promise.resolve()
  };

  if (isAddEventListener) {
    signalPromise.promise = new Promise((resolve, reject) => {
      signalPromise.resolve = resolve;
      if (abortController.signal.aborted) {
        reject(new DOMException('Operation aborted', 'AbortError'));
      }
      // 捕获abort事件
      abortController.signal.addEventListener('abort', () => {
        reject(new DOMException('Operation aborted', 'AbortError'));
      });
    });

    // 添加错误处理，避免未捕获的 Promise 错误
    signalPromise.promise.catch(error => {
      // 静默处理中断错误，避免控制台错误
      if (isAbortError(error)) {
        console.log('[AbortController] 请求被用户中断');
        return null;
      }
      // 对于非中断错误，记录但不重新抛出
      console.error('[AbortController] 非中断错误:', error);
      return null;
    });

    return {
      abortController,
      cleanup,
      signalPromise
    };
  }

  return {
    abortController,
    cleanup
  };
}

/**
 * 检查错误是否为中断错误
 * @param error 错误对象
 * @returns 是否为中断错误
 */
export function isAbortError(error: any): boolean {
  return error?.name === 'AbortError' ||
         error?.message?.includes('aborted') ||
         error?.message?.includes('Request was aborted') ||
         error?.message?.includes('Operation aborted');
}
