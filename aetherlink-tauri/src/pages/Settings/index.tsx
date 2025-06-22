import React from 'react';
import {
  Box,
  ListItemButton,
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Paper,
  alpha,
  Avatar
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft as ArrowBackIcon,
  Globe as LanguageIcon,
  Bot as SmartToyIcon,
  Settings as SettingsIcon,
  Keyboard as KeyboardIcon,
  Database as StorageIcon,
  Mic as RecordVoiceOverIcon,
  Puzzle as ExtensionIcon,
  Info as InfoIcon
} from 'lucide-react';
import { ChevronRight as ChevronRightIcon, Palette as FormatColorFillIcon } from 'lucide-react';
import { Settings as SettingsApplicationsIcon, Sliders as TuneIcon, Wand2 as AutoFixHighIcon, GitBranch } from 'lucide-react';
import { Code as CodeIcon, MessageSquare as ForumIcon, BookOpen as MenuBookIcon, Folder as WorkspaceIcon, Database as DatabaseIcon } from 'lucide-react';
import useScrollPosition from '../../hooks/useScrollPosition';
import { useSwipeGesture } from '../../hooks/useSwipeGesture';

const SettingsPage: React.FC = () => {
  const navigate = useNavigate();

  // 使用滚动位置保存功能
  const {
    containerRef,
    handleScroll
  } = useScrollPosition('settings-main', {
    autoRestore: true,
    restoreDelay: 100
  });

  const handleBack = () => {
    navigate('/chat');
  };

  // 右滑返回手势
  const { swipeHandlers } = useSwipeGesture({
    onSwipeRight: handleBack,
    threshold: 100, // 滑动距离阈值
    velocityThreshold: 0.3, // 速度阈值
    enabled: true,
    enableEdgeDetection: true, // 启用边缘检测，只有从左边缘开始滑动才触发
    edgeThreshold: 50 // 左边缘50px内开始滑动才有效
  });

  // 功能开放状态配置
  const FEATURE_FLAGS = {
    shortcuts: false,  // 快捷键设置功能未开放
    features: false,   // 功能设置未开放
  };

  const navigateTo = (path: string) => {
    // 从路径中提取功能ID
    const featureId = path.split('/').pop();
    // 检查功能是否开放
    if (featureId && FEATURE_FLAGS[featureId as keyof typeof FEATURE_FLAGS] === false) {
      return; // 功能未开放，不进行导航
    }
    navigate(path);
  };

  // 定义设置菜单组
  const settingsGroups = [
    {
      title: '基本设置',
      items: [
        { id: 'appearance', title: '外观', description: '主题、字体大小和语言设置', icon: <FormatColorFillIcon size={18} />, path: '/settings/appearance', color: '#6366f1' },
        { id: 'behavior', title: '行为', description: '消息发送和通知设置', icon: <SettingsApplicationsIcon size={18} />, path: '/settings/behavior', color: '#8b5cf6' },
      ]
    },
    {
      title: '模型服务',
      items: [
        { id: 'default-model', title: '配置模型', description: '管理AI模型和API密钥', icon: <SmartToyIcon size={18} />, path: '/settings/default-model', color: '#ec4899' },
        { id: 'default-model-settings', title: '默认模型', description: '选择默认模型和自动化选项', icon: <TuneIcon size={18} />, path: '/settings/default-model-settings', color: '#4f46e5' },
        { id: 'agent-prompts', title: '智能体提示词集合', description: '浏览和使用内置的丰富提示词模板', icon: <AutoFixHighIcon size={18} />, path: '/settings/agent-prompts', color: '#0ea5e9' },
        { id: 'ai-debate', title: 'AI辩论设置', description: '配置AI互相辩论讨论功能', icon: <ForumIcon size={18} />, path: '/settings/ai-debate', color: '#e11d48' },
        { id: 'model-combo', title: '模型组合', description: '创建和管理多模型组合', icon: <GitBranch size={18} />, path: '/settings/model-combo', color: '#f43f5e' },
        { id: 'web-search', title: '网络搜索', description: '配置网络搜索和相关服务', icon: <LanguageIcon size={18} />, path: '/settings/web-search', color: '#3b82f6' },
        { id: 'mcp-server', title: 'MCP 服务器', description: '高级服务器配置', icon: <SettingsIcon size={18} />, path: '/settings/mcp-server', color: '#10b981' },
      ]
    },
    {
      title: '快捷方式',
      items: [
        { id: 'shortcuts', title: '快捷助手', description: '自定义键盘快捷键', icon: <KeyboardIcon size={18} />, path: '/settings/shortcuts', color: '#f59e0b' },
        { id: 'quick-phrases', title: '快捷短语', description: '创建常用短语模板', icon: <KeyboardIcon size={18} />, path: '/settings/quick-phrases', color: '#f97316' },
      ]
    },
    {
      title: '其他设置',
      items: [
        { id: 'workspace-settings', title: '工作区管理', description: '创建和管理文件工作区', icon: <WorkspaceIcon size={18} />, path: '/settings/workspace', color: '#f59e0b' },
        { id: 'knowledge-settings', title: '知识库设置', description: '管理知识库配置和嵌入模型', icon: <MenuBookIcon size={18} />, path: '/settings/knowledge', color: '#059669' },
        { id: 'data-settings', title: '数据设置', description: '管理数据存储和隐私选项', icon: <StorageIcon size={18} />, path: '/settings/data', color: '#0ea5e9' },
        { id: 'notion-settings', title: 'Notion 集成', description: '配置Notion数据库导出设置', icon: <DatabaseIcon size={18} />, path: '/settings/notion', color: '#6366f1' },
        { id: 'voice-settings', title: '语音功能', description: '语音识别和文本转语音设置', icon: <RecordVoiceOverIcon size={18} />, path: '/settings/voice', color: '#8b5cf6' },
        { id: 'features', title: '功能模块', description: '启用或禁用应用功能', icon: <ExtensionIcon size={18} />, path: '/settings/features', color: '#22c55e' },
        { id: 'vue-demo', title: 'Vue 组件演示', description: 'Vue与Capacitor功能演示', icon: <CodeIcon size={18} />, path: '/vue-demo', color: '#42b983' },
        { id: 'about', title: '关于我们', description: '应用信息和技术支持', icon: <InfoIcon size={18} />, path: '/settings/about', color: '#64748b' },
      ]
    }
  ];

  return (
    <Box
      {...swipeHandlers}
      sx={{
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
            onClick={handleBack}
            aria-label="back"
            sx={{
              color: (theme) => theme.palette.primary.main,
            }}
          >
            <ArrowBackIcon />
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
            设置
          </Typography>
        </Toolbar>
      </AppBar>

      <Box
        ref={containerRef}
        onScroll={handleScroll}
        sx={{
          flexGrow: 1,
          overflow: 'auto',
          px: 2,
          py: 2,
          mt: 8,
          '&::-webkit-scrollbar': {
            width: '6px',
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'rgba(0,0,0,0.1)',
            borderRadius: '3px',
          },
        }}
      >
        {settingsGroups.map((group, index) => (
          <Box key={index} sx={{ mb: 2.5 }}>
            <Typography
              variant="subtitle1"
              sx={{
                px: 0.5,
                mb: 1,
                fontSize: '0.8rem',
                fontWeight: 600,
                color: (theme) => theme.palette.mode === 'light' ? '#475569' : '#94A3B8',
                letterSpacing: '0.05em',
                textTransform: 'uppercase'
              }}
            >
              {group.title}
            </Typography>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: 'repeat(2, 1fr)',
                  md: 'repeat(3, 1fr)'
                },
                gap: 1.5
              }}
            >
              {group.items.map((item) => (
                <Paper
                  key={item.id}
                  elevation={0}
                  sx={{
                    borderRadius: 1.5,
                    overflow: 'hidden',
                    border: '1px solid',
                    borderColor: 'divider',
                    transition: 'all 0.2s ease-in-out',
                    bgcolor: 'background.paper',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                    minHeight: '72px',
                    '&:hover': {
                      transform: 'translateY(-1px)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                      borderColor: (theme) => alpha(theme.palette.primary.main, 0.3),
                    }
                  }}
                >
                  <ListItemButton
                    onClick={() => navigateTo(item.path)}
                    disabled={FEATURE_FLAGS[item.id as keyof typeof FEATURE_FLAGS] === false}
                    sx={{
                      p: 0,
                      height: '100%',
                      '&:hover': {
                        bgcolor: 'transparent',
                      }
                    }}
                  >
                    <Box sx={{
                      display: 'flex',
                      alignItems: 'center',
                      width: '100%',
                      p: 1.5
                    }}>
                      <Avatar
                        sx={{
                          bgcolor: alpha(item.color, 0.12),
                          color: item.color,
                          mr: 1.5,
                          width: 36,
                          height: 36,
                          boxShadow: '0 2px 6px rgba(0,0,0,0.05)'
                        }}
                      >
                        {item.icon}
                      </Avatar>
                      <Box sx={{ flex: 1 }}>
                        <Typography
                          variant="subtitle2"
                          sx={{
                            fontWeight: 600,
                            mb: 0.3,
                            color: 'text.primary',
                            fontSize: '0.9rem'
                          }}
                        >
                          {item.title}
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{
                            color: 'text.secondary',
                            fontSize: '0.75rem',
                            display: '-webkit-box',
                            WebkitLineClamp: 1,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden'
                          }}
                        >
                          {item.description}
                        </Typography>
                      </Box>
                      <ChevronRightIcon size={16} style={{ color: '#1976d2', opacity: 0.5, marginLeft: 6 }} />
                    </Box>
                  </ListItemButton>
                </Paper>
              ))}
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default SettingsPage;