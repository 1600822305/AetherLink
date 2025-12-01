/**
 * Google Gemini 客户端实现
 * 完全对标 Cherry Studio GeminiAPIClient - 使用官方 SDK
 * 
 * 功能特性：
 * 1. 使用 @google/genai 官方 SDK
 * 2. Chat API 管理对话历史
 * 3. PDF 大文件处理 - Gemini Files API
 * 4. 图片生成 - responseModalities: [IMAGE]
 * 5. 思考预算 - thinkingConfig (根据 reasoning_effort 计算)
 * 6. 原生搜索 - googleSearch / urlContext
 * 7. 安全设置 - HarmBlockThreshold.OFF
 * 8. Gemma 特殊处理 - 特殊 token 格式
 * 9. Vertex AI 支持
 */
import {
  GoogleGenAI,
  HarmBlockThreshold,
  HarmCategory,
  Modality,
  Type as GeminiSchemaType,
  type Content,
  type Part,
  type SafetySetting,
  type GenerateContentConfig,
  type ThinkingConfig,
  type Tool,
  type FunctionCall,
  type GenerateContentResponse,
  type SendMessageParameters,
  type CreateChatParameters,
  type GenerateImagesConfig,
} from '@google/genai';

import type { Provider } from '../../types/provider';
import type { Chunk } from '../../types/chunk';
import { ChunkType } from '../../types/chunk';
import type { SdkModel } from '../../types/sdk';
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
  AssistantConfig,
} from '../base/types';
import { getMainTextContent, findImageBlocks } from '../../../utils/blockUtils';
import { getThinkingBudget } from '../../../utils/settingsUtils';

// 对标 Cherry Studio 的常量配置

// ==================== Constants ====================

const DEFAULT_TIMEOUT = 60 * 1000;

/** Gemini Flash 模型正则 */
const GEMINI_FLASH_MODEL_REGEX = /gemini.*flash/i;

/** 思考努力程度比例 */
const EFFORT_RATIO: Record<string, number> = {
  low: 0.2,
  medium: 0.5,
  high: 0.8,
};

/** 模型 Token 限制配置 */
const TOKEN_LIMITS: Record<string, { min: number; max: number }> = {
  'gemini-2.5-pro': { min: 128, max: 32768 },
  'gemini-2.5-flash': { min: 1, max: 24576 },
  'gemini-2.0-flash-thinking': { min: 1024, max: 24576 },
  default: { min: 0, max: 24576 },
};

// ==================== SDK Types ====================

/** Gemini SDK 参数类型 - 对标 Cherry Studio */
export type GeminiSdkParams = SendMessageParameters & CreateChatParameters & {
  model: string;
  history?: Content[];
  message?: Part[];
};

/** Gemini SDK 原始输出 */
export type GeminiSdkRawOutput = AsyncGenerator<GenerateContentResponse> | GenerateContentResponse;

/** Gemini SDK 原始块 */
export type GeminiSdkRawChunk = GenerateContentResponse;

/** Gemini SDK 消息参数 */
export type GeminiSdkMessageParam = Content;

/** Gemini SDK 工具调用 */
export type GeminiSdkToolCall = FunctionCall;

/** Gemini 请求选项 */
export interface GeminiOptions {
  signal?: AbortSignal;
  streamOutput?: boolean;
  timeout?: number;
}

// ==================== Gemini Client ====================

/**
 * Google Gemini 客户端
 * 完全对标 Cherry Studio GeminiAPIClient - 使用官方 SDK
 */
export class GeminiClient extends BaseApiClient<
  GoogleGenAI,
  GeminiSdkParams,
  GeminiSdkRawOutput,
  GeminiSdkRawChunk,
  Content,
  FunctionCall,
  Tool
