import React, { useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Collapse,
  Chip,
  Divider,
  Tooltip,
  useTheme,
  alpha
} from '@mui/material';
import {
  ChevronDown as ExpandMoreIcon,
  ChevronUp as ExpandLessIcon,
  Minimize2 as CompressIcon,
  Copy as CopyIcon,
  Check as CheckIcon,
  Clock as TimeIcon,
  Hash as TokenIcon
} from 'lucide-react';
import { useTranslation } from '../../../i18n';
import type { ContextSummaryMessageBlock } from '../../../shared/types/newMessage';
import Markdown from '../Markdown';

interface Props {
  block: ContextSummaryMessageBlock;
}

/**
 * 上下文压缩摘要块组件
 * 显示压缩后的对话摘要，支持展开/折叠查看详情
 */
const ContextSummaryBlock: React.FC<Props> = ({ block }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  // 计算节省的百分比
  const savedPercentage = block.originalTokens > 0
    ? Math.round((block.tokensSaved / block.originalTokens) * 100)
    : 0;

  // 格式化时间
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 切换展开状态
  const handleToggle = useCallback(() => {
    setExpanded(prev => !prev);
  }, []);

  // 复制摘要内容
  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (block.content) {
      try {
        await navigator.clipboard.writeText(block.content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (error) {
        console.error('复制失败:', error);
      }
    }
  }, [block.content]);

  return (
    <Paper
      elevation={1}
      sx={{
        border: `1px solid ${theme.palette.divider}`,
        borderLeft: `4px solid ${theme.palette.primary.main}`,
        borderRadius: 2,
        overflow: 'hidden',
        backgroundColor: theme.palette.background.paper,
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          borderColor: theme.palette.primary.main,
          boxShadow: theme.shadows[3]
        }
      }}
    >
      {/* 头部区域 - 可点击展开/折叠 */}
      <Box
        onClick={handleToggle}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1.5,
          cursor: 'pointer',
          userSelect: 'none',
          WebkitTapHighlightColor: 'transparent',
          backgroundColor: theme.palette.mode === 'dark'
            ? alpha(theme.palette.primary.main, 0.15)
            : alpha(theme.palette.primary.main, 0.08),
          '&:hover': {
            backgroundColor: theme.palette.mode === 'dark'
              ? alpha(theme.palette.primary.main, 0.25)
              : alpha(theme.palette.primary.main, 0.12)
          }
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {/* 压缩图标 */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 36,
              height: 36,
              borderRadius: 1.5,
              backgroundColor: theme.palette.primary.main,
              color: theme.palette.primary.contrastText,
              boxShadow: theme.shadows[2]
            }}
          >
            <CompressIcon size={18} />
          </Box>

          {/* 标题和统计信息 */}
          <Box>
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: 600,
                color: theme.palette.primary.main,
                lineHeight: 1.3
              }}
            >
              {t('chat.contextSummary.title', '上下文压缩摘要')}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                color: theme.palette.text.secondary,
                display: 'flex',
                alignItems: 'center',
                gap: 0.5
              }}
            >
              {t('chat.contextSummary.compressedCount', {
                defaultValue: '已压缩 {{count}} 条消息',
                count: block.originalMessageCount
              })}
            </Typography>
          </Box>
        </Box>

        {/* 右侧操作区域 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {/* Token 节省统计 */}
          <Chip
            icon={<TokenIcon size={14} />}
            label={t('chat.contextSummary.tokensSaved', {
              defaultValue: '节省 {{saved}} tokens ({{percent}}%)',
              saved: block.tokensSaved.toLocaleString(),
              percent: savedPercentage
            })}
            size="small"
            sx={{
              height: 24,
              backgroundColor: alpha(theme.palette.success.main, 0.12),
              color: theme.palette.success.main,
              fontWeight: 500,
              fontSize: '0.7rem',
              '& .MuiChip-icon': {
                color: 'inherit'
              }
            }}
          />

          {/* 复制按钮 */}
          <Tooltip title={copied ? t('common.copied', '已复制') : t('common.copy', '复制')}>
            <IconButton
              size="small"
              onClick={handleCopy}
              sx={{
                color: copied ? theme.palette.success.main : theme.palette.text.secondary
              }}
            >
              {copied ? <CheckIcon fontSize="small" /> : <CopyIcon fontSize="small" />}
            </IconButton>
          </Tooltip>

          {/* 展开/折叠按钮 */}
          <IconButton size="small" sx={{ color: theme.palette.text.secondary }}>
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>
      </Box>

      {/* 折叠的详细信息 */}
      <Collapse in={expanded}>
        <Divider />

        {/* 摘要内容 */}
        <Box
          sx={{
            p: 2,
            backgroundColor: theme.palette.background.default,
            maxHeight: '400px',
            overflow: 'auto'
          }}
        >
          <Markdown
            content={block.content}
            allowHtml={false}
          />
        </Box>

        <Divider />

        {/* 底部元信息 */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 1,
            px: 2,
            py: 1.5,
            backgroundColor: theme.palette.mode === 'dark'
              ? alpha(theme.palette.common.white, 0.05)
              : alpha(theme.palette.common.black, 0.03)
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {/* 压缩时间 */}
            <Typography
              variant="caption"
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                color: theme.palette.text.secondary
              }}
            >
              <TimeIcon size={14} />
              {formatTime(block.compressedAt)}
            </Typography>

            {/* Token 变化详情 */}
            <Typography
              variant="caption"
              sx={{ color: theme.palette.text.secondary }}
            >
              {block.originalTokens.toLocaleString()} → {block.compressedTokens.toLocaleString()} tokens
            </Typography>

            {/* 压缩成本（如果有） */}
            {block.cost !== undefined && block.cost > 0 && (
              <Typography
                variant="caption"
                sx={{ color: theme.palette.text.secondary }}
              >
                {t('chat.contextSummary.cost', {
                  defaultValue: '成本: ${{cost}}',
                  cost: block.cost.toFixed(4)
                })}
              </Typography>
            )}
          </Box>

          {/* 使用的模型 */}
          {block.modelId && (
            <Typography
              variant="caption"
              sx={{ color: theme.palette.text.secondary }}
            >
              {t('chat.contextSummary.model', {
                defaultValue: '模型: {{model}}',
                model: block.modelId
              })}
            </Typography>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
};

export default React.memo(ContextSummaryBlock);