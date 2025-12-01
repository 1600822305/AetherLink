# Phase 2: 抽象基类设计

> 预计工时：3-4天
> 前置依赖：Phase 1 (类型系统)
> 参考文件：`cherry-studio-main/src/renderer/src/aiCore/legacy/clients/BaseApiClient.ts`

## 🎯 目标

1. 设计统一的 `BaseApiClient` 抽象基类
2. 定义所有供应商必须实现的接口契约
3. 提供通用功能的默认实现
4. 支持泛型以适应不同SDK的类型

## 📁 需要创建的文件

```
src/shared/aiCore/
└── clients/
    └── base/
        ├── BaseApiClient.ts   # 抽象基类
        ├── types.ts           # 客户端相关类型
        └── index.ts           # 导出
```

## 📝 详细实现

### 2.1 客户端类型定义 (`clients/base/types.ts`)

```typescript
import type { Provider, Chunk } from '../../types';
import type { 
  SdkRequestParams, 
  SdkResponse, 
  SdkStreamChunk,
  SdkMessageParam,
  SdkTool,
  SdkToolCall,
  SdkModel,
  RequestOptions 
} from '../../types/sdk';
import type { MCPTool, MCPToolResponse, MCPCallToolResponse, Model } from '@/shared/types';

/**
 * API客户端接口
 * 定义所有供应商客户端必须实现的方法
 */
export interface ApiClient<
  TSdkInstance = unknown,
  TSdkParams extends SdkRequestParams = SdkRequestParams,
  TRawOutput = SdkResponse | AsyncIterable<SdkStreamChunk>,
  TRawChunk = SdkStreamChunk,
  TMessageParam = SdkMessageParam,
  TToolCall = SdkToolCall,
  TSdkTool = SdkTool
> {
  /** Provider配置 */
  provider: Provider;

  // ==================== 核心API ====================

  /**
   * 创建对话完成请求
   * @param payload SDK请求参数
   * @param options 请求选项
   * @returns 响应（流式或非流式）
   */
  createCompletions(payload: TSdkParams, options?: RequestOptions): Promise<TRawOutput>;

  /**
   * 获取SDK实例
   */
  getSdkInstance(): Promise<TSdkInstance> | TSdkInstance;

  /**
   * 获取模型列表
   */
  listModels(): Promise<SdkModel[]>;

  /**
   * 获取嵌入维度
   */
  getEmbeddingDimensions(model?: Model): Promise<number>;

  /**
   * 生成图像
   */
  generateImage(params: GenerateImageParams): Promise<string[]>;

  // ==================== 转换器 ====================

  /**
   * 获取请求转换器
   * 将内部请求格式转换为SDK特定格式
   */
  getRequestTransformer(): RequestTransformer<TSdkParams, TMessageParam>;

  /**
   * 获取响应块转换器
   * 将SDK响应块转换为统一的Chunk格式
   */
  getResponseChunkTransformer(ctx: CompletionsContext): ResponseChunkTransformer<TRawChunk>;

  // ==================== 工具相关 ====================

  /**
   * 将MCP工具转换为SDK工具格式
   */
  convertMcpToolsToSdkTools(mcpTools: MCPTool[]): TSdkTool[];

  /**
   * 将SDK工具调用转换为MCP格式
   */
  convertSdkToolCallToMcp(toolCall: TToolCall, mcpTools: MCPTool[]): MCPTool | undefined;

  /**
   * 将SDK工具调用转换为MCP工具响应
   */
  convertSdkToolCallToMcpToolResponse(toolCall: TToolCall, mcpTool: MCPTool): MCPToolResponse;

  /**
   * 将MCP工具响应转换为SDK消息参数
   */
  convertMcpToolResponseToSdkMessageParam(
    mcpToolResponse: MCPToolResponse,
    resp: MCPCallToolResponse,
    model: Model
  ): TMessageParam | undefined;

  // ==================== 消息处理 ====================

  /**
   * 构建SDK消息（包含工具结果）
   */
  buildSdkMessages(
    currentReqMessages: TMessageParam[],
    output: TRawOutput | string | undefined,
    toolResults: TMessageParam[],
    toolCalls?: TToolCall[]
  ): TMessageParam[];

  /**
   * 从SDK载荷中提取消息数组
   */
  extractMessagesFromSdkPayload(sdkPayload: TSdkParams): TMessageParam[];

  /**
   * 估算消息token数量
   */
  estimateMessageTokens(message: TMessageParam): number;

  // ==================== 通用方法 ====================

  /**
   * 获取基础URL
   */
  getBaseURL(): string;

  /**
   * 获取API密钥（支持轮询）
   */
  getApiKey(): string;

  /**
   * 获取客户端兼容性类型
   * 用于中间件判断客户端能力
   */
  getClientCompatibilityType(model?: Model): string[];
}

/**
 * 请求转换器接口
 */
export interface RequestTransformer<TSdkParams, TMessageParam> {
  /**
   * 转换请求
   */
  transform(params: CompletionsParams): TSdkParams;
  
  /**
   * 转换消息
   */
  transformMessage(message: any): TMessageParam;
}

/**
 * 响应块转换器接口
 */
export interface ResponseChunkTransformer<TRawChunk> {
  /**
   * 转换响应块为Chunk
   */
  transform(rawChunk: TRawChunk): Chunk[];
}

/**
 * Completions上下文
 */
export interface CompletionsContext {
  model: Model;
  assistant: any;
  mcpTools?: MCPTool[];
  abortController?: AbortController;
  onChunk?: (chunk: Chunk) => void;
}

/**
 * Completions参数
 */
export interface CompletionsParams {
  messages: any[];
  assistant: any;
  mcpTools?: MCPTool[];
  mcpMode?: 'prompt' | 'function';
  enableWebSearch?: boolean;
  enableToolUse?: boolean;
  topicId?: string;
  callType?: 'chat' | 'translate' | 'summary' | 'test' | 'check';
  onChunk?: (chunk: Chunk) => void;
  onFilterMessages?: (messages: any[]) => void;
}

/**
 * Completions结果
 */
export interface CompletionsResult {
  content: string;
  reasoning?: string;
  reasoningTime?: number;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  toolCalls?: MCPToolResponse[];
}

/**
 * 图像生成参数
 */
export interface GenerateImageParams {
  prompt: string;
  model: string;
  n?: number;
  size?: string;
  quality?: string;
  style?: string;
}
```

