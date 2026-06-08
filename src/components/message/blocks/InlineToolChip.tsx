import React, { useState, useCallback } from 'react';
import { Box, Typography, Collapse, useTheme, alpha } from '@mui/material';
import { ChevronRight, Check, AlertCircle, Loader2, Wrench } from 'lucide-react';
import { keyframes } from '@mui/material/styles';

import { MessageBlockStatus } from '../../../shared/types/newMessage';
import type { ToolMessageBlock } from '../../../shared/types/newMessage';

interface Props {
  block: ToolMessageBlock;
}

const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

/**
 * 思考过程内嵌的简化工具块
 *
 * 与顶层 `ToolBlock` 的区别：仅展示工具名 + 状态，可展开查看参数/结果，
 * 不包含敏感操作确认等顶层交互。用于在思考块内部以「轻量 chip」形式
 * 呈现模型在思考阶段发起的工具调用。
 */
const InlineToolChip: React.FC<Props> = ({ block }) => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);

  const toolResponse = block.metadata?.rawMcpToolResponse;
  const isProcessing = block.status === MessageBlockStatus.STREAMING ||
                       block.status === MessageBlockStatus.PROCESSING;
  const hasError = block.status === MessageBlockStatus.ERROR;

  const toolName = block.toolName || toolResponse?.tool?.name || '工具调用';

  const formatParams = useCallback((): string => {
    const params = toolResponse?.arguments || block.arguments;
    if (!params) return '';
    try { return JSON.stringify(params, null, 2); }
    catch { return String(params); }
  }, [toolResponse, block.arguments]);

  const formatContent = useCallback((response: any): string => {
    if (!response) return '';
    if (response.isError) return `错误: ${response.content?.[0]?.text || '工具调用失败'}`;
    if (response.content?.length > 0) {
      return response.content.map((item: any) => {
        if (item.type === 'text') {
          try { return JSON.stringify(JSON.parse(item.text || ''), null, 2); }
          catch { return item.text || ''; }
        }
        return `[${item.type}: ${item.mimeType || 'unknown'}]`;
      }).join('\n');
    }
    return '';
  }, []);

  const getResult = useCallback((): string => {
    if (block.content && typeof block.content === 'object') return formatContent(block.content);
    if (toolResponse?.response) return formatContent(toolResponse.response);
    return '';
  }, [block.content, toolResponse, formatContent]);

  const params = formatParams();
  const result = getResult();
  const hasDetails = Boolean(params || result);

  const statusColor = hasError
    ? theme.palette.error.main
    : isProcessing
      ? theme.palette.warning.main
      : theme.palette.success.main;

  const renderStatusIcon = () => {
    if (isProcessing) {
      return (
        <Box sx={{ display: 'inline-flex', animation: `${spin} 1s linear infinite` }}>
          <Loader2 size={13} color={statusColor} />
        </Box>
      );
    }
    if (hasError) return <AlertCircle size={13} color={statusColor} />;
    return <Check size={13} color={statusColor} />;
  };

  const toggleExpanded = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasDetails) setExpanded(prev => !prev);
  }, [hasDetails]);

  return (
    <Box
      sx={{
        borderRadius: '8px',
        border: `1px solid ${alpha(statusColor, 0.25)}`,
        backgroundColor: alpha(statusColor, theme.palette.mode === 'dark' ? 0.08 : 0.05),
        overflow: 'hidden',
      }}
    >
      <Box
        onClick={toggleExpanded}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          px: 1,
          py: 0.5,
          cursor: hasDetails ? 'pointer' : 'default',
          minWidth: 0,
        }}
      >
        <Wrench size={13} color={theme.palette.text.secondary} />
        <Typography
          variant="caption"
          sx={{
            fontWeight: 600,
            fontSize: '0.72rem',
            color: theme.palette.text.primary,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            flexShrink: 1,
          }}
        >
          {toolName}
        </Typography>
        <Box sx={{ display: 'inline-flex', alignItems: 'center', ml: 0.25 }}>
          {renderStatusIcon()}
        </Box>
        <Box sx={{ flexGrow: 1 }} />
        {hasDetails && (
          <ChevronRight
            size={14}
            color={theme.palette.text.secondary}
            style={{
              transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s',
            }}
          />
        )}
      </Box>

      {hasDetails && (
        <Collapse in={expanded} timeout="auto" unmountOnExit>
          <Box sx={{ px: 1, pb: 0.75 }}>
            {params && (
              <Box sx={{ mb: result ? 0.75 : 0 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem', fontWeight: 600 }}>
                  参数
                </Typography>
                <Box
                  component="pre"
                  sx={{
                    m: 0,
                    mt: 0.25,
                    p: 0.75,
                    borderRadius: '6px',
                    backgroundColor: theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.04)',
                    fontSize: '0.68rem',
                    lineHeight: 1.4,
                    overflowX: 'auto',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {params}
                </Box>
              </Box>
            )}
            {result && (
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem', fontWeight: 600 }}>
                  结果
                </Typography>
                <Box
                  component="pre"
                  sx={{
                    m: 0,
                    mt: 0.25,
                    p: 0.75,
                    borderRadius: '6px',
                    backgroundColor: theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.04)',
                    fontSize: '0.68rem',
                    lineHeight: 1.4,
                    overflowX: 'auto',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {result}
                </Box>
              </Box>
            )}
          </Box>
        </Collapse>
      )}
    </Box>
  );
};

export default React.memo(InlineToolChip);
