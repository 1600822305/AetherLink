import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Globe as LanguageIcon,
  Bot as SmartToyIcon,
  Settings as SettingsIcon,
  Keyboard as KeyboardIcon,
  Database as StorageIcon,
  Mic as RecordVoiceOverIcon,
  Info as InfoIcon,
  Palette as FormatColorFillIcon,
  Settings as SettingsApplicationsIcon,
  Sliders as TuneIcon,
  Wand2 as AutoFixHighIcon,
  Zap as SkillsIcon,
  GitBranch,
  MessageSquare as ForumIcon,
  BookOpen as MenuBookIcon,
  Folder as WorkspaceIcon,
  Database as DatabaseIcon,
  FileText as NoteIcon,
  Shield as ShieldIcon,
  LayoutGrid as CompactIcon,
  List as DetailedIcon,
} from 'lucide-react';
import { IconButton, Tooltip } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  SafeAreaContainer,
  HeaderBar,
  Container,
  YStack,
  SettingGroup,
  SettingItem,
} from '../../components/settings/SettingComponents';
import { CustomIcon } from '../../components/icons/CustomIcon';
import useScrollPosition from '../../hooks/useScrollPosition';
import { useSwipeGesture } from '../../hooks/useSwipeGesture';
import { useTranslation } from '../../i18n';

// 精简模式存储键
const COMPACT_MODE_KEY = 'settings-compact-mode';

