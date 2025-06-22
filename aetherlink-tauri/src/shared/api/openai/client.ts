/**
 * OpenAI客户端模块
 * 负责创建和配置OpenAI客户端实例
 */
import OpenAI from 'openai';
import type { ClientOptions } from 'openai';
import type { Model } from '../../types';
import { logApiRequest } from '../../services/LoggerService';
import { isReasoningModel } from '../../config/models';

/**
 * 创建OpenAI客户端
 * @param model 模型配置
 * @returns OpenAI客户端实例
 */
export function createClient(model: Model): OpenAI {
  try {
    const apiKey = model.apiKey;
    if (!apiKey) {
      console.error('[OpenAI createClient] 错误: 未提供API密钥');
      throw new Error('未提供OpenAI API密钥，请在设置中配置');
    }

    // 处理基础URL
    let baseURL = model.baseUrl || 'https://api.openai.com/v1';

    // 检查是否需要特殊处理（在移除斜杠之前）
    const forceUseOriginalHost = () => {
      if (baseURL.endsWith('/')) {
        return true;
      }
      // 火山引擎特殊处理
      if (baseURL.endsWith('volces.com/api/v3')) {
        return true;
      }
      return false;
    };

    const shouldUseOriginal = forceUseOriginalHost();

    // 确保baseURL格式正确
    if (baseURL.endsWith('/')) {
      baseURL = baseURL.slice(0, -1);
    }

    // 确保baseURL包含/v1（特殊情况除外）
    if (!baseURL.includes('/v1') && !shouldUseOriginal) {
      // 确保在baseURL和/v1之间添加斜杠（避免出现类似http://example.com:3000v1这样的错误）
      baseURL = `${baseURL}/v1`;
    }

    console.log(`[OpenAI createClient] 创建客户端, 模型ID: ${model.id}, baseURL: ${baseURL.substring(0, 20)}...`);

    // 检查是否为Azure OpenAI
    if (isAzureOpenAI(model)) {
      console.log(`[OpenAI createClient] 检测到Azure OpenAI，使用Azure配置`);
    }

    // 创建配置对象
    const config: ClientOptions = {
      apiKey,
      baseURL,
      timeout: 90000, // 90秒超时，处理长响应
      dangerouslyAllowBrowser: true // 允许在浏览器环境中使用
    };

    // Azure OpenAI特殊配置
    if (isAzureOpenAI(model)) {
      config.defaultHeaders = {
        'api-version': (model as any).apiVersion || '2024-02-15-preview',
        ...config.defaultHeaders
      };
    }

    // 添加组织信息（如果有）
    if ((model as any).organization) {
      config.organization = (model as any).organization;
      console.log(`[OpenAI createClient] 设置组织ID: ${(model as any).organization}`);
    }

    // 添加额外头部（如果有）
    if (model.extraHeaders) {
      config.defaultHeaders = {
        ...config.defaultHeaders,
        ...model.extraHeaders
      };
      console.log(`[OpenAI createClient] 设置模型额外头部: ${Object.keys(model.extraHeaders).join(', ')}`);
    }

    // 添加供应商级别的额外头部（如果有）
    if ((model as any).providerExtraHeaders) {
      const providerHeaders = (model as any).providerExtraHeaders;

      // 处理禁用的请求头（值为 'REMOVE' 的头部将被删除）
      const filteredHeaders: Record<string, string> = {};
      const headersToRemove: string[] = [];

      Object.entries(providerHeaders).forEach(([key, value]) => {
        if (value === 'REMOVE') {
          headersToRemove.push(key.toLowerCase());
        } else if (value !== null && value !== undefined && value !== '') {
          filteredHeaders[key] = value as string;
        }
      });

      // 如果有需要删除的头部，创建自定义的 fetch 函数来拦截和删除这些头部
      if (headersToRemove.length > 0) {
        const originalFetch = config.fetch || fetch;
        config.fetch = async (url: RequestInfo | URL, init?: RequestInit) => {
          if (init?.headers) {
            const headers = new Headers(init.headers);

            // 删除指定的头部
            headersToRemove.forEach(headerName => {
              // 删除完全匹配的头部
              headers.delete(headerName);

              // 对于 stainless 相关头部，进行模糊匹配删除
              if (headerName.includes('stainless')) {
                const keysToDelete: string[] = [];
                for (const [key] of headers.entries()) {
                  if (key.toLowerCase().includes('stainless')) {
                    keysToDelete.push(key);
                  }
                }
                keysToDelete.forEach(key => headers.delete(key));
              }
            });

            init.headers = headers;
          }
          return originalFetch(url.toString(), init);
        };
        console.log(`[OpenAI createClient] 配置删除请求头: ${headersToRemove.join(', ')}`);
      }

      // 添加自定义头部
      if (Object.keys(filteredHeaders).length > 0) {
        config.defaultHeaders = {
          ...config.defaultHeaders,
          ...filteredHeaders
        };
        console.log(`[OpenAI createClient] 设置供应商额外头部: ${Object.keys(filteredHeaders).join(', ')}`);
      }
    }

    // 创建客户端
    const client = new OpenAI(config);
    console.log(`[OpenAI createClient] 客户端创建成功`);
    return client;

  } catch (error) {
    console.error('[OpenAI createClient] 创建客户端失败:', error);
    // 即使没有API密钥，也尝试创建一个客户端，以便调用代码不会崩溃
    // 后续API调用将失败，但至少不会在这里抛出异常
    const fallbackConfig: ClientOptions = {
      apiKey: 'sk-missing-key-please-configure',
      baseURL: 'https://api.openai.com/v1',
      timeout: 30000,
      dangerouslyAllowBrowser: true
    };
    console.warn('[OpenAI createClient] 使用后备客户端配置');
    return new OpenAI(fallbackConfig);
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

/**
 * 检查模型是否支持多模态
 * @param model 模型配置
 * @returns 是否支持多模态
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
 * @param model 模型配置
 * @returns 是否支持网页搜索
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
 * @param model 模型配置
 * @returns 是否支持推理优化
 */
export function supportsReasoning(model: Model): boolean {
  // 首先检查模型类型是否包含推理类型
  if (model.modelTypes && model.modelTypes.includes('reasoning')) {
    return true;
  }

  // 如果没有明确设置modelTypes，则使用ID检测
  // 使用导入的模型检测函数
  return isReasoningModel(model);
}

/**
 * 获取Web搜索参数配置
 * @param model 模型配置
 * @param enableSearch 是否启用搜索
 * @returns Web搜索配置参数
 */
export function getWebSearchParams(model: Model, enableSearch: boolean): Record<string, any> {
  if (!supportsWebSearch(model) || !enableSearch) {
    return {};
  }

  // 根据不同提供商返回合适的配置
  switch(model.provider) {
    case 'hunyuan':
      return { enable_enhancement: enableSearch, citation: true, search_info: true };
    case 'dashscope':
      return {
        enable_search: true,
        search_options: { forced_search: true }
      };
    case 'openrouter':
      return {
        plugins: [{ id: 'web', search_prompts: ['Search the web for...'] }]
      };
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
 * 测试API连接
 * @param model 模型配置
 * @returns 连接是否成功
 */
export async function testConnection(model: Model): Promise<boolean> {
  try {
    const apiKey = model.apiKey;
    const baseUrl = model.baseUrl || 'https://api.openai.com/v1';
    const modelId = model.id;

    if (!apiKey) {
      throw new Error('API密钥未设置');
    }

    // 创建OpenAI客户端实例
    const openai = createClient(model);

    // 记录API请求
    logApiRequest('OpenAI Connection Test', 'INFO', {
      method: 'POST',
      model: modelId,
      baseUrl
    });

    // 发送简单的测试请求 - WebView混合内容设置已允许HTTP请求
    const response = await openai.chat.completions.create({
      model: modelId,
      messages: [{ role: 'user', content: 'Hello' }],
      max_tokens: 5,
    });

    return Boolean(response.choices[0].message);
  } catch (error) {
    console.error('OpenAI API连接测试失败:', error);
    return false;
  }
}