### 2.2 抽象基类实现 (`clients/base/BaseApiClient.ts`)

```typescript
import type { Provider, Model, MCPTool } from '@/shared/types';
import type { Chunk } from '../../types/chunk';
import type { 
  SdkRequestParams, 
  SdkResponse, 
  SdkStreamChunk,
  SdkMessageParam,
  SdkTool,
  SdkToolCall,
  SdkModel,
  RequestOptions 
} from '../../types/sdk';
import type {
  ApiClient,
  RequestTransformer,
  ResponseChunkTransformer,
  CompletionsContext,
  CompletionsParams,
  GenerateImageParams
} from './types';

/**
 * 抽象基类 - 所有供应商客户端的基础
 * 
 * 设计原则：
 * 1. 定义统一接口契约
 * 2. 提供通用功能的默认实现
 * 3. 支持泛型以适应不同SDK
 * 4. 保持职责单一，复杂逻辑放到中间件
 */
export abstract class BaseApiClient<
  TSdkInstance = unknown,
  TSdkParams extends SdkRequestParams = SdkRequestParams,
  TRawOutput = SdkResponse | AsyncIterable<SdkStreamChunk>,
  TRawChunk = SdkStreamChunk,
  TMessageParam = SdkMessageParam,
  TToolCall = SdkToolCall,
  TSdkTool = SdkTool
> implements ApiClient<TSdkInstance, TSdkParams, TRawOutput, TRawChunk, TMessageParam, TToolCall, TSdkTool> {
  
  public provider: Provider;
  protected host: string;
  protected sdkInstance?: TSdkInstance;

  constructor(provider: Provider) {
    this.provider = provider;
    this.host = this.getBaseURL();
  }

  // ==================== 抽象方法（子类必须实现）====================

  /**
   * 创建对话完成请求
   */
  abstract createCompletions(payload: TSdkParams, options?: RequestOptions): Promise<TRawOutput>;

  /**
   * 获取SDK实例
   */
  abstract getSdkInstance(): Promise<TSdkInstance> | TSdkInstance;

  /**
   * 获取模型列表
   */
  abstract listModels(): Promise<SdkModel[]>;

  /**
   * 获取嵌入维度
   */
  abstract getEmbeddingDimensions(model?: Model): Promise<number>;

  /**
   * 生成图像
   */
  abstract generateImage(params: GenerateImageParams): Promise<string[]>;

  /**
   * 获取请求转换器
   */
  abstract getRequestTransformer(): RequestTransformer<TSdkParams, TMessageParam>;

  /**
   * 获取响应块转换器
   */
  abstract getResponseChunkTransformer(ctx: CompletionsContext): ResponseChunkTransformer<TRawChunk>;

  /**
   * 将MCP工具转换为SDK工具格式
   */
  abstract convertMcpToolsToSdkTools(mcpTools: MCPTool[]): TSdkTool[];

  /**
   * 将SDK工具调用转换为MCP格式
   */
  abstract convertSdkToolCallToMcp(toolCall: TToolCall, mcpTools: MCPTool[]): MCPTool | undefined;

  /**
   * 将SDK工具调用转换为MCP工具响应
   */
  abstract convertSdkToolCallToMcpToolResponse(toolCall: TToolCall, mcpTool: MCPTool): any;

  /**
   * 将MCP工具响应转换为SDK消息参数
   */
  abstract convertMcpToolResponseToSdkMessageParam(
    mcpToolResponse: any,
    resp: any,
    model: Model
  ): TMessageParam | undefined;

  /**
   * 构建SDK消息
   */
  abstract buildSdkMessages(
    currentReqMessages: TMessageParam[],
    output: TRawOutput | string | undefined,
    toolResults: TMessageParam[],
    toolCalls?: TToolCall[]
  ): TMessageParam[];

  /**
   * 从SDK载荷中提取消息数组
   */
  abstract extractMessagesFromSdkPayload(sdkPayload: TSdkParams): TMessageParam[];

  /**
   * 估算消息token数量
   */
  abstract estimateMessageTokens(message: TMessageParam): number;

  // ==================== 通用方法（默认实现）====================

  /**
   * 获取基础URL
   */
  public getBaseURL(): string {
    return this.provider.apiHost;
  }

  /**
   * 获取API密钥 - 支持多密钥轮询
   */
  public getApiKey(): string {
    const keys = this.provider.apiKey.split(',').map((key) => key.trim()).filter(Boolean);
    
    if (keys.length === 0) {
      console.warn(`[BaseApiClient] Provider ${this.provider.id} 没有配置API密钥`);
      return '';
    }
    
    if (keys.length === 1) {
      return keys[0];
    }

    // 多密钥轮询
    const keyName = `provider:${this.provider.id}:last_used_key`;
    const lastUsedKey = this.getFromKeyv(keyName);
    
    if (!lastUsedKey) {
      this.setToKeyv(keyName, keys[0]);
      return keys[0];
    }

    const currentIndex = keys.indexOf(lastUsedKey);
    const nextIndex = (currentIndex + 1) % keys.length;
    const nextKey = keys[nextIndex];
    this.setToKeyv(keyName, nextKey);

    return nextKey;
  }

  /**
   * 获取客户端兼容性类型
   */
  public getClientCompatibilityType(_model?: Model): string[] {
    return [this.constructor.name];
  }

  /**
   * 获取默认请求头
   */
  public getDefaultHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Api-Key': this.getApiKey()
    };

    // 添加自定义请求头
    if (this.provider.extraHeaders) {
      Object.assign(headers, this.provider.extraHeaders);
    }

    return headers;
  }

  /**
   * 创建AbortController
   */
  public createAbortController(messageId?: string): {
    abortController: AbortController;
    cleanup: () => void;
  } {
    const abortController = new AbortController();
    
    const cleanup = () => {
      // 清理逻辑
      if (messageId) {
        this.removeAbortController(messageId);
      }
    };

    if (messageId) {
      this.registerAbortController(messageId, abortController);
    }

    return { abortController, cleanup };
  }

  /**
   * 配置工具
   */
  public setupToolsConfig(params: {
    mcpTools?: MCPTool[];
    model: Model;
    enableToolUse?: boolean;
  }): { tools: TSdkTool[] } {
    const { mcpTools, model, enableToolUse } = params;
    let tools: TSdkTool[] = [];

    if (!mcpTools?.length) {
      return { tools };
    }

    // 检查模型是否支持函数调用
    if (this.isFunctionCallingModel(model) && enableToolUse) {
      tools = this.convertMcpToolsToSdkTools(mcpTools);
    }

    return { tools };
  }

  // ==================== 受保护的辅助方法 ====================

  /**
   * 检查模型是否支持函数调用
   */
  protected isFunctionCallingModel(model: Model): boolean {
    // 可以根据模型ID或能力标志判断
    return model.capabilities?.functionCalling === true ||
           model.modelTypes?.includes('function_calling' as any) ||
           this.provider.apiOptions?.isSupportFunctionCalling === true;
  }

  /**
   * 获取温度参数
   */
  protected getTemperature(assistant: any, model: Model): number | undefined {
    const settings = assistant?.settings;
    if (settings?.enableTemperature && settings?.temperature !== undefined) {
      return settings.temperature;
    }
    return model.temperature;
  }

  /**
   * 获取TopP参数
   */
  protected getTopP(assistant: any, model: Model): number | undefined {
    const settings = assistant?.settings;
    if (settings?.enableTopP && settings?.topP !== undefined) {
      return settings.topP;
    }
    return undefined;
  }

  /**
   * 获取最大Token数
   */
  protected getMaxTokens(assistant: any, model: Model): number {
    return assistant?.maxTokens || 
           assistant?.settings?.maxTokens || 
           model.maxTokens || 
           4096;
  }

  /**
   * 获取超时时间
   */
  protected getTimeout(model: Model): number {
    // 默认60秒，特殊模型可能需要更长
    return 60 * 1000;
  }

  // ==================== 存储辅助方法 ====================

  private getFromKeyv(key: string): string | undefined {
    if (typeof window !== 'undefined' && (window as any).keyv) {
      return (window as any).keyv.get(key);
    }
    // 非浏览器环境的备用方案
    return undefined;
  }

  private setToKeyv(key: string, value: string): void {
    if (typeof window !== 'undefined' && (window as any).keyv) {
      (window as any).keyv.set(key, value);
    }
  }

  private registerAbortController(messageId: string, controller: AbortController): void {
    // 实际实现中应该使用统一的abort管理器
    console.log(`[BaseApiClient] 注册AbortController: ${messageId}`);
  }

  private removeAbortController(messageId: string): void {
    console.log(`[BaseApiClient] 移除AbortController: ${messageId}`);
  }
}
```

