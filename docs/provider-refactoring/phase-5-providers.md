# Phase 5: 供应商迁移

> 预计工时：5-7天
> 前置依赖：Phase 4 (中间件系统)
> 参考文件：`cherry-studio-main/src/renderer/src/aiCore/legacy/clients/`

## 🎯 目标

1. 将现有供应商逐个迁移到新架构
2. 实现各供应商的具体客户端类
3. 保持向后兼容，支持渐进式迁移
4. 配置系统供应商预设

## 📁 需要创建/修改的文件

```
src/shared/aiCore/
├── clients/
│   ├── openai/
│   │   ├── OpenAIClient.ts         # OpenAI客户端
│   │   ├── OpenAIResponseClient.ts # OpenAI Responses API
│   │   ├── transformers.ts         # 转换器
│   │   └── index.ts
│   ├── gemini/
│   │   ├── GeminiClient.ts
│   │   ├── transformers.ts
│   │   └── index.ts
│   ├── anthropic/
│   │   ├── AnthropicClient.ts
│   │   ├── transformers.ts
│   │   └── index.ts
│   └── index.ts
│
└── provider/
    └── configs/
        ├── system-providers.ts     # 系统供应商配置
        ├── openai.ts
        ├── gemini.ts
        └── index.ts
```

## 📝 迁移顺序

建议按以下顺序迁移，从简单到复杂：

```
1. OpenAI (最常用，作为参考实现)
2. OpenAI Response API (新版API)
3. Anthropic (Claude)
4. Gemini (Google)
5. 其他OpenAI兼容供应商 (DeepSeek, 智谱等)
```

## 📝 详细实现

### 5.1 OpenAI客户端 (`clients/openai/OpenAIClient.ts`)

