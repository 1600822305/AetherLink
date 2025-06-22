/**
 * 移动版文件存储服务
 * 基于Capacitor文件系统API，提供类似最佳实例的文件处理能力
 */
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { v4 as uuidv4 } from 'uuid';
import { dexieStorage } from './storage/DexieStorageService';
import type { FileType } from '../types';
import { getFileTypeByExtension, getFileMimeType } from '../utils/fileUtils';

// 文件类型常量
export const FileTypes = {
  IMAGE: 'image',
  TEXT: 'text',
  CODE: 'code',
  DOCUMENT: 'document',
  VIDEO: 'video',
  AUDIO: 'audio',
  ARCHIVE: 'archive',
  BINARY: 'binary',
  UNKNOWN: 'unknown',
  OTHER: 'other'
} as const;

// 支持的图片扩展名
const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico', '.tiff', '.tif'];

// 支持的文档扩展名


// 最大文件大小（50MB）
const MAX_FILE_SIZE = 50 * 1024 * 1024;

// 图片压缩阈值（1MB）
const IMAGE_COMPRESS_THRESHOLD = 1024 * 1024;

/**
 * 移动版文件存储服务类
 */
export class MobileFileStorageService {
  private static instance: MobileFileStorageService;
  private readonly storageDir = 'AetherLink/files';
  private readonly tempDir = 'AetherLink/temp';

  private constructor() {
    this.initStorageDir();
  }

  public static getInstance(): MobileFileStorageService {
    if (!MobileFileStorageService.instance) {
      MobileFileStorageService.instance = new MobileFileStorageService();
    }
    return MobileFileStorageService.instance;
  }

  /**
   * 初始化存储目录
   */
  private async initStorageDir(): Promise<void> {
    try {
      if (Capacitor.isNativePlatform()) {
        // 创建文件存储目录
        await Filesystem.mkdir({
          path: this.storageDir,
          directory: Directory.Data,
          recursive: true
        });

        // 创建临时目录
        await Filesystem.mkdir({
          path: this.tempDir,
          directory: Directory.Cache,
          recursive: true
        });
      }
    } catch (error) {
      console.error('[MobileFileStorage] 初始化存储目录失败:', error);
    }
  }

  /**
   * 计算文件哈希值（简化版）
   */
  private async calculateFileHash(data: string): Promise<string> {
    try {
      // 使用Web Crypto API计算SHA-256哈希
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(data);
      const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (error) {
      console.error('[MobileFileStorage] 计算文件哈希失败:', error);
      // 降级到简单哈希
      return data.length.toString() + Date.now().toString();
    }
  }

  /**
   * 查找重复文件
   */
  private async findDuplicateFile(hash: string, size: number): Promise<FileType | null> {
    try {
      const files = await dexieStorage.files.where('hash').equals(hash).toArray();
      return files.find(f => f.size === size) || null;
    } catch (error) {
      console.error('[MobileFileStorage] 查找重复文件失败:', error);
      return null;
    }
  }

  /**
   * 压缩图片
   */
  private async compressImage(base64Data: string, mimeType: string): Promise<string> {
    try {
      // 如果不是在浏览器环境或数据太小，直接返回
      if (!window.HTMLCanvasElement || base64Data.length < IMAGE_COMPRESS_THRESHOLD) {
        return base64Data;
      }

      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            resolve(base64Data);
            return;
          }

          // 计算压缩后的尺寸
          const maxWidth = 1920;
          const maxHeight = 1080;
          let { width, height } = img;

          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width *= ratio;
            height *= ratio;
          }

          canvas.width = width;
          canvas.height = height;

          // 绘制压缩后的图片
          ctx.drawImage(img, 0, 0, width, height);

          // 转换为base64，质量为0.8
          const compressedData = canvas.toDataURL(mimeType, 0.8);
          resolve(compressedData.split(',')[1] || base64Data);
        };

