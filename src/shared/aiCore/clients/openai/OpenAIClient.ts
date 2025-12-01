/**
 * OpenAI 客户端实现 - 完整版
 * 参考 Cherry Studio OpenAIApiClient 实现
 * 支持标准的 Chat Completions API
 */
import type { Provider } from '../../types/provider';
import type { Chunk } from '../../types/chunk';
import { ChunkType } from '../../types/chunk';
import type {
  SdkModel,
  SdkUsage,
  RequestOptions,
} from '../../types/sdk';
import { BaseApiClient } from '../base';
import type {
  RequestTransformer,
  ResponseChunkTransformer,
  CompletionsContext,
  GenerateImageParams,
  MCPTool,
  MCPToolResponse,
  MCPCallToolResponse,
  Model,
  CompletionsParams,
} from '../base/types';

// ==================== OpenAI Types ====================

interface OpenAIRequestParams {
  model: string;
  messages: OpenAIMessage[];
  stream?: boolean;
  stream_options?: { include_usage: boolean };
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  max_completion_tokens?: number;
  tools?: OpenAITool[];
  tool_choice?: 'auto' | 'none' | 'required';
  response_format?: { type: 'text' | 'json_object' };
  // 推理模型参数
  reasoning_effort?: 'low' | 'medium' | 'high';
  reasoning?: { effort?: string; enabled?: boolean };
  // DeepSeek/Qwen 思考模式
  enable_thinking?: boolean;
  thinking?: { type: 'enabled' | 'disabled' | 'auto' };
  thinking_budget?: number;
  // OpenRouter
  include_reasoning?: boolean;
}

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool' | 'developer';
  content: string | null | OpenAIContentPart[];
  name?: string;
  tool_call_id?: string;
  tool_calls?: OpenAIToolCall[];
}

interface OpenAIContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string };
}

interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
}

interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * OpenAI 流式响应 Chunk - 完整类型
 * 支持多种供应商的扩展字段
 */
interface OpenAIStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    // 流式响应
    delta?: OpenAIContentSource;
    // 非流式响应
    message?: OpenAIContentSource;
    finish_reason: string | null;
  }>;
  usage?: SdkUsage;
  // 扩展字段
  citations?: any[];
  web_search?: any[];
  search_results?: any[];
  search_info?: { search_results?: any[] };
}

/**
 * 内容源 - 支持 delta 和 message 两种格式
 */
interface OpenAIContentSource {
  role?: string;
  content?: string | null;
  // 推理内容 (DeepSeek R1, OpenRouter, etc.)
  reasoning_content?: string;
  reasoning?: string;
  // Doubao 思考
  thinking?: { content?: string };
  // 工具调用
  tool_calls?: Array<{
    index: number;
    id?: string;
    type?: string;
    function?: {
      name?: string;
      arguments?: string;
    };
  }>;
  // 图片 (OpenRouter Gemini)
  images?: Array<{ image_url?: { url: string } }>;
  // 注解
  annotations?: any[];
}

// ==================== OpenAI Client ====================

/**
 * OpenAI 客户端
 */
export class OpenAIClient extends BaseApiClient<
  unknown, // SDK Instance (使用 fetch)
  OpenAIRequestParams,
  AsyncIterable<OpenAIStreamChunk>,
  OpenAIStreamChunk,
  OpenAIMessage,
  OpenAIToolCall,
  OpenAITool
