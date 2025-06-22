/**
 * 统一的文件处理工具类
 * 消除重复的文件处理逻辑，提供统一的文件操作接口
 */
import type { FileType } from '../types';
import { MobileFileStorageService } from '../services/MobileFileStorageService';
import { log } from '../services/LoggerService';

/**
 * Base64 数据结果
 */
export interface Base64Result {
  data: string;
  mimeType: string;
}

/**
 * 文件处理工具类
 */
export class FileProcessingUtils {
  private static mobileFileStorage = MobileFileStorageService.getInstance();

  /**
   * 获取文件的 Base64 编码 - 统一实现
   * @param file 文件对象
   * @returns Base64 数据和 MIME 类型
   */
  static async getFileBase64(file: FileType): Promise<Base64Result> {
    try {
      let base64Data = file.base64Data;
      
      // 如果文件对象没有 base64Data，从存储服务读取
      if (!base64Data) {
        const result = await this.mobileFileStorage.getFileBase64(file.id);
        base64Data = result.data;
      }

      if (!base64Data) {
        throw new Error('无法获取文件内容');
      }

      // 移除 data URL 前缀（如果存在）
      const cleanBase64 = (base64Data && typeof base64Data === 'string' && base64Data.includes(',')) ? base64Data.split(',')[1] : base64Data;

      return {
        data: cleanBase64,
        mimeType: file.mimeType || this.getDefaultMimeType(file)
      };
    } catch (error) {
      log('ERROR', `获取文件 Base64 失败: ${file.origin_name}`, {
        fileId: file.id,
        error
      });
      throw error;
    }
  }

  /**
   * 获取图片的 Base64 数据 - 专门用于图片处理
   * @param file 图片文件对象
   * @returns 图片 Base64 数据和 MIME 类型
   */
  static async getImageBase64(file: FileType): Promise<{ base64: string; mime: string }> {
    try {
      const result = await this.getFileBase64(file);
      return {
        base64: result.data,
        mime: result.mimeType
      };
    } catch (error) {
      log('WARN', `获取图片 Base64 失败，使用回退方案: ${file.origin_name}`, { error });

      // 回退到文件内置数据
      const base64Data = file.base64Data || '';
      const cleanBase64 = (base64Data && typeof base64Data === 'string' && base64Data.includes(',')) ? base64Data.split(',')[1] : base64Data;
      const mimeType = file.mimeType || `image/${file.ext?.slice(1) || 'png'}`;

      return {
        base64: cleanBase64,
        mime: mimeType
      };
    }
  }

  /**
   * 获取视频的 Base64 编码
   * @param file 视频文件对象
   * @returns 视频 Base64 数据和 MIME 类型
   */
  static async getVideoBase64(file: FileType): Promise<{ base64: string; mime: string }> {
    try {
      const result = await this.getFileBase64(file);
      return {
        base64: result.data,
        mime: result.mimeType
      };
    } catch (error) {
      log('WARN', `获取视频 Base64 失败，使用回退方案: ${file.origin_name}`, { error });

      // 回退到文件内置数据
      const base64Data = file.base64Data || '';
      const cleanBase64 = (base64Data && typeof base64Data === 'string' && base64Data.includes(',')) ? base64Data.split(',')[1] : base64Data;
      const mimeType = file.mimeType || `video/${file.ext?.slice(1) || 'mp4'}`;

      return {
        base64: cleanBase64,
        mime: mimeType
      };
    }
  }

  /**
   * 读取文件内容 - 统一实现
   * @param file 文件对象
   * @returns 文件内容字符串
   */
  static async readFileContent(file: FileType): Promise<string> {
    try {
      return await this.mobileFileStorage.readFile(file.id);
    } catch (error) {
      log('ERROR', `读取文件内容失败: ${file.origin_name}`, {
        fileId: file.id,
        error
      });
      return `[无法读取文件内容: ${file.origin_name}]`;
    }
  }

  /**
   * 检查文件是否为图片
   * @param file 文件对象
   * @returns 是否为图片
   */
  static isImageFile(file: FileType): boolean {
    return file.type === 'image' || 
           (file.mimeType?.startsWith('image/') ?? false) ||
           /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(file.ext || '');
  }

  /**
   * 检查文件是否为 PDF
   * @param file 文件对象
   * @returns 是否为 PDF
   */
  static isPdfFile(file: FileType): boolean {
    return file.ext === '.pdf' || file.mimeType === 'application/pdf';
  }

  /**
   * 检查文件是否为视频
   * @param file 文件对象
   * @returns 是否为视频
   */
  static isVideoFile(file: FileType): boolean {
    return file.type === 'video' ||
           (file.mimeType?.startsWith('video/') ?? false) ||
           /\.(mp4|avi|mov|wmv|flv|mkv|webm|ogv|3gp|mpg|mpeg)$/i.test(file.ext || '');
  }

