/**
 * 供应商工厂模块 - 参考最佳实例架构
 * 负责根据供应商类型返回适当的API处理模块
 */
import type { Model } from '../../types';
import * as openaiApi from '../../api/openai';
import { parseModelsResponse, normalizeModel } from '../../api/openai/models';
import * as anthropicApi from '../../api/anthropic-aisdk';
import * as dashscopeApi from '../../api/dashscope';
import { DashScopeProvider } from '../../api/dashscope/provider';
import { modelComboService } from './ModelComboService';
import { OpenAIAISDKProvider } from '../../api/openai-aisdk';
import { GeminiAISDKProvider } from '../../api/gemini-aisdk';
import { AnthropicAISDKProvider } from '../../api/anthropic-aisdk';
import { OpenAIResponseProvider } from '../../providers/OpenAIResponseProvider';
import { getDefaultGroupName } from '../../utils/modelUtils';
import ApiKeyManager from './ApiKeyManager';
import { universalFetch } from '../../utils/universalFetch';

/**
 * 获取实际的提供商类型 - 支持智能路由
 * @param model 模型配置
 * @returns 提供商类型
 */
export function getActualProviderType(model: Model): string {
  // 检查是否为模型组合
  if (model.provider === 'model-combo' || (model as any).isCombo) {
    console.log(`[ProviderFactory] 检测到模型组合: ${model.id}`);
    return 'model-combo';
  }

  // 优先使用providerType字段(如果存在)，否则回退到provider字段
  let providerType = model.providerType || model.provider;

  // 智能路由：只有在没有明确指定provider或provider为'auto'时才进行推断
  // 如果用户明确选择了供应商，就使用用户的选择，不进行自动推断
  if (!providerType || providerType === 'auto') {
    providerType = inferProviderFromModel(model);
  }

  console.log(`[ProviderFactory] 获取提供商类型: ${providerType}, 模型ID: ${model.id}, 原始provider: ${model.provider}`);
  return providerType;
}

/**
 * 智能推断Provider类型 - 类似最佳实例AiHubMixProvider的功能
 * @param model 模型配置
 * @returns 推断的Provider类型
 */
function inferProviderFromModel(model: Model): string {
  // 检查是否为Azure OpenAI
  if (isAzureOpenAI(model)) {
    return 'azure-openai';
  }

  // 根据模型ID推断provider类型
  const modelId = model.id.toLowerCase();

  if (modelId.includes('claude')) {
    return 'anthropic';
  }

  if (modelId.includes('gemini')) {
    return 'gemini';
  }

  if (modelId.includes('gpt') || modelId.includes('o1') || modelId.includes('davinci') || modelId.includes('curie') || modelId.includes('babbage') || modelId.includes('ada')) {
    return 'openai';
  }

  if (modelId.includes('deepseek')) {
    return 'deepseek';
  }

  if (modelId.includes('grok')) {
    return 'grok';
  }

  // 默认使用openai兼容的API
  return 'openai';
}

/**
 * 检查是否为Azure OpenAI
 * @param model 模型配置
 * @returns 是否为Azure OpenAI
 */
function isAzureOpenAI(model: Model): boolean {
  return Boolean(model.providerType === 'azure-openai' ||
         model.provider === 'azure-openai' ||
         (model.baseUrl && model.baseUrl.includes('openai.azure.com')));
}

/**
 * 获取供应商API - 支持Azure OpenAI和智能路由
 * @param model 模型配置
 * @returns 供应商API模块
 */
