# Phase 1: 中间件系统重构

> **目标**：完全对标 Cherry Studio 的中间件架构
> **预计工时**：3 天

---

## 1. 核心架构对比

### 当前实现 (Koa 洋葱模型)
```typescript
// 当前：简单的洋葱模型
export function compose(middlewares: Middleware[]): MiddlewareFunction {
  return async (ctx, next) => {
    const dispatch = async (i: number): Promise<void> => {
      const middleware = middlewares[i];
      await middleware.execute(ctx, () => dispatch(i + 1));
    };
    return dispatch(0);
  };
}
```

### 目标实现 (Redux 风格 - 参考 CS)
```typescript
// 目标：Redux 风格 compose
function compose(...funcs: Array<(...args: any[]) => any>) {
  if (funcs.length === 0) return (...args: any[]) => args[0];
  if (funcs.length === 1) return funcs[0];
  return funcs.reduce((a, b) => (...args) => a(b(...args)));
}

// 中间件签名
type CompletionsMiddleware = (api: MiddlewareAPI) => 
  (next: DispatchFunction) => 
  (context: CompletionsContext, params: CompletionsParams) => 
  Promise<CompletionsResult>;
```

---

## 2. 实施步骤

### 2.1 重构类型定义 `middleware/types.ts`

**文件路径**: `src/shared/aiCore/middleware/types.ts`

```typescript
/**
 * 中间件类型定义 - 对标 Cherry Studio
 */

// 标记符号（用于识别上下文对象）
export const MIDDLEWARE_CONTEXT_SYMBOL = Symbol('AiCoreMiddlewareContext');

/**
 * 基础上下文
 */
export interface BaseContext {
  [MIDDLEWARE_CONTEXT_SYMBOL]: true;
  methodName: string;
  originalArgs: unknown[];
}

/**
 * Completions 上下文 - 核心
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
  /** API 客户端实例 */
  apiClientInstance: BaseApiClient<TSdkInstance, TSdkParams, TRawOutput, TRawChunk, TMessageParam, TToolCall, TSdkTool>;
  
  /** 内部状态 */
  _internal: {
    /** 工具处理状态 */
    toolProcessingState: {
      recursionDepth: number;
      isRecursiveCall: boolean;
    };
    /** SDK 请求参数 */
    sdkPayload?: TSdkParams;
    /** 流程控制 */
    flowControl?: {
      abortSignal?: AbortSignal;
    };
    /** 自定义状态 */
    customState?: {
      sdkMetadata?: {
        timeout?: number;
      };
    };
    /** 观察者 */
    observer: Record<string, unknown>;
    /** 增强的 dispatch（用于递归调用）*/
    enhancedDispatch?: DispatchFunction;
  };
}

/**
 * 中间件 API
 */
export interface MiddlewareAPI<TContext extends BaseContext = BaseContext, TArgs extends unknown[] = unknown[]> {
  getContext: () => TContext;
  getOriginalArgs: () => TArgs;
}

/**
 * Dispatch 函数类型
 */
export type DispatchFunction<TContext = CompletionsContext, TParams = CompletionsParams> = 
  (context: TContext, params: TParams) => Promise<CompletionsResult>;

/**
 * Completions 中间件类型
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
    CompletionsParams
  >
) => (
  context: CompletionsContext<TSdkParams, TMessageParam, TToolCall, TSdkInstance, TRawOutput, TRawChunk, TSdkTool>,
  params: CompletionsParams
) => Promise<CompletionsResult>;

/**
 * 具名中间件
 */
export interface NamedMiddleware<TMiddleware = CompletionsMiddleware> {
  name: string;
  middleware: TMiddleware;
}
```

### 2.2 实现 Redux 风格 Composer `middleware/composer.ts`

**文件路径**: `src/shared/aiCore/middleware/composer.ts`

