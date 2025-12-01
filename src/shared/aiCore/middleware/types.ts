/**
 * 中间件系统类型定义
 */
import type { Chunk } from '../types/chunk';
import type { BaseApiClient } from '../clients/base';
import type {
  CompletionsParams,
  CompletionsResult,
  MCPTool,
  MCPToolResponse,
  Model,
} from '../clients/base/types';

// ==================== Context Types ====================

/**
 * 中间件上下文
 * 在整个中间件链中传递的共享状态
 */
export interface MiddlewareContext {
  /** API客户端实例 */
  client: BaseApiClient;
  /** 原始请求参数 */
  params: CompletionsParams;
  /** 模型信息 */
  model: Model;
  /** MCP工具列表 */
  mcpTools?: MCPTool[];
  /** 中断控制器 */
  abortController?: AbortController;
  /** Chunk回调 */
  onChunk?: (chunk: Chunk) => void | Promise<void>;
  /** 清理函数 */
  cleanup?: () => void;

  // ===== 可变状态 =====
  
  /** SDK请求参数（由转换中间件填充）*/
  sdkPayload?: unknown;
  /** 原始SDK响应流 */
  rawStream?: AsyncIterable<unknown>;
  /** 转换后的Chunk流 */
  chunkStream?: AsyncIterable<Chunk>;
  /** 累积的响应数据 */
  accumulated: AccumulatedData;
  /** 错误信息 */
  error?: Error;
  /** 是否已中断 */
  aborted?: boolean;
  /** 是否已完成 */
  completed?: boolean;

  // ===== 扩展字段 =====
  
  /** 允许存储任意扩展数据 */
  [key: string]: unknown;
}

/**
 * 累积的响应数据
 */
export interface AccumulatedData {
  /** 文本内容 */
  text: string;
  /** 思考内容 */
  thinking?: string;
  /** 工具调用 */
  toolCalls?: MCPToolResponse[];
  /** 使用统计 */
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    thoughts_tokens?: number;
  };
  /** 性能指标 */
  metrics?: {
    time_first_token_ms?: number;
    time_completion_ms?: number;
  };
  /** 网络搜索结果 */
  webSearch?: {
    results: unknown;
    source: string;
  };
}

// ==================== Middleware Types ====================

/**
 * 中间件执行函数类型
 */
export type MiddlewareFunction = (
  ctx: MiddlewareContext,
  next: () => Promise<void>
) => Promise<void>;

/**
 * 中间件定义
 */
export interface Middleware {
  /** 中间件名称（唯一标识）*/
  name: string;
  /** 中间件执行函数 */
  execute: MiddlewareFunction;
  /** 中间件优先级（数字越小越先执行，默认50）*/
  priority?: number;
  /** 中间件描述 */
  description?: string;
  /** 是否启用（默认true）*/
  enabled?: boolean;
}

/**
 * 中间件配置选项
 */
export interface MiddlewareOptions {
  /** 是否启用 */
  enabled?: boolean;
  /** 优先级 */
  priority?: number;
  /** 自定义配置 */
  config?: Record<string, unknown>;
}

// ==================== Builder Types ====================

/**
 * 中间件构建器选项
 */
export interface MiddlewareBuilderOptions {
  /** 是否包含默认中间件 */
  includeDefaults?: boolean;
  /** 自定义中间件列表 */
  middlewares?: Middleware[];
}

// ==================== Execution Types ====================

/**
 * Completions执行选项
 */
export interface CompletionsExecutionOptions {
  /** 请求超时（毫秒）*/
  timeout?: number;
  /** 是否启用流式 */
  stream?: boolean;
  /** 重试次数 */
  retries?: number;
  /** 中间件配置覆盖 */
  middlewareOverrides?: Record<string, MiddlewareOptions>;
}

/**
 * 执行结果
 */
export interface ExecutionResult extends CompletionsResult {
  /** 上下文（用于调试）*/
  context?: MiddlewareContext;
}

// ==================== Middleware Names ====================

/**
 * 内置中间件名称常量
 */
export const MIDDLEWARE_NAMES = {
  // 核心中间件
  ERROR_HANDLER: 'ErrorHandler',
  ABORT_HANDLER: 'AbortHandler',
  TIMEOUT_HANDLER: 'TimeoutHandler',
  FINAL_CONSUMER: 'FinalConsumer',
  
  // 转换中间件
  REQUEST_TRANSFORM: 'RequestTransform',
  RESPONSE_TRANSFORM: 'ResponseTransform',
  STREAM_ADAPTER: 'StreamAdapter',
  
  // 功能中间件
  THINKING_EXTRACTION: 'ThinkingExtraction',
  TOOL_USE_EXTRACTION: 'ToolUseExtraction',
  WEB_SEARCH: 'WebSearch',
  
  // 日志中间件
  LOGGER: 'Logger',
  METRICS: 'Metrics',
} as const;

export type MiddlewareName = typeof MIDDLEWARE_NAMES[keyof typeof MIDDLEWARE_NAMES];

// ==================== Helper Functions ====================

/**
 * 创建初始上下文
 */
export function createInitialContext(
  client: BaseApiClient,
  params: CompletionsParams
): MiddlewareContext {
  return {
    client,
    params,
    model: params.assistant?.model || { id: 'unknown', name: 'Unknown', provider: 'unknown' },
    mcpTools: params.mcpTools,
    onChunk: params.onChunk,
    accumulated: {
      text: '',
      thinking: '',
      toolCalls: [],
    },
  };
}

/**
 * 创建空的累积数据
 */
export function createEmptyAccumulated(): AccumulatedData {
  return {
    text: '',
    thinking: '',
    toolCalls: [],
  };
}
