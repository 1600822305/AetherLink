/**
 * 长文本粘贴服务
 * 支持多端（Tauri/Capacitor/Web）的长文本转文件功能
 * 当粘贴的文本超过设定长度时，自动转换为文件
 */

import { v4 as uuidv4 } from 'uuid';
import { detectRuntime, RuntimeType } from '../../utils/platformDetection';
import { dexieStorage } from '../storage/DexieStorageService';
import type { FileType, FileContent } from '../../types';
import { createLogger } from '../infra/logger';
const logger = createLogger('LongTextPasteService');

// 文件类型常量
const FileTypes = {
  TEXT: 'text',
} as const;

/**
 * 长文本粘贴服务配置
 */
export interface LongTextPasteConfig {
  /** 是否启用长文本粘贴为文件功能 */
  enabled: boolean;
  /** 长文本阈值（字符数） */
  threshold: number;
}

/**
 * 粘贴处理结果
 */
export interface PasteResult {
  /** 是否处理成功 */
  success: boolean;
  /** 是否转换为文件 */
  convertedToFile: boolean;
  /** 转换后的文件（如果有） */
  file?: FileContent;
  /** 原始文本（如果未转换） */
  text?: string;
  /** 错误信息（如果有） */
  error?: string;
}

/**
 * 长文本粘贴服务类
 * 单例模式，支持多端平台
 */
export class LongTextPasteService {
  private static instance: LongTextPasteService;
  private runtime: RuntimeType;

  private constructor() {
    this.runtime = detectRuntime();
    logger.debug('初始化，运行时:', this.runtime);
  }

  public static getInstance(): LongTextPasteService {
    if (!LongTextPasteService.instance) {
      LongTextPasteService.instance = new LongTextPasteService();
    }
    return LongTextPasteService.instance;
  }

  /**
   * 处理文本粘贴
   * @param text 粘贴的文本
   * @param config 配置
   * @returns 处理结果
   */
  public async handleTextPaste(
    text: string,
    config: LongTextPasteConfig
  ): Promise<PasteResult> {
    // 如果功能未启用或文本未超过阈值，返回原始文本
    if (!config.enabled || text.length <= config.threshold) {
      return {
        success: true,
        convertedToFile: false,
        text
      };
    }

    try {
      // 文本超过阈值，转换为文件
      const file = await this.convertTextToFile(text);
      return {
        success: true,
        convertedToFile: true,
        file
      };
    } catch (error) {
      logger.error('转换文本为文件失败:', error);
      return {
        success: false,
        convertedToFile: false,
        error: error instanceof Error ? error.message : '转换失败'
      };
    }
  }

  /**
   * 将文本转换为文件
   * @param text 文本内容
   * @returns FileContent 对象
   */
  private async convertTextToFile(text: string): Promise<FileContent> {
    // 生成文件名
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
    const fileName = `粘贴的文本_${timestamp}.txt`;
    const fileId = uuidv4();

    // 将文本转换为 base64（支持中文等多字节字符）
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const base64Data = this.arrayBufferToBase64(data);
    const fullBase64Data = `data:text/plain;base64,${base64Data}`;

    // 计算文件大小
    const blob = new Blob([text], { type: 'text/plain' });
    const fileSize = blob.size;

    // 根据运行时环境保存文件
    const fileRecord = await this.saveFile({
      id: fileId,
      name: fileName,
      mimeType: 'text/plain',
      size: fileSize,
      base64Data: fullBase64Data,
      text: text // 保存原始文本以便后续读取
    });

    // 返回 FileContent 格式
    return {
      name: fileName,
      mimeType: 'text/plain',
      extension: '.txt',
      size: fileSize,
      base64Data: fullBase64Data,
      url: fileRecord.path || '',
      fileId: fileRecord.id,
      fileRecord: fileRecord
    };
  }

  /**
   * 保存文件到存储
   * 根据不同平台使用不同的存储方式
   */
  private async saveFile(fileData: {
    id: string;
    name: string;
    mimeType: string;
    size: number;
    base64Data: string;
    text: string;
  }): Promise<FileType & { textContent?: string }> {
    // 扩展 FileType 以支持临时存储文本内容
    const fileRecord: FileType & { textContent?: string } = {
      id: fileData.id,
      name: fileData.id + '.txt',
      origin_name: fileData.name,
      path: '',
      size: fileData.size,
      ext: '.txt',
      type: FileTypes.TEXT,
      mimeType: fileData.mimeType,
      base64Data: fileData.base64Data,
      created_at: new Date().toISOString(),
      count: 1,
      // 临时保存原始文本内容（不会持久化到数据库）
      textContent: fileData.text
    };

    // 根据运行时保存文件
    const textContent = fileRecord.textContent;
    switch (this.runtime) {
      case RuntimeType.TAURI:
        await this.saveFileForTauri(fileRecord, textContent || '');
        break;
      case RuntimeType.CAPACITOR:
        await this.saveFileForCapacitor(fileRecord, textContent || '');
        break;
      default:
        await this.saveFileForWeb(fileRecord);
    }

    return fileRecord;
  }

