import type { Model } from '../../types';
import type { ModelProvider } from '../../config/defaultModels';
import { getActualProviderType, testConnection } from '../ProviderFactory';
import { OpenAIProvider } from '../../api/openai';
import { OpenAIAISDKProvider } from '../../api/openai-aisdk';
import { AnthropicProvider } from '../../api/anthropic';
import GeminiProvider from '../../api/gemini/provider';
import { ModelComboProvider } from './ModelComboProvider';
import { EnhancedApiProvider } from '../network/EnhancedApiProvider';
import { OpenAIResponseProvider } from '../../providers/OpenAIResponseProvider';
import store from '../../store';

/**
 * 获取模型对应的供应商配置
 */
function getProviderConfig(model: Model): ModelProvider | null {
  try {
    const state = store.getState();
    const providers = state.settings.providers;

    if (!providers || !Array.isArray(providers)) {
      return null;
    }

    // 根据模型的 provider 字段查找对应的供应商
    const provider = providers.find((p: ModelProvider) => p.id === model.provider);
    return provider || null;
  } catch (error) {
    console.error('[ApiProvider] 获取供应商配置失败:', error);
    return null;
  }
}

/**
 * 创建增强的 Provider 包装器，支持多 Key 负载均衡
 */
function createEnhancedProvider(originalProvider: any, model: Model, providerConfig: ModelProvider | null) {
  // 如果没有多 Key 配置，直接返回原始 Provider
  if (!providerConfig?.apiKeys || providerConfig.apiKeys.length === 0) {
    return originalProvider;
  }

  console.log(`[ApiProvider] 🚀 为 ${model.provider} 创建增强 Provider，支持 ${providerConfig.apiKeys.length} 个 Key，策略: ${providerConfig.keyManagement?.strategy || 'round_robin'}`);

  // 创建增强的 Provider 包装器
  return {
    ...originalProvider,
    sendChatMessage: async (messages: any[], options?: any) => {
      const enhancedApiProvider = new EnhancedApiProvider();

      // 包装原始的 sendChatMessage 调用，接受 apiKey 参数
      const wrappedApiCall = async (apiKey: string) => {
        // 创建一个新的模型对象，使用指定的 API Key
        const modelWithNewKey = {
          ...model,
          apiKey: apiKey
        };

        // 创建新的 Provider 实例，使用新的 API Key
        let providerWithNewKey: any;
        const providerType = getActualProviderType(model);

        switch (providerType) {
          case 'anthropic':
            providerWithNewKey = new AnthropicProvider(modelWithNewKey);
            break;
          case 'gemini':
            providerWithNewKey = new GeminiProvider({
              id: modelWithNewKey.id,
              name: modelWithNewKey.name || 'Gemini',
              apiKey: modelWithNewKey.apiKey,
              apiHost: modelWithNewKey.baseUrl || 'https://generativelanguage.googleapis.com/v1beta',
              models: [{ id: modelWithNewKey.id }]
            });
            break;
          case 'openai-aisdk':
            providerWithNewKey = new OpenAIAISDKProvider(modelWithNewKey);
            break;
          default:
            providerWithNewKey = new OpenAIProvider(modelWithNewKey);
            break;
        }

        return await providerWithNewKey.sendChatMessage(messages, options);
      };

      // 使用增强的 API 提供商进行调用
      const result = await enhancedApiProvider.callWithMultiKey(
        providerConfig,
        model,
        wrappedApiCall,
        {
          maxRetries: 3,
          retryDelay: 1000,
          enableFallback: true,
          onKeyUsed: (keyId: string, success: boolean, error?: string) => {
            const keyName = providerConfig.apiKeys?.find(k => k.id === keyId)?.name || keyId;
            console.log(`[ApiProvider] 🔑 ${keyName} ${success ? '✅ 成功' : '❌ 失败'}${error ? `: ${error}` : ''}`);
          }
        }
      );

      if (!result.success) {
        throw new Error(result.error || '多 Key API 调用失败');
      }

      return result.data;
    }
  };
}

