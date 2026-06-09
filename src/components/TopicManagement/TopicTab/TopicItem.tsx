import React, { useMemo, useState, useRef, useCallback } from 'react';
import {
  ListItemButton,
  ListItemText,
  IconButton,
  Typography,
  Box
} from '@mui/material';
import { MoreVertical, Trash, Pin, AlertTriangle } from 'lucide-react';
import { useSelector } from 'react-redux';
import { getMainTextContent } from '../../../shared/utils/blockUtils';
import type { ChatTopic } from '../../../shared/types';
import type { RootState } from '../../../shared/store';
import { selectTopicStreaming, selectMessagesForTopic } from '../../../shared/store/selectors/messageSelectors';
import { formatPreviewText } from '../../../shared/services/topics/TopicPreviewService';

interface TopicItemProps {
  topic: ChatTopic;
  // 🚀 优化：移除 isSelected prop，改由组件内部从 Redux 订阅
  // 这样切换话题时只有选中/取消选中的两个 TopicItem 会重渲染
  onSelectTopic: (topic: ChatTopic) => void;
  onOpenMenu: (event: React.MouseEvent, topic: ChatTopic) => void;
  onDeleteTopic: (topicId: string, event: React.MouseEvent) => void;
}

/**
 * 单个话题项组件 - 使用 memo 优化性能
 */