```typescript
import OpenAI from 'openai';
import type { Provider, Model, MCPTool } from '@/shared/types';
import type { Chunk } from '../../types/chunk';
import { ChunkType } from '../../types/chunk';
import type {
  SdkRequestParams,
  SdkMessageParam,
  SdkTool,
  SdkToolCall,
  SdkModel,
  RequestOptions
} from '../../types/sdk';
import { BaseApiClient } from '../base';
import type {
  RequestTransformer,
  ResponseChunkTransformer,
  CompletionsContext,
  GenerateImageParams
} from '../base/types';

/**
 * OpenAI客户端实现
 * 支持标准的Chat Completions API
 */
export class OpenAIClient extends BaseApiClient<
  OpenAI,
  OpenAI.Chat.ChatCompletionCreateParams,
  AsyncIterable<OpenAI.Chat.ChatCompletionChunk> | OpenAI.Chat.ChatCompletion,
  OpenAI.Chat.ChatCompletionChunk,
  OpenAI.Chat.ChatCompletionMessageParam,
  OpenAI.Chat.ChatCompletionMessageToolCall,
  OpenAI.Chat.ChatCompletionTool
> {
  
  constructor(provider: Provider) {
    super(provider);
  }

  // ==================== SDK实例 ====================

  public getSdkInstance(): OpenAI {
    if (!this.sdkInstance) {
      this.sdkInstance = new OpenAI({
        apiKey: this.getApiKey(),
        baseURL: this.getBaseURL(),
        defaultHeaders: this.getDefaultHeaders(),
        dangerouslyAllowBrowser: true,
      });
    }
    return this.sdkInstance;
  }

  // ==================== 核心API ====================

  public async createCompletions(
    payload: OpenAI.Chat.ChatCompletionCreateParams,
    options?: RequestOptions
  ): Promise<AsyncIterable<OpenAI.Chat.ChatCompletionChunk> | OpenAI.Chat.ChatCompletion> {
    const sdk = this.getSdkInstance();
    
    if (payload.stream) {
      return sdk.chat.completions.create({
        ...payload,
        stream: true,
      }, {
        signal: options?.signal,
        timeout: options?.timeout,
      });
    } else {
      return sdk.chat.completions.create({
        ...payload,
        stream: false,
      }, {
        signal: options?.signal,
        timeout: options?.timeout,
      });
    }
  }

  public async listModels(): Promise<SdkModel[]> {
    const sdk = this.getSdkInstance();
    const response = await sdk.models.list();
    return response.data.map(m => ({
      id: m.id,
      object: m.object,
      created: m.created,
      owned_by: m.owned_by,
    }));
  }

  public async getEmbeddingDimensions(model?: Model): Promise<number> {
    const sdk = this.getSdkInstance();
    const response = await sdk.embeddings.create({
      model: model?.id || 'text-embedding-ada-002',
      input: 'test',
    });
    return response.data[0].embedding.length;
  }

  public async generateImage(params: GenerateImageParams): Promise<string[]> {
    const sdk = this.getSdkInstance();
    const response = await sdk.images.generate({
      model: params.model || 'dall-e-3',
      prompt: params.prompt,
      n: params.n || 1,
      size: params.size as any || '1024x1024',
      quality: params.quality as any || 'standard',
      style: params.style as any || 'natural',
    });
    return response.data.map(img => img.url || '').filter(Boolean);
  }

  // ==================== 转换器 ====================

  public getRequestTransformer(): RequestTransformer<
    OpenAI.Chat.ChatCompletionCreateParams,
    OpenAI.Chat.ChatCompletionMessageParam
  > {
    return new OpenAIRequestTransformer(this);
  }

  public getResponseChunkTransformer(
    ctx: CompletionsContext
  ): ResponseChunkTransformer<OpenAI.Chat.ChatCompletionChunk> {
    return new OpenAIResponseTransformer(ctx);
  }

  // ==================== 工具转换 ====================

  public convertMcpToolsToSdkTools(mcpTools: MCPTool[]): OpenAI.Chat.ChatCompletionTool[] {
    return mcpTools.map(tool => ({
      type: 'function' as const,
      function: {
        name: this.sanitizeToolName(tool.id || tool.name),
        description: tool.description || '',
        parameters: tool.inputSchema || { type: 'object', properties: {} },
      },
    }));
  }

  public convertSdkToolCallToMcp(
    toolCall: OpenAI.Chat.ChatCompletionMessageToolCall,
    mcpTools: MCPTool[]
  ): MCPTool | undefined {
    return mcpTools.find(t => 
      this.sanitizeToolName(t.id || t.name) === toolCall.function.name
    );
  }

  public convertSdkToolCallToMcpToolResponse(
    toolCall: OpenAI.Chat.ChatCompletionMessageToolCall,
    mcpTool: MCPTool
  ): any {
    return {
      id: toolCall.id,
      toolCallId: toolCall.id,
      tool: mcpTool,
      arguments: JSON.parse(toolCall.function.arguments || '{}'),
      status: 'pending' as const,
    };
  }

  public convertMcpToolResponseToSdkMessageParam(
    mcpToolResponse: any,
    resp: any,
    _model: Model
  ): OpenAI.Chat.ChatCompletionMessageParam | undefined {
    return {
      role: 'tool',
      tool_call_id: mcpToolResponse.toolCallId,
      content: resp.isError ? `Error: ${resp.content}` : resp.content,
    };
  }

  // ==================== 消息处理 ====================

  public buildSdkMessages(
    currentReqMessages: OpenAI.Chat.ChatCompletionMessageParam[],
    _output: any,
    toolResults: OpenAI.Chat.ChatCompletionMessageParam[],
    toolCalls?: OpenAI.Chat.ChatCompletionMessageToolCall[]
  ): OpenAI.Chat.ChatCompletionMessageParam[] {
    const messages = [...currentReqMessages];
    
    if (toolCalls && toolCalls.length > 0) {
      messages.push({
        role: 'assistant',
        content: null,
        tool_calls: toolCalls,
      });
    }
    
    messages.push(...toolResults);
    return messages;
  }

  public extractMessagesFromSdkPayload(
    sdkPayload: OpenAI.Chat.ChatCompletionCreateParams
  ): OpenAI.Chat.ChatCompletionMessageParam[] {
    return sdkPayload.messages;
  }

  public estimateMessageTokens(message: OpenAI.Chat.ChatCompletionMessageParam): number {
    // 简单估算：每4个字符约1个token
    const content = typeof message.content === 'string' 
      ? message.content 
      : JSON.stringify(message.content);
    return Math.ceil(content.length / 4);
  }

  // ==================== 辅助方法 ====================

  private sanitizeToolName(name: string): string {
    let sanitized = name;
    if (/^\d/.test(sanitized)) sanitized = `tool_${sanitized}`;
    sanitized = sanitized.replace(/[^a-zA-Z0-9_-]/g, '_');
    if (sanitized.length > 64) sanitized = sanitized.substring(0, 64);
    return sanitized;
  }

  public getClientCompatibilityType(model?: Model): string[] {
    return ['OpenAIClient', 'OpenAIAPIClient'];
  }
}

/**
 * OpenAI请求转换器
 */
class OpenAIRequestTransformer implements RequestTransformer<
  OpenAI.Chat.ChatCompletionCreateParams,
  OpenAI.Chat.ChatCompletionMessageParam
> {
  constructor(private client: OpenAIClient) {}

  transform(params: any): OpenAI.Chat.ChatCompletionCreateParams {
    const { messages, assistant, mcpTools } = params;
    const model = assistant?.model;
    
    // 转换消息
    const sdkMessages = messages.map((m: any) => this.transformMessage(m));
    
    // 添加系统提示词
    if (assistant?.prompt) {
      sdkMessages.unshift({
        role: 'system',
        content: assistant.prompt,
      });
    }

    // 构建请求参数
    const request: OpenAI.Chat.ChatCompletionCreateParams = {
      model: model?.id || 'gpt-3.5-turbo',
      messages: sdkMessages,
      stream: assistant?.settings?.streamOutput !== false,
      temperature: this.client['getTemperature'](assistant, model),
      top_p: this.client['getTopP'](assistant, model),
      max_tokens: this.client['getMaxTokens'](assistant, model),
    };

    // 添加工具
    if (mcpTools && mcpTools.length > 0) {
      const { tools } = this.client.setupToolsConfig({
        mcpTools,
        model,
        enableToolUse: true,
      });
      if (tools.length > 0) {
        request.tools = tools;
        request.tool_choice = 'auto';
      }
    }

    return request;
  }

  transformMessage(message: any): OpenAI.Chat.ChatCompletionMessageParam {
    return {
      role: message.role,
      content: typeof message.content === 'string' 
        ? message.content 
        : message.content || '',
    };
  }
}

/**
 * OpenAI响应转换器
 */
class OpenAIResponseTransformer implements ResponseChunkTransformer<OpenAI.Chat.ChatCompletionChunk> {
  constructor(private ctx: CompletionsContext) {}

  transform(chunk: OpenAI.Chat.ChatCompletionChunk): Chunk[] {
    const chunks: Chunk[] = [];
    const choice = chunk.choices[0];
    
    if (!choice) return chunks;

    // 文本内容
    if (choice.delta?.content) {
      chunks.push({
        type: ChunkType.TEXT_DELTA,
        text: choice.delta.content,
      });
    }

    // 工具调用
    if (choice.delta?.tool_calls) {
      for (const toolCall of choice.delta.tool_calls) {
        if (toolCall.id) {
          chunks.push({
            type: ChunkType.MCP_TOOL_CALL_START,
            toolCallId: toolCall.id,
            toolName: toolCall.function?.name || '',
          });
        }
        if (toolCall.function?.arguments) {
          chunks.push({
            type: ChunkType.MCP_TOOL_CALL_ARGS,
            toolCallId: toolCall.id || '',
            args: toolCall.function.arguments,
          });
        }
      }
    }

    // 完成原因
    if (choice.finish_reason === 'stop') {
      // 文本完成在FinalConsumer中处理
    }

    return chunks;
  }
}

export { OpenAIRequestTransformer, OpenAIResponseTransformer };
```

