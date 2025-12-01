/**
 * Anthropic Claude 客户端
 * 支持 Claude 系列模型（claude-3-opus, claude-3-sonnet, claude-3-haiku 等）
 */
import { BaseApiClient } from '../base';
import type { Provider } from '../../types/provider';
import type { RequestOptions, SdkModel } from '../../types/sdk';
import type {
  RequestTransformer,
  ResponseChunkTransformer,
  CompletionsContext,
  GenerateImageParams,
  MCPTool,
  MCPToolResponse,
  MCPCallToolResponse,
  Message,
  Model,
} from '../base/types';
import { ChunkType, type Chunk } from '../../types/chunk';

// ==================== Anthropic Types ====================

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | AnthropicContentBlock[];
}

interface AnthropicContentBlock {
  type: 'text' | 'image' | 'tool_use' | 'tool_result';
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string | AnthropicContentBlock[];
  source?: {
    type: 'base64';
    media_type: string;
    data: string;
  };
}

interface AnthropicTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

interface AnthropicToolUse {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

interface AnthropicRequestParams {
  model: string;
  messages: AnthropicMessage[];
  max_tokens: number;
  system?: string;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  stream?: boolean;
  tools?: AnthropicTool[];
  tool_choice?: { type: 'auto' | 'any' | 'tool'; name?: string };
  metadata?: { user_id?: string };
}

interface AnthropicResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: AnthropicContentBlock[];
  model: string;
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use';
  stop_sequence?: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

interface AnthropicStreamEvent {
  type: string;
  index?: number;
  content_block?: AnthropicContentBlock;
  delta?: {
    type: string;
    text?: string;
    partial_json?: string;
  };
  message?: AnthropicResponse;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
}

// ==================== Anthropic Client ====================

/**
 * Anthropic Claude 客户端
 */
export class AnthropicClient extends BaseApiClient<
  unknown,                    // TSdkInstance - 不使用 SDK 实例
  AnthropicRequestParams,     // TSdkParams
  AsyncIterable<AnthropicStreamEvent> | AnthropicResponse, // TRawOutput
  AnthropicStreamEvent,       // TRawChunk
  AnthropicMessage,           // TMessageParam
  AnthropicToolUse,           // TToolCall
  AnthropicTool               // TSdkTool
> {
  private static readonly DEFAULT_MODEL = 'claude-3-5-sonnet-20241022';
  private static readonly API_VERSION = '2023-06-01';
  private static readonly DEFAULT_MAX_TOKENS = 4096;

  constructor(provider: Provider) {
    super(provider);
    console.log('[AnthropicClient] 初始化 Anthropic 客户端');
  }

  // ==================== 核心方法 ====================

  async getSdkInstance(): Promise<unknown> {
    // Anthropic 使用 fetch，不需要 SDK 实例
    return null;
  }

  async createCompletions(
    payload: AnthropicRequestParams,
    options?: RequestOptions
  ): Promise<AsyncIterable<AnthropicStreamEvent> | AnthropicResponse> {
    const url = `${this.getBaseURL()}/messages`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': this.getApiKey(),
      'anthropic-version': AnthropicClient.API_VERSION,
    };

    // 添加 beta 特性头
    if (payload.tools?.length) {
      headers['anthropic-beta'] = 'tools-2024-05-16';
    }

    console.log('[AnthropicClient] 发送请求:', {
      url,
      model: payload.model,
      messageCount: payload.messages.length,
      stream: payload.stream,
      hasTools: !!payload.tools?.length,
    });

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: options?.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
    }

