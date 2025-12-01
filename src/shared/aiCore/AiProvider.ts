/**
 * AiProvider - AI 提供者核心类
 * 完全参考 Cherry Studio aiCore/legacy/index.ts 实现
 * 
 * 职责：
 * 1. 根据 Provider 创建对应的 ApiClient
 * 2. 构建和管理中间件链
 * 3. 执行 completions 请求
 * 4. 处理流式响应
 */

import { ApiClientFactory, initializeDefaultClients } from './clients';
import type { BaseApiClient } from './clients/base';
import type { Provider } from './types/provider';
import type { Chunk } from './types/chunk';
import { ChunkType } from './types/chunk';
import type { SdkModel } from './types/sdk';
import type { Model } from '../types';

// 导入适配器
import { OpenAIToAiSdkAdapter } from './adapters/OpenAIToAiSdkAdapter';
import { AiSdkToChunkAdapter } from './adapters/AiSdkToChunkAdapter';
import type { MCPTool as AdapterMCPTool } from './adapters/ToolCallChunkHandler';

// 导入现有的 MCP 提示词构建函数
import { buildSystemPrompt } from '../utils/mcpPrompt';
// 导入 MCP 工具调用相关函数
import { parseToolUse, parseAndCallTools, hasToolUseTags } from '../utils/mcpToolParser';

// 导入新的中间件系统
import {
  CompletionsMiddlewareBuilder,
  applyCompletionsMiddlewares,
  MiddlewareRegistry,
  type CompletionsParams as MiddlewareCompletionsParams,
} from './middleware';

// 图片生成模型判断
import { MIDDLEWARE_NAME as FinalChunkConsumerMiddlewareName } from './middleware/common/FinalChunkConsumerMiddleware';
import { MIDDLEWARE_NAME as ErrorHandlerMiddlewareName } from './middleware/common/ErrorHandlerMiddleware';
import { MIDDLEWARE_NAME as AbortHandlerMiddlewareName } from './middleware/common/AbortHandlerMiddleware';
import { MIDDLEWARE_NAME as ImageGenerationMiddlewareName } from './middleware/feat/ImageGenerationMiddleware';

// ==================== Types ====================

/**
 * Completions 请求参数
 */
export interface CompletionsParams {
  /** 调用类型 */
  callType: 'chat' | 'check' | 'translate' | 'summary' | 'generate' | 'search' | 'test';
  /** 消息内容（可以是消息数组或字符串）*/
  messages: Message[] | string;
  /** 助手配置 */
  assistant: Assistant;
  /** 是否流式输出 */
  streamOutput?: boolean;
  /** 主题ID */
  topicId?: string;
  /** MCP工具列表 */
  mcpTools?: MCPTool[];
  /** MCP 模式：prompt=提示词注入, function=函数调用 */
  mcpMode?: 'prompt' | 'function';
  /** 是否启用网络搜索 */
  enableWebSearch?: boolean;
  /** 是否启用图片生成 */
  enableGenerateImage?: boolean;
  /** 最大 tokens */
  maxTokens?: number;
  /** 是否应该抛出错误 */
  shouldThrow?: boolean;
  /** Chunk 回调 */
  onChunk?: (chunk: Chunk) => void;
  /** 中断信号 */
  abortSignal?: AbortSignal;
}

/**
 * Completions 结果
 */
export interface CompletionsResult {
  /** 获取文本内容 */
  getText: () => string;
  /** 获取推理内容 */
  getReasoning: () => string | undefined;
  /** 获取原始输出 */
  rawOutput?: unknown;
  /** 使用统计 */
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * 消息类型
 */
export interface Message {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  topicId?: string;
  [key: string]: unknown;
}

/**
 * 助手配置
 */
export interface Assistant {
  id: string;
  name?: string;
  prompt?: string;
  model?: Model;
  settings?: {
    temperature?: number;
    topP?: number;
    maxTokens?: number;
    streamOutput?: boolean;
    reasoning_effort?: 'low' | 'medium' | 'high';
    [key: string]: unknown;
  };
  mcpServers?: { id: string }[];
  [key: string]: unknown;
}

/**
 * MCP 工具
 */
export interface MCPTool {
  id?: string;
  name: string;
  description?: string;
  inputSchema?: unknown;
  serverId?: string;
  [key: string]: unknown;
}

/**
 * 图片生成参数
 */
export interface GenerateImageParams {
  model: string;
  prompt: string;
  negativePrompt?: string;
  imageSize?: string;
  batchSize?: number;
  seed?: string;
  numInferenceSteps?: number;
  guidanceScale?: number;
  signal?: AbortSignal;
  promptEnhancement?: boolean;
}

// ==================== AiProvider Class ====================

/**
 * AI 提供者类
 * 核心入口，负责创建客户端、构建中间件、执行请求
 */
export default class AiProvider {
  private apiClient: BaseApiClient;
  private provider: Provider;
  private initialized = false;

