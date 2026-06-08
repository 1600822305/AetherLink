import type { Model } from '../../types';
import type { ModelProvider } from '../../config/defaultModels';
import { getActualProviderType, testConnection } from '../ai/ProviderFactory';
import { OpenAIProvider } from '../../api/openai';
import { OpenAIAISDKProvider } from '../../api/openai-aisdk';
import { AnthropicAISDKProvider } from '../../api/anthropic-aisdk';
import { GeminiAISDKProvider } from '../../api/gemini-aisdk';
import { DashScopeProvider } from '../../api/dashscope/provider';
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
 * 根据 Provider 类型创建对应的 Provider 实例
 */
function createProviderInstance(model: Model, providerType: string): any {
  switch (providerType) {
    case 'anthropic':
    case 'anthropic-aisdk':
      // 统一使用 AI SDK Anthropic Provider
      return new AnthropicAISDKProvider(model);
    case 'gemini':
    case 'gemini-aisdk':
      // 统一使用 AI SDK Gemini Provider
      return new GeminiAISDKProvider(model);
    case 'openai-aisdk':
      return new OpenAIAISDKProvider(model);
    case 'openai-response':
      return new OpenAIResponseProvider(model);
    case 'dashscope':
      return new DashScopeProvider(model);
    default:
      return new OpenAIProvider(model);
  }
}

/**
 * 创建增强的 Provider 包装器，支持多 Key 负载均衡
 */
function createEnhancedProvider(model: Model, providerConfig: ModelProvider | null, providerType: string) {
  // 如果没有多 Key 配置，创建单 Key 的 Provider
  if (!providerConfig?.apiKeys || providerConfig.apiKeys.length === 0) {
    console.log(`[ApiProvider] 📝 单 Key 模式，直接创建 Provider`);
    return createProviderInstance(model, providerType);
  }

  console.log(`[ApiProvider] 🚀 多 Key 模式，支持 ${providerConfig.apiKeys.length} 个 Key，策略: ${providerConfig.keyManagement?.strategy || 'round_robin'}`);

  const enhancedApiProvider = new EnhancedApiProvider();

  // 🔧 关键：返回一个虚拟 Provider 对象，每次调用时动态选择 Key
  return {
    sendChatMessage: async (messages: any[], options?: any) => {
      const maxRetries = 3;
      const retryDelay = 1000;
      let lastError: string = '';

      // 🔧 每次请求都重新选择 Key，实现真正的负载均衡
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        const selectedKey = enhancedApiProvider.getNextAvailableKey(providerConfig);
        
        if (!selectedKey) {
          lastError = '没有可用的 API Key';
          console.error(`[ApiProvider] ❌ ${lastError}`);
          break;
        }

        console.log(`[ApiProvider] 🔑 [第${attempt + 1}次尝试] 使用 Key: ${selectedKey.name || selectedKey.id.substring(0, 8)}`);

        try {
          // 🔧 每次请求时动态创建 Provider，使用当前选中的 Key
          const modelWithKey = {
            ...model,
            apiKey: selectedKey.key
          };

          const provider = createProviderInstance(modelWithKey, providerType);

          // 🔧 直接调用并返回，让流式回调能实时工作
          const result = await provider.sendChatMessage(messages, options);
          
          console.log(`[ApiProvider] ✅ Key ${selectedKey.name || selectedKey.id.substring(0, 8)} 调用成功`);
          return result;

        } catch (error) {
          lastError = error instanceof Error ? error.message : String(error);
          console.error(`[ApiProvider] ❌ Key ${selectedKey.name || selectedKey.id.substring(0, 8)} 调用失败:`, lastError);

          // 如果不是最后一次尝试，等待后重试
          if (attempt < maxRetries - 1) {
            const delay = retryDelay * (attempt + 1);
            console.log(`[ApiProvider] ⏳ 等待 ${delay}ms 后重试...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }

      // 所有 Key 都失败了
      throw new Error(`所有 API Key 调用失败。最后错误: ${lastError}`);
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
 * 优先级：供应商配置 > 模型配置 > 默认关闭
 */
function shouldUseResponsesAPI(model: Model): boolean {
  // 1. 检查供应商级别的 useResponsesAPI 设置
  const providerConfig = getProviderConfig(model);
  if (providerConfig?.useResponsesAPI === true) {
    console.log(`[ApiProvider] 供应商 ${providerConfig.name} 启用了 Responses API`);
    return true;
  }

  // 2. 检查模型级别是否明确启用了 Responses API
  if ((model as any).useResponsesAPI === true) {
    console.log(`[ApiProvider] 模型 ${model.id} 启用了 Responses API`);
    return true;
  }

  // 默认关闭 Responses API（兼容更多 OpenAI 兼容服务）
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
    
    console.log(`[ApiProvider] 📊 获取供应商配置:`, {
      modelId: model.id,
      modelProvider: model.provider,
      modelApiKey: model.apiKey ? `${model.apiKey.substring(0, 10)}...` : 'undefined',
      providerConfigExists: !!providerConfig,
      providerConfigId: providerConfig?.id,
      hasApiKeys: !!(providerConfig?.apiKeys && providerConfig.apiKeys.length > 0),
      apiKeysCount: providerConfig?.apiKeys?.length || 0,
      hasSingleApiKey: !!providerConfig?.apiKey,
      keyManagementStrategy: providerConfig?.keyManagement?.strategy
    });

    // 获取实际的 Provider 类型
    const providerType = getActualProviderType(model);

    // 🔧 特殊处理：模型组合不支持多 Key
    if (providerType === 'model-combo') {
      return new ModelComboProvider(model);
    }

    // 🔧 检查是否需要使用 OpenAI Responses API
    let actualProviderType = providerType;
    if (providerType === 'openai' && shouldUseResponsesAPI(model)) {
      console.log(`[ApiProvider] 🚀 自动使用 OpenAI Responses API for ${model.id}`);
      actualProviderType = 'openai-response';
    }

    // 🔧 使用新的 createEnhancedProvider，支持多 Key 动态切换
    return createEnhancedProvider(model, providerConfig, actualProviderType);
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