/**
 * Provider 工厂函数
 * 根据模型配置创建相应的 Provider 实例
 */
import { OpenAIProvider } from './openai/provider';
import { OpenAIAISDKProvider } from './openai-aisdk/provider';
import type { Model } from '../types';

/**
 * 创建 Provider 实例
 * @param model 模型配置
 * @returns Provider 实例
 */
export function createProvider(model: Model): any {
  const providerType = model.providerType || model.provider;
  
  console.log(`[ProviderFactory] 创建 Provider，类型: ${providerType}, 模型: ${model.id}`);
  
  switch (providerType) {
    case 'openai':
      return new OpenAIProvider(model);
      
    case 'openai-aisdk':
      return new OpenAIAISDKProvider(model);
      
    // 可以在这里添加其他供应商
    case 'anthropic':
      // TODO: 实现 Anthropic Provider
      throw new Error('Anthropic Provider 尚未实现');
      
    case 'gemini':
      // TODO: 实现 Gemini Provider
      throw new Error('Gemini Provider 尚未实现');
      
    default:
      // 默认使用 OpenAI Provider
      console.warn(`[ProviderFactory] 未知的供应商类型: ${providerType}，使用默认 OpenAI Provider`);
      return new OpenAIProvider(model);
  }
}

/**
 * 检查供应商是否支持流式优化
 * @param model 模型配置
 * @returns 是否支持流式优化
 */
export function supportsStreamOptimization(model: Model): boolean {
  const providerType = model.providerType || model.provider;
  return providerType === 'openai-aisdk';
}

/**
 * 获取供应商显示名称
 * @param model 模型配置
 * @returns 供应商显示名称
 */
export function getProviderDisplayName(model: Model): string {
  const providerType = model.providerType || model.provider;
  
  switch (providerType) {
    case 'openai':
      return 'OpenAI (标准)';
    case 'openai-response':
      return 'OpenAI (Responses API)';
    case 'openai-aisdk':
      return 'OpenAI (AI SDK)';
    case 'anthropic':
      return 'Anthropic';
    case 'gemini':
      return 'Gemini';
    case 'grok':
      return 'xAI (Grok)';
    case 'deepseek':
      return 'DeepSeek';
    case 'zhipu':
      return '智谱AI';
    case 'siliconflow':
      return '硅基流动';
    case 'volcengine':
      return '火山引擎';
    default:
      return providerType || 'Unknown';
  }
}
