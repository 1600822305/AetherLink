/**
 * AI SDK Anthropic 客户端模块
 * 使用 @ai-sdk/anthropic 实现 Claude 供应商
 * 支持多平台（Tauri、Capacitor、Web）和代理配置
 */
import { generateText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import type { AnthropicProvider as AISDKAnthropicProvider } from '@ai-sdk/anthropic';
import type { Model } from '../../types';
import { createPlatformFetch, createHeaderFilterFetch } from '../../utils/universalFetch';
import { createLogger } from '../../services/infra/logger';

const logger = createLogger('Anthropic SDK Client');



/**
 * 检查模型是否支持多模态（视觉）
 */
export function supportsMultimodal(model: Model): boolean {
  const modelId = model.id.toLowerCase();
  return Boolean(
    model.capabilities?.multimodal ||
    modelId.includes('claude-3') ||
    modelId.includes('claude-4')
  );
}

/**
 * 检查模型是否支持扩展思考（Extended Thinking）
 */
export function supportsExtendedThinking(model: Model): boolean {
  const modelId = model.id.toLowerCase();
  return Boolean(
    model.capabilities?.reasoning ||
    modelId.includes('claude-3-7') ||
    modelId.includes('claude-3.7') ||
    modelId.includes('claude-4') ||
    modelId.includes('opus') ||
    modelId.includes('sonnet-4')
  );
}

/**
 * 检查模型是否支持计算机使用（Computer Use）
 */
export function supportsComputerUse(model: Model): boolean {
  const modelId = model.id.toLowerCase();
  return Boolean(
    modelId.includes('claude-3-5-sonnet') ||
    modelId.includes('claude-3.5-sonnet') ||
    modelId.includes('claude-4') ||
    modelId.includes('sonnet-4')
  );
}

/**
 * 检查模型是否支持 PDF 输入
 */
export function supportsPdfInput(model: Model): boolean {
  const modelId = model.id.toLowerCase();
  return Boolean(
    modelId.includes('claude-3-5') ||
    modelId.includes('claude-3.5') ||
    modelId.includes('claude-4')
  );
}

/**
 * 检查是否为 Claude 推理模型
 */
export function isClaudeReasoningModel(model: Model): boolean {
  const modelId = model.id.toLowerCase();
  return Boolean(
    modelId.includes('claude-3-7') ||
    modelId.includes('claude-3.7') ||
    modelId.includes('claude-4') ||
    modelId.includes('opus-4') ||
    modelId.includes('sonnet-4')
  );
}

/**
 * 创建 AI SDK Anthropic 客户端
 * @param model 模型配置
 * @returns AI SDK Anthropic Provider 实例
 */
export function createClient(model: Model): AISDKAnthropicProvider {
  try {
    const apiKey = model.apiKey;
    if (!apiKey) {
      logger.error('错误: 未提供 API 密钥');
      throw new Error('未提供 Anthropic API 密钥，请在设置中配置');
    }

    // 处理基础 URL
    let baseURL = model.baseUrl || 'https://api.anthropic.com/v1';

    // 开发环境下自动转换为代理 URL
    if (import.meta.env.DEV && baseURL.includes('code.newcli.com')) {
      const proxyPath = baseURL.replace('https://code.newcli.com', '/api/newcli');
      baseURL = `${window.location.origin}${proxyPath}`;
      logger.debug(`开发环境代理转换`);
    }

    // 确保 baseURL 格式正确
    if (baseURL.endsWith('/')) {
      baseURL = baseURL.slice(0, -1);
    }

    // Anthropic API 不需要 /v1 后缀（SDK 会自动添加）
    if (baseURL.endsWith('/v1')) {
      baseURL = baseURL.slice(0, -3);
    }

    logger.debug(`创建客户端, 模型ID: ${model.id}, baseURL: ${baseURL.substring(0, 30)}...`);

    // 构建配置
    const config: Parameters<typeof createAnthropic>[0] = {
      apiKey,
      baseURL,
    };

    // 设置平台适配的 fetch（统一由 universalFetch 模块提供）
    let customFetch = createPlatformFetch(model);

    // 收集自定义头部
    const customHeaders: Record<string, string> = {};
    const headersToRemove: string[] = [];

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
        // Anthropic 特有：模糊匹配删除 anthropic 相关头部（保留 anthropic-version）
        const keysToDelete: string[] = [];
        for (const [key] of headers.entries()) {
          if (key.toLowerCase().includes('anthropic') && key.toLowerCase() !== 'anthropic-version') {
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

    // 创建并返回 AI SDK Anthropic Provider
    const client = createAnthropic(config);
    logger.debug(`客户端创建成功`);
    return client;

  } catch (error) {
    logger.error('创建客户端失败:', error);
    
    // 创建后备客户端
    const fallbackClient = createAnthropic({
      apiKey: 'sk-missing-key-please-configure',
      baseURL: 'https://api.anthropic.com',
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
    
    const result = await generateText({
      model: client(model.id),
      prompt: 'Hello',
      maxOutputTokens: 5,
    });

    return Boolean(result.text);
  } catch (error) {
    logger.error('连接测试失败:', error);
    return false;
  }
}

/**
 * 获取 Extended Thinking 配置
 */
export function getExtendedThinkingConfig(
  model: Model,
  budgetTokens: number = 10000,
  enabled: boolean = true
): Record<string, any> {
  if (!supportsExtendedThinking(model) || !enabled) {
    return {};
  }

  return {
    thinking: {
      type: 'enabled',
      budgetTokens: Math.max(1024, Math.min(budgetTokens, 128000))
    }
  };
}

/**
 * 获取 Interleaved Thinking Beta Header
 */
export function getInterleavedThinkingHeaders(): Record<string, string> {
  return {
    'anthropic-beta': 'interleaved-thinking-2025-05-14'
  };
}
