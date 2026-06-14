import { useRef, useCallback, useEffect, useMemo, useLayoutEffect } from 'react';
import { throttle } from 'lodash';
import { createLogger } from '../shared/services/infra/logger';

const logger = createLogger('useScrollPosition');

interface UseScrollPositionOptions {
  throttleTime?: number;
  autoRestore?: boolean;
  /** @deprecated 自动恢复已改用 useLayoutEffect 同步恢复，此项不再生效，仅为兼容调用方保留 */
  restoreDelay?: number;
  onScroll?: (position: number) => void;
}

/**
 * 滚动位置钩子 - 用于保存和恢复滚动位置
 * @param key 唯一标识符，用于区分不同的滚动容器
 * @param options 配置选项
 */
export function useScrollPosition(key: string, options: UseScrollPositionOptions = {}) {
  const {
    throttleTime = 100,
    autoRestore = true,
    onScroll,
  } = options;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const scrollKey = useMemo(() => `scroll:${key}`, [key]);

  // 🚀 性能优化：使用 ref 缓存上次保存的位置，避免重复写入
  const lastSavedPosition = useRef<number>(-1);

  // 保存滚动位置到 localStorage
  const saveScrollPosition = useCallback((position: number) => {
    // 只有位置变化超过 10px 才保存，减少写入频率
    if (Math.abs(position - lastSavedPosition.current) < 10) {
      return;
    }

    try {
      localStorage.setItem(scrollKey, position.toString());
      lastSavedPosition.current = position;
    } catch (error) {
      logger.error('保存滚动位置失败:', error);
    }
  }, [scrollKey]);

  // 从 localStorage 获取保存的滚动位置
  const getSavedScrollPosition = useCallback((): number => {
    try {
      const saved = localStorage.getItem(scrollKey);
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  }, [scrollKey]);

  // 🚀 性能优化：处理滚动事件（节流 + RAF）
  const handleScroll = useMemo(
    () =>
      throttle(() => {
        const container = containerRef.current;
        if (!container) return;

        const position = container.scrollTop;
        // 使用 RAF 确保在浏览器空闲时保存，不阻塞滚动
        requestAnimationFrame(() => {
          saveScrollPosition(position);
          onScroll?.(position);
        });
      }, throttleTime),
    [throttleTime, saveScrollPosition, onScroll]
  );

  // 恢复滚动位置
  const restoreScrollPosition = useCallback(() => {
    const container = containerRef.current;
    if (container) {
      container.scrollTop = getSavedScrollPosition();
    }
  }, [getSavedScrollPosition]);

  // 滚动方法
  const scrollToBottom = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    requestAnimationFrame(() => {
      if (containerRef.current) {
        containerRef.current.scrollTo({
          top: containerRef.current.scrollHeight,
          behavior: 'auto',
        });
      }
    });
  }, []);

  const scrollToTop = useCallback(() => {
    const container = containerRef.current;
    if (container) {
      container.scrollTop = 0;
    }
  }, []);

  const scrollToPosition = useCallback((position: number) => {
    const container = containerRef.current;
    if (container) {
      container.scrollTop = position;
    }
  }, []);

  // 自动恢复滚动位置（使用 useLayoutEffect 在浏览器绘制前恢复，避免闪烁）
  useLayoutEffect(() => {
    if (autoRestore && containerRef.current) {
      // 直接设置滚动位置，不使用延迟，在浏览器绘制前完成
      const savedPosition = getSavedScrollPosition();
      containerRef.current.scrollTop = savedPosition;
    }
  }, [autoRestore, getSavedScrollPosition]);

  // 清理节流函数
  useEffect(() => () => handleScroll.cancel(), [handleScroll]);

  return {
    containerRef,
    handleScroll,
    scrollToBottom,
    scrollToTop,
    scrollToPosition,
    restoreScrollPosition,
    saveScrollPosition,
    getSavedScrollPosition,
  };
}

export default useScrollPosition;
