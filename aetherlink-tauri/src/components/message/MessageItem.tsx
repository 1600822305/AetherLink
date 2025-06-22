import React from 'react';
import type { MessageItemProps } from './types/MessageComponent';
import { useMessageData } from './hooks/useMessageData';
import { useMessageBlocks } from './hooks/useMessageBlocks';
import BubbleStyleMessage from './styles/BubbleStyleMessage';
import MinimalStyleMessage from './styles/MinimalStyleMessage';

const MessageItem: React.FC<MessageItemProps> = React.memo(({
  message,
  showAvatar = true,
  isCompact = false,
  messageIndex,
  onRegenerate,
  onDelete,
  onSwitchVersion,
  onResend,
  forceUpdate
}) => {
  // 使用自定义hooks获取消息数据
  const messageData = useMessageData(message);
  const { loading } = useMessageBlocks(message, messageData.blocks, forceUpdate);

  // 🚀 使用useMemo缓存styleProps，避免每次渲染都创建新对象
  const styleProps = React.useMemo(() => ({
    message,
    showAvatar,
    isCompact,
    loading,
    modelAvatar: messageData.modelAvatar,
    assistantAvatar: messageData.assistantAvatar,
    userAvatar: messageData.userAvatar,
    showUserAvatar: messageData.showUserAvatar,
    showUserName: messageData.showUserName,
    showModelAvatar: messageData.showModelAvatar,
    showModelName: messageData.showModelName,
    showMessageDivider: messageData.showMessageDivider,
    settings: messageData.settings,
    themeColors: messageData.themeColors,
    themeStyle: messageData.themeStyle,
    theme: messageData.theme,
    getProviderName: messageData.getProviderName,
    messageIndex,
    onRegenerate,
    onDelete,
    onSwitchVersion,
    onResend
  }), [
    message,
    showAvatar,
    isCompact,
    loading,
    messageData.modelAvatar,
    messageData.assistantAvatar,
    messageData.userAvatar,
    messageData.showUserAvatar,
    messageData.showUserName,
    messageData.showModelAvatar,
    messageData.showModelName,
    messageData.showMessageDivider,
    messageData.settings,
    messageData.themeColors,
    messageData.themeStyle,
    messageData.theme,
    messageData.getProviderName,
    messageIndex,
    onRegenerate,
    onDelete,
    onSwitchVersion,
    onResend
  ]);

  // 根据样式设置选择对应的组件
  if (messageData.isBubbleStyle) {
    return <BubbleStyleMessage {...styleProps} />;
  } else {
    return <MinimalStyleMessage {...styleProps} />;
  }
}, (prevProps, nextProps) => {
  // 🚀 自定义比较函数，只有关键属性变化时才重新渲染
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.updatedAt === nextProps.message.updatedAt &&
    prevProps.message.status === nextProps.message.status && // 🔥 关键！流式输出状态变化
    JSON.stringify(prevProps.message.blocks) === JSON.stringify(nextProps.message.blocks) && // 🔥 消息块变化
    prevProps.showAvatar === nextProps.showAvatar &&
    prevProps.isCompact === nextProps.isCompact &&
    prevProps.messageIndex === nextProps.messageIndex &&
    prevProps.forceUpdate === nextProps.forceUpdate
  );
});

// 🚀 设置displayName便于调试
MessageItem.displayName = 'MessageItem';

export default MessageItem;