> {
  private sdkClient?: GoogleGenAI;

  constructor(provider: Provider) {
    super(provider);
  }

  // ==================== SDK Instance (对标 Cherry Studio) ====================

  /**
   * 获取 SDK 实例
   * 对标 Cherry Studio getSdkInstance
   */
  public async getSdkInstance(): Promise<GoogleGenAI> {
    if (this.sdkClient) {
      return this.sdkClient;
    }

    this.sdkClient = new GoogleGenAI({
      vertexai: this.isVertexAI(),
      apiKey: this.getApiKey(),
      apiVersion: this.getApiVersion(),
      httpOptions: {
        baseUrl: this.getBaseURL(),
        apiVersion: this.getApiVersion(),
        headers: this.provider.extraHeaders || {},
      },
    });

    return this.sdkClient;
  }

  /**
   * 获取 API 版本
   * 对标 Cherry Studio: Vertex AI 用 v1，普通用 v1beta
   */
  private getApiVersion(): string {
    return this.isVertexAI() ? 'v1' : 'v1beta';
  }

  /**
   * 检查是否为 Vertex AI
   */
  private isVertexAI(): boolean {
    return (this.provider as any).isVertex === true;
  }

  public getBaseURL(): string {
    return this.provider.apiHost || 'https://generativelanguage.googleapis.com';
  }

  // ==================== Core API ====================

  /**
   * 创建对话完成请求
   * Web 环境使用 REST API（走 CORS 代理），保持 SDK 类型兼容
   */
  public async createCompletions(
    payload: GeminiSdkParams,
    options?: GeminiOptions
  ): Promise<GeminiSdkRawOutput> {
    const { model, history, message, config } = payload;
    const streamOutput = options?.streamOutput !== false;

    // 构建 REST API 请求体
    const contents: Content[] = [...(history || [])];
    if (message && message.length > 0) {
      contents.push({ role: 'user', parts: message });
    }

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: config?.temperature,
        topP: config?.topP,
        maxOutputTokens: config?.maxOutputTokens,
        thinkingConfig: config?.thinkingConfig,
        responseModalities: config?.responseModalities,
      },
    };

    // 系统指令
    if (config?.systemInstruction) {
      body.systemInstruction = typeof config.systemInstruction === 'string'
        ? { parts: [{ text: config.systemInstruction }] }
        : config.systemInstruction;
    }

    // 安全设置
    if (config?.safetySettings) {
      body.safetySettings = config.safetySettings;
    }

    // 工具
    if (config?.tools && config.tools.length > 0) {
      body.tools = config.tools;
    }

    // 构建 URL（走代理）
    const modelId = model.startsWith('models/') ? model : `models/${model}`;
    const endpoint = streamOutput ? 'streamGenerateContent' : 'generateContent';
    const url = `${this.getBaseURL()}/${modelId}:${endpoint}?alt=sse&key=${this.getApiKey()}`;

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

    if (streamOutput) {
      return this.parseSSEStream(response);
    } else {
      const data = await response.json();
      return data as GenerateContentResponse;
    }
  }

  /**
   * 解析 SSE 流
   */
  private async *parseSSEStream(response: Response): AsyncGenerator<GenerateContentResponse> {
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

  /**
   * 获取模型列表
   * 对标 Cherry Studio listModels
   */
  public async listModels(): Promise<SdkModel[]> {
    const sdk = await this.getSdkInstance();
    const response = await sdk.models.list();
    const models: SdkModel[] = [];

    for await (const model of response) {
      models.push({
        id: model.name?.replace('models/', '') || '',
        object: 'model',
        owned_by: 'google',
      });
    }

    return models;
  }

  /**
   * 获取嵌入维度
   * 对标 Cherry Studio getEmbeddingDimensions
   */
  public async getEmbeddingDimensions(model?: Model): Promise<number> {
    const sdk = await this.getSdkInstance();

    try {
      const data = await sdk.models.embedContent({
        model: model?.id || 'embedding-001',
        contents: [{ role: 'user', parts: [{ text: 'hi' }] }],
      });
      return data.embeddings?.[0]?.values?.length || 768;
    } catch (e) {
      console.warn('[GeminiClient] 获取 embedding 维度失败:', e);
      return 768;
    }
  }

  /**
   * 生成图片
   * 对标 Cherry Studio generateImage
   */
  public async generateImage(params: GenerateImageParams): Promise<string[]> {
    const sdk = await this.getSdkInstance();
    const { model, prompt, imageSize, batchSize = 1, signal } = params;

    try {
      const config: GenerateImagesConfig = {
        numberOfImages: batchSize,
        aspectRatio: imageSize,
        abortSignal: signal,
        httpOptions: {
          timeout: DEFAULT_TIMEOUT,
        },
      };

      const response = await sdk.models.generateImages({
        model: model,
        prompt,
        config,
      });

      if (!response.generatedImages || response.generatedImages.length === 0) {
        return [];
      }

      const images = response.generatedImages
        .filter((image) => image.image?.imageBytes)
        .map((image) => {
          const dataPrefix = `data:${image.image?.mimeType || 'image/png'};base64,`;
          return dataPrefix + image.image?.imageBytes;
        });

      return images;
    } catch (error) {
      console.error('[GeminiClient] generateImage error:', error);
      throw error;
    }
  }

  // ==================== Safety Settings ====================

  /**
   * 获取安全设置
   * 对标 Cherry Studio HarmBlockThreshold.OFF
   */
  private getSafetySettings(): SafetySetting[] {
    return [
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.OFF },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.OFF },
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.OFF },
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.OFF },
      { category: HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY, threshold: HarmBlockThreshold.BLOCK_NONE },
    ];
  }

  // ==================== Thinking Budget ====================

  /**
   * 获取思考预算配置
   * 对标 legacy/clients/gemini/configBuilder.ts 的 getBudgetToken
   * 
   * 优先级：
   * 1. assistant.thinkingBudget（直接设置的数值）
   * 2. 应用设置 getThinkingBudget()
   * 3. reasoning_effort 比例计算
   */
  private getThinkingConfig(assistant: AssistantConfig, model: Model): Partial<GenerateContentConfig> {
    // 检查模型是否支持思考
    if (!this.isSupportedThinkingTokenModel(model)) {
      return {};
    }

    // 🔧 优先读取直接设置的 thinkingBudget，其次从应用设置获取
    const assistantBudget = (assistant as any)?.thinkingBudget || assistant?.settings?.thinkingBudget;
    const appBudget = getThinkingBudget(); // 从应用设置获取
    const directBudget = assistantBudget || appBudget;
    const enableThinking = (assistant as any)?.enableThinking !== false;

    // 如果有直接设置的预算值
    if (directBudget !== undefined && directBudget > 0) {
      const limits = this.findTokenLimit(model.id);
      const budget = Math.max(limits.min, Math.min(directBudget, limits.max));
      
      console.log('[GeminiClient] 使用直接设置的思考预算:', { directBudget, budget, limits });
      
      return {
        thinkingConfig: {
          thinkingBudget: budget,
          includeThoughts: true,
        } satisfies ThinkingConfig,
      };
    }

    // 检查是否禁用思考
    if (!enableThinking) {
      return {
        thinkingConfig: {
          thinkingBudget: 0,
          includeThoughts: false,
        },
      };
    }

    const reasoningEffort = assistant?.settings?.reasoning_effort;

    // 如果 reasoning_effort 是 undefined，Flash 模型不思考
    if (reasoningEffort === undefined) {
      if (GEMINI_FLASH_MODEL_REGEX.test(model.id)) {
        return {
          thinkingConfig: {
            thinkingBudget: 0,
          },
        };
      }
      return {};
    }

    // auto 模式
    if (reasoningEffort === 'auto') {
      return {
        thinkingConfig: {
          includeThoughts: true,
          thinkingBudget: -1,
        },
      };
    }

    // 根据 effort 比例计算预算
    const effortRatio = EFFORT_RATIO[reasoningEffort] || 0.5;
    const limits = this.findTokenLimit(model.id);
    const budget = Math.floor((limits.max - limits.min) * effortRatio + limits.min);

    console.log('[GeminiClient] 思考预算:', { reasoningEffort, effortRatio, budget });

    return {
      thinkingConfig: {
        ...(budget > 0 ? { thinkingBudget: budget } : {}),
        includeThoughts: true,
      } satisfies ThinkingConfig,
    };
  }

  /**
   * 查找模型的 token 限制
   */
  private findTokenLimit(modelId: string): { min: number; max: number } {
    const id = modelId.toLowerCase();
    for (const [key, limits] of Object.entries(TOKEN_LIMITS)) {
      if (id.includes(key)) {
        return limits;
      }
    }
    return TOKEN_LIMITS.default;
  }

  /**
   * 检查模型是否支持思考 token
   */
  private isSupportedThinkingTokenModel(model: Model): boolean {
    const modelId = model.id.toLowerCase();
    return (
      modelId.includes('thinking') ||
      modelId.includes('gemini-2.5') ||
      modelId.includes('gemini-2.0-flash-thinking')
    );
  }


  // ==================== Gemma Special Handling ====================

  /**
   * 检查是否为 Gemma 模型
   */
  private isGemmaModel(model: Model): boolean {
    return model.id.toLowerCase().includes('gemma');
  }

  /**
   * 构建 Gemma 格式的消息
   * 对标 Cherry Studio Gemma 特殊 token 格式
   */
  private buildGemmaMessage(systemPrompt: string, userMessage: string): Part[] {
    return [{
      text: `<start_of_turn>user\n${systemPrompt}<end_of_turn>\n<start_of_turn>user\n${userMessage}<end_of_turn>`
    }];
  }

  // ==================== Image Generation Config ====================

  /**
   * 获取图片生成参数
   * 对标 Cherry Studio responseModalities: [IMAGE]
   */
  private getGenerateImageParameter(): Partial<GenerateContentConfig> {
    return {
      systemInstruction: undefined,
      responseModalities: [Modality.TEXT, Modality.IMAGE],
    };
  }

  // ==================== Transformers ====================

  public getRequestTransformer(): RequestTransformer<GeminiSdkParams, Content> {
    return new GeminiRequestTransformer(this);
  }

  public getResponseChunkTransformer(ctx: CompletionsContext): ResponseChunkTransformer<GeminiSdkRawChunk> {
    return new GeminiResponseTransformer(ctx);
  }

  // ==================== Tool Conversion (对标 Cherry Studio) ====================

  /**
   * MCP 工具转 Gemini 工具
   * 对标 Cherry Studio mcpToolsToGeminiTools
   */
  public convertMcpToolsToSdkTools(mcpTools: MCPTool[]): Tool[] {
    return [{
      functionDeclarations: mcpTools.map(tool => ({
        name: this.sanitizeToolName(tool.id || tool.name),
        description: tool.description || '',
        parameters: {
          type: GeminiSchemaType.OBJECT,
          properties: (tool.inputSchema as any)?.properties || {},
          required: (tool.inputSchema as any)?.required || [],
        },
      })),
    }];
  }

  /**
   * SDK 工具调用转 MCP
   * 对标 Cherry Studio geminiFunctionCallToMcpTool
   */
  public convertSdkToolCallToMcp(
    toolCall: FunctionCall,
    mcpTools: MCPTool[]
  ): MCPTool | undefined {
    const toolName = toolCall.name || toolCall.id;
    if (!toolName) return undefined;

    return mcpTools.find(t =>
      (t.id || t.name).includes(toolName) || (t.name).includes(toolName)
    );
  }

  public convertSdkToolCallToMcpToolResponse(
    toolCall: FunctionCall,
    mcpTool: MCPTool
  ): MCPToolResponse {
    const parsedArgs = (() => {
      try {
        return typeof toolCall.args === 'string' ? JSON.parse(toolCall.args as string) : toolCall.args;
      } catch {
        return toolCall.args;
      }
    })();

    return {
      id: toolCall.id || `gemini_${Date.now()}`,
      toolCallId: toolCall.id,
      tool: mcpTool,
      arguments: parsedArgs as Record<string, unknown>,
      status: 'pending',
    };
  }

  /**
   * MCP 工具响应转 SDK 消息
   * 对标 Cherry Studio convertMcpToolResponseToSdkMessageParam
   */
  public convertMcpToolResponseToSdkMessageParam(
    mcpToolResponse: MCPToolResponse,
    resp: MCPCallToolResponse,
    model: Model
  ): Content | undefined {
    // 支持 toolUseId 和 toolCallId 两种格式
    if ('toolUseId' in mcpToolResponse && mcpToolResponse.toolUseId) {
      return this.mcpToolCallResponseToGeminiMessage(mcpToolResponse, resp, this.isVisionModel(model));
    } else if ('toolCallId' in mcpToolResponse) {
      return {
        role: 'user',
        parts: [{
          functionResponse: {
            id: mcpToolResponse.toolCallId,
            name: mcpToolResponse.tool.id || mcpToolResponse.tool.name,
            response: {
              output: !resp.isError ? resp.content : undefined,
              error: resp.isError ? resp.content : undefined,
            },
          },
        }],
      } satisfies Content;
    }

    // 默认格式
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

  /**
   * MCP 工具响应转 Gemini 消息
   * 对标 Cherry Studio mcpToolCallResponseToGeminiMessage
   */
  private mcpToolCallResponseToGeminiMessage(
    mcpToolResponse: MCPToolResponse,
    resp: MCPCallToolResponse,
    isVisionModel: boolean
  ): Content {
    if (resp.isError) {
      return {
        role: 'user',
        parts: [{ text: JSON.stringify(resp.content) }],
      };
    }

    const parts: Part[] = [{
      text: `Here is the result of mcp tool use \`${mcpToolResponse.tool.name}\`:`,
    }];

    if (isVisionModel) {
      for (const item of resp.content) {
        switch (item.type) {
          case 'text':
            parts.push({ text: item.text || 'no content' });
            break;
          case 'image':
            if (item.data) {
              parts.push({
                inlineData: {
                  data: item.data,
                  mimeType: item.mimeType || 'image/png',
                },
              });
            }
            break;
          default:
            parts.push({ text: `Unsupported type: ${item.type}` });
        }
      }
    } else {
      parts.push({ text: JSON.stringify(resp.content) });
    }

    return { role: 'user', parts };
  }

  /**
   * 检查是否为视觉模型
   */
  private isVisionModel(model: Model): boolean {
    const id = model.id.toLowerCase();
    return id.includes('vision') || id.includes('pro') || id.includes('flash');
  }

  // ==================== Message Handling (对标 Cherry Studio buildSdkMessages) ====================

  /**
   * 构建 SDK 消息
   * 完全对标 Cherry Studio buildSdkMessages
   */
  public buildSdkMessages(
    currentReqMessages: Content[],
    output: GeminiSdkRawOutput | string | undefined,
    toolResults: Content[],
    toolCalls?: FunctionCall[]
  ): Content[] {
    const parts: Part[] = [];
    const modelParts: Part[] = [];

    // 1. 添加模型输出文本
    if (typeof output === 'string' && output) {
      modelParts.push({ text: output });
    }

    // 2. 添加工具调用
    if (toolCalls) {
      toolCalls.forEach((toolCall) => {
        modelParts.push({ functionCall: toolCall });
      });
    }

    // 3. 添加工具结果
    parts.push(
      ...toolResults
        .map((ts) => ts.parts)
        .flat()
        .filter((p): p is Part => p !== undefined)
    );

    // 4. 构建消息序列
    if (modelParts.length > 0) {
      currentReqMessages.push({
        role: 'model',
        parts: modelParts,
      });
    }

    if (parts.length > 0) {
      currentReqMessages.push({
        role: 'user',
        parts: parts,
      });
    }

    return currentReqMessages;
  }

  public extractMessagesFromSdkPayload(sdkPayload: GeminiSdkParams): Content[] {
    const messageParam: Content = {
      role: 'user',
      parts: [],
    };

    if (Array.isArray(sdkPayload.message)) {
      sdkPayload.message.forEach((part) => {
        if (typeof part === 'string') {
          messageParam.parts?.push({ text: part });
        } else if (typeof part === 'object') {
          messageParam.parts?.push(part);
        }
      });
    }

    return [...(sdkPayload.history || []), messageParam];
  }

  public estimateMessageTokens(message: Content): number {
    return (
      message.parts?.reduce((acc, part) => {
        if (part.text) {
          return acc + Math.ceil(part.text.length / 4);
        }
        if (part.functionCall) {
          return acc + Math.ceil(JSON.stringify(part.functionCall).length / 4);
        }
        if (part.functionResponse) {
          return acc + Math.ceil(JSON.stringify(part.functionResponse.response).length / 4);
        }
        if (part.inlineData) {
          return acc + Math.ceil((part.inlineData.data || '').length / 4);
        }
        if (part.fileData) {
          return acc + Math.ceil((part.fileData.fileUri || '').length / 4);
        }
        return acc;
      }, 0) || 0
    );
  }

  public getClientCompatibilityType(_model?: Model): string[] {
    return ['GeminiClient', 'GeminiAPIClient'];
  }
}