```typescript
/**
 * 中间件组合器 - 对标 Cherry Studio composer.ts
 */
import type { BaseApiClient } from '../clients/BaseApiClient';
import type { CompletionsParams, CompletionsResult } from './schemas';
import type {
  BaseContext,
  CompletionsContext,
  CompletionsMiddleware,
  MiddlewareAPI,
  MIDDLEWARE_CONTEXT_SYMBOL,
} from './types';

/**
 * Redux 风格 compose
 */
function compose(...funcs: Array<(...args: any[]) => any>): (...args: any[]) => any {
  if (funcs.length === 0) {
    return (...args: any[]) => (args.length > 0 ? args[0] : undefined);
  }
  if (funcs.length === 1) {
    return funcs[0];
  }
  return funcs.reduce((a, b) => (...args: any[]) => a(b(...args)));
}

/**
 * 创建初始上下文
 */
function createCompletionsContext<TSdkParams, TMessageParam, TToolCall, TSdkInstance, TRawOutput, TRawChunk, TSdkTool>(
  client: BaseApiClient<TSdkInstance, TSdkParams, TRawOutput, TRawChunk, TMessageParam, TToolCall, TSdkTool>,
  callArgs: [CompletionsParams]
): CompletionsContext<TSdkParams, TMessageParam, TToolCall, TSdkInstance, TRawOutput, TRawChunk, TSdkTool> {
  const base: BaseContext = {
    [MIDDLEWARE_CONTEXT_SYMBOL]: true,
    methodName: 'completions',
    originalArgs: callArgs,
  };
  
  return {
    ...base,
    apiClientInstance: client,
    _internal: {
      toolProcessingState: {
        recursionDepth: 0,
        isRecursiveCall: false,
      },
      observer: {},
    },
  };
}

/**
 * 应用 Completions 中间件
 * 对标 Cherry Studio applyCompletionsMiddlewares
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
  
  return async function enhancedCompletionsMethod(
    params: CompletionsParams,
    options?: RequestOptions
  ): Promise<CompletionsResult> {
    const originalCallArgs: [CompletionsParams] = [params];
    const ctx = createCompletionsContext(client, originalCallArgs);

    const api: MiddlewareAPI = {
      getContext: () => ctx,
      getOriginalArgs: () => originalCallArgs,
    };

    // 最终 dispatch - 调用原始 SDK 方法
    const finalDispatch = async (context: typeof ctx): Promise<CompletionsResult> => {
      const sdkPayload = context._internal?.sdkPayload;
      if (!sdkPayload) {
        throw new Error('SDK payload not found. Middleware chain should have transformed parameters.');
      }

      const abortSignal = context._internal.flowControl?.abortSignal;
      const timeout = context._internal.customState?.sdkMetadata?.timeout;

      const rawOutput = await originalMethod.call(client, sdkPayload, {
        ...options,
        signal: abortSignal,
        timeout,
      });

      return { rawOutput } as CompletionsResult;
    };

    // 构建中间件链
    const chain = middlewares.map((middleware) => middleware(api));
    const composedMiddleware = compose(...chain);
    const enhancedDispatch = composedMiddleware(finalDispatch);

    // 保存 enhancedDispatch 供递归调用
    ctx._internal.enhancedDispatch = enhancedDispatch;

    return enhancedDispatch(ctx, params);
  };
}
```

### 2.3 实现中间件构建器 `middleware/builder.ts`

**文件路径**: `src/shared/aiCore/middleware/builder.ts`

