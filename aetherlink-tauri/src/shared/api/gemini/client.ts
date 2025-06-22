/**
 * Gemini客户端模块 - 实现
 * 负责创建和配置Gemini客户端实例
 */
import { GoogleGenAI } from '@google/genai';
import type { Model } from '../../types';
import { logApiRequest } from '../../services/LoggerService';
import axios from 'axios';
import type OpenAI from 'openai';

/**
 * 创建Gemini客户端 - 实现
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

    // 使用的SDK创建客户端
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

    // 发送简单的测试请求 - 使用SDK
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

/**
 * 获取可用的 Gemini 模型列表
 * @param model 模型配置
 * @returns 模型列表
 */
export async function fetchModels(model: Model): Promise<OpenAI.Model[]> {
  try {
    const apiKey = model.apiKey;
    const baseUrl = model.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';

    if (!apiKey) {
      throw new Error('API密钥未设置');
    }

    // 清理 baseUrl
    const cleanBaseUrl = baseUrl.replace(/\/v1beta\/?$/, '');
    const modelsUrl = `${cleanBaseUrl}/v1beta/models`;

    // 记录 API 请求
    logApiRequest('Gemini Models List', 'INFO', {
      method: 'GET',
      url: modelsUrl
    });

    // 发送请求获取模型列表
    const response = await axios.get(modelsUrl, {
      params: {
        key: apiKey
      },
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // 转换为 OpenAI 兼容格式
    const models: OpenAI.Model[] = response.data.models?.map((geminiModel: any) => ({
      id: geminiModel.name?.replace('models/', '') || geminiModel.name,
      object: 'model' as const,
      created: Date.now(),
      owned_by: 'google'
    })) || [];

    return models;
  } catch (error: any) {
    console.error('获取 Gemini 模型列表失败:', error);

    // 返回默认模型列表作为回退
    return [
      {
        id: 'gemini-pro',
        object: 'model' as const,
        created: Date.now(),
        owned_by: 'google'
      },
      {
        id: 'gemini-pro-vision',
        object: 'model' as const,
        created: Date.now(),
        owned_by: 'google'
      },
      {
        id: 'gemini-1.5-pro',
        object: 'model' as const,
        created: Date.now(),
        owned_by: 'google'
      },
      {
        id: 'gemini-1.5-flash',
        object: 'model' as const,
        created: Date.now(),
        owned_by: 'google'
      }
    ];
  }
}