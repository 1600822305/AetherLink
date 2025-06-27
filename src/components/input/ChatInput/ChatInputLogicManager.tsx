import { useState, useEffect, useCallback, useRef } from 'react';
import { useChatInputLogic } from '../../../shared/hooks/useChatInputLogic';
import { dexieStorage } from '../../../shared/services/storage/DexieStorageService';
import { toastManager } from '../../EnhancedToast';
import type { ImageContent, SiliconFlowImageFormat, FileContent } from '../../../shared/types';
import type { FileUploadManagerRef } from './FileUploadManager';

interface ChatInputLogicManagerProps {
  // 基础回调
  onSendMessage: (message: string, images?: SiliconFlowImageFormat[], toolsEnabled?: boolean, files?: any[]) => void;
  onSendMultiModelMessage?: (message: string, models: any[], images?: SiliconFlowImageFormat[], toolsEnabled?: boolean, files?: any[]) => void;
  onSendImagePrompt?: (prompt: string) => void;
  
  // 状态
  isLoading?: boolean;
  allowConsecutiveMessages?: boolean;
  imageGenerationMode?: boolean;
  videoGenerationMode?: boolean;
  toolsEnabled?: boolean;
  availableModels?: any[];
  
  // 文件和图片状态
  images: ImageContent[];
  files: FileContent[];
  setImages: (images: ImageContent[]) => void;
  setFiles: (files: FileContent[]) => void;
  
  // Toast消息管理
  setToastMessages: (messages: any[]) => void;
  
  // FileUploadManager 引用
  fileUploadManagerRef: React.RefObject<FileUploadManagerRef>;
}

const useChatInputLogicManager = ({
  onSendMessage,
  onSendMultiModelMessage,
  onSendImagePrompt,
  isLoading,
  allowConsecutiveMessages,
  imageGenerationMode,
  videoGenerationMode,
  toolsEnabled,
  availableModels,
  images,
  files,
  setImages,
  setFiles,
  setToastMessages,
  fileUploadManagerRef
}: ChatInputLogicManagerProps) => {
  // iOS设备检测状态
  const [isIOS, setIsIOS] = useState(false);

  // 聊天输入逻辑 - 启用 IntegratedChatInput 特有功能
  const {
    message,
    setMessage,
    textareaRef,
    canSendMessage,
    handleSubmit,
    handleKeyDown,
    handleChange,
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
    enableTextareaResize: false,
    enableCompositionHandling: true,
    enableCharacterCount: false,
    availableModels
  });

  // Toast消息订阅
  useEffect(() => {
    const unsubscribe = toastManager.subscribe(setToastMessages);
    return unsubscribe;
  }, [setToastMessages]);

  // 检测iOS设备
  useEffect(() => {
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                       (navigator.userAgent.includes('Mac') && 'ontouchend' in document);
    setIsIOS(isIOSDevice);
  }, []);

  // 图片处理公共函数
  const processImages = useCallback(async () => {
    const allImages = [
      ...images,
      ...files.filter(f => f.mimeType.startsWith('image/')).map(file => ({
        base64Data: file.base64Data,
        url: file.url || '',
        width: file.width,
        height: file.height
      } as ImageContent))
    ];

    const formattedImages: SiliconFlowImageFormat[] = await Promise.all(
      allImages.map(async (img) => {
        let imageUrl = img.base64Data || img.url;

        if (img.url && img.url.match(/\[图片:([a-zA-Z0-9_-]+)\]/)) {
          const refMatch = img.url.match(/\[图片:([a-zA-Z0-9_-]+)\]/);
          if (refMatch && refMatch[1]) {
            try {
              const imageId = refMatch[1];
              const blob = await dexieStorage.getImageBlob(imageId);
              if (blob) {
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

    return formattedImages;
  }, [images, files]);

  // 文件上传处理函数 - 通过 ref 调用 FileUploadManager 的方法
  const handleImageUploadLocal = useCallback(async (source: 'camera' | 'photos' = 'photos') => {
    if (fileUploadManagerRef.current) {
      await fileUploadManagerRef.current.handleImageUpload(source);
    }
  }, [fileUploadManagerRef]);

  const handleFileUploadLocal = useCallback(async () => {
    if (fileUploadManagerRef.current) {
      await fileUploadManagerRef.current.handleFileUpload();
    }
  }, [fileUploadManagerRef]);

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
  }, [message, setMessage, textareaRef]);

  return {
    // 基础输入逻辑
    message,
    setMessage,
    textareaRef,
    canSendMessage,
    handleSubmit,
    handleKeyDown,
    handleChange,
    handleCompositionStart,
    handleCompositionEnd,
    isMobile,
    isTablet,
    
    // 设备检测
    isIOS,
    
    // 图片处理
    processImages,
    
    // 文件上传处理
    handleImageUploadLocal,
    handleFileUploadLocal,
    
    // 快捷短语处理
    handleInsertPhrase
  };
};

export default useChatInputLogicManager;
