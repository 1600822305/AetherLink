# Phase 2: 客户端重构

> **目标**：完全对标 Cherry Studio 的 ApiClient 架构
> **预计工时**：2 天

---

## 1. 架构对比

### 当前实现
```
clients/
├── base/
│   ├── BaseApiClient.ts    # 抽象基类（较完整）
│   └── types.ts            # 类型定义
├── openai/
│   └── OpenAIClient.ts     # OpenAI 实现
├── gemini/
│   └── GeminiClient.ts     # Gemini 实现
├── factory.ts              # 动态注册工厂
└── registry.ts             # 客户端注册表
```

### 目标实现 (对标 CS)
```
clients/
├── ApiClientFactory.ts           # 工厂（静态+动态）
├── BaseApiClient.ts              # 增强基类
├── MixedBaseApiClient.ts         # 混合客户端基类
├── types.ts                      # 统一类型
├── openai/
│   ├── OpenAIAPIClient.ts        # 标准 OpenAI
│   ├── OpenAIBaseClient.ts       # OpenAI 基类
│   └── OpenAIResponseAPIClient.ts # Response API
├── anthropic/
│   └── AnthropicAPIClient.ts     # Claude 系列
├── gemini/
│   ├── GeminiAPIClient.ts        # Gemini
│   └── VertexAPIClient.ts        # Vertex AI
├── azure/
│   └── AzureOpenAIClient.ts      # Azure OpenAI
└── bedrock/
    └── BedrockAPIClient.ts       # AWS Bedrock
```

---

## 2. 实施步骤

### 2.1 增强 BaseApiClient

**核心改动**：
1. 添加 `getClientCompatibilityType()` 方法
2. 统一工具转换接口
3. 增强消息构建能力
4. 支持 Trace/Span

```typescript
/**
 * BaseApiClient - 对标 Cherry Studio
 */
export abstract class BaseApiClient<
  TSdkInstance extends SdkInstance = SdkInstance,
  TSdkParams extends SdkParams = SdkParams,
  TRawOutput extends SdkRawOutput = SdkRawOutput,
  TRawChunk extends SdkRawChunk = SdkRawChunk,
  TMessageParam extends SdkMessageParam = SdkMessageParam,
  TToolCall extends SdkToolCall = SdkToolCall,
  TSdkSpecificTool extends SdkTool = SdkTool
> implements ApiClient<...> {
  
  public provider: Provider;
  protected host: string;
  protected sdkInstance?: TSdkInstance;

  constructor(provider: Provider) {
    this.provider = provider;
    this.host = this.getBaseURL();
  }

  // ===== 核心抽象方法 =====
  
  abstract getSdkInstance(): Promise<TSdkInstance> | TSdkInstance;
  abstract getRequestTransformer(): RequestTransformer<TSdkParams, TMessageParam>;
  abstract getResponseChunkTransformer(): ResponseChunkTransformer<TRawChunk>;
  abstract createCompletions(payload: TSdkParams, options?: RequestOptions): Promise<TRawOutput>;
  abstract listModels(): Promise<SdkModel[]>;
  
  // ===== 工具相关 =====
  
  abstract convertMcpToolsToSdkTools(mcpTools: MCPTool[]): TSdkSpecificTool[];
  abstract convertSdkToolCallToMcp(toolCall: TToolCall, mcpTools: MCPTool[]): MCPTool | undefined;
  abstract convertSdkToolCallToMcpToolResponse(toolCall: TToolCall, mcpTool: MCPTool): MCPToolResponse;
  abstract convertMcpToolResponseToSdkMessageParam(
    mcpToolResponse: MCPToolResponse,
    resp: MCPCallToolResponse,
    model: Model
  ): TMessageParam | undefined;
  
  // ===== 消息构建 =====
  
  abstract buildSdkMessages(
    currentReqMessages: TMessageParam[],
    output: TRawOutput | string | undefined,
    toolResults: TMessageParam[],
    toolCalls?: TToolCall[]
  ): TMessageParam[];
  
  abstract extractMessagesFromSdkPayload(sdkPayload: TSdkParams): TMessageParam[];
  abstract estimateMessageTokens(message: TMessageParam): number;
  
  // ===== 通用方法 =====
  
  public getClientCompatibilityType(model?: Model): string[] {
    return [this.constructor.name];
  }
  
  public getBaseURL(): string {
    return this.provider.apiHost || '';
  }
  
  public getApiKey(): string {
    // 支持多 Key 轮询
    const keys = (this.provider.apiKey || '').split(',').filter(Boolean);
    if (keys.length <= 1) return keys[0] || '';
    // 轮询逻辑...
  }
  
  // ...更多通用方法
}
```

### 2.2 重构 ApiClientFactory

**从动态注册改为静态+动态混合**：

