/**
 * AI SDK OpenAI 模块导出
 * 提供基于 @ai-sdk/openai 的 OpenAI 供应商实现
 */

export { createAISDKClient, isAzureOpenAI } from './client';
export { streamCompletionAISDK } from './stream';
export { OpenAIAISDKProvider } from './provider';

// 重新导出类型
export type { Model, Message } from '../../types';