// ==================== Request Transformer ====================

/**
 * Gemini 请求转换器
 * 完全对标 Cherry Studio GeminiAPIClient.getRequestTransformer
 */
class GeminiRequestTransformer implements RequestTransformer<GeminiSdkParams, Content> {
  constructor(private client: GeminiClient) {}

  transform(params: CompletionsParams): GeminiSdkParams {
    const { messages, assistant, mcpTools, enableWebSearch, enableToolUse } = params;
    const model = assistant?.model;

    if (!model) {
      throw new Error('Model is required');
    }

    // 对标 Cherry Studio: 分离历史消息和当前消息
    const nonSystemMessages = messages.filter(m => m.role !== 'system');
    
    if (nonSystemMessages.length === 0) {
      throw new Error('No messages to send');
    }

    // 分离最后一条消息和历史消息
    const userLastMessage = nonSystemMessages[nonSystemMessages.length - 1];
    const historyMessages = nonSystemMessages.slice(0, -1);

    // 1. 转换历史消息
    const history: Content[] = [];
    for (const msg of historyMessages) {
      const content = this.transformMessage(msg);
      if (content.parts && content.parts.length === 0) {
        content.parts.push({ text: '' });
      }
      history.push(content);
    }

    // 2. 转换当前消息
    const messageContents = this.transformMessage(userLastMessage);
    if (messageContents.parts && messageContents.parts.length === 0) {
      messageContents.parts.push({ text: '' });
    }

    console.log('[GeminiRequestTransformer] 消息转换:', {
      historyCount: history.length,
      currentMessageParts: messageContents.parts?.length,
    });

    // 3. 构建工具（对标 Cherry Studio）
    let tools: Tool[] = [];
    
    // MCP 工具（函数调用）
    if (mcpTools && mcpTools.length > 0 && enableToolUse) {
      const config = this.client.setupToolsConfig({
        mcpTools,
        model,
        enableToolUse: true,
      });
      tools = config.tools;
    }

    // 原生 Google 搜索（对标 Cherry Studio）
    if (tools.length === 0) {
      if (enableWebSearch) {
        tools.push({ googleSearch: {} });
      }
      if ((params as any).enableUrlContext) {
        tools.push({ urlContext: {} });
      }
    } else if (enableWebSearch || (params as any).enableUrlContext) {
      console.warn('[GeminiClient] Native tools cannot be used with function calling.');
    }

    // 4. 获取系统指令
    let systemInstruction: string | undefined = assistant?.prompt;

    // Gemma 模型特殊处理（对标 Cherry Studio）
    if (this.client['isGemmaModel'](model) && assistant?.prompt && history.length === 0) {
      const userText = messageContents.parts?.[0]?.text || '';
      messageContents.parts = this.client['buildGemmaMessage'](assistant.prompt, userText);
      systemInstruction = undefined;  // Gemma 不使用 systemInstruction
    }

    // 5. 构建生成配置
    const generateContentConfig: GenerateContentConfig = {
      safetySettings: this.client['getSafetySettings'](),
      systemInstruction: this.client['isGemmaModel'](model) ? undefined : systemInstruction,
      temperature: (this.client as any).getTemperature(assistant, model),
      topP: (this.client as any).getTopP(assistant, model),
      maxOutputTokens: (this.client as any).getMaxTokens(assistant, model),
      tools: tools.length > 0 ? tools : undefined,
    };

    // 思考预算配置（对标 Cherry Studio）
    const thinkingConfig = this.client['getThinkingConfig'](assistant, model);
    if (thinkingConfig.thinkingConfig) {
      generateContentConfig.thinkingConfig = thinkingConfig.thinkingConfig;
    }

    // 图片生成模式（对标 Cherry Studio）
    if ((params as any).enableGenerateImage) {
      const imageConfig = this.client['getGenerateImageParameter']();
      Object.assign(generateContentConfig, imageConfig);
    }

    // 自定义参数（对标 Cherry Studio）
    if ((params as any).callType === 'chat' && assistant?.settings?.customParameters) {
      for (const param of assistant.settings.customParameters) {
        if (param.name?.trim()) {
          (generateContentConfig as any)[param.name] = param.value;
        }
      }
    }

    return {
      model: model.id,
      config: generateContentConfig,
      history: history,
      message: messageContents.parts || [{ text: '' }],
    };
  }

