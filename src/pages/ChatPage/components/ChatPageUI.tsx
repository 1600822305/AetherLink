import React, { useMemo, useCallback } from 'react';
import { Box, AppBar, Toolbar, Typography, IconButton } from '@mui/material';
import { Settings, Plus, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { CustomIcon } from '../../../components/icons';

import MessageList from '../../../components/message/MessageList';
import { ChatInput, CompactChatInput, IntegratedChatInput, ChatToolbar } from '../../../components/input';
import { Sidebar } from '../../../components/TopicManagement';
import DialogModelSelector from './DialogModelSelector';
import DropdownModelSelector from './DropdownModelSelector';
import { UnifiedModelDisplay } from './UnifiedModelDisplay';
import { useSelector } from 'react-redux';
import type { RootState } from '../../../shared/store';
import type { SiliconFlowImageFormat, ChatTopic, Message, Model } from '../../../shared/types';
import { useTopicManagement } from '../../../shared/hooks/useTopicManagement';
import { getThemeColors } from '../../../shared/utils/themeUtils';
import { generateBackgroundStyle } from '../../../shared/utils/backgroundUtils';
import { useTheme } from '@mui/material/styles';
import ChatNavigation from '../../../components/chat/ChatNavigation';

// 辩论配置类型
interface DebateConfig {
  participants?: number;
  rounds?: number;
  timeLimit?: number;
}

// 简单的错误边界组件
const ErrorBoundary: React.FC<{ children: React.ReactNode; fallback?: React.ReactNode }> = ({
  children,
  fallback = <Typography color="error">组件加载出错，请刷新页面重试</Typography>
}) => {
  const [hasError, setHasError] = React.useState(false);

  React.useEffect(() => {
    const handleError = () => setHasError(true);
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};



// 暂时移除MotionIconButton，直接使用motion.div包装

// 默认设置常量 - 避免每次渲染时创建新对象
const DEFAULT_TOP_TOOLBAR_SETTINGS = {
  showSettingsButton: true,
  showModelSelector: true,
  modelSelectorStyle: 'full',
  showChatTitle: true,
  showTopicName: false,
  showNewTopicButton: false,
  showClearButton: false,
  showSearchButton: false,
  showMenuButton: true,
  leftComponents: ['menuButton', 'chatTitle', 'topicName', 'newTopicButton', 'clearButton'],
  rightComponents: ['searchButton', 'modelSelector', 'settingsButton'],
  componentPositions: [],
} as const;

// 所有从父组件传入的props类型
interface ChatPageUIProps {
  currentTopic: ChatTopic | null;
  currentMessages: Message[];
  isStreaming: boolean;
  isLoading: boolean;
  isMobile: boolean;
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  navigate: (path: string) => void;
  selectedModel: Model | null;
  availableModels: Model[];
  handleModelSelect: (model: Model) => void;
  handleModelMenuClick: () => void;
  handleModelMenuClose: () => void;
  menuOpen: boolean;
  handleClearTopic: () => void;
  handleDeleteMessage: (messageId: string) => void;
  handleRegenerateMessage: (messageId: string) => void;
  handleSwitchMessageVersion: (versionId: string) => void;
  handleResendMessage: (messageId: string) => void;
  webSearchActive: boolean;
  imageGenerationMode: boolean;
  videoGenerationMode: boolean;
  toolsEnabled: boolean;
  mcpMode: 'prompt' | 'function';
  toggleWebSearch: () => void;
  toggleImageGenerationMode: () => void;
  toggleVideoGenerationMode: () => void;
  toggleToolsEnabled: () => void;
  handleMCPModeChange: (mode: 'prompt' | 'function') => void;
  handleMessageSend: (content: string, images?: SiliconFlowImageFormat[], toolsEnabled?: boolean, files?: any[]) => void;
  handleMultiModelSend?: (content: string, models: Model[], images?: SiliconFlowImageFormat[], toolsEnabled?: boolean, files?: any[]) => void;
  handleStopResponseClick: () => void;
  isDebating?: boolean;
  handleStartDebate?: (question: string, config: DebateConfig) => void;
  handleStopDebate?: () => void;
  // 搜索相关
  showSearch?: boolean;
  onSearchToggle?: () => void;
}

// 使用 React.memo 优化组件，避免不必要的重新渲染
export const ChatPageUI: React.FC<ChatPageUIProps> = React.memo(({
  currentTopic,
  currentMessages,
  isStreaming,
  isLoading,
  isMobile,
  drawerOpen,
  setDrawerOpen,
  navigate,
  selectedModel,
  availableModels,
  handleModelSelect,
  handleModelMenuClick,
  handleModelMenuClose,
  menuOpen,
  handleClearTopic,
  handleDeleteMessage,
  handleRegenerateMessage,
  handleSwitchMessageVersion,
  handleResendMessage,
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
  handleMessageSend,
  handleMultiModelSend,
  handleStopResponseClick,
  isDebating,
  handleStartDebate,
  handleStopDebate,
  showSearch,
  onSearchToggle
}) => {
  // ==================== Hooks 和基础状态 ====================
  const theme = useTheme();

  // 使用统一的话题管理Hook
  const { handleCreateTopic } = useTopicManagement();

  // 本地状态

  // Redux 状态选择器
  const themeStyle = useSelector((state: RootState) => state.settings.themeStyle);
  const inputLayoutStyle = useSelector((state: RootState) =>
    state.settings.inputLayoutStyle || 'default'
  );
  const topToolbarSettings = useSelector((state: RootState) =>
    state.settings.topToolbar
  );
  const modelSelectorStyle = useSelector((state: RootState) =>
    state.settings.modelSelectorStyle
  );
  const chatBackground = useSelector((state: RootState) =>
    state.settings.chatBackground || {
      enabled: false,
      imageUrl: '',
      opacity: 0.3,
      size: 'cover',
      position: 'center',
      repeat: 'no-repeat'
    }
  );

  // ==================== 计算属性和样式 ====================
  const themeColors = getThemeColors(theme, themeStyle);

  const mergedTopToolbarSettings = {
    ...DEFAULT_TOP_TOOLBAR_SETTINGS,
    ...topToolbarSettings
  };

  const shouldShowToolbar = inputLayoutStyle === 'default';

  // 生成背景样式
  const backgroundStyle = useMemo(() =>
    generateBackgroundStyle(chatBackground),
    [chatBackground]
  );

  // 优化：将样式分离，减少重新计算
  const baseStyles = useMemo(() => ({
    mainContainer: {
      display: 'flex',
      flexDirection: { xs: 'column', sm: 'row' },
      height: '100vh',
      bgcolor: themeColors.background
    },
    appBar: {
      bgcolor: themeColors.paper,
      color: themeColors.textPrimary,
      borderBottom: '1px solid',
      borderColor: themeColors.borderColor,
    },
    messageContainer: {
      flexGrow: 1,
      overflow: 'auto',
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      maxWidth: '100%',
      backgroundColor: themeColors.background,
    },
    welcomeContainer: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '80%',
      p: 3,
      textAlign: 'center',
      bgcolor: themeColors.background,
    },
    welcomeText: {
      fontWeight: 400,
      color: themeColors.textPrimary,
      mb: 1,
    }
  }), [themeColors]);

  // contentContainerStyle已移除，样式直接在motion.div中定义

  // ==================== 事件处理函数 ====================

  // 搜索按钮点击处理
  const handleSearchClick = useCallback(() => {
    onSearchToggle?.();
  }, [onSearchToggle]);





  // 简化的工具栏组件渲染函数
  const renderToolbarComponent = useCallback((componentId: string) => {
    const isDIYMode = mergedTopToolbarSettings.componentPositions?.length > 0;

    const shouldShow = (settingKey: keyof typeof mergedTopToolbarSettings) =>
      isDIYMode || mergedTopToolbarSettings[settingKey];

    switch (componentId) {
      case 'menuButton':
        return shouldShow('showMenuButton') ? (
          <motion.div
            key={componentId}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={{ duration: 0.1 }}
          >
            <IconButton
              edge="start"
              color="inherit"
              onClick={() => setDrawerOpen(!drawerOpen)}
              sx={{ mr: isDIYMode ? 0 : 1 }}
            >
              <CustomIcon name="documentPanel" size={20} />
            </IconButton>
          </motion.div>
        ) : null;

      case 'chatTitle':
        return shouldShow('showChatTitle') ? (
          <Typography key={componentId} variant="h6" noWrap component="div">
            {currentTopic?.name || '对话'}
          </Typography>
        ) : null;

      case 'topicName':
        return shouldShow('showTopicName') && currentTopic ? (
          <Typography key={componentId} variant="body1" noWrap sx={{ color: 'text.secondary', ml: isDIYMode ? 0 : 1 }}>
            {currentTopic.name}
          </Typography>
        ) : null;

      case 'newTopicButton':
        return shouldShow('showNewTopicButton') ? (
          <motion.div
            key={componentId}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={{ duration: 0.1 }}
          >
            <IconButton
              color="inherit"
              onClick={handleCreateTopic}
              size="small"
              sx={{ ml: isDIYMode ? 0 : 1 }}
            >
              <Plus size={20} />
            </IconButton>
          </motion.div>
        ) : null;

      case 'clearButton':
        return shouldShow('showClearButton') && currentTopic ? (
          <motion.div
            key={componentId}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={{ duration: 0.1 }}
          >
            <IconButton
              color="inherit"
              onClick={handleClearTopic}
              size="small"
              sx={{ ml: isDIYMode ? 0 : 1 }}
            >
              <Trash2 size={20} />
            </IconButton>
          </motion.div>
        ) : null;

      case 'modelSelector':
        return shouldShow('showModelSelector') ? (
          <Box key={componentId} sx={{ display: 'flex', alignItems: 'center' }}>
            {modelSelectorStyle === 'dropdown' ? (
              <DropdownModelSelector
                selectedModel={selectedModel}
                availableModels={availableModels}
                handleModelSelect={handleModelSelect}
                displayStyle={mergedTopToolbarSettings.modelSelectorDisplayStyle || 'icon'}
              />
            ) : (
              <>
                <UnifiedModelDisplay
                  selectedModel={selectedModel}
                  onClick={handleModelMenuClick}
                  displayStyle={mergedTopToolbarSettings.modelSelectorDisplayStyle || 'icon'}
                />
                <Box sx={{ position: 'absolute', visibility: 'hidden', pointerEvents: 'none' }}>
                  <DialogModelSelector
                    selectedModel={selectedModel}
                    availableModels={availableModels}
                    handleModelSelect={handleModelSelect}
                    handleMenuClick={handleModelMenuClick}
                    handleMenuClose={handleModelMenuClose}
                    menuOpen={menuOpen}
                  />
                </Box>
              </>
            )}
          </Box>
        ) : null;

      case 'searchButton':
        return shouldShow('showSearchButton') ? (
          <motion.div
            key={componentId}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={{ duration: 0.1 }}
          >
            <IconButton
              color={showSearch ? "primary" : "inherit"}
              onClick={handleSearchClick}
              sx={{
                backgroundColor: showSearch ? 'action.selected' : 'transparent',
                '&:hover': {
                  backgroundColor: showSearch ? 'action.hover' : 'action.hover'
                }
              }}
            >
              <CustomIcon name="search" size={20} />
            </IconButton>
          </motion.div>
        ) : null;

      case 'settingsButton':
        return shouldShow('showSettingsButton') ? (
          <motion.div
            key={componentId}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={{ duration: 0.1 }}
          >
            <IconButton
              color="inherit"
              onClick={() => navigate('/settings')}
            >
              <Settings size={20} />
            </IconButton>
          </motion.div>
        ) : null;

      default:
        return null;
    }
  }, [
    mergedTopToolbarSettings,
    drawerOpen,
    currentTopic,
    selectedModel,
    availableModels,
    menuOpen,
    showSearch,
    // 稳定的函数引用
    setDrawerOpen,
    handleCreateTopic,
    handleClearTopic,
    handleModelSelect,
    handleModelMenuClick,
    handleModelMenuClose,
    navigate,
    handleSearchClick
  ]);

  // ==================== 消息处理函数 ====================
  const handleSendMessage = (content: string, images?: SiliconFlowImageFormat[], toolsEnabled?: boolean, files?: any[]) => {
    if (currentTopic) {
      handleMessageSend(content, images, toolsEnabled, files);
    } else {
      console.log('没有当前话题，无法发送消息');
    }
  };

  const handleSendMultiModelMessage = (content: string, models: any[], images?: SiliconFlowImageFormat[], toolsEnabled?: boolean, files?: any[]) => {
    if (currentTopic) {
      handleMultiModelSend?.(content, models, images, toolsEnabled, files);
    } else {
      console.log('没有当前话题，无法发送多模型消息');
    }
  };

  const handleSendImagePrompt = (prompt: string) => {
    handleMessageSend(prompt);
  };

  // ==================== 组件配置和渲染 ====================

  const commonProps: any = {
    onSendMessage: handleSendMessage,
    availableModels,
    isLoading,
    allowConsecutiveMessages: true,
    imageGenerationMode,
    videoGenerationMode,
    onSendImagePrompt: handleSendImagePrompt,
    webSearchActive,
    onStopResponse: handleStopResponseClick,
    isStreaming,
    isDebating,
    toolsEnabled,
    ...(handleMultiModelSend && handleSendMultiModelMessage && {
      onSendMultiModelMessage: handleSendMultiModelMessage
    }),
    ...(handleStartDebate && handleStopDebate && {
      onStartDebate: handleStartDebate,
      onStopDebate: handleStopDebate
    })
  };

  const inputComponent = useMemo(() => {
    if (inputLayoutStyle === 'compact') {
      return (
        <CompactChatInput
          key="compact-input"
          {...commonProps}
          onClearTopic={handleClearTopic}
          onNewTopic={handleCreateTopic}
          toggleImageGenerationMode={toggleImageGenerationMode}
          toggleWebSearch={toggleWebSearch}
          toggleToolsEnabled={toggleToolsEnabled}
        />
      );
    } else if (inputLayoutStyle === 'integrated') {
      return (
        <IntegratedChatInput
          key="integrated-input"
          {...commonProps}
          onClearTopic={handleClearTopic}
          toggleImageGenerationMode={toggleImageGenerationMode}
          toggleVideoGenerationMode={toggleVideoGenerationMode}
          toggleWebSearch={toggleWebSearch}
          onToolsEnabledChange={toggleToolsEnabled}
        />
      );
    } else {
      return <ChatInput key="default-input" {...commonProps} />;
    }
  }, [
    inputLayoutStyle,
    commonProps,
    handleClearTopic,
    handleCreateTopic,
    toggleImageGenerationMode,
    toggleWebSearch,
    toggleToolsEnabled
  ]);

  const InputContainer = (
    <motion.div
      animate={{
        left: drawerOpen && !isMobile ? 320 : 0,
        width: drawerOpen && !isMobile ? 'calc(100% - 320px)' : '100%'
      }}
      transition={{
        duration: 0.2,
        ease: [0.25, 0.46, 0.45, 0.94]
      }}
      style={{
        position: 'fixed',
        bottom: 0,
        right: 0,
        zIndex: 2,
        backgroundColor: 'transparent',
        boxShadow: 'none',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
      }}
    >
      {shouldShowToolbar && (
        <Box sx={{
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          px: 2 // 添加左右内边距
        }}>
          <ChatToolbar
            onClearTopic={handleClearTopic}
            imageGenerationMode={imageGenerationMode}
            toggleImageGenerationMode={toggleImageGenerationMode}
            videoGenerationMode={videoGenerationMode}
            toggleVideoGenerationMode={toggleVideoGenerationMode}
            webSearchActive={webSearchActive}
            toggleWebSearch={toggleWebSearch}
            toolsEnabled={toolsEnabled}
            onToolsEnabledChange={toggleToolsEnabled}
          />
        </Box>
      )}

      <Box sx={{
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        px: 2 // 添加左右内边距
      }}>
        {inputComponent}
      </Box>
    </motion.div>
  );

  // ==================== 组件渲染 ====================

  return (
    <Box
      sx={baseStyles.mainContainer}
    >
      {/* 统一的侧边栏组件 - 使用Framer Motion优化 */}
      <Sidebar
        mcpMode={mcpMode}
        toolsEnabled={toolsEnabled}
        onMCPModeChange={handleMCPModeChange}
        onToolsToggle={toggleToolsEnabled}
        {...(isMobile ? {
          mobileOpen: drawerOpen,
          onMobileToggle: () => setDrawerOpen(!drawerOpen)
        } : {
          desktopOpen: drawerOpen,
          onDesktopToggle: () => setDrawerOpen(!drawerOpen)
        })}
      />

      {/* 主内容区域 - 使用motion处理margin动画 */}
      <motion.div
        animate={{
          marginLeft: drawerOpen && !isMobile ? 320 : 0
        }}
        transition={{
          duration: 0.2,
          ease: [0.25, 0.46, 0.45, 0.94]
        }}
        style={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          overflow: 'hidden',
          backgroundColor: themeColors.background,
        }}
      >
        {/* 顶部应用栏 */}
        <AppBar
          position="static"
          elevation={0}
          className="status-bar-safe-area"
          sx={baseStyles.appBar}
        >
          <Toolbar sx={{
            position: 'relative',
            minHeight: '56px !important',
            justifyContent: mergedTopToolbarSettings.componentPositions?.length > 0 ? 'center' : 'space-between',
            userSelect: 'none', // 禁止工具栏文本选择
          }}>
            {/* 如果有DIY布局，使用绝对定位渲染组件 */}
            {mergedTopToolbarSettings.componentPositions?.length > 0 ? (
              <>
                {mergedTopToolbarSettings.componentPositions.map((position: any) => {
                  const component = renderToolbarComponent(position.id);
                  if (!component) return null;

                  return (
                    <motion.div
                      key={position.id}
                      animate={{
                        left: `${position.x}%`,
                        top: `${position.y}%`,
                      }}
                      style={{
                        position: 'absolute',
                        transform: 'translate(-50%, -50%)',
                        zIndex: 10,
                        userSelect: 'none', // 禁止DIY布局组件文本选择
                      }}
                      transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
                    >
                      {component}
                    </motion.div>
                  );
                })}
              </>
            ) : (
              /* 传统左右布局 */
              <>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, userSelect: 'none' }}>
                  {mergedTopToolbarSettings.leftComponents?.map(renderToolbarComponent).filter(Boolean)}
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, userSelect: 'none' }}>
                  {mergedTopToolbarSettings.rightComponents?.map(renderToolbarComponent).filter(Boolean)}
                </Box>
              </>
            )}
          </Toolbar>
        </AppBar>



        {/* 聊天内容区域 */}
        <Box sx={{
          display: 'flex',
          flexDirection: 'column',
          height: 'calc(100vh - 64px)',
          width: '100%',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {currentTopic ? (
            <>
              {/* 消息列表应该有固定的可滚动区域，不会被输入框覆盖 */}
              <Box sx={{
                ...baseStyles.messageContainer,
                ...backgroundStyle
              }}>
                <ErrorBoundary fallback={<Typography color="error">消息列表加载失败</Typography>}>
                  <MessageList
                    messages={currentMessages}
                    onRegenerate={handleRegenerateMessage}
                    onDelete={handleDeleteMessage}
                    onSwitchVersion={handleSwitchMessageVersion}
                    onResend={handleResendMessage}
                  />
                </ErrorBoundary>
              </Box>

              {/* 对话导航组件 */}
              <ChatNavigation containerId="messageList" />

              {/* 输入框容器，固定在底部 */}
              <ErrorBoundary fallback={<Typography color="error">输入组件加载失败</Typography>}>
                {InputContainer}
              </ErrorBoundary>
            </>
          ) : (
            <>
              <Box
                sx={{
                  ...baseStyles.messageContainer,
                  ...backgroundStyle,
                  marginBottom: '100px', // 为输入框留出足够空间
                }}
              >
                <Box sx={baseStyles.welcomeContainer}>
                  <Typography
                    variant="h6"
                    gutterBottom
                    sx={baseStyles.welcomeText}
                  >
                    对话开始了，请输入您的问题
                  </Typography>
                </Box>
              </Box>

              {/* 即使没有当前话题，也显示输入框 */}
              {InputContainer}
            </>
          )}
        </Box>
      </motion.div>


    </Box>
  );
});