const TopicItem = React.memo(function TopicItem({
  topic,
  onSelectTopic,
  onOpenMenu,
  onDeleteTopic
}: TopicItemProps) {
  // 🚀 优化：组件内部订阅 Redux 状态，避免父组件 renderTopicItem 重建导致所有可见项重渲染
  const currentTopicId = useSelector((state: RootState) => state.messages.currentTopicId);
  const isSelected = currentTopicId === topic.id;
  // 删除确认状态
  const [pendingDelete, setPendingDelete] = useState(false);
  const deleteTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleTopicClick = useCallback(() => {
    // 🚀 优化：移除冗余的 startTransition 嵌套（SidebarTabs.handleSelectTopic 已包含）
    onSelectTopic(topic);
  }, [topic, onSelectTopic]);

  const handleOpenMenu = (event: React.MouseEvent) => {
    event.stopPropagation();
    onOpenMenu(event, topic);
  };

  const handleDeleteClick = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();

    if (pendingDelete) {
      // 第二次点击，立即重置UI状态，然后执行删除
      setPendingDelete(false);
      if (deleteTimeoutRef.current) {
        clearTimeout(deleteTimeoutRef.current);
        deleteTimeoutRef.current = null;
      }

      console.log(`[TopicItem] 确认删除话题: ${topic.name} (${topic.id})`);

      // 🚀 优化：移除冗余的 startTransition（SidebarTabs.handleDeleteTopic 已包含）
      onDeleteTopic(topic.id, event);
    } else {
      // 第一次点击，进入确认状态
      setPendingDelete(true);
      console.log(`[TopicItem] 进入删除确认状态: ${topic.name}`);

      // 1.5秒后自动重置（缩短等待时间，提升用户体验）
      deleteTimeoutRef.current = setTimeout(() => {
        setPendingDelete(false);
        deleteTimeoutRef.current = null;
        console.log(`[TopicItem] 删除确认状态超时重置: ${topic.name}`);
      }, 1500); // 从2秒缩短到1.5秒
    }
  }, [topic.id, topic.name, onDeleteTopic, pendingDelete]);

  // 清理定时器的 useEffect
  React.useEffect(() => {
    return () => {
      if (deleteTimeoutRef.current) {
        clearTimeout(deleteTimeoutRef.current);
      }
    };
  }, []);

  const selectTopicStreamingState = useMemo(
    () => (state: RootState) => Boolean(selectTopicStreaming(state, topic.id)),
    [topic.id]
  );

  const isStreaming = useSelector(selectTopicStreamingState);

  // 已加载进 Redux 的消息（仅打开过/正在使用的话题非空）。
  // selectMessagesForTopic 内部带缓存，未加载时稳定返回空数组，不会触发额外重渲染。
  const reduxMessages = useSelector((state: RootState) => selectMessagesForTopic(state, topic.id));
  const isLoaded = reduxMessages.length > 0;

  // 获取话题的显示名称
  const displayName = topic.name || topic.title || '无标题话题';

  // 是否有消息：已加载的话题以 Redux 为准，否则以持久化元数据为准
  // （messageCount / messageIds），不依赖消息是否已加载进 Redux ——
  // 这是修复「未打开的话题误显示无消息」的关键。
  const persistedCount = topic.messageCount ?? topic.messageIds?.length ?? 0;
  const hasMessages = isLoaded || persistedCount > 0;

  // 获取话题的最后一条消息内容
  // - 已加载话题：直接读 Redux 实时内容（发消息即时更新，无需逐条派发刷新）
  // - 未加载话题：读持久化预览快照（启动时已由 migrateTopicPreviews 全量回填）
  const getLastMessageContent = () => {
    if (isLoaded) {
      const lastMessage = reduxMessages[reduxMessages.length - 1];
      const content = getMainTextContent(lastMessage);
      if (!content || !content.trim()) {
        return '无文本内容';
      }
      return formatPreviewText(content);
    }
    if (!hasMessages) {
      return '无消息';
    }
    // undefined = 预览尚未回填（迁移完成前的瞬态），显示占位
    if (topic.lastMessagePreview === undefined) {
      return '…';
    }
    if (topic.lastMessagePreview === '') {
      return '无文本内容';
    }
    return topic.lastMessagePreview;
  };

  // 格式化创建时间
  const formatCreatedTime = () => {
    if (!topic.createdAt) return '';

    const createdDate = new Date(topic.createdAt);
    const now = new Date();
    const diffMs = now.getTime() - createdDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    // 获取日期部分
    const dateStr = createdDate.toLocaleDateString('zh-CN', {
      month: '2-digit',
      day: '2-digit'
    });

    // 获取时间部分
    const timeStr = createdDate.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    if (diffDays === 0) {
      // 今天 - 显示日期和时间
      return `${dateStr} ${timeStr}`;
    } else if (diffDays === 1) {
      // 昨天 - 显示日期和"昨天"
      return `${dateStr} 昨天`;
    } else if (diffDays < 7) {
      // 一周内 - 显示日期和天数
      return `${dateStr} ${diffDays}天前`;
    } else {
      // 超过一周 - 显示日期和时间
      return `${dateStr} ${timeStr}`;
    }
  };

  return (
    <ListItemButton
      onClick={handleTopicClick}
      selected={isSelected}
      sx={{
        borderRadius: '8px',
        mb: 1,
        // 性能优化
        contain: 'layout style',
        transform: 'translateZ(0)', // 硬件加速
        willChange: 'auto', // 避免长期占用 GPU
        // 选中状态样式
        '&.Mui-selected': {
          backgroundColor: 'rgba(25, 118, 210, 0.08)',
        },
        '&.Mui-selected:hover': {
          backgroundColor: 'rgba(25, 118, 210, 0.12)',
        },
        // 优化触摸响应
        touchAction: 'manipulation',
        userSelect: 'none',
      }}
    >
      <ListItemText
        primary={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            {isStreaming && (
              <Box
                component="span"
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bgcolor: 'success.main',
                  boxShadow: '0 0 0 1px rgba(76, 175, 80, 0.35)',
                  flexShrink: 0
                }}
              />
            )}
            <Typography
              variant="body2"
              sx={{
                fontWeight: isSelected ? 600 : 400,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1
              }}
            >
              {displayName}
            </Typography>
            {topic.pinned && (
              <Pin
                size={12}
                style={{
                  color: '#1976d2',
                  flexShrink: 0,
                  opacity: 0.8
                }}
              />
            )}
          </Box>
        }
        secondary={
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              display: 'block'
            }}
          >
            {getLastMessageContent()}
          </Typography>
        }
        secondaryTypographyProps={{ component: 'div' }}
      />

      {/* 右侧按钮区域 */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
        {/* 创建时间 */}
        <Typography
          variant="caption"
          sx={{
            fontSize: '11px',
            color: 'text.primary',
            lineHeight: 1,
            whiteSpace: 'nowrap',
            opacity: 0.9
          }}
        >
          {formatCreatedTime()}
        </Typography>

        {/* 按钮组 */}
        <div style={{ display: 'flex', gap: '2px' }}>
          <IconButton
            size="small"
            onClick={handleOpenMenu}
            sx={{ opacity: 0.6, padding: '2px' }}
          >
            <MoreVertical size={16} />
          </IconButton>
          <IconButton
            size="small"
            onClick={handleDeleteClick}
            sx={{
              opacity: pendingDelete ? 1 : 0.6,
              padding: '2px',
              color: pendingDelete ? 'error.main' : 'inherit',
              '&:hover': { color: 'error.main' },
              transition: 'all 0.2s ease-in-out'
            }}
            title={pendingDelete ? '再次点击确认删除' : '删除话题'}
          >
            {pendingDelete ? <AlertTriangle size={16} /> : <Trash size={16} />}
          </IconButton>
        </div>
      </div>
    </ListItemButton>
  );
});

export default TopicItem;