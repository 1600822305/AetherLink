# Cherry Studio 架构参考

> 本文档记录 Cherry Studio 的核心架构设计，供改造参考

---

## 1. 目录结构

```
cherry-studio/src/renderer/src/aiCore/
├── AI_CORE_DESIGN.md           # 架构设计文档
├── index.ts                    # 导出入口
├── index_new.ts                # 新版入口（Modern + Legacy）
│
├── legacy/                     # 传统实现
│   ├── index.ts                # Legacy AiProvider 入口
│   ├── clients/                # SDK 客户端
│   │   ├── ApiClientFactory.ts
│   │   ├── BaseApiClient.ts
│   │   ├── MixedBaseApiClient.ts
│   │   ├── openai/
│   │   │   ├── OpenAIAPIClient.ts
│   │   │   ├── OpenAIBaseClient.ts
│   │   │   └── OpenAIResponseAPIClient.ts
│   │   ├── anthropic/
│   │   │   └── AnthropicAPIClient.ts
│   │   ├── gemini/
│   │   │   ├── GeminiAPIClient.ts
│   │   │   └── VertexAPIClient.ts
│   │   └── ...
│   └── middleware/             # 中间件
│       ├── builder.ts
│       ├── composer.ts
│       ├── register.ts
│       ├── schemas.ts
│       ├── types.ts
│       ├── common/
│       │   ├── AbortHandlerMiddleware.ts
│       │   ├── ErrorHandlerMiddleware.ts
│       │   ├── FinalChunkConsumerMiddleware.ts
│       │   └── LoggingMiddleware.ts
│       ├── core/
│       │   ├── McpToolChunkMiddleware.ts
│       │   ├── RawStreamListenerMiddleware.ts
│       │   ├── ResponseTransformMiddleware.ts
│       │   ├── StreamAdapterMiddleware.ts
│       │   ├── TextChunkMiddleware.ts
│       │   ├── ThinkChunkMiddleware.ts
│       │   ├── TransformCoreToSdkParamsMiddleware.ts
│       │   └── WebSearchMiddleware.ts
│       └── feat/
│           ├── ImageGenerationMiddleware.ts
│           ├── ThinkingTagExtractionMiddleware.ts
│           └── ToolUseExtractionMiddleware.ts
│
├── chunk/                      # Chunk 适配器
│   ├── AiSdkToChunkAdapter.ts
│   └── handleToolCallChunk.ts
│
├── middleware/                 # 新版中间件（AI SDK）
│   ├── AiSdkMiddlewareBuilder.ts
│   └── ...
│
├── provider/                   # Provider 配置
│   ├── factory.ts
│   ├── providerConfig.ts
│   └── providerInitialization.ts
│
├── plugins/                    # 插件系统
│   └── PluginBuilder.ts
│
└── types/                      # 类型定义
    └── ...
```

---

## 2. 核心类关系

```
┌─────────────────────────────────────────────────────────────────┐
│                      ModernAiProvider                           │
│  (双轨入口 - Modern SDK 优先，Legacy 兜底)                        │
└─────────────────────────────┬───────────────────────────────────┘
                              │
        ┌─────────────────────┴─────────────────────┐
        │                                           │
        ▼                                           ▼
┌───────────────────┐                    ┌───────────────────┐
│  Modern SDK Path  │                    │  Legacy Path      │
│  (AI SDK)         │                    │  (AiProvider)     │
└─────────┬─────────┘                    └─────────┬─────────┘
          │                                        │
          ▼                                        ▼
┌───────────────────┐                    ┌───────────────────┐
│ AiSdkMiddleware   │                    │ Middleware Chain  │
│ Builder           │                    │ (Redux-style)     │
└─────────┬─────────┘                    └─────────┬─────────┘
          │                                        │
          ▼                                        ▼
┌───────────────────┐                    ┌───────────────────┐
│ createExecutor()  │                    │ BaseApiClient     │
│ + Plugins         │                    │ (各供应商实现)     │
└─────────┬─────────┘                    └─────────┬─────────┘
          │                                        │
          ▼                                        ▼
┌───────────────────┐                    ┌───────────────────┐
│ AiSdkToChunk      │                    │ ResponseTransform │
│ Adapter           │                    │ Middleware        │
└─────────┬─────────┘                    └─────────┬─────────┘
          │                                        │
          └─────────────────┬──────────────────────┘
                            │
                            ▼
                   ┌─────────────────┐
                   │  Chunk 事件     │
                   │  (统一输出)     │
                   └─────────────────┘
```

