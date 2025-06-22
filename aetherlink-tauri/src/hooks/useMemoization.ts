import { useCallback, useEffect, useRef, useState } from 'react';
import { isEqual } from 'lodash';

/**
 * 深度比较的useMemo
 * 只有当依赖项深度比较发生变化时才重新计算值
 * @param factory 工厂函数
 * @param deps 依赖项数组
 * @returns 记忆化的值
 */
export function useDeepMemo<T>(factory: () => T, deps: React.DependencyList): T {
  const ref = useRef<{ deps: React.DependencyList; value: T }>({
    deps: [],
    value: undefined as unknown as T,
  });

  if (!ref.current.value || !isEqual(deps, ref.current.deps)) {
    ref.current.deps = deps;
    ref.current.value = factory();
  }

  return ref.current.value;
}

/**
 * 深度比较的useCallback
 * 只有当依赖项深度比较发生变化时才重新创建回调函数
 * @param callback 回调函数
 * @param deps 依赖项数组
 * @returns 记忆化的回调函数
 */
export function useDeepCallback<T extends (...args: any[]) => any>(
  callback: T,
  deps: React.DependencyList
): T {
  return useDeepMemo(() => callback, deps);
}

/**
 * 防抖的useState
 * 在指定时间内只更新一次状态
 * @param initialState 初始状态
 * @param delay 延迟时间（毫秒）
 * @returns [状态, 设置状态函数]
 */
export function useDebounceState<T>(
  initialState: T | (() => T),
  delay: number = 300
): [T, (value: React.SetStateAction<T>) => void] {
  const [state, setState] = useState<T>(initialState);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const nextValueRef = useRef<React.SetStateAction<T> | null>(null);

  const debouncedSetState = useCallback(
    (value: React.SetStateAction<T>) => {
      nextValueRef.current = value;

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        setState(nextValueRef.current as React.SetStateAction<T>);
        nextValueRef.current = null;
        timeoutRef.current = null;
      }, delay);
    },
    [delay]
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return [state, debouncedSetState];
}

/**
 * 节流的useState
 * 在指定时间内最多更新一次状态
 * @param initialState 初始状态
 * @param limit 限制时间（毫秒）
 * @returns [状态, 设置状态函数]
 */
export function useThrottleState<T>(
  initialState: T | (() => T),
  limit: number = 300
): [T, (value: React.SetStateAction<T>) => void] {
  const [state, setState] = useState<T>(initialState);
  const lastRunRef = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const nextValueRef = useRef<React.SetStateAction<T> | null>(null);

  const throttledSetState = useCallback(
    (value: React.SetStateAction<T>) => {
      nextValueRef.current = value;
      const now = Date.now();

      if (now - lastRunRef.current >= limit) {
        // 如果已经超过限制时间，立即更新
        setState(nextValueRef.current as React.SetStateAction<T>);
        lastRunRef.current = now;
        nextValueRef.current = null;
      } else if (!timeoutRef.current) {
        // 如果没有超过限制时间，且没有设置定时器，设置定时器
        const remainingTime = limit - (now - lastRunRef.current);
        timeoutRef.current = setTimeout(() => {
          if (nextValueRef.current !== null) {
            setState(nextValueRef.current as React.SetStateAction<T>);
            lastRunRef.current = Date.now();
            nextValueRef.current = null;
          }
          timeoutRef.current = null;
        }, remainingTime);
      }
    },
    [limit]
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return [state, throttledSetState];
}

/**
 * 使用前一个值
 * @param value 当前值
 * @returns 前一个值
 */
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);

  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref.current;
}
