/**
 * Gemini AI SDK 嵌入服务
 * 使用 @ai-sdk/google 实现嵌入向量生成
 */
import type { Model } from '../../types';
import { getEmbeddingDimensions } from '../../config/embeddingModels';
import { createLogger } from '../../services/infra/logger';

const logger = createLogger('GeminiEmbeddingService');


/**
 * Gemini 嵌入服务接口
 */
export interface GeminiEmbeddingService {
  getEmbedding(text: string, model: Model): Promise<number[]>;
  getEmbeddings(texts: string[], model: Model): Promise<number[][]>;
  getEmbeddingDimensions(model: Model): Promise<number>;
}

/**
 * 创建 Gemini 嵌入服务
 */
export function createGeminiEmbeddingService(model: Model): GeminiEmbeddingService {
  return {
    /**
     * 获取单个文本的嵌入向量
     */
    async getEmbedding(text: string, embeddingModel: Model): Promise<number[]> {
      try {
        const apiKey = embeddingModel.apiKey || model.apiKey;
        const baseUrl = embeddingModel.baseUrl || model.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
        
        // 确定嵌入模型 ID
        const embeddingModelId = embeddingModel.id || 'text-embedding-004';
        
        // 构建请求 URL
        const url = `${baseUrl}/models/${embeddingModelId}:embedContent?key=${apiKey}`;
        
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: `models/${embeddingModelId}`,
            content: {
              parts: [{ text }]
            }
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Gemini 嵌入请求失败: ${response.status} ${errorText}`);
        }

        const data = await response.json();
        
        if (data.embedding?.values) {
          return data.embedding.values;
        }
        
        throw new Error('Gemini 嵌入响应格式错误');
      } catch (error) {
        logger.error('获取嵌入失败:', error);
        throw error;
      }
    },

    /**
     * 批量获取嵌入向量
     */
    async getEmbeddings(texts: string[], embeddingModel: Model): Promise<number[][]> {
      try {
        const apiKey = embeddingModel.apiKey || model.apiKey;
        const baseUrl = embeddingModel.baseUrl || model.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
        const embeddingModelId = embeddingModel.id || 'text-embedding-004';
        
        // 构建批量请求 URL
        const url = `${baseUrl}/models/${embeddingModelId}:batchEmbedContents?key=${apiKey}`;
        
        const requests = texts.map(text => ({
          model: `models/${embeddingModelId}`,
          content: {
            parts: [{ text }]
          }
        }));

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ requests })
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Gemini 批量嵌入请求失败: ${response.status} ${errorText}`);
        }

        const data = await response.json();
        
        if (data.embeddings && Array.isArray(data.embeddings)) {
          return data.embeddings.map((e: any) => e.values);
        }
        
        throw new Error('Gemini 批量嵌入响应格式错误');
      } catch (error) {
        logger.error('批量获取嵌入失败:', error);
        throw error;
      }
    },

    /**
     * 获取嵌入模型的维度
     */
    async getEmbeddingDimensions(embeddingModel: Model): Promise<number> {
      try {
        // 首先尝试从配置获取
        const configDimensions = getEmbeddingDimensions(embeddingModel.id);
        if (configDimensions > 0) {
          return configDimensions;
        }
        
        // 如果配置中没有，通过测试请求获取
        const testVector = await this.getEmbedding('test', embeddingModel);
        return testVector.length;
      } catch (error) {
        logger.error('获取嵌入维度失败:', error);
        // 默认返回 768（text-embedding-004 的默认维度）
        return 768;
      }
    }
  };
}

/**
 * 默认导出
 */
export default createGeminiEmbeddingService;
