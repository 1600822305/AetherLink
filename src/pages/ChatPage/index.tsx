import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../../shared/store';
import { useChatPageLayout } from './hooks/useChatPageLayout.ts';
import { useModelSelection } from './hooks/useModelSelection.ts';
// import { useTopicManagement } from '../../shared/hooks/useTopicManagement';
import { useMessageHandling } from './hooks/useMessageHandling.ts';
import { useChatFeatures } from './hooks/useChatFeatures.ts';
import { useAIDebate } from './hooks/useAIDebate.ts';
import { ChatPageUI } from './components/ChatPageUI.tsx';
import {
  selectMessagesForTopic,
  selectTopicLoading,
  selectTopicStreaming
} from '../../shared/store/selectors/messageSelectors';
import { EventEmitter, EVENT_NAMES } from '../../shared/services/infra/EventService';
import { TopicService } from '../../shared/services/topics/TopicService';
import { VideoTaskManager } from '../../shared/services/ai/VideoTaskManager';
import { newMessagesActions } from '../../shared/store/slices/newMessagesSlice';
import { useActiveTopic } from '../../hooks/useActiveTopic';
import ChatSearchInterface from '../../components/search/ChatSearchInterface';
import { scrollToMessage } from '../../shared/utils/scrollToMessage';
import { createLogger } from '../../shared/services/infra/logger';

const logger = createLogger('ChatPage');

const EMPTY_MESSAGES_ARRAY: any[] = [];