---

## 3. 中间件执行流程

### 3.1 默认中间件链（从外到内）

```
1. FinalChunkConsumerMiddleware    # 最终消费者，累积结果
      ↓
2. ErrorHandlerMiddleware          # 错误处理
      ↓
3. TransformCoreToSdkParamsMiddleware  # 参数转换
      ↓
4. AbortHandlerMiddleware          # 中断处理
      ↓
5. McpToolChunkMiddleware          # MCP 工具调用
      ↓
6. TextChunkMiddleware             # 文本处理
      ↓
7. WebSearchMiddleware             # Web 搜索
      ↓
8. ToolUseExtractionMiddleware     # 工具标签提取
      ↓
9. ThinkingTagExtractionMiddleware # 思考标签提取
      ↓
10. ThinkChunkMiddleware           # 思考处理
      ↓
11. ResponseTransformMiddleware    # 响应转换
      ↓
12. StreamAdapterMiddleware        # 流适配
      ↓
13. RawStreamListenerMiddleware    # 原始流监听
      ↓
   [SDK 调用]
```

### 3.2 中间件签名

```typescript
// Redux 风格中间件
type CompletionsMiddleware = (api: MiddlewareAPI) => 
  (next: DispatchFunction) => 
  (context: CompletionsContext, params: CompletionsParams) => 
  Promise<CompletionsResult>;

// 示例
const ExampleMiddleware: CompletionsMiddleware = (api) => (next) => 
  async (context, params) => {
    // 前置处理
    console.log('Before');
    
    // 调用下一个中间件
    const result = await next(context, params);
    
    // 后置处理
    console.log('After');
    
    return result;
  };
```

---

## 4. BaseApiClient 核心接口

```typescript
abstract class BaseApiClient<
  TSdkInstance,    // SDK 实例类型
  TSdkParams,      // SDK 请求参数
  TRawOutput,      // 原始输出
  TRawChunk,       // 流式 Chunk
  TMessageParam,   // 消息参数
  TToolCall,       // 工具调用
  TSdkTool         // SDK 工具格式
> {
  // ===== 核心方法 =====
  abstract getSdkInstance(): Promise<TSdkInstance> | TSdkInstance;
  abstract createCompletions(payload: TSdkParams, options?: RequestOptions): Promise<TRawOutput>;
  abstract listModels(): Promise<SdkModel[]>;
  
  // ===== 转换器 =====
  abstract getRequestTransformer(): RequestTransformer<TSdkParams, TMessageParam>;
  abstract getResponseChunkTransformer(): ResponseChunkTransformer<TRawChunk>;
  
  // ===== 工具转换 =====
  abstract convertMcpToolsToSdkTools(mcpTools: MCPTool[]): TSdkTool[];
  abstract convertSdkToolCallToMcp(toolCall: TToolCall, mcpTools: MCPTool[]): MCPTool | undefined;
  abstract convertSdkToolCallToMcpToolResponse(toolCall: TToolCall, mcpTool: MCPTool): MCPToolResponse;
  abstract convertMcpToolResponseToSdkMessageParam(
    response: MCPToolResponse,
    result: MCPCallToolResponse,
    model: Model
  ): TMessageParam | undefined;
  
  // ===== 消息构建 =====
  abstract buildSdkMessages(
    currentMessages: TMessageParam[],
    output: TRawOutput | string | undefined,
    toolResults: TMessageParam[],
    toolCalls?: TToolCall[]
  ): TMessageParam[];
  abstract extractMessagesFromSdkPayload(payload: TSdkParams): TMessageParam[];
  abstract estimateMessageTokens(message: TMessageParam): number;
  
  // ===== 通用方法 =====
  getClientCompatibilityType(model?: Model): string[];
  getBaseURL(): string;
  getApiKey(): string;
  getDefaultHeaders(): Record<string, string>;
}
```

---

## 5. Chunk 类型系统

