import React, { useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Collapse,
  IconButton,
  Link,
  useTheme,
  Chip
} from '@mui/material';
import { ChevronDown as ExpandMoreIcon, Copy as ContentCopyIcon, Link as LinkIcon, ExternalLink as OpenInNewIcon } from 'lucide-react';
import { styled } from '@mui/material/styles';
import { useDeepMemo } from '../../../hooks/useMemoization';
import { MessageBlockStatus } from '../../../shared/types/newMessage';
import type { CitationMessageBlock } from '../../../shared/types/newMessage';
import Markdown from '../Markdown';
import { EventEmitter } from '../../../shared/services/EventEmitter';

interface Props {
  block: CitationMessageBlock;
}

/**
 * 引用块组件
 * 显示引用的内容和来源
 */
const CitationBlock: React.FC<Props> = ({ block }) => {
  const [expanded, setExpanded] = useState(true);
  const [copied, setCopied] = useState(false);
  const theme = useTheme();

  // 使用记忆化的block内容，避免不必要的重渲染
  const memoizedContent = useDeepMemo(() => block.content, [block.content]);
  const memoizedSources = useDeepMemo(() => block.sources, [block.sources]);

  // 复制引用内容到剪贴板
  const handleCopy = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); // 防止触发折叠/展开
    if (block.content) {
      navigator.clipboard.writeText(block.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      EventEmitter.emit('ui:copy_success', { content: '已复制引用内容' });
    }
  }, [block.content]);

  // 切换折叠/展开状态
  const toggleExpanded = useCallback(() => {
    setExpanded(!expanded);
  }, [expanded]);

  // 打开链接
  const handleOpenLink = useCallback((url: string, e: React.MouseEvent) => {
    e.stopPropagation(); // 防止触发折叠/展开
    window.open(url, '_blank', 'noopener,noreferrer');
  }, []);

  // 获取引用类型名称
  const getCitationType = useCallback(() => {
    if (block.source === 'web_search') {
      return '网络搜索';
    } else if (block.source === 'knowledge_base') {
      return '知识库';
    } else if (block.source === 'document') {
      return '文档';
    }
    return '引用';
  }, [block.source]);

  // 格式化来源URL，确保以http或https开头
  const formatUrl = useCallback((url?: string) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    return `https://${url}`;
  }, []);

  const isProcessing = block.status === MessageBlockStatus.STREAMING ||
                       block.status === MessageBlockStatus.PROCESSING;

  // 如果没有引用内容，不渲染任何内容
  if (!block.sources || block.sources.length === 0) {
    return null;
  }

  return (
    <StyledPaper
      elevation={0}
      sx={{
        mb: 2,
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: '8px',
        overflow: 'hidden'
      }}
    >
      {/* 标题栏 */}
      <Box
        onClick={toggleExpanded}
        sx={{
          display: 'flex',
          alignItems: 'center',
          p: 1.5,
          cursor: 'pointer',
          borderBottom: expanded ? `1px solid ${theme.palette.divider}` : 'none',
          '&:hover': {
            backgroundColor: theme.palette.mode === 'dark'
              ? 'rgba(255, 255, 255, 0.05)'
              : 'rgba(0, 0, 0, 0.02)',
          }
        }}
      >
        <LinkIcon
          size={20}
          color={theme.palette.primary.main}
          style={{ marginRight: 8 }}
        />

        <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
          {getCitationType()}
          {isProcessing && (
            <Chip
              label="加载中"
              size="small"
              color="primary"
              variant="outlined"
              sx={{ ml: 1, height: 20 }}
            />
          )}
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <IconButton
            size="small"
            onClick={handleCopy}
            sx={{ mr: 1 }}
            color={copied ? "success" : "default"}
          >
            <ContentCopyIcon size={16} />
          </IconButton>

          <ExpandMoreIcon
            size={20}
            style={{
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s'
            }}
          />
        </Box>
      </Box>

      {/* 内容区域 */}
      <Collapse in={expanded}>
        <Box sx={{ p: 2 }}>
          {/* 引用内容 */}
          {memoizedContent && (
            <Box sx={{ mb: 2 }}>
              <Markdown content={memoizedContent} allowHtml={false} />
            </Box>
          )}

          {/* 来源列表 */}
          {memoizedSources && memoizedSources.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                来源:
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {memoizedSources.map((source, index) => (
                  <Paper
                    key={index}
                    variant="outlined"
                    sx={{
                      p: 1.5,
                      backgroundColor: theme.palette.mode === 'dark'
                        ? 'rgba(0, 0, 0, 0.2)'
                        : 'rgba(0, 0, 0, 0.03)',
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 'medium', mb: 0.5 }}>
                          {source.title || '未知标题'}
                        </Typography>
                        {source.url && (
                          <Link
                            href="#"
                            onClick={(e) => handleOpenLink(formatUrl(source.url), e)}
                            color="primary"
                            sx={{
                              fontSize: '0.8rem',
                              display: 'flex',
                              alignItems: 'center',
                              width: 'fit-content'
                            }}
                          >
                            {source.url.length > 50 ? `${source.url.substring(0, 50)}...` : source.url}
                            <OpenInNewIcon size={14} style={{ marginLeft: 4 }} />
                          </Link>
                        )}
                      </Box>
                    </Box>
                    {source.content && (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          mt: 1,
                          fontSize: '0.85rem',
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                      >
                        {source.content}
                      </Typography>
                    )}
                  </Paper>
                ))}
              </Box>
            </Box>
          )}
        </Box>
      </Collapse>
    </StyledPaper>
  );
};

// 样式化组件
const StyledPaper = styled(Paper)(({ theme }) => ({
  borderRadius: theme.shape.borderRadius,
  boxShadow: 'none',
  transition: theme.transitions.create(['background-color', 'box-shadow']),
}));

export default React.memo(CitationBlock);
