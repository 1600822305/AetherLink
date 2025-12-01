/**
 * Google Gemini 客户端实现
 */
import type { Provider } from '../../types/provider';
import type { Chunk } from '../../types/chunk';
import { ChunkType } from '../../types/chunk';
import type { SdkModel, RequestOptions } from '../../types/sdk';
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

// ==================== Gemini Types ====================

interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

interface GeminiPart {
  text?: string;
  thought?: boolean;
  functionCall?: {
    name: string;
    args: Record<string, unknown>;
  };
  functionResponse?: {
    name: string;
    response: {
      output?: unknown;
      error?: string;
    };
  };
}

interface GeminiRequestParams {
  model: string;
  contents: GeminiContent[];
  systemInstruction?: string;
  generationConfig?: {
    temperature?: number;
    topP?: number;
    maxOutputTokens?: number;
  };
  tools?: GeminiTool[];
}

interface GeminiTool {
  functionDeclarations: Array<{
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  }>;
}

interface GeminiStreamChunk {
  candidates?: Array<{
    content: {
      parts: GeminiPart[];
      role: string;
    };
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

// ==================== Gemini Client ====================

/**
 * Google Gemini 客户端
 */
export class GeminiClient extends BaseApiClient<
  unknown,
  GeminiRequestParams,
  AsyncIterable<GeminiStreamChunk>,
  GeminiStreamChunk,
  GeminiContent,
  GeminiPart,
  GeminiTool
> {
  constructor(provider: Provider) {
    super(provider);
  }

  // ==================== SDK Instance ====================

  public getSdkInstance(): unknown {
    return null;
  }

  public getBaseURL(): string {
    return this.provider.apiHost || 'https://generativelanguage.googleapis.com/v1beta';
  }

  // ==================== Core API ====================

  public async createCompletions(
    payload: GeminiRequestParams,
    options?: RequestOptions
  ): Promise<AsyncIterable<GeminiStreamChunk>> {
    const modelId = payload.model.startsWith('models/') ? payload.model : `models/${payload.model}`;
    const url = `${this.getBaseURL()}/${modelId}:streamGenerateContent?alt=sse&key=${this.getApiKey()}`;

    const body: Record<string, unknown> = {
      contents: payload.contents,
      generationConfig: payload.generationConfig,
    };

    if (payload.systemInstruction) {
      body.systemInstruction = { parts: [{ text: payload.systemInstruction }] };
    }

    if (payload.tools && payload.tools.length > 0) {
      body.tools = payload.tools;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: options?.signal,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API Error: ${response.status} ${error}`);
    }

    return this.parseSSEStream(response);
  }

  public async listModels(): Promise<SdkModel[]> {
    const url = `${this.getBaseURL()}/models?key=${this.getApiKey()}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to list models: ${response.status}`);
    }

    const data = await response.json();
    return (data.models || []).map((m: any) => ({
      id: m.name?.replace('models/', '') || m.name,
      object: 'model',
      owned_by: 'google',
    }));
  }

  public async getEmbeddingDimensions(_model?: Model): Promise<number> {
    return 768;
  }

  public async generateImage(_params: GenerateImageParams): Promise<string[]> {
    console.warn('[GeminiClient] 图像生成功能暂未实现');
    return [];
  }

  // ==================== Transformers ====================

  public getRequestTransformer(): RequestTransformer<GeminiRequestParams, GeminiContent> {
    return new GeminiRequestTransformer(this);
  }

  public getResponseChunkTransformer(ctx: CompletionsContext): ResponseChunkTransformer<GeminiStreamChunk> {
    return new GeminiResponseTransformer(ctx);
  }

  // ==================== Tool Conversion ====================

  public convertMcpToolsToSdkTools(mcpTools: MCPTool[]): GeminiTool[] {
    return [{
      functionDeclarations: mcpTools.map(tool => ({
        name: this.sanitizeToolName(tool.id || tool.name),
        description: tool.description || '',
        parameters: tool.inputSchema as Record<string, unknown>,
      })),
    }];
  }

  public convertSdkToolCallToMcp(
    toolCall: GeminiPart,
    mcpTools: MCPTool[]
  ): MCPTool | undefined {
    if (!toolCall.functionCall) return undefined;
    return mcpTools.find(t =>
      this.sanitizeToolName(t.id || t.name) === toolCall.functionCall!.name
    );
  }

  public convertSdkToolCallToMcpToolResponse(
    toolCall: GeminiPart,
    mcpTool: MCPTool
  ): MCPToolResponse {
    return {
      id: `gemini_${Date.now()}`,
      tool: mcpTool,
      arguments: (toolCall.functionCall?.args || {}) as Record<string, unknown>,
      status: 'pending',
    };
  }

  public convertMcpToolResponseToSdkMessageParam(
    mcpToolResponse: MCPToolResponse,
    resp: MCPCallToolResponse,
    _model: Model
  ): GeminiContent | undefined {
    const content = resp.content.map(c => c.text || '').join('\n');
    return {
      role: 'user',
      parts: [{
        functionResponse: {
          name: this.sanitizeToolName(mcpToolResponse.tool.id || mcpToolResponse.tool.name),
          response: {
            output: !resp.isError ? content : undefined,
            error: resp.isError ? content : undefined,
          },
        },
      }],
    };
  }

  // ==================== Message Handling ====================

  public buildSdkMessages(
    currentReqMessages: GeminiContent[],
    _output: unknown,
    toolResults: GeminiContent[],
    _toolCalls?: GeminiPart[]
  ): GeminiContent[] {
    return [...currentReqMessages, ...toolResults];
  }

  public extractMessagesFromSdkPayload(sdkPayload: GeminiRequestParams): GeminiContent[] {
    return sdkPayload.contents;
  }

  public estimateMessageTokens(message: GeminiContent): number {
    const text = message.parts?.map(p => p.text || '').join('') || '';
    return Math.ceil(text.length / 4);
  }

  // ==================== Helper Methods ====================

  private async *parseSSEStream(response: Response): AsyncIterable<GeminiStreamChunk> {
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

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
            if (data) {
              try {
                yield JSON.parse(data);
              } catch {
                // 忽略解析错误
              }
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  public getClientCompatibilityType(_model?: Model): string[] {
    return ['GeminiClient', 'GeminiAPIClient'];
  }
}

// ==================== Request Transformer ====================

class GeminiRequestTransformer implements RequestTransformer<GeminiRequestParams, GeminiContent> {
  constructor(private client: GeminiClient) {}

  transform(params: CompletionsParams): GeminiRequestParams {
    const { messages, assistant, mcpTools } = params;
    const model = assistant?.model;

    // 转换消息
    const contents: GeminiContent[] = messages
      .filter(m => m.role !== 'system')
      .map(m => this.transformMessage(m));

    // 构建工具
    let tools: GeminiTool[] = [];
    if (mcpTools && mcpTools.length > 0) {
      const config = this.client.setupToolsConfig({
        mcpTools,
        model: model || { id: '', name: '', provider: '' },
        enableToolUse: params.enableToolUse,
      });
      tools = config.tools;
    }

    return {
      model: model?.id || 'gemini-pro',
      contents,
      systemInstruction: assistant?.prompt,
      generationConfig: {
        temperature: (this.client as any).getTemperature(assistant, model),
        topP: (this.client as any).getTopP(assistant, model),
        maxOutputTokens: (this.client as any).getMaxTokens(assistant, model),
      },
      tools: tools.length > 0 ? tools : undefined,
    };
  }

  transformMessage(message: any): GeminiContent {
    const role = message.role === 'assistant' ? 'model' : 'user';
    return {
      role,
      parts: [{ text: message.content || '' }],
    };
  }
}

// ==================== Response Transformer ====================

class GeminiResponseTransformer implements ResponseChunkTransformer<GeminiStreamChunk> {
  constructor(private _ctx: CompletionsContext) {}

  transform(chunk: GeminiStreamChunk): Chunk[] {
    const chunks: Chunk[] = [];
    const candidate = chunk.candidates?.[0];

    if (!candidate?.content?.parts) return chunks;

    for (const part of candidate.content.parts) {
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
          type: ChunkType.MCP_TOOL_COMPLETE,
          responses: [{
            id: `fc_${Date.now()}`,
            name: part.functionCall.name,
            arguments: part.functionCall.args || {},
          }],
        });
      }
    }

    return chunks;
  }
}

export { GeminiRequestTransformer, GeminiResponseTransformer };
