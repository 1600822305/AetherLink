/**
 * AI SDK OpenAI客户端
 * 使用 @ai-sdk/openai 替代原生 OpenAI 库，解决浏览器环境下的流式响应问题
 */
import { createOpenAI } from '@ai-sdk/openai';
import type { Model } from '../../../../types';
import { isTauri } from '../../../../utils/platformDetection';
import { Capacitor } from '@capacitor/core';
import { universalFetch } from '../../../../utils/universalFetch';
import store from '../../../../store';
import type { ModelProvider } from '../../../../config/defaultModels';

/**
 * 检查是否需要使用代理
 */
function needsCORSProxy(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';

    // 本地地址不需要代理
    const hostname = urlObj.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.')) {
      return false;
    }

    // Web端：跨域请求需要代理
    const needsProxy = urlObj.origin !== currentOrigin;
    return needsProxy;
  } catch {
    return false;
  }
}

/**
 * 创建自定义 fetch 函数，支持 CORS 代理
 */
function createProxyFetch() {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    
    // 检查是否需要使用代理
    if (needsCORSProxy(url)) {
      const proxyUrl = `http://localhost:8888/proxy?url=${encodeURIComponent(url)}`;
      console.log(`[AI SDK ProxyFetch] 使用代理服务器: ${url} -> ${proxyUrl}`);
      
      try {
        const response = await fetch(proxyUrl, init);
        return response;
      } catch (error) {
        console.error(`[AI SDK ProxyFetch] 代理请求失败: ${error}`);
        throw error;
      }
    }
    
    // 不需要代理，直接请求
    return fetch(url, init);
  };
}

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

    // 只在 Web 端使用代理服务器
    let fetchFn: ((input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) | undefined;
    
    const isTauriEnv = isTauri();
    const isCapacitorNative = Capacitor?.isNativePlatform?.();
    const isWeb = !isTauriEnv && !isCapacitorNative;
    
    // 获取 useCorsPlugin 配置：优先使用 model 级别的配置，如果未定义则从 provider 级别获取
    let useCorsPlugin = model.useCorsPlugin;
    if (useCorsPlugin === undefined && model.provider) {
      // 从 Redux store 中查找对应的 Provider 配置
      const state = store.getState();
      const provider = state.settings.providers?.find((p: ModelProvider) => p.id === model.provider);
      if (provider) {
        useCorsPlugin = provider.useCorsPlugin;
        console.log(`[AI SDK createClient] 从 Provider "${provider.name}" 继承 useCorsPlugin: ${useCorsPlugin}`);
      }
    }
    
    if (isWeb) {
      // 只有 Web 端使用代理服务器
      fetchFn = createProxyFetch();
      console.log(`[AI SDK createClient] Web 端使用代理服务器 (http://localhost:8888/proxy)`);
    } else if (isCapacitorNative && useCorsPlugin) {
      // 移动端：如果开启了 CORS 插件，使用 universalFetch
      console.log(`[AI SDK createClient] 移动端使用 CorsBypass 插件 (useCorsPlugin=${useCorsPlugin})`);
      fetchFn = async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        // 显式传递 useCorsPlugin: true
        return universalFetch(url, { ...init, useCorsPlugin: true });
      };
    } else {
      console.log(`[AI SDK createClient] 非 Web 端：${isTauriEnv ? 'Tauri' : 'Capacitor Native'}，useCorsPlugin=${useCorsPlugin}，使用标准 fetch`);
    }

    // 创建AI SDK OpenAI客户端
    const client = createOpenAI({
      apiKey,
      baseURL,
      ...(fetchFn && { fetch: fetchFn }),
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