    if (payload.stream) {
      return this.parseSSEStream(response);
    } else {
      return response.json() as Promise<AnthropicResponse>;
    }
  }

  /**
   * 解析 SSE 流
   */
  private async *parseSSEStream(
    response: Response
  ): AsyncIterable<AnthropicStreamEvent> {
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Response body is not readable');
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
              const event = JSON.parse(data) as AnthropicStreamEvent;
              yield event;
            } catch {
              // 忽略解析错误
            }
          }
        }
      }

      // 处理剩余 buffer
      if (buffer.startsWith('data: ')) {
        const data = buffer.slice(6).trim();
        if (data && data !== '[DONE]') {
          try {
            yield JSON.parse(data) as AnthropicStreamEvent;
          } catch {
            // 忽略
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async listModels(): Promise<SdkModel[]> {
    // Anthropic 不提供模型列表 API，返回预定义列表
    return [
      { id: 'claude-3-5-sonnet-20241022', object: 'model', created: Date.now() },
      { id: 'claude-3-opus-20240229', object: 'model', created: Date.now() },
      { id: 'claude-3-sonnet-20240229', object: 'model', created: Date.now() },
      { id: 'claude-3-haiku-20240307', object: 'model', created: Date.now() },
    ];
  }

  async getEmbeddingDimensions(_model?: Model): Promise<number> {
    // Anthropic 不支持 embeddings
    throw new Error('Anthropic does not support embeddings');
  }

  async generateImage(_params: GenerateImageParams): Promise<string[]> {
    // Anthropic 不支持图像生成
    throw new Error('Anthropic does not support image generation');
  }

  // ==================== 转换器 ====================

  getRequestTransformer(): RequestTransformer<AnthropicRequestParams, AnthropicMessage> {
    return {
      transform: (params) => {
        const messages = params.messages.map(m => this.transformMessage(m));
        const systemMessage = params.messages.find(m => m.role === 'system');
        
        // 过滤掉 system 消息
        const filteredMessages = messages.filter((_, i) => 
          params.messages[i].role !== 'system'
        );

        const request: AnthropicRequestParams = {
          model: params.assistant?.model?.id || AnthropicClient.DEFAULT_MODEL,
          messages: filteredMessages,
          max_tokens: params.assistant?.settings?.maxTokens || AnthropicClient.DEFAULT_MAX_TOKENS,
          stream: params.assistant?.settings?.streamOutput !== false,
        };

        // 添加 system prompt
        if (systemMessage) {
          request.system = systemMessage.content;
        }
        if (params.assistant?.prompt) {
          request.system = (request.system || '') + '\n' + params.assistant.prompt;
        }

        // 添加温度设置
        if (params.assistant?.settings?.temperature !== undefined) {
          request.temperature = params.assistant.settings.temperature;
        }

        // 添加工具
        if (params.mcpTools?.length && params.enableToolUse) {
          request.tools = this.convertMcpToolsToSdkTools(params.mcpTools);
          request.tool_choice = { type: 'auto' };
        }

        return request;
      },
      transformMessage: (message) => this.transformMessage(message),
    };
  }

  private transformMessage(message: Message): AnthropicMessage {
    // 处理图片
    if (message.images?.length) {
      const content: AnthropicContentBlock[] = [];
      
      // 添加图片
      for (const img of message.images) {
        if (img.base64Data) {
          content.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: img.base64Data.replace(/^data:image\/\w+;base64,/, ''),
            },
          });
        }
      }
      
      // 添加文本
      if (message.content) {
        content.push({ type: 'text', text: message.content });
      }

      return {
        role: message.role === 'system' ? 'user' : message.role as 'user' | 'assistant',
        content,
      };
    }

    return {
      role: message.role === 'system' ? 'user' : message.role as 'user' | 'assistant',
      content: message.content,
    };
  }

  getResponseChunkTransformer(_ctx: CompletionsContext): ResponseChunkTransformer<AnthropicStreamEvent> {
    let currentText = '';
    let currentToolUse: AnthropicToolUse | null = null;

    return {
      transform: (event: AnthropicStreamEvent): Chunk[] => {
        const chunks: Chunk[] = [];

        switch (event.type) {
          case 'message_start':
            chunks.push({ type: ChunkType.LLM_RESPONSE_CREATED });
            break;

          case 'content_block_start':
            if (event.content_block?.type === 'text') {
              chunks.push({ type: ChunkType.TEXT_START });
            } else if (event.content_block?.type === 'tool_use') {
              currentToolUse = {
                type: 'tool_use',
                id: event.content_block.id!,
                name: event.content_block.name!,
                input: {},
              };
            }
            break;

          case 'content_block_delta':
            if (event.delta?.type === 'text_delta' && event.delta.text) {
              currentText += event.delta.text;
              chunks.push({
                type: ChunkType.TEXT_DELTA,
                text: event.delta.text,
              });
            } else if (event.delta?.type === 'input_json_delta' && event.delta.partial_json) {
              // 工具参数增量
              if (currentToolUse) {
                try {
                  // 尝试解析累积的 JSON
                  currentToolUse.input = JSON.parse(event.delta.partial_json);
                } catch {
                  // 继续累积
                }
              }
            }
            break;

          case 'content_block_stop':
            if (currentToolUse) {
              chunks.push({
                type: ChunkType.MCP_TOOL_IN_PROGRESS,
                responses: [{
                  id: currentToolUse.id,
                  name: currentToolUse.name,
                  arguments: currentToolUse.input,
                  status: 'pending',
                }],
              } as any);
              currentToolUse = null;
            }
            break;

          case 'message_stop':
            if (currentText) {
              chunks.push({
                type: ChunkType.TEXT_COMPLETE,
                text: currentText,
              });
            }
            break;

          case 'message_delta':
            if (event.usage) {
              chunks.push({
                type: ChunkType.LLM_RESPONSE_COMPLETE,
                response: {
                  usage: {
                    prompt_tokens: event.usage.input_tokens || 0,
                    completion_tokens: event.usage.output_tokens || 0,
                    total_tokens: (event.usage.input_tokens || 0) + (event.usage.output_tokens || 0),
                  },
                },
              } as any);
            }
            break;
        }

        return chunks;
      },
    };
  }

  // ==================== 工具相关 ====================

  convertMcpToolsToSdkTools(mcpTools: MCPTool[]): AnthropicTool[] {
    return mcpTools.map(tool => ({
      name: tool.name,
      description: tool.description || '',
      input_schema: (tool.inputSchema || { type: 'object', properties: {} }) as Record<string, unknown>,
    }));
  }

  convertSdkToolCallToMcp(toolCall: AnthropicToolUse, mcpTools: MCPTool[]): MCPTool | undefined {
    return mcpTools.find(t => t.name === toolCall.name);
  }

  convertSdkToolCallToMcpToolResponse(toolCall: AnthropicToolUse, mcpTool: MCPTool): MCPToolResponse {
    return {
      id: toolCall.id,
      tool: mcpTool,
      arguments: toolCall.input,
      status: 'pending',
      toolCallId: toolCall.id,
    };
  }

  convertMcpToolResponseToSdkMessageParam(
    mcpToolResponse: MCPToolResponse,
    resp: MCPCallToolResponse,
    _model: Model
  ): AnthropicMessage | undefined {
    const content: AnthropicContentBlock[] = [{
      type: 'tool_result',
      tool_use_id: mcpToolResponse.toolCallId || mcpToolResponse.id,
      content: resp.content.map(c => c.text || '').join('\n'),
    }];

    return {
      role: 'user',
      content,
    };
  }

  // ==================== 消息处理 ====================

  buildSdkMessages(
    currentReqMessages: AnthropicMessage[],
    _output: unknown,
    toolResults: AnthropicMessage[],
    toolCalls?: AnthropicToolUse[]
  ): AnthropicMessage[] {
    const messages = [...currentReqMessages];

    // 添加助手消息（包含工具调用）
    if (toolCalls?.length) {
      const assistantContent: AnthropicContentBlock[] = toolCalls.map(tc => ({
        type: 'tool_use' as const,
        id: tc.id,
        name: tc.name,
        input: tc.input,
      }));
      messages.push({ role: 'assistant', content: assistantContent });
    }

    // 添加工具结果
    messages.push(...toolResults);

    return messages;
  }

  extractMessagesFromSdkPayload(sdkPayload: AnthropicRequestParams): AnthropicMessage[] {
    return sdkPayload.messages || [];
  }

  estimateMessageTokens(message: AnthropicMessage): number {
    // 简单估算：4 字符 ≈ 1 token
    const content = typeof message.content === 'string'
      ? message.content
      : message.content.map(c => c.text || '').join('');
    return Math.ceil(content.length / 4);
  }

  // ==================== 通用方法 ====================

  getBaseURL(): string {
    return this.provider.apiHost || 'https://api.anthropic.com/v1';
  }

  getClientCompatibilityType(_model?: Model): string[] {
    return ['AnthropicClient', 'AnthropicAPIClient'];
  }
}
