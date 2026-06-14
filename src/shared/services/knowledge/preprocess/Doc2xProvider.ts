/**
 * Doc2X PDF 预处理 Provider
 * 
 * 复刻 Cherry Studio 的 Doc2xPreprocessProvider，适配浏览器环境：
 * - 使用 fetch 代替 electron.net
 * - 使用 JSZip 代替 AdmZip 解压
 * - 不依赖 fs，所有数据在内存中处理
 * 
 * API 流程：
 * 1. preupload → 获取上传 URL 和 uid
 * 2. PUT 上传文件到获得的 URL
 * 3. 轮询处理状态直到完成
 * 4. 请求导出为 Markdown
 * 5. 下载 zip → 解压提取 .md 文件
 */

import BasePreprocessProvider from './BasePreprocessProvider';
import { universalFetch } from '../../../utils/universalFetch';
import { PREPROCESS_PROVIDER_METAS } from './types';
import type { PreprocessResult } from './types';
import { createLogger } from '../../infra/logger';

const logger = createLogger('Doc2x');

type ApiResponse<T> = {
  code: string;
  data: T;
  message?: string;
};

type PreuploadResponse = {
  uid: string;
  url: string;
};

type StatusResponse = {
  status: string;
  progress: number;
};

type ParsedFileResponse = {
  status: string;
  url: string;
};

export default class Doc2xProvider extends BasePreprocessProvider {
  private get apiHost(): string {
    return this.config.apiHost || PREPROCESS_PROVIDER_METAS.doc2x.defaultApiHost;
  }

  /**
   * 解析 PDF 文件
   */
  async parseFile(fileData: ArrayBuffer, fileName: string): Promise<PreprocessResult> {
    const meta = PREPROCESS_PROVIDER_METAS.doc2x;

    // 验证文件
    this.sendProgress(5, '验证文件...');
    await this.validateFile(fileData, meta.maxFileSize, meta.maxPages);

    try {
      // Step 1: 预上传
      this.sendProgress(10, '准备上传...');
      const { uid, url } = await this.preupload();

      // Step 2: 上传文件
      this.sendProgress(15, '上传文件...');
      await this.putFile(fileData, url);

      // Step 3: 等待处理
      this.sendProgress(20, '云端解析中...');
      await this.waitForProcessing(uid);

      // Step 4: 导出为 Markdown
      this.sendProgress(70, '导出 Markdown...');
      await this.convertFile(uid, fileName);

      // Step 5: 等待导出
      this.sendProgress(75, '等待导出...');
      const exportUrl = await this.waitForExport(uid);

      // Step 6: 下载并解压
      this.sendProgress(85, '下载结果...');
      const content = await this.downloadAndExtract(exportUrl, fileName);

      this.sendProgress(100, '完成');

      return {
        content,
        originalFileName: fileName,
        processedFileName: fileName.replace(/\.pdf$/i, '.md'),
        providerId: 'doc2x',
      };
    } catch (error) {
      logger.error('PDF 预处理失败:', error);
      throw error;
    }
  }

  /**
   * 预上传：获取上传 URL 和 uid
   */
  private async preupload(): Promise<PreuploadResponse> {
    const response = await this.fetchWithAuth(`${this.apiHost}/api/v2/parse/preupload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = (await response.json()) as ApiResponse<PreuploadResponse>;
    if (data.code === 'success' && data.data) {
      return data.data;
    }
    throw new Error(`Doc2x 预上传失败: ${data.message || JSON.stringify(data)}`);
  }

  /**
   * 上传文件到预签名 URL
   */
  private async putFile(fileData: ArrayBuffer, url: string): Promise<void> {
    const response = await universalFetch(url, {
      method: 'PUT',
      body: fileData,
    });

    if (!response.ok) {
      throw new Error(`文件上传失败: HTTP ${response.status}`);
    }
  }

  /**
   * 轮询处理状态
   */
  private async waitForProcessing(uid: string): Promise<void> {
    const maxRetries = 120; // 最长等待 2 分钟
    for (let i = 0; i < maxRetries; i++) {
      await this.delay(1000);

      const { status, progress } = await this.getStatus(uid);
      // 映射进度到 20-70 区间
      const mappedProgress = 20 + Math.floor(progress * 0.5);
      this.sendProgress(mappedProgress, `云端解析中 (${progress}%)...`);

      if (status === 'success') {
        return;
      } else if (status === 'failed') {
        throw new Error('Doc2x 处理失败');
      }
    }
    throw new Error('Doc2x 处理超时');
  }

  /**
   * 查询处理状态
   */
  private async getStatus(uid: string): Promise<StatusResponse> {
    const response = await this.fetchWithAuth(
      `${this.apiHost}/api/v2/parse/status?uid=${uid}`
    );

    const data = (await response.json()) as ApiResponse<StatusResponse>;
    if (data.code === 'success' && data.data) {
      return data.data;
    }
    throw new Error(`获取状态失败: ${data.message || JSON.stringify(data)}`);
  }

  /**
   * 请求转换为 Markdown
   */
  private async convertFile(uid: string, fileName: string): Promise<void> {
    const baseName = fileName.replace(/\.[^/.]+$/, '');

    const response = await this.fetchWithAuth(`${this.apiHost}/api/v2/convert/parse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uid,
        to: 'md',
        formula_mode: 'normal',
        filename: baseName,
      }),
    });

    const data = (await response.json()) as ApiResponse<any>;
    if (data.code !== 'success') {
      throw new Error(`转换请求失败: ${data.message || JSON.stringify(data)}`);
    }
  }

  /**
   * 等待导出完成并获取下载 URL
   */
  private async waitForExport(uid: string): Promise<string> {
    const maxRetries = 60;
    for (let i = 0; i < maxRetries; i++) {
      await this.delay(1000);

      const response = await this.fetchWithAuth(
        `${this.apiHost}/api/v2/convert/parse/result?uid=${uid}`
      );

      const data = (await response.json()) as ApiResponse<ParsedFileResponse>;
      if (data.data) {
        if (data.data.status === 'success' && data.data.url) {
          return data.data.url;
        } else if (data.data.status === 'failed') {
          throw new Error('Doc2x 导出失败');
        }
      }
    }
    throw new Error('Doc2x 导出超时');
  }

  /**
   * 下载 zip 并解压提取 .md 内容
   */
  private async downloadAndExtract(url: string, _fileName: string): Promise<string> {
    const response = await universalFetch(url);
    if (!response.ok) {
      throw new Error(`下载失败: HTTP ${response.status}`);
    }

    const zipBuffer = await response.arrayBuffer();

    // 动态加载 JSZip
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(zipBuffer);

    // 查找 .md 文件
    let mdContent = '';

    for (const [name, file] of Object.entries(zip.files)) {
      if (name.endsWith('.md') && !file.dir) {
        mdContent = await file.async('string');
        break;
      }
    }

    // 如果没找到精确匹配的 .md，取第一个 .md 文件
    if (!mdContent) {
      for (const [name, file] of Object.entries(zip.files)) {
        if (name.endsWith('.md') && !file.dir) {
          mdContent = await file.async('string');
          break;
        }
      }
    }

    if (!mdContent) {
      // 降级：尝试读取任意文本文件
      for (const [name, file] of Object.entries(zip.files)) {
        if ((name.endsWith('.txt') || name.endsWith('.md')) && !file.dir) {
          mdContent = await file.async('string');
          break;
        }
      }
    }

    if (!mdContent) {
      throw new Error('Doc2x 解压后未找到 Markdown 文件');
    }

    return mdContent;
  }
}
