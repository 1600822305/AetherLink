/**
 * 移动端粘贴服务
 * 专门处理 Capacitor 原生平台的剪贴板操作
 * 长文本转文件功能已统一由 LongTextPasteService 处理
 */

import { Capacitor } from '@capacitor/core';
import { Clipboard } from '@capacitor/clipboard';
import { createLogger } from '../infra/logger';

const logger = createLogger('MobilePasteService');

/**
 * 移动端粘贴服务类
 * 提供原生剪贴板访问能力
 */
export class MobilePasteService {
  private static instance: MobilePasteService;

  private constructor() {}

  public static getInstance(): MobilePasteService {
    if (!MobilePasteService.instance) {
      MobilePasteService.instance = new MobilePasteService();
    }
    return MobilePasteService.instance;
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
      logger.error('检查剪贴板内容失败:', error);
      return false;
    }
  }

  /**
   * 获取剪贴板文本内容
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
      logger.error('获取剪贴板文本失败:', error);
      return null;
    }
  }

  /**
   * 复制文本到剪贴板
   */
  public async copyToClipboard(text: string): Promise<boolean> {
    try {
      if (Capacitor.isNativePlatform()) {
        await Clipboard.write({ string: text });
        return true;
      } else {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
          return true;
        }
      }
      return false;
    } catch (error) {
      logger.error('复制到剪贴板失败:', error);
      return false;
    }
  }
}

// 导出单例实例
export const mobilePasteService = MobilePasteService.getInstance();
export default MobilePasteService;
