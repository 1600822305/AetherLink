/**
 * Gemini 嵌入服务
 * 专门处理 Gemini 模型的向量嵌入功能
 */
import { GoogleGenAI } from '@google/genai';
import type { Model } from '../../types';
import { logApiRequest, logApiResponse, log } from '../../services/LoggerService';
import { withRetry } from '../../utils/retryUtils';
import { isEmbeddingModel } from '../../config/models';
import { getEmbeddingDimensions as getConfigDimensions } from '../../config/embeddingModels';
import { createClient } from './client';

/**
 * 嵌入请求参数
 */
export interface EmbeddingParams {
  text: string;
  model?: Model;
  taskType?: 'RETRIEVAL_QUERY' | 'RETRIEVAL_DOCUMENT' | 'SEMANTIC_SIMILARITY' | 'CLASSIFICATION' | 'CLUSTERING';
  title?: string;
}

/**
 * 嵌入响应结果
 */
export interface EmbeddingResult {
  embedding: number[];
  dimensions: number;
  model: string;
}

/**
 * Gemini 嵌入服务类
 */
export class GeminiEmbeddingService {
  private sdk: GoogleGenAI;
  private model: Model;
  private embeddingCache = new Map<string, EmbeddingResult>();
  private dimensionCache = new Map<string, number>();

  constructor(model: Model) {
    this.model = model;
    this.sdk = createClient(model);
  }

  /**
   * 检查模型是否支持嵌入
   */
  public isEmbeddingSupported(): boolean {
    return isEmbeddingModel(this.model) || this.model.id.includes('embedding');
  }

  /**
   * 获取文本的向量嵌入
   */
  public async getEmbedding(params: EmbeddingParams): Promise<EmbeddingResult> {
    try {
      const { text, taskType = 'SEMANTIC_SIMILARITY', title } = params;
      const modelId = params.model?.id || this.model.id;

      // 检查缓存
      const cacheKey = `${modelId}:${taskType}:${text}`;
      if (this.embeddingCache.has(cacheKey)) {
        return this.embeddingCache.get(cacheKey)!;
      }

      // 检查模型是否支持嵌入
      if (!this.isEmbeddingSupported()) {
        throw new Error(`模型 ${modelId} 不支持嵌入功能`);
      }

      // 记录 API 请求
      logApiRequest('Gemini Embedding', 'INFO', {
        method: 'POST',
        model: modelId,
        textLength: text.length,
        taskType,
        hasTitle: !!title
      });

      // 构建请求内容
      const content = {
        role: 'user' as const,
        parts: [{ text }]
      };

      // 构建请求参数
      const requestParams: any = {
        model: modelId,
        contents: [content]
      };

      // 添加任务类型（如果支持）
      if (taskType && taskType !== 'SEMANTIC_SIMILARITY') {
        requestParams.taskType = taskType;
      }

      // 添加标题（如果提供）
      if (title) {
        requestParams.title = title;
      }

      // 发送嵌入请求，添加重试机制
      const result = await withRetry(
        () => this.sdk.models.embedContent(requestParams),
        'Gemini Embedding API',
        3 // 最多重试3次
      );

      // 提取嵌入向量
      const embedding = result.embeddings?.[0]?.values;
      if (!embedding || !Array.isArray(embedding)) {
        throw new Error('Gemini 嵌入响应格式无效');
      }

      const embeddingResult: EmbeddingResult = {
        embedding,
        dimensions: embedding.length,
        model: modelId
      };

      // 缓存结果
      this.embeddingCache.set(cacheKey, embeddingResult);

      // 记录 API 响应
      logApiResponse('Gemini Embedding', 200, {
        model: modelId,
        dimensions: embedding.length,
        embeddingLength: embedding.length
      });

      return embeddingResult;
    } catch (error: any) {
      log('ERROR', `Gemini 嵌入生成失败: ${error.message || '未知错误'}`, {
        model: params.model?.id || this.model.id,
        textLength: params.text.length,
        error
      });
      throw error;
    }
  }

  /**
   * 获取模型的嵌入维度
   */
  public async getEmbeddingDimensions(model?: Model): Promise<number> {
    const targetModel = model || this.model;
    const modelId = targetModel.id;

    try {
      // 检查缓存
      if (this.dimensionCache.has(modelId)) {
        return this.dimensionCache.get(modelId)!;
      }

      // 检查模型是否支持嵌入
      if (!this.isEmbeddingSupported()) {
        throw new Error(`模型 ${modelId} 不支持嵌入功能`);
      }

      // 使用测试文本获取真实维度
      const testResult = await this.getEmbedding({
        text: 'test',
        model: targetModel,
        taskType: 'SEMANTIC_SIMILARITY'
      });

      const dimensions = testResult.dimensions;

      // 缓存维度
      this.dimensionCache.set(modelId, dimensions);

      return dimensions;
    } catch (error: any) {
      log('WARN', `获取 Gemini 模型维度失败，使用配置默认值: ${error.message}`, {
        model: modelId,
        error
      });

      // 回退到配置文件中的维度
      const configDimensions = getConfigDimensions(modelId);
      this.dimensionCache.set(modelId, configDimensions);
      return configDimensions;
    }
  }

  /**
   * 批量获取嵌入
   */
  public async getBatchEmbeddings(
    texts: string[],
    options?: {
      taskType?: EmbeddingParams['taskType'];
      batchSize?: number;
    }
  ): Promise<EmbeddingResult[]> {
    const { taskType = 'SEMANTIC_SIMILARITY', batchSize = 10 } = options || {};
    const results: EmbeddingResult[] = [];

    // 分批处理
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchPromises = batch.map(text =>
        this.getEmbedding({ text, taskType })
      );

      try {
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      } catch (error) {
        log('ERROR', `批量嵌入处理失败，批次 ${Math.floor(i / batchSize) + 1}`, {
          batchStart: i,
          batchSize: batch.length,
          error
        });
        throw error;
      }
    }

    return results;
  }

  /**
   * 清除缓存
   */
  public clearCache(): void {
    this.embeddingCache.clear();
    this.dimensionCache.clear();
  }

  /**
   * 获取缓存统计
   */
  public getCacheStats(): { embeddingCacheSize: number; dimensionCacheSize: number } {
    return {
      embeddingCacheSize: this.embeddingCache.size,
      dimensionCacheSize: this.dimensionCache.size
    };
  }
}

/**
 * 创建 Gemini 嵌入服务实例的工厂函数
 */
export function createGeminiEmbeddingService(model: Model): GeminiEmbeddingService {
  return new GeminiEmbeddingService(model);
}

/**
 * 快速获取 Gemini 模型嵌入的便捷函数
 */
export async function getGeminiEmbedding(
  text: string,
  model: Model,
  options?: {
    taskType?: EmbeddingParams['taskType'];
    title?: string;
  }
): Promise<number[]> {
  const service = createGeminiEmbeddingService(model);
  const result = await service.getEmbedding({
    text,
    model,
    taskType: options?.taskType,
    title: options?.title
  });
  return result.embedding;
}

/**
 * 快速获取 Gemini 模型维度的便捷函数
 */
export async function getGeminiEmbeddingDimensions(model: Model): Promise<number> {
  const service = createGeminiEmbeddingService(model);
  return service.getEmbeddingDimensions(model);
}
