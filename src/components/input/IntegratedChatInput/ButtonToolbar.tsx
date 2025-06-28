import React, { useState, useCallback } from 'react';
import { IconButton, Tooltip, CircularProgress, Badge } from '@mui/material';
import { Send, Plus, Square, Trash2, Camera, Video, BookOpen, Wrench, Image, FileText, ArrowLeftRight, AlertTriangle } from 'lucide-react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../../shared/store';
import { CustomIcon } from '../../icons';
import type { ImageContent, FileContent } from '../../../shared/types';

interface ButtonToolbarProps {
  // 基础状态
  isLoading: boolean;
  allowConsecutiveMessages: boolean;
  isStreaming: boolean;
  uploadingMedia: boolean;
  
  // 模式状态
  imageGenerationMode: boolean;
  videoGenerationMode: boolean;
  webSearchActive: boolean;
  toolsEnabled: boolean;
  
  // 文件状态
  images: ImageContent[];
  files: FileContent[];
  
  // 事件处理
  handleSubmit: () => void;
  onStopResponse?: () => void;
  handleImageUploadLocal: (source?: 'camera' | 'photos') => Promise<void>;
  handleFileUploadLocal: () => Promise<void>;
  onClearTopic?: () => void;
  onToolsEnabledChange?: (enabled: boolean) => void;
  handleQuickWebSearchToggle?: () => void;
  
  // 菜单管理器方法
  menuManager: {
    handleOpenToolsMenu: (event: React.MouseEvent<HTMLButtonElement>) => void;
    handleOpenUploadMenu: (event: React.MouseEvent<HTMLButtonElement>) => void;
    handleAIDebateClick: () => void;
    handleQuickPhraseClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
    setMultiModelSelectorOpen: (open: boolean) => void;
  };
  
  // 语音管理器方法
  voiceInputManager: {
    getVoiceButtonConfig: () => any;
  };
  
  // 发送消息检查
  canSendMessage: () => boolean;
  
  // 样式相关
  isDarkMode: boolean;
  iconColor: string;
  disabledColor: string;
  showLoadingIndicator: boolean;
  
  // 辩论状态
  isDebating: boolean;
}

