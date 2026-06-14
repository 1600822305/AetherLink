import React, { useMemo, useEffect, useState, useCallback } from 'react';
import { Box, useTheme } from '@mui/material';
import { useSelector } from 'react-redux';
import type { RootState } from '../../shared/store';
import MessageItem from './MessageItem';
import MultiModelMessageGroup from './MultiModelMessageGroup';
import ConversationDivider from './ConversationDivider';
import ChatDateHeader from './ChatDateHeader';
import type { Message } from '../../shared/types/newMessage';
import { getMessageDividerSetting, shouldShowConversationDivider } from '../../shared/utils/settingsUtils';
import {
  groupMessagesByAskId,
  isMultiModelGroup,
  type MessageOrGroup,
} from './utils/askIdGrouping';
import { createLogger } from '../../shared/services/infra/logger';

const logger = createLogger('MessageGroup');

// askId 多模型分组逻辑已抽到 ./utils/askIdGrouping（纯函数，便于单测与虚拟化复用）
export {
  groupMessagesByAskId,
  isMultiModelGroup,
} from './utils/askIdGrouping';
export type {
  MultiModelGroup,
  MessageOrGroup,
  GroupingResult,
} from './utils/askIdGrouping';

interface MessageGroupProps {
  date: string;
  messages: Message[];
  expanded?: boolean;
  onToggleExpand?: () => void;
  startIndex?: number; // 当前组在全局消息列表中的起始索引
  onRegenerate?: (messageId: string) => void;
  onDelete?: (messageId: string) => void;
  onSwitchVersion?: (versionId: string) => void;
  onResend?: (messageId: string) => void;
}

/**
 * 消息分组组件
 * 按日期对消息进行分组显示
 */
const MessageGroup: React.FC<MessageGroupProps> = ({
  date,
  messages,
  expanded = true,
  onToggleExpand,
  startIndex = 0,
  onRegenerate,
  onDelete,
  onSwitchVersion,
  onResend,
}) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';

  // 从Redux获取设置
  const messageGrouping = useSelector((state: RootState) =>
    state.settings.messageGrouping ?? 'byDate'
  );

  // 获取消息分割线设置
  const [showMessageDivider, setShowMessageDivider] = useState<boolean>(true);

  useEffect(() => {
    const fetchMessageDividerSetting = () => {
      try {
        const dividerSetting = getMessageDividerSetting();
        setShowMessageDivider(dividerSetting);
      } catch (error) {
        logger.error('获取消息分割线设置失败:', error);
        // 保持默认值 true
      }
    };

    fetchMessageDividerSetting();

    // 监听 localStorage 变化，实时更新设置
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'appSettings') {
        fetchMessageDividerSetting();
      }
    };

    // 使用自定义事件监听设置变化（用于同一页面内的变化）
    const handleCustomSettingChange = () => {
      fetchMessageDividerSetting();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('appSettingsChanged', handleCustomSettingChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('appSettingsChanged', handleCustomSettingChange);
    };
  }, []);

  // 将消息按 askId 分组，识别多模型响应，并获取索引映射
  const { groupedMessages, messageIndexMap } = useMemo(
    () => groupMessagesByAskId(messages),
    [messages]
  );

  // 渲染单条消息或多模型分组
  const renderMessageOrGroup = useCallback(
    (item: MessageOrGroup, _groupIndex: number) => {
      if (isMultiModelGroup(item)) {
        // 渲染多模型分组
        return (
          <MultiModelMessageGroup
            key={`multi-${item.userMessage.id}`}
            userMessage={item.userMessage}
            assistantMessages={item.assistantMessages}
            onRegenerate={onRegenerate}
            onDelete={onDelete}
            onSwitchVersion={onSwitchVersion}
            onResend={onResend}
          />
        );
      } else {
        // 使用消息 ID 获取正确的原始索引
        const originalIndex = messageIndexMap.get(item.id) ?? 0;
        // 渲染普通消息
        return (
          <React.Fragment key={item.id}>
            <MessageItem
              message={item}
              messageIndex={startIndex + originalIndex}
              onRegenerate={onRegenerate}
              onDelete={onDelete}
              onSwitchVersion={onSwitchVersion}
              onResend={onResend}
            />
            {/* 在对话轮次结束后显示分割线 - 使用正确的原始索引 */}
            {shouldShowConversationDivider(messages, originalIndex) && (
              <ConversationDivider show={showMessageDivider} style="subtle" />
            )}
          </React.Fragment>
        );
      }
    },
    [startIndex, onRegenerate, onDelete, onSwitchVersion, onResend, showMessageDivider, messages, messageIndexMap]
  );

  // 如果禁用了消息分组，直接渲染消息列表
  if (messageGrouping === 'disabled') {
    return (
      <Box>
        {groupedMessages.map((item, index) => renderMessageOrGroup(item, index))}
      </Box>
    );
  }

  return (
    <Box sx={{ mb: 3 }}>
      {/* 日期标题 */}
      <ChatDateHeader
        date={date}
        isDarkMode={isDarkMode}
        expanded={expanded}
        onToggleExpand={onToggleExpand}
      />

      {/* 消息列表 */}
      {expanded && (
        <Box>
          {groupedMessages.map((item, index) => renderMessageOrGroup(item, index))}
        </Box>
      )}
    </Box>
  );
};

// 使用默认 memo()，依赖 Redux 状态更新时产生的新对象引用
// 参考 cherry-studio 的实现方式
export default React.memo(MessageGroup);
