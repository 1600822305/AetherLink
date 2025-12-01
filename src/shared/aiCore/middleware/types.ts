/**
 * 中间件系统类型定义
 * 对标 Cherry Studio middleware/types.ts
 * 
 * 采用 Redux 风格中间件架构：
 * middleware = (api) => (next) => (context, params) => Promise<Result>
 */
import type { Chunk } from '../types/chunk';
import type { BaseApiClient } from '../clients/base';
import type {
  CompletionsParams,
  CompletionsResult,
  MCPToolResponse,
} from './schemas';

// 重导出常用类型
export type { CompletionsParams, CompletionsResult } from './schemas';

// ==================== Symbol ====================

/**
 * 中间件上下文标识符号
 * 用于运行时识别上下文对象
 */
export const MIDDLEWARE_CONTEXT_SYMBOL = Symbol('AiCoreMiddlewareContext');

// ==================== Context Types ====================

/**
 * 基础上下文
 */
export interface BaseContext {
  [MIDDLEWARE_CONTEXT_SYMBOL]: true;
  /** 方法名称 */
  methodName: string;
  /** 原始参数 */
  originalArgs: unknown[];
}

/**
 * 工具处理状态
 */
export interface ToolProcessingState {
  /** 递归深度 */
  recursionDepth: number;
  /** 是否为递归调用 */
  isRecursiveCall: boolean;
  /** 最大递归深度 */
  maxDepth?: number;
}

/**
 * 流程控制
 */
export interface FlowControl {
  /** 中断信号 */
  abortSignal?: AbortSignal;
  /** 是否已中断 */
  aborted?: boolean;
  /** 是否已完成 */
  completed?: boolean;
}

/**
 * 自定义状态
 */
export interface CustomState {
  /** SDK元数据 */
  sdkMetadata?: {
    timeout?: number;
    headers?: Record<string, string>;
  };
  /** 扩展数据 */
  [key: string]: unknown;
}

/**
 * 累积的响应数据
 */
export interface AccumulatedData {
  /** 文本内容 */
  text: string;
  /** 思考/推理内容 */
  thinking?: string;
  /** 工具调用列表 */
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
    results: unknown[];
    source: string;
  };
}

/**
 * 内部状态
 * 存储中间件链执行过程中的所有内部数据
 */
export interface InternalState<TSdkParams = unknown> {
  /** 工具处理状态 */
  toolProcessingState: ToolProcessingState;
  
  /** SDK请求参数（由 TransformMiddleware 填充）*/
  sdkPayload?: TSdkParams;
  
  /** 原始SDK响应流 */
  rawStream?: AsyncIterable<unknown>;
  
  /** 转换后的Chunk流 */
  chunkStream?: AsyncIterable<Chunk>;
  
  /** 流程控制 */
  flowControl?: FlowControl;
  
  /** 自定义状态 */
  customState?: CustomState;
  
  /** 观察者回调 */
  observer: {
    onToolCall?: (toolCall: MCPToolResponse) => void;
    onWebSearch?: (results: unknown[]) => void;
    [key: string]: unknown;
  };
  
  /** 增强的dispatch函数（用于递归调用）*/
  enhancedDispatch?: DispatchFunction;
  
  /** 累积数据 */
  accumulated?: AccumulatedData;
  
  /** 错误信息 */
  error?: Error;
}

/**
 * Completions 上下文
 * 对标 Cherry Studio CompletionsContext
 */
export interface CompletionsContext<
  TSdkParams = unknown,
  TMessageParam = unknown,
  TToolCall = unknown,
  TSdkInstance = unknown,
  TRawOutput = unknown,
  TRawChunk = unknown,
  TSdkTool = unknown
> extends BaseContext {
  /** API客户端实例 */
  apiClientInstance: BaseApiClient<
    TSdkInstance,
    TSdkParams,
    TRawOutput,
    TRawChunk,
    TMessageParam,
    TToolCall,
    TSdkTool
  >;
  
  /** 内部状态 */
  _internal: InternalState<TSdkParams>;
}

// ==================== Middleware API ====================

/**
 * 中间件API
 * 提供给中间件访问上下文和参数的接口
 */
export interface MiddlewareAPI<
  TContext extends BaseContext = CompletionsContext,
  TArgs extends unknown[] = [CompletionsParams]
> {
  /** 获取上下文 */
  getContext: () => TContext;
  /** 获取原始参数 */
  getOriginalArgs: () => TArgs;
}

// ==================== Dispatch Function ====================

/**
 * Dispatch 函数类型
 * 中间件链中调用下一个中间件的函数签名
 */
export type DispatchFunction<
  TContext = CompletionsContext,
  TParams = CompletionsParams,
  TResult = CompletionsResult
> = (context: TContext, params: TParams) => Promise<TResult>;

// ==================== Middleware Types ====================

