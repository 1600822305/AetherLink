/**
 * Gemini 文件服务 - 移动端适配版
 * 提供类似的文件上传和管理功能，适配移动端环境
 * 支持真正的文件上传到 Gemini 服务器
 */
import { GoogleGenAI, FileState } from '@google/genai';
import type { File as GeminiFile } from '@google/genai';
import type { Model, FileType } from '../../types';
import { logApiRequest, logApiResponse, log } from '../../services/LoggerService';
import { mobileFileStorage } from '../../services/MobileFileStorageService';
import { withRetry } from '../../utils/retryUtils';
import { FileProcessingUtils } from '../../utils/fileProcessingUtils';
import { createClient } from './client';

// 文件大小常量
const MB = 1024 * 1024;
const MAX_FILE_SIZE = 20 * MB; // 20MB 限制，与保持一致

const FILE_CACHE_DURATION = 3000; // 3秒缓存，与保持一致

/**
 * 缓存服务 - 模拟的 CacheService
 */
class MobileCacheService {
  private static cache = new Map<string, { data: any; timestamp: number; duration: number }>();

  static get<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > cached.duration) {
      this.cache.delete(key);
      return null;
    }

    return cached.data as T;
  }

  static set<T>(key: string, data: T, duration: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      duration
    });
  }

  static clear(key?: string): void {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }
}

/**
 * Gemini 文件服务类
 * 移动端适配版本，支持真正的文件上传到 Gemini 服务器
 */
export class GeminiFileService {
  private model: Model;
  private sdk: GoogleGenAI;

  constructor(model: Model) {
    this.model = model;
    if (!model.apiKey) {
      throw new Error('API密钥未设置');
    }

    // 使用统一的客户端创建函数
    this.sdk = createClient(model);

    console.log(`[GeminiFileService] 初始化文件服务，模型: ${this.model.id}`);
  }

  /**
   * 上传文件到 Gemini 服务器
   * @param file 文件对象
   * @returns Gemini 文件对象
   */
  async uploadFile(file: FileType): Promise<GeminiFile> {
    try {
      console.log(`[GeminiFileService] 开始上传文件到 Gemini: ${file.origin_name}`);

      // 检查文件大小
      if (file.size > MAX_FILE_SIZE) {
        throw new Error(`文件太大，最大允许 ${MAX_FILE_SIZE / MB}MB`);
      }

      // 检查是否为支持的文件类型
      const supportedExtensions = ['.pdf', '.mp4', '.avi', '.mov', '.wmv', '.flv', '.mkv', '.webm', '.ogv', '.3gp', '.mpg', '.mpeg'];
      if (!supportedExtensions.includes(file.ext)) {
        throw new Error(`Gemini 不支持 ${file.ext} 文件类型。支持的类型：${supportedExtensions.join(', ')}`);
      }

      // 记录 API 请求
      logApiRequest('Gemini File Upload', 'INFO', {
        method: 'POST',
        fileName: file.origin_name,
        fileSize: file.size,
        fileType: file.ext,
        model: this.model.id
      });

      // 直接获取文件的原始数据，避免Base64转换
      const blob = await this.getFileBlob(file);

      // 使用 Gemini SDK 上传文件
      const uploadResult = await withRetry(
        async () => {
          // 直接使用原始文件数据上传
          return await this.sdk.files.upload({
            file: blob,
            config: {
              mimeType: blob.type,
              name: file.id,
              displayName: file.origin_name
            }
          });
        },
        'Gemini File Upload',
        3
      );

      // 记录 API 响应
      logApiResponse('Gemini File Upload', 200, {
        fileName: file.origin_name,
        fileUri: uploadResult.uri,
        fileState: uploadResult.state
      });

      console.log(`[GeminiFileService] 文件上传成功: ${uploadResult.uri}`);
      return uploadResult;
    } catch (error: any) {
      log('ERROR', `Gemini 文件上传失败: ${error.message || '未知错误'}`, {
        fileName: file.origin_name,
        fileSize: file.size,
        error
      });
      throw error;
    }
  }

  /**
   * 获取文件的Blob对象，直接用于上传
   */
  private async getFileBlob(file: FileType): Promise<Blob> {
    try {
      // 获取文件的base64数据
      const fileContent = await this.getFileContent(file);

      // 清理base64数据并转换为ArrayBuffer
      const cleanBase64 = FileProcessingUtils.cleanBase64Data(fileContent);
      const binaryData = FileProcessingUtils.base64ToArrayBuffer(cleanBase64);

      // 获取MIME类型
      const mimeType = FileProcessingUtils.getDefaultMimeType(file);

      // 创建Blob对象
      return new Blob([binaryData], { type: mimeType });
    } catch (error) {
      console.error('[GeminiFileService] 创建文件Blob失败:', error);
      throw new Error('无法创建文件Blob对象');
    }
  }

