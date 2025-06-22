/**
 * 移动端粘贴服务
 * 处理移动端的粘贴事件，包括长文本转文件功能
 */

import { Capacitor } from '@capacitor/core';
import { Clipboard } from '@capacitor/clipboard';
import { MobileFileStorageService } from './MobileFileStorageService';
import type { FileType } from '../types';

export interface PasteOptions {
  pasteLongTextAsFile?: boolean;
  pasteLongTextThreshold?: number;
  onFilesAdded?: (files: FileType[]) => void;
  onTextPasted?: (text: string) => void;
  onError?: (error: string) => void;
}

/**
 * 移动端粘贴服务类
 */
export class MobilePasteService {
  private static instance: MobilePasteService;
  private fileStorageService: MobileFileStorageService;

  private constructor() {
    this.fileStorageService = MobileFileStorageService.getInstance();
  }

  public static getInstance(): MobilePasteService {
    if (!MobilePasteService.instance) {
      MobilePasteService.instance = new MobilePasteService();
    }
    return MobilePasteService.instance;
  }

  /**
   * 处理粘贴事件
   */
  public async handlePaste(options: PasteOptions): Promise<boolean> {
    try {
      // 在移动端，我们主要通过 Capacitor Clipboard 插件来获取剪贴板内容
      if (Capacitor.isNativePlatform()) {
        return await this.handleNativePaste(options);
      } else {
        // Web 环境下的处理
        return await this.handleWebPaste(options);
      }
    } catch (error) {
      console.error('[MobilePasteService] 粘贴处理失败:', error);
      if (options.onError) {
        options.onError(error instanceof Error ? error.message : '粘贴失败');
      }
      return false;
    }
  }

  /**
   * 处理原生平台的粘贴
   */
  private async handleNativePaste(options: PasteOptions): Promise<boolean> {
    try {
      // 读取剪贴板内容
      const result = await Clipboard.read();

      if (result.type === 'text/plain' && result.value) {
        return await this.handleTextPaste(result.value, options);
      }

      // 如果是图片或其他类型，暂时不处理
      return false;
    } catch (error) {
      console.error('[MobilePasteService] 原生粘贴处理失败:', error);
      return false;
    }
  }

  /**
   * 处理 Web 环境的粘贴
   */
  private async handleWebPaste(options: PasteOptions): Promise<boolean> {
    try {
      // 在 Web 环境下，我们需要通过 navigator.clipboard 来读取
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          return await this.handleTextPaste(text, options);
        }
      }
      return false;
    } catch (error) {
      console.error('[MobilePasteService] Web粘贴处理失败:', error);
      return false;
    }
  }

  /**
   * 处理文本粘贴
   */
  private async handleTextPaste(text: string, options: PasteOptions): Promise<boolean> {
    const {
      pasteLongTextAsFile = false,
      pasteLongTextThreshold = 1500,
      onFilesAdded,
      onTextPasted,
      onError
    } = options;

    try {
      // 检查是否需要转换为文件
      if (pasteLongTextAsFile && text.length > pasteLongTextThreshold) {
        // 长文本转文件
        const fileName = `粘贴的文本_${new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')}.txt`;

        // 将文本转换为 base64 (支持中文等多字节字符)
        const encoder = new TextEncoder();
        const data = encoder.encode(text);
        const base64Data = btoa(String.fromCharCode(...data));

        // 创建文件数据
        const fileData = {
          name: fileName,
          size: new Blob([text], { type: 'text/plain' }).size,
          mimeType: 'text/plain',
          base64Data: `data:text/plain;base64,${base64Data}`
        };

        // 使用文件存储服务保存文件
        const fileRecord = await this.fileStorageService.uploadFile(fileData);

        if (onFilesAdded) {
          onFilesAdded([fileRecord]);
        }

        return true;
      } else {
        // 短文本直接粘贴
        if (onTextPasted) {
          onTextPasted(text);
        }
        return true;
      }
    } catch (error) {
      console.error('[MobilePasteService] 文本处理失败:', error);
      if (onError) {
        onError(error instanceof Error ? error.message : '文本处理失败');
      }
      return false;
    }
  }

  /**
   * 手动触发粘贴（用于按钮点击等场景）
   */
  public async triggerPaste(options: PasteOptions): Promise<boolean> {
    return await this.handlePaste(options);
  }

  /**
   * 检查剪贴板是否有内容
   */
  public async hasClipboardContent(): Promise<boolean> {
    try {
      if (Capacitor.isNativePlatform()) {
        const result = await Clipboard.read();
        return !!(result.value && result.value.trim());
      } else {
        if (navigator.clipboard && navigator.clipboard.readText) {
          const text = await navigator.clipboard.readText();
          return !!(text && text.trim());
        }
      }
      return false;
    } catch (error) {
      console.error('[MobilePasteService] 检查剪贴板内容失败:', error);
      return false;
    }
  }

  /**
   * 获取剪贴板文本内容（仅用于预览）
   */
  public async getClipboardText(): Promise<string | null> {
    try {
      if (Capacitor.isNativePlatform()) {
        const result = await Clipboard.read();
        return result.type === 'text/plain' ? result.value : null;
      } else {
        if (navigator.clipboard && navigator.clipboard.readText) {
          return await navigator.clipboard.readText();
        }
      }
      return null;
    } catch (error) {
      console.error('[MobilePasteService] 获取剪贴板文本失败:', error);
      return null;
    }
  }
}

// 导出单例实例
export const mobilePasteService = MobilePasteService.getInstance();
export default MobilePasteService;