```typescript
/**
 * 中间件构建器 - 对标 Cherry Studio CompletionsMiddlewareBuilder
 */
import type { NamedMiddleware, CompletionsMiddleware } from './types';
import { DefaultCompletionsNamedMiddlewares } from './register';

export class CompletionsMiddlewareBuilder {
  private middlewares: NamedMiddleware[] = [];

  /**
   * 创建带默认中间件的构建器
   */
  static withDefaults(): CompletionsMiddlewareBuilder {
    const builder = new CompletionsMiddlewareBuilder();
    builder.middlewares = [...DefaultCompletionsNamedMiddlewares];
    return builder;
  }

  /**
   * 创建空构建器
   */
  static empty(): CompletionsMiddlewareBuilder {
    return new CompletionsMiddlewareBuilder();
  }

  /**
   * 添加中间件
   */
  add(namedMiddleware: NamedMiddleware): this {
    this.middlewares.push(namedMiddleware);
    return this;
  }

  /**
   * 在指定中间件之后插入
   */
  insertAfter(targetName: string, namedMiddleware: NamedMiddleware): this {
    const index = this.middlewares.findIndex(m => m.name === targetName);
    if (index !== -1) {
      this.middlewares.splice(index + 1, 0, namedMiddleware);
    } else {
      console.warn(`[MiddlewareBuilder] Middleware '${targetName}' not found`);
    }
    return this;
  }

  /**
   * 在指定中间件之前插入
   */
  insertBefore(targetName: string, namedMiddleware: NamedMiddleware): this {
    const index = this.middlewares.findIndex(m => m.name === targetName);
    if (index !== -1) {
      this.middlewares.splice(index, 0, namedMiddleware);
    } else {
      console.warn(`[MiddlewareBuilder] Middleware '${targetName}' not found`);
    }
    return this;
  }

  /**
   * 移除中间件
   */
  remove(name: string): this {
    this.middlewares = this.middlewares.filter(m => m.name !== name);
    return this;
  }

  /**
   * 替换中间件
   */
  replace(name: string, namedMiddleware: NamedMiddleware): this {
    const index = this.middlewares.findIndex(m => m.name === name);
    if (index !== -1) {
      this.middlewares[index] = namedMiddleware;
    }
    return this;
  }

  /**
   * 检查是否包含中间件
   */
  has(name: string): boolean {
    return this.middlewares.some(m => m.name === name);
  }

  /**
   * 清空所有中间件
   */
  clear(): this {
    this.middlewares = [];
    return this;
  }

  /**
   * 构建最终中间件数组
   */
  build(): CompletionsMiddleware[] {
    return this.middlewares.map(m => m.middleware);
  }

  /**
   * 获取具名中间件数组（调试用）
   */
  buildNamed(): NamedMiddleware[] {
    return [...this.middlewares];
  }
}
```

### 2.4 实现中间件注册表 `middleware/register.ts`

**文件路径**: `src/shared/aiCore/middleware/register.ts`

```typescript
/**
 * 中间件注册表 - 对标 Cherry Studio register.ts
 */

// 导入所有中间件
import * as ErrorHandlerModule from './common/ErrorHandlerMiddleware';
import * as AbortHandlerModule from './common/AbortHandlerMiddleware';
import * as FinalChunkConsumerModule from './common/FinalChunkConsumerMiddleware';
import * as LoggingModule from './common/LoggingMiddleware';
import * as TransformParamsModule from './core/TransformCoreToSdkParamsMiddleware';
import * as StreamAdapterModule from './core/StreamAdapterMiddleware';
import * as ResponseTransformModule from './core/ResponseTransformMiddleware';
import * as TextChunkModule from './core/TextChunkMiddleware';
import * as ThinkChunkModule from './core/ThinkChunkMiddleware';
import * as RawStreamListenerModule from './core/RawStreamListenerMiddleware';
import * as McpToolChunkModule from './core/McpToolChunkMiddleware';
import * as WebSearchModule from './core/WebSearchMiddleware';
import * as ThinkingTagExtractionModule from './feat/ThinkingTagExtractionMiddleware';
import * as ToolUseExtractionModule from './feat/ToolUseExtractionMiddleware';
import * as ImageGenerationModule from './feat/ImageGenerationMiddleware';

/**
 * 中间件注册表
 */
export const MiddlewareRegistry = {
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
  
  // 核心流程中间件
  [TransformParamsModule.MIDDLEWARE_NAME]: {
    name: TransformParamsModule.MIDDLEWARE_NAME,
    middleware: TransformParamsModule.TransformCoreToSdkParamsMiddleware,
  },
  [StreamAdapterModule.MIDDLEWARE_NAME]: {
    name: StreamAdapterModule.MIDDLEWARE_NAME,
    middleware: StreamAdapterModule.StreamAdapterMiddleware,
  },
  [ResponseTransformModule.MIDDLEWARE_NAME]: {
    name: ResponseTransformModule.MIDDLEWARE_NAME,
    middleware: ResponseTransformModule.ResponseTransformMiddleware,
  },
  [TextChunkModule.MIDDLEWARE_NAME]: {
    name: TextChunkModule.MIDDLEWARE_NAME,
    middleware: TextChunkModule.TextChunkMiddleware,
  },
  [ThinkChunkModule.MIDDLEWARE_NAME]: {
    name: ThinkChunkModule.MIDDLEWARE_NAME,
    middleware: ThinkChunkModule.ThinkChunkMiddleware,
  },
  [RawStreamListenerModule.MIDDLEWARE_NAME]: {
    name: RawStreamListenerModule.MIDDLEWARE_NAME,
    middleware: RawStreamListenerModule.RawStreamListenerMiddleware,
  },
  
  // 功能中间件
  [McpToolChunkModule.MIDDLEWARE_NAME]: {
    name: McpToolChunkModule.MIDDLEWARE_NAME,
    middleware: McpToolChunkModule.McpToolChunkMiddleware,
  },
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
} as const;

/**
 * 默认 Completions 中间件配置
 * 顺序：从外到内执行
 */
export const DefaultCompletionsNamedMiddlewares = [
  MiddlewareRegistry[FinalChunkConsumerModule.MIDDLEWARE_NAME],     // 最终消费者
  MiddlewareRegistry[ErrorHandlerModule.MIDDLEWARE_NAME],           // 错误处理
  MiddlewareRegistry[TransformParamsModule.MIDDLEWARE_NAME],        // 参数转换
  MiddlewareRegistry[AbortHandlerModule.MIDDLEWARE_NAME],           // 中止处理
  MiddlewareRegistry[McpToolChunkModule.MIDDLEWARE_NAME],           // MCP 工具
  MiddlewareRegistry[TextChunkModule.MIDDLEWARE_NAME],              // 文本处理
  MiddlewareRegistry[WebSearchModule.MIDDLEWARE_NAME],              // Web 搜索
  MiddlewareRegistry[ToolUseExtractionModule.MIDDLEWARE_NAME],      // 工具提取
  MiddlewareRegistry[ThinkingTagExtractionModule.MIDDLEWARE_NAME],  // 思考标签提取
  MiddlewareRegistry[ThinkChunkModule.MIDDLEWARE_NAME],             // 思考处理
  MiddlewareRegistry[ResponseTransformModule.MIDDLEWARE_NAME],      // 响应转换
  MiddlewareRegistry[StreamAdapterModule.MIDDLEWARE_NAME],          // 流适配
  MiddlewareRegistry[RawStreamListenerModule.MIDDLEWARE_NAME],      // 原始流监听
];
```