  /**
   * 获取文件内容
   */
  private async getFileContent(file: FileType): Promise<string> {
    // 优先使用文件的 base64Data
    if (file.base64Data) {
      return file.base64Data;
    }

    // 从移动端文件存储读取
    try {
      return await mobileFileStorage.readFile(file.id);
    } catch (error) {
      console.error('[GeminiFileService] 读取文件内容失败:', error);
      throw new Error('无法读取文件内容');
    }
  }

  /**
   * 获取文件的 base64 编码
   * @param file 文件对象
   * @returns base64 数据和 MIME 类型
   */
  async getBase64File(file: FileType): Promise<{ data: string; mimeType: string }> {
    try {
      return await FileProcessingUtils.getFileBase64(file);
    } catch (error) {
      console.error('[GeminiFileService] 获取文件 base64 失败:', error);
      throw error;
    }
  }

  /**
   * 检索已上传的文件 - 模拟实现
   * @param file 文件对象
   * @returns Gemini 文件对象或 undefined
   */
  async retrieveFile(file: FileType): Promise<GeminiFile | undefined> {
    try {
      console.log(`[GeminiFileService] 检索文件: ${file.origin_name}`);

      const FILE_LIST_CACHE_KEY = 'gemini_file_list';

      // 使用缓存服务检查缓存 - 模拟的 CacheService
      const cachedResponse = MobileCacheService.get<GeminiFile[]>(FILE_LIST_CACHE_KEY);
      if (cachedResponse) {
        const cachedFile = this.processFileList(cachedResponse, file);
        if (cachedFile) {
          console.log(`[GeminiFileService] 从缓存中找到文件: ${cachedFile.uri}`);
          return cachedFile;
        }
      }

      // 从 Gemini 服务器获取文件列表
      const files = await this.listFiles();

      // 设置缓存 - 模拟的缓存策略
      MobileCacheService.set(FILE_LIST_CACHE_KEY, files, FILE_CACHE_DURATION);

      // 查找匹配的文件
      const foundFile = this.processFileList(files, file);
      if (foundFile) {
        console.log(`[GeminiFileService] 找到已上传的文件: ${foundFile.uri}`);
      } else {
        console.log(`[GeminiFileService] 未找到已上传的文件: ${file.origin_name}`);
      }

      return foundFile;
    } catch (error) {
      console.error('[GeminiFileService] 检索文件失败:', error);
      return undefined;
    }
  }

  /**
   * 处理文件列表 - 模拟的 processResponse 方法
   * @param files 文件列表
   * @param targetFile 目标文件
   * @returns 匹配的文件或 undefined
   */
  private processFileList(files: GeminiFile[], targetFile: FileType): GeminiFile | undefined {
    for (const file of files) {
      if (file.state === FileState.ACTIVE) {
        if (file.displayName === targetFile.origin_name && Number(file.sizeBytes) === targetFile.size) {
          return file;
        }
      }
    }
    return undefined;
  }

  /**
   * 列出所有已上传的文件
   * @returns 文件列表
   */
  async listFiles(): Promise<GeminiFile[]> {
    try {
      console.log(`[GeminiFileService] 获取文件列表`);

      // 使用 Gemini SDK 获取文件列表
      const files: GeminiFile[] = [];
      const fileList = await withRetry(
        () => this.sdk.files.list(),
        'Gemini List Files',
        3
      );

      // 遍历文件列表
      for await (const file of fileList) {
        files.push(file);
      }

      console.log(`[GeminiFileService] 获取到 ${files.length} 个文件`);
      return files;
    } catch (error) {
      console.error('[GeminiFileService] 获取文件列表失败:', error);
      throw error;
    }
  }

  /**
   * 删除已上传的文件
   * @param fileId Gemini 文件 ID
   */
  async deleteFile(fileId: string): Promise<void> {
    try {
      console.log(`[GeminiFileService] 删除文件: ${fileId}`);

      // 使用 Gemini SDK 删除文件
      await withRetry(
        () => this.sdk.files.delete({ name: fileId }),
        'Gemini Delete File',
        3
      );

      // 清除缓存
      MobileCacheService.clear('gemini_file_list');

      console.log(`[GeminiFileService] 文件删除成功: ${fileId}`);
    } catch (error) {
      console.error('[GeminiFileService] 删除文件失败:', error);
      throw error;
    }
  }


}

/**
 * 创建 Gemini 文件服务实例
 * @param model 模型配置
 * @returns Gemini 文件服务实例
 */
export function createGeminiFileService(model: Model): GeminiFileService {
  return new GeminiFileService(model);
}
