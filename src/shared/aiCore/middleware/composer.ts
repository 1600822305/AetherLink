/**
 * 中间件组合器
 * 对标 Cherry Studio middleware/composer.ts
 * 
 * 采用 Redux 风格组合：compose(f, g, h) = (...args) => f(g(h(...args)))
 */
import type { BaseApiClient } from '../clients/base';
import type { CompletionsParams, CompletionsResult, RequestOptions } from './schemas';
import {
  MIDDLEWARE_CONTEXT_SYMBOL,
  createEmptyAccumulated,
  type BaseContext,
  type CompletionsContext,
  type CompletionsMiddleware,
  type MiddlewareAPI,
  type DispatchFunction,
} from './types';

// ==================== Compose ====================

/**
 * Redux 风格的函数组合
 * compose(f, g, h) 等价于 (...args) => f(g(h(...args)))
 * 
 * @param funcs 要组合的函数数组
 * @returns 组合后的函数
 */
export function compose(...funcs: Array<(...args: any[]) => any>): (...args: any[]) => any {
  if (funcs.length === 0) {
    // 没有函数时，返回第一个参数
    return (...args: any[]) => (args.length > 0 ? args[0] : undefined);
  }
  if (funcs.length === 1) {
    return funcs[0];
  }
  return funcs.reduce(
    (a, b) =>
      (...args: any[]) =>
        a(b(...args))
  );
}

// ==================== Context Factory ====================

/**
 * 创建 Completions 上下文
 */
function createCompletionsContextFactory<
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
  } as unknown as CompletionsContext<TSdkParams, TMessageParam, TToolCall, TSdkInstance, TRawOutput, TRawChunk, TSdkTool>;
}

// ==================== Apply Middlewares ====================

/**
 * 应用 Completions 中间件
 * 对标 Cherry Studio applyCompletionsMiddlewares
 * 
 * @param client API 客户端实例
 * @param originalMethod 原始的 createCompletions 方法
 * @param middlewares 中间件数组
 * @returns 增强后的 completions 方法
 * 
 * @example
 * ```typescript
 * const enhanced = applyCompletionsMiddlewares(
 *   client,
 *   client.createCompletions.bind(client),
 *   [ErrorHandler, TransformParams, ...]
 * );
 * const result = await enhanced(params, options);
 * ```
 */
export function applyCompletionsMiddlewares<
  TSdkInstance,
  TSdkParams,
  TRawOutput,
  TRawChunk,
  TMessageParam,
  TToolCall,
  TSdkTool
>(
  client: BaseApiClient<TSdkInstance, TSdkParams, TRawOutput, TRawChunk, TMessageParam, TToolCall, TSdkTool>,
  originalMethod: (payload: TSdkParams, options?: RequestOptions) => Promise<TRawOutput>,
  middlewares: CompletionsMiddleware<TSdkParams, TMessageParam, TToolCall, TSdkInstance, TRawOutput, TRawChunk, TSdkTool>[]
): (params: CompletionsParams, options?: RequestOptions) => Promise<CompletionsResult> {
  
  const methodName = 'completions';

  return async function enhancedCompletionsMethod(
    params: CompletionsParams,
    options?: RequestOptions
  ): Promise<CompletionsResult> {
    // 1. 创建上下文
    const originalCallArgs: [CompletionsParams] = [params];
    const ctx = createCompletionsContextFactory(client, originalCallArgs);

    // 2. 创建中间件 API
    const api: MiddlewareAPI<typeof ctx, [CompletionsParams]> = {
      getContext: () => ctx,
      getOriginalArgs: () => originalCallArgs,
    };

    // 3. 定义最终 dispatch - 调用原始 SDK 方法
    const finalDispatch = async (
      context: typeof ctx
    ): Promise<CompletionsResult> => {
      const sdkPayload = context._internal?.sdkPayload;
      
      if (!sdkPayload) {
        throw new Error('SDK payload not found in context. Middleware chain should have transformed parameters.');
      }

      const abortSignal = context._internal.flowControl?.abortSignal;
      const timeout = context._internal.customState?.sdkMetadata?.timeout;

      // 调用原始方法
      const rawOutput = await originalMethod.call(client, sdkPayload, {
        ...options,
        signal: abortSignal,
        timeout,
      });

      // 返回基础结果（后续中间件会增强）
      return {
        rawOutput,
        getText: () => context._internal.accumulated?.text || '',
        getReasoning: () => context._internal.accumulated?.thinking,
        usage: context._internal.accumulated?.usage,
      };
    };

    // 4. 构建中间件链
    const chain = middlewares.map((middleware) => middleware(api as any));
    const composedMiddlewareLogic = compose(...chain);
    const enhancedDispatch = composedMiddlewareLogic(finalDispatch);

    // 5. 保存 enhancedDispatch 供递归调用
    ctx._internal.enhancedDispatch = enhancedDispatch;

    // 6. 执行增强后的 dispatch
    return enhancedDispatch(ctx, params);
  };
}

