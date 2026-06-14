/**
 * Mistral OCR PDF 预处理 Provider
 * 
 * 复刻 Cherry Studio 的 MistralPreprocessProvider，适配浏览器环境：
 * - 使用 fetch 直接调用 Mistral OCR API
 * - PDF 以 Base64 上传
 * - 返回逐页 Markdown 内容
 * 
 * API 流程：
 * 1. 将 PDF 转为 Base64
 * 2. 调用 Mistral OCR API（/v1/ocr）
 * 3. 解析响应，逐页提取 Markdown
 * 4. 合并为完整文档
 */

import BasePreprocessProvider from './BasePreprocessProvider';
import { PREPROCESS_PROVIDER_METAS } from './types';
import type { PreprocessResult } from './types';
import { createLogger } from '../../infra/logger';

const logger = createLogger('MistralOCR');

interface OCRPage {
  index: number;
  markdown: string;
  images: Array<{
    id: string;
    imageBase64?: string;
  }>;
}

interface OCRResponse {
  pages: OCRPage[];
  model: string;
  usage_info?: {
    pages_processed: number;
  };
}

export default class MistralOCRProvider extends BasePreprocessProvider {
  private get apiHost(): string {
    return this.config.apiHost || PREPROCESS_PROVIDER_METAS.mistral.defaultApiHost;
  }

  private get model(): string {
    return this.config.model || PREPROCESS_PROVIDER_METAS.mistral.defaultModel || 'mistral-ocr-latest';
  }

  /**
   * 解析 PDF 文件
   */
  async parseFile(fileData: ArrayBuffer, fileName: string): Promise<PreprocessResult> {
    const meta = PREPROCESS_PROVIDER_METAS.mistral;

    // 验证文件
    this.sendProgress(5, '验证文件...');
    await this.validateFile(fileData, meta.maxFileSize, meta.maxPages);

    try {
      // Step 1: 上传文件获取 signed URL
      this.sendProgress(10, '上传文件...');
      const documentUrl = await this.uploadFile(fileData, fileName);

      // Step 2: 调用 OCR API
      this.sendProgress(30, 'OCR 解析中...');
      const ocrResult = await this.processOCR(documentUrl);

      // Step 3: 提取 Markdown
      this.sendProgress(80, '提取内容...');
      const content = this.extractMarkdown(ocrResult);

      this.sendProgress(100, '完成');

      return {
        content,
        originalFileName: fileName,
        processedFileName: fileName.replace(/\.pdf$/i, '.md'),
        pageCount: ocrResult.pages.length,
        providerId: 'mistral',
      };
    } catch (error) {
      logger.error('PDF 预处理失败:', error);
      throw error;
    }
  }

  /**
   * 上传文件到 Mistral，获取 signed URL
   */
  private async uploadFile(fileData: ArrayBuffer, fileName: string): Promise<string> {
    // Step 1: 创建文件上传
    const blob = new Blob([fileData], { type: 'application/pdf' });
    const formData = new FormData();
    formData.append('file', blob, fileName);
    formData.append('purpose', 'ocr');

    const uploadResponse = await this.fetchWithAuth(`${this.apiHost}/v1/files`, {
      method: 'POST',
      body: formData,
    });

    const uploadData = await uploadResponse.json();
    const fileId = uploadData.id;

    if (!fileId) {
      throw new Error('Mistral 文件上传失败：未获取到 file ID');
    }

    this.sendProgress(20, '获取文件 URL...');

    // Step 2: 获取 signed URL
    const signedResponse = await this.fetchWithAuth(
      `${this.apiHost}/v1/files/${fileId}/url`,
      { method: 'GET' }
    );

    const signedData = await signedResponse.json();
    if (!signedData.url) {
      throw new Error('Mistral 获取签名 URL 失败');
    }

    return signedData.url;
  }

  /**
   * 调用 Mistral OCR API
   */
  private async processOCR(documentUrl: string): Promise<OCRResponse> {
    const response = await this.fetchWithAuth(`${this.apiHost}/v1/ocr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        document: {
          type: 'document_url',
          document_url: documentUrl,
        },
        include_image_base64: false, // 浏览器端不保存图片文件
      }),
    });

    const result = (await response.json()) as OCRResponse;

    if (!result.pages || result.pages.length === 0) {
      throw new Error('Mistral OCR 返回空结果');
    }

    return result;
  }

  /**
   * 从 OCR 结果中提取并合并 Markdown
   */
  private extractMarkdown(result: OCRResponse): string {
    const parts: string[] = [];

    for (const page of result.pages) {
      if (page.markdown) {
        parts.push(page.markdown);
      }
    }

    return parts.join('\n\n');
  }
}
