import React, { useMemo, startTransition, useDeferredValue } from 'react';
import { Box, Tabs, Tab, CircularProgress, useTheme } from '@mui/material';
import { useSidebarContext } from './SidebarContext';
import TabPanel, { a11yProps } from './TabPanel';
import AssistantTab from './AssistantTab/index';
import TopicTab from './TopicTab/index';
import SettingsTab from './SettingsTab/index';
import { getThemeColors } from '../../shared/utils/themeUtils';
import { useSelector } from 'react-redux';
import type { RootState } from '../../shared/store';
import { Bot, MessageSquare, Settings } from 'lucide-react';

/**
 * 侧边栏标签页内容组件 - 使用memo优化性能
 */
const SidebarTabsContent = React.memo(function SidebarTabsContent() {
  const {
    loading,
    value,
    setValue,
    userAssistants,
    currentAssistant,
    assistantWithTopics,
    currentTopic,
    handleSelectAssistant,
    handleAddAssistant,
    handleUpdateAssistant,
    handleDeleteAssistant,

    handleSelectTopic,
    handleCreateTopic,
    handleDeleteTopic,
    handleUpdateTopic,
    settings,
    settingsArray,
    handleSettingChange,
    handleContextLengthChange,
    handleContextCountChange,
    handleMathRendererChange,
    handleThinkingEffortChange,
    mcpMode,
    toolsEnabled,
    handleMCPModeChange,
    handleToolsToggle,
    refreshTopics
  } = useSidebarContext();

  // 获取主题和主题工具 - 使用useMemo优化性能
  const theme = useTheme();
  // 使用更精确的选择器，避免不必要的重新渲染
  const themeStyle = useSelector((state: RootState) => state.settings.themeStyle, (prev, next) => prev === next);
  const themeColors = useMemo(() => getThemeColors(theme, themeStyle), [theme, themeStyle]);

  // 使用useDeferredValue延迟非关键状态更新，提升切换性能
  const deferredValue = useDeferredValue(value);
  const deferredUserAssistants = useDeferredValue(userAssistants);
  const deferredCurrentAssistant = useDeferredValue(currentAssistant);
  const deferredAssistantWithTopics = useDeferredValue(assistantWithTopics);
  const deferredCurrentTopic = useDeferredValue(currentTopic);

  // 标签页切换 - 优化版本，避免不必要的数据刷新
  const handleChange = (_event: React.SyntheticEvent, newValue: number) => {
    console.log(`[SidebarTabs] 标签页切换: ${value} -> ${newValue}`, {
      currentAssistant: currentAssistant?.id,
      assistantWithTopics: assistantWithTopics?.id,
      topicsCount: assistantWithTopics?.topics?.length || 0,
      topicIds: assistantWithTopics?.topicIds?.length || 0,
      currentTopic: currentTopic?.id
    });

    if (newValue === 1) { // 切换到话题标签页
      console.log('[SidebarTabs] 切换到话题标签页，话题详情:',
        assistantWithTopics?.topics?.map((t) => ({id: t.id, name: t.name})) || []);

      // 优化：只有在话题数据为空或过期时才刷新
      const hasTopics = assistantWithTopics?.topics && assistantWithTopics.topics.length > 0;
      if (!hasTopics && refreshTopics) {
        console.log('[SidebarTabs] 话题数据为空，刷新话题数据');
        refreshTopics();
      } else {
        console.log('[SidebarTabs] 话题数据已存在，跳过刷新以提升性能');
      }
    }

    if (newValue === 0) { // 切换到助手标签页
      console.log('[SidebarTabs] 切换到助手标签页');
      // 助手数据已预加载，无需刷新
    }

    // 使用startTransition标记为非紧急更新，提升性能
    startTransition(() => {
      setValue(newValue);
    });
  };

  return (
    <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs
              value={value}
              onChange={handleChange}
              aria-label="sidebar tabs"
              variant="fullWidth"
              sx={{
                minHeight: '48px',
                margin: '0 10px',
                padding: '10px 0',
                '& .MuiTabs-indicator': {
                  display: 'none', // 隐藏底部指示器
                },
                '& .MuiTab-root': {
                  minHeight: '32px',
                  borderRadius: '8px',
                  // 移除transition，减少动画计算开销
                  transition: 'none',
                  '&.Mui-selected': {
                    backgroundColor: themeColors.selectedColor,
                  },
                  '&:hover': {
                    backgroundColor: themeColors.hoverColor,
                  },
                },
              }}
            >
              <Tab
                icon={<Bot size={18} />}
                label="助手"
                {...a11yProps(0)}
                sx={{
                  minHeight: '32px',
                  borderRadius: '8px',
                  color: themeColors.textPrimary, // 使用主题文字颜色
                  '& .MuiTab-iconWrapper': {
                    marginBottom: '2px',
                  },
                  '&.Mui-selected': {
                    color: themeColors.textPrimary, // 选中状态保持文字颜色
                  },
                  '&:hover': {
                    color: themeColors.textPrimary, // 悬停状态保持文字颜色
                  },
                }}
              />
              <Tab
                icon={<MessageSquare size={18} />}
                label="话题"
                {...a11yProps(1)}
                sx={{
                  minHeight: '32px',
                  borderRadius: '8px',
                  color: themeColors.textPrimary, // 使用主题文字颜色
                  '& .MuiTab-iconWrapper': {
                    marginBottom: '2px',
                  },
                  '&.Mui-selected': {
                    color: themeColors.textPrimary, // 选中状态保持文字颜色
                  },
                  '&:hover': {
                    color: themeColors.textPrimary, // 悬停状态保持文字颜色
                  },
                }}
              />
              <Tab
                icon={<Settings size={18} />}
                label="设置"
                {...a11yProps(2)}
                sx={{
                  minHeight: '32px',
                  borderRadius: '8px',
                  color: themeColors.textPrimary, // 使用主题文字颜色
                  '& .MuiTab-iconWrapper': {
                    marginBottom: '2px',
                  },
                  '&.Mui-selected': {
                    color: themeColors.textPrimary, // 选中状态保持文字颜色
                  },
                  '&:hover': {
                    color: themeColors.textPrimary, // 悬停状态保持文字颜色
                  },
                }}
              />
            </Tabs>
          </Box>

          {/* 修复：保持所有TabPanel挂载，只通过TabPanel内部的display控制显示 */}
          <TabPanel value={deferredValue} index={0}>
            <AssistantTab
              userAssistants={deferredUserAssistants}
              currentAssistant={deferredCurrentAssistant}
              onSelectAssistant={handleSelectAssistant}
              onAddAssistant={handleAddAssistant}
              onUpdateAssistant={handleUpdateAssistant}
              onDeleteAssistant={handleDeleteAssistant}
            />
          </TabPanel>

          <TabPanel value={deferredValue} index={1}>
            {/* 直接渲染组件，与最佳实例保持一致 */}
            <TopicTab
              key={deferredAssistantWithTopics?.id || deferredCurrentAssistant?.id || 'no-assistant'}
              currentAssistant={deferredAssistantWithTopics || deferredCurrentAssistant}
              currentTopic={deferredCurrentTopic}
              onSelectTopic={handleSelectTopic}
              onCreateTopic={handleCreateTopic}
              onDeleteTopic={handleDeleteTopic}
              onUpdateTopic={handleUpdateTopic}
            />
          </TabPanel>

          <TabPanel value={deferredValue} index={2}>
            <SettingsTab
              settings={settingsArray}
              onSettingChange={handleSettingChange}
              initialContextLength={settings.contextLength}
              onContextLengthChange={handleContextLengthChange}
              initialContextCount={settings.contextCount}
              onContextCountChange={handleContextCountChange}
              initialMathRenderer={settings.mathRenderer}
              onMathRendererChange={handleMathRendererChange}
              initialThinkingEffort={settings.defaultThinkingEffort}
              onThinkingEffortChange={handleThinkingEffortChange}
              mcpMode={mcpMode}
              toolsEnabled={toolsEnabled}
              onMCPModeChange={handleMCPModeChange}
              onToolsToggle={handleToolsToggle}
            />
          </TabPanel>
        </>
      )}
    </Box>
  );
});

export default SidebarTabsContent;
