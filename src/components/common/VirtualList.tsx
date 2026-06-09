import React, { useCallback, useRef } from 'react';
import { Box } from '@mui/material';
import { useVirtualizer } from '@tanstack/react-virtual';

interface VirtualListProps<T> {
  items: T[];
  /** 行高估值（首帧用），真实高度由 measureElement 动态测量，无需精确。 */
  estimateItemHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  itemKey: (item: T, index: number) => string | number;
  overscan?: number;
  height?: number | string;
  width?: number | string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * 基于 @tanstack/react-virtual 的虚拟列表。
 *
 * 相比自研的固定行高 VirtualScroller：
 * - 用 `measureElement` 动态测量每行真实高度，行内容换行/图标/状态变化都不会导致
 *   重叠或点击错位（根治固定 itemHeight 漂移问题）。
 * - estimateItemHeight 仅用于首帧估算，不要求精确。
 */
function VirtualList<T>({
  items,
  estimateItemHeight,
  renderItem,
  itemKey,
  overscan = 5,
  height = '100%',
  width = '100%',
  className,
  style,
}: VirtualListProps<T>) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const getScrollElement = useCallback(() => scrollRef.current, []);
  const estimateSize = useCallback(() => estimateItemHeight, [estimateItemHeight]);
  const getItemKey = useCallback(
    (index: number) => itemKey(items[index], index),
    [items, itemKey]
  );

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement,
    estimateSize,
    getItemKey,
    overscan,
  });

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <Box
      ref={scrollRef}
      className={`${className || ''} hide-scrollbar`.trim()}
      sx={{
        height,
        width,
        overflow: 'auto',
        position: 'relative',
        // 隐藏滚动条（与旧实现一致）
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        '&::-webkit-scrollbar': { display: 'none' },
        ...style,
      }}
    >
      <Box sx={{ height: virtualizer.getTotalSize(), width: '100%', position: 'relative' }}>
        {virtualItems.map((virtualItem) => (
          <div
            key={virtualItem.key}
            data-index={virtualItem.index}
            ref={virtualizer.measureElement}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            {renderItem(items[virtualItem.index], virtualItem.index)}
          </div>
        ))}
      </Box>
    </Box>
  );
}

export default React.memo(VirtualList) as <T>(props: VirtualListProps<T>) => React.ReactElement;
