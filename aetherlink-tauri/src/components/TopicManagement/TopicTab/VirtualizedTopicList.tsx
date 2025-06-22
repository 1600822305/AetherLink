import React, { memo, useMemo, useCallback } from 'react';
import { Box, Typography } from '@mui/material';
import { useSelector } from 'react-redux';
import VirtualScroller from '../../common/VirtualScroller';
import TopicItem from './TopicItem';
import {
  shouldEnableVirtualization,
  getItemHeight,
  getOverscanCount,
  VIRTUALIZATION_CONFIG
} from '../AssistantTab/virtualizationConfig';
import type { ChatTopic } from '../../../shared/types';
import type { RootState } from '../../../shared/store';

interface VirtualizedTopicListProps {
  topics: ChatTopic[];
  currentTopic: ChatTopic | null; // 保留兼容性，但不再使用
  onSelectTopic: (topic: ChatTopic) => void;
  onOpenMenu: (event: React.MouseEvent, topic: ChatTopic) => void;
  onDeleteTopic: (topicId: string, event: React.MouseEvent) => void;
  title?: string;
  height?: number | string;
  emptyMessage?: string;
  itemHeight?: number;
  searchQuery?: string;
  getMainTextContent?: (message: any) => string | null;
}

/**
 * 虚拟化话题列表组件
 * 用于高效渲染大量话题，只渲染可见区域的话题项
 */
const VirtualizedTopicList = memo(function VirtualizedTopicList({
  topics,
  currentTopic: _currentTopic, // 保留兼容性，但不再使用
  onSelectTopic,
  onOpenMenu,
  onDeleteTopic,
  title,
  height = VIRTUALIZATION_CONFIG.CONTAINER_HEIGHT.DEFAULT,
  emptyMessage = '暂无话题',
  itemHeight = getItemHeight('topic'),
  searchQuery = '',
  getMainTextContent
}: VirtualizedTopicListProps) {

  // 🚀 Cherry Studio模式：直接从Redux获取当前话题ID，立即响应状态变化
  const currentTopicId = useSelector((state: RootState) => state.messages.currentTopicId);

  // 过滤话题（搜索功能）
  const filteredTopics = useMemo(() => {
    if (!searchQuery) return topics;
    
    return topics.filter(topic => {
      // 检查名称或标题
      if ((topic.name && topic.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (topic.title && topic.title.toLowerCase().includes(searchQuery.toLowerCase()))) {
        return true;
      }
      
      // 检查消息内容
      if (getMainTextContent) {
        return (topic.messages || []).some(message => {
          const content = getMainTextContent(message);
          return content ? content.toLowerCase().includes(searchQuery.toLowerCase()) : false;
        });
      }
      
      return false;
    });
  }, [topics, searchQuery, getMainTextContent]);

  // 缓存渲染函数，避免每次重新创建 - 🚀 使用Redux状态立即响应
  const renderTopicItem = useCallback((topic: ChatTopic, _index: number) => {
    return (
      <TopicItem
        topic={topic}
        isSelected={currentTopicId === topic.id} // 🌟 直接使用Redux状态，立即响应
        onSelectTopic={onSelectTopic}
        onOpenMenu={onOpenMenu}
        onDeleteTopic={onDeleteTopic}
      />
    );
  }, [currentTopicId, onSelectTopic, onOpenMenu, onDeleteTopic]); // 🔧 依赖currentTopicId而不是currentTopic

  // 缓存话题键值函数
  const getTopicKey = useCallback((topic: ChatTopic, _index: number) => {
    return topic.id;
  }, []);

  // 计算是否需要虚拟化（使用配置文件的阈值）
  const shouldVirtualize = useMemo(() => {
    return shouldEnableVirtualization(filteredTopics.length, 'topic');
  }, [filteredTopics.length]);

  // 如果话题列表为空，显示空状态
  if (filteredTopics.length === 0) {
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
          {searchQuery ? `没有找到包含 "${searchQuery}" 的话题` : emptyMessage}
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
        // 使用虚拟化渲染大量话题
        <VirtualScroller<ChatTopic>
          items={filteredTopics}
          itemHeight={itemHeight}
          renderItem={renderTopicItem}
          itemKey={getTopicKey}
          height={height}
          overscanCount={getOverscanCount(filteredTopics.length)} // 根据列表大小动态调整预渲染数量
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
          {filteredTopics.map((topic) => (
            <Box key={topic.id} sx={{ height: itemHeight }}>
              {renderTopicItem(topic, 0)}
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
        共 {filteredTopics.length} 个话题
        {topics.length !== filteredTopics.length && ` (已过滤 ${topics.length - filteredTopics.length} 个)`}
        {shouldVirtualize && ' (已启用虚拟化)'}
      </Typography>
    </Box>
  );
}, (prevProps, nextProps) => {
  // 自定义比较函数，只有在关键属性变化时才重新渲染
  const shouldSkipRender = (
    prevProps.topics.length === nextProps.topics.length &&
    prevProps.currentTopic?.id === nextProps.currentTopic?.id &&
    prevProps.height === nextProps.height &&
    prevProps.itemHeight === nextProps.itemHeight &&
    prevProps.title === nextProps.title &&
    prevProps.searchQuery === nextProps.searchQuery &&
    // 检查话题数组是否真的发生了变化（浅比较ID）
    prevProps.topics.every((topic, index) =>
      topic.id === nextProps.topics[index]?.id &&
      topic.name === nextProps.topics[index]?.name &&
      topic.title === nextProps.topics[index]?.title &&
      topic.pinned === nextProps.topics[index]?.pinned
    )
  );

  return shouldSkipRender;
});

export default VirtualizedTopicList;
