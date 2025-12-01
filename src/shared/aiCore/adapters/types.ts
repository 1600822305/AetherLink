/**
 * Chunk 适配器类型定义
 * 参考 Cherry Studio AiSdkToChunkAdapter 设计
 */

import type { Chunk } from '../../types/chunk';

/**
 * MCP 工具类型
 */
export interface MCPTool {
  id?: string;
  name: string;
  description?: string;
  inputSchema?: unknown;
  serverId?: string;
}

/**
 * Chunk 适配器配置
 */
export interface ChunkAdapterConfig {
  /** Chunk 回调函数 */
  onChunk: (chunk: Chunk) => void | Promise<void>;
  /** MCP 工具列表 */
  mcpTools?: MCPTool[];
  /** 是否累积文本（true=累积模式，false=增量模式）*/
  accumulate?: boolean;
  /** 是否启用 Web 搜索 */
  enableWebSearch?: boolean;
  /** 会话更新回调 */
  onSessionUpdate?: (sessionId: string) => void;
}

/**
 * 流处理结果
 */
export interface StreamProcessResult {
  /** 最终文本内容 */
  text: string;
  /** 推理/思考内容 */
  reasoning?: string;
  /** 使用统计 */
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  /** 性能指标 */
  metrics?: {
    completion_tokens: number;
    time_first_token_millsec: number;
    time_completion_millsec: number;
  };
}

/**
 * Chunk 适配器接口
 */
export interface IChunkAdapter {
  /**
   * 处理流式响应
   * @param stream 原始流
   * @returns 处理结果
   */
  processStream(stream: any): Promise<StreamProcessResult>;
  
  /**
   * 处理非流式响应
   * @param response 完整响应
   * @returns 处理结果
   */
  processResponse?(response: any): Promise<StreamProcessResult>;
}

/**
 * Provider 类型
 */
export type ProviderType = 
  | 'openai' 
  | 'gemini' 
  | 'anthropic' 
  | 'ollama' 
  | 'openrouter'
  | 'deepseek'
  | 'siliconflow'
  | 'zhipu'
  | 'moonshot'
  | 'qwen'
  | 'groq'
  | 'together'
  | 'custom';

/**
 * Web 搜索结果（AI SDK source 事件）
 */
export interface WebSearchResult {
  url: string;
  title?: string;
  snippet?: string;
}

/**
 * AI SDK 流事件类型（参考 Vercel AI SDK TextStreamPart）
 */
export type AiSdkStreamPart = 
  | { type: 'text-start' }
  | { type: 'text-delta'; text: string }
  | { type: 'text-end'; providerMetadata?: Record<string, any> }
  | { type: 'reasoning-start'; id: string }
  | { type: 'reasoning-delta'; text: string }
  | { type: 'reasoning-end' }
  | { type: 'tool-call'; toolCallId: string; toolName: string; args: Record<string, any> }
  | { type: 'tool-result'; toolCallId: string; result: any }
  | { type: 'tool-error'; toolCallId: string; error: any }
  | { type: 'finish-step'; finishReason: string; providerMetadata?: Record<string, any> }
  | { type: 'finish'; totalUsage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number } }
  | { type: 'source'; sourceType: string; url?: string; title?: string }
  | { type: 'file'; file: { mediaType: string; base64: string } }
  | { type: 'error'; error: Error }
  | { type: 'abort' }
  | { type: 'raw'; rawValue: any };

/**
 * AI SDK 流式结果对象
 */
export interface AiSdkStreamResult {
  fullStream: ReadableStream<AiSdkStreamPart>;
  text: Promise<string>;
}
