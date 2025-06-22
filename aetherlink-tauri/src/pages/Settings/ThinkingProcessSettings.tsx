import React from 'react';
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  Tooltip,
  IconButton,
  AppBar,
  Toolbar,
  Divider,
  alpha,
  FormControlLabel,
  Switch,
  FormGroup
} from '@mui/material';
import { ArrowLeft, Info, Brain, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../../shared/store';
import { updateSettings } from '../../shared/store/settingsSlice';
import { ThinkingDisplayStyle } from '../../components/message/blocks/ThinkingBlock';
import ThinkingBlock from '../../components/message/blocks/ThinkingBlock';
import type { ThinkingMessageBlock } from '../../shared/types/newMessage';
import { MessageBlockType, MessageBlockStatus } from '../../shared/types/newMessage';

const ThinkingProcessSettings: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const settings = useAppSelector((state) => state.settings);

  // 获取思考过程相关设置
  const thinkingDisplayStyle = (settings as any).thinkingDisplayStyle || ThinkingDisplayStyle.COMPACT;
  const thoughtAutoCollapse = (settings as any).thoughtAutoCollapse !== false;

  // 创建预览用的思考块数据
  const previewThinkingBlock: ThinkingMessageBlock = {
    id: 'preview-thinking-block',
    messageId: 'preview-message',
    type: MessageBlockType.THINKING,
    createdAt: new Date(Date.now() - 3500).toISOString(),
    updatedAt: new Date().toISOString(),
    status: MessageBlockStatus.SUCCESS,
    content: `用户询问了关于"如何提高工作效率"的问题。我需要从多个角度来分析这个问题：

首先，我应该考虑工作效率的定义。工作效率通常指在单位时间内完成的工作量和质量。提高工作效率可以从以下几个方面入手：

1. 时间管理
- 使用番茄工作法，将工作分解为25分钟的专注时段
- 制定优先级清单，先处理重要且紧急的任务
- 避免多任务处理，专注于一件事情

2. 工作环境优化
- 保持工作区域整洁有序
- 减少干扰因素，如关闭不必要的通知
- 确保有良好的照明和舒适的座椅

3. 技能提升
- 学习使用效率工具和软件
- 提高专业技能，减少完成任务所需时间
- 培养良好的沟通能力

4. 身心健康
- 保证充足的睡眠
- 定期运动，保持身体健康
- 学会放松和减压

我觉得这个回答涵盖了工作效率的主要方面，既实用又全面。用户应该能够从中找到适合自己的方法。`,
    thinking_millsec: 3500
  };

  const handleBack = () => {
    navigate('/settings/appearance');
  };

  // 事件处理函数
  const handleThinkingStyleChange = (event: { target: { value: any } }) => {
    dispatch(updateSettings({
      thinkingDisplayStyle: event.target.value
    }));
  };

  const handleThoughtAutoCollapseChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(updateSettings({
      thoughtAutoCollapse: event.target.checked
    }));
  };

  // 获取样式显示名称的辅助函数
  const getStyleDisplayName = (style: string) => {
    const styleNames: Record<string, string> = {
      [ThinkingDisplayStyle.COMPACT]: '紧凑模式',
      [ThinkingDisplayStyle.FULL]: '完整模式',
      [ThinkingDisplayStyle.MINIMAL]: '极简模式',
      [ThinkingDisplayStyle.BUBBLE]: '气泡模式',
      [ThinkingDisplayStyle.TIMELINE]: '时间线模式',
      [ThinkingDisplayStyle.CARD]: '卡片模式',
      [ThinkingDisplayStyle.INLINE]: '内联模式',
      [ThinkingDisplayStyle.HIDDEN]: '隐藏',
      [ThinkingDisplayStyle.STREAM]: '🌊 流式文字',
      [ThinkingDisplayStyle.DOTS]: '💫 思考点动画',
      [ThinkingDisplayStyle.WAVE]: '🌀 波浪流动',
      [ThinkingDisplayStyle.SIDEBAR]: '📋 侧边栏',
      [ThinkingDisplayStyle.OVERLAY]: '🔍 全屏覆盖',
      [ThinkingDisplayStyle.BREADCRUMB]: '🔗 面包屑',
      [ThinkingDisplayStyle.FLOATING]: '✨ 悬浮气泡',
      [ThinkingDisplayStyle.TERMINAL]: '💻 终端模式'
    };
    return styleNames[style] || style;
  };

  return (
    <Box sx={{
      flexGrow: 1,
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      bgcolor: (theme) => theme.palette.mode === 'light'
        ? alpha(theme.palette.primary.main, 0.02)
        : alpha(theme.palette.background.default, 0.9),
    }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 1,
          bgcolor: 'background.paper',
          color: 'text.primary',
          borderBottom: 1,
          borderColor: 'divider',
          backdropFilter: 'blur(8px)',
        }}
      >
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            onClick={handleBack}
            aria-label="back"
            sx={{
              color: (theme) => theme.palette.primary.main,
            }}
          >
            <ArrowLeft />
          </IconButton>
          <Typography
            variant="h6"
            component="div"
            sx={{
              flexGrow: 1,
              fontWeight: 600,
              backgroundImage: 'linear-gradient(90deg, #9333EA, #754AB4)',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            思考过程设置
          </Typography>
        </Toolbar>
      </AppBar>

      <Box
        sx={{
          flexGrow: 1,
          overflowY: 'auto',
          p: { xs: 1, sm: 2 },
          mt: 8,
          '&::-webkit-scrollbar': {
            width: { xs: '4px', sm: '6px' },
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'rgba(0,0,0,0.1)',
            borderRadius: '3px',
          },
        }}
      >
        {/* 思考过程显示设置 */}
        <Paper
          elevation={0}
          sx={{
            mb: 2,
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
            overflow: 'hidden',
            bgcolor: 'background.paper',
            boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
          }}
        >
          <Box sx={{ p: { xs: 1.5, sm: 2 }, bgcolor: 'rgba(0,0,0,0.01)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Brain size={20} style={{ marginRight: 8, color: '#9333EA' }} />
              <Typography
                variant="subtitle1"
                sx={{
                  fontWeight: 600,
                  fontSize: { xs: '1rem', sm: '1.1rem' }
                }}
              >
                思考过程显示
              </Typography>
              <Tooltip title="配置AI思考过程的显示方式和行为">
                <IconButton size="small" sx={{ ml: 1 }}>
                  <Info size={16} />
                </IconButton>
              </Tooltip>
            </Box>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
            >
              自定义AI思考过程的显示方式和自动折叠行为
            </Typography>
          </Box>

          <Divider />

          <Box sx={{ p: { xs: 1.5, sm: 2 } }}>
            <FormControl fullWidth variant="outlined" sx={{ mb: 2 }}>
              <InputLabel>显示样式</InputLabel>
              <Select
                value={thinkingDisplayStyle}
                onChange={handleThinkingStyleChange}
                label="显示样式"
                MenuProps={{
                  disableAutoFocus: true,
                  disableRestoreFocus: true
                }}
              >
                <MenuItem value={ThinkingDisplayStyle.COMPACT}>紧凑模式（可折叠）</MenuItem>
                <MenuItem value={ThinkingDisplayStyle.FULL}>完整模式（始终展开）</MenuItem>
                <MenuItem value={ThinkingDisplayStyle.MINIMAL}>极简模式（小图标）</MenuItem>
                <MenuItem value={ThinkingDisplayStyle.BUBBLE}>气泡模式（聊天气泡）</MenuItem>
                <MenuItem value={ThinkingDisplayStyle.TIMELINE}>时间线模式（左侧指示器）</MenuItem>
                <MenuItem value={ThinkingDisplayStyle.CARD}>卡片模式（突出显示）</MenuItem>
                <MenuItem value={ThinkingDisplayStyle.INLINE}>内联模式（嵌入消息）</MenuItem>
                <MenuItem value={ThinkingDisplayStyle.HIDDEN}>隐藏（不显示思考过程）</MenuItem>
                {/* 2025年新增的先进样式 */}
                <MenuItem value={ThinkingDisplayStyle.STREAM}>🌊 流式文字（逐字显示）</MenuItem>
                <MenuItem value={ThinkingDisplayStyle.DOTS}>💫 思考点动画（输入指示器）</MenuItem>
                <MenuItem value={ThinkingDisplayStyle.WAVE}>🌀 波浪流动（思维可视化）</MenuItem>
                <MenuItem value={ThinkingDisplayStyle.SIDEBAR}>📋 侧边栏（滑出显示）</MenuItem>
                <MenuItem value={ThinkingDisplayStyle.OVERLAY}>🔍 全屏覆盖（沉浸体验）</MenuItem>
                <MenuItem value={ThinkingDisplayStyle.BREADCRUMB}>🔗 面包屑（步骤展示）</MenuItem>
                <MenuItem value={ThinkingDisplayStyle.FLOATING}>✨ 悬浮气泡（跟随鼠标）</MenuItem>
                <MenuItem value={ThinkingDisplayStyle.TERMINAL}>💻 终端模式（命令行风格）</MenuItem>
              </Select>
            </FormControl>

            <FormGroup>
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={thoughtAutoCollapse}
                    onChange={handleThoughtAutoCollapseChange}
                  />
                }
                label="思考完成后自动折叠"
              />
            </FormGroup>

            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                mt: 1,
                fontSize: { xs: '0.8rem', sm: '0.875rem' },
                lineHeight: 1.5
              }}
            >
              设置AI助手思考过程的显示方式：
              <br />• 紧凑模式：标准卡片样式，可折叠展开
              <br />• 完整模式：始终展开显示全部内容
              <br />• 极简模式：只显示小图标，悬停查看内容
              <br />• 气泡模式：类似聊天气泡的圆润设计
              <br />• 时间线模式：左侧带时间线指示器
              <br />• 卡片模式：突出的渐变卡片设计
              <br />• 内联模式：嵌入在消息中的紧凑显示
              <br />• 隐藏：完全不显示思考过程
              <br />
              <br />🚀 <strong>2025年新增先进样式：</strong>
              <br />• 流式文字：打字机效果，逐字显示思考内容
              <br />• 思考点动画：类似聊天应用的"正在输入"指示器
              <br />• 波浪流动：动态波浪效果，可视化思维流动
              <br />• 侧边栏：从右侧滑出的全屏思考面板
              <br />• 全屏覆盖：沉浸式全屏思考内容展示
              <br />• 面包屑：步骤化展示思考过程的关键节点
              <br />• 悬浮气泡：跟随鼠标的动态悬浮预览
              <br />• 终端模式：程序员风格的命令行界面显示
            </Typography>
          </Box>
        </Paper>

        {/* 实时预览组件 */}
        {thinkingDisplayStyle !== ThinkingDisplayStyle.HIDDEN && (
          <Paper
            elevation={0}
            sx={{
              mb: 2,
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              overflow: 'hidden',
              bgcolor: 'background.paper',
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
            }}
          >
            <Box sx={{ p: { xs: 1.5, sm: 2 }, bgcolor: 'rgba(0,0,0,0.01)' }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Eye size={20} style={{ marginRight: 8, color: '#9333EA' }} />
                <Typography
                  variant="subtitle1"
                  sx={{
                    fontWeight: 600,
                    fontSize: { xs: '1rem', sm: '1.1rem' }
                  }}
                >
                  实时预览
                </Typography>
                <Tooltip title="预览当前选择的思考过程显示样式">
                  <IconButton size="small" sx={{ ml: 1 }}>
                    <Info size={16} />
                  </IconButton>
                </Tooltip>
              </Box>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
              >
                实时查看当前设置下的思考过程显示效果
              </Typography>
            </Box>

            <Divider />

            <Box sx={{ p: { xs: 1.5, sm: 2 } }}>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mb: 2, fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
              >
                当前样式：<strong>{getStyleDisplayName(thinkingDisplayStyle)}</strong>
              </Typography>

              {/* 预览思考块 */}
              <Box sx={{
                border: '1px dashed',
                borderColor: 'divider',
                borderRadius: 1,
                p: 1,
                bgcolor: (theme) => theme.palette.mode === 'dark'
                  ? 'rgba(255,255,255,0.02)'
                  : 'rgba(0,0,0,0.01)'
              }}>
                <ThinkingBlock block={previewThinkingBlock} />
              </Box>
            </Box>
          </Paper>
        )}

        {/* 底部间距 */}
        <Box sx={{ height: '20px' }} />
      </Box>
    </Box>
  );
};

export default ThinkingProcessSettings;
