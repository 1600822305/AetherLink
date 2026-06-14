/**
 * React → SolidJS 状态同步工具
 * 用于在 React 和 SolidJS 之间共享状态
 */

import { createSignal, createEffect, onCleanup } from 'solid-js';
import { createLogger } from '../services/infra/logger';

const logger = createLogger('ReactSolidBridge');

/**
 * 创建一个可以从 React 外部更新的 SolidJS Signal
 * 
 * @example
 * ```tsx
 * // React 侧
 * const [count, setCount] = useState(0);
 * const { signal, updateFromReact } = createReactSyncedSignal(count);
 * 
 * useEffect(() => {
 *   updateFromReact(count);
 * }, [count]);
 * 
 * // 在 SolidJS 中使用 signal
 * <SolidBridge component={MySolidComp} props={{ countSignal: signal }} />
 * ```
 */
export function createReactSyncedSignal<T>(initialValue: T) {
  const [signal, setSignal] = createSignal<T>(initialValue);
  
  return {
    signal,
    updateFromReact: setSignal,
  };
}

/**
 * 创建事件总线，用于 React 和 SolidJS 之间的通信
 */
export class ReactSolidEventBus {
  private listeners = new Map<string, Set<(data: any) => void>>();

  /**
   * 订阅事件（在 SolidJS 中使用）
   */
  on<T = any>(event: string, handler: (data: T) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);

    // 返回取消订阅函数
    return () => {
      this.listeners.get(event)?.delete(handler);
    };
  }

  /**
   * 发送事件（在 React 中使用）
   */
  emit<T = any>(event: string, data?: T): void {
    this.listeners.get(event)?.forEach((handler) => {
      try {
        handler(data);
      } catch (error) {
        logger.error(`事件处理失败 (${event}):`, error);
      }
    });
  }

  /**
   * 清除所有监听器
   */
  clear(): void {
    this.listeners.clear();
  }
}

/**
 * 创建可以在 SolidJS 中使用的 Redux store 订阅
 * 
 * @example
 * ```tsx
 * // 在 SolidJS 组件中
 * const [reduxState, setReduxState] = createSignal(initialState);
 * 
 * createReduxSubscription(store, (state) => state.messages, setReduxState);
 * ```
 */
export function createReduxSubscription<TState, TSelected>(
  store: { subscribe: (listener: () => void) => () => void; getState: () => TState },
  selector: (state: TState) => TSelected,
  setter: (value: TSelected) => void
): void {
  let previousValue = selector(store.getState());
  setter(previousValue);

  const unsubscribe = store.subscribe(() => {
    const currentValue = selector(store.getState());
    if (currentValue !== previousValue) {
      previousValue = currentValue;
      setter(currentValue);
    }
  });

  // SolidJS 清理
  onCleanup(unsubscribe);
}

/**
 * 将 React 的 Context 值传递给 SolidJS
 */
export function createContextBridge<T>(contextValue: T) {
  const [signal, setSignal] = createSignal<T>(contextValue);
  
  return {
    signal,
    update: setSignal,
  };
}