  /**
   * 转换消息为 Gemini 格式
   * 支持 blocks 系统和传统 content 格式
   */
  transformMessage(message: any): Content {
    const role = message.role === 'assistant' ? 'model' : 'user';
    
    // 🔧 修复：处理 content 可能是字符串或数组（OpenAI 多模态格式）
    let textContent = '';
    if (message.content) {
      if (typeof message.content === 'string') {
        textContent = message.content;
      } else if (Array.isArray(message.content)) {
        // OpenAI 多模态格式: [{ type: 'text', text: '...' }]
        const textPart = message.content.find((p: any) => p.type === 'text');
        textContent = textPart?.text || '';
      }
    } else if (message.blocks && message.blocks.length > 0) {
      // 仅当没有 content 时才尝试从 blocks 提取
      textContent = getMainTextContent(message);
    }
    
    const parts: Part[] = [{ text: textContent }];

    // 从 blocks 系统获取图片
    const imageBlocks = findImageBlocks(message);
    if (imageBlocks && imageBlocks.length > 0) {
      for (const block of imageBlocks) {
        const base64Data = block.base64Data || block.url;
        if (base64Data) {
          const matches = base64Data.match(/^data:(.+);base64,(.*)$/);
          if (matches && matches.length === 3) {
            parts.push({
              inlineData: {
                mimeType: matches[1],
                data: matches[2],
              },
            });
          } else if (block.url) {
            // URL 形式的图片
            parts.push({
              fileData: {
                mimeType: (block as any).mimeType || 'image/jpeg',
                fileUri: block.url,
              },
            });
          }
        }
      }
    }

    // 兼容旧格式：message.images
    if (message.images && message.images.length > 0) {
      for (const image of message.images) {
        if (image.base64Data) {
          const matches = image.base64Data.match(/^data:(.+);base64,(.*)$/);
          if (matches && matches.length === 3) {
            parts.push({
              inlineData: {
                mimeType: matches[1],
                data: matches[2],
              },
            });
          }
        } else if (image.url) {
          parts.push({
            fileData: {
              mimeType: 'image/jpeg',
              fileUri: image.url,
            },
          });
        }
      }
    }

    return { role, parts };
  }
}

