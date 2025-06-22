import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Chip,
  CircularProgress,
  Button,
  Collapse
} from '@mui/material';
import {
  MessageSquare as ForumIcon,
  User as PersonIcon,
  CheckCircle as CheckCircleIcon,
  ChevronDown as ExpandMoreIcon,
  ChevronUp as ExpandLessIcon,
  Trash2 as CleaningServicesIcon,
  RefreshCw as RefreshIcon
} from 'lucide-react';
import { TopicStatsService } from '../../shared/services/topics/TopicStatsService';
import { useSelector } from 'react-redux';

import type { Assistant } from '../../shared/types/Assistant';

/**
 * 话题统计显示组件
 * 用于显示话题统计信息，包括有效话题数、无效话题数、各助手话题数等
 */
export const TopicStatsDisplay: React.FC = () => {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [stats, setStats] = useState<{
    totalCount: number;
    validCount: number;
    invalidCount: number;
    byAssistantId: Record<string, number>;
  } | null>(null);

  // 从Redux获取助手数据，直接读取最新状态
  const assistants = useSelector((state: any) => {
    return state.assistants?.assistants || [];
  }) as Assistant[];

  // 加载话题统计数据
  const loadStats = async () => {
    setLoading(true);
    try {
      const topicStats = await TopicStatsService.getTopicsStats();
      setStats({
        totalCount: topicStats.totalCount,
        validCount: topicStats.validCount,
        invalidCount: topicStats.invalidCount,
        byAssistantId: topicStats.byAssistantId
      });
    } catch (error) {
      console.error('加载话题统计信息失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 清理无效话题
  const cleanupInvalidTopics = async () => {
    setCleaning(true);
    try {
      const result = await TopicStatsService.cleanupInvalidTopics();
      console.log(`清理完成: 已删除 ${result.removed} 个无效话题，剩余 ${result.total} 个话题`);
      // 重新加载统计数据
      await loadStats();
    } catch (error) {
      console.error('清理无效话题失败:', error);
    } finally {
      setCleaning(false);
    }
  };

  // 初始加载
  useEffect(() => {
    loadStats();
  }, []);

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        overflow: 'hidden',
        mb: 2
      }}
    >
      {/* 标题栏 */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer'
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <ForumIcon color="#1976d2" style={{ marginRight: 8 }} />
          <Typography variant="subtitle1" fontWeight="medium">
            话题统计
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          {!loading && stats && (
            <Chip
              label={`共 ${stats.totalCount} 个话题`}
              size="small"
              color={stats.invalidCount > 0 ? "warning" : "success"}
              sx={{ mr: 1 }}
            />
          )}
          {loading ? <CircularProgress size={20} /> : (expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />)}
        </Box>
      </Box>

      {/* 展开内容 */}
      <Collapse in={expanded}>
        <Divider sx={{ my: 1.5 }} />

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={24} />
          </Box>
        ) : stats ? (
          <>
            {/* 主要统计信息 */}
            <List dense disablePadding>
              <ListItem>
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <CheckCircleIcon color={stats.invalidCount > 0 ? "warning" : "success"} />
                </ListItemIcon>
                <ListItemText
                  primary={`有效话题: ${stats.validCount}/${stats.totalCount}`}
                  secondary={stats.invalidCount > 0 ? `发现 ${stats.invalidCount} 个无效话题` : undefined}
                />
              </ListItem>

              {/* 按助手统计的话题数 - 显示Redux实时数据 */}
              <Typography variant="caption" color="text.secondary" sx={{ pl: 2, mt: 1, display: 'block' }}>
                各助手话题数 (实时):
              </Typography>

              {assistants.map((assistant: Assistant) => {
                const reduxTopicCount = assistant.topics?.length || assistant.topicIds?.length || 0;
                const dbTopicCount = stats.byAssistantId[assistant.id] || 0;
                const hasDiscrepancy = reduxTopicCount !== dbTopicCount;

                return (
                  <ListItem key={assistant.id} sx={{ pl: 4 }}>
                    <ListItemIcon sx={{ minWidth: 28 }}>
                      <PersonIcon fontSize="small" color={hasDiscrepancy ? "warning" : "inherit"} />
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Typography variant="body2">
                          {assistant.name}
                        </Typography>
                      }
                      secondary={
                        <Typography
                          variant="caption"
                          color={hasDiscrepancy ? 'warning.main' : 'text.secondary'}
                        >
                          {hasDiscrepancy
                            ? `Redux: ${reduxTopicCount} | DB: ${dbTopicCount} 个话题`
                            : `${reduxTopicCount} 个话题`
                          }
                        </Typography>
                      }
                    />
                  </ListItem>
                );
              })}

              {Object.keys(stats.byAssistantId).length === 0 && (
                <Typography variant="caption" color="text.secondary" sx={{ pl: 4, py: 1, display: 'block' }}>
                  没有分配给助手的话题
                </Typography>
              )}
            </List>

            {/* 操作按钮 */}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2, gap: 1 }}>
              {stats.invalidCount > 0 && (
                <Button
                  startIcon={<CleaningServicesIcon />}
                  size="small"
                  variant="outlined"
                  color="warning"
                  onClick={cleanupInvalidTopics}
                  disabled={cleaning}
                >
                  {cleaning ? <CircularProgress size={20} /> : '清理无效话题'}
                </Button>
              )}

              <Button
                startIcon={<RefreshIcon />}
                size="small"
                variant="text"
                onClick={loadStats}
                disabled={loading}
              >
                刷新
              </Button>
            </Box>
          </>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
            无法加载话题统计信息
          </Typography>
        )}
      </Collapse>
    </Paper>
  );
};