export function getProviderApi(model: Model): any {
  const providerType = getActualProviderType(model);

  // 扩展的Provider选择逻辑，支持Azure OpenAI和模型组合
  switch (providerType) {
    case 'model-combo':
      console.log(`[ProviderFactory] 使用模型组合API`);
      return {
        sendChatRequest: async (messages: any[], model: Model) => {
          return await handleModelComboRequest(messages, model);
        }
      };
    case 'anthropic':
      // 使用 AI SDK Anthropic Provider
      console.log(`[ProviderFactory] 使用AI SDK Anthropic API`);
      return {
        sendChatRequest: async (messages: any[], model: Model) => {
          const provider = new AnthropicAISDKProvider(model);
          return await provider.sendChatMessage(messages, {});
        },
        testConnection: async (model: Model) => {
          const provider = new AnthropicAISDKProvider(model);
          return await provider.testConnection();
        },
        fetchModels: anthropicApi.fetchModels
      };
    case 'anthropic-aisdk':
      console.log(`[ProviderFactory] 使用AI SDK Anthropic API`);
      return {
        sendChatRequest: async (messages: any[], model: Model) => {
          const provider = new AnthropicAISDKProvider(model);
          return await provider.sendChatMessage(messages, {});
        },
        testConnection: async (model: Model) => {
          const provider = new AnthropicAISDKProvider(model);
          return await provider.testConnection();
        },
        fetchModels: anthropicApi.fetchModels
      };
    case 'gemini':
      // 统一使用 AI SDK Gemini Provider
      console.log(`[ProviderFactory] 使用AI SDK Gemini API`);
      return {
        sendChatRequest: async (messages: any[], model: Model) => {
          const provider = new GeminiAISDKProvider(model);
          return await provider.sendChatMessage(messages, {});
        },
        testConnection: async (model: Model) => {
          const provider = new GeminiAISDKProvider(model);
          return await provider.testConnection();
        }
      };
    case 'azure-openai':
      // Azure OpenAI使用OpenAI兼容API，但有特殊配置
      console.log(`[ProviderFactory] 使用Azure OpenAI API`);
      return openaiApi;
    case 'openai-aisdk':
      console.log(`[ProviderFactory] 使用AI SDK OpenAI API`);
      return {
        sendChatRequest: async (messages: any[], model: Model) => {
          const provider = new OpenAIAISDKProvider(model);
          return await provider.sendChatMessage(messages, {});
        },
        testConnection: async (model: Model) => {
          const provider = new OpenAIAISDKProvider(model);
          return await provider.testConnection();
        }
      };
    case 'gemini-aisdk':
      console.log(`[ProviderFactory] 使用AI SDK Gemini API`);
      return {
        sendChatRequest: async (messages: any[], model: Model) => {
          const provider = new GeminiAISDKProvider(model);
          return await provider.sendChatMessage(messages, {});
        },
        testConnection: async (model: Model) => {
          const provider = new GeminiAISDKProvider(model);
          return await provider.testConnection();
        }
      };
    case 'dashscope':
      console.log(`[ProviderFactory] 使用 DashScope (阿里云百炼) API`);
      return {
        sendChatRequest: async (messages: any[], model: Model) => {
          const provider = new DashScopeProvider(model);
          return await provider.sendChatMessage(messages, {});
        },
        testConnection: async (model: Model) => {
          const provider = new DashScopeProvider(model);
          return await provider.testConnection();
        },
        fetchModels: dashscopeApi.fetchModels
      };
    case 'openai':
    case 'deepseek': 
    case 'google':   
    case 'grok':     
    case 'siliconflow': 
    case 'volcengine':  // 火山引擎使用OpenAI兼容API
    default:
      // 默认使用OpenAI兼容API，与最佳实例保持一致
      return openaiApi;
  }
}

/**
 * 测试API连接
 * @param model 模型配置
 * @returns 连接是否成功
 */