```typescript
/**
 * ApiClientFactory - 对标 Cherry Studio
 */
export class ApiClientFactory {
  
  static create(provider: Provider): BaseApiClient {
    console.log(`[ApiClientFactory] Creating client for: ${provider.id} (${provider.type})`);
    
    // 1. 首先检查特殊 Provider ID
    switch (provider.id) {
      case 'aihubmix':
        return new AihubmixAPIClient(provider);
      case 'cherryai':
        return new CherryAiAPIClient(provider);
      case 'zhipu':
        return new ZhipuAPIClient(provider);
      case 'ppio':
        return new PPIOAPIClient(provider);
      case 'ovms':
        return new OVMSClient(provider);
    }
    
    // 2. 检查 Provider Type
    switch (provider.type) {
      case 'openai':
        return new OpenAIAPIClient(provider);
      case 'openai-response':
      case 'azure-openai':
        return new OpenAIResponseAPIClient(provider);
      case 'gemini':
        return new GeminiAPIClient(provider);
      case 'vertexai':
        return new VertexAPIClient(provider);
      case 'anthropic':
        return new AnthropicAPIClient(provider);
      case 'aws-bedrock':
        return new AwsBedrockAPIClient(provider);
      default:
        // 默认使用 OpenAI 兼容
        console.log(`[ApiClientFactory] Fallback to OpenAIAPIClient`);
        return new OpenAIAPIClient(provider);
    }
  }
}
```

### 2.3 新增 AnthropicAPIClient

**文件路径**: `src/shared/aiCore/clients/anthropic/AnthropicAPIClient.ts`

```typescript
/**
 * Anthropic API 客户端
 * 支持 Claude 系列模型
 */
export class AnthropicAPIClient extends BaseApiClient<
  Anthropic,
  AnthropicRequestParams,
  AnthropicRawOutput,
  AnthropicStreamChunk,
  AnthropicMessage,
  AnthropicToolUse,
  AnthropicTool
> {
  
  async getSdkInstance(): Promise<Anthropic> {
    if (!this.sdkInstance) {
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      this.sdkInstance = new Anthropic({
        apiKey: this.getApiKey(),
        baseURL: this.getBaseURL() || undefined,
      });
    }
    return this.sdkInstance;
  }
  
  async createCompletions(
    payload: AnthropicRequestParams,
    options?: RequestOptions
  ): Promise<AnthropicRawOutput> {
    const client = await this.getSdkInstance();
    
    if (payload.stream) {
      return client.messages.stream(payload, { signal: options?.signal });
    } else {
      return client.messages.create(payload, { signal: options?.signal });
    }
  }
  
  getRequestTransformer(): RequestTransformer<AnthropicRequestParams, AnthropicMessage> {
    return {
      transform: (params: CompletionsParams) => {
        // 转换为 Anthropic 格式
        return {
          model: params.assistant?.model?.id || 'claude-3-opus-20240229',
          messages: this.convertMessages(params.messages),
          max_tokens: params.maxTokens || 4096,
          stream: params.streamOutput !== false,
          // 添加工具
          tools: params.mcpTools ? this.convertMcpToolsToSdkTools(params.mcpTools) : undefined,
        };
      },
    };
  }
  
  convertMcpToolsToSdkTools(mcpTools: MCPTool[]): AnthropicTool[] {
    return mcpTools.map(tool => ({
      name: tool.name,
      description: tool.description || '',
      input_schema: tool.inputSchema as any,
    }));
  }
  
  // ...其他方法实现
}
```

### 2.4 增强 Azure OpenAI 支持

```typescript
/**
 * Azure OpenAI 客户端
 */
export class AzureOpenAIClient extends OpenAIBaseClient {
  
  getBaseURL(): string {
    // Azure 格式: https://{resource}.openai.azure.com/openai/deployments/{deployment}
    const resource = this.provider.azureResource;
    const deployment = this.provider.azureDeployment;
    return `https://${resource}.openai.azure.com/openai/deployments/${deployment}`;
  }
  
  getDefaultHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'api-key': this.getApiKey(),  // Azure 使用 api-key 而非 Bearer token
    };
  }
  
  buildApiUrl(endpoint: string): string {
    const apiVersion = this.provider.azureApiVersion || '2024-02-01';
    return `${this.getBaseURL()}${endpoint}?api-version=${apiVersion}`;
  }
}
```

---

## 3. 需要新增的客户端

| 客户端 | 优先级 | 状态 |
|--------|--------|------|
| `AnthropicAPIClient` | P0 | 待实现 |
| `AzureOpenAIClient` | P1 | 待增强 |
| `VertexAPIClient` | P1 | 待实现 |
| `BedrockAPIClient` | P2 | 待实现 |
| `OpenAIResponseAPIClient` | P1 | 待实现 |

---

## 4. 验收标准

- [ ] 所有客户端继承 BaseApiClient
- [ ] 工厂能正确选择客户端
- [ ] Anthropic Claude 可正常使用
- [ ] Azure OpenAI 完整支持
- [ ] 工具调用转换正确