  constructor(provider: Provider) {
    this.provider = provider;
    // 延迟初始化客户端
    this.apiClient = null as unknown as BaseApiClient;
  }

  /**
   * 确保客户端已初始化
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    
    await initializeDefaultClients();
    this.apiClient = ApiClientFactory.create(this.provider);
    this.initialized = true;
    
    console.log(`[AiProvider] 初始化完成 - Provider: ${this.provider.id}, Type: ${this.provider.type}`);
  }

  /**
   * 执行 Completions 请求
   * 使用适配器链处理流式响应（参考 Cherry Studio 架构）
   * 
   * 流程：OpenAIClient → OpenAIToAiSdkAdapter → AiSdkToChunkAdapter → Chunk 回调
   */
  public async completions(
    params: CompletionsParams,
    options?: { signal?: AbortSignal; timeout?: number }
  ): Promise<CompletionsResult> {
    await this.ensureInitialized();

    const {
      messages,
      assistant,
      streamOutput = true,
      onChunk,
      mcpTools,
    } = params;

    const model = assistant.model;
    if (!model) {
      throw new Error('Model is required');
    }

    console.log(`[AiProvider] completions - Model: ${model.id}, Stream: ${streamOutput}`);

    // 用于存储最终结果
    let finalText = '';
    let finalReasoning = '';
    let usage: CompletionsResult['usage'];

    try {
      // 1. 转换消息格式
      const sdkMessages = this.transformMessages(messages, assistant, mcpTools, params.mcpMode);

      // 2. 构建 SDK 请求参数
      const transformer = this.apiClient.getRequestTransformer();
      const sdkPayload = transformer.transform({
        // 传递完整消息对象，包括 images 等属性
        messages: sdkMessages.map((m, i) => ({
          ...m,
          id: m.id || `msg-${i}`,
        })),
        assistant,
        mcpTools: params.mcpMode === 'prompt' ? [] : mcpTools?.map(t => ({
          ...t,
          serverName: t.serverId || 'unknown',
        })) as any,
        enableToolUse: params.mcpMode === 'prompt' ? false : !!mcpTools?.length,
        mcpMode: params.mcpMode,
      });
      
      (sdkPayload as any).stream = streamOutput;

      // 3. 发送 LLM_RESPONSE_CREATED（适配器内部不会发送这个）
      if (onChunk) {
        await onChunk({ type: ChunkType.LLM_RESPONSE_CREATED });
      }

      // 4. 执行请求
      const rawStream = await this.apiClient.createCompletions(
        sdkPayload as any,
        { signal: options?.signal || params.abortSignal }
      );

      // 5. 创建 onChunk 回调
      const chunkCallback = (chunk: Chunk) => {
        // 收集结果（使用累积的文本）
        if (chunk.type === ChunkType.TEXT_DELTA) {
          finalText += (chunk as any).text || '';
        }
        if (chunk.type === ChunkType.THINKING_DELTA) {
          finalReasoning += (chunk as any).text || '';
        }
        if (chunk.type === ChunkType.LLM_RESPONSE_COMPLETE && (chunk as any).response?.usage) {
          usage = (chunk as any).response.usage;
        }
        
        // 转发给外部回调
        if (onChunk) {
          onChunk(chunk);
        }
      };

      console.log('[AiProvider] 开始处理流..., Provider:', this.provider.type);

      // 6. 根据 provider 类型选择不同的流处理方式
      const providerType = this.provider.type?.toLowerCase() || '';
      
      if (providerType === 'gemini' || providerType === 'google') {
        // Gemini 专用处理（对标 Cherry Studio）
        await this.processGeminiStream(rawStream as AsyncIterable<any>, chunkCallback);
      } else {
        // OpenAI 兼容格式 → AI SDK 格式 → Chunk 事件
        const openAIAdapter = new OpenAIToAiSdkAdapter();
        const aiSdkResult = await openAIAdapter.convertToAiSdkStream(rawStream as AsyncIterable<any>);
        
        const chunkAdapter = new AiSdkToChunkAdapter(
          chunkCallback,
          mcpTools as AdapterMCPTool[],
          true,
          params.enableWebSearch
        );
        
        await chunkAdapter.processStream(aiSdkResult);
      }

      // 6. 检查是否需要处理工具调用（提示词注入模式的多轮工具调用）
      if (params.mcpMode === 'prompt' && mcpTools && mcpTools.length > 0) {
        const hasTools = hasToolUseTags(finalText, mcpTools as any);
        
        if (hasTools) {
          console.log(`[AiProvider] 🔧 检测到工具调用，开始执行...`);
          
          const toolResponses = parseToolUse(finalText, mcpTools as any);
          
          if (toolResponses.length > 0) {
            console.log(`[AiProvider] 解析出 ${toolResponses.length} 个工具调用`);
            
            // 执行工具调用
            const toolResults = await parseAndCallTools(toolResponses, mcpTools as any, onChunk);
            
            // 格式化工具结果
            const toolResultsText = toolResults.map((result, index) => {
              const toolResponse = toolResponses[index];
              if (result.isError) {
                return `<tool_use_result>\n  <name>${toolResponse.tool.name}</name>\n  <error>${result.content.map(c => c.text).join('\n')}</error>\n</tool_use_result>`;
              } else {
                return `<tool_use_result>\n  <name>${toolResponse.tool.name}</name>\n  <result>${JSON.stringify(result.content)}</result>\n</tool_use_result>`;
              }
            }).join('\n\n');
            
            console.log(`[AiProvider] 🔄 递归调用 LLM，传递工具结果...`);
            
            // 构建递归消息
            const originalMessages = Array.isArray(messages) ? messages : [{ role: 'user' as const, content: messages }];
            const newMessages: Message[] = [
              ...originalMessages,
              { role: 'assistant', content: finalText },
              { role: 'user', content: toolResultsText }
            ];
            
            // 递归调用（最多 5 次）
            const recursionDepth = (params as any)._recursionDepth || 0;
            if (recursionDepth < 5) {
              const recursiveResult = await this.completions({
                ...params,
                messages: newMessages,
                _recursionDepth: recursionDepth + 1,
              } as any, options);
              
              return {
                getText: () => recursiveResult.getText(),
                getReasoning: () => recursiveResult.getReasoning(),
                usage: recursiveResult.usage || usage,
              };
            } else {
              console.warn(`[AiProvider] ⚠️ 达到最大递归深度，停止工具调用`);
            }
          }
        }
      }

      console.log(`[AiProvider] completions 完成 - 文本: ${finalText.length}字, 推理: ${finalReasoning.length}字`);

      return {
        getText: () => finalText,
        getReasoning: () => finalReasoning || undefined,
        usage,
      };
    } catch (error) {
      console.error('[AiProvider] completions 错误:', error);
      
      if (onChunk) {
        await onChunk({
          type: ChunkType.ERROR,
          error: { message: error instanceof Error ? error.message : String(error) },
        });
      }

      if (params.shouldThrow !== false) {
        throw error;
      }

      return {
        getText: () => finalText,
        getReasoning: () => finalReasoning || undefined,
        usage,
      };
    }
  }

