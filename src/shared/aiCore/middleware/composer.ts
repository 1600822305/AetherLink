/**
 * 中间件组合器
 * 将多个中间件组合成单一执行链
 */
import type { BaseApiClient } from '../clients/base';
import type { CompletionsParams } from '../clients/base/types';
import type {
  Middleware,
  MiddlewareFunction,
  MiddlewareContext,
  ExecutionResult,
} from './types';
import { ChunkType } from '../types/chunk';
import { createInitialContext } from './types';

/**
 * 组合中间件为单一函数
 * 使用洋葱模型：外层中间件先执行，内层后执行
 * 
 * @param middlewares 中间件数组
 * @returns 组合后的中间件函数
 */
export function compose(middlewares: Middleware[]): MiddlewareFunction {
  return async (ctx: MiddlewareContext, next: () => Promise<void>) => {
    let index = -1;

    const dispatch = async (i: number): Promise<void> => {
      if (i <= index) {
        throw new Error('next() 被多次调用');
      }
      index = i;

      const middleware = middlewares[i];
      if (!middleware) {
        // 所有中间件执行完毕，调用最终的next
        return next();
      }

      try {
        console.log(`[Middleware] 执行: ${middleware.name}`);
        await middleware.execute(ctx, () => dispatch(i + 1));
      } catch (error) {
        ctx.error = error instanceof Error ? error : new Error(String(error));
        throw error;
      }
    };

    return dispatch(0);
  };
}

/**
 * 应用中间件到Completions调用
 * 
 * @param client API客户端
 * @param middlewares 中间件数组
 * @returns 包装后的completions函数
 */
export function applyMiddlewares(
  client: BaseApiClient,
  middlewares: Middleware[]
): (params: CompletionsParams) => Promise<ExecutionResult> {
  const composedMiddleware = compose(middlewares);

  return async (params: CompletionsParams): Promise<ExecutionResult> => {
    // 初始化上下文
    const ctx = createInitialContext(client, params);

    // 创建AbortController
    const lastMessage = params.messages?.[params.messages.length - 1];
    if (lastMessage?.id) {
      const { abortController, cleanup } = client.createAbortController(lastMessage.id);
      ctx.abortController = abortController;
      ctx.cleanup = cleanup;
    }

    // 定义最内层的next - 实际调用SDK
    const innerNext = async (): Promise<void> => {
      if (!ctx.sdkPayload) {
        console.warn('[Middleware] sdkPayload未设置，跳过SDK调用');
        return;
      }

      try {
        const result = await client.createCompletions(
          ctx.sdkPayload as any,
          { signal: ctx.abortController?.signal }
        );
        ctx.rawStream = result as AsyncIterable<unknown>;
      } catch (error) {
        ctx.error = error instanceof Error ? error : new Error(String(error));
        throw error;
      }
    };

    try {
      // 执行中间件链
      await composedMiddleware(ctx, innerNext);

      // 返回累积的结果
      return {
        content: ctx.accumulated?.text || '',
        reasoning: ctx.accumulated?.thinking,
        usage: ctx.accumulated?.usage,
        toolCalls: ctx.accumulated?.toolCalls,
        context: ctx,
      };
    } catch (error) {
      // 发送错误Chunk
      if (ctx.onChunk && !ctx.aborted) {
        try {
          await ctx.onChunk({
            type: ChunkType.ERROR,
            error: {
              message: error instanceof Error ? error.message : String(error),
            },
          });
        } catch {
          // 忽略发送错误时的异常
        }
      }
      throw error;
    } finally {
      // 清理
      ctx.cleanup?.();
    }
  };
}

/**
 * 创建带中间件的completions执行器
 */
export function createCompletionsExecutor(
  client: BaseApiClient,
  middlewares: Middleware[]
): {
  execute: (params: CompletionsParams) => Promise<ExecutionResult>;
  getMiddlewares: () => Middleware[];
} {
  const execute = applyMiddlewares(client, middlewares);

  return {
    execute,
    getMiddlewares: () => [...middlewares],
  };
}

/**
 * 简单的中间件执行器
 * 用于测试或简单场景
 */
export async function executeWithMiddlewares(
  client: BaseApiClient,
  params: CompletionsParams,
  middlewares: Middleware[]
): Promise<ExecutionResult> {
  const executor = applyMiddlewares(client, middlewares);
  return executor(params);
}

/**
 * 创建中间件执行上下文的快照
 * 用于调试
 */
export function createContextSnapshot(ctx: MiddlewareContext): Record<string, unknown> {
  return {
    model: ctx.model,
    hasAbortController: !!ctx.abortController,
    hasSdkPayload: !!ctx.sdkPayload,
    hasRawStream: !!ctx.rawStream,
    hasChunkStream: !!ctx.chunkStream,
    accumulated: {
      textLength: ctx.accumulated?.text?.length || 0,
      thinkingLength: ctx.accumulated?.thinking?.length || 0,
      toolCallsCount: ctx.accumulated?.toolCalls?.length || 0,
      hasUsage: !!ctx.accumulated?.usage,
    },
    error: ctx.error?.message,
    aborted: ctx.aborted,
    completed: ctx.completed,
  };
}
