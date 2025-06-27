import { useState, useRef, useEffect, useCallback, startTransition } from 'react';
import { useTheme, useMediaQuery } from '@mui/material';
import { useSelector } from 'react-redux';
import type { SiliconFlowImageFormat, ImageContent, FileContent } from '../types';
import type { RootState } from '../store';

interface UseChatInputLogicProps {
  onSendMessage: (message: string, images?: SiliconFlowImageFormat[], toolsEnabled?: boolean, files?: any[]) => void;
  onSendMultiModelMessage?: (message: string, models: any[], images?: SiliconFlowImageFormat[], toolsEnabled?: boolean, files?: any[]) => void;
  onSendImagePrompt?: (prompt: string) => void;
  isLoading?: boolean;
  allowConsecutiveMessages?: boolean;
  imageGenerationMode?: boolean;
  videoGenerationMode?: boolean;
  toolsEnabled?: boolean;
  images: ImageContent[];
  files: FileContent[];
  setImages: React.Dispatch<React.SetStateAction<ImageContent[]>>;
  setFiles: React.Dispatch<React.SetStateAction<FileContent[]>>;
  // ChatInput 特有的功能
  enableTextareaResize?: boolean;
  enableCompositionHandling?: boolean;
  enableCharacterCount?: boolean;
  availableModels?: any[];
}

