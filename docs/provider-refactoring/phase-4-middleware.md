# Phase 4: 中间件系统

> 预计工时：4-5天
> 前置依赖：Phase 3 (工厂模式)
> 参考文件：`cherry-studio-main/src/renderer/src/aiCore/legacy/middleware/`

## 🎯 目标

1. 设计灵活的中间件架构
2. 实现核心中间件（错误处理、中断、流适配）
3. 实现功能中间件（思考提取、工具调用）
4. 创建中间件构建器和组合器

## 📁 需要创建的文件

```
src/shared/aiCore/
└── middleware/
    ├── types.ts           # 中间件类型定义
    ├── builder.ts         # 中间件构建器
    ├── composer.ts        # 中间件组合器
    ├── registry.ts        # 中间件注册表
    ├── core/              # 核心中间件
    │   ├── ErrorHandler.ts
    │   ├── AbortHandler.ts
    │   ├── StreamAdapter.ts
    │   └── FinalConsumer.ts
    ├── feat/              # 功能中间件
    │   ├── ThinkingExtraction.ts
    │   ├── ToolUseExtraction.ts
    │   └── WebSearch.ts
    └── index.ts           # 统一导出
```

## 📝 详细实现

### 4.1 中间件类型定义 (`middleware/types.ts`)

```typescript
import type { Chunk } from '../types/chunk';
import type { BaseApiClient, CompletionsParams, CompletionsResult } from '../clients/base';
import type { Model, MCPTool } from '@/shared/types';

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
  
  // ===== 可变状态 =====
  /** SDK请求参数（由转换中间件填充）*/
  sdkPayload?: any;
  /** 原始SDK响应流 */
  rawStream?: AsyncIterable<any>;
  /** 转换后的Chunk流 */
  chunkStream?: AsyncIterable<Chunk>;
  /** 累积的响应数据 */
  accumulated?: {
    text: string;
    thinking?: string;
    toolCalls?: any[];
    usage?: any;
    metrics?: any;
  };
  /** 错误信息 */
  error?: Error;
  
  // ===== 扩展字段 =====
  [key: string]: any;
}

/**
 * 中间件函数类型
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
  /** 中间件优先级（数字越小越先执行）*/
  priority?: number;
  /** 中间件描述 */
  description?: string;
}

/**
 * 中间件构建器选项
 */
export interface MiddlewareBuilderOptions {
  /** 是否包含默认中间件 */
  includeDefaults?: boolean;
  /** 自定义中间件列表 */
  middlewares?: Middleware[];
}

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
}
```

### 4.2 中间件注册表 (`middleware/registry.ts`)

```typescript
import type { Middleware } from './types';

/**
 * 中间件注册表
 * 集中管理所有可用的中间件
 */
class MiddlewareRegistryClass {
  private middlewares: Map<string, Middleware> = new Map();

  /**
   * 注册中间件
   */
  public register(middleware: Middleware): void {
    if (this.middlewares.has(middleware.name)) {
      console.warn(`[MiddlewareRegistry] 中间件 "${middleware.name}" 已存在，将被覆盖`);
    }
    this.middlewares.set(middleware.name, middleware);
    console.log(`[MiddlewareRegistry] 注册中间件: ${middleware.name}`);
  }

  /**
   * 批量注册
   */
  public registerAll(middlewares: Middleware[]): void {
    middlewares.forEach(m => this.register(m));
  }

  /**
   * 获取中间件
   */
  public get(name: string): Middleware | undefined {
    return this.middlewares.get(name);
  }

  /**
   * 检查是否存在
   */
  public has(name: string): boolean {
    return this.middlewares.has(name);
  }

  /**
   * 获取所有中间件
   */
  public getAll(): Middleware[] {
    return Array.from(this.middlewares.values());
  }

  /**
   * 获取所有名称
   */
  public getNames(): string[] {
    return Array.from(this.middlewares.keys());
  }

  /**
   * 移除中间件
   */
  public remove(name: string): boolean {
    return this.middlewares.delete(name);
  }
}

export const MiddlewareRegistry = new MiddlewareRegistryClass();

// 中间件名称常量
export const MIDDLEWARE_NAMES = {
  ERROR_HANDLER: 'ErrorHandler',
  ABORT_HANDLER: 'AbortHandler',
  STREAM_ADAPTER: 'StreamAdapter',
  FINAL_CONSUMER: 'FinalConsumer',
  THINKING_EXTRACTION: 'ThinkingExtraction',
  TOOL_USE_EXTRACTION: 'ToolUseExtraction',
  WEB_SEARCH: 'WebSearch',
  REQUEST_TRANSFORM: 'RequestTransform',
  RESPONSE_TRANSFORM: 'ResponseTransform',
} as const;
```

