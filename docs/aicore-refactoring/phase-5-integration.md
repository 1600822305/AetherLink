# Phase 5: 集成测试与优化

> **目标**：完成 AiProvider 入口重构，集成测试，性能优化
> **预计工时**：1-3 天

---

## 1. AiProvider 入口重构

### 1.1 当前 AiProvider 问题

1. **工具调用循环在入口层**：应该移入中间件
2. **双层适配器**：`OpenAIToAiSdkAdapter` → `AiSdkToChunkAdapter`，可以简化
3. **缺少中间件集成**：当前没有使用中间件链

### 1.2 目标 AiProvider

```typescript
/**
 * AiProvider - 重构后的入口
 * 对标 Cherry Studio legacy/index.ts
 */
export default class AiProvider {
  private apiClient: BaseApiClient;
  private provider: Provider;

  constructor(provider: Provider) {
    this.provider = provider;
    this.apiClient = ApiClientFactory.create(provider);
  }

  /**
   * 执行 Completions 请求
   */
  public async completions(
    params: CompletionsParams,
    options?: RequestOptions
  ): Promise<CompletionsResult> {
    const model = params.assistant?.model;
    if (!model) {
      throw new Error('Model is required');
    }

    // 1. 获取正确的客户端
    let client = this.getClientForModel(model);

    // 2. 构建中间件链
    const builder = CompletionsMiddlewareBuilder.withDefaults();
    this.configureMiddlewares(builder, client, model, params);

    // 3. 获取最终中间件数组
    const middlewares = builder.build();
    console.log('[AiProvider] Middlewares:', builder.buildNamed().map(m => m.name));

    // 4. 应用中间件并执行
    const wrappedCompletions = applyCompletionsMiddlewares(
      client,
      client.createCompletions.bind(client),
      middlewares
    );

    return wrappedCompletions(params, options);
  }

  /**
   * 带 Trace 的 Completions
   */
  public async completionsForTrace(
    params: CompletionsParams,
    options?: RequestOptions
  ): Promise<CompletionsResult> {
    const traceName = params.assistant?.model?.name
      ? `${params.assistant.model.name}.${params.callType}`
      : `LLM.${params.callType}`;

    const traceParams: StartSpanParams = {
      name: traceName,
      tag: 'LLM',
      topicId: params.topicId || '',
      modelName: params.assistant?.model?.name,
    };

    return withSpanResult(this.completions.bind(this), traceParams, params, options);
  }

  /**
   * 根据模型获取客户端
   */
  private getClientForModel(model: Model): BaseApiClient {
    // 处理混合客户端（如 Aihubmix）
    if ('getClientForModel' in this.apiClient) {
      return (this.apiClient as any).getClientForModel(model);
    }
    
    // 处理 Response API 客户端
    if ('getClient' in this.apiClient) {
      return (this.apiClient as any).getClient(model);
    }

    return this.apiClient;
  }

  /**
   * 配置中间件
   */
  private configureMiddlewares(
    builder: CompletionsMiddlewareBuilder,
    client: BaseApiClient,
    model: Model,
    params: CompletionsParams
  ): void {
    const clientTypes = client.getClientCompatibilityType(model);

    // 非 OpenAI 兼容客户端移除思考标签提取
    const isOpenAICompatible = clientTypes.includes('OpenAIAPIClient') ||
                               clientTypes.includes('OpenAIClient');
    if (!isOpenAICompatible) {
      builder.remove('ThinkingTagExtractionMiddleware');
    }

    // 非 Anthropic/Response 客户端移除原始流监听
    const isAnthropicOrResponse = clientTypes.includes('AnthropicAPIClient') ||
                                   clientTypes.includes('OpenAIResponseAPIClient');
    if (!isAnthropicOrResponse) {
      builder.remove('RawStreamListenerMiddleware');
    }

    // 无 Web 搜索时移除
    if (!params.enableWebSearch) {
      builder.remove('WebSearchMiddleware');
    }

    // 无 MCP 工具时移除工具相关中间件
    if (!params.mcpTools?.length) {
      builder.remove('ToolUseExtractionMiddleware');
      builder.remove('McpToolChunkMiddleware');
    }

    // 检查是否支持函数调用
    if (params.mcpTools?.length && this.isFunctionCallingModel(model, client)) {
      builder.remove('ToolUseExtractionMiddleware');
    }

    // 测试模式简化中间件
    if (params.callType === 'test') {
      builder.remove('ErrorHandlerMiddleware');
      builder.remove('FinalChunkConsumerMiddleware');
    }

    // 非聊天模式移除中断处理
    if (params.callType !== 'chat' && params.callType !== 'check') {
      builder.remove('AbortHandlerMiddleware');
    }
  }

  /**
   * 检查模型是否支持函数调用
   */
  private isFunctionCallingModel(model: Model, client: BaseApiClient): boolean {
    // 使用客户端的判断逻辑
    return (client as any).isFunctionCallingSupported?.(model) ?? true;
  }

  // ... 其他方法 (models, generateImage, etc.)
}
```

