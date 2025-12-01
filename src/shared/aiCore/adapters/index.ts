/**
 * Chunk 适配器模块
 * 完全参考 Cherry Studio 实现
 * 统一 SDK 到 Chunk 的转换层
 */

import type { Chunk } from '../../types/chunk';

// 导出统一适配器
export { AiSdkToChunkAdapter, type AiSdkStreamResult, type AISDKWebSearchResult, type WebSearchResults, WebSearchSource } from './AiSdkToChunkAdapter';

// 导出工具调用处理器
export { ToolCallChunkHandler, addActiveToolCall, type MCPTool, type MCPToolResponse, type BaseTool, type ToolcallsMap } from './ToolCallChunkHandler';

// 导出 OpenAI 到 AI SDK 适配器
export { OpenAIToAiSdkAdapter } from './OpenAIToAiSdkAdapter';

// 导出 Link Converter 工具
export { convertLinks, flushLinkConverterBuffer, completeLinks, extractUrlsFromMarkdown, cleanLinkCommas } from './linkConverter';

/**
 * 适配器配置接口
 */
export interface ChunkAdapterConfig {
  onChunk: (chunk: Chunk) => void;
  mcpTools?: any[];
  accumulate?: boolean;
  enableWebSearch?: boolean;
  onSessionUpdate?: (sessionId: string) => void;
  getSessionWasCleared?: () => boolean;
}

/**
 * 创建统一的 Chunk 适配器
 * 参考 Cherry Studio 构造函数签名
 */
export function createChunkAdapter(config: ChunkAdapterConfig) {
  const { AiSdkToChunkAdapter } = require('./AiSdkToChunkAdapter');
  return new AiSdkToChunkAdapter(
    config.onChunk,
    config.mcpTools || [],
    config.accumulate,
    config.enableWebSearch,
    config.onSessionUpdate,
    config.getSessionWasCleared
  );
}
