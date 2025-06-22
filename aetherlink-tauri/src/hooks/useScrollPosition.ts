import { useRef, useCallback, useEffect } from 'react';
import { throttle } from 'lodash';

/**
 * 滚动位置钩子
 * 用于保存和恢复滚动位置
 * @param key 唯一标识符，用于区分不同的滚动容器
 * @param options 配置选项
 * @returns 滚动容器引用和滚动处理函数
 */
export function useScrollPosition(
  key: string,
  options: {
    throttleTime?: number;
    autoRestore?: boolean;
    restoreDelay?: number;
    onScroll?: (position: number) => void;
  } = {}
) {
  const {
    throttleTime = 100,
    autoRestore = true,
    restoreDelay = 50,
    onScroll,
  } = options;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const scrollKey = `scroll:${key}`;

  // 保存滚动位置
  const saveScrollPosition = useCallback(
    (position: number) => {
      try {
        localStorage.setItem(scrollKey, position.toString());
      } catch (error) {
        console.error('保存滚动位置失败:', error);
      }
    },
    [scrollKey]
  );

  // 获取保存的滚动位置
  const getSavedScrollPosition = useCallback((): number => {
    try {
      const saved = localStorage.getItem(scrollKey);
      return saved ? parseInt(saved, 10) : 0;
    } catch (error) {
      console.error('获取滚动位置失败:', error);
      return 0;
    }
  }, [scrollKey]);

  // 处理滚动事件
  const handleScroll = useCallback(
    throttle(() => {
      if (!containerRef.current) return;

      const position = containerRef.current.scrollTop;

      // 保存滚动位置
      window.requestAnimationFrame(() => {
        saveScrollPosition(position);
      });

      // 调用外部滚动回调
      onScroll?.(position);
    }, throttleTime),
    [saveScrollPosition, throttleTime, onScroll]
  );

  // 恢复滚动位置
  const restoreScrollPosition = useCallback(() => {
    if (!containerRef.current) return;

    const savedPosition = getSavedScrollPosition();
    containerRef.current.scrollTop = savedPosition;
  }, [getSavedScrollPosition]);

  // 滚动到底部
  const scrollToBottom = useCallback(() => {
    if (!containerRef.current) return;

    // 使用 requestAnimationFrame 确保在下一帧渲染时滚动
    // 这样可以确保在DOM更新后滚动到底部
    window.requestAnimationFrame(() => {
      if (containerRef.current) {
        // 使用 scrollTo 方法，可以添加平滑滚动效果
        containerRef.current.scrollTo({
          top: containerRef.current.scrollHeight,
          behavior: 'auto' // 使用 'auto' 而不是 'smooth'，避免在流式输出时滚动延迟
        });
      }
    });
  }, []);

  // 滚动到顶部
  const scrollToTop = useCallback(() => {
    if (!containerRef.current) return;

    containerRef.current.scrollTop = 0;
  }, []);

  // 滚动到指定位置
  const scrollToPosition = useCallback((position: number) => {
    if (!containerRef.current) return;

    containerRef.current.scrollTop = position;
  }, []);

  // 自动恢复滚动位置
  useEffect(() => {
    if (autoRestore) {
      const timer = setTimeout(restoreScrollPosition, restoreDelay);
      return () => clearTimeout(timer);
    }
  }, [autoRestore, restoreScrollPosition, restoreDelay]);

  // 清理
  useEffect(() => {
    return () => {
      handleScroll.cancel();
    };
  }, [handleScroll]);

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
