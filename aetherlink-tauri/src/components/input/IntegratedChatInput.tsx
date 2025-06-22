import React, { useState, useEffect, useCallback, useRef } from 'react';
import { IconButton, CircularProgress, Badge, Tooltip } from '@mui/material';
import { Send, Plus, Square, Keyboard, Mic, ChevronDown, ChevronUp, Trash2, Camera, Video, BookOpen, Wrench, Image, FileText, ArrowLeftRight, AlertTriangle } from 'lucide-react';

import { useChatInputLogic } from '../../shared/hooks/useChatInputLogic';


import { useInputStyles } from '../../shared/hooks/useInputStyles';
import MultiModelSelector from './MultiModelSelector';
import type { ImageContent, SiliconFlowImageFormat, FileContent } from '../../shared/types';
import { CustomIcon } from '../icons';

import type { FileStatus } from '../FilePreview';
import UploadMenu from './UploadMenu';
import ToolsMenu from './ToolsMenu';
import FileUploadManager, { type FileUploadManagerRef } from './ChatInput/FileUploadManager';
import InputTextArea from './ChatInput/InputTextArea';
import EnhancedToast, { toastManager } from '../EnhancedToast';
import { dexieStorage } from '../../shared/services/storage/DexieStorageService';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../../shared/store';
import { toggleWebSearchEnabled, setWebSearchProvider } from '../../shared/store/slices/webSearchSlice';
import AIDebateButton from '../AIDebateButton';
import type { DebateConfig } from '../../shared/services/AIDebateService';
import QuickPhraseButton from '../QuickPhraseButton';
import { useVoiceRecognition } from '../../shared/hooks/useVoiceRecognition';
import { useKeyboardManager } from '../../shared/hooks/useKeyboardManager';
import { EnhancedVoiceInput } from '../VoiceRecognition';
import { getThemeColors } from '../../shared/utils/themeUtils';
import { useTheme } from '@mui/material/styles';

interface IntegratedChatInputProps {
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
  // 工具栏相关props
  onClearTopic?: () => void;
  toggleImageGenerationMode?: () => void;
  toggleVideoGenerationMode?: () => void;
  toggleWebSearch?: () => void;
  onToolsEnabledChange?: (enabled: boolean) => void;
}

