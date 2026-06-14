import React from 'react';
import { Box, Paper, Typography } from '@mui/material';
import type { ChartMessageBlock } from '../../../shared/types/newMessage';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Line, Pie, Scatter } from 'react-chartjs-2';
import { createLogger } from '../../../shared/services/infra/logger';

const logger = createLogger('ChartBlock');

// 注册Chart.js组件
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

interface Props {
  block: ChartMessageBlock;
}

/**
 * 图表块组件
 * 负责渲染各种图表
 */
const ChartBlock: React.FC<Props> = ({ block }) => {
  // 如果没有数据，不渲染任何内容
  if (!block.data) {
    return null;
  }

  // 根据图表类型渲染不同的图表组件
  const renderChart = () => {
    try {
      switch (block.chartType) {
        case 'bar':
          return <Bar data={block.data as any} options={block.options || {}} />;
        case 'line':
          return <Line data={block.data as any} options={block.options || {}} />;
        case 'pie':
          return <Pie data={block.data as any} options={block.options || {}} />;
        case 'scatter':
          return <Scatter data={block.data as any} options={block.options || {}} />;
        default:
          return (
            <Typography variant="body2" color="error">
              不支持的图表类型: {block.chartType}
            </Typography>
          );
      }
    } catch (error) {
      logger.error('图表渲染失败:', error);
      return (
        <Typography variant="body2" color="error">
          图表渲染失败: {(error as Error).message}
        </Typography>
      );
    }
  };

  return (
    <Box sx={{ my: 2 }}>
      <Paper
        variant="outlined"
        sx={{
          p: 2,
          backgroundColor: 'var(--theme-msg-block-bg)',
          width: '100%',
          height: '300px',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {renderChart()}
      </Paper>
    </Box>
  );
};

export default React.memo(ChartBlock);
