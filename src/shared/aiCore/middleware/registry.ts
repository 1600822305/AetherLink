/**
 * 中间件注册表
 * 对标 Cherry Studio middleware/register.ts
 */
import type { NamedMiddleware } from './types';

// 导入通用中间件
import * as ErrorHandlerModule from './common/ErrorHandlerMiddleware';
import * as AbortHandlerModule from './common/AbortHandlerMiddleware';
import * as FinalChunkConsumerModule from './common/FinalChunkConsumerMiddleware';
import * as LoggingModule from './common/LoggingMiddleware';

// 导入核心中间件
import * as TransformParamsModule from './core/TransformCoreToSdkParamsMiddleware';
import * as StreamAdapterModule from './core/StreamAdapterMiddleware';
import * as McpToolChunkModule from './core/McpToolChunkMiddleware';
import * as TextChunkModule from './core/TextChunkMiddleware';
import * as ThinkChunkModule from './core/ThinkChunkMiddleware';
import * as ResponseTransformModule from './core/ResponseTransformMiddleware';
import * as RawStreamListenerModule from './core/RawStreamListenerMiddleware';

// 导入功能中间件
import * as WebSearchModule from './feat/WebSearchMiddleware';
import * as ThinkingTagExtractionModule from './feat/ThinkingTagExtractionMiddleware';
import * as ToolUseExtractionModule from './feat/ToolUseExtractionMiddleware';
import * as ImageGenerationModule from './feat/ImageGenerationMiddleware';
import * as RetryModule from './feat/RetryMiddleware';

/**
 * 中间件注册表
 * 集中管理所有可用的中间件
 */
export const MiddlewareRegistry: Record<string, NamedMiddleware> = {
  // 通用中间件
  [ErrorHandlerModule.MIDDLEWARE_NAME]: {
    name: ErrorHandlerModule.MIDDLEWARE_NAME,
    middleware: ErrorHandlerModule.ErrorHandlerMiddleware,
  },
  [AbortHandlerModule.MIDDLEWARE_NAME]: {
    name: AbortHandlerModule.MIDDLEWARE_NAME,
    middleware: AbortHandlerModule.AbortHandlerMiddleware,
  },
  [FinalChunkConsumerModule.MIDDLEWARE_NAME]: {
    name: FinalChunkConsumerModule.MIDDLEWARE_NAME,
    middleware: FinalChunkConsumerModule.FinalChunkConsumerMiddleware,
  },
  [LoggingModule.MIDDLEWARE_NAME]: {
    name: LoggingModule.MIDDLEWARE_NAME,
    middleware: LoggingModule.LoggingMiddleware,
  },

  // 核心中间件
  [TransformParamsModule.MIDDLEWARE_NAME]: {
    name: TransformParamsModule.MIDDLEWARE_NAME,
    middleware: TransformParamsModule.TransformCoreToSdkParamsMiddleware,
  },
  [StreamAdapterModule.MIDDLEWARE_NAME]: {
    name: StreamAdapterModule.MIDDLEWARE_NAME,
    middleware: StreamAdapterModule.StreamAdapterMiddleware,
  },
  [McpToolChunkModule.MIDDLEWARE_NAME]: {
    name: McpToolChunkModule.MIDDLEWARE_NAME,
    middleware: McpToolChunkModule.McpToolChunkMiddleware,
  },
  [TextChunkModule.MIDDLEWARE_NAME]: {
    name: TextChunkModule.MIDDLEWARE_NAME,
    middleware: TextChunkModule.TextChunkMiddleware,
  },
  [ThinkChunkModule.MIDDLEWARE_NAME]: {
    name: ThinkChunkModule.MIDDLEWARE_NAME,
    middleware: ThinkChunkModule.ThinkChunkMiddleware,
  },
  [ResponseTransformModule.MIDDLEWARE_NAME]: {
    name: ResponseTransformModule.MIDDLEWARE_NAME,
    middleware: ResponseTransformModule.ResponseTransformMiddleware,
  },
  [RawStreamListenerModule.MIDDLEWARE_NAME]: {
    name: RawStreamListenerModule.MIDDLEWARE_NAME,
    middleware: RawStreamListenerModule.RawStreamListenerMiddleware,
  },

  // 功能中间件
  [WebSearchModule.MIDDLEWARE_NAME]: {
    name: WebSearchModule.MIDDLEWARE_NAME,
    middleware: WebSearchModule.WebSearchMiddleware,
  },
  [ThinkingTagExtractionModule.MIDDLEWARE_NAME]: {
    name: ThinkingTagExtractionModule.MIDDLEWARE_NAME,
    middleware: ThinkingTagExtractionModule.ThinkingTagExtractionMiddleware,
  },
  [ToolUseExtractionModule.MIDDLEWARE_NAME]: {
    name: ToolUseExtractionModule.MIDDLEWARE_NAME,
    middleware: ToolUseExtractionModule.ToolUseExtractionMiddleware,
  },
  [ImageGenerationModule.MIDDLEWARE_NAME]: {
    name: ImageGenerationModule.MIDDLEWARE_NAME,
    middleware: ImageGenerationModule.ImageGenerationMiddleware,
  },
  [RetryModule.MIDDLEWARE_NAME]: {
    name: RetryModule.MIDDLEWARE_NAME,
    middleware: RetryModule.RetryMiddleware,
  },
};

