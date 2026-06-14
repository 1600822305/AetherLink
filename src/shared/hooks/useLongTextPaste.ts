/**
 * 长文本粘贴 Hook
 * 提供统一的长文本粘贴处理逻辑，支持多端平台
 */

import { useCallback } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import { longTextPasteService, type PasteResult } from '../services/files/LongTextPasteService';
import type { FileContent } from '../types';
import { createLogger } from '../services/infra/logger';

const logger = createLogger('LongTextPaste');

export interface UseLongTextPasteOptions {
  /** 文件添加回调 */
  onFileAdd?: (file: FileContent) => void;
  /** 错误回调 */
  onError?: (error: string) => void;
  /** 成功回调 */
  onSuccess?: (message: string) => void;
}

export interface UseLongTextPasteReturn {
  /** 处理粘贴事件 */
  handlePaste: (e: React.ClipboardEvent) => Promise<boolean>;
  /** P0修复：直接处理文本数据（避免异步时序问题） */
  handleTextDirectly: (text: string) => Promise<boolean>;
  /** 检查文本是否应该转换为文件 */
  shouldConvertToFile: (text: string) => boolean;
  /** 长文本粘贴功能是否启用 */
  isEnabled: boolean;
  /** 长文本阈值 */
  threshold: number;
}

/**
 * 长文本粘贴 Hook
 * @param options 配置选项
 * @returns 粘贴处理相关方法和状态
 */
export function useLongTextPaste(options: UseLongTextPasteOptions = {}): UseLongTextPasteReturn {
  const { onFileAdd, onError, onSuccess } = options;

  // 从 Redux 获取设置
  const pasteLongTextAsFile = useSelector((state: RootState) => state.settings.pasteLongTextAsFile ?? false);
  const pasteLongTextThreshold = useSelector((state: RootState) => state.settings.pasteLongTextThreshold ?? 1500);

  /**
   * 检查文本是否应该转换为文件
   */
  const shouldConvertToFile = useCallback((text: string): boolean => {
    return longTextPasteService.shouldConvertToFile(text, {
      enabled: pasteLongTextAsFile,
      threshold: pasteLongTextThreshold
    });
  }, [pasteLongTextAsFile, pasteLongTextThreshold]);

  /**
   * 处理粘贴事件
   * @returns 是否已处理（true = 已处理，调用方应阻止默认行为）
   */
  const handlePaste = useCallback(async (e: React.ClipboardEvent): Promise<boolean> => {
    const clipboardData = e.clipboardData;
    if (!clipboardData) return false;

    // 获取粘贴的文本
    const textData = clipboardData.getData('text');
    if (!textData) return false;

    // 检查是否需要转换为文件
    if (!shouldConvertToFile(textData)) {
      return false;
    }

    // 处理长文本转文件
    try {
      const result: PasteResult = await longTextPasteService.handleTextPaste(textData, {
        enabled: pasteLongTextAsFile,
        threshold: pasteLongTextThreshold
      });

      if (result.success && result.convertedToFile && result.file) {
        // 通知调用方添加文件
        onFileAdd?.(result.file);
        
        // 成功提示
        const fileName = result.file.name;
        onSuccess?.(`长文本已转换为文件: ${fileName}`);
        
        return true;
      } else if (!result.success && result.error) {
        onError?.(result.error);
        return false;
      }

      return false;
    } catch (error) {
      logger.error('处理失败:', error);
      onError?.(error instanceof Error ? error.message : '长文本转文件失败');
      return false;
    }
  }, [pasteLongTextAsFile, pasteLongTextThreshold, shouldConvertToFile, onFileAdd, onError, onSuccess]);

  /**
   * P0修复：直接处理文本数据
   * 避免异步时序问题 - 在异步操作前已同步获取了文本数据
   * @param text 文本数据
   * @returns 是否已处理
   */
  const handleTextDirectly = useCallback(async (text: string): Promise<boolean> => {
    if (!text) return false;

    // 检查是否需要转换为文件
    if (!shouldConvertToFile(text)) {
      return false;
    }

    // 处理长文本转文件
    try {
      const result: PasteResult = await longTextPasteService.handleTextPaste(text, {
        enabled: pasteLongTextAsFile,
        threshold: pasteLongTextThreshold
      });

      if (result.success && result.convertedToFile && result.file) {
        onFileAdd?.(result.file);
        const fileName = result.file.name;
        onSuccess?.(`长文本已转换为文件: ${fileName}`);
        return true;
      } else if (!result.success && result.error) {
        onError?.(result.error);
        return false;
      }

      return false;
    } catch (error) {
      logger.error('处理失败:', error);
      onError?.(error instanceof Error ? error.message : '长文本转文件失败');
      return false;
    }
  }, [pasteLongTextAsFile, pasteLongTextThreshold, shouldConvertToFile, onFileAdd, onError, onSuccess]);

  return {
    handlePaste,
    handleTextDirectly,
    shouldConvertToFile,
    isEnabled: pasteLongTextAsFile,
    threshold: pasteLongTextThreshold
  };
}

export default useLongTextPaste;