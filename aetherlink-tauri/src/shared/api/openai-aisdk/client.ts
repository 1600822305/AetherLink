/**
 * AI SDK OpenAI客户端
 * 使用 @ai-sdk/openai 替代原生 OpenAI 库，解决浏览器环境下的流式响应问题
 */
import { createOpenAI } from '@ai-sdk/openai';
import type { Model } from '../../types';

/**
 * 创建AI SDK OpenAI客户端
 * @param model 模型配置
 * @returns AI SDK OpenAI客户端实例
 */
export function createAISDKClient(model: Model) {
  try {
    const apiKey = model.apiKey;
    if (!apiKey) {
      console.error('[AI SDK createClient] 错误: 未提供API密钥');
      throw new Error('未提供OpenAI API密钥，请在设置中配置');
    }

    // 处理基础URL
    let baseURL = model.baseUrl || 'https://api.openai.com/v1';

    // 确保baseURL格式正确
    if (baseURL.endsWith('/')) {
      baseURL = baseURL.slice(0, -1);
    }

    // 确保baseURL包含/v1
    if (!baseURL.includes('/v1')) {
      baseURL = `${baseURL}/v1`;
    }

    console.log(`[AI SDK createClient] 创建客户端, 模型ID: ${model.id}, baseURL: ${baseURL.substring(0, 20)}...`);

    // 创建AI SDK OpenAI客户端
    const client = createOpenAI({
      apiKey,
      baseURL,
      // AI SDK 专为浏览器设计，无需 dangerouslyAllowBrowser
      // 也不会发送有问题的 x-stainless-timeout 头部
    });

    console.log(`[AI SDK createClient] 客户端创建成功`);
    return client;

  } catch (error) {
    console.error('[AI SDK createClient] 创建客户端失败:', error);
    // 创建一个后备客户端
    const fallbackClient = createOpenAI({
      apiKey: 'sk-missing-key-please-configure',
      baseURL: 'https://api.openai.com/v1'
    });
    console.warn('[AI SDK createClient] 使用后备客户端配置');
    return fallbackClient;
  }
}

/**
 * 检查是否为Azure OpenAI
 * @param model 模型配置
 * @returns 是否为Azure OpenAI
 */
export function isAzureOpenAI(model: Model): boolean {
  return Boolean((model as any).providerType === 'azure-openai' ||
         model.provider === 'azure-openai' ||
         (model.baseUrl && model.baseUrl.includes('openai.azure.com')));
}
