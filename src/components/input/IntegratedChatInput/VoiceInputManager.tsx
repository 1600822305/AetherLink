import React, { useState, useCallback } from 'react';
import { Keyboard, Mic } from 'lucide-react';
import { useVoiceRecognition } from '../../../shared/hooks/useVoiceRecognition';
import { EnhancedVoiceInput } from '../../VoiceRecognition';
import type { SiliconFlowImageFormat, ImageContent, FileContent } from '../../../shared/types';

interface VoiceInputManagerProps {
  // 基础props
  message: string;
  setMessage: (message: string) => void;
  isDarkMode: boolean;
  isLoading: boolean;
  allowConsecutiveMessages: boolean;
  uploadingMedia: boolean;

  // 文件和图片相关
  files: FileContent[];
  setImages: (images: ImageContent[]) => void;
  setFiles: (files: FileContent[]) => void;
  setUploadingMedia: (uploading: boolean) => void;
  processImages: () => Promise<SiliconFlowImageFormat[]>;

  // 发送消息相关
  onSendMessage: (message: string, images?: SiliconFlowImageFormat[], toolsEnabled?: boolean, files?: any[]) => void;
  toolsEnabled: boolean;

  // 按钮配置相关
  iconColor: string;
}

export interface VoiceButtonConfig {
  id: string;
  icon: React.ReactNode;
  tooltip: string;
  onClick: () => void;
  color: string;
  disabled: boolean;
  isActive: boolean;
}

const useVoiceInputManager = ({
  message,
  setMessage,
  isDarkMode,
  isLoading,
  allowConsecutiveMessages,
  uploadingMedia,
  files,
  setImages,
  setFiles,
  setUploadingMedia,
  processImages,
  onSendMessage,
  toolsEnabled,
  iconColor
}: VoiceInputManagerProps) => {
  // 语音识别三状态管理
  const [voiceState, setVoiceState] = useState<'normal' | 'voice-mode' | 'recording'>('normal');

  // 语音识别功能
  const {
    isListening,
    startRecognition,
    stopRecognition,
  } = useVoiceRecognition();

  // 语音识别处理函数
  const handleToggleVoiceMode = useCallback(() => {
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
  }, [voiceState, isListening, stopRecognition]);

  const handleVoiceSendMessage = useCallback(async (voiceMessage: string) => {
    // 确保有内容才发送
    if (voiceMessage && voiceMessage.trim()) {
      const formattedImages = await processImages();

      // 过滤掉图片文件，避免重复发送
      const nonImageFiles = files.filter((f: FileContent) => !f.mimeType.startsWith('image/'));

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
  }, [processImages, files, onSendMessage, toolsEnabled, setImages, setFiles, setUploadingMedia]);

  // 获取语音按钮配置
  const getVoiceButtonConfig = useCallback((): VoiceButtonConfig => {
    return {
      id: 'voice',
      icon: voiceState !== 'normal' ? <Keyboard size={20} /> : <Mic size={20} />,
      tooltip: voiceState !== 'normal' ? '退出语音输入模式' : '切换到语音输入模式',
      onClick: handleToggleVoiceMode,
      color: voiceState !== 'normal' ? '#f44336' : iconColor,
      disabled: uploadingMedia || (isLoading && !allowConsecutiveMessages),
      isActive: voiceState !== 'normal'
    };
  }, [voiceState, handleToggleVoiceMode, iconColor, uploadingMedia, isLoading, allowConsecutiveMessages]);

  // 渲染语音输入区域
  const renderVoiceInput = useCallback(() => {
    if (voiceState !== 'recording') {
      return null;
    }

    return (
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
    );
  }, [voiceState, isDarkMode, handleVoiceSendMessage, setMessage, startRecognition, message]);

  return {
    voiceState,
    getVoiceButtonConfig,
    renderVoiceInput,
    isVoiceRecording: voiceState === 'recording'
  };
};

export default useVoiceInputManager;
