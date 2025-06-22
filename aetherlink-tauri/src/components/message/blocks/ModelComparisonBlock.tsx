import React, { useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Tabs,
  Tab,
  Typography,
  Button,
  Chip,
  Alert,
  Card,
  CardContent,
  CardActions,
  Divider,
  Tooltip
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  AlertCircle as ErrorIcon,
  Clock as AccessTimeIcon,
  Zap as SpeedIcon,
  DollarSign as CostIcon,
  Brain as ReasoningIcon
} from 'lucide-react';
import { useTheme } from '@mui/material/styles';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../../../shared/store';
import type { ModelComparisonMessageBlock } from '../../../shared/types/newMessage';
import { updateOneBlock } from '../../../shared/store/slices/messageBlocksSlice';
import { handleUserSelection } from '../../../shared/utils/modelComparisonUtils';

interface ModelComparisonBlockProps {
  block: ModelComparisonMessageBlock;
}

const ModelComparisonBlock: React.FC<ModelComparisonBlockProps> = ({ block }) => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const [activeTab, setActiveTab] = useState(0);

  // 获取模型信息
  const providers = useSelector((state: RootState) => state.settings.providers);
  const getModelInfo = useCallback((modelId: string) => {
    for (const provider of providers) {
      const model = provider.models.find(m => m.id === modelId);
      if (model) {
        return {
          name: model.name,
          providerName: provider.name,
          avatar: provider.avatar,
          color: provider.color
        };
      }
    }
    return {
      name: modelId,
      providerName: 'Unknown',
      avatar: '',
      color: theme.palette.primary.main
    };
  }, [providers, theme]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleSelectModel = useCallback(async (modelId: string, content: string, resultIndex: number) => {
    try {
      // 创建唯一的选择标识符
      const selectedResultId = `${modelId}-${resultIndex}`;

      // 更新块状态
      const updatedBlock: ModelComparisonMessageBlock = {
        ...block,
        selectedModelId: selectedResultId,
        selectedContent: content,
        isSelectionPending: false
      };

      dispatch(updateOneBlock({ id: block.id, changes: updatedBlock }));

      // 处理用户选择，更新消息历史
      await handleUserSelection(block.messageId, selectedResultId, content);

      console.log(`[ModelComparisonBlock] 用户选择了模型 ${modelId} (索引 ${resultIndex}) 的回答`);
    } catch (error) {
      console.error(`[ModelComparisonBlock] 处理用户选择失败:`, error);
    }
  }, [block, dispatch]);

  const formatLatency = (latency?: number) => {
    if (!latency) return 'N/A';
    return latency < 1000 ? `${latency}ms` : `${(latency / 1000).toFixed(1)}s`;
  };

  const formatCost = (cost?: number) => {
    if (!cost) return 'Free';
    return `$${cost.toFixed(4)}`;
  };

  const { comboResult } = block;

  // 🔧 修复：验证数据完整性
  if (!comboResult || !comboResult.modelResults || !Array.isArray(comboResult.modelResults)) {
    console.error(`[ModelComparisonBlock] 对比分析块数据损坏: ${block.id}`);
    return (
      <Alert severity="error" sx={{ my: 2 }}>
        对比分析数据损坏，请重新生成对比结果。
      </Alert>
    );
  }

  // 过滤出成功的结果
  const successResults = comboResult.modelResults.filter(result => result.status === 'success');
  const errorResults = comboResult.modelResults.filter(result => result.status === 'error');

  if (successResults.length === 0) {
    return (
      <Alert severity="error" sx={{ my: 2 }}>
        所有模型都调用失败了。请检查模型配置和网络连接。
      </Alert>
    );
  }

  return (
    <Paper
      elevation={0}
      sx={{
        backgroundColor: theme.palette.background.paper,
        borderRadius: '12px',
        overflow: 'hidden',
        border: `1px solid ${theme.palette.divider}`,
        my: 1
      }}
    >
      {/* 头部信息 */}
      <Box sx={{ p: 2, backgroundColor: theme.palette.action.hover }}>
        <Typography variant="h6" gutterBottom>
          多模型对比分析
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          <Chip
            size="small"
            label={`${successResults.length} 个模型成功`}
            color="success"
            variant="outlined"
          />
          {errorResults.length > 0 && (
            <Chip
              size="small"
              label={`${errorResults.length} 个模型失败`}
              color="error"
              variant="outlined"
            />
          )}
          <Chip
            size="small"
            icon={<AccessTimeIcon />}
            label={formatLatency(comboResult.stats.totalLatency)}
            variant="outlined"
          />
          <Chip
            size="small"
            icon={<CostIcon />}
            label={formatCost(comboResult.stats.totalCost)}
            variant="outlined"
          />
        </Box>
      </Box>

      {/* 模型切换标签 */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ minHeight: 48 }}
        >
          {successResults.map((result, index) => {
            const modelInfo = getModelInfo(result.modelId);
            return (
              <Tab
                key={`${result.modelId}-${index}`}
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: modelInfo.color
                      }}
                    />
                    <Typography variant="body2">
                      {modelInfo.name}
                    </Typography>
                    {block.selectedModelId === `${result.modelId}-${index}` && (
                      <CheckCircleIcon size={16} style={{ color: '#4caf50' }} />
                    )}
                  </Box>
                }
                sx={{ minHeight: 48, textTransform: 'none' }}
              />
            );
          })}
        </Tabs>
      </Box>

      {/* 模型回答内容 */}
      <Box sx={{ p: 2 }}>
        {successResults.map((result, index) => (
          <Box
            key={`${result.modelId}-${index}`}
            sx={{
              display: activeTab === index ? 'block' : 'none'
            }}
          >
            {/* 模型信息卡片 */}
            <Card variant="outlined" sx={{ mb: 2 }}>
              <CardContent sx={{ pb: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                  <Typography variant="subtitle1" color="primary">
                    {getModelInfo(result.modelId).name}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Tooltip title="响应时间">
                      <Chip
                        size="small"
                        icon={<SpeedIcon />}
                        label={formatLatency(result.latency)}
                        variant="outlined"
                      />
                    </Tooltip>
                    {result.confidence && (
                      <Tooltip title="置信度">
                        <Chip
                          size="small"
                          label={`${(result.confidence * 100).toFixed(0)}%`}
                          variant="outlined"
                          color={result.confidence > 0.8 ? 'success' : result.confidence > 0.6 ? 'warning' : 'error'}
                        />
                      </Tooltip>
                    )}
                  </Box>
                </Box>

                {/* 推理内容 */}
                {result.reasoning && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      <ReasoningIcon size={16} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                      推理过程
                    </Typography>
                    <Paper
                      variant="outlined"
                      sx={{
                        p: 1.5,
                        backgroundColor: theme.palette.action.hover,
                        maxHeight: 200,
                        overflow: 'auto'
                      }}
                    >
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                        {result.reasoning}
                      </Typography>
                    </Paper>
                  </Box>
                )}

                {/* 主要回答内容 */}
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    回答内容
                  </Typography>
                  <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                    {result.content}
                  </Typography>
                </Box>
              </CardContent>

              {/* 选择按钮 */}
              {block.isSelectionPending !== false && (
                <CardActions sx={{ pt: 0 }}>
                  <Button
                    variant={block.selectedModelId === `${result.modelId}-${index}` ? "contained" : "outlined"}
                    color="primary"
                    onClick={() => handleSelectModel(result.modelId, result.content, index)}
                    startIcon={block.selectedModelId === `${result.modelId}-${index}` ? <CheckCircleIcon /> : undefined}
                    sx={{ ml: 'auto' }}
                  >
                    {block.selectedModelId === `${result.modelId}-${index}` ? '已选择' : '选择此答案'}
                  </Button>
                </CardActions>
              )}
            </Card>
          </Box>
        ))}
      </Box>

      {/* 错误信息 */}
      {errorResults.length > 0 && (
        <Box sx={{ p: 2, pt: 0 }}>
          <Divider sx={{ mb: 2 }} />
          <Typography variant="body2" color="text.secondary" gutterBottom>
            失败的模型：
          </Typography>
          {errorResults.map((result, index) => (
            <Alert
              key={`error-${result.modelId}-${index}`}
              severity="error"
              sx={{ mb: 1 }}
              icon={<ErrorIcon />}
            >
              <Typography variant="body2">
                <strong>{getModelInfo(result.modelId).name}</strong>: {result.error}
              </Typography>
            </Alert>
          ))}
        </Box>
      )}

      {/* 选择提示 */}
      {block.isSelectionPending !== false && !block.selectedModelId && (
        <Box sx={{ p: 2, pt: 0 }}>
          <Alert severity="info">
            请选择一个最满意的回答作为正式答案，其他回答将被清理。
          </Alert>
        </Box>
      )}
    </Paper>
  );
};

export default ModelComparisonBlock;