  /**
   * 带 Trace 的 Completions
   */
  public async completionsForTrace(
    params: CompletionsParams,
    options?: { signal?: AbortSignal; timeout?: number }
  ): Promise<CompletionsResult> {
    // 简化版，暂不实现 trace
    return this.completions(params, options);
  }

  /**
   * 获取模型列表
   */
  public async models(): Promise<SdkModel[]> {
    await this.ensureInitialized();
    return this.apiClient.listModels();
  }

  /**
   * 获取 Embedding 维度
   */
  public async getEmbeddingDimensions(model: Model): Promise<number> {
    await this.ensureInitialized();
    return this.apiClient.getEmbeddingDimensions(model);
  }

  /**
   * 生成图片
   */
  public async generateImage(params: GenerateImageParams): Promise<string[]> {
    await this.ensureInitialized();
    return this.apiClient.generateImage(params as any);
  }

  /**
   * 获取 Base URL
   */
  public getBaseURL(): string {
    return this.provider.apiHost || '';
  }

  /**
   * 获取 API Key
   */
  public getApiKey(): string {
    return this.provider.apiKey || '';
  }

  // ==================== Private Methods ====================

  /**
   * 处理 Gemini 流式响应
   * 对标 Cherry Studio getResponseChunkTransformer + TextChunkMiddleware
   * 
   * 关键：TEXT_DELTA 发送的是累积后的完整文本，不是原始增量
   */
  private async processGeminiStream(
    rawStream: AsyncIterable<any>,
    onChunk: (chunk: Chunk) => void
  ): Promise<void> {
    let isFirstTextChunk = true;
    let isFirstThinkingChunk = true;
    let hasThinkingContent = false; // 🔧 追踪是否有思考内容
    const toolCalls: any[] = [];
    
    // 对标 Cherry Studio TextChunkMiddleware: 累积文本
    let accumulatedTextContent = '';
    let accumulatedThinkingContent = '';

    for await (const rawChunk of rawStream) {
      // Cherry Studio: if (typeof chunk === 'string') { chunk = JSON.parse(chunk) }
      let chunk = rawChunk;
      if (typeof chunk === 'string') {
        try {
          chunk = JSON.parse(chunk);
        } catch (error) {
          console.error('[AiProvider] Gemini invalid chunk:', chunk, error);
          continue;
        }
      }

      // 处理 candidates
      if (chunk.candidates && chunk.candidates.length > 0) {
        for (const candidate of chunk.candidates) {
          if (candidate.content?.parts) {
            for (const part of candidate.content.parts) {
              const text = part.text || '';

              // 思考内容
              if (part.thought) {
                if (isFirstThinkingChunk) {
                  onChunk({ type: ChunkType.THINKING_START });
                  isFirstThinkingChunk = false;
                }
                hasThinkingContent = true;
                // 累积思考内容
                accumulatedThinkingContent += text;
                onChunk({ 
                  type: ChunkType.THINKING_DELTA, 
                  text: accumulatedThinkingContent  // 发送累积后的完整文本
                } as Chunk);
              }
              // 普通文本
              else if (part.text) {
                // 🔧 修复：思考结束后发送 THINKING_COMPLETE
                if (hasThinkingContent && isFirstTextChunk) {
                  onChunk({ 
                    type: ChunkType.THINKING_COMPLETE,
                    text: accumulatedThinkingContent,
                  } as Chunk);
                  hasThinkingContent = false;
                }
                if (isFirstTextChunk) {
                  onChunk({ type: ChunkType.TEXT_START });
                  isFirstTextChunk = false;
                }
                // 对标 Cherry Studio TextChunkMiddleware: accumulatedTextContent += chunk.text
                accumulatedTextContent += text;
                onChunk({ 
                  type: ChunkType.TEXT_DELTA, 
                  text: accumulatedTextContent  // 发送累积后的完整文本！
                } as Chunk);
              }
              // 图片
              else if (part.inlineData) {
                const imageData = part.inlineData.data?.startsWith('data:')
                  ? part.inlineData.data
                  : `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
                onChunk({
                  type: ChunkType.IMAGE_COMPLETE,
                  image: { type: 'base64', images: [imageData] },
                } as Chunk);
              }
              // 工具调用
              else if (part.functionCall) {
                toolCalls.push(part.functionCall);
              }
            }
          }

          // 完成处理
          if (candidate.finishReason) {
            // 🔧 修复：确保思考完成事件被发送
            if (hasThinkingContent) {
              onChunk({ 
                type: ChunkType.THINKING_COMPLETE,
                text: accumulatedThinkingContent,
              } as Chunk);
              hasThinkingContent = false;
            }

            // 搜索结果
            if (candidate.groundingMetadata) {
              onChunk({
                type: ChunkType.LLM_WEB_SEARCH_COMPLETE,
                llm_web_search: {
                  results: candidate.groundingMetadata,
                  source: 'gemini',
                },
              } as unknown as Chunk);
            }

            // 工具调用
            if (toolCalls.length > 0) {
              onChunk({
                type: ChunkType.MCP_TOOL_CREATED,
                tool_calls: [...toolCalls],
              } as unknown as Chunk);
              toolCalls.length = 0;
            }

            // 发送 TEXT_COMPLETE（对标 Cherry Studio）
            if (accumulatedTextContent) {
              onChunk({
                type: ChunkType.TEXT_COMPLETE,
                text: accumulatedTextContent,
              } as Chunk);
            }

            // 响应完成
            onChunk({
              type: ChunkType.LLM_RESPONSE_COMPLETE,
              response: {
                usage: {
                  prompt_tokens: chunk.usageMetadata?.promptTokenCount || 0,
                  completion_tokens: (chunk.usageMetadata?.totalTokenCount || 0) - (chunk.usageMetadata?.promptTokenCount || 0),
                  total_tokens: chunk.usageMetadata?.totalTokenCount || 0,
                },
              },
            });
          }
        }
      }
    }
  }

  /**
   * 判断是否为专用图片生成模型
   * 对标 Cherry Studio isDedicatedImageGenerationModel
   */
  private isDedicatedImageGenerationModel(model: Model): boolean {
    const modelId = model.id.toLowerCase();
    
    // DALL-E 系列
    if (modelId.includes('dall-e')) return true;
    
    // Stable Diffusion
    if (modelId.includes('stable-diffusion')) return true;
    if (modelId.includes('sdxl')) return true;
    
    // Midjourney
    if (modelId.includes('midjourney')) return true;
    
    // Imagen (Google)
    if (modelId.includes('imagen')) return true;
    
    // Flux
    if (modelId.includes('flux')) return true;
    
    // 通用图片生成模型标识
    if (modelId.includes('image-generation')) return true;
    if (modelId.includes('text-to-image')) return true;
    
    // 检查模型能力
    if ((model as any).capabilities?.imageGeneration === true) return true;
    if ((model as any).type === 'image') return true;
    
    return false;
  }

  /**
   * 转换消息格式
   * 🔧 支持 MCP 提示词注入模式
   */
  private transformMessages(
    messages: Message[] | string,
    assistant: Assistant,
    mcpTools?: MCPTool[],
    mcpMode?: 'prompt' | 'function'
  ): Message[] {
    // 如果是字符串，转换为消息数组
    if (typeof messages === 'string') {
      return [{ role: 'user', content: messages }];
    }

    // 构建系统提示词
    let systemPrompt = assistant.prompt || '';

    // 🔧 关键：如果有 MCP 工具且使用提示词注入模式，注入工具定义
    console.log(`[AiProvider] MCP 状态 - 工具数量: ${mcpTools?.length || 0}, 模式: ${mcpMode}`);
    
    if (mcpTools && mcpTools.length > 0 && mcpMode === 'prompt') {
      console.log(`[AiProvider] 🔧 提示词注入模式：注入 ${mcpTools.length} 个 MCP 工具`);
      systemPrompt = buildSystemPrompt(systemPrompt, mcpTools as any);
      console.log(`[AiProvider] 注入后系统提示词长度: ${systemPrompt.length}`);
    } else if (mcpTools && mcpTools.length > 0) {
      console.log(`[AiProvider] 函数调用模式：${mcpTools.length} 个工具将通过 tools 参数传递`);
    }

    // 添加系统提示词
    const result: Message[] = [];
    if (systemPrompt) {
      result.push({ role: 'system', content: systemPrompt });
    }

    // 添加用户消息
    result.push(...messages);
    return result;
  }

  // ==================== V2: 使用新中间件系统 ====================

  /**
   * 执行 Completions 请求（V2 - 使用新中间件系统）
   * 基于 Redux 风格中间件架构，对标 Cherry Studio
   */
  public async completionsV2(
    params: CompletionsParams,
    options?: { signal?: AbortSignal; timeout?: number }
  ): Promise<CompletionsResult> {
    await this.ensureInitialized();

    const { messages, assistant, onChunk, mcpTools, mcpMode } = params;
    const model = assistant.model;

    console.log('[AiProvider.V2] 使用新中间件系统执行 completions');

    // 1. 转换消息格式
    const sdkMessages = this.transformMessages(messages, assistant, mcpTools, mcpMode);

    // 2. 构建中间件链（对标 Cherry Studio）
    const builder = CompletionsMiddlewareBuilder.withDefaults();
    
    // 🔧 图片生成模型：使用专用中间件链（对标 Cherry Studio）
    if (model && this.isDedicatedImageGenerationModel(model)) {
      console.log('[AiProvider.V2] 检测到图片生成模型，使用专用中间件链');
      builder.clear();
      builder
        .add(MiddlewareRegistry[FinalChunkConsumerMiddlewareName])
        .add(MiddlewareRegistry[ErrorHandlerMiddlewareName])
        .add(MiddlewareRegistry[AbortHandlerMiddlewareName])
        .add(MiddlewareRegistry[ImageGenerationMiddlewareName]);
    } else {
      // 普通对话模型：根据配置调整中间件
      if (!mcpTools?.length) {
        builder.remove('McpToolChunkMiddleware');
        builder.remove('ToolUseExtractionMiddleware');
      }
      if (!params.enableWebSearch) {
        builder.remove('WebSearchMiddleware');
      }
    }

    const middlewareNames = builder.getNames();
    const middlewares = builder.build();
    console.log(`[AiProvider.V2] 中间件链: ${middlewareNames.join(' → ')}`);

    // 3. 构建中间件参数
    const middlewareParams: MiddlewareCompletionsParams = {
      callType: params.callType,
      messages: sdkMessages.map((m, i) => ({
        id: m.id || `msg-${i}`,
        role: m.role,
        content: m.content,
      })) as any,
      assistant: {
        id: assistant.id,
        name: assistant.name,
        prompt: assistant.prompt,
        model: assistant.model,
        settings: {
          temperature: assistant.settings?.temperature,
          topP: assistant.settings?.topP,
          maxTokens: assistant.settings?.maxTokens || params.maxTokens,
          streamOutput: params.streamOutput !== false,
        },
      },
      streamOutput: params.streamOutput !== false,
      topicId: params.topicId,
      mcpTools: mcpTools?.map(t => ({
        ...t,
        serverName: t.serverId || 'unknown',
        serverId: t.serverId || 'unknown',
      })) as any,
      mcpMode: mcpMode || 'function',
      enableToolUse: !!mcpTools?.length,
      enableWebSearch: params.enableWebSearch,
      enableGenerateImage: params.enableGenerateImage,
      maxTokens: params.maxTokens || assistant.settings?.maxTokens,
      onChunk: onChunk as any,
      abortSignal: options?.signal || params.abortSignal,
      shouldThrow: params.shouldThrow,
    };

    // 4. 应用中间件并执行
    const enhancedCompletions = applyCompletionsMiddlewares(
      this.apiClient as any,
      this.apiClient.createCompletions.bind(this.apiClient),
      middlewares
    );

    try {
      const result = await enhancedCompletions(middlewareParams, {
        signal: options?.signal || params.abortSignal,
      });

      console.log('[AiProvider.V2] completions 完成');

      return {
        getText: () => result.getText?.() || '',
        getReasoning: () => result.getReasoning?.(),
        usage: result.usage,
        rawOutput: result.rawOutput,
      };
    } catch (error) {
      console.error('[AiProvider.V2] completions 错误:', error);
      
      if (params.shouldThrow !== false) {
        throw error;
      }

      return {
        getText: () => '',
        getReasoning: () => undefined,
      };
    }
  }
}

// ==================== Helper Functions ====================

/**
 * 从 Model 创建 Provider
 */
export function modelToProvider(model: Model): Provider {
  return {
    id: model.provider || 'custom',
    type: (model.providerType || model.provider || 'openai') as any,
    name: model.name || model.id,
    apiKey: model.apiKey || '',
    apiHost: model.baseUrl || '',
    models: [],
    enabled: true,
  };
}

/**
 * 创建 AiProvider 实例（从 Model）
 */
export function createAiProviderFromModel(model: Model): AiProvider {
  const provider = modelToProvider(model);
  return new AiProvider(provider);
}
