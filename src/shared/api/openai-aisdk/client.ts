/**
 * AI SDK OpenAI 客户端模块
 * 使用 @ai-sdk/openai 替代原生 OpenAI SDK
 * 支持多平台（Tauri、Capacitor、Web）和代理配置
 */
import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import type { OpenAIProvider as AISDKOpenAIProvider } from '@ai-sdk/openai';
import type { Model } from '../../types';
import { createPlatformFetch, createHeaderFilterFetch } from '../../utils/universalFetch';
import { isReasoningModel } from '../../../config/models';
import { createLogger } from '../../services/infra/logger';

const logger = createLogger('AI SDK Client');



/**
 * 检查是否为 Azure OpenAI
 */
export function isAzureOpenAI(model: Model): boolean {
  return Boolean(
    model.providerType === 'azure-openai' ||
    model.provider === 'azure-openai' ||
    (model.baseUrl && model.baseUrl.includes('openai.azure.com'))
  );
}

/**
 * 检查模型是否支持多模态
 */
export function supportsMultimodal(model: Model): boolean {
  const modelId = model.id;
  return Boolean(
    model.capabilities?.multimodal ||
    modelId.includes('gpt-4') ||
    modelId.includes('gpt-4o') ||
    modelId.includes('vision') ||
    modelId.includes('gemini') ||
    modelId.includes('claude-3')
  );
}

/**
 * 检查模型是否支持网页搜索
 */
export function supportsWebSearch(model: Model): boolean {
  const modelId = model.id;
  return Boolean(
    model.capabilities?.webSearch ||
    modelId.includes('gpt-4o-search-preview') ||
    modelId.includes('gpt-4o-mini-search-preview')
  );
}

/**
 * 检查模型是否支持推理优化
 */
export function supportsReasoning(model: Model): boolean {
  if (model.modelTypes && model.modelTypes.includes('reasoning')) {
    return true;
  }
  return isReasoningModel(model);
}

/**
 * 获取 Web 搜索参数配置
 */
export function getWebSearchParams(model: Model, enableSearch: boolean): Record<string, any> {
  if (!supportsWebSearch(model) || !enableSearch) {
    return {};
  }

  switch (model.provider) {
    case 'hunyuan':
      return { enable_enhancement: enableSearch, citation: true, search_info: true };
    case 'dashscope':
      return { enable_search: true, search_options: { forced_search: true } };
    case 'openrouter':
      return { plugins: [{ id: 'web', search_prompts: ['Search the web for...'] }] };
    case 'openai':
      if (supportsWebSearch(model)) {
        return { web_search_options: {} };
      }
      return { tools: [{ type: 'retrieval' }] };
    default:
      return enableSearch ? { tools: [{ type: 'retrieval' }] } : {};
  }
}

/**
 * 创建 AI SDK OpenAI 客户端
 * @param model 模型配置
 * @returns AI SDK OpenAI Provider 实例
 */
export function createClient(model: Model): AISDKOpenAIProvider {
  try {
    const apiKey = model.apiKey;
    if (!apiKey) {
      logger.error('错误: 未提供 API 密钥');
      throw new Error('未提供 OpenAI API 密钥，请在设置中配置');
    }

    // 处理基础 URL
    let baseURL = model.baseUrl || 'https://api.openai.com/v1';

    // 开发环境下自动转换为代理 URL
    if (import.meta.env.DEV && baseURL.includes('code.newcli.com')) {
      const proxyPath = baseURL.replace('https://code.newcli.com', '/api/newcli');
      baseURL = `${window.location.origin}${proxyPath}`;
      logger.debug(`开发环境代理转换`);
    }

    // 检查是否需要特殊处理
    const shouldUseOriginal = baseURL.endsWith('/') || baseURL.endsWith('volces.com/api/v3');

    // 确保 baseURL 格式正确
    if (baseURL.endsWith('/')) {
      baseURL = baseURL.slice(0, -1);
    }

    // 确保 baseURL 包含 /v1（特殊情况除外）
    if (!baseURL.includes('/v1') && !shouldUseOriginal) {
      baseURL = `${baseURL}/v1`;
    }

    logger.debug(`创建客户端, 模型ID: ${model.id}, baseURL: ${baseURL.substring(0, 30)}...`);

    // 构建配置
    const config: Parameters<typeof createOpenAI>[0] = {
      apiKey,
      baseURL,
    };

    // 设置平台适配的 fetch（统一由 universalFetch 模块提供）
    let customFetch = createPlatformFetch(model);

    // 收集自定义头部
    const customHeaders: Record<string, string> = {};
    const headersToRemove: string[] = [];

    // Azure OpenAI 特殊配置
    if (isAzureOpenAI(model)) {
      customHeaders['api-version'] = (model as any).apiVersion || '2024-02-15-preview';
      logger.debug(`检测到 Azure OpenAI`);
    }

    // 添加模型级别额外头部
    if (model.extraHeaders) {
      Object.assign(customHeaders, model.extraHeaders);
      logger.debug(`设置模型额外头部: ${Object.keys(model.extraHeaders).join(', ')}`);
    }

    // 添加供应商级别额外头部
    if (model.providerExtraHeaders) {
      const providerHeaders = model.providerExtraHeaders;
      
      Object.entries(providerHeaders).forEach(([key, value]) => {
        if (value === 'REMOVE') {
          headersToRemove.push(key.toLowerCase());
        } else if (value !== null && value !== undefined && value !== '') {
          customHeaders[key] = value as string;
        }
      });

      if (headersToRemove.length > 0) {
        logger.debug(`配置删除请求头: ${headersToRemove.join(', ')}`);
      }
    }

    // 如果有需要删除的头部，使用统一的 header 过滤函数
    if (headersToRemove.length > 0 && customFetch) {
      customFetch = createHeaderFilterFetch(customFetch, headersToRemove, (headers) => {
        // stainless 相关头部模糊匹配删除
        const keysToDelete: string[] = [];
        for (const [key] of headers.entries()) {
          if (key.toLowerCase().includes('stainless')) {
            keysToDelete.push(key);
          }
        }
        keysToDelete.forEach(key => headers.delete(key));
      });
    }

    // 设置配置
    if (customFetch) {
      config.fetch = customFetch;
    }

    if (Object.keys(customHeaders).length > 0) {
      config.headers = customHeaders;
    }

    // 添加组织信息
    if ((model as any).organization) {
      config.organization = (model as any).organization;
      logger.debug(`设置组织ID: ${(model as any).organization}`);
    }

    // 创建并返回 AI SDK OpenAI Provider
    const client = createOpenAI(config);
    logger.debug(`客户端创建成功`);
    return client;

  } catch (error) {
    logger.error('创建客户端失败:', error);
    
    // 创建后备客户端
    const fallbackClient = createOpenAI({
      apiKey: 'sk-missing-key-please-configure',
      baseURL: 'https://api.openai.com/v1',
    });
    logger.warn('使用后备客户端配置');
    return fallbackClient;
  }
}

/**
 * 测试 API 连接
 */
export async function testConnection(model: Model): Promise<boolean> {
  try {
    const client = createClient(model);
    
    logger.debug(`测试连接: ${model.id}`);
    
    // 使用 .chat() 调用 Chat Completions API（兼容 OpenAI 兼容 API）
    const result = await generateText({
      model: client.chat(model.id) as any,
      prompt: 'Hello',
      maxOutputTokens: 5,
    });

    return Boolean(result.text);
  } catch (error) {
    logger.error('连接测试失败:', error);
    return false;
  }
}