const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const theme = useTheme();
  
  // 精简模式状态
  const [isCompactMode, setIsCompactMode] = useState(() => {
    try {
      return localStorage.getItem(COMPACT_MODE_KEY) === 'true';
    } catch {
      return false;
    }
  });
  
  // 切换精简模式
  const toggleCompactMode = useCallback(() => {
    setIsCompactMode(prev => {
      const newValue = !prev;
      try {
        localStorage.setItem(COMPACT_MODE_KEY, String(newValue));
      } catch (error) {
        console.error('Failed to save compact mode preference:', error);
      }
      return newValue;
    });
  }, []);

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
    // 使用动态清理方式，自动支持所有以 scroll:settings- 开头的键
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('scroll:settings-')) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.error(t('settings.scrollCacheError'), error);
    }

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

  const navigateTo = (path: string) => {
    navigate(path);
  };

  // 定义设置菜单组
  const settingsGroups = [
    {
      title: t('settings.groups.basic'),
      items: [
        {
          id: 'appearance',
          title: t('settings.items.appearance.title'),
          description: t('settings.items.appearance.description'),
          icon: <FormatColorFillIcon size={24} />,
          path: '/settings/appearance',
          onClick: () => navigateTo('/settings/appearance'),
        },
        {
          id: 'behavior',
          title: t('settings.items.behavior.title'),
          description: t('settings.items.behavior.description'),
          icon: <SettingsApplicationsIcon size={24} />,
          path: '/settings/behavior',
          onClick: () => navigateTo('/settings/behavior'),
        },
      ],
    },
    {
      title: t('settings.groups.modelService'),
      items: [
        {
          id: 'default-model',
          title: t('settings.items.defaultModel.title'),
          description: t('settings.items.defaultModel.description'),
          icon: <SmartToyIcon size={24} />,
          path: '/settings/default-model',
          onClick: () => navigateTo('/settings/default-model'),
        },
        {
          id: 'assistant-model',
          title: t('settings.items.topicNaming.title'),
          description: t('settings.items.topicNaming.description'),
          icon: <TuneIcon size={24} />,
          path: '/settings/assistant-model',
          onClick: () => navigateTo('/settings/assistant-model'),
        },
        {
          id: 'ai-debate',
          title: t('settings.items.aiDebate.title'),
          description: t('settings.items.aiDebate.description'),
          icon: <ForumIcon size={24} />,
          path: '/settings/ai-debate',
          onClick: () => navigateTo('/settings/ai-debate'),
        },
        {
          id: 'model-combo',
          title: t('settings.items.modelCombo.title'),
          description: t('settings.items.modelCombo.description'),
          icon: <GitBranch size={24} />,
          path: '/settings/model-combo',
          onClick: () => navigateTo('/settings/model-combo'),
        },
        {
          id: 'context-condense',
          title: t('settings.items.contextCondense.title', '上下文压缩'),
          description: t('settings.items.contextCondense.description', '智能压缩对话历史，节省Token成本'),
          icon: <CustomIcon name="foldVertical" size={24} />,
          path: '/settings/context-condense',
          onClick: () => navigateTo('/settings/context-condense'),
        },
      ],
    },
    {
      title: t('settings.groups.promptsAndTools'),
      items: [
        {
          id: 'agent-prompts',
          title: t('settings.items.agentPrompts.title'),
          description: t('settings.items.agentPrompts.description'),
          icon: <AutoFixHighIcon size={24} />,
          path: '/settings/agent-prompts',
          onClick: () => navigateTo('/settings/agent-prompts'),
        },
        {
          id: 'skills',
          title: t('settings.items.skills.title'),
          description: t('settings.items.skills.description'),
          icon: <SkillsIcon size={24} />,
          path: '/settings/skills',
          onClick: () => navigateTo('/settings/skills'),
        },
        {
          id: 'web-search',
          title: t('settings.items.webSearch.title'),
          description: t('settings.items.webSearch.description'),
          icon: <LanguageIcon size={24} />,
          path: '/settings/web-search',
          onClick: () => navigateTo('/settings/web-search'),
        },
        {
          id: 'mcp-server',
          title: t('settings.items.mcpServer.title'),
          description: t('settings.items.mcpServer.description'),
          icon: <SettingsIcon size={24} />,
          path: '/settings/mcp-server',
          onClick: () => navigateTo('/settings/mcp-server'),
        },
      ],
    },
    {
      title: t('settings.groups.shortcuts'),
      items: [
        {
          id: 'quick-phrases',
          title: t('settings.items.quickPhrases.title'),
          description: t('settings.items.quickPhrases.description'),
          icon: <KeyboardIcon size={24} />,
          path: '/settings/quick-phrases',
          onClick: () => navigateTo('/settings/quick-phrases'),
        },
      ],
    },
    {
      title: t('settings.groups.dataAndKnowledge'),
      items: [
        {
          id: 'workspace-settings',
          title: t('settings.items.workspace.title'),
          description: t('settings.items.workspace.description'),
          icon: <WorkspaceIcon size={24} />,
          path: '/settings/workspace',
          onClick: () => navigateTo('/settings/workspace'),
        },
        {
          id: 'knowledge-settings',
          title: t('settings.items.knowledge.title'),
          description: t('settings.items.knowledge.description'),
          icon: <MenuBookIcon size={24} />,
          path: '/settings/knowledge',
          onClick: () => navigateTo('/settings/knowledge'),
        },
        {
          id: 'memory-settings',
          title: t('settings.items.memory.title'),
          description: t('settings.items.memory.description'),
          icon: <DatabaseIcon size={24} />,
          path: '/settings/memory',
          onClick: () => navigateTo('/settings/memory'),
        },
        {
          id: 'note-settings',
          title: t('settings.items.notes.title'),
          description: t('settings.items.notes.description'),
          icon: <NoteIcon size={24} />,
          path: '/settings/notes',
          onClick: () => navigateTo('/settings/notes'),
        },
        {
          id: 'data-settings',
          title: t('settings.items.data.title'),
          description: t('settings.items.data.description'),
          icon: <StorageIcon size={24} />,
          path: '/settings/data',
          onClick: () => navigateTo('/settings/data'),
        },
        {
          id: 'notion-settings',
          title: t('settings.items.notion.title'),
          description: t('settings.items.notion.description'),
          icon: <DatabaseIcon size={24} />,
          path: '/settings/notion',
          onClick: () => navigateTo('/settings/notion'),
        },
      ],
    },
    {
      title: t('settings.groups.system'),
      items: [
        {
          id: 'voice-settings',
          title: t('settings.items.voice.title'),
          description: t('settings.items.voice.description'),
          icon: <RecordVoiceOverIcon size={24} />,
          path: '/settings/voice',
          onClick: () => navigateTo('/settings/voice'),
        },
        {
          id: 'network-proxy',
          title: t('settings.items.networkProxy.title'),
          description: t('settings.items.networkProxy.description'),
          icon: <ShieldIcon size={24} />,
          path: '/settings/network-proxy',
          onClick: () => navigateTo('/settings/network-proxy'),
        },
        {
          id: 'about',
          title: t('settings.items.about.title'),
          description: t('settings.items.about.description'),
          icon: <InfoIcon size={24} />,
          path: '/settings/about',
          onClick: () => navigateTo('/settings/about'),
        },
      ],
    },
  ];
  
  // 精简模式切换按钮
  const compactModeToggle = (
    <Tooltip title={isCompactMode ? t('settings.detailedMode', '详细模式') : t('settings.compactMode', '精简模式')}>
      <IconButton
        onClick={toggleCompactMode}
        sx={{
          color: theme.palette.text.secondary,
          '&:hover': {
            color: theme.palette.primary.main,
          },
        }}
      >
        {isCompactMode ? <DetailedIcon size={22} /> : <CompactIcon size={22} />}
      </IconButton>
    </Tooltip>
  );

  return (
    <SafeAreaContainer {...swipeHandlers}>
      <HeaderBar
        title={t('settings.title')}
        onBackPress={handleBack}
        rightButton={compactModeToggle}
      />
      <Container
        ref={containerRef}
        onScroll={handleScroll}
        sx={{
          overflow: 'auto',
          // 🚀 性能优化：硬件加速和滚动优化
          willChange: 'scroll-position',
          transform: 'translateZ(0)',
          WebkitOverflowScrolling: 'touch',
          contain: 'layout style paint',
          // 禁用平滑滚动，提升性能
          scrollBehavior: 'auto',
        }}
      >
        {isCompactMode ? (
          // 精简清爽风格 - iOS风格列表，不显示描述
          <YStack sx={{ gap: 3 }}>
            {settingsGroups.map((group, index) => (
              <SettingGroup key={index} title={group.title}>
                {group.items.map((item) => (
                  <SettingItem
                    key={item.id}
                    title={item.title}
                    icon={item.icon}
                    onClick={item.onClick}
                    showArrow={true}
                  />
                ))}
              </SettingGroup>
            ))}
          </YStack>
        ) : (
          // 详细模式 - 列表布局
          <YStack sx={{ gap: 3 }}>
            {settingsGroups.map((group, index) => (
              <SettingGroup key={index} title={group.title}>
                {group.items.map((item) => (
                  <SettingItem
                    key={item.id}
                    title={item.title}
                    description={item.description}
                    icon={item.icon}
                    onClick={item.onClick}
                    showArrow={true}
                  />
                ))}
              </SettingGroup>
            ))}
          </YStack>
        )}
      </Container>
    </SafeAreaContainer>
  );
};

export default SettingsPage;