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

// 导入现有的 MCP 提示词构建函数
import { buildSystemPrompt } from '../utils/mcpPrompt';
// 导入 MCP 工具调用相关函数
import { parseToolUse, parseAndCallTools, hasToolUseTags } from '../utils/mcpToolParser';

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
   * 核心方法，处理流式/非流式响应
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

    // 累积的结果
    let accumulatedText = '';
    let accumulatedReasoning = '';
    let usage: CompletionsResult['usage'];
    
    // 🔧 思考时间跟踪
    let thinkingStartTime = 0;
    let hasStartedThinking = false;
    // 🔧 文本开始标志（参考 Cherry Studio）
    let hasStartedText = false;

    try {
      // 1. 转换消息格式（传入 mcpTools 和 mcpMode 支持提示词注入）
      const sdkMessages = this.transformMessages(messages, assistant, mcpTools, params.mcpMode);

      // 2. 构建 SDK 请求参数
      const transformer = this.apiClient.getRequestTransformer();
      const sdkPayload = transformer.transform({
        messages: sdkMessages.map((m, i) => ({
          id: m.id || `msg-${i}`,
          role: m.role,
          content: m.content,
        })),
        assistant,
        mcpTools: mcpTools?.map(t => ({
          ...t,
          serverName: t.serverId || 'unknown',
        })) as any,
        enableToolUse: !!mcpTools?.length,
      });
      
      // 🔧 设置流式输出
      (sdkPayload as any).stream = streamOutput;

      // 3. 发送 LLM_RESPONSE_CREATED
      if (onChunk) {
        await onChunk({ type: ChunkType.LLM_RESPONSE_CREATED });
      }

      // 4. 执行请求
      const rawStream = await this.apiClient.createCompletions(
        sdkPayload as any,
        { signal: options?.signal || params.abortSignal }
      );

      // 5. 处理流式响应
      // 🔧 参照 Cherry Studio ThinkChunkMiddleware 的设计：
      // - THINKING_DELTA.text 是累积的完整内容，不是增量
      // - 收到非思考 chunk 时才发送 THINKING_COMPLETE
      for await (const rawChunk of rawStream as AsyncIterable<any>) {
        // 🔧 调试：打印原始 chunk
        if (!streamOutput) {
          console.log(`[AiProvider] 非流式 rawChunk:`, JSON.stringify(rawChunk).substring(0, 500));
        }
        
        // 解析 chunk，不传 onChunk（由我们统一处理）
        const result = this.processChunk(rawChunk);
        
        // 🔧 调试：打印解析结果
        if (!streamOutput) {
          console.log(`[AiProvider] 非流式解析结果:`, { text: result.text?.substring(0, 100), reasoning: result.reasoning?.substring(0, 100) });
        }
        
        // 处理思考内容
        if (result.reasoning) {
          // 第一次接收到思考内容时记录开始时间
          if (!hasStartedThinking) {
            hasStartedThinking = true;
            thinkingStartTime = Date.now();
            // 🔧 只在流式模式下发送 THINKING_START（非流式不需要多轮重置）
            console.log('[AiProvider] 准备发送 THINKING_START', { onChunk: !!onChunk, streamOutput });
            if (onChunk && streamOutput) {
              await onChunk({ type: ChunkType.THINKING_START } as Chunk);
              console.log('[AiProvider] THINKING_START 已发送');
            }
          }
          
          // 累积思考内容
          accumulatedReasoning += result.reasoning;
          
          // 🔧 关键：发送的 text 是累积内容，不是增量
          // 非流式模式直接发送 THINKING_COMPLETE（因为一次性完成）
          if (onChunk) {
            if (streamOutput) {
              await onChunk({
                type: ChunkType.THINKING_DELTA,
                text: accumulatedReasoning,
                thinking_millsec: Date.now() - thinkingStartTime,
              } as Chunk);
            }
            // 非流式模式的思考内容在处理文本时一起发送 THINKING_COMPLETE
          }
        }
        
        // 处理文本内容
        if (result.text) {
          // 🔧 收到文本时，如果之前有思考内容，先发送 THINKING_COMPLETE
          if (hasStartedThinking && thinkingStartTime > 0) {
            if (onChunk) {
              await onChunk({
                type: ChunkType.THINKING_COMPLETE,
                text: accumulatedReasoning,
                thinking_millsec: Date.now() - thinkingStartTime,
              } as Chunk);
            }
            // 重置思考状态
            hasStartedThinking = false;
            thinkingStartTime = 0;
          }
          
          // 🔧 参考 Cherry Studio：第一次发送文本前，先发送 TEXT_START
          if (!hasStartedText && streamOutput) {
            hasStartedText = true;
            console.log('[AiProvider] 准备发送 TEXT_START', { onChunk: !!onChunk, streamOutput });
            if (onChunk) {
              await onChunk({ type: ChunkType.TEXT_START } as Chunk);
              console.log('[AiProvider] TEXT_START 已发送');
            }
          }
          
          accumulatedText += result.text;
          if (onChunk) {
            // 🔧 非流式模式发送 TEXT_COMPLETE，流式模式发送 TEXT_DELTA
            // 参考 Cherry Studio：发送累积的文本，不是增量
            await onChunk({
              type: streamOutput ? ChunkType.TEXT_DELTA : ChunkType.TEXT_COMPLETE,
              text: accumulatedText,
            } as Chunk);
          }
        }
        
        if (result.usage) {
          usage = result.usage;
        }
      }
      
      // 🔧 流结束后，如果还有未完成的思考内容，发送 THINKING_COMPLETE
      if (hasStartedThinking && thinkingStartTime > 0 && accumulatedReasoning) {
        if (onChunk) {
          await onChunk({
            type: ChunkType.THINKING_COMPLETE,
            text: accumulatedReasoning,
            thinking_millsec: Date.now() - thinkingStartTime,
          } as Chunk);
        }
        hasStartedThinking = false;
        thinkingStartTime = 0;
      }

      // 6. 检查是否需要处理工具调用（提示词注入模式的多轮工具调用）
      if (params.mcpMode === 'prompt' && mcpTools && mcpTools.length > 0) {
        const hasTools = hasToolUseTags(accumulatedText, mcpTools as any);
        
        if (hasTools) {
          console.log(`[AiProvider] 🔧 检测到工具调用，开始执行...`);
          
          // 解析工具调用
          const toolResponses = parseToolUse(accumulatedText, mcpTools as any);
          
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
            
            // 🔧 发送当前轮响应完成信号
            if (onChunk) {
              onChunk({
                type: ChunkType.LLM_RESPONSE_COMPLETE,
                response: { id: 'tool-call-response', content: accumulatedText },
              } as Chunk);
            }
            
            // 构建递归调用的消息（不包含系统提示词，因为递归时会重新构建）
            const originalMessages = Array.isArray(messages) ? messages : [{ role: 'user' as const, content: messages }];
            const newMessages: Message[] = [
              ...originalMessages,
              { role: 'assistant', content: accumulatedText },
              { role: 'user', content: toolResultsText }
            ];
            
            // 递归调用（最多递归 5 次防止无限循环）
            const recursionDepth = (params as any)._recursionDepth || 0;
            if (recursionDepth < 5) {
              // 🔧 发送新一轮响应开始信号
              if (onChunk) {
                await onChunk({ type: ChunkType.LLM_RESPONSE_CREATED } as Chunk);
              }
              
              const recursiveResult = await this.completions({
                ...params,
                messages: newMessages,
                _recursionDepth: recursionDepth + 1,
              } as any, options);
              
              // 合并结果（不再简单拼接，因为每轮都是独立的）
              const finalText = recursiveResult.getText();
              const finalReasoning = recursiveResult.getReasoning();
              
              return {
                getText: () => finalText,
                getReasoning: () => finalReasoning || undefined,
                usage,
              };
            } else {
              console.warn(`[AiProvider] ⚠️ 达到最大递归深度，停止工具调用`);
            }
          }
        }
      }

      // 7. 发送完成信号
      // 🔧 参考 Cherry Studio：先发送 TEXT_COMPLETE，再发送 LLM_RESPONSE_COMPLETE
      if (onChunk && accumulatedText && streamOutput) {
        await onChunk({
          type: ChunkType.TEXT_COMPLETE,
          text: accumulatedText,
        } as Chunk);
      }
      
      if (onChunk) {
        await onChunk({
          type: ChunkType.LLM_RESPONSE_COMPLETE,
          response: { id: 'completion', content: accumulatedText },
        } as Chunk);
      }

      console.log(`[AiProvider] completions 完成 - 文本长度: ${accumulatedText.length}, 推理长度: ${accumulatedReasoning.length}`);

      return {
        getText: () => accumulatedText,
        getReasoning: () => accumulatedReasoning || undefined,
        usage,
      };
    } catch (error) {
      console.error('[AiProvider] completions 错误:', error);
      
      // 发送错误 chunk
      if (onChunk) {
        await onChunk({
          type: ChunkType.ERROR,
          error: {
            message: error instanceof Error ? error.message : String(error),
          },
        });
      }

      if (params.shouldThrow !== false) {
        throw error;
      }

      return {
        getText: () => accumulatedText,
        getReasoning: () => accumulatedReasoning || undefined,
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

  /**
   * 处理单个 Chunk
   * 返回解析出的文本、推理内容和使用统计
   */
  private processChunk(
    rawChunk: any,
    onChunk?: (chunk: Chunk) => void
  ): { text?: string; reasoning?: string; usage?: CompletionsResult['usage'] } {
    const result: { text?: string; reasoning?: string; usage?: CompletionsResult['usage'] } = {};

    // === OpenAI 兼容格式 ===
    if (rawChunk.choices && rawChunk.choices.length > 0) {
      for (const choice of rawChunk.choices) {
        if (!choice) continue;

        // 支持 delta（流式）和 message（非流式）
        let contentSource: any = null;
        if (choice.delta && Object.keys(choice.delta).length > 0) {
          contentSource = choice.delta;
        } else if (choice.message) {
          contentSource = choice.message;
        }

        if (!contentSource) continue;

        // 处理推理内容
        const reasoningText = 
          contentSource.reasoning_content || 
          contentSource.reasoning || 
          contentSource.thinking?.content;
        if (reasoningText) {
          result.reasoning = reasoningText;
          if (onChunk) {
            onChunk({
              type: ChunkType.THINKING_DELTA,
              text: reasoningText,
            } as Chunk);
          }
        }

        // 处理文本内容（支持 null 值）
        if (contentSource.content !== undefined && contentSource.content !== null) {
          result.text = contentSource.content;
          if (onChunk) {
            onChunk({
              type: ChunkType.TEXT_DELTA,
              text: contentSource.content,
            } as Chunk);
          }
        }
      }

      // 处理 usage
      if (rawChunk.usage) {
        result.usage = {
          prompt_tokens: rawChunk.usage.prompt_tokens || 0,
          completion_tokens: rawChunk.usage.completion_tokens || 0,
          total_tokens: rawChunk.usage.total_tokens || 0,
        };
      }
    }
    // === Gemini 格式 ===
    else if (rawChunk.candidates?.[0]?.content?.parts) {
      for (const part of rawChunk.candidates[0].content.parts) {
        if (part.thought && part.text) {
          result.reasoning = part.text;
          if (onChunk) {
            onChunk({
              type: ChunkType.THINKING_DELTA,
              text: part.text,
            } as Chunk);
          }
        } else if (part.text) {
          result.text = part.text;
          if (onChunk) {
            onChunk({
              type: ChunkType.TEXT_DELTA,
              text: part.text,
            } as Chunk);
          }
        }
      }
    }
    // === Anthropic 格式 ===
    else if (rawChunk.type === 'content_block_delta') {
      if (rawChunk.delta?.type === 'text_delta' && rawChunk.delta?.text) {
        result.text = rawChunk.delta.text;
        if (onChunk) {
          onChunk({
            type: ChunkType.TEXT_DELTA,
            text: rawChunk.delta.text,
          } as Chunk);
        }
      } else if (rawChunk.delta?.type === 'thinking_delta' && rawChunk.delta?.thinking) {
        result.reasoning = rawChunk.delta.thinking;
        if (onChunk) {
          onChunk({
            type: ChunkType.THINKING_DELTA,
            text: rawChunk.delta.thinking,
          } as Chunk);
        }
      }
    }
    // === 直接文本格式 ===
    else if (typeof rawChunk === 'string') {
      result.text = rawChunk;
      if (onChunk) {
        onChunk({
          type: ChunkType.TEXT_DELTA,
          text: rawChunk,
        } as Chunk);
      }
    }
    // === 未知格式回退 ===
    else if (rawChunk.content || rawChunk.text || rawChunk.response) {
      const text = rawChunk.content || rawChunk.text || rawChunk.response;
      if (typeof text === 'string') {
        result.text = text;
        if (onChunk) {
          onChunk({
            type: ChunkType.TEXT_DELTA,
            text: text,
          } as Chunk);
        }
      }
    }

    return result;
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