export const useChatInputLogic = ({
  onSendMessage,
  onSendImagePrompt,
  isLoading = false,
  allowConsecutiveMessages = true,
  imageGenerationMode = false,
  videoGenerationMode = false,
  toolsEnabled = true,
  images,
  files,
  setImages,
  setFiles,
  enableTextareaResize = false,
  enableCompositionHandling = false,
  enableCharacterCount = false
}: UseChatInputLogicProps) => {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 获取设置中的 sendWithEnter 配置
  const sendWithEnter = useSelector((state: RootState) => state.settings.sendWithEnter);
  // 获取移动端输入法Enter键行为设置
  const mobileInputMethodEnterAsNewline = useSelector((state: RootState) => state.settings.mobileInputMethodEnterAsNewline);

  // 主题和响应式
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md'));

  // ChatInput 特有的状态
  const [textareaHeight, setTextareaHeight] = useState<number>(
    enableTextareaResize ? (isMobile ? 32 : isTablet ? 36 : 34) : 40
  );
  const [isComposing, setIsComposing] = useState(false);
  const [showCharCount, setShowCharCount] = useState(false);

  // 大文本处理性能优化状态
  const [isLargeText, setIsLargeText] = useState(false);
  const [performanceWarning, setPerformanceWarning] = useState(false);

  // 判断是否允许发送消息 - 使用useCallback优化性能
  const canSendMessage = useCallback(() => {
    const hasContent = message.trim() || images.length > 0 || files.length > 0;
    return hasContent && (allowConsecutiveMessages || !isLoading);
  }, [message, images.length, files.length, allowConsecutiveMessages, isLoading]);

  // 防抖定时器引用
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 优化的文本区域高度自适应（ChatInput 特有）- 添加防抖机制
  const adjustTextareaHeight = useCallback((textarea: HTMLTextAreaElement) => {
    if (!enableTextareaResize) return;

    // 清除之前的防抖定时器
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // 使用防抖机制，避免频繁计算
    debounceTimerRef.current = setTimeout(() => {
      // 重置高度以获取正确的scrollHeight
      textarea.style.height = 'auto';

      // 计算新高度
      const newHeight = Math.max(
        isMobile ? 32 : isTablet ? 36 : 34, // 最小高度
        Math.min(textarea.scrollHeight, 120) // 最大高度120px
      );

      setTextareaHeight(newHeight);
      textarea.style.height = `${newHeight}px`;
    }, 16); // 16ms防抖，约60fps
  }, [enableTextareaResize, isMobile, isTablet]);

  // 处理消息发送 - 使用useCallback优化性能
  const handleSubmit = useCallback(async () => {
    if ((!message.trim() && images.length === 0 && files.length === 0) ||
        (isLoading && !allowConsecutiveMessages)) {
      return;
    }

    let processedMessage = message.trim();

    // 如果是图像生成模式，则调用生成图像的回调
    if (imageGenerationMode && onSendImagePrompt) {
      onSendImagePrompt(processedMessage);
      setMessage('');

      // 重置输入框高度到默认值（ChatInput 特有）
      if (enableTextareaResize) {
        const defaultHeight = isMobile ? 24 : 28;
        setTextareaHeight(defaultHeight);
        if (textareaRef.current) {
          textareaRef.current.style.height = `${defaultHeight}px`;
        }
      }
      return;
    }

    // 如果是视频生成模式，也使用图像生成回调（因为视频生成也是特殊模式）
    if (videoGenerationMode && onSendImagePrompt) {
      onSendImagePrompt(processedMessage);
      setMessage('');

      // 重置输入框高度到默认值（ChatInput 特有）
      if (enableTextareaResize) {
        const defaultHeight = isMobile ? 24 : 28;
        setTextareaHeight(defaultHeight);
        if (textareaRef.current) {
          textareaRef.current.style.height = `${defaultHeight}px`;
        }
      }
      return;
    }

    // 注意：不在这里搜索知识库！
    // 的逻辑是：用户消息先发送，然后在AI处理前搜索知识库
    // 知识库搜索应该在消息处理阶段进行，而不是在发送阶段

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
              const { dexieStorage } = await import('../services/storage/DexieStorageService');
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

    // 调用父组件的回调
    onSendMessage(processedMessage, formattedImages.length > 0 ? formattedImages : undefined, toolsEnabled, nonImageFiles);

    // 批量重置状态 - 使用startTransition优化非紧急更新
    startTransition(() => {
      setMessage('');
      setImages([]);
      setFiles([]);

      // 重置大文本相关状态
      setIsLargeText(false);
      setPerformanceWarning(false);
      setShowCharCount(false);
    });

    // 重置输入框高度到默认值（ChatInput 特有）- 保持同步以避免视觉跳跃
    if (enableTextareaResize) {
      const defaultHeight = isMobile ? 24 : 28;
      setTextareaHeight(defaultHeight);
      if (textareaRef.current) {
        textareaRef.current.style.height = `${defaultHeight}px`;
      }
    }
  }, [
    message, images, files, isLoading, allowConsecutiveMessages,
    imageGenerationMode, videoGenerationMode, onSendImagePrompt,
    enableTextareaResize, isMobile, onSendMessage, toolsEnabled,
    setMessage, setImages, setFiles, setTextareaHeight
  ]);

  // 处理键盘事件 - 使用useCallback优化性能
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // 处理快捷键（ChatInput 特有）
    if (enableCompositionHandling && (e.ctrlKey || e.metaKey)) {
      switch (e.key) {
        case 'a':
        case 'z':
        case 'y':
          // 浏览器默认行为，不需要阻止
          break;
      }
    }

    // Enter键发送消息 - 检查设置中的 sendWithEnter 配置
    if (e.key === 'Enter' && !e.shiftKey && (!enableCompositionHandling || !isComposing)) {
      // 移动端输入法Enter键行为控制
      if (isMobile && mobileInputMethodEnterAsNewline) {
        // 移动端开启换行模式时，Enter键不发送消息，允许换行
        // 不阻止默认行为，让Enter键正常换行
        return;
      }

      if (sendWithEnter) {
        // 启用Enter发送时，Enter键发送消息
        e.preventDefault();
        handleSubmit();
      }
      // 如果禁用Enter发送，则不阻止默认行为，允许换行
    }
  }, [enableCompositionHandling, isComposing, handleSubmit, sendWithEnter, isMobile, mobileInputMethodEnterAsNewline]);

  // 输入法组合开始（ChatInput 特有）- 使用useCallback优化性能
  const handleCompositionStart = useCallback(() => {
    if (enableCompositionHandling) {
      setIsComposing(true);
    }
  }, [enableCompositionHandling]);

  // 输入法组合结束（ChatInput 特有）- 使用useCallback优化性能
  const handleCompositionEnd = useCallback((e: React.CompositionEvent<HTMLTextAreaElement>) => {
    if (enableCompositionHandling) {
      setIsComposing(false);
      // 组合结束后重新调整高度
      adjustTextareaHeight(e.target as HTMLTextAreaElement);
    }
  }, [enableCompositionHandling, adjustTextareaHeight]);

  // 处理输入变化 - 使用useCallback和startTransition优化性能
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const textLength = newValue.length;

    // 紧急更新：立即更新消息内容，保证输入响应性
    setMessage(newValue);

    // 大文本处理性能优化
    startTransition(() => {
      // 检测大文本（超过5000字符）
      const isLarge = textLength > 5000;
      setIsLargeText(isLarge);

      // 性能警告（超过10000字符）
      const shouldWarn = textLength > 10000;
      setPerformanceWarning(shouldWarn);

      // 字符计数显示控制（ChatInput 特有）
      if (enableCharacterCount) {
        setShowCharCount(textLength > 500);
      }
    });

    // 高度调整：对于大文本使用防抖，小文本立即调整
    if (enableTextareaResize) {
      if (textLength > 5000) {
        // 大文本使用现有的防抖机制
        adjustTextareaHeight(e.target);
      } else {
        // 小文本立即调整，提供更好的响应性
        adjustTextareaHeight(e.target);
      }
    }
  }, [enableCharacterCount, enableTextareaResize, adjustTextareaHeight]);

  // 监听消息变化以检测字符数（ChatInput 特有）- 使用startTransition优化
  useEffect(() => {
    if (enableCharacterCount && message.length <= 500) {
      startTransition(() => {
        setShowCharCount(false);
      });
    }
  }, [message, enableCharacterCount]);

  // 清理防抖定时器
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    message,
    setMessage,
    textareaRef,
    canSendMessage,
    handleSubmit,
    handleKeyDown,
    handleChange,
    // ChatInput 特有的返回值
    textareaHeight,
    isComposing,
    showCharCount,
    adjustTextareaHeight,
    handleCompositionStart,
    handleCompositionEnd,
    // 性能优化相关
    isLargeText,
    performanceWarning,
    // 主题相关
    isDarkMode,
    isMobile,
    isTablet
  };
};