---

## 2. 集成测试

### 2.1 测试用例

```typescript
// __tests__/AiProvider.test.ts

describe('AiProvider', () => {
  describe('completions', () => {
    it('should handle basic chat completion', async () => {
      const provider = createTestProvider('openai');
      const aiProvider = new AiProvider(provider);
      
      const result = await aiProvider.completions({
        callType: 'chat',
        messages: [{ role: 'user', content: 'Hello' }],
        assistant: { id: 'test', model: { id: 'gpt-4' } },
      });
      
      expect(result.getText()).toBeDefined();
    });

    it('should handle MCP tool calls', async () => {
      const provider = createTestProvider('openai');
      const aiProvider = new AiProvider(provider);
      
      const chunks: Chunk[] = [];
      const result = await aiProvider.completions({
        callType: 'chat',
        messages: [{ role: 'user', content: 'Search for weather' }],
        assistant: { id: 'test', model: { id: 'gpt-4' } },
        mcpTools: [{ name: 'search', description: 'Search tool' }],
        onChunk: (chunk) => chunks.push(chunk),
      });
      
      expect(chunks.some(c => c.type === ChunkType.MCP_TOOL_IN_PROGRESS)).toBe(true);
    });

    it('should handle abort signal', async () => {
      const provider = createTestProvider('openai');
      const aiProvider = new AiProvider(provider);
      
      const abortController = new AbortController();
      setTimeout(() => abortController.abort(), 100);
      
      await expect(
        aiProvider.completions({
          callType: 'chat',
          messages: [{ role: 'user', content: 'Long response please' }],
          assistant: { id: 'test', model: { id: 'gpt-4' } },
          abortSignal: abortController.signal,
        })
      ).rejects.toThrow('aborted');
    });
  });

  describe('middleware chain', () => {
    it('should execute middlewares in correct order', async () => {
      const executionOrder: string[] = [];
      
      // Mock middlewares to track execution
      // ...
      
      expect(executionOrder).toEqual([
        'FinalChunkConsumer',
        'ErrorHandler',
        'TransformParams',
        // ...
      ]);
    });
  });
});
```

### 2.2 Provider 测试矩阵

| Provider | Chat | Stream | Tools | Web Search | Image |
|----------|------|--------|-------|------------|-------|
| OpenAI | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| Anthropic | ⬜ | ⬜ | ⬜ | ⬜ | N/A |
| Gemini | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| Azure | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| DeepSeek | ⬜ | ⬜ | ⬜ | N/A | N/A |
| Moonshot | ⬜ | ⬜ | ⬜ | N/A | N/A |

---

## 3. 性能优化

### 3.1 中间件优化

