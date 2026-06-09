import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  TextField,
  InputAdornment,
  IconButton,
  Typography,
  Divider,
  Chip,
  CircularProgress,
  ToggleButton,
  ToggleButtonGroup,
  Stack,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { Search, X, Clock } from 'lucide-react';
import dayjs from 'dayjs';
import BackButtonDialog from '../common/BackButtonDialog';
import { useChatSearch } from '../../shared/hooks/useChatSearch';
import type { SearchHit, SearchMode } from '../../shared/services/search/types';
import SearchResultItem from './SearchResultItem';

interface ChatSearchInterfaceProps {
  open: boolean;
  onClose: () => void;
  onTopicSelect?: (topicId: string) => void;
  onMessageSelect?: (topicId: string, messageId: string) => void;
}

const ChatSearchInterface: React.FC<ChatSearchInterfaceProps> = ({
  open,
  onClose,
  onTopicSelect,
  onMessageSelect,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const {
    query,
    setQuery,
    mode,
    setMode,
    results,
    isSearching,
    error,
    recent,
    removeRecent,
    clearRecent,
    reset,
  } = useChatSearch(open);

  const [activeIndex, setActiveIndex] = useState(0);
  const itemRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const hits = useMemo(() => results?.hits ?? [], [results]);
  // 渲染期钳制,避免结果变化后索引越界(不在 effect 里 setState)
  const safeActiveIndex = hits.length === 0 ? 0 : Math.min(activeIndex, hits.length - 1);

  const handleQueryChange = useCallback((value: string) => {
    setActiveIndex(0);
    setQuery(value);
  }, [setQuery]);

  // 关闭时清空
  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  // 键盘选中项滚动进可视区
  useEffect(() => {
    itemRefs.current[safeActiveIndex]?.scrollIntoView({ block: 'nearest' });
  }, [safeActiveIndex]);

  const handleSelect = useCallback((hit: SearchHit) => {
    if (hit.kind === 'topic') {
      onTopicSelect?.(hit.topicId);
    } else if (hit.messageId) {
      onMessageSelect?.(hit.topicId, hit.messageId);
    }
    onClose();
  }, [onTopicSelect, onMessageSelect, onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
      return;
    }
    if (hits.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, hits.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const hit = hits[safeActiveIndex];
      if (hit) handleSelect(hit);
    }
  }, [hits, safeActiveIndex, handleSelect, onClose]);

  // 按日期分组(含年份,避免跨年同月日混组)
  const groups = useMemo(() => {
    const map = new Map<string, { hits: SearchHit[]; startIndex: number }>();
    hits.forEach((hit, index) => {
      const key = hit.createdAt ? dayjs(hit.createdAt).format('YYYY/MM/DD') : '未知时间';
      if (!map.has(key)) map.set(key, { hits: [], startIndex: index });
      map.get(key)!.hits.push(hit);
    });
    return Array.from(map.entries());
  }, [hits]);

  const handleModeChange = (_: React.MouseEvent, value: SearchMode | null) => {
    if (value) setMode(value);
  };

  const showRecent = !query.trim() && recent.length > 0;
  const showEmpty = !!query.trim() && !isSearching && !error && hits.length === 0;

  return (
    <BackButtonDialog
      open={open}
      onClose={onClose}
      fullScreen={isMobile}
      maxWidth="md"
      fullWidth
      slideTransition={isMobile}
      slotProps={{
        paper: {
          sx: {
            borderRadius: isMobile ? 0 : 3,
            height: isMobile ? '100%' : '80vh',
            bgcolor: 'background.paper',
            backgroundImage: 'none',
          },
        },
      }}
    >
      <Box
        onKeyDown={handleKeyDown}
        sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}
      >
        {/* 头部 */}
        <Box
          sx={{
            borderBottom: '1px solid',
            borderColor: 'divider',
            ...(isMobile
              ? {
                  // 顶部安全区(刘海/状态栏/自定义标题栏),与全屏页面一致
                  pt: 'calc(max(var(--titlebar-height, 0px), var(--safe-area-top, 0px)) + 16px)',
                  pb: 2,
                  pl: 'calc(16px + var(--safe-area-left, 0px))',
                  pr: 'calc(16px + var(--safe-area-right, 0px))',
                }
              : { p: 3 }),
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, color: 'primary.main', flexGrow: 1 }}>
              搜索话题和消息
            </Typography>
            <IconButton onClick={onClose} size="small" aria-label="关闭搜索">
              <X size={20} />
            </IconButton>
          </Box>

          <TextField
            fullWidth
            placeholder='搜索话题和消息…(用 " " 包裹精确短语)'
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            autoFocus
            variant="outlined"
            size="medium"
            inputProps={{ 'aria-label': '搜索话题和消息' }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={20} />
                  </InputAdornment>
                ),
                endAdornment: query ? (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => handleQueryChange('')} aria-label="清除搜索">
                      <X size={18} />
                    </IconButton>
                  </InputAdornment>
                ) : null,
              },
            }}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
          />

          {/* 匹配方式 + 统计 */}
          <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={mode}
              onChange={handleModeChange}
              aria-label="多关键词匹配方式"
            >
              <ToggleButton value="and" aria-label="全部匹配" sx={{ px: 1.5, py: 0.25, textTransform: 'none' }}>
                全部匹配
              </ToggleButton>
              <ToggleButton value="or" aria-label="任意匹配" sx={{ px: 1.5, py: 0.25, textTransform: 'none' }}>
                任意匹配
              </ToggleButton>
            </ToggleButtonGroup>

            <Box sx={{ flexGrow: 1 }} />

            {query.trim() && (
              <Box aria-live="polite">
                {isSearching ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CircularProgress size={15} />
                    <Typography variant="body2" color="text.secondary">搜索中…</Typography>
                  </Box>
                ) : error ? (
                  <Typography variant="body2" color="error">搜索出错,请重试</Typography>
                ) : results ? (
                  <Typography variant="body2" color="text.secondary">
                    找到 {results.total} 个结果 ({results.tookMs.toFixed(0)}ms)
                    {results.truncated && `,显示前 ${hits.length} 个`}
                  </Typography>
                ) : null}
              </Box>
            )}
          </Box>
        </Box>

        {/* 结果区 */}
        <Box
          sx={{
            flex: 1,
            overflow: 'auto',
            minHeight: 0,
            ...(isMobile
              ? {
                  pt: 2,
                  // 底部安全区(home indicator),避免末条结果被遮挡
                  pb: 'calc(var(--safe-area-bottom-computed, 0px) + 16px)',
                  pl: 'calc(16px + var(--safe-area-left, 0px))',
                  pr: 'calc(16px + var(--safe-area-right, 0px))',
                }
              : { p: 3 }),
          }}
        >
          {showRecent && (
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle2" color="text.secondary" sx={{ flexGrow: 1 }}>
                  最近搜索
                </Typography>
                <Typography
                  variant="caption"
                  color="primary"
                  sx={{ cursor: 'pointer' }}
                  onClick={clearRecent}
                >
                  清空
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                {recent.map((r) => (
                  <Chip
                    key={r}
                    label={r}
                    size="small"
                    icon={<Clock size={13} />}
                    onClick={() => handleQueryChange(r)}
                    onDelete={() => removeRecent(r)}
                  />
                ))}
              </Stack>
            </Box>
          )}

          {showEmpty && (
            <Box sx={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', height: 240, color: 'text.secondary',
            }}>
              <Search size={44} style={{ opacity: 0.3, marginBottom: 12 }} />
              <Typography variant="subtitle1" sx={{ mb: 0.5 }}>没有找到匹配的结果</Typography>
              <Typography variant="body2">换个关键词,或切换为「任意匹配」试试</Typography>
            </Box>
          )}

          <Box role="listbox" aria-label="搜索结果">
            {groups.map(([date, group]) => (
              <Box key={date} sx={{ mb: 2 }}>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, fontWeight: 600 }}>
                  {date}
                </Typography>
                <Divider sx={{ mb: 1 }} />
                {group.hits.map((hit, i) => {
                  const globalIndex = group.startIndex + i;
                  return (
                    <Box key={hit.id} ref={(el: HTMLDivElement | null) => { itemRefs.current[globalIndex] = el; }}>
                      <SearchResultItem
                        hit={hit}
                        active={globalIndex === safeActiveIndex}
                        onSelect={handleSelect}
                      />
                    </Box>
                  );
                })}
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    </BackButtonDialog>
  );
};

export default ChatSearchInterface;
