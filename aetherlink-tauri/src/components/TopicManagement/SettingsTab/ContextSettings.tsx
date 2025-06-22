import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Slider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Collapse,
  IconButton,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider // 导入 Divider 组件
} from '@mui/material';
import CustomSwitch from '../../CustomSwitch';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { MathRendererType } from '../../../shared/types';
import type { ThinkingOption } from '../../../shared/config/reasoningConfig';

interface ContextSettingsProps {
  contextLength: number;
  contextCount: number;
  maxOutputTokens: number;
  enableMaxOutputTokens: boolean;
  mathRenderer: MathRendererType;
  thinkingEffort: ThinkingOption;
  thinkingBudget: number;
  onContextLengthChange: (value: number) => void;
  onContextCountChange: (value: number) => void;
  onMaxOutputTokensChange: (value: number) => void;
  onEnableMaxOutputTokensChange: (value: boolean) => void;
  onMathRendererChange: (value: MathRendererType) => void;
  onThinkingEffortChange: (value: ThinkingOption) => void;
  onThinkingBudgetChange: (value: number) => void;
}

/**
 * 可折叠的上下文设置组件
 */
export default function ContextSettings({
  contextLength,
  contextCount,
  maxOutputTokens,
  enableMaxOutputTokens,
  mathRenderer,
  thinkingEffort,
  thinkingBudget,
  onContextLengthChange,
  onContextCountChange,
  onMaxOutputTokensChange,
  onEnableMaxOutputTokensChange,
  onMathRendererChange,
  onThinkingEffortChange,
  onThinkingBudgetChange
}: ContextSettingsProps) {
  const [expanded, setExpanded] = useState(false);

  // 监听maxOutputTokens变化，实现双向同步
  useEffect(() => {
    const handleMaxOutputTokensChange = (e: CustomEvent) => {
      const newValue = e.detail;
      if (newValue && newValue !== maxOutputTokens) {
        onMaxOutputTokensChange(newValue);
      }
    };

    const handleEnableMaxTokensChange = (e: CustomEvent) => {
      const newValue = e.detail;
      if (newValue !== enableMaxOutputTokens) {
        onEnableMaxOutputTokensChange(newValue);
      }
    };

    window.addEventListener('maxOutputTokensChanged', handleMaxOutputTokensChange as EventListener);
    window.addEventListener('enableMaxTokensChanged', handleEnableMaxTokensChange as EventListener);
    return () => {
      window.removeEventListener('maxOutputTokensChanged', handleMaxOutputTokensChange as EventListener);
      window.removeEventListener('enableMaxTokensChanged', handleEnableMaxTokensChange as EventListener);
    };
  }, [maxOutputTokens, enableMaxOutputTokens, onMaxOutputTokensChange, onEnableMaxOutputTokensChange]);

  // 处理上下文长度变化
  const handleContextLengthChange = (_event: Event, newValue: number | number[]) => {
    const value = newValue as number;
    onContextLengthChange(value);
  };

  // 处理上下文消息数变化
  const handleContextCountChange = (_event: Event, newValue: number | number[]) => {
    const value = newValue as number;
    onContextCountChange(value);
  };

  // 处理最大输出Token变化
  const handleMaxOutputTokensChange = (_event: Event, newValue: number | number[]) => {
    const value = newValue as number;
    onMaxOutputTokensChange(value);
    // 触发自定义事件通知其他组件
    window.dispatchEvent(new CustomEvent('maxOutputTokensChanged', { detail: value }));
  };

  // 处理最大输出Token开关变化
  const handleEnableMaxOutputTokensChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.checked;
    onEnableMaxOutputTokensChange(value);
    // 触发自定义事件通知其他组件
    window.dispatchEvent(new CustomEvent('enableMaxTokensChanged', { detail: value }));
  };

  // 处理思考预算变化
  const handleThinkingBudgetChange = (_event: Event, newValue: number | number[]) => {
    const value = newValue as number;
    onThinkingBudgetChange(value);
    // 触发自定义事件通知其他组件
    window.dispatchEvent(new CustomEvent('thinkingBudgetChanged', { detail: value }));
  };

  // 处理数学渲染器变化
  const handleMathRendererChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    const value = event.target.value as MathRendererType;
    onMathRendererChange(value);
  };

  // 处理思维链长度变化
  const handleThinkingEffortChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    const value = event.target.value as ThinkingOption;
    onThinkingEffortChange(value);
  };

  // 处理文本框输入
  const handleTextFieldChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value) && value >= 0 && value <= 64000) {
      onContextLengthChange(value);
    }
  };

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
          primary="上下文设置"
          secondary={`长度: ${contextLength === 64000 ? '不限' : contextLength} 字符 | 消息数: ${contextCount === 100 ? '最大' : contextCount} 条 | 输出: ${maxOutputTokens} tokens`}
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
      <Collapse
        in={expanded}
        timeout={{ enter: 300, exit: 200 }}
        easing={{ enter: 'cubic-bezier(0.4, 0, 0.2, 1)', exit: 'cubic-bezier(0.4, 0, 0.6, 1)' }}
        unmountOnExit
      >
        <Box sx={{ px: 2, pb: 2 }}>
          {/* 上下文长度控制 */}
          <Box sx={{ mb: 3 }}>
            <Box sx={{ width: '100%', mb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography variant="body2" fontWeight="medium">
                  上下文长度: {contextLength === 64000 ? '不限' : contextLength} 字符
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  每条消息的最大上下文长度
                </Typography>
              </Box>
              <Box sx={{ width: '80px' }}>
                <TextField
                  size="small"
                  type="number"
                  value={contextLength}
                  onChange={handleTextFieldChange}
                  slotProps={{
                    htmlInput: { min: 0, max: 64000 }
                  }}
                />
              </Box>
            </Box>
            <Slider
              value={contextLength}
              onChange={handleContextLengthChange}
              min={0}
              max={64000}
              step={1000}
              marks={[
                { value: 0, label: '0' },
                { value: 16000, label: '16K' },
                { value: 32000, label: '32K' },
                { value: 48000, label: '48K' },
                { value: 64000, label: '64K' }
              ]}
            />
          </Box>
          <Divider sx={{ my: 2 }} /> {/* 添加分割线 */}

          {/* 上下文消息数量控制 */}
          <Box sx={{ mb: 3 }}>
            <Box sx={{ width: '100%', mb: 1 }}>
              <Typography variant="body2" fontWeight="medium">
                上下文消息数: {contextCount === 100 ? '最大' : contextCount} 条
              </Typography>
              <Typography variant="caption" color="text.secondary">
                每次请求包含的历史消息数量
              </Typography>
            </Box>
            <Slider
              value={contextCount}
              onChange={handleContextCountChange}
              min={0}
              max={100}
              step={1}
              marks={[
                { value: 0, label: '0' },
                { value: 25, label: '25' },
                { value: 50, label: '50' },
                { value: 75, label: '75' },
                { value: 100, label: '最大' }
              ]}
            />
          </Box>
          <Divider sx={{ my: 2 }} /> {/* 添加分割线 */}

          {/* 最大输出Token控制 */}
          <Box sx={{ mb: 3 }}>
            {/* 标题和开关 */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Box sx={{ flexGrow: 1, minWidth: 0 }}> {/* 允许文本内容伸展并防止溢出 */}
                <Typography variant="body2" fontWeight="medium" sx={{ mb: 0.5 }}>
                  最大输出Token: {enableMaxOutputTokens ? `${maxOutputTokens} tokens` : '已禁用'}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  限制AI生成回复的最大长度，关闭后API请求中不包含此参数
                </Typography>
              </Box>
              <Box sx={{ flexShrink: 0 }}> {/* 防止开关按钮被压缩 */}
                <CustomSwitch
                  checked={enableMaxOutputTokens}
                  onChange={handleEnableMaxOutputTokensChange}
                />
              </Box>
            </Box>

            {/* 滑块控制 */}
            <Box sx={{ mb: 2, opacity: enableMaxOutputTokens ? 1 : 0.5 }}>
              <Slider
                value={Math.min(maxOutputTokens, 65536)}
                onChange={handleMaxOutputTokensChange}
                disabled={!enableMaxOutputTokens}
                min={256}
                max={65536}
                step={256}
                marks={[
                  { value: 2048, label: '2K' },
                  { value: 8192, label: '8K' },
                  { value: 32768, label: '32K' }
                ]}
                sx={{
                  '& .MuiSlider-markLabel': {
                    fontSize: '0.65rem',
                    whiteSpace: 'nowrap'
                  },
                  '& .MuiSlider-mark': {
                    height: 8
                  }
                }}
              />
            </Box>

            {/* 精确输入 */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography variant="body2" color="text.secondary" sx={{ minWidth: 'fit-content' }}>
                精确值:
              </Typography>
              <TextField
                type="text"
                value={maxOutputTokens}
                onChange={(e) => {
                  const value = e.target.value;
                  // 允许空值或纯数字
                  if (value === '' || /^\d+$/.test(value)) {
                    const numValue = value === '' ? 0 : parseInt(value);
                    if (numValue <= 2000000) {
                      onMaxOutputTokensChange(numValue);
                      // 触发自定义事件通知其他组件
                      window.dispatchEvent(new CustomEvent('maxOutputTokensChanged', { detail: numValue }));
                    }
                  }
                }}
                disabled={!enableMaxOutputTokens}
                size="small"
                sx={{ width: 120 }}
              />
              <Typography variant="body2" color="text.secondary">
                tokens
              </Typography>
            </Box>

            {/* 说明文字 */}
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', lineHeight: 1.2 }}>
              滑块范围: 256-64K tokens，输入框支持最大2M tokens。系统会根据模型自动应用限制。
            </Typography>
          </Box>
          <Divider sx={{ my: 2 }} /> {/* 添加分割线 */}

          {/* 思维链长度选择 */}
          <Box sx={{ mb: 3 }}>
            <Box sx={{ width: '100%', mb: 1 }}>
              <Typography variant="body2" fontWeight="medium">
                思维链长度
              </Typography>
              <Typography variant="caption" color="text.secondary">
                设置AI思考过程的深度，影响回答质量和速度
              </Typography>
            </Box>
            <FormControl fullWidth size="small" sx={{ mt: 1 }}>
              <InputLabel id="thinking-effort-label">思维链长度</InputLabel>
              <Select
                labelId="thinking-effort-label"
                id="thinking-effort-select"
                value={thinkingEffort}
                label="思维链长度"
                onChange={handleThinkingEffortChange as any}
              >
                <MenuItem value="off">关闭思考</MenuItem>
                <MenuItem value="low">低强度思考</MenuItem>
                <MenuItem value="medium">中强度思考（推荐）</MenuItem>
                <MenuItem value="high">高强度思考</MenuItem>
                <MenuItem value="auto">自动思考</MenuItem>
              </Select>
            </FormControl>
            <Typography
              variant="caption"
              sx={{
                mt: 1,
                color: 'text.secondary',
                fontSize: '0.7rem',
                lineHeight: 1.2,
                display: 'block'
              }}
            >
              {thinkingEffort === 'off' && '不启用思考过程，AI将直接回答'}
              {thinkingEffort === 'low' && '简单思考，适合快速回答'}
              {thinkingEffort === 'medium' && '平衡思考深度和响应速度，适合大多数场景'}
              {thinkingEffort === 'high' && '深度思考，适合复杂问题分析'}
              {thinkingEffort === 'auto' && '根据问题复杂度自动调整思考深度'}
            </Typography>
          </Box>
          <Divider sx={{ my: 2 }} /> {/* 添加分割线 */}

          {/* 思考预算设置 */}
          <Box sx={{ mb: 3 }}>
            {/* 标题和当前值 */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" fontWeight="medium" sx={{ mb: 0.5 }}>
                思考预算: {thinkingBudget} tokens
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                设置Gemini 2.5 Pro模型的思考预算，范围128-32768 tokens
              </Typography>
            </Box>

            {/* 滑块控制 */}
            <Box sx={{ mb: 2 }}>
              <Slider
                value={thinkingBudget}
                onChange={handleThinkingBudgetChange}
                min={128}
                max={32768}
                step={128}
                marks={[
                  { value: 128, label: '128' },
                  { value: 1024, label: '1K' },
                  { value: 4096, label: '4K' },
                  { value: 16384, label: '16K' },
                  { value: 32768, label: '32K' }
                ]}
                sx={{
                  '& .MuiSlider-markLabel': {
                    fontSize: '0.65rem',
                    whiteSpace: 'nowrap'
                  },
                  '& .MuiSlider-mark': {
                    height: 8
                  }
                }}
              />
            </Box>

            {/* 精确输入 */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography variant="body2" color="text.secondary" sx={{ minWidth: 'fit-content' }}>
                精确值:
              </Typography>
              <TextField
                type="number"
                value={thinkingBudget}
                onChange={(e) => {
                  const value = parseInt(e.target.value);
                  if (!isNaN(value) && value >= 128 && value <= 32768) {
                    onThinkingBudgetChange(value);
                    // 触发自定义事件通知其他组件
                    window.dispatchEvent(new CustomEvent('thinkingBudgetChanged', { detail: value }));
                  }
                }}
                size="small"
                sx={{ width: 120 }}
                slotProps={{
                  htmlInput: { min: 128, max: 32768 }
                }}
              />
              <Typography variant="body2" color="text.secondary">
                tokens
              </Typography>
            </Box>

            {/* 说明文字 */}
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', lineHeight: 1.2 }}>
              思考预算控制模型的思考深度。较高的值允许更深入的思考，但会增加响应时间。
            </Typography>
          </Box>
          <Divider sx={{ my: 2 }} /> {/* 添加分割线 */}

          {/* 数学公式渲染器选择 */}
          <Box>
            <FormControl fullWidth size="small">
              <InputLabel id="math-renderer-label">数学公式渲染器</InputLabel>
              <Select
                labelId="math-renderer-label"
                id="math-renderer-select"
                value={mathRenderer}
                label="数学公式渲染器"
                onChange={handleMathRendererChange as any}
              >
                <MenuItem value="KaTeX">KaTeX</MenuItem>
                <MenuItem value="MathJax">MathJax</MenuItem>
                <MenuItem value="none">禁用</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </Box>
      </Collapse>
    </Box>
  );
}
