/**
 * 中间件系统统一导出
 * 对标 Cherry Studio 架构
 * 
 * @example
 * ```typescript
 * import {
 *   CompletionsMiddlewareBuilder,
 *   applyCompletionsMiddlewares,
 *   MIDDLEWARE_NAMES,
 * } from '@/shared/aiCore/middleware/index.new';
 * 
 * // 创建中间件构建器
 * const builder = CompletionsMiddlewareBuilder.withDefaults();
 * builder.remove('McpToolChunkMiddleware');
 * 
 * // 应用中间件
 * const enhanced = applyCompletionsMiddlewares(
 *   client,
 *   client.createCompletions.bind(client),
 *   builder.build()
 * );
 * ```
 */

// ==================== Types ====================

export type {
  BaseContext,
  CompletionsContext,
  CompletionsMiddleware,
  MethodMiddleware,
  MiddlewareAPI,
  DispatchFunction,
  NamedMiddleware,
  ToolProcessingState,
  FlowControl,
  CustomState,
  AccumulatedData,
  InternalState,
  MiddlewareName,
} from './types';

export {
  MIDDLEWARE_CONTEXT_SYMBOL,
  MIDDLEWARE_NAMES,
  createCompletionsContext,
  createEmptyAccumulated,
  isMiddlewareContext,
} from './types';

// ==================== Schemas ====================

export type {
  Message,
  MCPTool,
  MCPToolResponse,
  MCPCallToolResponse,
  Model,
  AssistantConfig,
  CompletionsParams,
  CompletionsResult,
  RequestOptions,
} from './schemas';

// ==================== Composer ====================

export {
  compose,
  applyCompletionsMiddlewares,
  applyMethodMiddlewares,
  createContextSnapshot,
} from './composer';

// ==================== Builder ====================

export { CompletionsMiddlewareBuilder } from './builder';

// ==================== Registry ====================

export {
  MiddlewareRegistry,
  DefaultCompletionsNamedMiddlewares,
  getMiddleware,
  getMiddlewareNames,
  registerMiddleware,
} from './registry';

// ==================== Common Middlewares ====================

export { ErrorHandlerMiddleware, ErrorType } from './common/ErrorHandlerMiddleware';
export { AbortHandlerMiddleware } from './common/AbortHandlerMiddleware';
export { FinalChunkConsumerMiddleware } from './common/FinalChunkConsumerMiddleware';
export { LoggingMiddleware, LogLevel } from './common/LoggingMiddleware';

// ==================== Core Middlewares ====================

export { TransformCoreToSdkParamsMiddleware } from './core/TransformCoreToSdkParamsMiddleware';
export { StreamAdapterMiddleware } from './core/StreamAdapterMiddleware';
export { McpToolChunkMiddleware } from './core/McpToolChunkMiddleware';
export { TextChunkMiddleware } from './core/TextChunkMiddleware';
export { ThinkChunkMiddleware } from './core/ThinkChunkMiddleware';
export { ResponseTransformMiddleware } from './core/ResponseTransformMiddleware';
export {
  RawStreamListenerMiddleware,
  createRawStreamListenerMiddleware,
  setStreamListenerConfig,
  getStreamListenerConfig,
  type StreamListenerConfig,
  type StreamStats,
} from './core/RawStreamListenerMiddleware';

// ==================== Feature Middlewares ====================

export { WebSearchMiddleware, WebSearchSource } from './feat/WebSearchMiddleware';
export { ThinkingTagExtractionMiddleware } from './feat/ThinkingTagExtractionMiddleware';
export { ToolUseExtractionMiddleware } from './feat/ToolUseExtractionMiddleware';
export { ImageGenerationMiddleware } from './feat/ImageGenerationMiddleware';
export { RetryMiddleware, createRetryMiddleware } from './feat/RetryMiddleware';
