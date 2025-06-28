import React, { useMemo, useState, useEffect } from 'react';
import { Box, Typography, Tooltip, useTheme } from '@mui/material';
import { Hash } from 'lucide-react';
import { useSelector } from 'react-redux';
import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '../../shared/store';
import { estimateTokens } from '../../shared/utils';
import { getMainTextContent } from '../../shared/utils/messageUtils';
import type { Message } from '../../shared/types/newMessage';

interface TokenDisplayProps {
  currentMessage?: Message; // 当前选中或正在编辑的消息
  showCurrentMessage?: boolean; // 是否显示当前消息的token
}

// 创建memoized selector来避免不必要的重新渲染
const selectCurrentTopicMessages = createSelector(
  [
    (state: RootState) => state.messages.currentTopicId,
    (state: RootState) => state.messages.messageIdsByTopic,
    (state: RootState) => state.messages.entities
  ],
  (currentTopicId, messageIdsByTopic, entities) => {
    if (!currentTopicId) return [];
    const messageIds = messageIdsByTopic[currentTopicId] || [];
    return messageIds.map(id => entities[id]).filter(Boolean);
  }
);

const TokenDisplay: React.FC<TokenDisplayProps> = ({
  currentMessage,
  showCurrentMessage = false
}) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';

  // 移动端检测和tooltip状态管理
  const [isMobile, setIsMobile] = useState(false);
  const [tooltipOpen, setTooltipOpen] = useState(false);

  // 检测是否为移动端设备
  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent;
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
      const isSmallScreen = window.innerWidth <= 768;

      // 更精确的判断：移动设备 或 小屏幕
      setIsMobile(isMobileDevice || isSmallScreen);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // 获取当前话题的所有消息
  const messages = useSelector(selectCurrentTopicMessages);

  // 计算总token数
  const totalTokens = useMemo(() => {
    if (!messages || messages.length === 0) return 0;
    
    let total = 0;
    
    for (const message of messages) {
      // 优先使用消息的usage信息
      if (message.usage?.totalTokens) {
        total += message.usage.totalTokens;
      } else {
        // 如果没有usage信息，估算token数
        try {
          const content = getMainTextContent(message);
          if (content) {
            total += estimateTokens(content);
          }
        } catch (error) {
          console.warn('计算消息token失败:', error);
        }
      }
    }
    
    return total;
  }, [messages]);

  // 计算当前消息的token数
  const currentMessageTokens = useMemo(() => {
    if (!currentMessage) return 0;
    
    // 优先使用消息的usage信息
    if (currentMessage.usage?.totalTokens) {
      return currentMessage.usage.totalTokens;
    }
    
    // 如果没有usage信息，估算token数
    try {
      const content = getMainTextContent(currentMessage);
      return content ? estimateTokens(content) : 0;
    } catch (error) {
      console.warn('计算当前消息token失败:', error);
      return 0;
    }
  }, [currentMessage]);

  // 格式化token数显示
  const formatTokenCount = (count: number): string => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    } else if (count >= 10000) {
      return `${(count / 1000).toFixed(1)}K`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(0)}K`; // 1K, 2K, 9K
    }
    return count.toString();
  };

  // 即使没有消息也显示0，让用户知道token功能存在

  const displayText = showCurrentMessage && currentMessage
    ? `${formatTokenCount(totalTokens)}/${formatTokenCount(currentMessageTokens)}`
    : formatTokenCount(totalTokens);

  const tooltipContent = showCurrentMessage && currentMessage ? (
    <>
      总Token: {totalTokens.toLocaleString()}<br />
      当前消息: {currentMessageTokens.toLocaleString()}
    </>
  ) : (
    `总Token: ${totalTokens.toLocaleString()}`
  );

  // 处理点击事件（仅移动端）
  const handleClick = () => {
    if (isMobile) {
      setTooltipOpen(prev => !prev);
    }
  };

  // 处理点击外部关闭tooltip（仅移动端）
  const handleTooltipClose = () => {
    if (isMobile) {
      setTooltipOpen(false);
    }
  };

  return (
    <Tooltip
      title={tooltipContent}
      placement="top"
      arrow
      open={isMobile ? tooltipOpen : false}
      onClose={handleTooltipClose}
      disableHoverListener={isMobile}
      disableFocusListener={isMobile}
      disableTouchListener={!isMobile}
      slotProps={{
        popper: {
          disablePortal: isMobile, // 移动端可能需要这个
        }
      }}
    >
      <Box
        onClick={handleClick}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          padding: '2px 4px',
          cursor: 'pointer',
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            opacity: 0.8,
          }
        }}
      >
        <Hash 
          size={14} 
          color={isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.6)'} 
        />
        <Typography
          variant="caption"
          sx={{
            fontSize: '0.75rem',
            fontWeight: 500,
            color: isDarkMode ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.7)',
            fontFamily: 'monospace',
            lineHeight: 1,
            userSelect: 'none'
          }}
        >
          {displayText}
        </Typography>
      </Box>
    </Tooltip>
  );
};

export default TokenDisplay;