  /**
   * 检查文件是否为文本文件
   * @param file 文件对象
   * @returns 是否为文本文件
   */
  static isTextFile(file: FileType): boolean {
    return ['text', 'document'].includes(file.type) ||
           (file.mimeType?.startsWith('text/') ?? false) ||
           /\.(txt|md|json|xml|csv|log)$/i.test(file.ext || '');
  }

  /**
   * 检查文件大小是否为小文件
   * @param file 文件对象
   * @param threshold 阈值（字节），默认 20MB
   * @returns 是否为小文件
   */
  static isSmallFile(file: FileType, threshold: number = 20 * 1024 * 1024): boolean {
    return file.size < threshold;
  }

  /**
   * 获取文件的默认 MIME 类型
   * @param file 文件对象
   * @returns MIME 类型
   */
  static getDefaultMimeType(file: FileType): string {
    if (file.mimeType) {
      return file.mimeType;
    }

    // 根据文件扩展名推断 MIME 类型
    const ext = file.ext?.toLowerCase();
    switch (ext) {
      case '.pdf':
        return 'application/pdf';
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      case '.png':
        return 'image/png';
      case '.gif':
        return 'image/gif';
      case '.webp':
        return 'image/webp';
      case '.txt':
        return 'text/plain';
      case '.md':
        return 'text/markdown';
      case '.json':
        return 'application/json';
      case '.xml':
        return 'application/xml';
      case '.csv':
        return 'text/csv';
      // 视频文件MIME类型
      case '.mp4':
        return 'video/mp4';
      case '.avi':
        return 'video/x-msvideo';
      case '.mov':
        return 'video/quicktime';
      case '.wmv':
        return 'video/x-ms-wmv';
      case '.flv':
        return 'video/x-flv';
      case '.mkv':
        return 'video/x-matroska';
      case '.webm':
        return 'video/webm';
      case '.ogv':
        return 'video/ogg';
      case '.3gp':
        return 'video/3gpp';
      case '.mpg':
      case '.mpeg':
        return 'video/mpeg';
      default:
        return 'application/octet-stream';
    }
  }

  /**
   * 清理 Base64 数据 - 移除 data URL 前缀
   * @param base64Data 原始 Base64 数据
   * @returns 清理后的 Base64 数据
   */
  static cleanBase64Data(base64Data: string): string {
    return (base64Data && typeof base64Data === 'string' && base64Data.includes(',')) ? base64Data.split(',')[1] : base64Data;
  }

  /**
   * 创建 data URL
   * @param base64Data Base64 数据
   * @param mimeType MIME 类型
   * @returns data URL
   */
  static createDataUrl(base64Data: string, mimeType: string): string {
    const cleanBase64 = this.cleanBase64Data(base64Data);
    return `data:${mimeType};base64,${cleanBase64}`;
  }

  /**
   * 将 Base64 转换为 ArrayBuffer
   * @param base64 Base64 字符串
   * @returns ArrayBuffer
   */
  static base64ToArrayBuffer(base64: string): ArrayBuffer {
    const cleanBase64 = this.cleanBase64Data(base64);
    const binaryString = atob(cleanBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * 将 Base64 转换为 Blob
   * @param base64Data Base64 数据
   * @param mimeType MIME 类型
   * @returns Blob 对象
   */
  static base64ToBlob(base64Data: string, mimeType: string): Blob {
    const arrayBuffer = this.base64ToArrayBuffer(base64Data);
    return new Blob([arrayBuffer], { type: mimeType });
  }

  /**
   * 格式化文件大小
   * @param bytes 字节数
   * @returns 格式化的文件大小字符串
   */
  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * 验证文件类型是否被支持
   * @param file 文件对象
   * @param supportedTypes 支持的文件类型列表
   * @returns 是否支持
   */
  static isSupportedFileType(file: FileType, supportedTypes: string[]): boolean {
    return supportedTypes.some(type => {
      if (type.startsWith('.')) {
        return file.ext?.toLowerCase() === type.toLowerCase();
      }
      if (type.includes('/')) {
        return file.mimeType?.toLowerCase() === type.toLowerCase();
      }
      return file.type === type;
    });
  }

  /**
   * 生成文件的唯一标识符
   * @param file 文件对象
   * @returns 文件标识符
   */
  static generateFileIdentifier(file: FileType): string {
    return `${file.id}_${file.size}_${file.origin_name}`;
  }
}

/**
 * 便捷函数导出
 */
export const {
  getFileBase64,
  getImageBase64,
  getVideoBase64,
  readFileContent,
  isImageFile,
  isPdfFile,
  isVideoFile,
  isTextFile,
  isSmallFile,
  getDefaultMimeType,
  cleanBase64Data,
  createDataUrl,
  base64ToArrayBuffer,
  base64ToBlob,
  formatFileSize,
  isSupportedFileType,
  generateFileIdentifier
} = FileProcessingUtils;