const ChatPage: React.FC = () => {
  const dispatch = useDispatch();

  // 从Redux获取状态
  const currentAssistant = useSelector((state: RootState) => state.assistants.currentAssistant);

  // 改造为：使用useActiveTopic Hook自动处理话题加载
  const { activeTopic: currentTopic } = useActiveTopic(
    currentAssistant || {} as any,
    undefined
  );

  // 消息引用，用于分支功能
  const messagesRef = useRef<any[]>([]);

  // 搜索状态
  const [showSearch, setShowSearch] = useState(false);

  // 应用启动时恢复未完成的视频生成任务
  useEffect(() => {
    const resumeVideoTasks = async () => {
      try {
        logger.debug('检查并恢复未完成的视频生成任务');
        await VideoTaskManager.resumeTasks();
      } catch (error) {
        logger.error('恢复视频任务失败:', error);
      }
    };

    // 延迟一点执行，确保应用完全加载
    const timer = setTimeout(resumeVideoTasks, 1000);
    return () => clearTimeout(timer);
  }, []); // 只在组件挂载时执行一次

  // ：话题加载由useActiveTopic Hook自动处理，无需手动加载

  const currentMessages = useSelector((state: RootState) => {
    if (!currentTopic?.id) {
      return EMPTY_MESSAGES_ARRAY;
    }
    const messages = selectMessagesForTopic(state, currentTopic.id);
    return Array.isArray(messages) ? messages : EMPTY_MESSAGES_ARRAY;
  });

  // 更新消息引用
  useEffect(() => {
    messagesRef.current = currentMessages;
  }, [currentMessages]);

  const isStreaming = useSelector((state: RootState) => {
    if (!currentTopic?.id) {
      return false;
    }
    return Boolean(selectTopicStreaming(state, currentTopic.id));
  });

  const reduxLoading = useSelector((state: RootState) => {
    if (!currentTopic?.id) {
      return false;
    }
    return Boolean(selectTopicLoading(state, currentTopic.id));
  });

  // ：使用Redux的loading状态
  const isLoading = reduxLoading;

  // 布局相关钩子
  const {
    isMobile,
    drawerOpen,
    setDrawerOpen,
    navigate
  } = useChatPageLayout();

  // 模型选择钩子
  const {
    selectedModel,
    availableModels,
    handleModelSelect,
    handleModelMenuClick,
    handleModelMenuClose,
    menuOpen
  } = useModelSelection();

  // 话题管理钩子 - 移除未使用的 handleCreateTopic
  // const { handleCreateTopic } = useTopicManagement();

  // 🚀 优化：使用useCallback稳定函数引用
  const handleClearTopic = useCallback(() => {
    if (currentTopic) {
      TopicService.clearTopicContent(currentTopic.id);
    }
  }, [currentTopic?.id]);

  // 搜索相关处理函数 - 使用useCallback稳定引用
  const handleSearchToggle = useCallback(() => {
    setShowSearch(prev => !prev);
  }, []);

  const handleSearchClose = useCallback(() => {
    setShowSearch(false);
  }, []);

  const handleTopicSelect = useCallback((topicId: string) => {
    dispatch(newMessagesActions.setCurrentTopicId(topicId));
  }, [dispatch]);

  const handleMessageSelect = useCallback((topicId: string, messageId: string) => {
    // 切换到对应话题并滚动定位到对应消息
    dispatch(newMessagesActions.setCurrentTopicId(topicId));
    scrollToMessage(messageId);
  }, [dispatch]);

  // 消息处理钩子
  const {
    handleSendMessage,
    handleDeleteMessage,
    handleRegenerateMessage,
    handleSwitchMessageVersion,
    handleResendMessage
    // loadTopicMessages - 暂时不使用，由 useActiveTopic 自动处理
  } = useMessageHandling(selectedModel, currentTopic);

  // 特殊功能钩子 (网络搜索、图像生成、视频生成、URL抓取等)
  const {
    webSearchActive,
    imageGenerationMode,
    videoGenerationMode,
    toolsEnabled,
    mcpMode,
    toggleWebSearch,
    toggleImageGenerationMode,
    toggleVideoGenerationMode,
    toggleToolsEnabled,
    handleMCPModeChange,
    handleStopResponseClick,
    handleMessageSend,
    handleMultiModelSend
  } = useChatFeatures(currentTopic, currentMessages, selectedModel, handleSendMessage);

  // AI辩论功能钩子
  const {
    isDebating,
    handleStartDebate,
    handleStopDebate
  } = useAIDebate({
    onSendMessage: handleSendMessage,
    currentTopic
  });

  // ：消息加载由useActiveTopic Hook自动处理，无需手动加载

  // 添加NEW_BRANCH事件处理
  useEffect(() => {
    const handleNewBranch = async (index: number) => {
      if (!currentTopic || !currentAssistant) {
        logger.error('无法创建分支: 缺少当前话题或助手');
        return;
      }

      const newTopic = await TopicService.createTopicBranch(currentTopic, messagesRef.current, index);
      if (!newTopic) {
        logger.error('创建分支失败');
      }
    };

    // 监听NEW_BRANCH事件
    const unsubscribe = EventEmitter.on(EVENT_NAMES.NEW_BRANCH, handleNewBranch);

    return () => {
      unsubscribe();
    };
  }, [currentTopic, currentAssistant, dispatch]);

  return (
    <>
      <ChatPageUI
        currentTopic={currentTopic}
        currentMessages={currentMessages}
        isStreaming={isStreaming}
        isLoading={isLoading}
        isMobile={isMobile}
        drawerOpen={drawerOpen}
        setDrawerOpen={setDrawerOpen}
        navigate={navigate}
        selectedModel={selectedModel}
        availableModels={availableModels}
        handleModelSelect={handleModelSelect}
        handleModelMenuClick={handleModelMenuClick}
        handleModelMenuClose={handleModelMenuClose}
        menuOpen={menuOpen}
        handleClearTopic={handleClearTopic}
        handleDeleteMessage={handleDeleteMessage}
        handleRegenerateMessage={handleRegenerateMessage}
        handleSwitchMessageVersion={handleSwitchMessageVersion}
        handleResendMessage={handleResendMessage}
        webSearchActive={webSearchActive}
        imageGenerationMode={imageGenerationMode}
        videoGenerationMode={videoGenerationMode}
        toolsEnabled={toolsEnabled}
        mcpMode={mcpMode}
        toggleWebSearch={toggleWebSearch}
        toggleImageGenerationMode={toggleImageGenerationMode}
        toggleVideoGenerationMode={toggleVideoGenerationMode}
        toggleToolsEnabled={toggleToolsEnabled}
        handleMCPModeChange={handleMCPModeChange}
        handleMessageSend={handleMessageSend}
        handleMultiModelSend={handleMultiModelSend}
        handleStopResponseClick={handleStopResponseClick}
        isDebating={isDebating}
        handleStartDebate={handleStartDebate}
        handleStopDebate={handleStopDebate}
        showSearch={showSearch}
        onSearchToggle={handleSearchToggle}
      />

      {/* 搜索界面 */}
      <ChatSearchInterface
        open={showSearch}
        onClose={handleSearchClose}
        onTopicSelect={handleTopicSelect}
        onMessageSelect={handleMessageSelect}
      />
    </>
  );
};

export default ChatPage;