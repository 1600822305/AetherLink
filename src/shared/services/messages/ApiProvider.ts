/**
 * ApiProvider - API 提供者注册表
 * 参考 Cherry Studio 架构重构
 * 
 * 使用 AiProvider 类处理所有 API 调用
 */

import AiProvider, { modelToProvider } from '../../aiCore/AiProvider';
import type { Model } from '../../types';
import { getStreamOutputSetting } from '../../utils/settingsUtils';
import store from '../../store';

// 类型定义
interface ProviderConfig {
  id: string;
  apiKey?: string;
  apiKeys?: Array<{ id: string; key: string; name?: string }>;
  keyManagement?: { strategy?: string };
}

// 简化的 EnhancedApiProvider 类
class EnhancedApiProvider {
  private keyIndex = 0;
  
  getNextAvailableKey(config: ProviderConfig): { id: string; key: string; name?: string } | null {
    if (!config.apiKeys || config.apiKeys.length === 0) {
      return null;
    }
    const key = config.apiKeys[this.keyIndex % config.apiKeys.length];
    this.keyIndex++;
    return key;
  }
}

// 获取实际的 Provider 类型
function getActualProviderType(model: Model): string {
  return model.provider || 'openai';
}

// ModelComboProvider 占位（如果需要）
class ModelComboProvider {
  constructor(_model: Model) {}
  sendChatMessage(_messages: any[], _options?: any): Promise<any> {
    throw new Error('ModelComboProvider 暂不支持');
  }
}

// 测试连接
async function testConnection(_model: Model): Promise<boolean> {
  return true;
}

/**
 * 获取模型对应的供应商配置
 */
function getProviderConfig(model: Model): ProviderConfig | null {
  try {
    const state = store.getState() as any;
    const providers = state.settings?.providers;

    if (!providers || !Array.isArray(providers)) {
      return null;
    }

    const provider = providers.find((p: ProviderConfig) => p.id === model.provider);
    return provider || null;
  } catch (error) {
    console.error('[ApiProvider] 获取供应商配置失败:', error);
    return null;
  }
}

/**
 * 创建 AiProvider 包装器
 * 让 AiProvider 兼容旧的 sendChatMessage 接口
 */
function createAiProviderWrapper(model: Model): any {
  const provider = modelToProvider(model);
  const aiProvider = new AiProvider(provider);

  return {
    sendChatMessage: async (messages: any[], options?: any) => {
      // 从 localStorage 读取 MCP 模式（默认 prompt 模式，与参考项目一致）
      let mcpMode: 'prompt' | 'function' = 'prompt';
      try {
        const savedMode = localStorage.getItem('mcp_mode');
        console.log(`[ApiProvider] 🔍 localStorage mcp_mode 原始值:`, savedMode);
        if (savedMode === 'prompt' || savedMode === 'function') {
          mcpMode = savedMode;
        }
      } catch (e) { 
        console.log(`[ApiProvider] ❌ 读取 localStorage 失败:`, e);
      }

      // 🔧 从设置中读取流式输出配置
      const streamOutput = options?.stream !== undefined ? options.stream : getStreamOutputSetting();
      
      console.log(`[ApiProvider] 使用 AiProvider - Model: ${model.id}, MCP工具数量: ${options?.mcpTools?.length || 0}, MCP模式: ${mcpMode}, 流式: ${streamOutput}`);

      const startTime = Date.now();

      try {
        const result = await aiProvider.completions({
          callType: 'chat',
          messages: messages.map((m, i) => ({
            id: m.id || `msg-${i}`,
            role: m.role,
            content: typeof m.content === 'string' ? m.content : '',
          })),
          assistant: {
            id: 'default',
            model: model,
            prompt: options?.systemPrompt,
          },
          streamOutput: streamOutput,  // 🔧 使用设置中的值
          mcpTools: options?.mcpTools,
          mcpMode: mcpMode,
          onChunk: options?.onChunk,
          abortSignal: options?.signal || options?.abortSignal,
        });

        const content = result.getText();
        const reasoning = result.getReasoning();
        const reasoningTime = reasoning ? Date.now() - startTime : undefined;

        return {
          content,
          reasoning,
          reasoningTime,
        };
      } catch (error) {
        console.error('[ApiProvider] completions 错误:', error);
        throw error;
      }
    }
  };
}

/**
 * 创建增强的 Provider 包装器，支持多 Key 负载均衡
 */
function createEnhancedProvider(model: Model, providerConfig: ProviderConfig | null): any {
  // 如果没有多 Key 配置，直接使用 AiProvider
  if (!providerConfig?.apiKeys || providerConfig.apiKeys.length === 0) {
    console.log(`[ApiProvider] 📝 单 Key 模式`);
    return createAiProviderWrapper(model);
  }

  console.log(`[ApiProvider] 🚀 多 Key 模式，${providerConfig.apiKeys.length} 个 Key`);

  const enhancedApiProvider = new EnhancedApiProvider();

  return {
    sendChatMessage: async (messages: any[], options?: any) => {
      const maxRetries = 3;
      let lastError: string = '';

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        const selectedKey = enhancedApiProvider.getNextAvailableKey(providerConfig);
        
        if (!selectedKey) {
          lastError = '没有可用的 API Key';
          break;
        }

        console.log(`[ApiProvider] 🔑 [尝试 ${attempt + 1}] 使用 Key: ${selectedKey.name || selectedKey.id.substring(0, 8)}`);

        try {
          const modelWithKey = { ...model, apiKey: selectedKey.key };
          const wrapper = createAiProviderWrapper(modelWithKey);
          const result = await wrapper.sendChatMessage(messages, options);
          
          console.log(`[ApiProvider] ✅ 成功`);
          return result;

        } catch (error) {
          lastError = error instanceof Error ? error.message : String(error);
          console.error(`[ApiProvider] ❌ 失败:`, lastError);

          if (attempt < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
          }
        }
      }

      throw new Error(`所有 API Key 调用失败: ${lastError}`);
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
    if (providerType === 'openai' && shouldUseResponsesAPI(model)) {
      console.log(`[ApiProvider] 🚀 模型 ${model.id} 支持 Responses API`);
    }

    // 🔧 使用 AiProvider，支持多 Key 动态切换
    return createEnhancedProvider(model, providerConfig);
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