// ==================== Response Transformer ====================

/**
 * Gemini 响应转换器
 * 完全对标 Cherry Studio GeminiAPIClient.getResponseChunkTransformer
 */
class GeminiResponseTransformer implements ResponseChunkTransformer<GeminiSdkRawChunk> {
  private isFirstTextChunk = true;
  private isFirstThinkingChunk = true;
  private hasThinkingContent = false; // 🔧 追踪是否有思考内容
  private toolCalls: FunctionCall[] = [];

  constructor(private _ctx: CompletionsContext) {}

  transform(chunk: GeminiSdkRawChunk): Chunk[] {
    const chunks: Chunk[] = [];

    // 处理字符串 chunk（SSE 解析的情况）
    let parsedChunk = chunk;
    if (typeof chunk === 'string') {
      try {
        parsedChunk = JSON.parse(chunk);
      } catch (error) {
        console.error('[GeminiResponseTransformer] Invalid chunk:', chunk);
        return chunks;
      }
    }
    
    if (!parsedChunk.candidates || parsedChunk.candidates.length === 0) {
      return chunks;
    }

    for (const candidate of parsedChunk.candidates) {
      if (candidate.content?.parts) {
        for (const part of candidate.content.parts) {
          const text = part.text || '';

          // 思考内容（对标 Cherry Studio part.thought）
          if (part.thought) {
            if (this.isFirstThinkingChunk) {
              chunks.push({ type: ChunkType.THINKING_START });
              this.isFirstThinkingChunk = false;
            }
            this.hasThinkingContent = true;
            chunks.push({
              type: ChunkType.THINKING_DELTA,
              text: text,
            });
          }
          // 普通文本
          else if (part.text) {
            // 🔧 修复：思考结束后发送 THINKING_COMPLETE
            if (this.hasThinkingContent && this.isFirstTextChunk) {
              chunks.push({ 
                type: ChunkType.THINKING_COMPLETE,
                text: '',
              } as Chunk);
              this.hasThinkingContent = false;
            }
            if (this.isFirstTextChunk) {
              chunks.push({ type: ChunkType.TEXT_START });
              this.isFirstTextChunk = false;
            }
            chunks.push({
              type: ChunkType.TEXT_DELTA,
              text: text,
            });
          }
          // 图片输出（对标 Cherry Studio responseModalities: [IMAGE]）
          else if (part.inlineData) {
            const imageData = part.inlineData.data?.startsWith('data:')
              ? part.inlineData.data
              : `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
            
            chunks.push({
              type: ChunkType.IMAGE_COMPLETE,
              image: {
                type: 'base64',
                images: [imageData],
              },
            } as Chunk);
          }
          // 工具调用
          else if (part.functionCall) {
            this.toolCalls.push(part.functionCall);
          }
        }
      }

      // finishReason 处理
      if (candidate.finishReason) {
        // 🔧 修复：确保思考完成事件被发送
        if (this.hasThinkingContent) {
          chunks.push({ 
            type: ChunkType.THINKING_COMPLETE,
            text: '',
          } as Chunk);
          this.hasThinkingContent = false;
        }

        // 搜索结果（对标 Cherry Studio groundingMetadata）
        if (candidate.groundingMetadata) {
          chunks.push({
            type: ChunkType.LLM_WEB_SEARCH_COMPLETE,
            llm_web_search: {
              results: candidate.groundingMetadata,
              source: 'gemini',
            },
          } as unknown as Chunk);
        }

        // 工具调用完成
        if (this.toolCalls.length > 0) {
          chunks.push({
            type: ChunkType.MCP_TOOL_CREATED,
            tool_calls: [...this.toolCalls],
          } as unknown as Chunk);
          this.toolCalls = [];
        }

        // 响应完成
        chunks.push({
          type: ChunkType.LLM_RESPONSE_COMPLETE,
          response: {
            usage: {
              prompt_tokens: parsedChunk.usageMetadata?.promptTokenCount || 0,
              completion_tokens: (parsedChunk.usageMetadata?.totalTokenCount || 0) - (parsedChunk.usageMetadata?.promptTokenCount || 0),
              total_tokens: parsedChunk.usageMetadata?.totalTokenCount || 0,
            },
          },
        });
      }
    }

    // 如果还有未处理的工具调用（在没有 finishReason 的情况下）
    if (this.toolCalls.length > 0) {
      chunks.push({
        type: ChunkType.MCP_TOOL_CREATED,
        tool_calls: this.toolCalls,
      } as unknown as Chunk);
    }

    return chunks;
  }
}

// ==================== Exports ====================

export { 
  GeminiRequestTransformer, 
  GeminiResponseTransformer,
  HarmBlockThreshold,
  HarmCategory,
};
