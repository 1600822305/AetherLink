import React, { useState, useEffect, useCallback, useRef } from 'react';
import { IconButton, Tooltip } from '@mui/material';
import { Keyboard, Mic, ChevronDown, ChevronUp } from 'lucide-react';

import { useChatInputLogic } from '../../shared/hooks/useChatInputLogic';


import { useInputStyles } from '../../shared/hooks/useInputStyles';
import MultiModelSelector from './MultiModelSelector';
import type { ImageContent, SiliconFlowImageFormat, FileContent } from '../../shared/types';

import type { FileStatus } from '../FilePreview';
import UploadMenu from './UploadMenu';
import FileUploadManager, { type FileUploadManagerRef } from './ChatInput/FileUploadManager';
import InputTextArea from './ChatInput/InputTextArea';
import ChatInputButtons from './ChatInput/ChatInputButtons';
import EnhancedToast, { toastManager } from '../EnhancedToast';
import { dexieStorage } from '../../shared/services/storage/DexieStorageService';
import { useSelector } from 'react-redux';
import type { RootState } from '../../shared/store';
import AIDebateButton from '../AIDebateButton';
import type { DebateConfig } from '../../shared/services/AIDebateService';
import QuickPhraseButton from '../QuickPhraseButton';
import { useVoiceRecognition } from '../../shared/hooks/useVoiceRecognition';
import { useKeyboardManager } from '../../shared/hooks/useKeyboardManager';
import { EnhancedVoiceInput } from '../VoiceRecognition';
import { getThemeColors } from '../../shared/utils/themeUtils';
import { useTheme } from '@mui/material/styles';

interface ChatInputProps {
  onSendMessage: (message: string, images?: SiliconFlowImageFormat[], toolsEnabled?: boolean, files?: any[]) => void;
  onSendMultiModelMessage?: (message: string, models: any[], images?: SiliconFlowImageFormat[], toolsEnabled?: boolean, files?: any[]) => void; // 多模型发送回调
  onStartDebate?: (question: string, config: DebateConfig) => void; // 开始AI辩论回调
  onStopDebate?: () => void; // 停止AI辩论回调
  isLoading?: boolean;
  allowConsecutiveMessages?: boolean; // 允许连续发送消息，即使AI尚未回复
  imageGenerationMode?: boolean; // 是否处于图像生成模式
  videoGenerationMode?: boolean; // 是否处于视频生成模式
  onSendImagePrompt?: (prompt: string) => void; // 发送图像生成提示词的回调
  webSearchActive?: boolean; // 是否处于网络搜索模式
  onStopResponse?: () => void; // 停止AI回复的回调
  isStreaming?: boolean; // 是否正在流式响应中
  isDebating?: boolean; // 是否正在AI辩论中
  toolsEnabled?: boolean; // 工具开关状态
  availableModels?: any[]; // 可用模型列表
}

