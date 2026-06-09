/**
 * React ⇄ SolidJS 桥接层（增强版）
 * 允许在 React 应用中嵌入 SolidJS 组件，支持响应式 Props 更新和状态保持
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { render } from 'solid-js/web';
import { createStore, unwrap } from 'solid-js/store';
import type { JSX } from 'solid-js';

// ==================== 类型定义 ====================

/** SolidJS 组件类型 - 接受 props 并返回 JSX.Element */
type SolidComponent<T = any> = (props: T) => JSX.Element;

interface SolidBridgeProps<T extends Record<string, any>> {
  /** SolidJS 组件 */
  component: SolidComponent<T>;
  /** 传递给 SolidJS 组件的 props（响应式） */
  props?: T;
  /** 容器样式 */
  style?: React.CSSProperties;
  /** 容器类名 */
  className?: string;
  /** 卸载时的回调 */
  onUnmount?: () => void;
  /** 自定义 props 比较函数（用于性能优化） */
  propsAreEqual?: (prev: T, next: T) => boolean;
  /** 是否启用调试模式 */
  debug?: boolean;
  /** 组件名称（用于调试） */
  debugName?: string;
  /** 错误回调 */
  onError?: (error: Error) => void;
}

// ==================== 工具函数 ====================

/**
 * 浅比较两个对象是否相等
 */
function shallowEqual<T extends Record<string, any>>(obj1: T, obj2: T): boolean {
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  if (keys1.length !== keys2.length) return false;

  for (const key of keys1) {
    if (obj1[key] !== obj2[key]) return false;
  }

  return true;
}

/**
 * 序列化对象，移除 SolidJS 代理包装
 * 用于确保从 SolidJS 传回 React 的数据是普通对象
 */
function serializeValue(value: any): any {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;
  // unwrap 只移除 Solid store 代理，保留 Date/函数/Map/Set 等原始结构
  try {
    return unwrap(value);
  } catch {
    return value;
  }
}

/**
 * 包装回调函数，自动序列化参数
 * 防止 SolidJS 代理对象传递到 React/Redux
 */
function wrapCallback(callback: (...args: any[]) => any): (...args: any[]) => any {
  return (...args: any[]) => {
    // 序列化所有参数，移除 SolidJS 代理
    const serializedArgs = args.map(serializeValue);
    return callback(...serializedArgs);
  };
}

// ==================== 核心桥接组件 ====================

/**
 * 增强版桥接组件：在 React 中渲染 SolidJS 组件
 * 
 * 🎯 核心特性：
 * - ✅ 响应式 Props 更新（不销毁组件状态）
 * - ✅ 智能性能优化（浅比较 + 自定义比较）
 * - ✅ 完善的错误处理
 * - ✅ 双向事件通信
 * - ✅ 开发模式调试
 * 
 * @example
 * ```tsx
 * import { SolidBridge } from '@/shared/bridges/SolidBridge';
 * import { MyPerformancePage } from '@/solid/pages/PerformancePage';
 * 
 * function ReactParent() {
 *   const [count, setCount] = useState(0);
 *   
 *   return (
 *     <SolidBridge
 *       component={MyPerformancePage}
 *       props={{ count, onIncrement: () => setCount(c => c + 1) }}
 *       debug
 *       debugName="PerformancePage"
 *     />
 *   );
 * }
 * ```
 */
