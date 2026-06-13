/**
 * 虚拟化的模型分组列表
 *
 * 将「分组标题 + 模型行」拍平成一维行，基于 @tanstack/react-virtual 做窗口化渲染，
 * 渲染成本只与可视区行数相关，与模型总数无关（几百个模型也只渲染十几行 DOM）。
 *
 * 特性：
 * - 粘性分组标题（sticky header），滚动时当前组标题固定在顶部
 * - 变高行实测（measureElement），长模型名换行也不会被裁剪
 * - 内置搜索框：输入即过滤，命中模型时其所在分组自动展开
 * - 行级渲染交给外部 renderModelItem（配合 React.memo 降低重渲染成本）
 */

import React, { memo, useCallback, useDeferredValue, useMemo, useRef, useState } from 'react';
import {
  Box,
  Typography,
  Chip,
  TextField,
  InputAdornment,
  useTheme,
  alpha
} from '@mui/material';
import { ChevronDown, Search } from 'lucide-react';
import { useVirtualizer, defaultRangeExtractor, type Range } from '@tanstack/react-virtual';
import { useTranslation } from 'react-i18next';
import type { Model } from '../../shared/types';

export interface VirtualizedModelGroupListProps {
  /** 分组数据，格式 [[groupName, models[]], ...] */
  modelGroups: [string, Model[]][];
  /** 是否显示空状态 */
  showEmptyState?: boolean;
  /** 空状态文案 */
  emptyStateKey?: string;
  /** 渲染单个模型项 */
  renderModelItem?: (model: Model, index: number) => React.ReactNode;
  /** 渲染分组标题右侧按钮（如删除整组） */
  renderGroupButton?: (groupName: string, models: Model[]) => React.ReactNode;
  /** 默认展开的分组 */
  defaultExpanded?: string[];
  /** 分组展开状态变化回调 */
  onExpansionChange?: (groupName: string, expanded: boolean) => void;
  /** 是否启用搜索框，默认 true */
  enableSearch?: boolean;
  /** 搜索框 placeholder */
  searchPlaceholder?: string;
  /** 滚动容器最大高度，默认 '70vh' */
  maxHeight?: number | string;
  /** 是否给滚动容器加边框，默认 true（对话框等已有容器时可传 false） */
  bordered?: boolean;
  /** 是否在滚动容器底部预留移动端安全区（home indicator），默认 false */
  safeAreaBottom?: boolean;
  /** 行高估算（变高时仅作为初始估算），默认 56 */
  estimateRowHeight?: number;
  /** overscan 行数，默认 8 */
  overscan?: number;
}

type FlatRow =
  | { kind: 'header'; groupName: string; models: Model[]; expanded: boolean }
  | { kind: 'model'; groupName: string; model: Model; indexInGroup: number };