### 2.5 实现核心中间件

需要实现 13 个中间件，分为三类：

#### 2.5.1 通用中间件 (`middleware/common/`)

| 中间件 | 职责 |
|--------|------|
| `ErrorHandlerMiddleware` | 统一错误处理和分类 |
| `AbortHandlerMiddleware` | 请求中断处理 |
| `FinalChunkConsumerMiddleware` | 消费 Chunk 流，累积结果 |
| `LoggingMiddleware` | 请求响应日志 |

#### 2.5.2 核心中间件 (`middleware/core/`)

| 中间件 | 职责 |
|--------|------|
| `TransformCoreToSdkParamsMiddleware` | 将请求参数转换为 SDK 格式 |
| `StreamAdapterMiddleware` | 适配各种流格式 |
| `ResponseTransformMiddleware` | SDK 响应转换为 Chunk |
| `TextChunkMiddleware` | 处理文本 Chunk |
| `ThinkChunkMiddleware` | 处理思考 Chunk |
| `RawStreamListenerMiddleware` | 原始流监听（Anthropic等） |
| `McpToolChunkMiddleware` | **MCP 工具调用处理（重点）** |
| `WebSearchMiddleware` | Web 搜索处理 |

#### 2.5.3 功能中间件 (`middleware/feat/`)

| 中间件 | 职责 |
|--------|------|
| `ThinkingTagExtractionMiddleware` | 提取 `<think>` 标签 |
| `ToolUseExtractionMiddleware` | 提取 `<tool_use>` 标签 |
| `ImageGenerationMiddleware` | 图片生成处理 |

---

## 3. 验收标准

- [ ] 中间件可动态添加、移除、替换
- [ ] 中间件按正确顺序执行
- [ ] 支持递归工具调用
- [ ] 错误正确分类和处理
- [ ] 中断信号正确传递

---

## 4. 参考实现

- Cherry Studio: `src/renderer/src/aiCore/legacy/middleware/`
- 关键文件：
  - `composer.ts` - 中间件组合
  - `builder.ts` - 构建器
  - `register.ts` - 注册表
  - `types.ts` - 类型定义
