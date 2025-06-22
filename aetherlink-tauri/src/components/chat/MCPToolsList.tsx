import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  Alert,
  Chip,
  LinearProgress
} from '@mui/material';
import {
  Play as PlayAllIcon,
  RefreshCw as RefreshIcon
} from 'lucide-react';
import type { MCPToolResponse, MCPCallToolResponse } from '../../shared/types';
import { parseAndCallTools } from '../../shared/utils/mcpToolParser';

/**
 * MCP 工具列表组件
 * 用于显示和管理 MCP 工具的执行状态
 */
interface MCPToolsListProps {
  toolResponses: MCPToolResponse[];
  onUpdate?: (toolResponses: MCPToolResponse[]) => void;
  autoExecute?: boolean;
  showControls?: boolean;
}

const MCPToolsList: React.FC<MCPToolsListProps> = ({
  toolResponses,
  onUpdate,
  autoExecute = false,
  showControls = true
}) => {
  const [tools, setTools] = useState<MCPToolResponse[]>(toolResponses);
  const [executing, setExecuting] = useState(false);
  const [progress, setProgress] = useState(0);

  // 同步外部传入的工具响应数据
  useEffect(() => {
    setTools(toolResponses);
  }, [toolResponses]);

  // 处理单个工具状态更新
  const handleToolUpdate = useCallback((updatedTool: MCPToolResponse, _result: MCPCallToolResponse) => {
    const updatedTools = tools.map(tool =>
      tool.id === updatedTool.id ? updatedTool : tool
    );

    setTools(updatedTools);

    if (onUpdate) {
      onUpdate(updatedTools);
    }
  }, [tools, onUpdate]);

  // 批量执行所有待执行的工具
  const handleExecuteAll = useCallback(async () => {
    if (executing) return;

    const pendingTools = tools.filter(tool => tool.status === 'pending');
    if (pendingTools.length === 0) return;

    setExecuting(true);
    setProgress(0);

    try {
      let completedCount = 0;

      // 并行执行所有待执行工具
      const promises = pendingTools.map(async (tool) => {
        try {
          // 创建执行中状态的工具副本
          const invokingTool = { ...tool, status: 'invoking' as const };

          setTools(prevTools =>
            prevTools.map(t => t.id === tool.id ? invokingTool : t)
          );

          const result = await parseAndCallTools([invokingTool], [], (toolResponse, callResult) => {
            handleToolUpdate(toolResponse, callResult);
          });

          completedCount++;
          setProgress((completedCount / pendingTools.length) * 100);

          return result;
        } catch (error) {
          console.error(`工具 ${tool.tool.name} 执行失败:`, error);

          const errorResult: MCPCallToolResponse = {
            isError: true,
            content: [
              {
                type: 'text',
                text: `工具执行失败: ${error instanceof Error ? error.message : '未知错误'}`
              }
            ]
          };

          // 创建错误状态的工具副本
          const errorTool = {
            ...tool,
            status: 'error' as const,
            response: errorResult
          };

          handleToolUpdate(errorTool, errorResult);

          completedCount++;
          setProgress((completedCount / pendingTools.length) * 100);
        }
      });

      await Promise.all(promises);
    } catch (error) {
      console.error('批量执行工具失败:', error);
    } finally {
      setExecuting(false);
      setProgress(0);
    }
  }, [executing, tools, handleToolUpdate]);

  // 重试所有失败的工具
  const handleRetryFailed = useCallback(() => {
    const updatedTools = tools.map(tool =>
      tool.status === 'error' ? { ...tool, status: 'pending' as const, response: undefined } : tool
    );

    setTools(updatedTools);

    if (onUpdate) {
      onUpdate(updatedTools);
    }
  }, [tools, onUpdate]);

  // 自动执行待执行的工具
  useEffect(() => {
    if (autoExecute && tools.some(tool => tool.status === 'pending')) {
      handleExecuteAll();
    }
  }, [autoExecute, tools, handleExecuteAll]);

  // 计算各状态工具数量
  const statusCounts = useMemo(() => {
    const counts = {
      pending: 0,
      invoking: 0,
      done: 0,
      error: 0
    };

    tools.forEach(tool => {
      counts[tool.status]++;
    });

    return counts;
  }, [tools]);

  // 计算状态标识
  const hasFailedTools = useMemo(() => statusCounts.error > 0, [statusCounts.error]);
  const hasPendingTools = useMemo(() => statusCounts.pending > 0, [statusCounts.pending]);
  const allCompleted = useMemo(() =>
    statusCounts.pending === 0 && statusCounts.invoking === 0,
    [statusCounts.pending, statusCounts.invoking]
  );

  if (tools.length === 0) {
    return null;
  }

  return (
    <Box sx={{ mb: 2 }}>
      {/* 工具列表头部 */}
      <Box sx={{ mb: 2 }}>
        {/* 标题和控制按钮 */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            MCP 工具调用
            <Chip
              label={`${tools.length} 个工具`}
              size="small"
              variant="outlined"
            />
          </Typography>

          {showControls && (
            <Box sx={{ display: 'flex', gap: 1 }}>
              {hasFailedTools && (
                <Button
                  size="small"
                  startIcon={<RefreshIcon />}
                  onClick={handleRetryFailed}
                  color="error"
                  variant="outlined"
                >
                  重试失败
                </Button>
              )}

              {hasPendingTools && (
                <Button
                  size="small"
                  startIcon={<PlayAllIcon />}
                  onClick={handleExecuteAll}
                  disabled={executing}
                  variant="contained"
                >
                  {executing ? '执行中...' : '执行全部'}
                </Button>
              )}
            </Box>
          )}
        </Box>

        {/* 状态统计 */}
        <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
          {statusCounts.pending > 0 && (
            <Chip label={`待执行: ${statusCounts.pending}`} size="small" color="default" />
          )}
          {statusCounts.invoking > 0 && (
            <Chip label={`执行中: ${statusCounts.invoking}`} size="small" color="primary" />
          )}
          {statusCounts.done > 0 && (
            <Chip label={`已完成: ${statusCounts.done}`} size="small" color="success" />
          )}
          {statusCounts.error > 0 && (
            <Chip label={`失败: ${statusCounts.error}`} size="small" color="error" />
          )}
        </Box>

        {/* 执行进度条 */}
        {executing && (
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{ mb: 1 }}
          />
        )}

        {/* 状态提示 */}
        {allCompleted && statusCounts.done > 0 && statusCounts.error === 0 && (
          <Alert severity="success" sx={{ mb: 1 }}>
            所有工具执行完成！
          </Alert>
        )}

        {hasFailedTools && (
          <Alert severity="error" sx={{ mb: 1 }}>
            有 {statusCounts.error} 个工具执行失败，请检查错误信息或重试。
          </Alert>
        )}
      </Box>

      {/* 工具列表 */}
      <Box>
        {tools.map((toolResponse) => (
          <Box key={toolResponse.id} sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary">
              工具: {toolResponse.tool.name}
            </Typography>
            <Typography variant="body2">
              状态: {toolResponse.status}
            </Typography>
            {toolResponse.response && (
              <Typography variant="body2">
                结果: {JSON.stringify(toolResponse.response, null, 2)}
              </Typography>
            )}
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default MCPToolsList;