### 5.2 Gemini客户端 (`clients/gemini/GeminiClient.ts`)

```typescript
import { GoogleGenAI, type Content, type Part, type Tool } from '@google/genai';
import type { Provider, Model, MCPTool } from '@/shared/types';
import type { Chunk } from '../../types/chunk';
import { ChunkType } from '../../types/chunk';
import { BaseApiClient } from '../base';
import type {
  RequestTransformer,
  ResponseChunkTransformer,
  CompletionsContext,
  GenerateImageParams
} from '../base/types';
import type { SdkModel, RequestOptions } from '../../types/sdk';

/**
 * Gemini SDK特定类型
 */
interface GeminiRequestParams {
  model: string;
  contents: Content[];
  systemInstruction?: string;
  generationConfig?: {
    temperature?: number;
    topP?: number;
    maxOutputTokens?: number;
  };
  tools?: Tool[];
}

/**
 * Google Gemini客户端实现
 */
export class GeminiClient extends BaseApiClient<
  GoogleGenAI,
  GeminiRequestParams,
  AsyncIterable<any>,
  any,
  Content,
  any,
  Tool
> {
  
  constructor(provider: Provider) {
    super(provider);
  }

  // ==================== SDK实例 ====================

  public getSdkInstance(): GoogleGenAI {
    if (!this.sdkInstance) {
      this.sdkInstance = new GoogleGenAI({
        apiKey: this.getApiKey(),
      });
    }
    return this.sdkInstance;
  }

  public getBaseURL(): string {
    return this.provider.apiHost || 'https://generativelanguage.googleapis.com/v1beta';
  }

  // ==================== 核心API ====================

  public async createCompletions(
    payload: GeminiRequestParams,
    options?: RequestOptions
  ): Promise<AsyncIterable<any>> {
    const sdk = this.getSdkInstance();
    
    const chat = sdk.chats.create({
      model: payload.model,
      config: {
        systemInstruction: payload.systemInstruction,
        ...payload.generationConfig,
        tools: payload.tools,
      },
      history: payload.contents.slice(0, -1),
    });

    const lastMessage = payload.contents[payload.contents.length - 1];
    
    return chat.sendMessageStream({
      message: lastMessage.parts as any,
      config: {
        abortSignal: options?.signal,
      },
    });
  }

  public async listModels(): Promise<SdkModel[]> {
    // Gemini需要通过REST API获取模型列表
    const response = await fetch(`${this.getBaseURL()}/models?key=${this.getApiKey()}`);
    const data = await response.json();
    
    return (data.models || []).map((m: any) => ({
      id: m.name.replace('models/', ''),
      object: 'model',
      owned_by: 'google',
    }));
  }

  public async getEmbeddingDimensions(_model?: Model): Promise<number> {
    return 768; // Gemini默认embedding维度
  }

  public async generateImage(_params: GenerateImageParams): Promise<string[]> {
    // Gemini图像生成需要特殊处理
    console.warn('[GeminiClient] 图像生成功能暂未实现');
    return [];
  }

  // ==================== 转换器 ====================

  public getRequestTransformer(): RequestTransformer<GeminiRequestParams, Content> {
    return new GeminiRequestTransformer(this);
  }

  public getResponseChunkTransformer(ctx: CompletionsContext): ResponseChunkTransformer<any> {
    return new GeminiResponseTransformer(ctx);
  }

  // ==================== 工具转换 ====================

  public convertMcpToolsToSdkTools(mcpTools: MCPTool[]): Tool[] {
    return mcpTools.map(tool => ({
      functionDeclarations: [{
        name: this.sanitizeToolName(tool.id || tool.name),
        description: tool.description || '',
        parameters: tool.inputSchema,
      }],
    }));
  }

  public convertSdkToolCallToMcp(toolCall: any, mcpTools: MCPTool[]): MCPTool | undefined {
    return mcpTools.find(t => 
      this.sanitizeToolName(t.id || t.name) === toolCall.name
    );
  }

  public convertSdkToolCallToMcpToolResponse(toolCall: any, mcpTool: MCPTool): any {
    return {
      id: toolCall.id || `gemini_${Date.now()}`,
      toolCallId: toolCall.id,
      tool: mcpTool,
      arguments: toolCall.args || {},
      status: 'pending' as const,
    };
  }

  public convertMcpToolResponseToSdkMessageParam(
    mcpToolResponse: any,
    resp: any,
    _model: Model
  ): Content | undefined {
    return {
      role: 'user',
      parts: [{
        functionResponse: {
          name: mcpToolResponse.tool.id || mcpToolResponse.tool.name,
          response: {
            output: !resp.isError ? resp.content : undefined,
            error: resp.isError ? resp.content : undefined,
          },
        },
      }],
    };
  }

  // ==================== 消息处理 ====================

  public buildSdkMessages(
    currentReqMessages: Content[],
    _output: any,
    toolResults: Content[],
    _toolCalls?: any[]
  ): Content[] {
    return [...currentReqMessages, ...toolResults];
  }

  public extractMessagesFromSdkPayload(sdkPayload: GeminiRequestParams): Content[] {
    return sdkPayload.contents;
  }

  public estimateMessageTokens(message: Content): number {
    const text = message.parts?.map((p: Part) => p.text || '').join('') || '';
    return Math.ceil(text.length / 4);
  }

  // ==================== 辅助方法 ====================

  private sanitizeToolName(name: string): string {
    let sanitized = name;
    if (/^\d/.test(sanitized)) sanitized = `mcp_${sanitized}`;
    sanitized = sanitized.replace(/[^a-zA-Z0-9_.-]/g, '_');
    if (sanitized.length > 64) sanitized = sanitized.substring(0, 64);
    if (!/^[a-zA-Z_]/.test(sanitized)) sanitized = `tool_${sanitized}`;
    return sanitized;
  }

  public getClientCompatibilityType(_model?: Model): string[] {
    return ['GeminiClient', 'GeminiAPIClient'];
  }
}

/**
 * Gemini请求转换器
 */
class GeminiRequestTransformer implements RequestTransformer<GeminiRequestParams, Content> {
  constructor(private client: GeminiClient) {}

  transform(params: any): GeminiRequestParams {
    const { messages, assistant, mcpTools } = params;
    const model = assistant?.model;

    // 转换消息
    const contents = messages.map((m: any) => this.transformMessage(m));

    // 构建工具
    let tools: Tool[] = [];
    if (mcpTools && mcpTools.length > 0) {
      const config = this.client.setupToolsConfig({
        mcpTools,
        model,
        enableToolUse: true,
      });
      tools = config.tools;
    }

    return {
      model: model?.id || 'gemini-pro',
      contents,
      systemInstruction: assistant?.prompt,
      generationConfig: {
        temperature: this.client['getTemperature'](assistant, model),
        topP: this.client['getTopP'](assistant, model),
        maxOutputTokens: this.client['getMaxTokens'](assistant, model),
      },
      tools: tools.length > 0 ? tools : undefined,
    };
  }

  transformMessage(message: any): Content {
    const role = message.role === 'assistant' ? 'model' : 'user';
    return {
      role,
      parts: [{ text: message.content || '' }],
    };
  }
}

/**
 * Gemini响应转换器
 */
class GeminiResponseTransformer implements ResponseChunkTransformer<any> {
  constructor(private ctx: CompletionsContext) {}

  transform(chunk: any): Chunk[] {
    const chunks: Chunk[] = [];

    // 处理文本内容
    if (chunk.candidates?.[0]?.content?.parts) {
      for (const part of chunk.candidates[0].content.parts) {
        if (part.thought && part.text) {
          // 思考内容
          chunks.push({
            type: ChunkType.THINKING_DELTA,
            text: part.text,
          });
        } else if (part.text) {
          // 普通文本
          chunks.push({
            type: ChunkType.TEXT_DELTA,
            text: part.text,
          });
        } else if (part.functionCall) {
          // 工具调用
          chunks.push({
            type: ChunkType.MCP_TOOL_CALL_COMPLETE,
            toolCallId: part.functionCall.id || `fc_${Date.now()}`,
            toolName: part.functionCall.name,
            args: part.functionCall.args || {},
          });
        }
      }
    }

    return chunks;
  }
}

export { GeminiRequestTransformer, GeminiResponseTransformer };
```

