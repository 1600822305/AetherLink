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
import { useTranslation } from 'react-i18next';

const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  // 使用滚动位置保存功能
  const {
    containerRef,
    handleScroll
  } = useScrollPosition('settings-main', {
    autoRestore: true,
    restoreDelay: 100
  });

  const handleBack = () => {
    // 返回聊天界面时清理所有设置页面的滚动位置缓存
    const settingsScrollKeys = [
      'scroll:settings-main',
      'scroll:settings-appearance',
      'scroll:settings-chat-interface',
      'scroll:settings-behavior',
      'scroll:settings-top-toolbar'
    ];

    settingsScrollKeys.forEach(key => {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        console.error('清理滚动位置缓存失败:', error);
      }
    });

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

  // 定义设置菜单组（使用多语言）
  const settingsGroups = [
    {
      id: 'basic',
      items: [
        { id: 'appearance', icon: <FormatColorFillIcon size={18} />, path: '/settings/appearance', color: '#6366f1' },
        { id: 'behavior', icon: <SettingsApplicationsIcon size={18} />, path: '/settings/behavior', color: '#8b5cf6' },
      ]
    },
    {
      id: 'modelServices',
      items: [
        { id: 'default-model', icon: <SmartToyIcon size={18} />, path: '/settings/default-model', color: '#ec4899' },
        { id: 'topic-naming-settings', icon: <TuneIcon size={18} />, path: '/settings/topic-naming-settings', color: '#4f46e5' },
        { id: 'agent-prompts', icon: <AutoFixHighIcon size={18} />, path: '/settings/agent-prompts', color: '#0ea5e9' },
        { id: 'ai-debate', icon: <ForumIcon size={18} />, path: '/settings/ai-debate', color: '#e11d48' },
        { id: 'model-combo', icon: <GitBranch size={18} />, path: '/settings/model-combo', color: '#f43f5e' },
        { id: 'web-search', icon: <LanguageIcon size={18} />, path: '/settings/web-search', color: '#3b82f6' },
        { id: 'mcp-server', icon: <SettingsIcon size={18} />, path: '/settings/mcp-server', color: '#10b981' },
      ]
    },
    {
      id: 'shortcuts',
      items: [
        { id: 'shortcuts', icon: <KeyboardIcon size={18} />, path: '/settings/shortcuts', color: '#f59e0b' },
        { id: 'quick-phrases', icon: <KeyboardIcon size={18} />, path: '/settings/quick-phrases', color: '#f97316' },
      ]
    },
    {
      id: 'others',
      items: [
        { id: 'workspace-settings', icon: <WorkspaceIcon size={18} />, path: '/settings/workspace', color: '#f59e0b' },
        { id: 'knowledge-settings', icon: <MenuBookIcon size={18} />, path: '/settings/knowledge', color: '#059669' },
        { id: 'data-settings', icon: <StorageIcon size={18} />, path: '/settings/data', color: '#0ea5e9' },
        { id: 'notion-settings', icon: <DatabaseIcon size={18} />, path: '/settings/notion', color: '#6366f1' },
        { id: 'voice-settings', icon: <RecordVoiceOverIcon size={18} />, path: '/settings/voice', color: '#8b5cf6' },
        { id: 'features', icon: <ExtensionIcon size={18} />, path: '/settings/features', color: '#22c55e' },
        { id: 'about', icon: <InfoIcon size={18} />, path: '/settings/about', color: '#64748b' },
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
            {t('settings.main.title')}
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
              {t(`settings.main.groups.${group.id}`)}
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
                          {t(`settings.main.items.${item.id}.title`)}
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
                          {t(`settings.main.items.${item.id}.desc`)}
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