// ==================== Apply Method Middlewares ====================

/**
 * 通用方法中间件应用
 * 用于非 completions 方法（如 translate、summarize 等）
 */
export function applyMethodMiddlewares<
  TArgs extends unknown[] = unknown[],
  TResult = unknown,
  TContext extends BaseContext = BaseContext
>(
  methodName: string,
  originalMethod: (...args: TArgs) => Promise<TResult>,
  middlewares: Array<(api: MiddlewareAPI<TContext, TArgs>) => 
    (next: DispatchFunction<TContext, TArgs[0], TResult>) => 
    (context: TContext, params: TArgs[0]) => Promise<TResult>>,
  contextFactory?: (base: BaseContext, callArgs: TArgs) => TContext
): (...args: TArgs) => Promise<TResult> {
  
  return async function enhancedMethod(...methodCallArgs: TArgs): Promise<TResult> {
    // 创建基础上下文
    const baseContext = {
      [MIDDLEWARE_CONTEXT_SYMBOL]: true,
      methodName,
      originalArgs: methodCallArgs,
    } as unknown as BaseContext;

    // 使用工厂创建特定上下文，或使用基础上下文
    const ctx = contextFactory 
      ? contextFactory(baseContext, methodCallArgs) 
      : baseContext as TContext;

    const api: MiddlewareAPI<TContext, TArgs> = {
      getContext: () => ctx,
      getOriginalArgs: () => methodCallArgs,
    };

    // 最终 dispatch
    const finalDispatch = async (
      _context: TContext,
      currentArgs: TArgs[0]
    ): Promise<TResult> => {
      return originalMethod.apply(null, [currentArgs, ...methodCallArgs.slice(1)] as TArgs);
    };

    const chain = middlewares.map((middleware) => middleware(api));
    const composedMiddlewareLogic = compose(...chain);
    const enhancedDispatch = composedMiddlewareLogic(finalDispatch);

    return enhancedDispatch(ctx, methodCallArgs[0]);
  };
}

// ==================== Debug Utilities ====================

/**
 * 创建上下文快照（用于调试）
 */
export function createContextSnapshot(ctx: CompletionsContext): Record<string, unknown> {
  return {
    methodName: ctx.methodName,
    hasApiClient: !!ctx.apiClientInstance,
    internal: {
      recursionDepth: ctx._internal?.toolProcessingState?.recursionDepth,
      hasSdkPayload: !!ctx._internal?.sdkPayload,
      hasRawStream: !!ctx._internal?.rawStream,
      hasChunkStream: !!ctx._internal?.chunkStream,
      flowControl: {
        aborted: ctx._internal?.flowControl?.aborted,
        completed: ctx._internal?.flowControl?.completed,
      },
      accumulated: {
        textLength: ctx._internal?.accumulated?.text?.length || 0,
        thinkingLength: ctx._internal?.accumulated?.thinking?.length || 0,
        toolCallsCount: ctx._internal?.accumulated?.toolCalls?.length || 0,
        hasUsage: !!ctx._internal?.accumulated?.usage,
      },
      error: ctx._internal?.error?.message,
    },
  };
}