  /**
   * Tauri 端保存文件
   * P1修复：确保目录存在后再写入文件
   */
  private async saveFileForTauri(fileRecord: FileType, textContent: string): Promise<void> {
    try {
      // 尝试使用 Tauri 文件系统 API
      const globalObj = globalThis as any;
      if (globalObj.__TAURI__?.fs || globalObj.__TAURI_INTERNALS__) {
        // Tauri v2 API
        try {
          const { writeTextFile, mkdir, BaseDirectory } = await import('@tauri-apps/plugin-fs');
          const dirPath = 'AetherLink/files';
          const filePath = `${dirPath}/${fileRecord.name}`;
          
          // P1修复：确保目录存在
          try {
            await mkdir(dirPath, {
              baseDir: BaseDirectory.AppData,
              recursive: true
            });
            logger.debug('目录创建成功:', dirPath);
          } catch (mkdirError) {
            // 目录可能已存在，忽略错误
            logger.debug('目录已存在或创建跳过');
          }
          
          // 写入文件
          await writeTextFile(filePath, textContent, {
            baseDir: BaseDirectory.AppData
          });
          fileRecord.path = filePath;
          logger.debug('Tauri 文件保存成功:', filePath);
        } catch (tauriError) {
          logger.warn('Tauri v2 API 不可用，使用 Dexie 存储:', tauriError);
          await this.saveFileForWeb(fileRecord);
        }
      } else {
        // 降级到 Dexie 存储
        await this.saveFileForWeb(fileRecord);
      }
    } catch (error) {
      logger.error('Tauri 保存失败，降级到 Dexie:', error);
      await this.saveFileForWeb(fileRecord);
    }
  }

  /**
   * Capacitor 端保存文件
   */
  private async saveFileForCapacitor(fileRecord: FileType, textContent: string): Promise<void> {
    try {
      const { Capacitor } = await import('@capacitor/core');
      
      if (Capacitor.isNativePlatform()) {
        const { Directory, Encoding, Filesystem } = await import('@capacitor/filesystem');
        const filePath = `AetherLink/files/${fileRecord.name}`;
        
        // 确保目录存在
        try {
          await Filesystem.mkdir({
            path: 'AetherLink/files',
            directory: Directory.Data,
            recursive: true
          });
        } catch {
          // 目录可能已存在，忽略错误
        }

        // 保存文件
        await Filesystem.writeFile({
          path: filePath,
          data: textContent,
          directory: Directory.Data,
          encoding: Encoding.UTF8
        });
        
        fileRecord.path = filePath;
        logger.debug('Capacitor 文件保存成功:', filePath);
      } else {
        // 非原生平台，使用 Dexie
        await this.saveFileForWeb(fileRecord);
      }
    } catch (error) {
      logger.error('Capacitor 保存失败，降级到 Dexie:', error);
      await this.saveFileForWeb(fileRecord);
    }

    // 同时保存到 Dexie 以确保数据一致性
    try {
      await dexieStorage.files.put(fileRecord);
    } catch (error) {
      logger.warn('Dexie 备份保存失败:', error);
    }
  }

  /**
   * Web 端保存文件（使用 Dexie）
   */
  private async saveFileForWeb(fileRecord: FileType | (FileType & { textContent?: string })): Promise<void> {
    try {
      await dexieStorage.files.put(fileRecord);
      logger.debug('Web/Dexie 文件保存成功:', fileRecord.id);
    } catch (error) {
      logger.error('Dexie 保存失败:', error);
      throw error;
    }
  }

  /**
   * ArrayBuffer 转 base64
   */
  private arrayBufferToBase64(buffer: Uint8Array): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * 检查文本是否应该转换为文件
   */
  public shouldConvertToFile(text: string, config: LongTextPasteConfig): boolean {
    return config.enabled && text.length > config.threshold;
  }

  /**
   * 获取当前运行时
   */
  public getRuntime(): RuntimeType {
    return this.runtime;
  }
}

// 导出单例实例
export const longTextPasteService = LongTextPasteService.getInstance();
export default LongTextPasteService;