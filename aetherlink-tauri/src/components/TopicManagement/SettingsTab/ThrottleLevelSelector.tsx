import { useState, useEffect } from 'react';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  Chip,

  IconButton,
  ListItem,
  ListItemText,
  ListItemSecondaryAction
} from '@mui/material';
import { ChevronDown, ChevronUp } from 'lucide-react';
import {
  getThrottleLevel,
  setThrottleLevel,
  type ThrottleLevel
} from '../../../shared/utils/performanceSettings';
import OptimizedCollapse from './OptimizedCollapse';

/**
 * 节流强度选择器组件
 */
export default function ThrottleLevelSelector() {
  const [currentLevel, setCurrentLevel] = useState<ThrottleLevel>('medium');
  const [expanded, setExpanded] = useState(false);

  // 加载当前设置
  useEffect(() => {
    const level = getThrottleLevel();
    setCurrentLevel(level);
  }, []);

  // 处理选择变化
  const handleChange = (level: ThrottleLevel) => {
    setCurrentLevel(level);
    setThrottleLevel(level);
  };

  // 节流级别配置
  const throttleLevels = [
    {
      value: 'light' as ThrottleLevel,
      label: '轻度节流',
      description: '更流畅，适合高性能设备',
      updateInterval: '200ms',
      scrollInterval: '300ms',
      color: '#4caf50' // 绿色
    },
    {
      value: 'medium' as ThrottleLevel,
      label: '中度节流',
      description: '平衡性能和流畅度（推荐）',
      updateInterval: '500ms',
      scrollInterval: '600ms',
      color: '#2196f3' // 蓝色
    },
    {
      value: 'heavy' as ThrottleLevel,
      label: '重度节流',
      description: '更省性能，适合低性能设备',
      updateInterval: '800ms',
      scrollInterval: '1000ms',
      color: '#ff9800' // 橙色
    },
    {
      value: 'extreme' as ThrottleLevel,
      label: '极度节流',
      description: '最省性能，适合超长文本',
      updateInterval: '1200ms',
      scrollInterval: '1500ms',
      color: '#f44336' // 红色
    }
  ];

  const currentConfig = throttleLevels.find(level => level.value === currentLevel);

  return (
    <Box>
      {/* 可折叠的标题栏 */}
      <ListItem
        component="div"
        onClick={() => setExpanded(!expanded)}
        sx={{
          px: 2,
          py: 0.75,
          cursor: 'pointer',
          position: 'relative',
          zIndex: 1,
          // 优化触摸响应
          touchAction: 'manipulation', // 防止双击缩放，优化触摸响应
          userSelect: 'none', // 防止文本选择
          // 移动端优化
          '@media (hover: none)': {
            '&:active': {
              backgroundColor: 'rgba(0, 0, 0, 0.04)',
              transform: 'scale(0.98)', // 轻微缩放反馈
              transition: 'all 0.1s ease-out'
            }
          },
          // 桌面端优化
          '@media (hover: hover)': {
            '&:hover': {
              backgroundColor: 'rgba(0, 0, 0, 0.02)',
              transform: 'none !important',
              boxShadow: 'none !important'
            },
            '&:focus': {
              backgroundColor: 'transparent !important'
            },
            '&:active': {
              backgroundColor: 'rgba(0, 0, 0, 0.04)'
            }
          },
          '& *': {
            pointerEvents: 'none', // 防止子元素干扰点击
            '&:hover': {
              backgroundColor: 'transparent !important',
              transform: 'none !important'
            }
          }
        }}
      >
        <ListItemText
          primary="性能节流强度"
          secondary={currentConfig ? `当前: ${currentConfig.label}` : '优化流式输出性能'}
          primaryTypographyProps={{ fontWeight: 'medium', fontSize: '0.95rem', lineHeight: 1.2 }}
          secondaryTypographyProps={{ fontSize: '0.75rem', lineHeight: 1.2 }}
        />
        <ListItemSecondaryAction>
          <IconButton edge="end" size="small" sx={{ padding: '2px' }}>
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </IconButton>
        </ListItemSecondaryAction>
      </ListItem>

      {/* 可折叠的内容区域 */}
      <OptimizedCollapse
        in={expanded}
        timeout={150}
        unmountOnExit
      >
        <Box sx={{ px: 2, pb: 2, pt: 1.5 }}>
          {/* 选择器 */}
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>节流强度</InputLabel>
            <Select
              value={currentLevel}
              label="节流强度"
              onChange={(e) => handleChange(e.target.value as ThrottleLevel)}
            >
              {throttleLevels.map((level) => (
                <MenuItem key={level.value} value={level.value}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip
                      size="small"
                      label={level.label}
                      sx={{
                        backgroundColor: level.color,
                        color: 'white',
                        fontSize: '0.75rem'
                      }}
                    />
                    <Typography variant="body2">
                      {level.description}
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* 当前配置详情 */}
          {currentConfig && (
            <Box sx={{ py: 1, px: 1.5, backgroundColor: 'rgba(0,0,0,0.02)', borderRadius: 1, mb: 1 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                当前配置：
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Chip
                  size="small"
                  label={`内容更新: ${currentConfig.updateInterval}`}
                  variant="outlined"
                  sx={{ fontSize: '0.7rem' }}
                />
                <Chip
                  size="small"
                  label={`滚动节流: ${currentConfig.scrollInterval}`}
                  variant="outlined"
                  sx={{ fontSize: '0.7rem' }}
                />
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                {currentConfig.description}
              </Typography>
            </Box>
          )}

          {/* 说明文字 */}
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', lineHeight: 1.3 }}
          >
            💡 节流强度越高，性能越好但更新越慢。建议根据设备性能选择合适的级别。
          </Typography>
        </Box>
      </OptimizedCollapse>
    </Box>
  );
}
