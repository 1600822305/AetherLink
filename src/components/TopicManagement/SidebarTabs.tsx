
import React, { useCallback, startTransition, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '../../shared/store';
import { SidebarProvider } from './SidebarContext';
import { useSidebarState } from './hooks/useSidebarState';
import { useAssistantManagement } from './hooks/useAssistantManagement';
import { useTopicManagement } from '../../shared/hooks/useTopicManagement';
import { useSettingsManagement } from './hooks/useSettingsManagement';
import { TopicService } from '../../shared/services/topics/TopicService';
import { newMessagesActions } from '../../shared/store/slices/newMessagesSlice';
import { removeTopic } from '../../shared/store/slices/assistantsSlice';
import type { ChatTopic } from '../../shared/types/Assistant';
import SidebarTabsContent from './SidebarTabsContent';

interface SidebarTabsProps {
  mcpMode?: 'prompt' | 'function';
  toolsEnabled?: boolean;
  onMCPModeChange?: (mode: 'prompt' | 'function') => void;
  onToolsToggle?: (enabled: boolean) => void;
}

/**
 * 侧边栏标签页组件
 *
 * 这是一个容器组件，负责管理状态和提供上下文
 * 🔥 使用React.memo优化性能，避免不必要的重新渲染
 */
const SidebarTabs = React.memo(function SidebarTabs({
  mcpMode,
  toolsEnabled,
  onMCPModeChange,
  onToolsToggle
}: SidebarTabsProps) {
  const dispatch = useDispatch();
  const currentTopicId = useSelector((state: RootState) => state.messages.currentTopicId);

  // 使用各种钩子获取状态和方法
  const {
    value,
    setValue,
    loading,
    userAssistants,
    setUserAssistants,
    currentAssistant,
    setCurrentAssistant,
    assistantWithTopics,
    currentTopic,
    updateAssistantTopic,
    refreshTopics
  } = useSidebarState();

  // 助手管理 - 传递标签页切换函数
  const {
    handleSelectAssistant,
    handleAddAssistant,
    handleUpdateAssistant,
    handleDeleteAssistant
  } = useAssistantManagement({
    currentAssistant,
    setCurrentAssistant,
    setUserAssistants,
    currentTopic,
    switchToTopicTab: () => setValue(1) // 🔥 传递切换到话题标签页的函数
  });

  // 话题管理 - 使用统一的创建Hook + 本地其他功能
  const { handleCreateTopic } = useTopicManagement();

  // 本地话题管理功能 - Cherry Studio极简模式
  const handleSelectTopic = useCallback((topic: ChatTopic) => {
    console.log('[SidebarTabs] handleSelectTopic被调用:', topic.id, topic.name);

    // 🚀 Cherry Studio模式：只设置Redux状态，让useActiveTopic处理其余逻辑
    startTransition(() => {
      dispatch(newMessagesActions.setCurrentTopicId(topic.id));
    });

    console.log('[SidebarTabs] 话题切换完成');
  }, [dispatch]);

  const handleDeleteTopic = useCallback(async (topicId: string, event: React.MouseEvent) => {
    event.stopPropagation();

    console.log('[SidebarTabs] 开始删除话题:', topicId);

    // 🚀 Cherry Studio模式：乐观更新，立即从UI中移除话题
    const topicToDelete = assistantWithTopics?.topics?.find(t => t.id === topicId);
    if (!topicToDelete || !currentAssistant) {
      console.warn('[SidebarTabs] 找不到要删除的话题或当前助手');
      return;
    }

    // 🎯 如果删除的是当前话题，先切换到其他话题
    if (currentTopicId === topicId && assistantWithTopics?.topics && assistantWithTopics.topics.length > 1) {
      const remainingTopics = assistantWithTopics.topics.filter(t => t.id !== topicId);
      if (remainingTopics.length > 0) {
        // 🌟 智能选择下一个话题：优先选择后面的，如果是最后一个则选择前面的
        const currentIndex = assistantWithTopics.topics.findIndex(t => t.id === topicId);
        const nextTopic = currentIndex < assistantWithTopics.topics.length - 1
          ? assistantWithTopics.topics[currentIndex + 1]
          : assistantWithTopics.topics[currentIndex - 1];

        console.log('[SidebarTabs] 删除当前话题，立即切换到:', nextTopic.name);
        startTransition(() => {
          dispatch(newMessagesActions.setCurrentTopicId(nextTopic.id));
        });
      }
    }

    // 立即从Redux中移除话题，UI立即响应
    startTransition(() => {
      // 🔥 关键修复：如果删除的是最后一个话题，先清空currentTopicId
      // 这样TopicTab的自动选择逻辑就会生效
      if (assistantWithTopics?.topics && assistantWithTopics.topics.length === 1) {
        console.log('[SidebarTabs] 删除最后一个话题，先清空currentTopicId');
        dispatch(newMessagesActions.setCurrentTopicId(''));
      }

      dispatch(removeTopic({
        assistantId: currentAssistant.id,
        topicId: topicId
      }));
    });

    // 🔄 异步删除数据库数据，不阻塞UI
    Promise.resolve().then(async () => {
      try {
        await TopicService.deleteTopic(topicId);
        console.log('[SidebarTabs] 话题数据库删除完成:', topicId);
      } catch (error) {
        console.error('[SidebarTabs] 删除话题失败，需要回滚UI状态:', error);
        // TODO: 实现错误回滚逻辑
        refreshTopics(); // 重新加载数据以恢复状态
      }
    });
  }, [dispatch, assistantWithTopics, currentAssistant, currentTopicId, refreshTopics]);

  const handleUpdateTopic = (topic: ChatTopic) => {
    updateAssistantTopic(topic);
  };

  // 设置管理
  const {
    settings,
    settingsArray,
    handleSettingChange,
    handleContextLengthChange,
    handleContextCountChange,
    handleMathRendererChange,
    handleThinkingEffortChange
  } = useSettingsManagement();



  // 优化：使用 useMemo 避免每次都创建新的 contextValue 对象
  const contextValue = useMemo(() => ({
    // 状态
    loading,
    value,
    userAssistants,
    currentAssistant,
    assistantWithTopics,
    currentTopic,

    // 设置状态的函数
    setValue,
    setCurrentAssistant,

    // 助手管理函数
    handleSelectAssistant,
    handleAddAssistant,
    handleUpdateAssistant,
    handleDeleteAssistant,

    // 话题管理函数
    handleCreateTopic,
    handleSelectTopic,
    handleDeleteTopic,
    handleUpdateTopic,

    // 设置管理
    settings,
    settingsArray,
    handleSettingChange,
    handleContextLengthChange,
    handleContextCountChange,
    handleMathRendererChange,
    handleThinkingEffortChange,

    // MCP 相关状态和函数
    mcpMode,
    toolsEnabled,
    handleMCPModeChange: onMCPModeChange,
    handleToolsToggle: onToolsToggle,

    // 刷新函数
    refreshTopics
  }), [
    loading,
    value,
    userAssistants,
    currentAssistant,
    assistantWithTopics,
    currentTopic,
    setValue,
    setCurrentAssistant,
    handleSelectAssistant,
    handleAddAssistant,
    handleUpdateAssistant,
    handleDeleteAssistant,
    handleCreateTopic,
    handleSelectTopic,
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
    onMCPModeChange,
    onToolsToggle,
    refreshTopics
  ]);

  return (
    <SidebarProvider value={contextValue}>
      <SidebarTabsContent />
    </SidebarProvider>
  );
});

export default SidebarTabs;
