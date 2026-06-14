/**
 * MinerU PDF 预处理 Provider — 官方 v4 API
 * 
 * 适配 mineru.net 官方 REST API（异步任务模式）：
 * 
 * API 流程（文件上传）：
 * 1. POST /api/v4/file-urls/batch — 申请预签名上传 URL + batch_id
 * 2. PUT {presigned_url}         — 上传文件二进制
 * 3. GET  /api/v4/extract-results/batch/{batch_id} — 轮询直到 state=done
 * 4. 下载 full_zip_url           — 解压提取 .md 内容
 * 
 * 支持文件类型：PDF、Doc、PPT、图片
 * 模型版本：vlm（PDF/Doc/PPT/图片）、MinerU-HTML（HTML）
 * 限制：单文件 ≤200MB / ≤600 页，每天 2000 页高优先级
 */

import BasePreprocessProvider from './BasePreprocessProvider';
import { PREPROCESS_PROVIDER_METAS } from './types';
import type { PreprocessResult } from './types';
import { universalFetch } from '../../../utils/universalFetch';
import { createLogger } from '../../infra/logger';

const logger = createLogger('MinerU');

// ==================== API 响应类型 ====================

interface MineruApiResponse<T = any> {
  code: number;
  msg: string;
  data: T;
  trace_id?: string;
}

interface BatchUploadData {
  batch_id: string;
  file_urls: string[];
}

interface ExtractResultItem {
  file_name: string;
  data_id?: string;
  state: 'waiting' | 'running' | 'done' | 'failed';
  err_msg: string;
  full_zip_url?: string;
  extract_progress?: {
    extracted_pages: number;
    total_pages: number;
    start_time: string;
  };
}

interface BatchExtractData {
  batch_id: string;
  extract_result: ExtractResultItem[];
}

interface SingleTaskData {
  task_id: string;
}

interface SingleTaskResult {
  task_id: string;
  state: 'waiting' | 'running' | 'done' | 'failed';
  full_zip_url?: string;
  err_msg: string;
  extract_progress?: {
    extracted_pages: number;
    total_pages: number;
    start_time: string;
  };
}

// ==================== Provider 实现 ====================

export default class OpenMineruProvider extends BasePreprocessProvider {
  /** 最大轮询次数（每次间隔 3s，共约 10 分钟） */
  private static readonly MAX_POLL_ATTEMPTS = 200;
  /** 轮询间隔（ms） */
  private static readonly POLL_INTERVAL = 3000;

  private get apiHost(): string {
    return this.config.apiHost || PREPROCESS_PROVIDER_METAS['open-mineru'].defaultApiHost;
  }

  private get modelVersion(): string {
    return this.config.model || PREPROCESS_PROVIDER_METAS['open-mineru'].defaultModel || 'vlm';
  }

  /**
   * 解析文件（主入口）
   */
  async parseFile(fileData: ArrayBuffer, fileName: string): Promise<PreprocessResult> {
    const meta = PREPROCESS_PROVIDER_METAS['open-mineru'];

    if (!this.config.apiKey) {
      throw new Error('MinerU API 需要 Token，请在设置中配置 API Key');
    }

    // 验证文件
    this.sendProgress(2, '验证文件...');
    await this.validateFile(fileData, meta.maxFileSize, meta.maxPages);

    try {
      const content = await this.processViaFileUpload(fileData, fileName);

      this.sendProgress(100, '完成');

      return {
        content,
        originalFileName: fileName,
        processedFileName: fileName.replace(/\.[^.]+$/i, '.md'),
        providerId: 'open-mineru',
      };
    } catch (error) {
      logger.error('预处理失败:', error);
      throw error;
    }
  }

  // ==================== 文件上传解析流程 ====================

  /**
   * 通过文件上传方式解析（适用于本地文件）
   * 流程：申请上传链接 → 上传文件 → 轮询结果 → 下载解压
   */
  private async processViaFileUpload(fileData: ArrayBuffer, fileName: string): Promise<string> {
    // Step 1: 申请预签名上传 URL
    this.sendProgress(5, '申请上传链接...');
    const { batch_id, upload_url } = await this.requestUploadUrl(fileName);
    logger.debug(`获取上传链接成功, batch_id: ${batch_id}`);

    // Step 2: 上传文件
    this.sendProgress(10, '上传文件...');
    await this.uploadFile(upload_url, fileData);
    logger.debug(`文件上传成功: ${fileName}`);

    // Step 3: 轮询解析结果
    this.sendProgress(20, '等待解析...');
    const zipUrl = await this.pollBatchResult(batch_id, fileName);
    logger.debug(`解析完成, zip URL: ${zipUrl}`);

    // Step 4: 下载并解压
    this.sendProgress(85, '下载结果...');
    const zipBuffer = await this.downloadZip(zipUrl);

    this.sendProgress(92, '解压文件...');
    return await this.extractMarkdownFromZip(zipBuffer);
  }