### 4.3 中间件构建器 (`middleware/builder.ts`)

```typescript
import type { Middleware, MiddlewareBuilderOptions } from './types';
import { MiddlewareRegistry, MIDDLEWARE_NAMES } from './registry';

/**
 * 中间件构建器
 * 提供流式API来构建中间件链
 */
export class MiddlewareBuilder {
  private middlewares: Middleware[] = [];

  constructor(options?: MiddlewareBuilderOptions) {
    if (options?.includeDefaults !== false) {
      // 默认不自动添加，需要显式调用
    }
    if (options?.middlewares) {
      this.middlewares = [...options.middlewares];
    }
  }

  /**
   * 创建带默认中间件的构建器
   */
  public static withDefaults(): MiddlewareBuilder {
    const builder = new MiddlewareBuilder();
    
    // 按优先级添加默认中间件
    const defaultOrder = [
      MIDDLEWARE_NAMES.FINAL_CONSUMER,      // 最外层：消费最终结果
      MIDDLEWARE_NAMES.ERROR_HANDLER,       // 错误处理
      MIDDLEWARE_NAMES.ABORT_HANDLER,       // 中断处理
      MIDDLEWARE_NAMES.WEB_SEARCH,          // 网络搜索
      MIDDLEWARE_NAMES.TOOL_USE_EXTRACTION, // 工具调用提取
      MIDDLEWARE_NAMES.THINKING_EXTRACTION, // 思考过程提取
      MIDDLEWARE_NAMES.RESPONSE_TRANSFORM,  // 响应转换
      MIDDLEWARE_NAMES.STREAM_ADAPTER,      // 流适配
      MIDDLEWARE_NAMES.REQUEST_TRANSFORM,   // 请求转换
    ];

    defaultOrder.forEach(name => {
      const middleware = MiddlewareRegistry.get(name);
      if (middleware) {
        builder.add(middleware);
      }
    });

    return builder;
  }

  /**
   * 添加中间件
   */
  public add(middleware: Middleware | string): MiddlewareBuilder {
    if (typeof middleware === 'string') {
      const m = MiddlewareRegistry.get(middleware);
      if (m) {
        this.middlewares.push(m);
      } else {
        console.warn(`[MiddlewareBuilder] 未找到中间件: ${middleware}`);
      }
    } else {
      this.middlewares.push(middleware);
    }
    return this;
  }

  /**
   * 在指定位置插入中间件
   */
  public insertBefore(targetName: string, middleware: Middleware | string): MiddlewareBuilder {
    const index = this.middlewares.findIndex(m => m.name === targetName);
    const toInsert = typeof middleware === 'string' 
      ? MiddlewareRegistry.get(middleware) 
      : middleware;
    
    if (toInsert) {
      if (index === -1) {
        this.middlewares.unshift(toInsert);
      } else {
        this.middlewares.splice(index, 0, toInsert);
      }
    }
    return this;
  }

  /**
   * 在指定位置后插入中间件
   */
  public insertAfter(targetName: string, middleware: Middleware | string): MiddlewareBuilder {
    const index = this.middlewares.findIndex(m => m.name === targetName);
    const toInsert = typeof middleware === 'string' 
      ? MiddlewareRegistry.get(middleware) 
      : middleware;
    
    if (toInsert) {
      if (index === -1) {
        this.middlewares.push(toInsert);
      } else {
        this.middlewares.splice(index + 1, 0, toInsert);
      }
    }
    return this;
  }

  /**
   * 移除中间件
   */
  public remove(name: string): MiddlewareBuilder {
    this.middlewares = this.middlewares.filter(m => m.name !== name);
    return this;
  }

  /**
   * 替换中间件
   */
  public replace(name: string, middleware: Middleware): MiddlewareBuilder {
    const index = this.middlewares.findIndex(m => m.name === name);
    if (index !== -1) {
      this.middlewares[index] = middleware;
    }
    return this;
  }

  /**
   * 清空所有中间件
   */
  public clear(): MiddlewareBuilder {
    this.middlewares = [];
    return this;
  }

  /**
   * 构建中间件数组
   */
  public build(): Middleware[] {
    return [...this.middlewares];
  }

  /**
   * 获取当前中间件名称列表
   */
  public getNames(): string[] {
    return this.middlewares.map(m => m.name);
  }
}
```

### 4.4 中间件组合器 (`middleware/composer.ts`)

