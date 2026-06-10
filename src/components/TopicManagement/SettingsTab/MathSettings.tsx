import React, { useState } from 'react';
import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Typography,
  Divider
} from '@mui/material';
import { ChevronDown, ChevronUp } from 'lucide-react';
import CustomSwitch from '../../CustomSwitch';
import OptimizedCollapse from './OptimizedCollapse';
import { collapsibleHeaderStyle, createExpandToggleHandler } from './scrollOptimization';
import type { MathRendererType } from '../../../shared/types';

interface MathSettingsProps {
  mathRenderer: MathRendererType;
  mathEnableSingleDollar: boolean;
  onMathRendererChange: (value: MathRendererType) => void;
  onMathEnableSingleDollarChange: (value: boolean) => void;
}

/**
 * 数学公式设置组件
 * 独立的可折叠设置组，类似 Cherry Studio 的风格
 */
export default function MathSettings({
  mathRenderer,
  mathEnableSingleDollar,
  onMathRendererChange,
  onMathEnableSingleDollarChange
}: MathSettingsProps) {
  const [expanded, setExpanded] = useState(false);

  // 处理数学渲染器变化
  const handleMathRendererChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    const value = event.target.value as MathRendererType;
    onMathRendererChange(value);
  };

  // 获取渲染器显示名称
  const getRendererLabel = (renderer: MathRendererType): string => {
    switch (renderer) {
      case 'KaTeX':
        return 'KaTeX';
      case 'MathJax':
        return 'MathJax';
      case 'none':
        return '禁用';
      default:
        return 'KaTeX';
    }
  };

  return (
    <Box>
      {/* 可折叠的标题栏 */}
      <ListItem
        component="div"
        onClick={createExpandToggleHandler(expanded, setExpanded)}
        sx={collapsibleHeaderStyle(expanded)}
      >
        <ListItemText
          primary="数学公式设置"
          secondary={`渲染引擎: ${getRendererLabel(mathRenderer)}`}
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
        <Box sx={{ px: 2, pb: 2 }}>
          {/* 数学渲染引擎选择 */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" fontWeight="medium" sx={{ mb: 1 }}>
              数学公式引擎
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
              选择数学公式的渲染引擎，KaTeX更快，MathJax功能更全
            </Typography>
            <FormControl fullWidth size="small">
              <InputLabel id="math-renderer-label">渲染引擎</InputLabel>
              <Select
                labelId="math-renderer-label"
                id="math-renderer-select"
                value={mathRenderer}
                label="渲染引擎"
                onChange={handleMathRendererChange as any}
              >
                <MenuItem value="KaTeX">KaTeX（推荐）</MenuItem>
                <MenuItem value="MathJax">MathJax</MenuItem>
                <MenuItem value="none">禁用</MenuItem>
              </Select>
            </FormControl>
          </Box>

          <Divider sx={{ my: 2 }} />

          {/* 单美元符号开关 */}
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="body2" fontWeight="medium" sx={{ mb: 0.5 }}>
                  启用 $...$ 单美元符号
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  渲染单个美元符号 $...$ 包裹的数学公式，默认启用。
                </Typography>
              </Box>
              <Box sx={{ flexShrink: 0, ml: 2 }}>
                <CustomSwitch
                  checked={mathEnableSingleDollar}
                  onChange={(e) => onMathEnableSingleDollarChange(e.target.checked)}
                />
              </Box>
            </Box>
            <Typography 
              variant="caption" 
              color="warning.main" 
              sx={{ 
                display: 'block', 
                fontSize: '0.7rem',
                mt: 1,
                p: 1,
                bgcolor: 'rgba(255, 152, 0, 0.08)',
                borderRadius: 1
              }}
            >
              ⚠️ 关闭后可避免货币符号（如 $100）被误识别为数学公式
            </Typography>
          </Box>

          <Divider sx={{ my: 2 }} />

          {/* 使用说明 */}
          <Box sx={{ 
            p: 1.5, 
            bgcolor: 'rgba(0, 0, 0, 0.02)', 
            borderRadius: 1,
            border: '1px solid rgba(0, 0, 0, 0.08)'
          }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', lineHeight: 1.5 }}>
              <strong>使用方法：</strong><br />
              • 行内公式：用单个 $ 符号包裹<br />
              • 独立公式：用双 $$ 符号包裹
            </Typography>
          </Box>
        </Box>
      </OptimizedCollapse>
    </Box>
  );
}