export function SolidBridge<T extends Record<string, any>>({
  component: SolidComponentToRender,
  props = {} as T,
  style,
  className,
  onUnmount,
  propsAreEqual = shallowEqual,
  debug = false,
  debugName = 'SolidBridge',
  onError,
}: SolidBridgeProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const disposeRef = useRef<(() => void) | null>(null);
  const propsStoreRef = useRef<any>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isReady, setIsReady] = useState(false);
  const prevPropsRef = useRef<T>(props);
  const renderCountRef = useRef(0);

  // 调试日志
  const log = useCallback(
    (message: string, ...args: any[]) => {
      if (debug) {
        console.log(`[${debugName}]`, message, ...args);
      }
    },
    [debug, debugName]
  );

  // 错误处理
  const handleError = useCallback(
    (err: Error) => {
      console.error(`[${debugName}] 错误:`, err);
      // 出错时立即销毁 Solid 根，避免组件继续挂在游离 DOM 节点上
      if (disposeRef.current) {
        disposeRef.current();
        disposeRef.current = null;
      }
      propsStoreRef.current = null;
      setError(err);
      onError?.(err);
    },
    [debugName, onError]
  );

  // 初始化 SolidJS 组件（只执行一次）
  useEffect(() => {
    if (!containerRef.current) return;

    renderCountRef.current++;
    log(`初始化 SolidJS 组件 (渲染次数: ${renderCountRef.current})`);

    try {
      // 序列化并包装 props，防止 SolidJS 代理传递到 React/Redux
      const processedProps: any = {};
      for (const key in props) {
        const value = props[key];
        if (typeof value === 'function') {
          // 包装回调函数，自动序列化参数
          processedProps[key] = wrapCallback(value);
        } else {
          // 序列化非函数值，确保进入 Store 的是普通对象
          processedProps[key] = serializeValue(value);
        }
      }

      // 创建响应式 Store 来管理 props
      const [store, setStore] = createStore<T>(processedProps);
      propsStoreRef.current = { store, setStore };

      // 渲染 SolidJS 组件，传入响应式 store
      disposeRef.current = render(() => {
        try {
          return SolidComponentToRender(propsStoreRef.current.store as T);
        } catch (err) {
          handleError(err as Error);
          return null;
        }
      }, containerRef.current);

      setIsReady(true);
      log('SolidJS 组件渲染成功');
    } catch (err) {
      handleError(err as Error);
    }

    // 清理函数
    return () => {
      log('卸载 SolidJS 组件');
      if (disposeRef.current) {
        disposeRef.current();
        disposeRef.current = null;
      }
      propsStoreRef.current = null;
      onUnmount?.();
      setIsReady(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [SolidComponentToRender]); // 只在组件类型变化时重新初始化

  // 响应式更新 props（不销毁组件）
  useEffect(() => {
    if (!isReady || !propsStoreRef.current) return;

    const { setStore } = propsStoreRef.current;
    const prevProps = prevPropsRef.current;

    // 使用自定义或默认的比较函数
    if (propsAreEqual(prevProps, props)) {
      log('Props 未变化，跳过更新');
      return;
    }

    log('响应式更新 Props', { prev: prevProps, next: props });

    try {
      // 批量更新所有变化的 props，序列化并包装
      const updates: any = {};
      for (const key in props) {
        if (props[key] !== prevProps[key]) {
          const value = props[key];
          if (typeof value === 'function') {
            // 包装回调函数
            updates[key] = wrapCallback(value);
          } else {
            // 序列化非函数值
            updates[key] = serializeValue(value);
          }
          if (debug) {
            const fmt = (v: any) => typeof v === 'function' ? `[Function ${v.name || 'anonymous'}]` : Array.isArray(v) ? `[Array(${v.length})]` : v;
            log(`  - ${key}:`, fmt(prevProps[key]), '→', fmt(props[key]));
          }
        }
      }

      // 删除不再存在的 props
      for (const key in prevProps) {
        if (!(key in props)) {
          updates[key] = undefined as any;
          if (debug) {
            log(`  - ${key}: 已删除`);
          }
        }
      }

      setStore(updates);
      prevPropsRef.current = props;
    } catch (err) {
      handleError(err as Error);
    }
  }, [props, isReady, propsAreEqual, debug, log, handleError]);

  // 错误展示
  if (error) {
    return (
      <div
        className={className}
        style={{
          ...style,
          padding: '20px',
          backgroundColor: '#fee',
          border: '2px solid #c33',
          borderRadius: '8px',
          color: '#c33',
        }}
      >
        <h3 style={{ margin: '0 0 10px 0' }}>❌ SolidJS 组件错误</h3>
        <p style={{ margin: 0, fontSize: '14px' }}>
          <strong>{debugName}:</strong> {error.message}
        </p>
        {debug && (
          <pre
            style={{
              marginTop: '10px',
              padding: '10px',
              backgroundColor: '#fff',
              border: '1px solid #c33',
              borderRadius: '4px',
              fontSize: '12px',
              overflow: 'auto',
            }}
          >
            {error.stack}
          </pre>
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={className}
      style={style}
      data-solid-bridge="true"
      data-solid-bridge-name={debugName}
      data-solid-bridge-ready={isReady}
    />
  );
}