const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  onSendMultiModelMessage,
  onStartDebate,
  onStopDebate,
  isLoading = false,
  allowConsecutiveMessages = true, // 默认允许连续发送
  imageGenerationMode = false, // 默认不是图像生成模式
  videoGenerationMode = false, // 默认不是视频生成模式
  onSendImagePrompt,
  webSearchActive = false, // 默认不是网络搜索模式
  onStopResponse,
  isStreaming = false,
  isDebating = false, // 默认不在辩论中
  toolsEnabled = true, // 默认启用工具
  availableModels = [] // 默认空数组
}) => {
  // 基础状态 - 内存泄漏防护：避免存储DOM引用
  const [uploadMenuAnchorEl, setUploadMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [multiModelSelectorOpen, setMultiModelSelectorOpen] = useState(false);

  // 内存泄漏防护：组件卸载时清理DOM引用
  useEffect(() => {
    return () => {
      setUploadMenuAnchorEl(null);
    };
  }, []);
  const [isIOS, setIsIOS] = useState(false); // 新增: 是否是iOS设备
  // 语音识别三状态管理
  const [voiceState, setVoiceState] = useState<'normal' | 'voice-mode' | 'recording'>('normal');
  const [shouldHideVoiceButton, setShouldHideVoiceButton] = useState(false); // 是否隐藏语音按钮
  const [expanded, setExpanded] = useState(false); // 展开状态
  const [expandedHeight, setExpandedHeight] = useState(Math.floor(window.innerHeight * 0.7)); // 展开时的高度
  const [showExpandButton, setShowExpandButton] = useState(false); // 是否显示展开按钮

  // 文件和图片状态
  const [images, setImages] = useState<ImageContent[]>([]);
  const [files, setFiles] = useState<FileContent[]>([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  // 文件状态管理
  const [fileStatuses, setFileStatuses] = useState<Record<string, { status: FileStatus; progress?: number; error?: string }>>({});

  // Toast消息管理
  const [toastMessages, setToastMessages] = useState<any[]>([]);

  // FileUploadManager 引用
  const fileUploadManagerRef = useRef<FileUploadManagerRef>(null);



  // 获取当前助手状态
  const currentAssistant = useSelector((state: RootState) => state.assistants.currentAssistant);

  // 使用共享的 hooks
  const { styles, isDarkMode, inputBoxStyle } = useInputStyles();

  // 获取主题和主题工具
  const theme = useTheme();
  const themeStyle = useSelector((state: RootState) => state.settings.themeStyle);
  const themeColors = getThemeColors(theme, themeStyle);

  // 获取AI辩论按钮显示设置
  const showAIDebateButton = useSelector((state: RootState) => state.settings.showAIDebateButton ?? true);

  // 获取快捷短语按钮显示设置
  const showQuickPhraseButton = useSelector((state: RootState) => state.settings.showQuickPhraseButton ?? true);

  // 聊天输入逻辑 - 启用 ChatInput 特有功能
  const {
    message,
    setMessage,
    textareaRef,
    canSendMessage,
    handleSubmit,
    handleKeyDown,
    handleChange,
    textareaHeight,
    showCharCount,
    handleCompositionStart,
    handleCompositionEnd,
    isMobile,
    isTablet
  } = useChatInputLogic({
    onSendMessage,
    onSendMultiModelMessage,
    onSendImagePrompt,
    isLoading,
    allowConsecutiveMessages,
    imageGenerationMode,
    videoGenerationMode,
    toolsEnabled,
    images,
    files,
    setImages,
    setFiles,
    enableTextareaResize: true,
    enableCompositionHandling: true,
    enableCharacterCount: true,
    availableModels
  });

  // 语音识别功能
  const {
    isListening,
    startRecognition,
    stopRecognition,
  } = useVoiceRecognition();

  // 键盘管理功能
  const {
    isKeyboardVisible,
    isPageTransitioning,
    shouldHandleFocus
  } = useKeyboardManager();



  // Toast消息订阅
  useEffect(() => {
    const unsubscribe = toastManager.subscribe(setToastMessages);
    return unsubscribe;
  }, []);

  // 从 useInputStyles hook 获取样式
  const { border, borderRadius, boxShadow } = styles;
  const iconColor = themeColors.iconColor;
  const disabledColor = themeColors.isDark ? '#555' : '#ccc';

  // 检测iOS设备
  useEffect(() => {
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                       (navigator.userAgent.includes('Mac') && 'ontouchend' in document);
    setIsIOS(isIOSDevice);
  }, []);





  // handleSubmit 现在由 useChatInputLogic hook 提供

  // 处理多模型发送
  const handleMultiModelSend = async (selectedModels: any[]) => {
    if (!message.trim() && images.length === 0 && files.length === 0) return;
    if (!onSendMultiModelMessage) return;

    let processedMessage = message.trim();

    // 合并images数组和files中的图片文件
    const allImages = [
      ...images,
      ...files.filter(f => f.mimeType.startsWith('image/')).map(file => ({
        base64Data: file.base64Data,
        url: file.url || '',
        width: file.width,
        height: file.height
      } as ImageContent))
    ];

    // 创建正确的图片格式，避免重复处理
    const formattedImages: SiliconFlowImageFormat[] = await Promise.all(
      allImages.map(async (img) => {
        let imageUrl = img.base64Data || img.url;

        // 如果是图片引用格式，需要从数据库加载实际图片
        if (img.url && img.url.match(/\[图片:([a-zA-Z0-9_-]+)\]/)) {
          const refMatch = img.url.match(/\[图片:([a-zA-Z0-9_-]+)\]/);
          if (refMatch && refMatch[1]) {
            try {
              const imageId = refMatch[1];
              const blob = await dexieStorage.getImageBlob(imageId);
              if (blob) {
                // 将Blob转换为base64
                const base64 = await new Promise<string>((resolve) => {
                  const reader = new FileReader();
                  reader.onload = () => resolve(reader.result as string);
                  reader.readAsDataURL(blob);
                });
                imageUrl = base64;
              }
            } catch (error) {
              console.error('加载图片引用失败:', error);
            }
          }
        }

        return {
          type: 'image_url',
          image_url: {
            url: imageUrl
          }
        } as SiliconFlowImageFormat;
      })
    );

    // 过滤掉图片文件，避免重复发送
    const nonImageFiles = files.filter(f => !f.mimeType.startsWith('image/'));

    console.log('发送多模型消息:', {
      message: processedMessage,
      models: selectedModels.map(m => `${m.provider || m.providerType}:${m.id}`),
      images: formattedImages.length,
      files: files.length,
      toolsEnabled: toolsEnabled
    });

    onSendMultiModelMessage(
      processedMessage,
      selectedModels,
      formattedImages.length > 0 ? formattedImages : undefined,
      toolsEnabled,
      nonImageFiles
    );

    // 重置状态 - 使用 hook 提供的函数
    setMessage('');
    setImages([]);
    setFiles([]);
    setUploadingMedia(false);
  };

  // 输入处理逻辑现在由 useChatInputLogic 和 useUrlScraper hooks 提供

  // 监听窗口大小变化，更新展开高度
  useEffect(() => {
    const updateExpandedHeight = () => {
      setExpandedHeight(Math.floor(window.innerHeight * 0.7));
    };

    window.addEventListener('resize', updateExpandedHeight);
    return () => window.removeEventListener('resize', updateExpandedHeight);
  }, []);

  // 检测是否需要显示展开按钮和隐藏语音按钮 - 改为基于字数判断
  const checkButtonVisibility = useCallback(() => {
    // 计算文本行数：根据字符数估算行数
    const textLength = message.length;
    const containerWidth = isMobile ? 280 : isTablet ? 400 : 500; // 估算容器宽度
    const charsPerLine = Math.floor(containerWidth / (isTablet ? 17 : 16)); // 根据字体大小估算每行字符数

    // 计算换行符数量
    const newlineCount = (message.match(/\n/g) || []).length;

    // 估算总行数：字符行数 + 换行符行数
    const estimatedLines = Math.ceil(textLength / charsPerLine) + newlineCount;

    // 当文本超过3行时隐藏语音按钮，为输入区域让出空间
    setShouldHideVoiceButton(estimatedLines > 3);

    if (!expanded) {
      // 当文本超过4行时显示展开按钮
      setShowExpandButton(estimatedLines > 4);
    } else {
      // 展开状态下始终显示展开按钮（用于收起）
      setShowExpandButton(true);
    }
  }, [message, isMobile, isTablet, expanded]);

  // 监听消息内容变化，检测按钮显示状态
  useEffect(() => {
    checkButtonVisibility();
  }, [message, checkButtonVisibility]);

  // 监听展开状态变化
  useEffect(() => {
    // 延迟检测，确保DOM更新完成
    setTimeout(checkButtonVisibility, 100);
  }, [expanded, checkButtonVisibility]);

  // 优化的 handleChange - 移除URL检测，添加防抖机制
  const enhancedHandleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    // 调用 hook 提供的 handleChange
    handleChange(e);
    // 使用防抖延迟检测按钮显示状态，避免频繁计算
    setTimeout(checkButtonVisibility, 100);
  }, [handleChange, checkButtonVisibility]);

  // 展开切换函数
  const handleExpandToggle = useCallback(() => {
    setExpanded(!expanded);
  }, [expanded]);





  // 处理上传菜单
  const handleOpenUploadMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
    setUploadMenuAnchorEl(event.currentTarget);
  };

  const handleCloseUploadMenu = () => {
    setUploadMenuAnchorEl(null);
  };

  // 文件上传处理函数 - 通过 ref 调用 FileUploadManager 的方法
  const handleImageUploadLocal = async (source: 'camera' | 'photos' = 'photos') => {
    if (fileUploadManagerRef.current) {
      await fileUploadManagerRef.current.handleImageUpload(source);
    }
  };

  const handleFileUploadLocal = async () => {
    if (fileUploadManagerRef.current) {
      await fileUploadManagerRef.current.handleFileUpload();
    }
  };

  // 快捷短语插入处理函数
  const handleInsertPhrase = useCallback((content: string) => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentValue = message;

    // 在光标位置插入内容
    const newValue = currentValue.slice(0, start) + content + currentValue.slice(end);
    setMessage(newValue);

    // 设置新的光标位置（在插入内容的末尾）
    setTimeout(() => {
      if (textarea) {
        const newCursorPosition = start + content.length;
        textarea.focus();
        textarea.setSelectionRange(newCursorPosition, newCursorPosition);
      }
    }, 10);
  }, [message, setMessage]); // eslint-disable-line react-hooks/exhaustive-deps



  // 组件引用
  const aiDebateButtonRef = useRef<any>(null);
  const quickPhraseButtonRef = useRef<any>(null);

  // 处理AI辩论按钮点击 - 模拟点击按钮
  const handleAIDebateClick = useCallback(() => {
    if (isDebating) {
      onStopDebate?.();
    } else {
      // 模拟点击AI辩论按钮来打开弹窗
      if (aiDebateButtonRef.current) {
        const buttonElement = aiDebateButtonRef.current.querySelector('button');
        if (buttonElement) {
          buttonElement.click();
        }
      }
    }
  }, [isDebating, onStopDebate]);

  // 处理快捷短语按钮点击 - 模拟点击按钮
  const handleQuickPhraseClick = useCallback(() => {
    // 模拟点击快捷短语按钮来打开菜单
    if (quickPhraseButtonRef.current) {
      const buttonElement = quickPhraseButtonRef.current.querySelector('button');
      if (buttonElement) {
        buttonElement.click();
      }
    }
  }, []);

  // 语音识别处理函数
  const handleToggleVoiceMode = () => {
    if (voiceState === 'normal') {
      // 直接进入录音模式
      setVoiceState('recording');
    } else if (voiceState === 'recording') {
      // 停止录音并退出
      if (isListening) {
        stopRecognition().catch(err => console.error('停止语音识别出错:', err));
      }
      setVoiceState('normal');
    }
  };





  const handleVoiceSendMessage = async (voiceMessage: string) => {
    // 确保有内容才发送
    if (voiceMessage && voiceMessage.trim()) {
      // 合并images数组和files中的图片文件
      const allImages = [
        ...images,
        ...files.filter(f => f.mimeType.startsWith('image/')).map(file => ({
          base64Data: file.base64Data,
          url: file.url || '',
          width: file.width,
          height: file.height
        } as ImageContent))
      ];

      // 创建正确的图片格式，避免重复处理
      const formattedImages: SiliconFlowImageFormat[] = await Promise.all(
        allImages.map(async (img) => {
          let imageUrl = img.base64Data || img.url;

          // 如果是图片引用格式，需要从数据库加载实际图片
          if (img.url && img.url.match(/\[图片:([a-zA-Z0-9_-]+)\]/)) {
            const refMatch = img.url.match(/\[图片:([a-zA-Z0-9_-]+)\]/);
            if (refMatch && refMatch[1]) {
              try {
                const imageId = refMatch[1];
                const blob = await dexieStorage.getImageBlob(imageId);
                if (blob) {
                  // 将Blob转换为base64
                  const base64 = await new Promise<string>((resolve) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result as string);
                    reader.readAsDataURL(blob);
                  });
                  imageUrl = base64;
                }
              } catch (error) {
                console.error('加载图片引用失败:', error);
              }
            }
          }

          return {
            type: 'image_url',
            image_url: {
              url: imageUrl
            }
          } as SiliconFlowImageFormat;
        })
      );

      // 过滤掉图片文件，避免重复发送
      const nonImageFiles = files.filter(f => !f.mimeType.startsWith('image/'));

      onSendMessage(
        voiceMessage.trim(),
        formattedImages.length > 0 ? formattedImages : undefined,
        toolsEnabled,
        nonImageFiles
      );

      // 重置状态
      setImages([]);
      setFiles([]);
      setUploadingMedia(false);
      setVoiceState('normal'); // 发送后退出语音模式

      // 添加触觉反馈 (如果支持)
      if ('navigator' in window && 'vibrate' in navigator) {
        try {
          navigator.vibrate(50); // 短振动反馈
        } catch (e) {
          // 忽略振动API错误
        }
      }
    }
  };




  // 根据屏幕尺寸调整样式
  const getResponsiveStyles = () => {
    if (isMobile) {
      return {
        paddingTop: '0px',
        paddingBottom: isIOS ? '34px' : '4px', // 为iOS设备增加底部padding
        maxWidth: '100%', // 移动端占满屏幕宽度
        marginTop: '0',
        marginLeft: '0', // 移动端不需要居中边距
        marginRight: '0', // 移动端不需要居中边距
        paddingLeft: '8px', // 使用padding代替margin
        paddingRight: '8px' // 使用padding代替margin
      };
    } else if (isTablet) {
      return {
        paddingTop: '0px',
        paddingBottom: isIOS ? '34px' : '4px', // 为iOS设备增加底部padding
        maxWidth: 'calc(100% - 40px)', // 确保有足够的左右边距
        marginTop: '0',
        marginLeft: 'auto', // 水平居中
        marginRight: 'auto' // 水平居中
      };
    } else {
      return {
        paddingTop: '0px',
        paddingBottom: isIOS ? '34px' : '6px', // 为iOS设备增加底部padding
        maxWidth: 'calc(100% - 32px)', // 确保有足够的左右边距
        marginTop: '0',
        marginLeft: 'auto', // 水平居中
        marginRight: 'auto' // 水平居中
      };
    }
  };

  const responsiveStyles = getResponsiveStyles();

  return (
    <div
      style={{
        backgroundColor: 'transparent',
        ...responsiveStyles,
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        boxShadow: 'none',
        transition: 'all 0.3s ease',
        marginBottom: isKeyboardVisible ? '0' : (isMobile ? '0' : isTablet ? '0' : '0'),
        paddingBottom: isKeyboardVisible && isMobile ? 'env(safe-area-inset-bottom)' : (isIOS ? '34px' : '0'), // 为iOS设备增加底部安全区域
        // 确保没有任何背景色或边框
        border: 'none',
        position: 'relative'
      }}
    >
      {/* 移除URL解析状态显示以提升性能 */}

      {/* 文件上传管理器 - 包含文件预览、拖拽上传、粘贴处理等功能 */}
      <FileUploadManager
        ref={fileUploadManagerRef}
        images={images}
        files={files}
        setImages={setImages}
        setFiles={setFiles}
        setUploadingMedia={setUploadingMedia}
        fileStatuses={fileStatuses}
        setFileStatuses={setFileStatuses}
        isDarkMode={isDarkMode}
        isMobile={isMobile}
        borderRadius={borderRadius}
      />

      <div style={{
          display: 'flex',
          alignItems: 'center',
        padding: isTablet ? '6px 12px' : isMobile ? '5px 8px' : '5px 8px',
        borderRadius: borderRadius,
        /* 使用主题颜色作为背景，防止输入框与底部消息重叠或产生视觉干扰 */
        background: themeColors.paper,
        border: border,
        minHeight: isTablet ? '56px' : isMobile ? '48px' : '50px', // 增加容器最小高度以适应新的textarea高度
        boxShadow: boxShadow,
        width: '100%',
        maxWidth: '100%', // 使用100%宽度，与外部容器一致
        backdropFilter: inputBoxStyle === 'modern' ? 'blur(10px)' : 'none',
        WebkitBackdropFilter: inputBoxStyle === 'modern' ? 'blur(10px)' : 'none',
        transition: 'all 0.3s ease',
        position: 'relative', // 添加相对定位，用于放置展开按钮
        // 防止文本选择
        userSelect: 'none',
        WebkitUserSelect: 'none',
        MozUserSelect: 'none',
        msUserSelect: 'none',
        WebkitTouchCallout: 'none',
        WebkitTapHighlightColor: 'transparent'
      }}>
        {/* 展开/收起按钮 - 显示在输入框容器右上角 */}
        {showExpandButton && (
          <div style={{
            position: 'absolute',
            top: '4px',
            right: '4px',
            zIndex: 10
          }}>
            <Tooltip title={expanded ? "收起输入框" : "展开输入框"}>
              <IconButton
                onClick={handleExpandToggle}
                size="small"
                style={{
                  color: expanded ? '#2196F3' : iconColor,
                  padding: '2px',
                  width: '20px',
                  height: '20px',
                  minWidth: '20px',
                  backgroundColor: isDarkMode
                    ? 'rgba(42, 42, 42, 0.9)'
                    : 'rgba(255, 255, 255, 0.9)',
                  backdropFilter: 'blur(4px)',
                  borderRadius: '6px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  transition: 'all 0.2s ease'
                }}
              >
                {expanded ? (
                  <ChevronDown size={14} />
                ) : (
                  <ChevronUp size={14} />
                )}
              </IconButton>
            </Tooltip>
          </div>
        )}

        {/* 语音识别按钮 - 根据状态显示不同图标，当文本超过3行时隐藏 */}
        {!shouldHideVoiceButton && (
          <Tooltip title={voiceState === 'normal' ? "切换到语音输入模式" : "退出语音输入模式"}>
            <span>
              <IconButton
                onClick={handleToggleVoiceMode}
                disabled={uploadingMedia || (isLoading && !allowConsecutiveMessages)}
                size={isTablet ? "large" : "medium"}
                style={{
                  color: voiceState !== 'normal' ? '#f44336' : (isDarkMode ? '#ffffff' : '#000000'),
                  padding: isTablet ? '10px' : '8px',
                  backgroundColor: voiceState !== 'normal' ? 'rgba(211, 47, 47, 0.15)' : 'transparent',
                  transition: 'all 0.25s ease-in-out'
                }}
              >
                {voiceState === 'normal' ? (
                  <Mic size={isTablet ? 28 : 24} />
                ) : (
                  <Keyboard size={isTablet ? 28 : 24} />
                )}
              </IconButton>
            </span>
          </Tooltip>
        )}

        {/* 输入区域 - 根据三状态显示不同的输入方式 */}
        {voiceState === 'recording' ? (
          /* 录音状态 - 显示增强语音输入组件 */
          <div style={{
            flexGrow: 1,
            margin: isTablet ? '0 12px' : '0 8px',
            position: 'relative'
          }}>
            <EnhancedVoiceInput
              isDarkMode={isDarkMode}
              onClose={() => setVoiceState('normal')}
              onSendMessage={handleVoiceSendMessage}
              onInsertText={(text: string) => {
                // 替换整个消息内容，不是追加
                // 界面状态的切换由录音结束时的逻辑处理
                setMessage(text);
              }}
              startRecognition={startRecognition}
              currentMessage={message}
            />
          </div>
        ) : (
          /* 正常输入框 - 使用 InputTextArea 组件 */
          <InputTextArea
            message={message}
            textareaRef={textareaRef}
            textareaHeight={textareaHeight}
            showCharCount={showCharCount}
            handleChange={enhancedHandleChange}
            handleKeyDown={handleKeyDown}
            handleCompositionStart={handleCompositionStart}
            handleCompositionEnd={handleCompositionEnd}
            onPaste={(e) => {
              // 将粘贴事件转发给 FileUploadManager
              if (fileUploadManagerRef.current) {
                fileUploadManagerRef.current.handlePaste(e);
              }
            }}
            isLoading={isLoading}
            allowConsecutiveMessages={allowConsecutiveMessages}
            imageGenerationMode={imageGenerationMode}
            videoGenerationMode={videoGenerationMode}
            webSearchActive={webSearchActive}
            isMobile={isMobile}
            isTablet={isTablet}
            isDarkMode={isDarkMode}
            shouldHideVoiceButton={shouldHideVoiceButton}
            expanded={expanded}
            expandedHeight={expandedHeight}
            onExpandToggle={handleExpandToggle}
            isPageTransitioning={isPageTransitioning}
            shouldHandleFocus={shouldHandleFocus}
          />
        )}

        {/* 在非录音状态下显示右侧按钮 */}
        {voiceState !== 'recording' && (
          <ChatInputButtons
            uploadingMedia={uploadingMedia}
            isLoading={isLoading}
            allowConsecutiveMessages={allowConsecutiveMessages}
            isStreaming={isStreaming}
            imageGenerationMode={imageGenerationMode}
            webSearchActive={webSearchActive}
            images={images}
            files={files}
            isDarkMode={isDarkMode}
            isTablet={isTablet}
            disabledColor={disabledColor}
            handleOpenUploadMenu={handleOpenUploadMenu}
            handleSubmit={handleSubmit}
            onStopResponse={onStopResponse}
            canSendMessage={canSendMessage}
          />
        )}

      </div>

      {/* 上传选择菜单 */}
      <UploadMenu
        anchorEl={uploadMenuAnchorEl}
        open={Boolean(uploadMenuAnchorEl)}
        onClose={handleCloseUploadMenu}
        onImageUpload={handleImageUploadLocal}
        onFileUpload={handleFileUploadLocal}
        onMultiModelSend={() => setMultiModelSelectorOpen(true)}
        showMultiModel={!!(onSendMultiModelMessage && availableModels.length > 1 && !isStreaming && canSendMessage())}
        // AI辩论相关
        onAIDebate={handleAIDebateClick}
        showAIDebate={showAIDebateButton}
        isDebating={isDebating}
        // 快捷短语相关
        onQuickPhrase={handleQuickPhraseClick}
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

      {/* Toast通知 */}
      <EnhancedToast
        messages={toastMessages}
        onClose={(id) => toastManager.remove(id)}
        maxVisible={3}
      />

      {/* 隐藏的AI辩论按钮 - 用于触发弹窗 */}
      <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }} ref={aiDebateButtonRef}>
        <AIDebateButton
          onStartDebate={onStartDebate}
          onStopDebate={onStopDebate}
          isDebating={isDebating}
          disabled={false}
          question={message}
        />
      </div>

      {/* 快捷短语按钮 - 放在屏幕中央但透明，这样菜单会在正确位置显示 */}
      <div
        ref={quickPhraseButtonRef}
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
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

    </div>
  );
};

export default ChatInput;