/**
 * 检查是否为视频生成模型
 */
function isVideoGenerationModel(model: Model): boolean {
  // 检查模型类型
  if (model.modelTypes && model.modelTypes.includes('video_gen' as any)) {
    return true;
  }

  // 检查视频生成标志
  if ((model as any).videoGeneration || (model.capabilities as any)?.videoGeneration) {
    return true;
  }

  // 基于模型ID检测
  return model.id.includes('HunyuanVideo') ||
         model.id.includes('Wan-AI/Wan2.1-T2V') ||
         model.id.includes('Wan-AI/Wan2.1-I2V') ||
         model.id.toLowerCase().includes('video');
}

/**
 * 检查是否应该使用 OpenAI Responses API
 */
function shouldUseResponsesAPI(model: Model): boolean {
  // 检查模型是否支持 Responses API
  const responsesAPIModels = [
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4o-2024-11-20',
    'gpt-4o-2024-08-06',
    'gpt-4o-mini-2024-07-18',
    'o1-preview',
    'o1-mini'
  ];

  // 检查模型ID是否在支持列表中
  if (responsesAPIModels.includes(model.id)) {
    return true;
  }

  // 检查是否明确启用了 Responses API
  if ((model as any).useResponsesAPI === true) {
    return true;
  }

  // 检查全局设置（暂时跳过，因为移动端设置结构不同）
  // 可以在后续版本中添加全局 Responses API 开关

  return false;
}

/**
 * API提供商注册表 - 修复版本，避免重复请求
 * 负责管理和获取API服务提供商
 */
export const ApiProviderRegistry = {
  /**
   * 获取API提供商 - 返回Provider实例而不是API模块，支持多 Key 负载均衡
   * @param model 模型配置
   * @returns API提供商实例
   */
  get(model: Model) {
    // 🎬 检查是否为视频生成模型
    if (isVideoGenerationModel(model)) {
      console.log(`[ApiProviderRegistry] 检测到视频生成模型: ${model.id}`);
      throw new Error(`模型 ${model.name || model.id} 是视频生成模型，不支持聊天对话。请使用专门的视频生成功能。`);
    }

    // 获取供应商配置
    const providerConfig = getProviderConfig(model);

    // 直接创建Provider实例，避免通过API模块的双重调用
    const providerType = getActualProviderType(model);

    let originalProvider: any;

    switch (providerType) {
      case 'model-combo':
        // 返回模型组合专用的Provider（不支持多 Key）
        return new ModelComboProvider(model);
      case 'anthropic':
        originalProvider = new AnthropicProvider(model);
        break;
      case 'gemini':
        originalProvider = new GeminiProvider({
          id: model.id,
          name: model.name || 'Gemini',
          apiKey: model.apiKey,
          apiHost: model.baseUrl || 'https://generativelanguage.googleapis.com/v1beta',
          models: [{ id: model.id }]
        });
        break;
      case 'openai-aisdk':
        originalProvider = new OpenAIAISDKProvider(model);
        break;
      case 'openai-response':
        console.log(`[ApiProvider] 🚀 使用 OpenAI Responses API for ${model.id}`);
        originalProvider = new OpenAIResponseProvider(model);
        break;
      case 'azure-openai':
      case 'openai':
      case 'deepseek':
      case 'google':
      case 'grok':
      case 'zhipu':
      case 'siliconflow':
      case 'volcengine':
      default:
        // 检查是否应该使用 OpenAI Responses API
        if (providerType === 'openai' && shouldUseResponsesAPI(model)) {
          console.log(`[ApiProvider] 🚀 自动使用 OpenAI Responses API for ${model.id}`);
          originalProvider = new OpenAIResponseProvider(model);
        } else {
          originalProvider = new OpenAIProvider(model);
        }
        break;
    }

    // 创建增强的 Provider（支持多 Key 负载均衡）
    return createEnhancedProvider(originalProvider, model, providerConfig);
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