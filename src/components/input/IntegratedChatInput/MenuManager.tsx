import React, { useState, useCallback, useRef } from 'react';
import MultiModelSelector from '../MultiModelSelector';
import UploadMenu from '../UploadMenu';
import ToolsMenu from '../ToolsMenu';
import AIDebateButton from '../../AIDebateButton';
import QuickPhraseButton from '../../QuickPhraseButton';
import type { DebateConfig } from '../../../shared/services/AIDebateService';
import type { SiliconFlowImageFormat, ImageContent, FileContent } from '../../../shared/types';

interface MenuManagerProps {
  // 基础状态
  message: string;
  isStreaming: boolean;
  isDebating: boolean;
  canSendMessage: () => boolean;
  
  // 模式状态
  imageGenerationMode: boolean;
  videoGenerationMode: boolean;
  webSearchActive: boolean;
  toolsEnabled: boolean;
  
  // 模型相关
  availableModels: any[];
  onSendMultiModelMessage?: (message: string, models: any[], images?: SiliconFlowImageFormat[], toolsEnabled?: boolean, files?: any[]) => void;
  
  // 文件上传相关
  handleImageUploadLocal: (source?: 'camera' | 'photos') => Promise<void>;
  handleFileUploadLocal: () => Promise<void>;
  
  // AI辩论相关
  onStartDebate?: (question: string, config: DebateConfig) => void;
  onStopDebate?: () => void;
  
  // 快捷短语相关
  handleInsertPhrase: (content: string) => void;
  currentAssistant: any;
  
  // 工具栏相关
  onClearTopic?: () => void;
  toggleImageGenerationMode?: () => void;
  toggleVideoGenerationMode?: () => void;
  toggleWebSearch?: () => void;
  onToolsEnabledChange?: (enabled: boolean) => void;
  
  // 显示设置
  showAIDebateButton: boolean;
  showQuickPhraseButton: boolean;
  
  // 多模型发送处理
  processImages: () => Promise<SiliconFlowImageFormat[]>;
  files: FileContent[];
  setImages: (images: ImageContent[]) => void;
  setFiles: (files: FileContent[]) => void;
  setUploadingMedia: (uploading: boolean) => void;
  setMessage: (message: string) => void;
}

