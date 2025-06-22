import React, { useState, useCallback, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Tabs,
  Tab,
  IconButton,
  Chip,
  useTheme,

  Divider
} from '@mui/material';
import { Copy as ContentCopyIcon, ArrowLeftRight as CompareArrowsIcon } from 'lucide-react';
import { styled } from '@mui/material/styles';
import { useDeepMemo } from '../../../hooks/useMemoization';
import { MessageBlockStatus } from '../../../shared/types/newMessage';
import type { MultiModelMessageBlock } from '../../../shared/types/newMessage';
import Markdown from '../Markdown';
import { EventEmitter } from '../../../shared/services/EventEmitter';

interface Props {
  block: MultiModelMessageBlock;
}

/**
 * 多模型对比块组件
 * 显示多个模型的回答，支持标签页切换
 */
const MultiModelBlock: React.FC<Props> = ({ block }) => {
  const [activeTab, setActiveTab] = useState(0);
  const [copied, setCopied] = useState(false);
  const theme = useTheme();

  // 使用记忆化的block内容，避免不必要的重渲染
  const memoizedResponses = useDeepMemo(() => block.responses || [], [block.responses]);

  // 获取当前活动的响应
  const activeResponse = useMemo(() => {
    if (!memoizedResponses || memoizedResponses.length === 0) {
      return null;
    }
    return memoizedResponses[activeTab] || memoizedResponses[0];
  }, [memoizedResponses, activeTab]);

  // 处理标签页切换
  const handleTabChange = useCallback((_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  }, []);

  // 复制当前响应内容到剪贴板
  const handleCopy = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); // 防止触发其他事件
    if (activeResponse?.content) {
      navigator.clipboard.writeText(activeResponse.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      EventEmitter.emit('ui:copy_success', { content: '已复制模型回答' });
    }
  }, [activeResponse]);

  // 如果没有响应，不渲染任何内容
  if (!memoizedResponses || memoizedResponses.length === 0) {
    return null;
  }

  // 获取响应状态标签
  const getStatusChip = (status: MessageBlockStatus) => {
    if (status === MessageBlockStatus.STREAMING || status === MessageBlockStatus.PROCESSING) {
      return (
        <Chip
          label="生成中"
          size="small"
          color="primary"
          variant="outlined"
          sx={{ ml: 1, height: 20 }}
        />
      );
    } else if (status === MessageBlockStatus.ERROR) {
      return (
        <Chip
          label="错误"
          size="small"
          color="error"
          variant="outlined"
          sx={{ ml: 1, height: 20 }}
        />
      );
    }
    return null;
  };

  // 根据显示样式选择不同的渲染方式
  if (block.displayStyle === 'grid') {
    // 网格布局
    return (
      <Box sx={{ width: '100%', mt: 2 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
          {memoizedResponses.map((response, index) => (
            <Paper
              key={index}
              variant="outlined"
              sx={{
                p: 2,
                height: '100%',
                position: 'relative'
              }}
            >
              <Box sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 1,
                pb: 1,
                borderBottom: `1px solid ${theme.palette.divider}`
              }}>
                <Typography variant="subtitle2">
                  {response.modelId || response.modelName || `模型 ${index + 1}`}
                  {getStatusChip(response.status)}
                </Typography>
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (response.content) {
                      navigator.clipboard.writeText(response.content);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                      EventEmitter.emit('ui:copy_success', { content: '已复制模型回答' });
                    }
                  }}
                  color={copied ? "success" : "default"}
                >
                  <ContentCopyIcon size={16} />
                </IconButton>
              </Box>
              <Markdown content={response.content || ''} allowHtml={false} />
            </Paper>
          ))}
        </Box>
      </Box>
    );
  } else if (block.displayStyle === 'vertical') {
    // 垂直布局
    return (
      <Box sx={{ width: '100%', mt: 2 }}>
        {memoizedResponses.map((response, index) => (
          <Paper
            key={index}
            variant="outlined"
            sx={{
              p: 2,
              mb: 2,
              position: 'relative'
            }}
          >
            <Box sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 1,
              pb: 1,
              borderBottom: `1px solid ${theme.palette.divider}`
            }}>
              <Typography variant="subtitle2">
                {response.modelId || response.modelName || `模型 ${index + 1}`}
                {getStatusChip(response.status)}
              </Typography>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  if (response.content) {
                    navigator.clipboard.writeText(response.content);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                    EventEmitter.emit('ui:copy_success', { content: '已复制模型回答' });
                  }
                }}
                color={copied ? "success" : "default"}
              >
                <ContentCopyIcon size={16} />
              </IconButton>
            </Box>
            <Markdown content={response.content || ''} allowHtml={false} />
          </Paper>
        ))}
      </Box>
    );
  } else {
    // 默认水平标签页布局
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
          sx={{
            display: 'flex',
            alignItems: 'center',
            p: 1.5,
            borderBottom: `1px solid ${theme.palette.divider}`
          }}
        >
          <CompareArrowsIcon
            color={theme.palette.info.main}
            style={{ marginRight: 8 }}
          />

          <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
            多模型对比
            {memoizedResponses.length > 0 && (
              <Typography component="span" variant="caption" sx={{ ml: 1, color: 'text.secondary' }}>
                ({memoizedResponses.length} 个模型)
              </Typography>
            )}
          </Typography>

          <IconButton
            size="small"
            onClick={handleCopy}
            color={copied ? "success" : "default"}
            disabled={!activeResponse?.content}
          >
            <ContentCopyIcon size={16} />
          </IconButton>
        </Box>

        {/* 标签页 */}
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            minHeight: '40px',
            '& .MuiTab-root': {
              minHeight: '40px',
              py: 0.5,
              px: 2,
              fontSize: '0.85rem',
            }
          }}
        >
          {memoizedResponses.map((response, index) => (
            <Tab
              key={index}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  {response.modelId || response.modelName || `模型 ${index + 1}`}
                  {getStatusChip(response.status)}
                </Box>
              }
              sx={{ textTransform: 'none' }}
            />
          ))}
        </Tabs>

        <Divider />

        {/* 内容区域 */}
        <Box sx={{ p: 2 }}>
          {activeResponse ? (
            activeResponse.status === MessageBlockStatus.ERROR ? (
              <Typography color="error" variant="body2">
                生成回答时出错，请重试
              </Typography>
            ) : (
              <Markdown content={activeResponse.content || ''} allowHtml={false} />
            )
          ) : (
            <Typography color="text.secondary" variant="body2">
              没有可用的回答
            </Typography>
          )}
        </Box>

        {/* 模型信息 */}
        {activeResponse && (activeResponse.modelId || activeResponse.modelName) && (
          <Box
            sx={{
              p: 1.5,
              borderTop: `1px solid ${theme.palette.divider}`,
              backgroundColor: theme.palette.mode === 'dark' ? 'rgba(0, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0.03)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <Typography variant="caption" color="text.secondary">
              模型: {activeResponse.modelId || activeResponse.modelName}
            </Typography>


          </Box>
        )}
      </StyledPaper>
    );
  }
};

// 样式化组件
const StyledPaper = styled(Paper)(({ theme }) => ({
  borderRadius: theme.shape.borderRadius,
  boxShadow: 'none',
  transition: theme.transitions.create(['background-color', 'box-shadow']),
}));

export default React.memo(MultiModelBlock);
