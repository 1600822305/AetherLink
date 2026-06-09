import React, { useCallback, useMemo, useRef } from 'react';
import { Box } from '@mui/material';
import { useVirtualizer, defaultRangeExtractor } from '@tanstack/react-virtual';
import type { Range } from '@tanstack/react-virtual';

export interface GroupedVirtualListProps {
  /** 扁平化后的总行数（分组头 + 列表项 + 标题/空态行）。 */
  count: number;
  /** 行高估值（首帧用），真实高度由 measureElement 动态测量，不要求精确。 */
  estimateSize: (index: number) => number;
  getKey: (index: number) => string | number;
  renderRow: (index: number) => React.ReactNode;
  /** 返回 true 的行作为吸顶头：滚动时当前所属分组头固定在容器顶部。 */
  isStickyHeader: (index: number) => boolean;
  overscan?: number;
  height?: number | string;
  width?: number | string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * 带吸顶分组头的单容器虚拟列表（基于 @tanstack/react-virtual）。
 *
 * - 把"分组区 + 未分组列表"合并成**一个滚动容器、一个虚拟器**，取代过去
 *   多层嵌套滚动（每个 Accordion 内置 300px 滚动 + 外层 calc(100vh-400px)）。
 * - 通过 measureElement 动态测量每行真实高度，行高自适应。
 * - 通过 rangeExtractor 始终把"当前可视区顶部所属的分组头"纳入渲染范围，
 *   并以 position:sticky 固定在顶部，实现分组头吸顶。
 */
function GroupedVirtualList({
  count,
  estimateSize,
  getKey,
  renderRow,
  isStickyHeader,
  overscan = 8,
  height = '100%',
  width = '100%',
  className,
  style,
}: GroupedVirtualListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // 升序的吸顶头索引列表
  const stickyIndexes = useMemo(() => {
    const arr: number[] = [];
    for (let i = 0; i < count; i++) {
      if (isStickyHeader(i)) arr.push(i);
    }
    return arr;
  }, [count, isStickyHeader]);

  const activeStickyIndexRef = useRef<number>(-1);

  const getScrollElement = useCallback(() => scrollRef.current, []);

  const rangeExtractor = useCallback(
    (range: Range) => {
      // 当前可视区顶部所属分组头 = 不大于 startIndex 的最大吸顶索引
      let active = -1;
      for (let i = 0; i < stickyIndexes.length; i++) {
        if (stickyIndexes[i] <= range.startIndex) active = stickyIndexes[i];
        else break;
      }
      activeStickyIndexRef.current = active;

      const set = new Set<number>(defaultRangeExtractor(range));
      if (active >= 0) set.add(active);
      return Array.from(set).sort((a, b) => a - b);
    },
    [stickyIndexes]
  );

  const virtualizer = useVirtualizer({
    count,
    getScrollElement,
    estimateSize,
    getItemKey: getKey,
    overscan,
    rangeExtractor,
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
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        '&::-webkit-scrollbar': { display: 'none' },
        ...style,
      }}
    >
      <Box sx={{ height: virtualizer.getTotalSize(), width: '100%', position: 'relative' }}>
        {virtualItems.map((virtualItem) => {
          const active = activeStickyIndexRef.current === virtualItem.index;
          return (
            <div
              key={virtualItem.key}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              style={
                active
                  ? {
                      position: 'sticky',
                      top: 0,
                      left: 0,
                      zIndex: 2,
                      width: '100%',
                    }
                  : {
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualItem.start}px)`,
                    }
              }
            >
              {renderRow(virtualItem.index)}
            </div>
          );
        })}
      </Box>
    </Box>
  );
}

export default React.memo(GroupedVirtualList);