```typescript
// 1. 惰性创建中间件实例
const middlewareCache = new Map<string, CompletionsMiddleware>();

function getMiddleware(name: string): CompletionsMiddleware {
  if (!middlewareCache.has(name)) {
    middlewareCache.set(name, createMiddleware(name));
  }
  return middlewareCache.get(name)!;
}

// 2. 减少不必要的 chunk 复制
const wrappedOnChunk = onChunk 
  ? async (chunk: Chunk) => { await onChunk(chunk); }
  : undefined;

// 3. 使用 WeakMap 存储上下文扩展数据
const contextExtensions = new WeakMap<CompletionsContext, any>();
```

### 3.2 流处理优化

```typescript
// 使用 ReadableStream 而非 AsyncIterable
async function* optimizedStreamAdapter(
  rawStream: AsyncIterable<any>
): AsyncIterable<Chunk> {
  const buffer: Chunk[] = [];
  let flushPromise: Promise<void> | null = null;
  
  for await (const raw of rawStream) {
    const chunks = transformer.transform(raw);
    
    // 批量发送
    buffer.push(...chunks);
    
    if (buffer.length >= 10) {
      yield* buffer;
      buffer.length = 0;
    }
  }
  
  // 发送剩余
  yield* buffer;
}
```

---

## 4. 文档完善

### 4.1 API 文档

```typescript
/**
 * AiProvider - AI 服务提供者
 * 
 * @example 基本使用
 * ```typescript
 * const provider = new AiProvider(providerConfig);
 * const result = await provider.completions({
 *   callType: 'chat',
 *   messages: [{ role: 'user', content: 'Hello' }],
 *   assistant: { id: 'default', model: { id: 'gpt-4' } },
 * });
 * console.log(result.getText());
 * ```
 * 
 * @example 流式输出
 * ```typescript
 * await provider.completions({
 *   // ...
 *   onChunk: (chunk) => {
 *     if (chunk.type === ChunkType.TEXT_DELTA) {
 *       process.stdout.write(chunk.text);
 *     }
 *   },
 * });
 * ```
 * 
 * @example MCP 工具调用
 * ```typescript
 * await provider.completions({
 *   // ...
 *   mcpTools: [
 *     { name: 'search', description: 'Web search', inputSchema: {...} },
 *   ],
 *   mcpMode: 'function', // 或 'prompt'
 * });
 * ```
 */
```

### 4.2 迁移指南

```markdown
# 从旧 API 迁移

## 变更列表

1. `AiProvider.completions()` 参数变化
   - 移除 `streamOutput`，改用 `assistant.settings.streamOutput`
   - `mcpMode` 新增，支持 'function' | 'prompt'

2. Chunk 类型变化
   - 新增 `MCP_TOOL_*` 系列类型
   - `LLM_WEB_SEARCH_COMPLETE` 结构变化

3. 中间件 API
   - 新的 `CompletionsMiddlewareBuilder` API
   - 支持动态添加/移除中间件
```

---

## 5. 验收清单

### 5.1 功能验收

- [ ] 所有 Provider 正常工作
- [ ] MCP 工具调用（函数模式）
- [ ] MCP 工具调用（提示词模式）
- [ ] Web 搜索
- [ ] 图片生成
- [ ] 思考内容提取
- [ ] 错误处理和重试
- [ ] 请求中断

### 5.2 性能验收

- [ ] 首 Token 延迟 < 原实现
- [ ] 内存占用合理
- [ ] 无内存泄漏

### 5.3 代码质量

- [ ] TypeScript 类型完整
- [ ] 单元测试覆盖率 > 80%
- [ ] 无 lint 错误
- [ ] 文档完整

---

## 6. 回滚计划

如果重构出现问题，可以回滚到旧实现：

```typescript
// 配置开关
const USE_NEW_AI_CORE = process.env.USE_NEW_AI_CORE === 'true';

export function createAiProvider(provider: Provider): AiProvider {
  if (USE_NEW_AI_CORE) {
    return new NewAiProvider(provider);
  }
  return new LegacyAiProvider(provider);
}
```
