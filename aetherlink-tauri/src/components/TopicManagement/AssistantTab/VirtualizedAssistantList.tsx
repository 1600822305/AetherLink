import React, { memo, useMemo, useCallback } from 'react';
import { Box, Typography } from '@mui/material';
import VirtualScroller from '../../common/VirtualScroller';
import AssistantItem from './AssistantItem';
import {
  shouldEnableVirtualization,
  getItemHeight,
  getOverscanCount,
  VIRTUALIZATION_CONFIG
} from './virtualizationConfig';
import type { Assistant } from '../../../shared/types/Assistant';

interface VirtualizedAssistantListProps {
  assistants: Assistant[];
  currentAssistant: Assistant | null;
  onSelectAssistant: (assistant: Assistant) => void;
  onOpenMenu: (event: React.MouseEvent, assistant: Assistant) => void;
  onDeleteAssistant: (assistantId: string, event: React.MouseEvent) => void;
  title?: string;
  height?: number | string;
  emptyMessage?: string;
  itemHeight?: number;
}

/**
 * 虚拟化助手列表组件
 * 用于高效渲染大量助手，只渲染可见区域的助手项
 */
const VirtualizedAssistantList = memo(function VirtualizedAssistantList({
  assistants,
  currentAssistant,
  onSelectAssistant,
  onOpenMenu,
  onDeleteAssistant,
  title,
  height = VIRTUALIZATION_CONFIG.CONTAINER_HEIGHT.DEFAULT,
  emptyMessage = '暂无助手',
  itemHeight = getItemHeight('assistant'),
}: VirtualizedAssistantListProps) {

  // 缓存渲染函数，避免每次重新创建
  const renderAssistantItem = useCallback((assistant: Assistant, _index: number) => {
    return (
      <AssistantItem
        assistant={assistant}
        isSelected={currentAssistant?.id === assistant.id}
        onSelectAssistant={onSelectAssistant}
        onOpenMenu={onOpenMenu}
        onDeleteAssistant={onDeleteAssistant}
      />
    );
  }, [currentAssistant?.id, onSelectAssistant, onOpenMenu, onDeleteAssistant]);

  // 缓存助手键值函数
  const getAssistantKey = useCallback((assistant: Assistant, _index: number) => {
    return assistant.id;
  }, []);

  // 计算是否需要虚拟化（使用配置文件的阈值）
  const shouldVirtualize = useMemo(() => {
    return shouldEnableVirtualization(assistants.length, 'assistant');
  }, [assistants.length]);

  // 如果助手列表为空，显示空状态
  if (assistants.length === 0) {
    return (
      <Box>
        {title && (
          <Typography variant="body2" color="textSecondary" sx={{ mt: 1, mb: 1 }}>
            {title}
          </Typography>
        )}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: 100,
            color: 'text.secondary',
            fontSize: '0.875rem',
          }}
        >
          {emptyMessage}
        </Box>
      </Box>
    );
  }

  return (
    <Box>
      {title && (
        <Typography variant="body2" color="textSecondary" sx={{ mt: 1, mb: 1 }}>
          {title}
        </Typography>
      )}

      {shouldVirtualize ? (
        // 使用虚拟化渲染大量助手
        <VirtualScroller<Assistant>
          items={assistants}
          itemHeight={itemHeight}
          renderItem={renderAssistantItem}
          itemKey={getAssistantKey}
          height={height}
          overscanCount={getOverscanCount(assistants.length)} // 根据列表大小动态调整预渲染数量
          style={{
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: '8px',
            backgroundColor: 'background.paper',
          }}
        />
      ) : (
        // 助手数量较少时直接渲染，避免虚拟化的开销
        <Box
          className="hide-scrollbar"
          sx={{
            maxHeight: height,
            overflow: 'auto',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: '8px',
            backgroundColor: 'background.paper',
            // 隐藏滚动条样式
            scrollbarWidth: 'none', // Firefox
            msOverflowStyle: 'none', // IE/Edge
            '&::-webkit-scrollbar': {
              display: 'none', // WebKit浏览器
            },
          }}
        >
          {assistants.map((assistant) => (
            <Box key={assistant.id} sx={{ height: itemHeight }}>
              {renderAssistantItem(assistant, 0)}
            </Box>
          ))}
        </Box>
      )}

      {/* 显示助手数量统计 */}
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{
          display: 'block',
          textAlign: 'center',
          mt: 1,
          fontSize: '0.75rem'
        }}
      >
        共 {assistants.length} 个助手
        {shouldVirtualize && ' (已启用虚拟化)'}
      </Typography>
    </Box>
  );
}, (prevProps, nextProps) => {
  // 自定义比较函数，只有在关键属性变化时才重新渲染
  const shouldSkipRender = (
    prevProps.assistants.length === nextProps.assistants.length &&
    prevProps.currentAssistant?.id === nextProps.currentAssistant?.id &&
    prevProps.height === nextProps.height &&
    prevProps.itemHeight === nextProps.itemHeight &&
    prevProps.title === nextProps.title &&
    // 检查助手数组是否真的发生了变化（浅比较ID）
    prevProps.assistants.every((assistant, index) =>
      assistant.id === nextProps.assistants[index]?.id &&
      assistant.name === nextProps.assistants[index]?.name &&
      assistant.emoji === nextProps.assistants[index]?.emoji
    )
  );

  // 如果有助手的emoji发生变化，记录日志
  if (!shouldSkipRender) {
    const emojiChanges = prevProps.assistants.filter((assistant, index) => {
      const nextAssistant = nextProps.assistants[index];
      return nextAssistant && assistant.emoji !== nextAssistant.emoji;
    });

    if (emojiChanges.length > 0) {
      console.log('[VirtualizedAssistantList] Emoji changes detected:', emojiChanges.map(a => a.name));
    }
  }

  return shouldSkipRender;
});

export default VirtualizedAssistantList;