### 2.3 导出 (`clients/base/index.ts`)

```typescript
export { BaseApiClient } from './BaseApiClient';
export * from './types';
```

## ✅ 完成标准

1. [ ] `BaseApiClient` 抽象类创建完成
2. [ ] 所有接口方法定义清晰
3. [ ] 泛型类型正确约束
4. [ ] 通用方法有合理的默认实现
5. [ ] 现有Provider可以继承此基类

## 🧪 测试用例

```typescript
// tests/clients/BaseApiClient.test.ts
import { BaseApiClient } from '@/shared/aiCore/clients/base';

// 创建一个简单的测试实现
class TestApiClient extends BaseApiClient {
  async createCompletions() { return {} as any; }
  getSdkInstance() { return {} as any; }
  async listModels() { return []; }
  async getEmbeddingDimensions() { return 1536; }
  async generateImage() { return []; }
  getRequestTransformer() { return { transform: () => ({} as any), transformMessage: () => ({} as any) }; }
  getResponseChunkTransformer() { return { transform: () => [] }; }
  convertMcpToolsToSdkTools() { return []; }
  convertSdkToolCallToMcp() { return undefined; }
  convertSdkToolCallToMcpToolResponse() { return {}; }
  convertMcpToolResponseToSdkMessageParam() { return undefined; }
  buildSdkMessages() { return []; }
  extractMessagesFromSdkPayload() { return []; }
  estimateMessageTokens() { return 0; }
}

describe('BaseApiClient', () => {
  const provider = {
    id: 'test',
    type: 'openai' as const,
    name: 'Test',
    apiKey: 'key1,key2,key3',
    apiHost: 'https://api.test.com',
    models: []
  };

  test('should rotate API keys', () => {
    const client = new TestApiClient(provider);
    const key1 = client.getApiKey();
    const key2 = client.getApiKey();
    const key3 = client.getApiKey();
    const key4 = client.getApiKey();
    
    expect([key1, key2, key3]).toContain('key1');
    expect([key1, key2, key3]).toContain('key2');
    expect([key1, key2, key3]).toContain('key3');
    // 第4次应该回到第1个key
    expect(key4).toBe(key1);
  });

  test('should return correct base URL', () => {
    const client = new TestApiClient(provider);
    expect(client.getBaseURL()).toBe('https://api.test.com');
  });
});
```

## 📌 与Cherry Studio的对比

| 特性 | Cherry Studio | 我们的实现 |
|------|---------------|-----------|
| 泛型支持 | ✅ 6个泛型参数 | ✅ 7个泛型参数 |
| API Key轮询 | ✅ | ✅ |
| 工具转换 | ✅ | ✅ |
| 中间件集成 | ✅ getRequestTransformer | ✅ 相同 |
| AbortController | ✅ | ✅ |

## ➡️ 下一步

完成Phase 2后，继续 [Phase 3: 工厂模式升级](./phase-3-factory.md)