```typescript
import type { Middleware, MiddlewareContext, MiddlewareFunction } from './types';
import type { BaseApiClient, CompletionsParams, CompletionsResult } from '../clients/base';
import type { Chunk } from '../types/chunk';
import { ChunkType } from '../types/chunk';

/**
 * 组合中间件为单一函数
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
        return next();
      }

      try {
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
 */
export function applyCompletionsMiddlewares(
  client: BaseApiClient,
  originalMethod: (payload: any, options?: any) => Promise<any>,
  middlewares: Middleware[]
): (params: CompletionsParams, options?: any) => Promise<CompletionsResult> {
  
  const composedMiddleware = compose(middlewares);

  return async (params: CompletionsParams, options?: any): Promise<CompletionsResult> => {
    // 初始化上下文
    const ctx: MiddlewareContext = {
      client,
      params,
      model: params.assistant?.model,
      mcpTools: params.mcpTools,
      onChunk: params.onChunk,
      accumulated: {
        text: '',
        thinking: '',
        toolCalls: [],
      },
    };

    // 创建AbortController
    if (params.onChunk) {
      const { abortController, cleanup } = client.createAbortController(
        params.messages?.[params.messages.length - 1]?.id
      );
      ctx.abortController = abortController;
      ctx.cleanup = cleanup;
    }

    // 定义最内层的next - 实际调用SDK
    const innerNext = async (): Promise<void> => {
      if (!ctx.sdkPayload) {
        throw new Error('sdkPayload未设置，请确保RequestTransform中间件已执行');
      }
      
      ctx.rawStream = await originalMethod.call(
        client, 
        ctx.sdkPayload, 
        { signal: ctx.abortController?.signal, ...options }
      );
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
      };
    } catch (error) {
      // 发送错误Chunk
      if (ctx.onChunk) {
        await ctx.onChunk({
          type: ChunkType.ERROR,
          error: {
            message: error instanceof Error ? error.message : String(error),
          }
        });
      }
      throw error;
    } finally {
      // 清理
      ctx.cleanup?.();
    }
  };
}
```

### 4.5 核心中间件实现

#### ErrorHandler (`core/ErrorHandler.ts`)

```typescript
import type { Middleware, MiddlewareContext } from '../types';
import { ChunkType } from '../../types/chunk';
import { MIDDLEWARE_NAMES } from '../registry';

/**
 * 错误处理中间件
 * 捕获下游中间件的错误，进行统一处理
 */
export const ErrorHandlerMiddleware: Middleware = {
  name: MIDDLEWARE_NAMES.ERROR_HANDLER,
  priority: 10,
  description: '统一错误处理',
  
  execute: async (ctx: MiddlewareContext, next: () => Promise<void>) => {
    try {
      await next();
    } catch (error) {
      console.error('[ErrorHandler] 捕获到错误:', error);
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // 分类处理不同类型的错误
      if (isAbortError(error)) {
        console.log('[ErrorHandler] 请求被用户中断');
        // 中断不算错误，不发送ERROR chunk
        return;
      }
      
      if (isRateLimitError(error)) {
        ctx.error = new Error(`API请求频率超限，请稍后重试: ${errorMessage}`);
      } else if (isAuthError(error)) {
        ctx.error = new Error(`API认证失败，请检查密钥: ${errorMessage}`);
      } else if (isNetworkError(error)) {
        ctx.error = new Error(`网络连接失败: ${errorMessage}`);
      } else {
        ctx.error = error instanceof Error ? error : new Error(errorMessage);
      }

      // 发送错误Chunk
      if (ctx.onChunk) {
        await ctx.onChunk({
          type: ChunkType.ERROR,
          error: {
            message: ctx.error.message,
            code: getErrorCode(error),
          }
        });
      }

      throw ctx.error;
    }
  }
};

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError' ||
         (error instanceof Error && error.message.includes('aborted'));
}

function isRateLimitError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('rate limit') || message.includes('429');
}

function isAuthError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('401') || message.includes('authentication') || message.includes('invalid api key');
}

function isNetworkError(error: unknown): boolean {
  return error instanceof TypeError && error.message.includes('fetch');
}

function getErrorCode(error: unknown): string {
  if (isAbortError(error)) return 'ABORTED';
  if (isRateLimitError(error)) return 'RATE_LIMIT';
  if (isAuthError(error)) return 'AUTH_ERROR';
  if (isNetworkError(error)) return 'NETWORK_ERROR';
  return 'UNKNOWN';
}
```

#### AbortHandler (`core/AbortHandler.ts`)