const GroupHeaderRow = memo<{
  groupName: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  button?: React.ReactNode;
}>(({ groupName, count, expanded, onToggle, button }) => {
  const theme = useTheme();
  return (
    <Box
      onClick={onToggle}
      sx={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: { xs: 2, sm: 1.5 },
        minHeight: { xs: 48, sm: 44 },
        px: { xs: 2, sm: 1.5 },
        py: { xs: 1, sm: 0.75 },
        pr: button ? { xs: 6.5, sm: 5.5 } : { xs: 2, sm: 1.5 },
        cursor: 'pointer',
        userSelect: 'none',
        // 轻量 section 行：极淡底色 + 仅底部分隔线，区别于模型行又不厚重
        bgcolor: theme.palette.mode === 'dark'
          ? alpha(theme.palette.common.white, 0.04)
          : alpha(theme.palette.common.black, 0.022),
        borderBottom: '1px solid',
        borderColor: 'divider',
        '&:hover': {
          bgcolor: theme.palette.mode === 'dark'
            ? alpha(theme.palette.common.white, 0.07)
            : alpha(theme.palette.common.black, 0.045)
        }
      }}
    >
      <ChevronDown
        size={18}
        style={{
          flexShrink: 0,
          transition: 'transform 0.2s ease',
          transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)'
        }}
      />
      <Typography
        variant="subtitle2"
        sx={{
          fontWeight: 600,
          color: 'text.primary',
          fontSize: { xs: '0.95rem', sm: '0.875rem' },
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}
      >
        {groupName}
      </Typography>
      <Chip
        label={count}
        size="small"
        sx={{
          height: { xs: 22, sm: 20 },
          fontSize: { xs: '0.72rem', sm: '0.7rem' },
          fontWeight: 600,
          bgcolor: alpha(theme.palette.success.main, 0.12),
          color: 'success.main',
          '& .MuiChip-label': { px: { xs: 1.25, sm: 1 } }
        }}
      />
      {button && (
        <Box
          onClick={(e) => e.stopPropagation()}
          sx={{
            position: 'absolute',
            right: { xs: 2, sm: 1.5 },
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 1
          }}
        >
          {button}
        </Box>
      )}
    </Box>
  );
});
GroupHeaderRow.displayName = 'GroupHeaderRow';

const DefaultModelItem = memo<{ model: Model }>(({ model }) => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        py: 1,
        px: 1.5,
        '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.05) }
      }}
    >
      <Typography variant="body2" sx={{ fontWeight: 500 }}>
        {model.name || model.id}
      </Typography>
    </Box>
  );
});
DefaultModelItem.displayName = 'DefaultModelItem';

