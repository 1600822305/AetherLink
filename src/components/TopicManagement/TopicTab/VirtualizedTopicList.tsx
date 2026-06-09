import React, { memo, useMemo, useCallback } from 'react';
import { Box, Typography } from '@mui/material';
import VirtualList from '../../common/VirtualList';
import TopicItem from './TopicItem';
import {
  shouldEnableVirtualization,
  getItemHeight,
  getOverscanCount,
  VIRTUALIZATION_CONFIG
} from '../AssistantTab/virtualizationConfig';
import type { ChatTopic } from '../../../shared/types';

interface VirtualizedTopicListProps {
  topics: ChatTopic[];
  // 🚀 优化：移除 currentTopic prop，TopicItem 已经内部订阅 Redux 状态
  currentTopic?: ChatTopic | null; // 保留兼容性，但不再使用
  onSelectTopic: (topic: ChatTopic) => void;
  onOpenMenu: (event: React.MouseEvent, topic: ChatTopic) => void;
  onDeleteTopic: (topicId: string, event: React.MouseEvent) => void;
  title?: string;
  height?: number | string;
  emptyMessage?: string;
  itemHeight?: number;
}

/**
 * 虚拟化话题列表组件
 * 用于高效渲染大量话题，只渲染可见区域的话题项
 */
const VirtualizedTopicList = memo(function VirtualizedTopicList({
  topics,
  currentTopic: _currentTopic, // 保留兼容性，但不再使用 (TopicItem 内部订阅 Redux)
  onSelectTopic,
  onOpenMenu,
  onDeleteTopic,
  title,
  height = VIRTUALIZATION_CONFIG.CONTAINER_HEIGHT.DEFAULT,
  emptyMessage = '暂无话题',
  itemHeight = getItemHeight('topic')
}: VirtualizedTopicListProps) {

  // 🚀 优化：移除 currentTopicId 依赖，TopicItem 内部订阅 Redux 状态
  // 这样切换话题时 renderTopicItem 不会重建，只有选中/取消选中的两个 TopicItem 会重渲染
  const renderTopicItem = useCallback((topic: ChatTopic, _index: number) => {
    return (
      <TopicItem
        topic={topic}
        onSelectTopic={onSelectTopic}
        onOpenMenu={onOpenMenu}
        onDeleteTopic={onDeleteTopic}
      />
    );
  }, [onSelectTopic, onOpenMenu, onDeleteTopic]); // 不再依赖 currentTopicId

  // 缓存话题键值函数
  const getTopicKey = useCallback((topic: ChatTopic, _index: number) => {
    return topic.id;
  }, []);

  // 计算是否需要虚拟化（使用配置文件的阈值）
  const shouldVirtualize = useMemo(() => {
    return shouldEnableVirtualization(topics.length, 'topic');
  }, [topics.length]);

  // 如果话题列表为空，显示空状态
  if (topics.length === 0) {
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
        // 使用虚拟化渲染大量话题（TanStack 动态测高，行高自适应）
        <VirtualList<ChatTopic>
          items={topics}
          estimateItemHeight={itemHeight}
          renderItem={renderTopicItem}
          itemKey={getTopicKey}
          height={height}
          overscan={getOverscanCount(topics.length)} // 根据列表大小动态调整预渲染数量
          style={{
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: '8px',
            backgroundColor: 'background.paper',
          }}
        />
      ) : (
        // 话题数量较少时直接渲染，避免虚拟化的开销
        <Box
          className="hide-scrollbar"
          sx={{
            maxHeight: height,
            overflow: 'auto',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: '8px',
            backgroundColor: 'background.paper',
            // 隐藏滚动条样式 - 与助手列表保持一致
            scrollbarWidth: 'none', // Firefox
            msOverflowStyle: 'none', // IE/Edge
            '&::-webkit-scrollbar': {
              display: 'none', // WebKit浏览器
            },
          }}
        >
          {topics.map((topic, index) => (
            <Box key={topic.id}>
              {renderTopicItem(topic, index)}
            </Box>
          ))}
        </Box>
      )}

      {/* 显示话题数量统计 */}
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
        共 {topics.length} 个话题
        {shouldVirtualize && ' (已启用虚拟化)'}
      </Typography>
    </Box>
  );
}, (prevProps, nextProps) => {
  // 🚀 优化：移除 currentTopic 比较（TopicItem 内部订阅 Redux 状态）
  // 只比较影响列表结构的属性
  const shouldSkipRender = (
    prevProps.topics.length === nextProps.topics.length &&
    prevProps.height === nextProps.height &&
    prevProps.itemHeight === nextProps.itemHeight &&
    prevProps.title === nextProps.title &&
    // 检查话题数组是否真的发生了变化（按影响渲染的字段逐项比较）
    // 注意：必须包含 lastMessagePreview / messageCount / messageIds 长度，否则未加载话题
    // 收到新消息后预览/有无消息状态变了但这些字段未被比较 → 误判「跳过重渲染」→ 侧栏预览不刷新。
    prevProps.topics.every((topic, index) => {
      const next = nextProps.topics[index];
      return (
        topic.id === next?.id &&
        topic.name === next?.name &&
        topic.title === next?.title &&
        topic.pinned === next?.pinned &&
        topic.lastMessagePreview === next?.lastMessagePreview &&
        topic.messageCount === next?.messageCount &&
        (topic.messageIds?.length ?? 0) === (next?.messageIds?.length ?? 0)
      );
    })
  );

  return shouldSkipRender;
});

export default VirtualizedTopicList;