const useMenuManager = ({
  message,
  isStreaming,
  isDebating,
  canSendMessage,
  imageGenerationMode,
  videoGenerationMode,
  webSearchActive,
  toolsEnabled,
  availableModels,
  onSendMultiModelMessage,
  handleImageUploadLocal,
  handleFileUploadLocal,
  onStartDebate,
  onStopDebate,
  handleInsertPhrase,
  currentAssistant,
  onClearTopic,
  toggleImageGenerationMode,
  toggleVideoGenerationMode,
  toggleWebSearch,
  onToolsEnabledChange,
  showAIDebateButton,
  showQuickPhraseButton,
  processImages,
  files,
  setImages,
  setFiles,
  setUploadingMedia,
  setMessage
}: MenuManagerProps) => {
  // 菜单状态管理
  const [uploadMenuAnchorEl, setUploadMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [multiModelSelectorOpen, setMultiModelSelectorOpen] = useState(false);
  const [toolsMenuOpen, setToolsMenuOpen] = useState(false);
  const [toolsMenuAnchorEl, setToolsMenuAnchorEl] = useState<null | HTMLElement>(null);

  // 组件引用
  const aiDebateButtonRef = useRef<any>(null);
  const quickPhraseButtonRef = useRef<any>(null);

  // 上传菜单处理函数
  const handleOpenUploadMenu = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    setUploadMenuAnchorEl(event.currentTarget);
  }, []);

  const handleCloseUploadMenu = useCallback(() => {
    setUploadMenuAnchorEl(null);
  }, []);

  // 工具菜单处理函数
  const handleOpenToolsMenu = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    setToolsMenuAnchorEl(event.currentTarget);
    setToolsMenuOpen(true);
  }, []);

  const handleCloseToolsMenu = useCallback(() => {
    setToolsMenuAnchorEl(null);
    setToolsMenuOpen(false);
  }, []);

  // 处理多模型发送
  const handleMultiModelSend = useCallback(async (selectedModels: any[]) => {
    if (!message.trim() && files.length === 0) {
      console.log('没有内容可发送');
      return;
    }

    if (!selectedModels || selectedModels.length === 0) {
      console.log('没有选择模型');
      return;
    }

    let processedMessage = message.trim();
    const formattedImages = await processImages();
    const nonImageFiles = files.filter((f: FileContent) => !f.mimeType.startsWith('image/'));

    console.log('发送多模型消息:', {
      message: processedMessage,
      models: selectedModels.map(m => `${m.provider || m.providerType}:${m.id}`),
      images: formattedImages.length,
      files: files.length,
      toolsEnabled: toolsEnabled
    });

    if (onSendMultiModelMessage) {
      onSendMultiModelMessage(
        processedMessage,
        selectedModels,
        formattedImages.length > 0 ? formattedImages : undefined,
        toolsEnabled,
        nonImageFiles
      );
    }

    // 重置状态
    setMessage('');
    setImages([]);
    setFiles([]);
    setUploadingMedia(false);
    setMultiModelSelectorOpen(false);
  }, [message, files, processImages, toolsEnabled, onSendMultiModelMessage, setMessage, setImages, setFiles, setUploadingMedia]);

  // 处理AI辩论按钮点击
  const handleAIDebateClick = useCallback(() => {
    if (isDebating) {
      onStopDebate?.();
    } else {
      if (aiDebateButtonRef.current) {
        const buttonElement = aiDebateButtonRef.current.querySelector('button');
        if (buttonElement) {
          buttonElement.click();
        }
      }
    }
  }, [isDebating, onStopDebate]);

  // 处理快捷短语按钮点击
  const handleQuickPhraseClick = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    if (quickPhraseButtonRef.current) {
      const clickedButton = event.currentTarget;
      const rect = clickedButton.getBoundingClientRect();

      const hiddenButtonContainer = quickPhraseButtonRef.current;
      hiddenButtonContainer.style.position = 'fixed';
      hiddenButtonContainer.style.left = `${rect.left}px`;
      hiddenButtonContainer.style.top = `${rect.top}px`;
      hiddenButtonContainer.style.zIndex = '-1';
      hiddenButtonContainer.style.opacity = '0';
      hiddenButtonContainer.style.pointerEvents = 'none';

      const buttonElement = hiddenButtonContainer.querySelector('button');
      if (buttonElement) {
        buttonElement.click();
      }
    }
  }, []);

  // UploadMenu需要的快捷短语处理函数
  const handleQuickPhraseClickForUploadMenu = useCallback(() => {
    if (quickPhraseButtonRef.current) {
      const hiddenButtonContainer = quickPhraseButtonRef.current;
      hiddenButtonContainer.style.position = 'fixed';
      hiddenButtonContainer.style.left = '50%';
      hiddenButtonContainer.style.top = '50%';
      hiddenButtonContainer.style.transform = 'translate(-50%, -50%)';
      hiddenButtonContainer.style.zIndex = '-1';
      hiddenButtonContainer.style.opacity = '0';
      hiddenButtonContainer.style.pointerEvents = 'none';

      const buttonElement = hiddenButtonContainer.querySelector('button');
      if (buttonElement) {
        buttonElement.click();
      }
    }
  }, []);

  // 渲染所有菜单
  const renderMenus = useCallback(() => {
    return (
      <>
        {/* 上传选择菜单 */}
        <UploadMenu
          anchorEl={uploadMenuAnchorEl}
          open={Boolean(uploadMenuAnchorEl)}
          onClose={handleCloseUploadMenu}
          onImageUpload={handleImageUploadLocal}
          onFileUpload={handleFileUploadLocal}
          onMultiModelSend={() => setMultiModelSelectorOpen(true)}
          showMultiModel={!!(onSendMultiModelMessage && availableModels.length > 1 && !isStreaming && canSendMessage())}
          onAIDebate={handleAIDebateClick}
          showAIDebate={showAIDebateButton}
          isDebating={isDebating}
          onQuickPhrase={handleQuickPhraseClickForUploadMenu}
          showQuickPhrase={showQuickPhraseButton}
        />

        {/* 多模型选择器 */}
        <MultiModelSelector
          open={multiModelSelectorOpen}
          onClose={() => setMultiModelSelectorOpen(false)}
          availableModels={availableModels}
          onConfirm={handleMultiModelSend}
          maxSelection={5}
        />

        {/* 工具菜单 */}
        <ToolsMenu
          anchorEl={toolsMenuAnchorEl}
          open={toolsMenuOpen}
          onClose={handleCloseToolsMenu}
          onClearTopic={onClearTopic}
          imageGenerationMode={imageGenerationMode}
          toggleImageGenerationMode={toggleImageGenerationMode}
          videoGenerationMode={videoGenerationMode}
          toggleVideoGenerationMode={toggleVideoGenerationMode}
          webSearchActive={webSearchActive}
          toggleWebSearch={toggleWebSearch}
          toolsEnabled={toolsEnabled}
          onToolsEnabledChange={onToolsEnabledChange}
        />

        {/* 隐藏的AI辩论按钮 */}
        <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }} ref={aiDebateButtonRef}>
          <AIDebateButton
            onStartDebate={onStartDebate}
            onStopDebate={onStopDebate}
            isDebating={isDebating}
            disabled={false}
            question={message}
          />
        </div>

        {/* 快捷短语按钮 */}
        <div
          ref={quickPhraseButtonRef}
          style={{
            position: 'fixed',
            left: '-9999px',
            top: '-9999px',
            zIndex: -1,
            opacity: 0,
            pointerEvents: 'none'
          }}
        >
          <QuickPhraseButton
            onInsertPhrase={handleInsertPhrase}
            assistant={currentAssistant}
            disabled={false}
            size="medium"
          />
        </div>
      </>
    );
  }, [
    uploadMenuAnchorEl, handleCloseUploadMenu, handleImageUploadLocal, handleFileUploadLocal,
    onSendMultiModelMessage, availableModels, isStreaming, canSendMessage, handleAIDebateClick,
    showAIDebateButton, isDebating, handleQuickPhraseClickForUploadMenu, showQuickPhraseButton,
    multiModelSelectorOpen, handleMultiModelSend, toolsMenuAnchorEl, toolsMenuOpen,
    handleCloseToolsMenu, onClearTopic, imageGenerationMode, toggleImageGenerationMode,
    videoGenerationMode, toggleVideoGenerationMode, webSearchActive, toggleWebSearch,
    toolsEnabled, onToolsEnabledChange, onStartDebate, onStopDebate, message,
    handleInsertPhrase, currentAssistant
  ]);

  return {
    // 状态
    uploadMenuAnchorEl,
    multiModelSelectorOpen,
    toolsMenuOpen,
    toolsMenuAnchorEl,
    
    // 处理函数
    handleOpenUploadMenu,
    handleCloseUploadMenu,
    handleOpenToolsMenu,
    handleCloseToolsMenu,
    handleMultiModelSend,
    handleAIDebateClick,
    handleQuickPhraseClick,
    handleQuickPhraseClickForUploadMenu,
    setMultiModelSelectorOpen,
    
    // 渲染函数
    renderMenus
  };
};

export default useMenuManager;