function VirtualizedModelGroupList({
  modelGroups,
  showEmptyState = true,
  emptyStateKey = 'models.no_models',
  renderModelItem = (model) => <DefaultModelItem model={model} />,
  renderGroupButton,
  defaultExpanded = [],
  onExpansionChange,
  enableSearch = true,
  searchPlaceholder,
  maxHeight = '70vh',
  bordered = true,
  safeAreaBottom = false,
  estimateRowHeight = 56,
  overscan = 8
}: VirtualizedModelGroupListProps) {
  const { t } = useTranslation();
  const parentRef = useRef<HTMLDivElement>(null);

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => new Set(defaultExpanded)
  );

  const [rawQuery, setRawQuery] = useState('');
  const query = useDeferredValue(rawQuery);
  const normalizedQuery = query.trim().toLowerCase();
  const isSearching = normalizedQuery.length > 0;

  const handleToggle = useCallback(
    (groupName: string) => {
      setExpandedGroups((prev) => {
        const next = new Set(prev);
        const wasExpanded = prev.has(groupName);
        if (wasExpanded) {
          next.delete(groupName);
        } else {
          next.add(groupName);
        }
        onExpansionChange?.(groupName, !wasExpanded);
        return next;
      });
    },
    [onExpansionChange]
  );

  // 根据搜索词过滤分组（命中模型保留其所在分组）
  const filteredGroups = useMemo<[string, Model[]][]>(() => {
    if (!isSearching) return modelGroups;
    const result: [string, Model[]][] = [];
    for (const [groupName, models] of modelGroups) {
      const matched = models.filter((m) => {
        const name = (m.name || '').toLowerCase();
        const id = (m.id || '').toLowerCase();
        return name.includes(normalizedQuery) || id.includes(normalizedQuery);
      });
      if (matched.length > 0) result.push([groupName, matched]);
    }
    return result;
  }, [modelGroups, isSearching, normalizedQuery]);

  // 拍平为一维行
  const rows = useMemo<FlatRow[]>(() => {
    const flat: FlatRow[] = [];
    for (const [groupName, models] of filteredGroups) {
      // 搜索时强制展开所有命中分组
      const expanded = isSearching || expandedGroups.has(groupName);
      flat.push({ kind: 'header', groupName, models, expanded });
      if (expanded) {
        models.forEach((model, indexInGroup) => {
          flat.push({ kind: 'model', groupName, model, indexInGroup });
        });
      }
    }
    return flat;
  }, [filteredGroups, expandedGroups, isSearching]);

  const stickyIndexes = useMemo(() => {
    const indexes: number[] = [];
    rows.forEach((row, i) => {
      if (row.kind === 'header') indexes.push(i);
    });
    return indexes;
  }, [rows]);

  const activeStickyIndexRef = useRef(0);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => (rows[index].kind === 'header' ? 48 : estimateRowHeight),
    overscan,
    getItemKey: (index) => {
      const row = rows[index];
      return row.kind === 'header' ? `h:${row.groupName}` : `m:${row.groupName}:${row.model.id}`;
    },
    rangeExtractor: useCallback(
      (range: Range) => {
        const active =
          [...stickyIndexes].reverse().find((i) => range.startIndex >= i) ?? 0;
        activeStickyIndexRef.current = active;
        const next = new Set([active, ...defaultRangeExtractor(range)]);
        return [...next].sort((a, b) => a - b);
      },
      [stickyIndexes]
    )
  });

  const virtualItems = virtualizer.getVirtualItems();

  const isHeaderIndex = useCallback(
    (index: number) => rows[index]?.kind === 'header',
    [rows]
  );

  if (showEmptyState && modelGroups.length === 0) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          py: 4,
          minHeight: 80
        }}
      >
        <Typography variant="body2" color="text.secondary">
          {emptyStateKey}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      {enableSearch && (
        <TextField
          fullWidth
          size="small"
          value={rawQuery}
          onChange={(e) => setRawQuery(e.target.value)}
          placeholder={searchPlaceholder ?? t('modelSettings.provider.searchModels', '搜索模型...')}
          sx={{ mb: 1.5 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search size={18} />
              </InputAdornment>
            )
          }}
        />
      )}

      {isSearching && rows.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="body2" color="text.secondary">
            {t('modelSettings.provider.noModelsFound', '没有匹配的模型')}
          </Typography>
        </Box>
      ) : (
        <Box
          ref={parentRef}
          sx={{
            maxHeight,
            overflowY: 'auto',
            overflowX: 'hidden',
            ...(bordered
              ? { border: '1px solid', borderColor: 'divider', borderRadius: 2 }
              : {}),
            // 移动端：底部预留安全区，避免最后一行被 home indicator 遮挡
            ...(safeAreaBottom ? { pb: 'var(--safe-area-bottom-computed, 0px)' } : {}),
            bgcolor: 'background.paper',
            // iOS 惯性滚动
            WebkitOverflowScrolling: 'touch'
          }}
        >
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative'
            }}
          >
            {virtualItems.map((virtualItem) => {
              const row = rows[virtualItem.index];
              const header = isHeaderIndex(virtualItem.index);
              const active = header && activeStickyIndexRef.current === virtualItem.index;

              return (
                <div
                  key={virtualItem.key}
                  data-index={virtualItem.index}
                  ref={virtualizer.measureElement}
                  style={{
                    left: 0,
                    width: '100%',
                    ...(header ? { zIndex: 2 } : { zIndex: 1 }),
                    ...(active
                      ? { position: 'sticky', top: 0 }
                      : {
                          position: 'absolute',
                          top: 0,
                          transform: `translateY(${virtualItem.start}px)`
                        })
                  }}
                >
                  {row.kind === 'header' ? (
                    <GroupHeaderRow
                      groupName={row.groupName}
                      count={row.models.length}
                      expanded={row.expanded}
                      onToggle={() => handleToggle(row.groupName)}
                      button={renderGroupButton?.(row.groupName, row.models)}
                    />
                  ) : (
                    renderModelItem(row.model, row.indexInGroup)
                  )}
                </div>
              );
            })}
          </div>
        </Box>
      )}
    </Box>
  );
}

export default memo(VirtualizedModelGroupList);
