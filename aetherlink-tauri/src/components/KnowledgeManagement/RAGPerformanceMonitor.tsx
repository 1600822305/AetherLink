/**
 * RAG性能监控组件
 * 显示搜索性能指标和统计信息
 */
import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  LinearProgress,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon
} from '@mui/material';
import {
  Zap as SpeedIcon,
  Sparkles as AutoAwesomeIcon,
  TrendingUp as TrendingUpIcon,
  BarChart as AssessmentIcon,
  Timer as TimerIcon,
  Search as SearchIcon
} from 'lucide-react';

interface PerformanceMetrics {
  searchTime: number;
  mode: 'simple' | 'enhanced';
  resultsCount: number;
  queryLength: number;
  timestamp: number;
}

interface RAGPerformanceMonitorProps {
  metrics?: PerformanceMetrics[];
  currentMetrics?: PerformanceMetrics;
}

export const RAGPerformanceMonitor: React.FC<RAGPerformanceMonitorProps> = ({
  metrics = [],
  currentMetrics
}) => {
  const [averageMetrics, setAverageMetrics] = useState({
    simpleSearchTime: 0,
    enhancedSearchTime: 0,
    simpleResultsCount: 0,
    enhancedResultsCount: 0,
    totalSearches: 0
  });

  useEffect(() => {
    if (metrics.length === 0) return;

    const simpleSearches = metrics.filter(m => m.mode === 'simple');
    const enhancedSearches = metrics.filter(m => m.mode === 'enhanced');

    const avgSimpleTime = simpleSearches.length > 0
      ? simpleSearches.reduce((sum, m) => sum + m.searchTime, 0) / simpleSearches.length
      : 0;

    const avgEnhancedTime = enhancedSearches.length > 0
      ? enhancedSearches.reduce((sum, m) => sum + m.searchTime, 0) / enhancedSearches.length
      : 0;

    const avgSimpleResults = simpleSearches.length > 0
      ? simpleSearches.reduce((sum, m) => sum + m.resultsCount, 0) / simpleSearches.length
      : 0;

    const avgEnhancedResults = enhancedSearches.length > 0
      ? enhancedSearches.reduce((sum, m) => sum + m.resultsCount, 0) / enhancedSearches.length
      : 0;

    setAverageMetrics({
      simpleSearchTime: avgSimpleTime,
      enhancedSearchTime: avgEnhancedTime,
      simpleResultsCount: avgSimpleResults,
      enhancedResultsCount: avgEnhancedResults,
      totalSearches: metrics.length
    });
  }, [metrics]);

  const getPerformanceColor = (time: number) => {
    if (time < 500) return 'success';
    if (time < 1000) return 'warning';
    return 'error';
  };

  const getSpeedImprovement = () => {
    if (averageMetrics.simpleSearchTime === 0 || averageMetrics.enhancedSearchTime === 0) {
      return null;
    }

    const improvement = ((averageMetrics.enhancedSearchTime - averageMetrics.simpleSearchTime) / averageMetrics.simpleSearchTime) * 100;
    return improvement;
  };

  const speedImprovement = getSpeedImprovement();

  return (
    <Paper elevation={1} sx={{ p: 2, mt: 2 }}>
      <Box display="flex" alignItems="center" gap={1} mb={2}>
        <AssessmentIcon color="primary" />
        <Typography variant="h6">
          RAG性能监控
        </Typography>
      </Box>

      <Grid container spacing={2}>
        {/* 当前搜索指标 */}
        {currentMetrics && (
          <Grid size={12}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle2" gutterBottom>
                  当前搜索
                </Typography>
                <Box display="flex" gap={2} alignItems="center">
                  <Chip
                    icon={currentMetrics.mode === 'enhanced' ? <AutoAwesomeIcon /> : <SpeedIcon />}
                    label={currentMetrics.mode === 'enhanced' ? '增强RAG' : '简单搜索'}
                    color={currentMetrics.mode === 'enhanced' ? 'success' : 'default'}
                    size="small"
                  />
                  <Chip
                    icon={<TimerIcon />}
                    label={`${currentMetrics.searchTime}ms`}
                    color={getPerformanceColor(currentMetrics.searchTime)}
                    size="small"
                  />
                  <Chip
                    icon={<SearchIcon />}
                    label={`${currentMetrics.resultsCount} 结果`}
                    size="small"
                  />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* 平均性能对比 */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle2" gutterBottom>
                平均搜索时间
              </Typography>
              <Box mb={2}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <SpeedIcon fontSize="small" />
                    <Typography variant="body2">简单搜索</Typography>
                  </Box>
                  <Typography variant="body2" fontWeight="bold">
                    {averageMetrics.simpleSearchTime.toFixed(0)}ms
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={Math.min((averageMetrics.simpleSearchTime / 2000) * 100, 100)}
                  color={getPerformanceColor(averageMetrics.simpleSearchTime)}
                />
              </Box>

              <Box>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <AutoAwesomeIcon fontSize="small" />
                    <Typography variant="body2">增强RAG</Typography>
                  </Box>
                  <Typography variant="body2" fontWeight="bold">
                    {averageMetrics.enhancedSearchTime.toFixed(0)}ms
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={Math.min((averageMetrics.enhancedSearchTime / 2000) * 100, 100)}
                  color={getPerformanceColor(averageMetrics.enhancedSearchTime)}
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* 结果质量对比 */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle2" gutterBottom>
                平均结果数量
              </Typography>
              <Box mb={2}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <SpeedIcon fontSize="small" />
                    <Typography variant="body2">简单搜索</Typography>
                  </Box>
                  <Typography variant="body2" fontWeight="bold">
                    {averageMetrics.simpleResultsCount.toFixed(1)}
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={(averageMetrics.simpleResultsCount / 10) * 100}
                  color="primary"
                />
              </Box>

              <Box>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <AutoAwesomeIcon fontSize="small" />
                    <Typography variant="body2">增强RAG</Typography>
                  </Box>
                  <Typography variant="body2" fontWeight="bold">
                    {averageMetrics.enhancedResultsCount.toFixed(1)}
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={(averageMetrics.enhancedResultsCount / 10) * 100}
                  color="success"
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* 性能改进指标 */}
        {speedImprovement !== null && (
          <Grid size={12}>
            <Card variant="outlined">
              <CardContent>
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  <TrendingUpIcon color="primary" />
                  <Typography variant="subtitle2">
                    性能对比分析
                  </Typography>
                </Box>

                <Box display="flex" gap={2} alignItems="center">
                  <Chip
                    label={`总搜索次数: ${averageMetrics.totalSearches}`}
                    size="small"
                    variant="outlined"
                  />

                  {speedImprovement > 0 ? (
                    <Chip
                      label={`增强RAG慢 ${Math.abs(speedImprovement).toFixed(1)}%`}
                      size="small"
                      color="warning"
                    />
                  ) : (
                    <Chip
                      label={`增强RAG快 ${Math.abs(speedImprovement).toFixed(1)}%`}
                      size="small"
                      color="success"
                    />
                  )}

                  {averageMetrics.enhancedResultsCount > averageMetrics.simpleResultsCount && (
                    <Chip
                      label={`结果质量提升 ${((averageMetrics.enhancedResultsCount - averageMetrics.simpleResultsCount) / averageMetrics.simpleResultsCount * 100).toFixed(1)}%`}
                      size="small"
                      color="success"
                    />
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* 最近搜索历史 */}
        {metrics.length > 0 && (
          <Grid size={12}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle2" gutterBottom>
                  最近搜索历史
                </Typography>
                <List dense>
                  {metrics.slice(-5).reverse().map((metric, index) => (
                    <ListItem key={index} divider={index < 4}>
                      <ListItemIcon>
                        {metric.mode === 'enhanced' ? <AutoAwesomeIcon /> : <SpeedIcon />}
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box display="flex" gap={1} alignItems="center">
                            <Typography variant="body2">
                              {metric.mode === 'enhanced' ? '增强RAG' : '简单搜索'}
                            </Typography>
                            <Chip
                              label={`${metric.searchTime}ms`}
                              size="small"
                              color={getPerformanceColor(metric.searchTime)}
                            />
                            <Chip
                              label={`${metric.resultsCount} 结果`}
                              size="small"
                              variant="outlined"
                            />
                          </Box>
                        }
                        secondary={new Date(metric.timestamp).toLocaleTimeString()}
                      />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>
    </Paper>
  );
};

export default RAGPerformanceMonitor;