```typescript
import type { Middleware, MiddlewareContext } from '../types';
import { MIDDLEWARE_NAMES } from '../registry';

/**
 * 中断处理中间件
 * 监听AbortSignal，支持用户取消请求
 */
export const AbortHandlerMiddleware: Middleware = {
  name: MIDDLEWARE_NAMES.ABORT_HANDLER,
  priority: 20,
  description: '请求中断处理',
  
  execute: async (ctx: MiddlewareContext, next: () => Promise<void>) => {
    const { abortController } = ctx;
    
    if (!abortController) {
      return next();
    }

    // 检查是否已经中断
    if (abortController.signal.aborted) {
      console.log('[AbortHandler] 请求已被中断，跳过执行');
      return;
    }

    // 创建中断Promise
    const abortPromise = new Promise<never>((_, reject) => {
      abortController.signal.addEventListener('abort', () => {
        reject(new DOMException('请求被用户中断', 'AbortError'));
      }, { once: true });
    });

    try {
      // 竞速：要么正常完成，要么被中断
      await Promise.race([
        next(),
        abortPromise
      ]);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        console.log('[AbortHandler] 请求被用户中断');
        // 标记上下文
        ctx.aborted = true;
      }
      throw error;
    }
  }
};
```

#### FinalConsumer (`core/FinalConsumer.ts`)

```typescript
import type { Middleware, MiddlewareContext } from '../types';
import { ChunkType, type Chunk } from '../../types/chunk';
import { MIDDLEWARE_NAMES } from '../registry';

/**
 * 最终消费者中间件
 * 消费Chunk流，累积结果，并通知上层
 */
export const FinalConsumerMiddleware: Middleware = {
  name: MIDDLEWARE_NAMES.FINAL_CONSUMER,
  priority: 0,
  description: '消费最终Chunk流并累积结果',
  
  execute: async (ctx: MiddlewareContext, next: () => Promise<void>) => {
    // 先执行下游中间件
    await next();

    // 如果有chunk流，消费它
    if (ctx.chunkStream) {
      for await (const chunk of ctx.chunkStream) {
        await processChunk(ctx, chunk);
      }
    }

    // 发送完成信号
    if (ctx.onChunk && !ctx.aborted) {
      await ctx.onChunk({
        type: ChunkType.BLOCK_COMPLETE,
        response: {
          text: ctx.accumulated?.text,
          usage: ctx.accumulated?.usage,
          metrics: ctx.accumulated?.metrics,
        }
      });
    }
  }
};

async function processChunk(ctx: MiddlewareContext, chunk: Chunk): Promise<void> {
  // 累积数据
  switch (chunk.type) {
    case ChunkType.TEXT_DELTA:
    case ChunkType.TEXT_COMPLETE:
      ctx.accumulated!.text += chunk.text;
      break;
    case ChunkType.THINKING_DELTA:
    case ChunkType.THINKING_COMPLETE:
      ctx.accumulated!.thinking = (ctx.accumulated!.thinking || '') + chunk.text;
      break;
  }

  // 通知上层
  if (ctx.onChunk) {
    await ctx.onChunk(chunk);
  }
}
```

### 4.6 功能中间件实现

#### ThinkingExtraction (`feat/ThinkingExtraction.ts`)