/**
 * Completions 中间件类型
 * Redux 风格：(api) => (next) => (context, params) => Promise<Result>
 * 
 * @example
 * ```typescript
 * const ExampleMiddleware: CompletionsMiddleware = (api) => (next) => 
 *   async (context, params) => {
 *     console.log('Before');
 *     const result = await next(context, params);
 *     console.log('After');
 *     return result;
 *   };
 * ```
 */
export type CompletionsMiddleware<
  TSdkParams = unknown,
  TMessageParam = unknown,
  TToolCall = unknown,
  TSdkInstance = unknown,
  TRawOutput = unknown,
  TRawChunk = unknown,
  TSdkTool = unknown
> = (
  api: MiddlewareAPI<
    CompletionsContext<TSdkParams, TMessageParam, TToolCall, TSdkInstance, TRawOutput, TRawChunk, TSdkTool>,
    [CompletionsParams]
  >
) => (
  next: DispatchFunction<
    CompletionsContext<TSdkParams, TMessageParam, TToolCall, TSdkInstance, TRawOutput, TRawChunk, TSdkTool>,
    CompletionsParams,
    CompletionsResult
  >
) => (
  context: CompletionsContext<TSdkParams, TMessageParam, TToolCall, TSdkInstance, TRawOutput, TRawChunk, TSdkTool>,
  params: CompletionsParams
) => Promise<CompletionsResult>;

/**
 * 通用方法中间件类型
 */
export type MethodMiddleware<
  TContext extends BaseContext = BaseContext,
  TArgs extends unknown[] = unknown[],
  TResult = unknown
> = (
  api: MiddlewareAPI<TContext, TArgs>
) => (
  next: DispatchFunction<TContext, TArgs[0], TResult>
) => (
  context: TContext,
  params: TArgs[0]
) => Promise<TResult>;

/**
 * 具名中间件
 */
export interface NamedMiddleware<TMiddleware = CompletionsMiddleware> {
  /** 中间件名称（唯一标识） */
  name: string;
  /** 中间件实现 */
  middleware: TMiddleware;
}

// ==================== Middleware Names ====================

/**
 * 内置中间件名称常量
 * 对标 Cherry Studio 中间件命名
 */
export const MIDDLEWARE_NAMES = {
  // 通用中间件 (common/)
  ERROR_HANDLER: 'ErrorHandlerMiddleware',
  ABORT_HANDLER: 'AbortHandlerMiddleware',
  FINAL_CHUNK_CONSUMER: 'FinalChunkConsumerMiddleware',
  LOGGING: 'LoggingMiddleware',
  
  // 核心中间件 (core/)
  TRANSFORM_PARAMS: 'TransformCoreToSdkParamsMiddleware',
  STREAM_ADAPTER: 'StreamAdapterMiddleware',
  RESPONSE_TRANSFORM: 'ResponseTransformMiddleware',
  TEXT_CHUNK: 'TextChunkMiddleware',
  THINK_CHUNK: 'ThinkChunkMiddleware',
  RAW_STREAM_LISTENER: 'RawStreamListenerMiddleware',
  MCP_TOOL_CHUNK: 'McpToolChunkMiddleware',
  WEB_SEARCH: 'WebSearchMiddleware',
  
  // 功能中间件 (feat/)
  THINKING_TAG_EXTRACTION: 'ThinkingTagExtractionMiddleware',
  TOOL_USE_EXTRACTION: 'ToolUseExtractionMiddleware',
  IMAGE_GENERATION: 'ImageGenerationMiddleware',
} as const;

export type MiddlewareName = typeof MIDDLEWARE_NAMES[keyof typeof MIDDLEWARE_NAMES];

// ==================== Helper Functions ====================

/**
 * 创建初始 Completions 上下文
 */
export function createCompletionsContext<
  TSdkParams,
  TMessageParam,
  TToolCall,
  TSdkInstance,
  TRawOutput,
  TRawChunk,
  TSdkTool
>(
  client: BaseApiClient<TSdkInstance, TSdkParams, TRawOutput, TRawChunk, TMessageParam, TToolCall, TSdkTool>,
  callArgs: [CompletionsParams]
): CompletionsContext<TSdkParams, TMessageParam, TToolCall, TSdkInstance, TRawOutput, TRawChunk, TSdkTool> {
  return {
    [MIDDLEWARE_CONTEXT_SYMBOL]: true,
    methodName: 'completions',
    originalArgs: callArgs,
    apiClientInstance: client,
    _internal: {
      toolProcessingState: {
        recursionDepth: 0,
        isRecursiveCall: false,
        maxDepth: 10,
      },
      observer: {},
      accumulated: createEmptyAccumulated(),
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

/**
 * 检查对象是否为中间件上下文
 */
export function isMiddlewareContext(obj: unknown): obj is BaseContext {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    MIDDLEWARE_CONTEXT_SYMBOL in obj &&
    (obj as any)[MIDDLEWARE_CONTEXT_SYMBOL] === true
  );
}