export async function testConnection(model: Model): Promise<boolean> {
  try {
    const api = getProviderApi(model);
    return await api.testConnection(model);
  } catch (error) {
    console.error('API连接测试失败:', error);
    return false;
  }
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
 * 发送聊天请求
 * @param messages 消息数组
 * @param model 模型配置
 * @returns 响应内容
 */
export async function sendChatRequest(
  messages: any[],
  model: Model
): Promise<string | { content: string; reasoning?: string; reasoningTime?: number }> {
  try {
    console.log(`[ProviderFactory.sendChatRequest] 开始处理请求 - 模型ID: ${model.id}, 提供商: ${model.provider}`);

    // 检查是否为视频生成模型
    if (isVideoGenerationModel(model)) {
      console.log(`[ProviderFactory.sendChatRequest] 检测到视频生成模型: ${model.id}`);
      throw new Error(`模型 ${model.name || model.id} 是视频生成模型，不支持聊天对话。请使用专门的视频生成功能。`);
    }

    // 检查模型是否有API密钥
    if (!model.apiKey && model.provider !== 'auto') {
      console.warn(`[ProviderFactory.sendChatRequest] 警告: 模型 ${model.id} 没有API密钥`);
    }

    // 强制检查：确保消息数组不为空
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      console.error('[ProviderFactory.sendChatRequest] 严重错误: 消息数组为空或无效，添加默认消息');

      // 添加一个默认的用户消息
      messages = [{
        id: 'default-' + Date.now(),
        role: 'user',
        content: '您好，请问有什么可以帮助您的？', // 使用更友好的默认消息
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        blocks: []
      }];

      console.log('[ProviderFactory.sendChatRequest] 添加默认用户消息: 您好，请问有什么可以帮助您的？');
    }

    // 记录消息数组
    console.log(`[ProviderFactory.sendChatRequest] 消息数组:`, JSON.stringify(messages.map(msg => ({
      id: msg.id,
      role: msg.role,
      content: typeof msg.content === 'string' ?
        (msg.content.length > 50 ? msg.content.substring(0, 50) + '...' : msg.content) :
        '[复杂内容]'
    }))));

    // 获取合适的API实现
    const api = getProviderApi(model);
    console.log(`[ProviderFactory.sendChatRequest] 获取API实现 - 提供商: ${model.provider}`);

    // 确保API有sendChatRequest方法
    if (!api.sendChatRequest) {
      console.error(`[ProviderFactory.sendChatRequest] 错误: API没有sendChatRequest方法`);
      throw new Error(`提供商 ${model.provider} 的API没有sendChatRequest方法`);
    }

    console.log(`[ProviderFactory.sendChatRequest] 调用API的sendChatRequest方法`);
    return await api.sendChatRequest(messages, model);
  } catch (error) {
    console.error('[ProviderFactory.sendChatRequest] 发送聊天请求失败:', error);
    throw error;
  }
}

/**
 * 检查 Key 是否在冷却期（复制ApiKeyManager的逻辑）
 */
function isKeyInCooldown(key: any): boolean {
  if (key.status !== 'error') return false;
  
  const cooldownTime = 5 * 60 * 1000; // 5分钟冷却期
  const timeSinceLastError = Date.now() - key.updatedAt;
  
  return timeSinceLastError < cooldownTime;
}

/**
 * 获取所有可用的API Keys（用于故障转移）
 * @param provider 提供商配置
 * @returns 可用的API Keys数组
 */
function getAllAvailableApiKeys(provider: any): Array<{ key: string; config: any }> {
  const availableKeys: Array<{ key: string; config: any }> = [];
  
  // 如果配置了多key，获取所有可用的keys
  if (provider.apiKeys && Array.isArray(provider.apiKeys) && provider.apiKeys.length > 0) {
    // 过滤出可用的keys（isEnabled && status === 'active' && 不在冷却期）
    const availableKeyConfigs = provider.apiKeys.filter((key: any) => 
      key.isEnabled && 
      key.status === 'active' &&
      !isKeyInCooldown(key) &&
      key.key &&
      key.key.trim().length > 0
    );
    
    availableKeyConfigs.forEach((keyConfig: any) => {
      availableKeys.push({ key: keyConfig.key, config: keyConfig });
    });
  }
  
  // 如果没有多key，回退到单key模式
  if (availableKeys.length === 0 && provider.apiKey && provider.apiKey.trim().length > 0) {
    availableKeys.push({ key: provider.apiKey, config: null });
  }
  
  return availableKeys;
}

/**
 * 从默认端点获取模型列表（支持多key故障转移）
 * @param provider 提供商配置
 * @param providerType 提供商类型
 * @returns 原始模型列表
 */