### 5.3 系统供应商配置 (`provider/configs/system-providers.ts`)

```typescript
import type { SystemProvider, Provider } from '../../types/provider';

/**
 * 系统内置供应商配置
 */
export const SYSTEM_PROVIDERS_CONFIG: Record<string, SystemProvider> = {
  openai: {
    id: 'openai',
    type: 'openai-response',
    name: 'OpenAI',
    apiKey: '',
    apiHost: 'https://api.openai.com/v1',
    models: [],
    isSystem: true,
    enabled: false,
    apiOptions: {
      isSupportFunctionCalling: true,
      isSupportStreaming: true,
      isSupportMultimodal: true,
    },
  },
  
  anthropic: {
    id: 'anthropic',
    type: 'anthropic',
    name: 'Anthropic',
    apiKey: '',
    apiHost: 'https://api.anthropic.com',
    models: [],
    isSystem: true,
    enabled: false,
    apiOptions: {
      isSupportFunctionCalling: true,
      isSupportStreaming: true,
      isSupportMultimodal: true,
    },
  },
  
  gemini: {
    id: 'gemini',
    type: 'gemini',
    name: 'Google Gemini',
    apiKey: '',
    apiHost: 'https://generativelanguage.googleapis.com/v1beta',
    models: [],
    isSystem: true,
    enabled: false,
    apiOptions: {
      isSupportFunctionCalling: true,
      isSupportStreaming: true,
      isSupportMultimodal: true,
    },
  },
  
  deepseek: {
    id: 'deepseek',
    type: 'openai',
    name: 'DeepSeek',
    apiKey: '',
    apiHost: 'https://api.deepseek.com',
    models: [],
    isSystem: true,
    enabled: false,
  },
  
  zhipu: {
    id: 'zhipu',
    type: 'openai',
    name: '智谱AI',
    apiKey: '',
    apiHost: 'https://open.bigmodel.cn/api/paas/v4/',
    models: [],
    isSystem: true,
    enabled: false,
  },
  
  siliconflow: {
    id: 'siliconflow',
    type: 'openai',
    name: '硅基流动',
    apiKey: '',
    apiHost: 'https://api.siliconflow.cn/v1',
    models: [],
    isSystem: true,
    enabled: false,
  },
  
  moonshot: {
    id: 'moonshot',
    type: 'openai',
    name: 'Moonshot AI',
    apiKey: '',
    apiHost: 'https://api.moonshot.cn/v1',
    models: [],
    isSystem: true,
    enabled: false,
  },
  
  ollama: {
    id: 'ollama',
    type: 'openai',
    name: 'Ollama',
    apiKey: 'ollama',
    apiHost: 'http://localhost:11434/v1',
    models: [],
    isSystem: true,
    enabled: false,
  },
};

/**
 * 获取所有系统供应商
 */
export function getSystemProviders(): SystemProvider[] {
  return Object.values(SYSTEM_PROVIDERS_CONFIG);
}

/**
 * 获取指定供应商配置
 */
export function getSystemProvider(id: string): SystemProvider | undefined {
  return SYSTEM_PROVIDERS_CONFIG[id];
}

/**
 * 检查是否为系统供应商
 */
export function isSystemProviderConfig(provider: Provider): boolean {
  return provider.id in SYSTEM_PROVIDERS_CONFIG && provider.isSystem === true;
}
```

## ✅ 完成标准

1. [ ] OpenAI客户端完成（标准API）
2. [ ] OpenAI Response客户端完成（新版API）
3. [ ] Gemini客户端完成
4. [ ] Anthropic客户端完成
5. [ ] 系统供应商配置完成
6. [ ] 所有客户端注册到工厂

## 🧪 测试清单

```
□ OpenAI流式对话
□ OpenAI非流式对话
□ OpenAI工具调用
□ Gemini流式对话
□ Gemini思考模式
□ Gemini工具调用
□ Anthropic流式对话
□ 错误处理
□ 请求中断
```

## ➡️ 下一步

完成Phase 5后，继续 [Phase 6: 状态管理](./phase-6-state.md)
