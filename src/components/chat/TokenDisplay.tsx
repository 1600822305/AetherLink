import React, { useMemo, useState } from 'react';
import { Box, Typography, Popover, Divider, useTheme } from '@mui/material';
import { Hash, ArrowUp, ArrowDown, Sigma, Zap, Clock } from 'lucide-react';
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

// 面板中的单行统计项
interface StatRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

const StatRow: React.FC<StatRowProps> = ({ icon, label, value }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
    <Box sx={{ display: 'flex', alignItems: 'center', color: 'text.secondary' }}>
      {icon}
    </Box>
    <Typography variant="body2" sx={{ color: 'text.secondary', flexGrow: 1 }}>
      {label}
    </Typography>
    <Typography
      variant="body2"
      sx={{ fontFamily: 'monospace', fontWeight: 500, color: 'text.primary' }}
    >
      {value}
    </Typography>
  </Box>
);

const TokenDisplay: React.FC<TokenDisplayProps> = ({
  currentMessage,
  showCurrentMessage = false
}) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';

  // 点击弹出面板的锚点
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const panelOpen = Boolean(anchorEl);

  // 获取当前话题的所有消息
  const messages = useSelector(selectCurrentTopicMessages);

  // 计算总token数（类似 Roo Code 逻辑：最近一次 API 调用）
  const totalTokens = useMemo(() => {
    if (!messages || messages.length === 0) return 0;

    // 类似 Roo Code：从最近一次 API 调用获取 token 数
    // 找到最后一条 AI 回复消息
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (message.role === 'assistant' && message.usage) {
        // 使用实际的 usage 信息（输入 + 输出）
        const inputTokens = message.usage.promptTokens || 0;
        const outputTokens = message.usage.completionTokens || 0;
        return inputTokens + outputTokens;
      }
    }

    // 如果没有找到 usage 信息，回退到估算逻辑
    let total = 0;
    for (const message of messages) {
      try {
        const content = getMainTextContent(message);
        if (content) {
          total += estimateTokens(content);
        }
      } catch (error) {
        console.warn('计算消息token失败:', error);
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

  const usage = showCurrentMessage ? currentMessage?.usage : undefined;
  const hasUsageBreakdown = !!usage && (usage.promptTokens > 0 || usage.completionTokens > 0);

  const metrics = showCurrentMessage ? currentMessage?.metrics : undefined;
  const latencySeconds = metrics && metrics.latency > 0 ? metrics.latency / 1000 : 0;
  const tokensPerSecond = usage && latencySeconds > 0
    ? (usage.completionTokens || 0) / latencySeconds
    : 0;

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  return (
    <>
      <Box
        onClick={handleClick}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          padding: '2px 4px',
          cursor: 'pointer',
          borderRadius: '4px',
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            opacity: 0.8,
            backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)'
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

      <Popover
        open={panelOpen}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        slotProps={{
          paper: {
            elevation: 0,
            sx: {
              minWidth: 180,
              px: 1.5,
              py: 1,
              borderRadius: '12px',
              border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
              boxShadow: isDarkMode
                ? '0 4px 20px rgba(0,0,0,0.4)'
                : '0 4px 20px rgba(0,0,0,0.1)',
              backgroundColor: isDarkMode ? 'rgba(35, 35, 35, 0.98)' : 'rgba(255, 255, 255, 0.98)'
            }
          }
        }}
      >
        {hasUsageBreakdown && usage ? (
          <>
            <StatRow
              icon={<ArrowUp size={14} />}
              label="输入"
              value={`${(usage.promptTokens || 0).toLocaleString()} tokens`}
            />
            <StatRow
              icon={<ArrowDown size={14} />}
              label="输出"
              value={`${(usage.completionTokens || 0).toLocaleString()} tokens`}
            />
            {latencySeconds > 0 && (
              <>
                {tokensPerSecond > 0 && (
                  <StatRow
                    icon={<Zap size={14} />}
                    label="速度"
                    value={`${tokensPerSecond.toFixed(1)} tok/s`}
                  />
                )}
                <StatRow
                  icon={<Clock size={14} />}
                  label="耗时"
                  value={`${latencySeconds.toFixed(1)}s`}
                />
              </>
            )}
            <Divider sx={{ my: 0.5 }} />
            <StatRow
              icon={<Sigma size={14} />}
              label="当前消息"
              value={currentMessageTokens.toLocaleString()}
            />
            <StatRow
              icon={<Hash size={14} />}
              label="总 Token"
              value={totalTokens.toLocaleString()}
            />
          </>
        ) : (
          <>
            {showCurrentMessage && currentMessage && (
              <StatRow
                icon={<Sigma size={14} />}
                label="当前消息"
                value={currentMessageTokens.toLocaleString()}
              />
            )}
            <StatRow
              icon={<Hash size={14} />}
              label="总 Token"
              value={totalTokens.toLocaleString()}
            />
          </>
        )}
      </Popover>
    </>
  );
};

export default TokenDisplay;