        img.onerror = () => resolve(base64Data);
        img.src = `data:${mimeType};base64,${base64Data}`;
      });
    } catch (error) {
      console.error('[MobileFileStorage] 图片压缩失败:', error);
      return base64Data;
    }
  }

  /**
   * 上传文件
   */
  public async uploadFile(fileData: {
    name: string;
    mimeType: string;
    size: number;
    base64Data: string;
  }): Promise<FileType> {
    try {
      // 检查文件大小
      if (fileData.size > MAX_FILE_SIZE) {
        throw new Error(`文件太大，最大允许${MAX_FILE_SIZE / 1024 / 1024}MB`);
      }

      // 提取base64数据（去掉data:前缀）
      const base64Content = fileData.base64Data.includes(',')
        ? fileData.base64Data.split(',')[1]
        : fileData.base64Data;

      // 计算文件哈希
      const hash = await this.calculateFileHash(base64Content);

      // 检查重复文件
      const duplicateFile = await this.findDuplicateFile(hash, fileData.size);
      if (duplicateFile) {
        // 增加引用计数
        duplicateFile.count = (duplicateFile.count || 0) + 1;
        await dexieStorage.files.put(duplicateFile);
        return duplicateFile;
      }

      // 生成文件信息
      const fileId = uuidv4();
      const ext = '.' + (fileData.name.split('.').pop()?.toLowerCase() || '');
      const fileName = fileId + ext;
      const fileType = getFileTypeByExtension(fileData.name);

      // 处理图片压缩
      let processedData = base64Content;
      if (imageExts.includes(ext)) {
        processedData = await this.compressImage(base64Content, fileData.mimeType);
      }

      // 保存文件到设备存储
      if (Capacitor.isNativePlatform()) {
        const filePath = `${this.storageDir}/${fileName}`;

        // 对于文本、代码和文档文件，解码base64并以UTF8保存
        if (fileType === FileTypes.TEXT || fileType === FileTypes.CODE || fileType === FileTypes.DOCUMENT) {
          try {
            const decodedContent = this.decodeBase64ToUTF8(processedData);
            await Filesystem.writeFile({
              path: filePath,
              data: decodedContent,
              directory: Directory.Data,
              encoding: Encoding.UTF8
            });
          } catch (error) {
            console.error('[MobileFileStorage] 解码文本文件失败，使用base64保存:', error);
            // 降级：保存base64数据
            await Filesystem.writeFile({
              path: filePath,
              data: processedData,
              directory: Directory.Data,
              encoding: Encoding.UTF8
            });
          }
        } else {
          // 对于其他文件类型，保存base64数据
          await Filesystem.writeFile({
            path: filePath,
            data: processedData,
            directory: Directory.Data,
            encoding: Encoding.UTF8
          });
        }
      }

      // 创建文件记录
      const fileRecord: FileType = {
        id: fileId,
        name: fileName,
        origin_name: fileData.name,
        path: Capacitor.isNativePlatform() ? `${this.storageDir}/${fileName}` : '',
        size: fileData.size,
        ext,
        type: fileType,
        created_at: new Date().toISOString(),
        count: 1,
        hash,
        // 移动端特有字段
        base64Data: processedData,
        mimeType: fileData.mimeType
      };

      // 保存到数据库
      await dexieStorage.files.put(fileRecord);

      return fileRecord;
    } catch (error) {
      console.error('[MobileFileStorage] 上传文件失败:', error);
      throw error;
    }
  }

  /**
   * 读取文件内容
   */
  public async readFile(fileId: string): Promise<string> {
    try {
      const file = await dexieStorage.files.get(fileId);
      if (!file) {
        throw new Error('文件不存在');
      }

      // 如果是文本、代码或文档类型文件，尝试解码base64内容
      if (file.type === FileTypes.TEXT || file.type === FileTypes.CODE || file.type === FileTypes.DOCUMENT) {
        if (file.base64Data) {
          try {
            // 检查base64数据是否包含data:前缀
            let base64Content = file.base64Data;
            if (base64Content && typeof base64Content === 'string' && base64Content.includes(',')) {
              base64Content = base64Content.split(',')[1];
            }

            // 解码base64内容，正确处理UTF-8编码
            const decodedContent = this.decodeBase64ToUTF8(base64Content);
            return decodedContent;
          } catch (error) {
            console.error('[MobileFileStorage] 解码文件内容失败:', error);
            // 如果解码失败，可能文件内容本身就是文本
            return file.base64Data;
          }
        }

        // 如果有路径，尝试从文件系统读取
        if (file.path && Capacitor.isNativePlatform()) {
          try {
            const result = await Filesystem.readFile({
              path: file.path,
              directory: Directory.Data,
              encoding: Encoding.UTF8
            });
            // 文件系统中的文本文件已经是解码后的内容，直接返回
            return result.data as string;
          } catch (error) {
            console.error('[MobileFileStorage] 从文件系统读取失败:', error);
          }
        }
      }

      // 默认返回文件信息
      return `文件: ${file.origin_name}\n类型: ${file.type}\n大小: ${file.size} bytes\n扩展名: ${file.ext}`;
    } catch (error) {
      console.error('[MobileFileStorage] 读取文件失败:', error);
      throw error;
    }
  }

  /**
   * 获取文件的base64数据
   */
  public async getFileBase64(fileId: string): Promise<{ data: string; mimeType: string }> {
    try {
      const file = await dexieStorage.files.get(fileId);
      if (!file) {
        throw new Error('文件不存在');
      }

      const mimeType = file.mimeType || getFileMimeType(file);
      const base64Data = file.base64Data || '';

      return {
        data: `data:${mimeType};base64,${base64Data}`,
        mimeType
      };
    } catch (error) {
      console.error('[MobileFileStorage] 获取文件base64失败:', error);
      throw error;
    }
  }

  /**
   * 删除文件
   */
  public async deleteFile(fileId: string): Promise<void> {
    try {
      const file = await dexieStorage.files.get(fileId);
      if (!file) {
        return;
      }

      // 减少引用计数
      file.count = Math.max(0, (file.count || 1) - 1);

      if (file.count === 0) {
        // 删除物理文件
        if (file.path && Capacitor.isNativePlatform()) {
          try {
            await Filesystem.deleteFile({
              path: file.path,
              directory: Directory.Data
            });
          } catch (error) {
            console.error('[MobileFileStorage] 删除物理文件失败:', error);
          }
        }

        // 删除数据库记录
        await dexieStorage.files.delete(fileId);
      } else {
        // 更新引用计数
        await dexieStorage.files.put(file);
      }
    } catch (error) {
      console.error('[MobileFileStorage] 删除文件失败:', error);
      throw error;
    }
  }

  /**
   * 获取文件信息
   */
  public async getFileInfo(fileId: string): Promise<FileType | null> {
    try {
      return await dexieStorage.files.get(fileId) || null;
    } catch (error) {
      console.error('[MobileFileStorage] 获取文件信息失败:', error);
      return null;
    }
  }

  /**
   * 正确解码base64为UTF-8字符串
   * @param base64String base64编码的字符串
   * @returns UTF-8解码后的字符串
   */
  private decodeBase64ToUTF8(base64String: string): string {
    try {
      // 使用现代浏览器的TextDecoder API
      if (typeof TextDecoder !== 'undefined') {
        const binaryString = atob(base64String);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const decoder = new TextDecoder('utf-8');
        return decoder.decode(bytes);
      } else {
        // 降级处理：使用decodeURIComponent + escape
        const binaryString = atob(base64String);
        const utf8String = decodeURIComponent(escape(binaryString));
        return utf8String;
      }
    } catch (error) {
      console.error('[MobileFileStorage] UTF-8解码失败:', error);
      // 最后的降级处理：直接使用atob
      return atob(base64String);
    }
  }

  /**
   * 清理临时文件
   */
  public async cleanupTempFiles(): Promise<void> {
    try {
      if (Capacitor.isNativePlatform()) {
        // 清理临时目录
        await Filesystem.rmdir({
          path: this.tempDir,
          directory: Directory.Cache,
          recursive: true
        });

        // 重新创建临时目录
        await Filesystem.mkdir({
          path: this.tempDir,
          directory: Directory.Cache,
          recursive: true
        });
      }
    } catch (error) {
      console.error('[MobileFileStorage] 清理临时文件失败:', error);
    }
  }
}

// 导出单例实例
export const mobileFileStorage = MobileFileStorageService.getInstance();