async function fetchModelsFromEndpoint(provider: any, providerType: string): Promise<any[]> {
  let rawModels: any[] = [];
  let lastError: Error | null = null;

  // 获取所有可用的API Keys（用于故障转移）
  const availableKeys = getAllAvailableApiKeys(provider);
  if (availableKeys.length === 0) {
    throw new Error('未找到可用的API Key，无法获取模型列表');
  }

  // 尝试使用每个可用的key，直到成功或全部失败
  for (let i = 0; i < availableKeys.length; i++) {
    const { key: apiKey, config: keyConfig } = availableKeys[i];
    
    try {
      console.log(`[fetchModelsFromEndpoint] 尝试使用key ${i + 1}/${availableKeys.length}: ${keyConfig?.name || apiKey.substring(0, 8)}...`);
      
      // 创建一个带有apiKey的provider副本
      const providerWithKey = {
        ...provider,
        apiKey: apiKey
      };

      // 根据提供商类型调用相应的API
      switch (providerType.toLowerCase()) {
        case 'anthropic':
          rawModels = await anthropicApi.fetchModels(providerWithKey);
          break;
        case 'gemini':
        case 'gemini-aisdk':
          // Gemini 尝试从 API 动态获取模型列表
          try {
            const geminiBaseUrl = providerWithKey.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
            const geminiModelsUrl = `${geminiBaseUrl}/models?key=${apiKey}`;
            console.log(`[fetchModelsFromEndpoint] Gemini获取模型列表: ${geminiBaseUrl}/models`);
            
            const geminiResponse = await universalFetch(geminiModelsUrl);
            if (geminiResponse.ok) {
              const geminiData = await geminiResponse.json();
              if (geminiData.models && Array.isArray(geminiData.models)) {
                // 过滤出 generateContent 支持的模型
                rawModels = geminiData.models
                  .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
                  .map((m: any) => ({
                    id: m.name?.replace('models/', '') || m.name,
                    name: m.displayName || m.name?.replace('models/', ''),
                    description: m.description || '',
                    owned_by: 'google'
                  }));
                console.log(`[fetchModelsFromEndpoint] Gemini API获取到 ${rawModels.length} 个模型`);
              }
            }
          } catch (geminiError) {
            console.warn(`[fetchModelsFromEndpoint] Gemini API获取失败，使用预设列表:`, geminiError);
          }
          
          // 如果 API 获取失败或没有模型，使用预设列表
          if (!rawModels || rawModels.length === 0) {
            console.log(`[fetchModelsFromEndpoint] Gemini使用预设模型列表`);
            rawModels = [
              { id: 'gemini-2.5-pro-preview-06-05', name: 'Gemini 2.5 Pro Preview', description: 'Gemini最新的推理模型，支持思考', owned_by: 'google' },
              { id: 'gemini-2.5-flash-preview-05-20', name: 'Gemini 2.5 Flash Preview', description: 'Gemini 2.5快速版，平衡性能与速度', owned_by: 'google' },
              { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Gemini 2.0快速版', owned_by: 'google' },
              { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite', description: 'Gemini 2.0轻量版', owned_by: 'google' },
              { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: 'Gemini 1.5专业版，支持长上下文', owned_by: 'google' },
              { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: 'Gemini 1.5快速版', owned_by: 'google' },
              { id: 'gemini-1.5-flash-8b', name: 'Gemini 1.5 Flash 8B', description: 'Gemini 1.5轻量版', owned_by: 'google' }
            ];
          }
          break;
        case 'deepseek':
          // DeepSeek使用OpenAI兼容API，失败时返回预设列表
          try {
            rawModels = await openaiApi.fetchModels(providerWithKey);
          } catch (error) {
            console.warn(`[fetchModelsFromEndpoint] DeepSeek模型获取失败，返回预设列表:`, error);
            rawModels = [
              { id: 'deepseek-chat', name: 'DeepSeek-V3', description: 'DeepSeek最新的大型语言模型，具有优秀的中文和代码能力。', owned_by: 'deepseek' },
              { id: 'deepseek-reasoner', name: 'DeepSeek-R1', description: 'DeepSeek的推理模型，擅长解决复杂推理问题。', owned_by: 'deepseek' }
            ];
          }
          break;
        case 'dashscope':
          // 阿里云百炼使用预设模型列表
          console.log(`[fetchModelsFromEndpoint] DashScope使用预设模型列表`);
          rawModels = await dashscopeApi.fetchModels(providerWithKey);
          break;
        case 'zhipu':
          // 智谱AI不支持标准的 /v1/models 接口，返回预设列表
          console.log(`[fetchModelsFromEndpoint] 智谱AI使用预设模型列表`);
          rawModels = [
            { id: 'glm-5-plus', name: 'GLM-5-Plus', description: 'GLM-5增强版，最新一代大模型', owned_by: 'zhipu' },
            { id: 'glm-5-air', name: 'GLM-5-Air', description: 'GLM-5轻量版，平衡性能与速度', owned_by: 'zhipu' },
            { id: 'glm-4-0520', name: 'GLM-4-0520', description: 'GLM-4最新版本，性能优化', owned_by: 'zhipu' },
            { id: 'glm-4-plus', name: 'GLM-4-Plus', description: 'GLM-4增强版，更强推理能力', owned_by: 'zhipu' },
            { id: 'glm-4-long', name: 'GLM-4-Long', description: 'GLM-4长文本版，支持超长上下文', owned_by: 'zhipu' },
            { id: 'glm-4-air', name: 'GLM-4-Air', description: 'GLM-4轻量版，快速响应', owned_by: 'zhipu' },
            { id: 'glm-4-airx', name: 'GLM-4-AirX', description: 'GLM-4轻量增强版', owned_by: 'zhipu' },
            { id: 'glm-4-flash', name: 'GLM-4-Flash', description: 'GLM-4极速版，超快响应', owned_by: 'zhipu' },
            { id: 'glm-4-flashx', name: 'GLM-4-FlashX', description: 'GLM-4极速增强版', owned_by: 'zhipu' },
            { id: 'glm-4v', name: 'GLM-4V', description: 'GLM-4视觉版，支持图像理解', owned_by: 'zhipu' },
            { id: 'glm-4v-flash', name: 'GLM-4V-Flash', description: 'GLM-4V极速版', owned_by: 'zhipu' },
            { id: 'glm-4v-plus', name: 'GLM-4V-Plus', description: 'GLM-4V增强版', owned_by: 'zhipu' },
            { id: 'glm-4-alltools', name: 'GLM-4-AllTools', description: 'GLM-4全工具版，支持网络搜索等工具', owned_by: 'zhipu' }
          ];
          break;
        case 'openai-aisdk':
          // AI SDK版本使用相同的模型获取逻辑
          console.log(`[fetchModelsFromEndpoint] AI SDK OpenAI使用标准模型获取`);
          rawModels = await openaiApi.fetchModels(providerWithKey);
          break;
        case 'openai-response':
          // OpenAI Responses API 使用专门的模型获取逻辑
          console.log(`[fetchModelsFromEndpoint] OpenAI Responses API使用专门的模型获取`);
          try {
            // 创建 OpenAIResponseProvider 实例来获取模型
            // 使用静态导入的 OpenAIResponseProvider
            const responseProvider = new OpenAIResponseProvider({
              id: provider.id,
              name: provider.name || 'OpenAI Responses',
              apiKey: apiKey,
              baseUrl: provider.baseUrl || 'https://api.openai.com/v1',
              provider: 'openai',
              providerType: 'openai-response'
            });
            rawModels = await responseProvider.getModels();
          } catch (error) {
            console.warn(`[fetchModelsFromEndpoint] OpenAI Responses API模型获取失败，使用标准API:`, error);
            rawModels = await openaiApi.fetchModels(providerWithKey);
          }
          break;
        case 'openai':
        case 'google':
        default:
          // 默认使用OpenAI兼容API
          rawModels = await openaiApi.fetchModels(providerWithKey);
          break;
      }

      // 如果成功，记录key使用并返回结果
      if (keyConfig) {
        const keyManager = ApiKeyManager.getInstance();
        keyManager.updateKeyStatus(keyConfig, true);
      }
      
      console.log(`[fetchModelsFromEndpoint] ✅ 使用key ${i + 1} 成功获取模型列表 (${rawModels.length}个模型)`);
      return rawModels;
      
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      console.warn(`[fetchModelsFromEndpoint] ❌ key ${i + 1} 获取失败: ${errorMessage}`);
      
      // 如果使用了多key模式，更新key状态
      if (keyConfig) {
        const keyManager = ApiKeyManager.getInstance();
        keyManager.updateKeyStatus(keyConfig, false, errorMessage);
      }
      
      // 如果还有更多key可以尝试，继续下一个
      if (i < availableKeys.length - 1) {
        console.log(`[fetchModelsFromEndpoint] 🔄 切换到下一个key继续尝试...`);
        continue;
      }
    }
  }

  // 所有key都失败了
  throw lastError || new Error('所有API Key都获取失败，无法获取模型列表');
}

/**
 * 从自定义端点获取模型列表（支持多key故障转移）
 * @param customEndpoint 自定义端点完整URL
 * @param provider 原始提供商配置（用于API密钥等）
 * @returns 原始模型列表
 */
async function fetchModelsFromCustomEndpoint(customEndpoint: string, provider: any): Promise<any[]> {
  let lastError: Error | null = null;

  // 获取所有可用的API Keys（用于故障转移）
  const availableKeys = getAllAvailableApiKeys(provider);
  if (availableKeys.length === 0) {
    throw new Error('未找到可用的API Key，无法获取模型列表');
  }

  // 尝试使用每个可用的key，直到成功或全部失败
  for (let i = 0; i < availableKeys.length; i++) {
    const { key: apiKey, config: keyConfig } = availableKeys[i];
    
    try {
      console.log(`[fetchModelsFromCustomEndpoint] 尝试使用key ${i + 1}/${availableKeys.length}: ${keyConfig?.name || apiKey.substring(0, 8)}...`);
      
      // 构建请求头 - 参考 Cherry Studio 的请求头配置
      const headers: Record<string, string> = {
        'Accept': 'application/json',
        'User-Agent': 'AetherLink/1.0 (compatible; OpenAI-Client)',
        'HTTP-Referer': 'https://aetherlink.app',
        'X-Title': 'AetherLink'
      };

      // 添加API密钥
      headers['Authorization'] = `Bearer ${apiKey}`;

      // 添加自定义请求头（如果有）
      if (provider.extraHeaders) {
        Object.assign(headers, provider.extraHeaders);
      }

      // 直接请求自定义端点
      const response = await fetch(customEndpoint, {
        method: 'GET',
        headers: headers
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`自定义端点请求失败: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      
      // 使用增强的响应解析器处理多种格式
      const models = parseModelsResponse(data);
      
      // 标准化每个模型对象
      const normalizedModels = models
        .map(normalizeModel)
        .filter((m: any) => m && m.id);
      
      console.log(`[fetchModelsFromCustomEndpoint] ✅ 使用key ${i + 1} 成功获取模型列表, 找到 ${normalizedModels.length} 个模型`);

      // 如果成功，记录key使用
      if (keyConfig) {
        const keyManager = ApiKeyManager.getInstance();
        keyManager.updateKeyStatus(keyConfig, true);
      }

      return normalizedModels;
      
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      console.warn(`[fetchModelsFromCustomEndpoint] ❌ key ${i + 1} 获取失败: ${errorMessage}`);
      
      // 如果使用了多key模式，更新key状态
      if (keyConfig) {
        const keyManager = ApiKeyManager.getInstance();
        keyManager.updateKeyStatus(keyConfig, false, errorMessage);
      }
      
      // 如果还有更多key可以尝试，继续下一个
      if (i < availableKeys.length - 1) {
        console.log(`[fetchModelsFromCustomEndpoint] 🔄 切换到下一个key继续尝试...`);
        continue;
      }
    }
  }

  // 所有key都失败了
  throw lastError || new Error('所有API Key都获取失败，无法获取模型列表');
}

/**
 * 获取模型列表 - 简化版本，参考最佳实例架构
 * @param provider 提供商配置
 * @returns 格式化的模型列表
 */
export async function fetchModels(provider: any): Promise<any[]> {
  try {
    // 确定提供商类型
    let providerType = provider.providerType || provider.id;

    // 对于自定义中转站，默认使用OpenAI兼容API
    if (provider.baseUrl && !provider.providerType && provider.id !== 'openai') {
      providerType = 'openai';
    }

    let allModels: any[] = [];

    // 1. 从默认端点获取模型
    console.log(`[fetchModels] 从默认端点获取模型: ${provider.id}`);
    try {
      const defaultModels = await fetchModelsFromEndpoint(provider, providerType);
      allModels.push(...defaultModels);
      console.log(`[fetchModels] 默认端点获取到 ${defaultModels.length} 个模型`);
    } catch (error) {
      console.warn(`[fetchModels] 默认端点获取失败:`, error);
    }

    // 2. 如果有自定义端点，也从自定义端点获取模型
    if (provider.customModelEndpoint) {
      console.log(`[fetchModels] 从自定义端点获取模型: ${provider.customModelEndpoint}`);
      try {
        const customModels = await fetchModelsFromCustomEndpoint(provider.customModelEndpoint, provider);
        allModels.push(...customModels);
        console.log(`[fetchModels] 自定义端点获取到 ${customModels.length} 个模型`);
      } catch (error) {
        console.warn(`[fetchModels] 自定义端点获取失败:`, error);
      }
    }

    // 3. 去重处理 - 根据模型ID去重，保留第一个
    const uniqueModels = new Map();
    allModels.forEach(model => {
      if (!uniqueModels.has(model.id)) {
        uniqueModels.set(model.id, model);
      }
    });

    const deduplicatedModels = Array.from(uniqueModels.values());
    console.log(`[fetchModels] 去重后共 ${deduplicatedModels.length} 个模型`);

    // 4. 统一格式化模型数据
    const formattedModels = deduplicatedModels.map(model => ({
      id: model.id,
      name: model.name || model.id,
      provider: provider.id,
      providerType: provider.providerType || provider.id,
      description: model.description,
      group: getDefaultGroupName(model.id, provider.id),
      enabled: true,
      // 保留原始数据
      ...model
    }));

    return formattedModels;
  } catch (error) {
    console.error('获取模型列表失败:', error);
    throw error;
  }
}

/**
 * 处理模型组合请求
 * @param messages 消息数组
 * @param model 模型配置（包含组合信息）
 * @returns 响应内容
 */
async function handleModelComboRequest(
  messages: any[],
  model: Model
): Promise<string | { content: string; reasoning?: string; reasoningTime?: number }> {
  try {
    console.log(`[handleModelComboRequest] 开始处理模型组合请求: ${model.id}`);

    // 从模型配置中获取组合配置
    const comboConfig = (model as any).comboConfig;
    if (!comboConfig) {
      throw new Error(`模型组合 ${model.id} 的配置信息不存在`);
    }

    // 将消息转换为简单的提示词格式
    const prompt = messages
      .filter(msg => msg.role === 'user')
      .map(msg => msg.content)
      .join('\n');

    console.log(`[handleModelComboRequest] 提取的提示词: ${prompt.substring(0, 100)}...`);

    // 调用模型组合服务执行
    const result = await modelComboService.executeCombo(comboConfig.id, prompt);

    console.log(`[handleModelComboRequest] 模型组合执行完成:`, result);

    // 返回最终结果
    return {
      content: result.finalResult?.content || '模型组合执行完成，但没有返回内容',
      reasoning: result.finalResult?.reasoning,
      reasoningTime: result.stats?.totalLatency
    };
  } catch (error) {
    console.error('[handleModelComboRequest] 模型组合请求失败:', error);
    throw new Error(`模型组合执行失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}