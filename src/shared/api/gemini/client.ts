/**
 * Gemini客户端模块 - 电脑版实现
 * 负责创建和配置Gemini客户端实例
 */
import { GoogleGenAI } from '@google/genai';
import type { Model } from '../../types';
import { logApiRequest } from '../../services/LoggerService';

/**
 * 创建Gemini客户端 - 电脑版实现
 * @param model 模型配置
 * @returns Gemini客户端实例
 */
export function createClient(model: Model): GoogleGenAI {
  try {
    const apiKey = model.apiKey;
    if (!apiKey) {
      console.error('[Gemini createClient] 错误: 未提供API密钥');
      throw new Error('未提供Gemini API密钥，请在设置中配置');
    }

    const baseUrl = model.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
    // 确保 baseUrl 不以 /v1beta 结尾，避免重复
    const cleanBaseUrl = baseUrl.replace(/\/v1beta\/?$/, '');
    console.log(`[Gemini createClient] 创建客户端, 模型ID: ${model.id}, baseURL: ${cleanBaseUrl}`);

    // 使用电脑版的SDK创建客户端
    const client = new GoogleGenAI({
      vertexai: false,
      apiKey: apiKey,
      httpOptions: { baseUrl: cleanBaseUrl }
    });
    console.log(`[Gemini createClient] 客户端创建成功`);
    return client;

  } catch (error) {
    console.error('[Gemini createClient] 创建客户端失败:', error);
    throw error;
  }
}

/**
 * 测试API连接
 * @param model 模型配置
 * @returns 连接是否成功
 */
export async function testConnection(model: Model): Promise<boolean> {
  try {
    const apiKey = model.apiKey;
    const baseUrl = model.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
    const cleanBaseUrl = baseUrl.replace(/\/v1beta\/?$/, '');
    const modelId = model.id;

    if (!apiKey) {
      throw new Error('API密钥未设置');
    }

    // 创建Gemini客户端实例
    const genAI = createClient(model);

    // 记录API请求
    logApiRequest('Gemini Connection Test', 'INFO', {
      method: 'POST',
      model: modelId,
      baseUrl: cleanBaseUrl
    });

    // 发送简单的测试请求 - 使用电脑版SDK
    const result = await genAI.models.generateContent({
      model: modelId,
      contents: [{ role: 'user', parts: [{ text: 'Hello' }] }],
      config: { maxOutputTokens: 1 }
    });

    return result.text !== undefined;
  } catch (error) {
    console.error('Gemini API连接测试失败:', error);
    return false;
  }
}

/**
 * 检查模型是否支持多模态
 * @param model 模型配置
 * @returns 是否支持多模态
 */
export function supportsMultimodal(model: Model): boolean {
  const modelId = model.id.toLowerCase();
  return modelId.includes('gemini') || model.capabilities?.multimodal === true;
}

/**
 * 检查模型是否支持网页搜索
 * @param model 模型配置
 * @returns 是否支持网页搜索
 */
export function supportsWebSearch(model: Model): boolean {
  return model.capabilities?.webSearch === true;
}

/**
 * 检查模型是否支持推理
 * @param model 模型配置
 * @returns 是否支持推理
 */
export function supportsReasoning(model: Model): boolean {
  return model.capabilities?.reasoning === true;
}