> {
  constructor(provider: Provider) {
    super(provider);
  }

  // ==================== SDK Instance ====================

  public getSdkInstance(): unknown {
    // OpenAI 使用 fetch，不需要 SDK 实例
    return null;
  }

  // ==================== Core API ====================

  /**
   * 构建完整的 API URL
   * 处理各种 apiHost 格式：
   * - https://api.openai.com/v1 -> https://api.openai.com/v1/chat/completions
   * - https://xxx.hf.space -> https://xxx.hf.space/v1/chat/completions
   * - https://xxx/v1/ -> https://xxx/v1/chat/completions
   */
  private buildApiUrl(endpoint: string): string {
    let baseUrl = this.getBaseURL();
    
    // 移除末尾斜杠
    baseUrl = baseUrl.replace(/\/+$/, '');
    
    // 如果 baseUrl 不包含 /v1，添加它（OpenAI 兼容 API 标准路径）
    if (!baseUrl.includes('/v1')) {
      baseUrl = `${baseUrl}/v1`;
    }
    
    return `${baseUrl}${endpoint}`;
  }

  public async createCompletions(
    payload: OpenAIRequestParams,
    options?: RequestOptions
  ): Promise<AsyncIterable<OpenAIStreamChunk>> {
    const url = this.buildApiUrl('/chat/completions');
    
    console.log(`[OpenAIClient] 请求 URL: ${url}`);
    
    // 🔧 修复：使用 payload 中的 stream 设置，默认为 true
    const streamEnabled = payload.stream !== false;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: this.getDefaultHeaders(),
      body: JSON.stringify({ ...payload, stream: streamEnabled }),
      signal: options?.signal,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API Error: ${response.status} ${error}`);
    }

    // 🔧 非流式响应：解析 JSON 并转换为单个 chunk
    if (!streamEnabled) {
      const data = await response.json();
      console.log(`[OpenAIClient] 非流式响应:`, data);
      
      // 将非流式响应包装为异步迭代器
      return (async function* () {
        yield data as OpenAIStreamChunk;
      })();
    }

    return this.parseSSEStream(response);
  }

  public async listModels(): Promise<SdkModel[]> {
    const url = this.buildApiUrl('/models');
    
    const response = await fetch(url, {
      method: 'GET',
      headers: this.getDefaultHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to list models: ${response.status}`);
    }

    const data = await response.json();
    return (data.data || []).map((m: any) => ({
      id: m.id,
      object: m.object,
      created: m.created,
      owned_by: m.owned_by,
    }));
  }

  public async getEmbeddingDimensions(_model?: Model): Promise<number> {
    return 1536; // OpenAI 默认
  }

  public async generateImage(params: GenerateImageParams): Promise<string[]> {
    const url = `${this.getBaseURL()}/images/generations`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: this.getDefaultHeaders(),
      body: JSON.stringify({
        model: params.model || 'dall-e-3',
        prompt: params.prompt,
        n: params.n || 1,
        size: params.size || '1024x1024',
        quality: params.quality || 'standard',
      }),
    });

    if (!response.ok) {
      throw new Error(`Image generation failed: ${response.status}`);
    }

    const data = await response.json();
    return (data.data || []).map((img: any) => img.url).filter(Boolean);
  }

  // ==================== Transformers ====================

  public getRequestTransformer(): RequestTransformer<OpenAIRequestParams, OpenAIMessage> {
    return new OpenAIRequestTransformer(this);
  }

  public getResponseChunkTransformer(ctx: CompletionsContext): ResponseChunkTransformer<OpenAIStreamChunk> {
    return new OpenAIResponseTransformer(ctx);
  }

  // ==================== Tool Conversion ====================

  public convertMcpToolsToSdkTools(mcpTools: MCPTool[]): OpenAITool[] {
    return mcpTools.map(tool => ({
      type: 'function' as const,
      function: {
        name: this.sanitizeToolName(tool.id || tool.name),
        description: tool.description || '',
        parameters: (tool.inputSchema as Record<string, unknown>) || { type: 'object', properties: {} },
      },
    }));
  }

  public convertSdkToolCallToMcp(
    toolCall: OpenAIToolCall,
    mcpTools: MCPTool[]
  ): MCPTool | undefined {
    return mcpTools.find(t =>
      this.sanitizeToolName(t.id || t.name) === toolCall.function.name
    );
  }

  public convertSdkToolCallToMcpToolResponse(
    toolCall: OpenAIToolCall,
    mcpTool: MCPTool
  ): MCPToolResponse {
    return {
      id: toolCall.id,
      toolCallId: toolCall.id,
      tool: mcpTool,
      arguments: JSON.parse(toolCall.function.arguments || '{}'),
      status: 'pending',
    };
  }

  public convertMcpToolResponseToSdkMessageParam(
    mcpToolResponse: MCPToolResponse,
    resp: MCPCallToolResponse,
    _model: Model
  ): OpenAIMessage | undefined {
    return {
      role: 'tool',
      tool_call_id: mcpToolResponse.toolCallId || mcpToolResponse.id,
      content: resp.isError ? `Error: ${this.extractContent(resp)}` : this.extractContent(resp),
    };
  }

  // ==================== Message Handling ====================

  public buildSdkMessages(
    currentReqMessages: OpenAIMessage[],
    _output: unknown,
    toolResults: OpenAIMessage[],
    toolCalls?: OpenAIToolCall[]
  ): OpenAIMessage[] {
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

  public extractMessagesFromSdkPayload(sdkPayload: OpenAIRequestParams): OpenAIMessage[] {
    return sdkPayload.messages;
  }

  public estimateMessageTokens(message: OpenAIMessage): number {
    const content = typeof message.content === 'string'
      ? message.content
      : JSON.stringify(message.content);
    return Math.ceil((content?.length || 0) / 4);
  }

  // ==================== Helper Methods ====================

  private async *parseSSEStream(response: Response): AsyncIterable<OpenAIStreamChunk> {
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') {
              return;
            }
            try {
              yield JSON.parse(data);
            } catch {
              // 忽略解析错误
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  private extractContent(resp: MCPCallToolResponse): string {
    return resp.content
      .map(c => c.text || '')
      .filter(Boolean)
      .join('\n');
  }

  public getClientCompatibilityType(_model?: Model): string[] {
    return ['OpenAIClient', 'OpenAIAPIClient'];
  }
}

// ==================== Request Transformer ====================

class OpenAIRequestTransformer implements RequestTransformer<OpenAIRequestParams, OpenAIMessage> {
  constructor(private client: OpenAIClient) {}

  transform(params: CompletionsParams): OpenAIRequestParams {
    const { messages, assistant, mcpTools } = params;
    const model = assistant?.model;

    // 转换消息
    const sdkMessages: OpenAIMessage[] = [];

    // 添加系统提示词
    if (assistant?.prompt) {
      sdkMessages.push({
        role: 'system',
        content: assistant.prompt,
      });
    }

    // 转换用户消息
    for (const msg of messages) {
      sdkMessages.push(this.transformMessage(msg));
    }

    // 构建请求参数
    const request: OpenAIRequestParams = {
      model: model?.id || 'gpt-3.5-turbo',
      messages: sdkMessages,
      stream: true,
      temperature: (this.client as any).getTemperature(assistant, model),
      top_p: (this.client as any).getTopP(assistant, model),
      max_tokens: (this.client as any).getMaxTokens(assistant, model),
    };

    // 添加工具
    if (mcpTools && mcpTools.length > 0) {
      const { tools } = this.client.setupToolsConfig({
        mcpTools,
        model: model || { id: '', name: '', provider: '' },
        enableToolUse: params.enableToolUse,
      });
      if (tools.length > 0) {
        request.tools = tools;
        request.tool_choice = 'auto';
      }
    }

    return request;
  }

  transformMessage(message: any): OpenAIMessage {
    return {
      role: message.role === 'system' ? 'system' : message.role === 'assistant' ? 'assistant' : 'user',
      content: typeof message.content === 'string' ? message.content : message.content || '',
    };
  }
}

// ==================== Response Transformer ====================

/**
 * OpenAI 响应转换器 - 完整版
 * 参考 Cherry Studio getResponseChunkTransformer 实现
 */
class OpenAIResponseTransformer implements ResponseChunkTransformer<OpenAIStreamChunk> {
  private toolCallsBuffer: Map<number, { id: string; name: string; arguments: string }> = new Map();
  private isThinking = false;
  private isAccumulatingText = false;
  private hasFinishReason = false;
  private isFinished = false;
  private lastUsage: SdkUsage | null = null;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_ctx: CompletionsContext) {
    // _ctx 保留用于后续扩展（如 provider 特定处理）
  }

  /**
   * 转换单个 chunk 为标准 Chunk 数组
   * 参考 Cherry Studio 的 transform 实现
   */
  transform(chunk: OpenAIStreamChunk): Chunk[] {
    const chunks: Chunk[] = [];

    // 更新 usage 信息
    if (chunk.usage) {
      this.lastUsage = {
        prompt_tokens: chunk.usage.prompt_tokens || 0,
        completion_tokens: chunk.usage.completion_tokens || 0,
        total_tokens: chunk.usage.total_tokens || 0,
      };
    }

    // 如果已经结束，检查是否需要发送完成信号
    if (this.hasFinishReason && !this.isFinished) {
      chunks.push(...this.emitCompletionSignals());
      return chunks;
    }

    // 处理 choices
    if (chunk.choices && chunk.choices.length > 0) {
      for (const choice of chunk.choices) {
        if (!choice) continue;

        // 获取内容源（支持 delta 和 message 两种格式）
        let contentSource: OpenAIContentSource | null = null;
        
        if (choice.delta && Object.keys(choice.delta).length > 0) {
          // 流式响应：检查 delta 是否有实际内容
          const delta = choice.delta;
          const hasContent = delta.content || 
            delta.reasoning_content || 
            delta.reasoning || 
            delta.thinking?.content ||
            (delta.tool_calls && delta.tool_calls.length > 0);
          
          if (hasContent || delta.role) {
            contentSource = delta;
          }
        } else if (choice.message) {
          // 非流式响应
          contentSource = choice.message;
        }

        // 如果没有内容源，检查 finish_reason
        if (!contentSource) {
          if (choice.finish_reason) {
            this.hasFinishReason = true;
            if (this.lastUsage) {
              chunks.push(...this.emitCompletionSignals());
            }
          }
          continue;
        }

        // === 处理推理/思考内容 ===
        const reasoningText = 
          contentSource.reasoning_content || 
          contentSource.reasoning || 
          contentSource.thinking?.content;
        
        if (reasoningText) {
          this.isThinking = true;
          chunks.push({
            type: ChunkType.THINKING_DELTA,
            text: reasoningText,
          });
        } else if (this.isThinking) {
          // 思考结束
          chunks.push({ type: ChunkType.THINKING_COMPLETE, text: '' });
          this.isThinking = false;
        }

        // === 处理文本内容 ===
        if (contentSource.content) {
          this.isAccumulatingText = true;
          chunks.push({
            type: ChunkType.TEXT_DELTA,
            text: contentSource.content,
          });
        } else if (this.isAccumulatingText && !contentSource.tool_calls) {
          this.isAccumulatingText = false;
        }

        // === 处理图片内容 (OpenRouter Gemini) ===
        if (contentSource.images && Array.isArray(contentSource.images)) {
          chunks.push({ type: ChunkType.IMAGE_CREATED });
          chunks.push({
            type: ChunkType.IMAGE_COMPLETE,
            image: {
              type: 'base64',
              images: contentSource.images.map(img => img.image_url?.url || ''),
            },
          });
        }

        // === 处理工具调用 ===
        if (contentSource.tool_calls) {
          for (const toolCall of contentSource.tool_calls) {
            if ('index' in toolCall) {
              const { id, index } = toolCall;
              const func = toolCall.function;
              
              if (func?.name) {
                // 新工具调用
                const toolCallObject = {
                  id: id || '',
                  name: func.name,
                  arguments: func.arguments || '',
                };
                
                if (index === -1) {
                  this.toolCallsBuffer.set(this.toolCallsBuffer.size, toolCallObject);
                } else {
                  this.toolCallsBuffer.set(index, toolCallObject);
                }
              } else if (func?.arguments) {
                // 追加参数
                const existing = this.toolCallsBuffer.get(index);
                if (existing) {
                  existing.arguments += func.arguments;
                }
              }
            }
          }
        }

        // === 处理 finish_reason ===
        if (choice.finish_reason) {
          this.hasFinishReason = true;
          if (this.lastUsage) {
            chunks.push(...this.emitCompletionSignals());
          }
        }
      }
    }

    return chunks;
  }

  /**
   * 发送完成信号
   */
  private emitCompletionSignals(): Chunk[] {
    if (this.isFinished) return [];

    const chunks: Chunk[] = [];

    // 发送工具调用完成
    if (this.toolCallsBuffer.size > 0) {
      const toolCalls = Array.from(this.toolCallsBuffer.values());
      chunks.push({
        type: ChunkType.MCP_TOOL_COMPLETE,
        responses: toolCalls.map(tc => ({
          id: tc.id,
          name: tc.name,
          arguments: this.parseArguments(tc.arguments),
        })),
      } as any);
    }

    // 发送响应完成（包含 usage 信息）
    chunks.push({
      type: ChunkType.LLM_RESPONSE_COMPLETE,
      // Response 扩展：添加 usage 信息
      response: {
        id: 'completion',
        content: '',
      },
      // 额外存储 usage
      usage: this.lastUsage || {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
      },
    } as any);

    this.isFinished = true;
    return chunks;
  }

  /**
   * 安全解析 JSON 参数
   */
  private parseArguments(args: string): Record<string, unknown> {
    try {
      return JSON.parse(args || '{}');
    } catch {
      return { raw: args };
    }
  }
}

export { OpenAIRequestTransformer, OpenAIResponseTransformer };