```typescript
enum ChunkType {
  // 响应生命周期
  LLM_RESPONSE_CREATED = 'llm_response_created',
  LLM_RESPONSE_COMPLETE = 'llm_response_complete',
  BLOCK_CREATED = 'block_created',
  BLOCK_COMPLETE = 'block_complete',
  
  // 文本内容
  TEXT_START = 'text_start',
  TEXT_DELTA = 'text_delta',
  TEXT_COMPLETE = 'text_complete',
  
  // 思考/推理
  THINKING_START = 'thinking_start',
  THINKING_DELTA = 'thinking_delta',
  THINKING_COMPLETE = 'thinking_complete',
  
  // MCP 工具
  MCP_TOOL_IN_PROGRESS = 'mcp_tool_in_progress',
  MCP_TOOL_COMPLETE = 'mcp_tool_complete',
  MCP_TOOL_CALL_BEGIN = 'mcp_tool_call_begin',
  MCP_TOOL_CALL_RESPONSE = 'mcp_tool_call_response',
  MCP_TOOL_CALL_ERROR = 'mcp_tool_call_error',
  
  // 图片
  IMAGE_CREATED = 'image_created',
  IMAGE_COMPLETE = 'image_complete',
  
  // Web 搜索
  LLM_WEB_SEARCH_COMPLETE = 'llm_web_search_complete',
  
  // 错误
  ERROR = 'error',
  
  // 原始数据
  RAW = 'raw',
}
```

---

## 6. 关键文件参考

### 6.1 composer.ts 核心逻辑

```typescript
// 路径: cherry-studio/src/renderer/src/aiCore/legacy/middleware/composer.ts

function compose(...funcs) {
  if (funcs.length === 0) return (...args) => args[0];
  if (funcs.length === 1) return funcs[0];
  return funcs.reduce((a, b) => (...args) => a(b(...args)));
}

export function applyCompletionsMiddlewares(
  client: BaseApiClient,
  originalMethod: (payload, options?) => Promise<TRawOutput>,
  middlewares: CompletionsMiddleware[]
) {
  return async function enhancedCompletionsMethod(params, options?) {
    const ctx = createCompletionsContext(client, [params]);
    
    const api = {
      getContext: () => ctx,
      getOriginalArgs: () => [params],
    };
    
    const finalDispatch = async (context) => {
      const sdkPayload = context._internal?.sdkPayload;
      const rawOutput = await originalMethod.call(client, sdkPayload, options);
      return { rawOutput };
    };
    
    const chain = middlewares.map(m => m(api));
    const enhancedDispatch = compose(...chain)(finalDispatch);
    
    ctx._internal.enhancedDispatch = enhancedDispatch;
    
    return enhancedDispatch(ctx, params);
  };
}
```

### 6.2 McpToolChunkMiddleware 关键逻辑

```typescript
// 路径: cherry-studio/src/renderer/src/aiCore/legacy/middleware/core/McpToolChunkMiddleware.ts

export const McpToolChunkMiddleware = (api) => (next) => async (context, params) => {
  const { mcpTools } = params;
  const { recursionDepth } = context._internal.toolProcessingState;
  
  // 最大递归深度检查
  if (recursionDepth >= MAX_DEPTH) {
    return next(context, params);
  }
  
  // 收集工具调用
  const toolCalls = [];
  
  // ... 执行下游中间件并收集工具调用
  
  // 如果有工具调用
  if (toolCalls.length > 0) {
    // 执行工具
    const results = await executeTools(toolCalls, mcpTools);
    
    // 构建新消息
    const newMessages = buildMessagesWithToolResults(
      context._internal.sdkPayload.messages,
      toolCalls,
      results
    );
    
    // 递归调用
    context._internal.toolProcessingState.recursionDepth++;
    return context._internal.enhancedDispatch(context, {
      ...params,
      messages: newMessages,
    });
  }
  
  return result;
};
```

---

## 7. 与 AetherLink 对应关系

| Cherry Studio | AetherLink 当前 | AetherLink 目标 |
|--------------|----------------|----------------|
| `legacy/index.ts` | `AiProvider.ts` | 重构 |
| `legacy/clients/` | `clients/` | 增强 |
| `legacy/middleware/` | `middleware/` | 完全重构 |
| `chunk/AiSdkToChunkAdapter.ts` | `adapters/AiSdkToChunkAdapter.ts` | 保留 |
| `types/chunk.ts` | `types/chunk.ts` | 增强 |

---

## 8. 参考链接

- Cherry Studio GitHub: https://github.com/kangfenmao/cherry-studio
- 核心目录: `src/renderer/src/aiCore/`
- 设计文档: `src/renderer/src/aiCore/AI_CORE_DESIGN.md`