const useButtonToolbar = ({
  isLoading,
  allowConsecutiveMessages,
  isStreaming,
  uploadingMedia,
  imageGenerationMode,
  videoGenerationMode,
  webSearchActive,
  toolsEnabled,
  images,
  files,
  handleSubmit,
  onStopResponse,
  handleImageUploadLocal,
  handleFileUploadLocal,
  onClearTopic,
  onToolsEnabledChange,
  handleQuickWebSearchToggle,
  menuManager,
  voiceInputManager,
  canSendMessage,
  isDarkMode,
  iconColor,
  disabledColor,
  showLoadingIndicator,
  isDebating
}: ButtonToolbarProps) => {
  // 清空内容二次确认状态
  const [clearConfirmMode, setClearConfirmMode] = useState(false);

  // 获取左右布局配置
  const leftButtons = useSelector((state: RootState) =>
    (state.settings as any).integratedInputLeftButtons || ['tools', 'clear', 'search']
  );
  const rightButtons = useSelector((state: RootState) =>
    (state.settings as any).integratedInputRightButtons || ['voice', 'send']
  );

  // 处理清空主题
  const handleClearTopic = useCallback(() => {
    if (!clearConfirmMode) {
      setClearConfirmMode(true);
      setTimeout(() => setClearConfirmMode(false), 3000);
    } else {
      onClearTopic?.();
      setClearConfirmMode(false);
    }
  }, [clearConfirmMode, onClearTopic]);

  // 处理知识库按钮点击
  const handleKnowledgeClick = useCallback(() => {
    console.log('知识库功能待实现');
  }, []);

  // 自定义按钮配置映射
  const buttonConfigs = {
    tools: {
      id: 'tools',
      icon: <CustomIcon name="settingsPanel" size={20} />,
      tooltip: '扩展',
      onClick: menuManager.handleOpenToolsMenu,
      color: iconColor,
      disabled: false,
      isActive: false
    },
    'mcp-tools': {
      id: 'mcp-tools',
      icon: <Wrench size={20} />,
      tooltip: toolsEnabled ? '禁用MCP工具' : '启用MCP工具',
      onClick: () => onToolsEnabledChange?.(!toolsEnabled),
      color: toolsEnabled ? '#4CAF50' : iconColor,
      disabled: false,
      isActive: toolsEnabled
    },
    clear: {
      id: 'clear',
      icon: clearConfirmMode ? <AlertTriangle size={20} /> : <Trash2 size={20} />,
      tooltip: clearConfirmMode ? '确认清空' : '清空内容',
      onClick: handleClearTopic,
      color: clearConfirmMode ? '#f44336' : iconColor,
      disabled: false,
      isActive: clearConfirmMode
    },
    image: {
      id: 'image',
      icon: <Image size={20} />,
      tooltip: imageGenerationMode ? '退出图像生成模式' : '图像生成',
      onClick: () => console.log('图像生成功能'),
      color: imageGenerationMode ? '#9C27B0' : iconColor,
      disabled: false,
      isActive: imageGenerationMode
    },
    video: {
      id: 'video',
      icon: <Video size={20} />,
      tooltip: videoGenerationMode ? '退出视频生成模式' : '视频生成',
      onClick: () => console.log('视频生成功能'),
      color: videoGenerationMode ? '#FF5722' : iconColor,
      disabled: false,
      isActive: videoGenerationMode
    },
    knowledge: {
      id: 'knowledge',
      icon: <BookOpen size={20} />,
      tooltip: '知识库',
      onClick: handleKnowledgeClick,
      color: iconColor,
      disabled: false,
      isActive: false
    },
    search: {
      id: 'search',
      icon: <CustomIcon name="search" size={20} />,
      tooltip: webSearchActive ? '退出网络搜索模式' : '网络搜索',
      onClick: handleQuickWebSearchToggle || (() => console.log('网络搜索功能')),
      color: webSearchActive ? '#3b82f6' : iconColor,
      disabled: false,
      isActive: webSearchActive
    },
    upload: {
      id: 'upload',
      icon: uploadingMedia ? <CircularProgress size={20} /> : (
        <Badge badgeContent={images.length + files.length} color="primary" max={9} invisible={images.length + files.length === 0}>
          <Plus size={20} />
        </Badge>
      ),
      tooltip: '添加内容',
      onClick: menuManager.handleOpenUploadMenu,
      color: uploadingMedia ? disabledColor : iconColor,
      disabled: uploadingMedia || (isLoading && !allowConsecutiveMessages),
      isActive: false
    },
    camera: {
      id: 'camera',
      icon: <Camera size={20} />,
      tooltip: '拍摄照片',
      onClick: () => handleImageUploadLocal('camera'),
      color: '#9C27B0',
      disabled: uploadingMedia || (isLoading && !allowConsecutiveMessages),
      isActive: false
    },
    'photo-select': {
      id: 'photo-select',
      icon: <Image size={20} />,
      tooltip: '选择图片',
      onClick: () => handleImageUploadLocal('photos'),
      color: '#1976D2',
      disabled: uploadingMedia || (isLoading && !allowConsecutiveMessages),
      isActive: false
    },
    'file-upload': {
      id: 'file-upload',
      icon: <FileText size={20} />,
      tooltip: '上传文件',
      onClick: handleFileUploadLocal,
      color: '#4CAF50',
      disabled: uploadingMedia || (isLoading && !allowConsecutiveMessages),
      isActive: false
    },
    'ai-debate': {
      id: 'ai-debate',
      icon: <CustomIcon name="aiDebate" size={20} color={isDebating ? '#f44336' : iconColor} />,
      tooltip: isDebating ? '停止AI辩论' : '开始AI辩论',
      onClick: menuManager.handleAIDebateClick,
      color: isDebating ? '#f44336' : iconColor,
      disabled: false,
      isActive: isDebating
    },
    'quick-phrase': {
      id: 'quick-phrase',
      icon: <CustomIcon name="quickPhrase" size={20} color={iconColor} />,
      tooltip: '快捷短语',
      onClick: menuManager.handleQuickPhraseClick,
      color: iconColor,
      disabled: false,
      isActive: false
    },
    'multi-model': {
      id: 'multi-model',
      icon: <ArrowLeftRight size={20} />,
      tooltip: '多模型发送',
      onClick: () => menuManager.setMultiModelSelectorOpen(true),
      color: iconColor,
      disabled: false,
      isActive: false
    },
    send: {
      id: 'send',
      icon: isStreaming ? <Square size={18} /> : showLoadingIndicator ? <CircularProgress size={20} color="inherit" /> : imageGenerationMode ? <Image size={18} /> : <Send size={18} />,
      tooltip: isStreaming ? '停止生成' : imageGenerationMode ? '生成图像' : '发送消息',
      onClick: isStreaming && onStopResponse ? onStopResponse : handleSubmit,
      color: isStreaming ? '#ff4d4f' : !canSendMessage() || (isLoading && !allowConsecutiveMessages) ? disabledColor : imageGenerationMode ? '#9C27B0' : isDarkMode ? '#4CAF50' : '#09bb07',
      disabled: !isStreaming && (!canSendMessage() || (isLoading && !allowConsecutiveMessages)),
      isActive: false
    },
    voice: voiceInputManager.getVoiceButtonConfig()
  };

  // 渲染按钮工具栏
  const renderButtonToolbar = useCallback(() => {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: '0px',
        minHeight: '36px',
        height: '36px',
        flex: '0 0 auto'
      }}>
        {/* 左侧：自定义按钮 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}>
          {leftButtons.map((buttonId: string) => {
            const config = buttonConfigs[buttonId as keyof typeof buttonConfigs];
            if (!config) return null;

            return (
              <Tooltip key={buttonId} title={config.tooltip}>
                <span>
                  <IconButton
                    size="medium"
                    onClick={config.onClick}
                    disabled={config.disabled || (isLoading && !allowConsecutiveMessages)}
                    style={{
                      color: config.color,
                      padding: '6px',
                      backgroundColor: config.isActive ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                      transition: 'all 0.2s ease-in-out'
                    }}
                  >
                    {config.icon}
                  </IconButton>
                </span>
              </Tooltip>
            );
          })}
        </div>

        {/* 右侧：自定义按钮 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}>
          {rightButtons.map((buttonId: string) => {
            const config = buttonConfigs[buttonId as keyof typeof buttonConfigs];
            if (!config) return null;

            return (
              <Tooltip key={buttonId} title={config.tooltip}>
                <span>
                  <IconButton
                    size="medium"
                    onClick={config.onClick}
                    disabled={config.disabled || (isLoading && !allowConsecutiveMessages)}
                    style={{
                      color: config.color,
                      padding: '6px',
                      backgroundColor: config.isActive ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                      transition: 'all 0.2s ease-in-out'
                    }}
                  >
                    {config.icon}
                  </IconButton>
                </span>
              </Tooltip>
            );
          })}
        </div>
      </div>
    );
  }, [leftButtons, rightButtons, buttonConfigs, isLoading, allowConsecutiveMessages]);

  return {
    renderButtonToolbar
  };
};

export default useButtonToolbar;