```typescript
import type { Middleware, MiddlewareContext } from '../types';
import { ChunkType, type Chunk, type TextDeltaChunk } from '../../types/chunk';
import { MIDDLEWARE_NAMES } from '../registry';

/**
 * 思考过程提取中间件
 * 从文本流中提取 <think>...</think> 标签内容
 */
export const ThinkingExtractionMiddleware: Middleware = {
  name: MIDDLEWARE_NAMES.THINKING_EXTRACTION,
  priority: 50,
  description: '从文本中提取思考过程',
  
  execute: async (ctx: MiddlewareContext, next: () => Promise<void>) => {
    await next();

    // 如果没有chunk流，跳过
    if (!ctx.chunkStream) {
      return;
    }

    // 包装chunk流，提取思考内容
    const originalStream = ctx.chunkStream;
    ctx.chunkStream = extractThinking(originalStream);
  }
};

async function* extractThinking(stream: AsyncIterable<Chunk>): AsyncIterable<Chunk> {
  let buffer = '';
  let inThinking = false;
  let thinkingContent = '';
  const thinkStartTag = '<think>';
  const thinkEndTag = '</think>';

  for await (const chunk of stream) {
    // 只处理文本类型的chunk
    if (chunk.type !== ChunkType.TEXT_DELTA) {
      yield chunk;
      continue;
    }

    buffer += (chunk as TextDeltaChunk).text;

    while (buffer.length > 0) {
      if (!inThinking) {
        // 查找开始标签
        const startIndex = buffer.indexOf(thinkStartTag);
        if (startIndex === -1) {
          // 没有开始标签，输出buffer（保留可能的部分标签）
          const safeLength = Math.max(0, buffer.length - thinkStartTag.length);
          if (safeLength > 0) {
            yield { type: ChunkType.TEXT_DELTA, text: buffer.slice(0, safeLength) };
            buffer = buffer.slice(safeLength);
          }
          break;
        } else {
          // 找到开始标签
          if (startIndex > 0) {
            yield { type: ChunkType.TEXT_DELTA, text: buffer.slice(0, startIndex) };
          }
          buffer = buffer.slice(startIndex + thinkStartTag.length);
          inThinking = true;
        }
      } else {
        // 在思考块中，查找结束标签
        const endIndex = buffer.indexOf(thinkEndTag);
        if (endIndex === -1) {
          // 没有结束标签，累积思考内容
          thinkingContent += buffer;
          yield { type: ChunkType.THINKING_DELTA, text: buffer };
          buffer = '';
          break;
        } else {
          // 找到结束标签
          const thinking = buffer.slice(0, endIndex);
          thinkingContent += thinking;
          yield { type: ChunkType.THINKING_DELTA, text: thinking };
          yield { type: ChunkType.THINKING_COMPLETE, text: thinkingContent };
          
          buffer = buffer.slice(endIndex + thinkEndTag.length);
          inThinking = false;
          thinkingContent = '';
        }
      }
    }
  }

  // 处理剩余buffer
  if (buffer.length > 0) {
    if (inThinking) {
      yield { type: ChunkType.THINKING_DELTA, text: buffer };
      yield { type: ChunkType.THINKING_COMPLETE, text: thinkingContent + buffer };
    } else {
      yield { type: ChunkType.TEXT_DELTA, text: buffer };
    }
  }
}
```

### 4.7 初始化所有中间件 (`middleware/index.ts`)

```typescript
export * from './types';
export * from './builder';
export * from './composer';
export { MiddlewareRegistry, MIDDLEWARE_NAMES } from './registry';

// 导出所有中间件
export { ErrorHandlerMiddleware } from './core/ErrorHandler';
export { AbortHandlerMiddleware } from './core/AbortHandler';
export { FinalConsumerMiddleware } from './core/FinalConsumer';
export { ThinkingExtractionMiddleware } from './feat/ThinkingExtraction';

import { MiddlewareRegistry } from './registry';
import { ErrorHandlerMiddleware } from './core/ErrorHandler';
import { AbortHandlerMiddleware } from './core/AbortHandler';
import { FinalConsumerMiddleware } from './core/FinalConsumer';
import { ThinkingExtractionMiddleware } from './feat/ThinkingExtraction';

/**
 * 初始化所有内置中间件
 */
export function initializeMiddlewares(): void {
  MiddlewareRegistry.registerAll([
    FinalConsumerMiddleware,
    ErrorHandlerMiddleware,
    AbortHandlerMiddleware,
    ThinkingExtractionMiddleware,
    // 添加更多中间件...
  ]);
  
  console.log('[Middleware] 已注册中间件:', MiddlewareRegistry.getNames());
}
```

## ✅ 完成标准

1. [ ] 中间件类型系统完成
2. [ ] 核心中间件实现（Error, Abort, FinalConsumer）
3. [ ] 功能中间件实现（Thinking, ToolUse）
4. [ ] MiddlewareBuilder流式API可用
5. [ ] 中间件可以正确组合和执行

## 🧪 测试用例

```typescript
// tests/middleware/builder.test.ts
import { MiddlewareBuilder, MIDDLEWARE_NAMES, initializeMiddlewares } from '@/shared/aiCore/middleware';

describe('MiddlewareBuilder', () => {
  beforeAll(() => {
    initializeMiddlewares();
  });

  test('should build default middleware chain', () => {
    const builder = MiddlewareBuilder.withDefaults();
    const middlewares = builder.build();
    
    expect(middlewares.length).toBeGreaterThan(0);
    expect(builder.getNames()).toContain(MIDDLEWARE_NAMES.ERROR_HANDLER);
  });

  test('should support remove middleware', () => {
    const builder = MiddlewareBuilder.withDefaults();
    builder.remove(MIDDLEWARE_NAMES.THINKING_EXTRACTION);
    
    expect(builder.getNames()).not.toContain(MIDDLEWARE_NAMES.THINKING_EXTRACTION);
  });
});
```

## ➡️ 下一步

完成Phase 4后，继续 [Phase 5: 供应商迁移](./phase-5-providers.md)
