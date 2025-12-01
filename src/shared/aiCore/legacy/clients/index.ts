/**
 * Legacy Clients 导出
 * 迁移自 src/shared/api/
 */
import type { Model } from '../../../types';
import { testConnection as testOpenAIConnection } from './openai/client';
import { testConnection as testGeminiConnection } from './gemini/client';
import { testConnection as testAnthropicConnection } from './anthropic/client';

/**
 * 统一的 API 连接测试函数
 */
export async function testApiConnection(model: Model): Promise<boolean> {
  const provider = model.provider?.toLowerCase() || '';
  
  if (provider.includes('gemini') || provider.includes('google')) {
    return testGeminiConnection(model);
  } else if (provider.includes('anthropic') || provider.includes('claude')) {
    return testAnthropicConnection(model);
  } else {
    // 默认使用 OpenAI 兼容接口
    return testOpenAIConnection(model);
  }
}

// 基础提供者
export * from './baseProvider';

// OpenAI
export * as openaiApi from './openai';
export { sendChatRequest } from './openai/chat';

// Gemini
export * as geminiApi from './gemini';

// Anthropic
export * as anthropicApi from './anthropic';

// OpenAI AI SDK
export { OpenAIAISDKProvider } from './openai-aisdk/provider';
export * as openaiAisdkApi from './openai-aisdk';

// Google (Veo)
export * as googleApi from './google';