  /**
   * Step 1: 申请文件上传链接
   * POST /api/v4/file-urls/batch
   */
  private async requestUploadUrl(fileName: string): Promise<{ batch_id: string; upload_url: string }> {
    const url = `${this.apiHost}/api/v4/file-urls/batch`;

    const response = await this.fetchWithAuth(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        files: [{ name: fileName, data_id: this.generateDataId() }],
        model_version: this.modelVersion,
      }),
    });

    const result: MineruApiResponse<BatchUploadData> = await response.json();

    if (result.code !== 0) {
      throw new Error(`MinerU 申请上传链接失败: ${result.msg} (code: ${result.code})`);
    }

    if (!result.data.file_urls || result.data.file_urls.length === 0) {
      throw new Error('MinerU 未返回上传链接');
    }

    return {
      batch_id: result.data.batch_id,
      upload_url: result.data.file_urls[0],
    };
  }

  /**
   * Step 2: 上传文件到预签名 URL
   * PUT {presigned_url}
   */
  private async uploadFile(uploadUrl: string, fileData: ArrayBuffer): Promise<void> {
    const response = await universalFetch(uploadUrl, {
      method: 'PUT',
      body: fileData,
    });

    if (!response.ok) {
      throw new Error(`MinerU 文件上传失败: HTTP ${response.status}`);
    }
  }

  /**
   * Step 3: 轮询批量任务结果
   * GET /api/v4/extract-results/batch/{batch_id}
   */
  private async pollBatchResult(batchId: string, fileName: string): Promise<string> {
    const url = `${this.apiHost}/api/v4/extract-results/batch/${batchId}`;

    for (let i = 0; i < OpenMineruProvider.MAX_POLL_ATTEMPTS; i++) {
      await this.delay(OpenMineruProvider.POLL_INTERVAL);

      try {
        const response = await this.fetchWithAuth(url);
        const result: MineruApiResponse<BatchExtractData> = await response.json();

        if (result.code !== 0) {
          logger.warn(`轮询返回错误: ${result.msg}`);
          continue;
        }

        const extractResults = result.data.extract_result;
        if (!extractResults || extractResults.length === 0) {
          continue;
        }

        const item = extractResults[0];

        switch (item.state) {
          case 'done':
            if (item.full_zip_url) {
              return item.full_zip_url;
            }
            throw new Error('MinerU 任务完成但未返回下载链接');

          case 'failed':
            throw new Error(`MinerU 解析失败: ${item.err_msg || '未知错误'}`);

          case 'running': {
            const progress = item.extract_progress;
            if (progress) {
              const pct = Math.round((progress.extracted_pages / progress.total_pages) * 60) + 20;
              this.sendProgress(
                Math.min(pct, 80),
                `解析中 (${progress.extracted_pages}/${progress.total_pages} 页)...`
              );
            } else {
              this.sendProgress(25, `解析中...`);
            }
            break;
          }

          case 'waiting':
            this.sendProgress(20, '排队中...');
            break;
        }
      } catch (error) {
        // 网络错误时继续轮询
        if (i === OpenMineruProvider.MAX_POLL_ATTEMPTS - 1) {
          throw error;
        }
        logger.warn(`轮询第 ${i + 1} 次失败:`, error);
      }
    }

    throw new Error(`MinerU 解析超时 (${fileName})，请稍后在 mineru.net 查看任务状态`);
  }

  // ==================== URL 解析流程（公共 URL） ====================

  /**
   * 通过 URL 提交解析任务（适用于可公开访问的文件 URL）
   * POST /api/v4/extract/task
   * 
   * 注意：此方法需要文件已在可访问的 URL 上，不适用于本地文件
   */
  async parseByUrl(fileUrl: string, fileName: string): Promise<PreprocessResult> {
    if (!this.config.apiKey) {
      throw new Error('MinerU API 需要 Token');
    }

    this.sendProgress(5, '提交解析任务...');
    const taskId = await this.submitUrlTask(fileUrl);

    this.sendProgress(15, '等待解析...');
    const zipUrl = await this.pollTaskResult(taskId);

    this.sendProgress(85, '下载结果...');
    const zipBuffer = await this.downloadZip(zipUrl);

    this.sendProgress(92, '解压文件...');
    const content = await this.extractMarkdownFromZip(zipBuffer);

    this.sendProgress(100, '完成');

    return {
      content,
      originalFileName: fileName,
      processedFileName: fileName.replace(/\.[^.]+$/i, '.md'),
      providerId: 'open-mineru',
    };
  }

  /**
   * 提交 URL 解析任务
   * POST /api/v4/extract/task
   */
  private async submitUrlTask(fileUrl: string): Promise<string> {
    const url = `${this.apiHost}/api/v4/extract/task`;

    const response = await this.fetchWithAuth(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: fileUrl,
        model_version: this.modelVersion,
      }),
    });

    const result: MineruApiResponse<SingleTaskData> = await response.json();

    if (result.code !== 0) {
      throw new Error(`MinerU 提交任务失败: ${result.msg}`);
    }

    return result.data.task_id;
  }

  /**
   * 轮询单个任务结果
   * GET /api/v4/extract/task/{task_id}
   */
  private async pollTaskResult(taskId: string): Promise<string> {
    const url = `${this.apiHost}/api/v4/extract/task/${taskId}`;

    for (let i = 0; i < OpenMineruProvider.MAX_POLL_ATTEMPTS; i++) {
      await this.delay(OpenMineruProvider.POLL_INTERVAL);

      try {
        const response = await this.fetchWithAuth(url);
        const result: MineruApiResponse<SingleTaskResult> = await response.json();

        if (result.code !== 0) {
          continue;
        }

        switch (result.data.state) {
          case 'done':
            if (result.data.full_zip_url) {
              return result.data.full_zip_url;
            }
            throw new Error('MinerU 任务完成但未返回下载链接');

          case 'failed':
            throw new Error(`MinerU 解析失败: ${result.data.err_msg || '未知错误'}`);

          case 'running': {
            const progress = result.data.extract_progress;
            if (progress) {
              const pct = Math.round((progress.extracted_pages / progress.total_pages) * 60) + 20;
              this.sendProgress(Math.min(pct, 80), `解析中 (${progress.extracted_pages}/${progress.total_pages} 页)...`);
            }
            break;
          }

          case 'waiting':
            this.sendProgress(15, '排队中...');
            break;
        }
      } catch (error) {
        if (i === OpenMineruProvider.MAX_POLL_ATTEMPTS - 1) throw error;
        logger.warn(`轮询第 ${i + 1} 次失败:`, error);
      }
    }

    throw new Error(`MinerU 解析超时 (task: ${taskId})`);
  }

  // ==================== 通用工具 ====================

  /**
   * 下载 zip 文件
   */
  private async downloadZip(zipUrl: string): Promise<ArrayBuffer> {
    const response = await universalFetch(zipUrl);
    if (!response.ok) {
      throw new Error(`MinerU 下载结果失败: HTTP ${response.status}`);
    }
    return await response.arrayBuffer();
  }

  /**
   * 从 zip 包中提取 Markdown 内容
   */
  private async extractMarkdownFromZip(zipBuffer: ArrayBuffer): Promise<string> {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(zipBuffer);

    // 收集所有 .md 文件，按路径排序
    const mdFiles: { name: string; file: any }[] = [];
    for (const [name, file] of Object.entries(zip.files)) {
      if (name.endsWith('.md') && !file.dir) {
        mdFiles.push({ name, file });
      }
    }

    if (mdFiles.length > 0) {
      // 按文件名排序，拼接所有 md 内容
      mdFiles.sort((a, b) => a.name.localeCompare(b.name));
      const contents = await Promise.all(mdFiles.map(f => f.file.async('string')));
      return contents.join('\n\n');
    }

    // 降级：尝试 .txt 文件
    for (const [name, file] of Object.entries(zip.files)) {
      if (name.endsWith('.txt') && !file.dir) {
        return await file.async('string');
      }
    }

    throw new Error('MinerU 解压后未找到 Markdown 或文本文件');
  }

  /**
   * 生成唯一的 data_id
   */
  private generateDataId(): string {
    return `aetherlink_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }
}
