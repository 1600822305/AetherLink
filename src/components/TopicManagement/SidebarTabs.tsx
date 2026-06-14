
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
import { createLogger } from '../../shared/services/infra/logger';

const logger = createLogger('SidebarTabs');

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

  // 🚀 优化：话题选择处理 - Cherry Studio 极简模式
  // 移除冗余的 topicCacheManager.updateTopic 调用（useActiveTopic 中已包含）
  // ⚡ 关键修复：移除 startTransition，让选中状态立即响应
  // startTransition 会将更新标记为低优先级，导致 1-2 秒的延迟
  const handleSelectTopic = useCallback((topic: ChatTopic) => {
    logger.debug('handleSelectTopic被调用:', topic.id, topic.name);

    // 直接 dispatch，立即更新 Redux 状态，UI 即时响应
    dispatch(newMessagesActions.setCurrentTopicId(topic.id));

    logger.debug('话题切换完成');
  }, [dispatch]);

  const handleDeleteTopic = useCallback(async (topicId: string, event: React.MouseEvent) => {
    event.stopPropagation();

    logger.debug('开始删除话题:', topicId);

    const topics = assistantWithTopics?.topics ?? [];
    const topicToDelete = topics.find(t => t.id === topicId);
    if (!topicToDelete || !currentAssistant) {
      logger.warn('找不到要删除的话题或当前助手');
      return;
    }

    const isDeletingLastTopic = topics.length <= 1;
    const deletingCurrentTopic = currentTopicId === topicId;

    let nextTopicAfterDeletion: ChatTopic | null = null;
    if (!isDeletingLastTopic && deletingCurrentTopic) {
      const currentIndex = topics.findIndex(t => t.id === topicId);
      if (currentIndex !== -1) {
        nextTopicAfterDeletion = currentIndex < topics.length - 1
          ? topics[currentIndex + 1]
          : topics[currentIndex - 1];
      }
    }

    startTransition(() => {
      if (deletingCurrentTopic) {
        if (nextTopicAfterDeletion) {
          dispatch(newMessagesActions.setCurrentTopicId(nextTopicAfterDeletion.id));
        } else if (isDeletingLastTopic) {
          dispatch(newMessagesActions.setCurrentTopicId(''));
        }
      }

      dispatch(removeTopic({
        assistantId: currentAssistant.id,
        topicId
      }));
    });

    Promise.resolve().then(async () => {
      try {
        await TopicService.deleteTopic(topicId);
        logger.debug('话题数据库删除完成:', topicId);
      } catch (error) {
        logger.error('删除话题失败，需要回滚UI状态:', error);
        refreshTopics();
      }
    });
  }, [assistantWithTopics, currentAssistant, currentTopicId, dispatch, refreshTopics]);

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
