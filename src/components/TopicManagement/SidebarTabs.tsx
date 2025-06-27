
import React, { useCallback, useMemo, useRef } from 'react';
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
    const startTime = performance.now();
    console.log('[SidebarTabs] handleSelectTopic被调用:', topic.id, topic.name);

    // 🚀 Cherry Studio模式：直接设置Redux状态，不使用startTransition避免延迟
    dispatch(newMessagesActions.setCurrentTopicId(topic.id));

    const endTime = performance.now();
    console.log(`[SidebarTabs] 话题切换完成，耗时: ${(endTime - startTime).toFixed(2)}ms`);
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
        dispatch(newMessagesActions.setCurrentTopicId(nextTopic.id));
      }
    }

    // 立即从Redux中移除话题，UI立即响应
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

    // 🔄 异步删除数据库数据，不阻塞UI - 使用 queueMicrotask 更高效
    queueMicrotask(async () => {
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



  // 优化：使用 useRef 缓存稳定的函数，避免重复创建
  const stableFunctionsRef = useRef({
    handleSelectAssistant,
    handleAddAssistant,
    handleUpdateAssistant,
    handleDeleteAssistant,
    handleCreateTopic,
    handleSelectTopic,
    handleDeleteTopic,
    handleUpdateTopic,
    handleSettingChange,
    handleContextLengthChange,
    handleContextCountChange,
    handleMathRendererChange,
    handleThinkingEffortChange,
    handleMCPModeChange: onMCPModeChange,
    handleToolsToggle: onToolsToggle,
  });

  // 更新稳定函数引用
  stableFunctionsRef.current = {
    handleSelectAssistant,
    handleAddAssistant,
    handleUpdateAssistant,
    handleDeleteAssistant,
    handleCreateTopic,
    handleSelectTopic,
    handleDeleteTopic,
    handleUpdateTopic,
    handleSettingChange,
    handleContextLengthChange,
    handleContextCountChange,
    handleMathRendererChange,
    handleThinkingEffortChange,
    handleMCPModeChange: onMCPModeChange,
    handleToolsToggle: onToolsToggle,
  };

  // 简化的 context 值，减少计算开销
  const contextValue = useMemo(() => ({
    // 频繁变化的状态
    loading,
    value,
    currentAssistant,
    userAssistants,
    currentTopic,
    assistantWithTopics,
    settings,
    settingsArray,
    mcpMode,
    toolsEnabled,

    // 稳定的函数引用
    ...stableFunctionsRef.current,

    // 少量的其他属性
    setValue,
    setCurrentAssistant,
    refreshTopics,
  }), [
    // 只包含真正会变化的值
    loading,
    value,
    currentAssistant,
    userAssistants,
    currentTopic,
    assistantWithTopics,
    settings,
    settingsArray,
    mcpMode,
    toolsEnabled,
    setValue,
    setCurrentAssistant,
    refreshTopics,
  ]);

  return (
    <SidebarProvider value={contextValue}>
      <SidebarTabsContent />
    </SidebarProvider>
  );
});

export default SidebarTabs;