/**
 * 默认 Completions 中间件配置
 * 顺序：从外到内执行（Redux compose 是从右到左）
 * 
 * 对标 Cherry Studio DefaultCompletionsNamedMiddlewares：
 * 1. FinalChunkConsumer - 最外层，累积最终结果
 * 2. ErrorHandler - 捕获所有错误
 * 3. TransformParams - 转换请求参数
 * 4. AbortHandler - 处理中断
 * 5. McpToolChunk - MCP 工具调用（含递归）
 * 6. TextChunk - 文本处理
 * 7. WebSearch - Web 搜索处理
 * 8. ToolUseExtraction - 工具标签提取（提示词模式）
 * 9. ThinkingTagExtraction - 思考标签提取（OpenAI 特定）
 * 10. ThinkChunk - 思考处理（通用SDK）
 * 11. ResponseTransform - 响应转换
 * 12. StreamAdapter - 流适配
 * 13. RawStreamListener - 原始流监听（最内层）
 * 
 * 注意：以下中间件不在默认链中，按需动态添加：
 * - LoggingMiddleware - 调试时添加
 * - RetryMiddleware - 需要重试时添加
 * - ImageGenerationMiddleware - 图片生成模型时添加
 */
export const DefaultCompletionsNamedMiddlewares: NamedMiddleware[] = [
  MiddlewareRegistry[FinalChunkConsumerModule.MIDDLEWARE_NAME],
  MiddlewareRegistry[ErrorHandlerModule.MIDDLEWARE_NAME],
  MiddlewareRegistry[TransformParamsModule.MIDDLEWARE_NAME],
  MiddlewareRegistry[AbortHandlerModule.MIDDLEWARE_NAME],
  MiddlewareRegistry[McpToolChunkModule.MIDDLEWARE_NAME],
  MiddlewareRegistry[TextChunkModule.MIDDLEWARE_NAME],
  MiddlewareRegistry[WebSearchModule.MIDDLEWARE_NAME],
  MiddlewareRegistry[ToolUseExtractionModule.MIDDLEWARE_NAME],
  MiddlewareRegistry[ThinkingTagExtractionModule.MIDDLEWARE_NAME],
  MiddlewareRegistry[ThinkChunkModule.MIDDLEWARE_NAME],
  MiddlewareRegistry[ResponseTransformModule.MIDDLEWARE_NAME],
  MiddlewareRegistry[StreamAdapterModule.MIDDLEWARE_NAME],
  MiddlewareRegistry[RawStreamListenerModule.MIDDLEWARE_NAME],
];

/**
 * 获取中间件
 */
export function getMiddleware(name: string): NamedMiddleware | undefined {
  return MiddlewareRegistry[name];
}

/**
 * 获取所有中间件名称
 */
export function getMiddlewareNames(): string[] {
  return Object.keys(MiddlewareRegistry);
}

/**
 * 注册自定义中间件
 */
export function registerMiddleware(namedMiddleware: NamedMiddleware): void {
  MiddlewareRegistry[namedMiddleware.name] = namedMiddleware;
}
