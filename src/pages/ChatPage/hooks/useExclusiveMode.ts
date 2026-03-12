import { useState, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { setActiveProviderId } from '../../../shared/store/slices/webSearchSlice';

/**
 * 互斥模式类型
 */
export type ExclusiveMode = 'image' | 'video' | 'webSearch' | null;

/**
 * 管理聊天输入的互斥模式状态
 * 同一时间只能激活一个模式（图像生成、视频生成、网络搜索）
 */
export const useExclusiveMode = () => {
  const dispatch = useDispatch();
  
  // 统一管理互斥模式状态
  const [activeMode, setActiveMode] = useState<ExclusiveMode>(null);

  // 派生状态：各模式是否激活
  const webSearchActive = activeMode === 'webSearch';
  const imageGenerationMode = activeMode === 'image';
  const videoGenerationMode = activeMode === 'video';

  /**
   * 通用的互斥模式切换函数
   * 切换到某个模式时会自动关闭其他模式
   */
  const toggleMode = useCallback((mode: ExclusiveMode) => {
    setActiveMode(prev => {
      if (prev === mode) {
        // 关闭当前模式
        if (mode === 'webSearch') {
          // 关闭搜索模式时，清除 activeProviderId
          dispatch(setActiveProviderId(undefined));
        }
        return null;
      }
      // 切换到新模式
      return mode;
    });
  }, [dispatch]);

  // 切换图像生成模式
  const toggleImageGenerationMode = useCallback(() => {
    toggleMode('image');
  }, [toggleMode]);

  // 切换视频生成模式
  const toggleVideoGenerationMode = useCallback(() => {
    toggleMode('video');
  }, [toggleMode]);

  // 切换网络搜索模式
  const toggleWebSearch = useCallback(() => {
    toggleMode('webSearch');
  }, [toggleMode]);

  // 清除当前模式
  const clearMode = useCallback(() => {
    setActiveMode(null);
  }, []);

  return {
    activeMode,
    webSearchActive,
    imageGenerationMode,
    videoGenerationMode,
    toggleImageGenerationMode,
    toggleVideoGenerationMode,
    toggleWebSearch,
    clearMode
  };
};