const IntegratedChatInput: React.FC<IntegratedChatInputProps> = ({
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
  availableModels = [], // 默认空数组
  // 工具栏相关props
  onClearTopic,
  toggleImageGenerationMode,
  toggleVideoGenerationMode,
  toggleWebSearch,
  onToolsEnabledChange
}) => {
  // 基础状态
  const [uploadMenuAnchorEl, setUploadMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [multiModelSelectorOpen, setMultiModelSelectorOpen] = useState(false);
  const [toolsMenuOpen, setToolsMenuOpen] = useState(false); // 工具菜单状态
  const [toolsMenuAnchorEl, setToolsMenuAnchorEl] = useState<null | HTMLElement>(null); // 工具菜单锚点
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

  // 用于标记是否需要触发Web搜索的状态
  const [pendingWebSearchToggle, setPendingWebSearchToggle] = useState(false);

  // 获取当前助手状态
  const currentAssistant = useSelector((state: RootState) => state.assistants.currentAssistant);
  
  // Redux dispatch
  const dispatch = useDispatch();

  // 获取网络搜索设置
  const webSearchSettings = useSelector((state: RootState) => state.webSearch);

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

  // 清空内容二次确认状态
  const [clearConfirmMode, setClearConfirmMode] = useState(false);

  // 获取左右布局配置
  const leftButtons = useSelector((state: RootState) =>
    (state.settings as any).integratedInputLeftButtons || ['tools', 'clear', 'search']
  );
  const rightButtons = useSelector((state: RootState) =>
    (state.settings as any).integratedInputRightButtons || ['voice', 'send']
  );

  // 监听Web搜索设置变化，当设置完成后触发搜索
  useEffect(() => {
    if (pendingWebSearchToggle && webSearchSettings?.enabled && webSearchSettings?.provider && webSearchSettings.provider !== 'custom') {
      toggleWebSearch?.();
      setPendingWebSearchToggle(false);
    }
  }, [webSearchSettings?.enabled, webSearchSettings?.provider, pendingWebSearchToggle, toggleWebSearch]);

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
  const iconColor = themeColors.isDark ? '#ffffff' : '#000000'; // 深色主题用白色，浅色主题用黑色
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
    if (!message.trim() && images.length === 0 && files.length === 0) {
      console.log('没有内容可发送');
      return;
    }

    if (!selectedModels || selectedModels.length === 0) {
      console.log('没有选择模型');
      return;
    }

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

    // 如果有多模型发送回调，使用它；否则逐个发送到每个模型
    if (onSendMultiModelMessage) {
      onSendMultiModelMessage(
        processedMessage,
        selectedModels,
        formattedImages.length > 0 ? formattedImages : undefined,
        toolsEnabled,
        nonImageFiles
      );
    } else {
      // 备用方案：逐个发送到每个选中的模型
      console.log('使用备用方案：逐个发送到选中的模型');
      for (const model of selectedModels) {
        console.log(`发送到模型: ${model.name || model.id}`);
        onSendMessage(
          processedMessage,
          formattedImages.length > 0 ? formattedImages : undefined,
          toolsEnabled,
          nonImageFiles
        );
      }
    }

    // 重置状态 - 使用 hook 提供的函数
    setMessage('');
    setImages([]);
    setFiles([]);
    setUploadingMedia(false);
    setMultiModelSelectorOpen(false); // 关闭选择器
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

  // 工具菜单处理函数
  const handleOpenToolsMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
    setToolsMenuAnchorEl(event.currentTarget);
    setToolsMenuOpen(true);
  };

  const handleCloseToolsMenu = () => {
    setToolsMenuAnchorEl(null);
    setToolsMenuOpen(false);
  };

  // 处理快速网络搜索切换
  const handleQuickWebSearchToggle = () => {
    if (webSearchActive) {
      // 如果当前网络搜索处于激活状态，则关闭它
      toggleWebSearch?.();
    } else {
      // 如果当前网络搜索未激活，检查是否有可用的搜索提供商
      const enabled = webSearchSettings?.enabled || false;
      const currentProvider = webSearchSettings?.provider;
      
      if (enabled && currentProvider && currentProvider !== 'custom') {
        // 如果网络搜索已启用且有有效的提供商，直接激活
        toggleWebSearch?.();
      } else {
        // 如果没有配置或未启用，需要先启用网络搜索和设置默认提供商
        const actions: any[] = [];
        if (!enabled) {
          actions.push(toggleWebSearchEnabled());
        }
        if (!currentProvider || currentProvider === 'custom') {
          actions.push(setWebSearchProvider('bing-free'));
        }
        
        // 批量dispatch并设置等待标记
        actions.forEach(action => dispatch(action));
        setPendingWebSearchToggle(true);
      }
    }
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

  // 处理快捷短语按钮点击 - 动态定位并触发菜单
  const handleQuickPhraseClick = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    if (quickPhraseButtonRef.current) {
      const clickedButton = event.currentTarget;
      const rect = clickedButton.getBoundingClientRect();

      // 动态移动隐藏按钮到点击位置
      const hiddenButtonContainer = quickPhraseButtonRef.current;
      hiddenButtonContainer.style.position = 'fixed';
      hiddenButtonContainer.style.left = `${rect.left}px`;
      hiddenButtonContainer.style.top = `${rect.top}px`;
      hiddenButtonContainer.style.zIndex = '-1';
      hiddenButtonContainer.style.opacity = '0';
      hiddenButtonContainer.style.pointerEvents = 'none';

      // 触发隐藏按钮的点击
      const buttonElement = hiddenButtonContainer.querySelector('button');
      if (buttonElement) {
        buttonElement.click();
      }
    }
  }, []);

  // UploadMenu需要的快捷短语处理函数（无参数版本）
  const handleQuickPhraseClickForUploadMenu = useCallback(() => {
    // 对于UploadMenu，我们使用屏幕中央作为默认位置
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

  // 处理知识库按钮点击
  const handleKnowledgeClick = useCallback(() => {
    // TODO: 实现知识库功能
    console.log('知识库功能待实现');
  }, []);

  // 处理清空内容的二次确认
  const handleClearTopic = useCallback(() => {
    if (clearConfirmMode) {
      // 第二次点击，执行清空
      onClearTopic?.();
      setClearConfirmMode(false);
    } else {
      // 第一次点击，进入确认模式
      setClearConfirmMode(true);
    }
  }, [clearConfirmMode, onClearTopic]);

  // 自动重置确认模式（3秒后）
  useEffect(() => {
    if (clearConfirmMode) {
      const timer = setTimeout(() => {
        setClearConfirmMode(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [clearConfirmMode]);



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



  // 显示正在加载的指示器，但不禁用输入框
  const showLoadingIndicator = isLoading && !allowConsecutiveMessages;

  // 自定义按钮配置映射
  const buttonConfigs = {
    tools: {
      id: 'tools',
      icon: <CustomIcon name="settingsPanel" size={20} />,
      tooltip: '扩展',
      onClick: handleOpenToolsMenu,
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
      icon: <Camera size={20} />,
      tooltip: imageGenerationMode ? '取消生成图片' : '生成图片',
      onClick: () => toggleImageGenerationMode?.(),
      color: imageGenerationMode ? '#9C27B0' : iconColor,
      disabled: false,
      isActive: imageGenerationMode
    },
    video: {
      id: 'video',
      icon: <Video size={20} />,
      tooltip: videoGenerationMode ? '取消生成视频' : '生成视频',
      onClick: () => toggleVideoGenerationMode?.(),
      color: videoGenerationMode ? '#E91E63' : iconColor,
      disabled: false,
      isActive: videoGenerationMode
    },
    knowledge: {
      id: 'knowledge',
      icon: <BookOpen size={20} />,
      tooltip: '知识库',
      onClick: handleKnowledgeClick,
      color: '#059669',
      disabled: false,
      isActive: false
    },
    search: {
      id: 'search',
      icon: <CustomIcon name="search" size={20} />,
      tooltip: webSearchActive ? '关闭网络搜索' : '开启网络搜索',
      onClick: handleQuickWebSearchToggle,
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
      onClick: handleOpenUploadMenu,
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
      onClick: handleAIDebateClick,
      color: isDebating ? '#f44336' : iconColor,
      disabled: false,
      isActive: isDebating
    },
    'quick-phrase': {
      id: 'quick-phrase',
      icon: <CustomIcon name="quickPhrase" size={20} color={iconColor} />,
      tooltip: '快捷短语',
      onClick: handleQuickPhraseClick,
      color: iconColor,
      disabled: false,
      isActive: false
    },
    'multi-model': {
      id: 'multi-model',
      icon: <ArrowLeftRight size={20} />,
      tooltip: '多模型发送',
      onClick: () => setMultiModelSelectorOpen(true),
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
    voice: {
      id: 'voice',
      icon: voiceState !== 'normal' ? <Keyboard size={20} /> : <Mic size={20} />,
      tooltip: voiceState !== 'normal' ? '退出语音输入模式' : '切换到语音输入模式',
      onClick: handleToggleVoiceMode,
      color: voiceState !== 'normal' ? '#f44336' : iconColor,
      disabled: uploadingMedia || (isLoading && !allowConsecutiveMessages),
      isActive: voiceState !== 'normal'
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
          flexDirection: 'column', // 改为垂直布局
          padding: isTablet ? '8px 12px' : isMobile ? '6px 8px' : '7px 10px', // 减少内边距
          borderRadius: '20px', // 增加圆角半径
          /* 使用主题颜色作为背景，防止输入框与底部消息重叠或产生视觉干扰 */
          background: themeColors.paper,
          border: border,
          minHeight: isTablet ? '72px' : isMobile ? '64px' : '68px', // 调整容器最小高度
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

        {/* 上层：文本输入区域 */}
        <div style={{
          display: 'flex',
          alignItems: 'center', // 改为center，让内容垂直居中
          marginBottom: '0px', // 移除间距，让两层紧密相连
          minHeight: '36px', // 设置固定高度
          height: '36px', // 确保高度一致
          flex: '1' // 让上层占据可用空间
        }}>
          {/* 输入区域 - 根据三状态显示不同的输入方式 */}
          {voiceState === 'recording' ? (
            /* 录音状态 - 显示增强语音输入组件 */
            <div style={{
              flexGrow: 1,
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
        </div>

        {/* 下层：功能按钮区域 */}
        {voiceState !== 'recording' && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: '0px', // 移除上边距
            minHeight: '36px', // 与上层相同的固定高度
            height: '36px', // 确保高度一致
            flex: '0 0 auto' // 不允许伸缩，固定高度
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
        onQuickPhrase={handleQuickPhraseClickForUploadMenu}
        showQuickPhrase={showQuickPhraseButton}
      />

      {/* 多模型选择器 */}
      <MultiModelSelector
        open={multiModelSelectorOpen}
        onClose={() => setMultiModelSelectorOpen(false)}
        availableModels={availableModels.length > 0 ? availableModels : [
          // 如果没有传入模型，使用默认的测试模型
          { id: 'gpt-4', name: 'GPT-4', provider: 'OpenAI', enabled: true },
          { id: 'claude-3', name: 'Claude 3', provider: 'Anthropic', enabled: true },
          { id: 'deepseek', name: 'DeepSeek', provider: 'DeepSeek', enabled: true }
        ]}
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

      {/* 快捷短语按钮 - 隐藏按钮，位置会动态调整 */}
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

    </div>
  );
};

export default IntegratedChatInput;
