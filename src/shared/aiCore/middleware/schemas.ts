/**
 * 中间件数据结构定义
 * 对标 Cherry Studio middleware/schemas.ts
 * 
 * 直接复用 clients/base/types.ts 的类型定义以保证兼容性
 */
import type { Chunk } from '../types/chunk';

// 从 clients/base/types 导入核心类型
export type {
  Message,
  MCPTool,
  MCPToolResponse,
  MCPCallToolResponse,
  Model,
  AssistantConfig,
  CompletionsContext as ClientCompletionsContext,
} from '../clients/base/types';

// 导入供本地使用（CompletionsParams 需要这些类型）
import type {
  Message,
  MCPTool,
  AssistantConfig,
} from '../clients/base/types';

// ==================== Completions Types ====================

/**
 * Completions 请求参数
 * 对标 Cherry Studio CompletionsParams
 */
export interface CompletionsParams {
  /** 调用类型 */
  callType: 'chat' | 'check' | 'translate' | 'summary' | 'generate' | 'search' | 'test';
  
  /** 消息内容 */
  messages: Message[];
  
  /** 助手配置 */
  assistant: AssistantConfig;
  
  /** 是否流式输出 */
  streamOutput?: boolean;
  
  /** 主题ID（用于Trace） */
  topicId?: string;
  
  /** MCP工具列表 */
  mcpTools?: MCPTool[];
  
  /** MCP模式：function=函数调用, prompt=提示词注入 */
  mcpMode?: 'function' | 'prompt';
  
  /** 是否启用工具调用 */
  enableToolUse?: boolean;
  
  /** 是否启用网络搜索 */
  enableWebSearch?: boolean;
  
  /** 是否启用图片生成 */
  enableGenerateImage?: boolean;
  
  /** 最大tokens */
  maxTokens?: number;
  
  /** Chunk回调 */
  onChunk?: (chunk: Chunk) => void | Promise<void>;
  
  /** 中断信号 */
  abortSignal?: AbortSignal;
  
  /** 是否应该抛出错误 */
  shouldThrow?: boolean;
}

/**
 * Completions 结果
 * 对标 Cherry Studio CompletionsResult
 */
export interface CompletionsResult {
  /** 获取文本内容 */
  getText: () => string;
  
  /** 获取推理/思考内容 */
  getReasoning?: () => string | undefined;
  
  /** 原始SDK输出 */
  rawOutput?: unknown;
  
  /** 使用统计 */
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    thoughts_tokens?: number;
  };
  
  /** 性能指标 */
  metrics?: {
    completion_tokens?: number;
    time_first_token_millsec?: number;
    time_completion_millsec?: number;
  };
}

// ==================== Request Options ====================

/**
 * 请求选项
 */
export interface RequestOptions {
  /** 中断信号 */
  signal?: AbortSignal;
  /** 超时时间 */
  timeout?: number;
  /** 额外请求头 */
  headers?: Record<string, string>;
}
