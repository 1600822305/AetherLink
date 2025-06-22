/**
 * Anthropic客户端模块
 * 负责创建和配置Anthropic客户端实例
 */
import Anthropic from '@anthropic-ai/sdk';
import type { Model } from '../../types';
import { logApiRequest } from '../../services/LoggerService';

/**
 * 创建Anthropic客户端
 * @param model 模型配置
 * @returns Anthropic客户端实例
 */
export function createClient(model: Model): Anthropic {
  try {
    const apiKey = model.apiKey;
    if (!apiKey) {
      console.error('[Anthropic createClient] 错误: 未提供API密钥');
      throw new Error('未提供Anthropic API密钥，请在设置中配置');
    }

    // 处理基础URL
    let baseUrl = model.baseUrl || 'https://api.anthropic.com';
    
    // 确保baseURL格式正确
    if (baseUrl.endsWith('/')) {
      baseUrl = baseUrl.slice(0, -1);
    }
    
    console.log(`[Anthropic createClient] 创建客户端, 模型ID: ${model.id}, baseURL: ${baseUrl.substring(0, 20)}...`);

    // 创建配置对象
    const config: any = {
      apiKey,
      baseURL: baseUrl
    };
    
    // 添加额外头部（如果有）
    if (model.extraHeaders) {
      config.defaultHeaders = model.extraHeaders;
      console.log(`[Anthropic createClient] 设置额外头部: ${Object.keys(model.extraHeaders).join(', ')}`);
    }
    
    // 创建客户端
    const client = new Anthropic(config);
    console.log(`[Anthropic createClient] 客户端创建成功`);
    return client;
    
  } catch (error) {
    console.error('[Anthropic createClient] 创建客户端失败:', error);
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
    const baseUrl = model.baseUrl || 'https://api.anthropic.com';
    const modelId = model.id;

    if (!apiKey) {
      throw new Error('API密钥未设置');
    }

    // 创建Anthropic客户端实例
    const client = createClient(model);

    // 记录API请求
    logApiRequest('Anthropic Connection Test', 'INFO', {
      method: 'POST',
      model: modelId,
      baseUrl
    });

    // 发送简单的测试请求
    const response = await client.messages.create({
      model: modelId,
      messages: [{ role: 'user', content: 'Hello' }],
      max_tokens: 5,
    });

    return Boolean(response.content && response.content.length > 0);
  } catch (error) {
    console.error('Anthropic API连接测试失败:', error);
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
  return modelId.includes('claude-3') || model.capabilities?.multimodal === true;
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
  const modelId = model.id.toLowerCase();
  return modelId.includes('claude-3') || model.capabilities?.reasoning === true;
} 