import type { Model } from '../../types';
import { getActualProviderType, testConnection } from '../ProviderFactory';
import { OpenAIProvider } from '../../api/openai';
import { OpenAIAISDKProvider } from '../../api/openai-aisdk';
import { AnthropicProvider } from '../../api/anthropic';
import GeminiProvider from '../../api/gemini/provider';
import { ModelComboProvider } from './ModelComboProvider';

/**
 * API提供商注册表 - 修复版本，避免重复请求
 * 负责管理和获取API服务提供商
 */
export const ApiProviderRegistry = {
  /**
   * 获取API提供商 - 返回Provider实例而不是API模块
   * @param model 模型配置
   * @returns API提供商实例
   */
  get(model: Model) {
    // 直接创建Provider实例，避免通过API模块的双重调用
    const providerType = getActualProviderType(model);

    switch (providerType) {
      case 'model-combo':
        // 返回模型组合专用的Provider
        return new ModelComboProvider(model);
      case 'anthropic':
        return new AnthropicProvider(model);
      case 'gemini':
        return new GeminiProvider({
          id: model.id,
          name: model.name || 'Gemini',
          apiKey: model.apiKey,
          apiHost: model.baseUrl || 'https://generativelanguage.googleapis.com/v1beta',
          models: [{ id: model.id }]
        });
      case 'openai-aisdk':
        return new OpenAIAISDKProvider(model);
      case 'azure-openai':
      case 'openai':
      case 'deepseek':
      case 'google':
      case 'grok':
      case 'zhipu':
      case 'siliconflow':
      case 'volcengine':
      default:
        return new OpenAIProvider(model);
    }
  },

  /**
   * 测试API连接 - 直接委托给ProviderFactory
   * @param model 模型配置
   * @returns 连接是否成功
   */
  async testConnection(model: Model): Promise<boolean> {
    return await testConnection(model);
  }
};

export default ApiProviderRegistry;