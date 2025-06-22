import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { Box } from '@mui/material';

interface VirtualScrollerProps<T> {
  items: T[];
  itemHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  overscanCount?: number;
  height?: number | string;
  width?: number | string;
  onScroll?: (event: React.UIEvent<HTMLDivElement>) => void;
  className?: string;
  style?: React.CSSProperties;
  itemKey?: (item: T, index: number) => string | number;
}

/**
 * 虚拟滚动组件
 * 用于高效渲染大量数据，只渲染可见区域的内容
 */
function VirtualScroller<T>({
  items,
  itemHeight,
  renderItem,
  overscanCount = 3,
  height = '100%',
  width = '100%',
  onScroll,
  className,
  style,
  itemKey = (_, index) => index,
}: VirtualScrollerProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  // 使用 useMemo 缓存计算结果，避免每次渲染都重新计算
  const { startIndex, visibleItems, totalHeight, offsetY } = useMemo(() => {
    // 计算可见区域的起始和结束索引
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscanCount);
    const end = Math.min(
      items.length - 1,
      Math.floor((scrollTop + containerHeight) / itemHeight) + overscanCount
    );

    // 计算可见项目
    const visible = items.slice(start, end + 1);

    // 计算内容总高度
    const total = items.length * itemHeight;

    // 计算可见内容的偏移量
    const offset = start * itemHeight;

    return {
      startIndex: start,
      visibleItems: visible,
      totalHeight: total,
      offsetY: offset
    };
  }, [scrollTop, containerHeight, itemHeight, overscanCount, items]);

  // 处理滚动事件 - 优化版本，减少节流开销
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    // 检查事件对象和目标元素是否存在
    if (!e || !e.currentTarget) {
      return;
    }

    const scrollTop = e.currentTarget.scrollTop;

    // 使用requestAnimationFrame代替throttle，更适合滚动优化
    requestAnimationFrame(() => {
      setScrollTop(scrollTop);
      onScroll?.(e);
    });
  }, [onScroll]);

  // 测量容器高度
  useEffect(() => {
    if (containerRef.current) {
      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.target === containerRef.current) {
            setContainerHeight(entry.contentRect.height);
          }
        }
      });

      resizeObserver.observe(containerRef.current);
      setContainerHeight(containerRef.current.clientHeight);

      return () => {
        if (containerRef.current) {
          resizeObserver.unobserve(containerRef.current);
        }
      };
    }
  }, []);

  return (
    <Box
      ref={containerRef}
      className={`${className || ''} hide-scrollbar`}
      sx={{
        height,
        width,
        overflow: 'auto',
        position: 'relative',
        // 隐藏滚动条样式 - 与助手列表保持一致
        scrollbarWidth: 'none', // Firefox
        msOverflowStyle: 'none', // IE/Edge
        '&::-webkit-scrollbar': {
          display: 'none', // WebKit浏览器
        },
        ...style,
      }}
      onScroll={handleScroll}
    >
      <Box sx={{ height: totalHeight, position: 'relative' }}>
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            // 使用transform3d启用硬件加速，提升性能
            transform: `translate3d(0, ${offsetY}px, 0)`,
            // 添加will-change提示浏览器优化
            willChange: 'transform',
          }}
        >
          {visibleItems.map((item, index) => {
            const actualIndex = startIndex + index;
            return (
              <Box
                key={itemKey(item, actualIndex)}
                sx={{
                  height: itemHeight,
                  boxSizing: 'border-box',
                  // 启用硬件加速
                  transform: 'translateZ(0)',
                  // 减少重排
                  contain: 'layout style paint',
                }}
              >
                {renderItem(item, actualIndex)}
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}

export default React.memo(VirtualScroller) as <T>(props: VirtualScrollerProps<T>) => React.ReactElement;
