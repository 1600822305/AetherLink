/**
 * AI SDK 流式响应模块
 * 使用 @ai-sdk/openai 的 streamText 实现流式响应
 * 支持推理内容、工具调用、<think> 标签解析
 */
import { streamText, generateText } from 'ai';
import type { OpenAIProvider as AISDKOpenAIProvider } from '@ai-sdk/openai';
import { logApiRequest } from '../../services/infra/LoggerService';
import { EventEmitter, EVENT_NAMES } from '../../services/infra/EventEmitter';
import { hasToolUseTags } from '../../utils/mcpToolParser';
import { ChunkType, type Chunk } from '../../types/chunk';
import { getAppropriateTag, type ReasoningTag, DEFAULT_REASONING_TAGS } from '../../config/reasoningTags';
import type { Model, MCPTool } from '../../types';
import type { ModelProvider } from '../../config/defaultModels';
import { convertMcpToolsToAISDK } from './tools';
import store from '../../store';

/**
 * 获取模型对应的供应商配置
 */
function getProviderConfig(model: Model): ModelProvider | null {
  try {
    const state = store.getState();
    const providers = state.settings?.providers;

    if (!providers || !Array.isArray(providers)) {
      return null;
    }

    // 根据模型的 provider 字段查找对应的供应商
    const provider = providers.find((p: ModelProvider) => p.id === model.provider);
    return provider || null;
  } catch (error) {
    console.error('[AI SDK Stream] 获取供应商配置失败:', error);
    return null;
  }
}

/**
 * 流式响应结果类型
 */
export interface StreamResult {
  content: string;
  reasoning?: string;
  reasoningTime?: number;
  hasToolCalls?: boolean;
  nativeToolCalls?: any[];
}

/**
 * 流式请求参数
 */
export interface StreamParams {
  messages?: any[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  tools?: any[];
  tool_choice?: any;
  signal?: AbortSignal;
  enableTools?: boolean;
  mcpTools?: MCPTool[];
  mcpMode?: 'prompt' | 'function';
  model?: Model;
  /** 自定义请求体参数（优先级：模型级别 > 供应商级别） */
  extraBody?: Record<string, any>;
  /** 是否使用 Responses API（仅对 OpenAI 官方 API 有效） */
  useResponsesAPI?: boolean;
}

/**
 * 解析推理标签内容
 * 支持动态配置的开始/结束标签
 */
class ThinkTagParser {
  private contentBuffer = '';
  private isInThinkTag = false;
  private thinkBuffer = '';
  private reasoningStartTime = 0;
  private hasReasoningContent = false;
  private openingTag: string;
  private closingTag: string;

  constructor(tag?: ReasoningTag) {
    // 支持动态配置的推理标签
    this.openingTag = tag?.openingTag || '<think>';
    this.closingTag = tag?.closingTag || '</think>';
  }

  /**
   * 处理文本块
   * @returns { normalText: string, thinkText: string, isThinking: boolean }
   */
  processChunk(text: string): { normalText: string; thinkText: string; isThinking: boolean } {
    this.contentBuffer += text;
    
    let normalText = '';
    let thinkText = '';
    let processedAny = true;

    while (processedAny && this.contentBuffer.length > 0) {
      processedAny = false;

      if (!this.isInThinkTag) {
        // 查找开始标签
        const thinkStartIndex = this.contentBuffer.indexOf(this.openingTag);
        if (thinkStartIndex !== -1) {
          // 处理开始标签之前的普通内容
          normalText += this.contentBuffer.substring(0, thinkStartIndex);
          
          // 进入思考模式
          this.isInThinkTag = true;
          if (!this.hasReasoningContent) {
            this.hasReasoningContent = true;
            this.reasoningStartTime = Date.now();
          }
          
          this.contentBuffer = this.contentBuffer.substring(thinkStartIndex + this.openingTag.length);
          processedAny = true;
        } else if (this.contentBuffer.length > this.openingTag.length + 5) {
          // 没有找到开始标签，输出安全的内容
          const safeLength = this.contentBuffer.length - (this.openingTag.length + 5);
          const safeContent = this.contentBuffer.substring(0, safeLength);
          normalText += safeContent;
          this.contentBuffer = this.contentBuffer.substring(safeLength);
          processedAny = true;
        }
      } else {
        // 在思考标签内，查找结束标签
        const thinkEndIndex = this.contentBuffer.indexOf(this.closingTag);
        if (thinkEndIndex !== -1) {
          // 处理思考内容
          thinkText += this.contentBuffer.substring(0, thinkEndIndex);
          this.thinkBuffer += this.contentBuffer.substring(0, thinkEndIndex);
          
          // 退出思考模式
          this.isInThinkTag = false;
          this.contentBuffer = this.contentBuffer.substring(thinkEndIndex + this.closingTag.length);
          processedAny = true;
        } else if (this.contentBuffer.length > this.closingTag.length + 5) {
          // 没有找到结束标签，输出安全的思考内容
          const safeLength = this.contentBuffer.length - (this.closingTag.length + 5);
          const safeThinkContent = this.contentBuffer.substring(0, safeLength);
          thinkText += safeThinkContent;
          this.thinkBuffer += safeThinkContent;
          this.contentBuffer = this.contentBuffer.substring(safeLength);
          processedAny = true;
        }
      }
    }

    return { normalText, thinkText, isThinking: this.isInThinkTag };
  }

  /**
   * 流结束时处理剩余内容
   */
  flush(): { normalText: string; thinkText: string } {
    let normalText = '';
    let thinkText = '';

    if (this.contentBuffer.length > 0) {
      if (this.isInThinkTag) {
        thinkText = this.contentBuffer;
        this.thinkBuffer += this.contentBuffer;
      } else {
        normalText = this.contentBuffer;
      }
      this.contentBuffer = '';
    }

    return { normalText, thinkText };
  }

  getFullThinkContent(): string {
    return this.thinkBuffer;
  }

  getReasoningTime(): number {
    return this.hasReasoningContent ? Date.now() - this.reasoningStartTime : 0;
  }
}

/**
 * AI SDK 统一流式响应函数
 * 与原有 unifiedStreamCompletion 接口保持一致
 */
export async function streamCompletion(
  client: AISDKOpenAIProvider,
  modelId: string,
  messages: any[],
  temperature?: number,
  maxTokens?: number,
  additionalParams?: StreamParams,
  onChunk?: (chunk: Chunk) => void
): Promise<StreamResult> {
  console.log(`[AI SDK Stream] 开始流式响应, 模型: ${modelId}`);

  const startTime = Date.now();
  const signal = additionalParams?.signal;
  const model = additionalParams?.model;
  const mcpTools = additionalParams?.mcpTools || [];
  const mcpMode = additionalParams?.mcpMode || 'function';
  const enableTools = additionalParams?.enableTools !== false;

  // 获取 extraBody（优先级：模型级别 > 供应商级别）
  const extraBody = additionalParams?.extraBody || 
                    (model as any)?.extraBody || 
                    (model as any)?.providerExtraBody;

  // 获取 Responses API 开关配置（优先级：供应商配置 > 模型配置 > 默认关闭）
  const providerConfig = model ? getProviderConfig(model) : null;
  const useResponsesAPI = providerConfig?.useResponsesAPI || 
                          additionalParams?.useResponsesAPI || 
                          (model as any)?.useResponsesAPI || 
                          false;

  // 获取推理标签配置（根据模型动态选择）
  const reasoningTag = model ? getAppropriateTag(model) : DEFAULT_REASONING_TAGS[0];

  try {
    // 准备消息 - 转换多模态内容格式
    const processedMessages = messages.map(msg => {
      const role = msg.role as 'system' | 'user' | 'assistant';
      let content = msg.content;
      
      // 处理多模态消息内容（OpenAI 格式 -> AI SDK 格式）
      if (Array.isArray(content)) {
        content = content.map((part: any) => {
          // OpenAI 格式的图片: { type: 'image_url', image_url: { url: '...' } }
          // AI SDK 格式: { type: 'image', image: '...' }
          if (part.type === 'image_url' && part.image_url?.url) {
            return {
              type: 'image',
              image: part.image_url.url,
              ...(part.image_url.detail && { providerOptions: { openai: { imageDetail: part.image_url.detail } } })
            };
          }
          // 文本部分保持不变
          if (part.type === 'text') {
            return { type: 'text', text: part.text };
          }
          // 其他格式直接返回
          return part;
        });
      }
      
      return { role, content };
    });

    // 记录 API 请求
    logApiRequest('AI SDK OpenAI Stream', 'INFO', {
      provider: 'openai-aisdk',
      model: modelId,
      messageCount: processedMessages.length,
      temperature,
      maxTokens,
      extraBody: extraBody ? Object.keys(extraBody) : undefined,
      timestamp: Date.now()
    });

    // 准备工具配置（仅在函数调用模式下）
    let tools: any = undefined;
    if (enableTools && mcpTools.length > 0 && mcpMode === 'function') {
      tools = convertMcpToolsToAISDK(mcpTools);
      console.log(`[AI SDK Stream] 启用 ${Object.keys(tools).length} 个工具`);
    }

    // 🛡️ Prompt 模式防幻觉：添加 stopSequences
    // 当工具通过系统提示词注入（非原生函数调用）时，模型可能在 </tool_use> 后
    // 继续生成 <tool_use_result> 幻觉内容。添加 stop sequence 强制模型停止，
    // 让多轮循环（provider.ts while loop）真正发挥作用
    const isPromptMode = !enableTools && mcpTools.length > 0;
    const stopSequences = isPromptMode ? ['<tool_use_result'] : undefined;

    // 准备 providerOptions（用于传递 extraBody）
    let providerOptions: Record<string, any> | undefined;
    if (extraBody && typeof extraBody === 'object' && Object.keys(extraBody).length > 0) {
      providerOptions = {
        openai: extraBody
      };
      console.log(`[AI SDK Stream] 合并自定义请求体参数: ${Object.keys(extraBody).join(', ')}`);
    }

    // 根据 useResponsesAPI 开关选择 API 类型
    // - client.chat(modelId): Chat Completions API（默认，兼容大多数 OpenAI 兼容服务）
    // - client.responses(modelId): Responses API（仅 OpenAI 官方支持）
    const modelInstance = useResponsesAPI 
      ? client.responses(modelId)  // Responses API
      : client.chat(modelId);       // Chat Completions API

    console.log(`[AI SDK Stream] 使用 ${useResponsesAPI ? 'Responses' : 'Chat Completions'} API`);

    const result = await streamText({
      model: modelInstance,
      messages: processedMessages,
      ...(temperature !== undefined && { temperature }),
      ...(maxTokens !== undefined && { maxTokens }),
      abortSignal: signal,
      ...(tools && { tools }),
      ...(providerOptions && { providerOptions }),
      ...(stopSequences && { stopSequences }),
      // 启用原始 chunk 输出，用于提取第三方 API 的 reasoning_content 字段
      includeRawChunks: true,
    });

    // 解析器 - 使用动态配置的推理标签
    const thinkParser = new ThinkTagParser(reasoningTag);
    let fullContent = '';
    let fullReasoning = '';
    const toolCalls: any[] = [];

    // 处理流式响应
    for await (const part of result.fullStream) {
      switch (part.type) {
        case 'text-delta':
          // 解析 <think> 标签 - AI SDK v6 使用 text 属性
          const textContent = (part as any).text || (part as any).textDelta || '';
          const { normalText, thinkText } = thinkParser.processChunk(textContent);
          
          // ⭐ 累积模式：发送完整累积内容（参考 Cherry Studio）
          if (normalText) {
            fullContent += normalText;
            onChunk?.({ type: ChunkType.TEXT_DELTA, text: fullContent });  // 发送累积内容
          }
          
          if (thinkText) {
            fullReasoning += thinkText;
            onChunk?.({
              type: ChunkType.THINKING_DELTA,
              text: fullReasoning,  // 发送累积内容
              thinking_millsec: thinkParser.getReasoningTime()
            });
          }
          break;

        case 'tool-call':
          console.log(`[AI SDK Stream] 检测到工具调用: ${part.toolName}`);
          // AI SDK v6 使用 input 而不是 args
          const toolInput = (part as any).input || (part as any).args || {};
          toolCalls.push({
            id: part.toolCallId,
            type: 'function',
            function: {
              name: part.toolName,
              arguments: JSON.stringify(toolInput)
            }
          });
          
          // 使用 MCP_TOOL_CREATED 类型
          onChunk?.({
            type: ChunkType.MCP_TOOL_CREATED,
            responses: [{
              id: part.toolCallId,
              name: part.toolName,
              arguments: toolInput,
              status: 'pending'
            }]
          });
          break;

        case 'reasoning-delta':
          // AI SDK 原生推理内容（如 o1 模型）
          const reasoningText = (part as any).text || (part as any).textDelta || '';
          if (reasoningText) {
            fullReasoning += reasoningText;
            onChunk?.({
              type: ChunkType.THINKING_DELTA,
              text: fullReasoning,  // ⭐ 发送累积内容
              thinking_millsec: Date.now() - startTime
            });
          }
          break;

        case 'raw':
          // 处理原始 chunk 数据，提取第三方 API 的 reasoning_content 字段
          // 这是 OpenAI 兼容 API（如 Gemini、DeepSeek 等）返回思考内容的方式
          try {
            const rawChunk = (part as any).rawValue || (part as any).chunk;
            if (rawChunk?.choices?.[0]?.delta?.reasoning_content) {
              const rawReasoningContent = rawChunk.choices[0].delta.reasoning_content;
              if (rawReasoningContent && typeof rawReasoningContent === 'string') {
                fullReasoning += rawReasoningContent;
                onChunk?.({
                  type: ChunkType.THINKING_DELTA,
                  text: fullReasoning,  // ⭐ 发送累积内容
                  thinking_millsec: Date.now() - startTime
                });
              }
            }
            // 同时检查 message.reasoning_content（非流式格式）
            if (rawChunk?.choices?.[0]?.message?.reasoning_content) {
              const msgReasoningContent = rawChunk.choices[0].message.reasoning_content;
              if (msgReasoningContent && typeof msgReasoningContent === 'string' && !fullReasoning.includes(msgReasoningContent)) {
                fullReasoning += msgReasoningContent;
                onChunk?.({
                  type: ChunkType.THINKING_DELTA,
                  text: fullReasoning,  // ⭐ 发送累积内容
                  thinking_millsec: Date.now() - startTime
                });
              }
            }
          } catch (e) {
            // 忽略解析错误
          }
          break;

        case 'finish':
          console.log(`[AI SDK Stream] 流式响应完成`);
          break;
      }
    }

    // 处理剩余内容
    const { normalText: finalNormal, thinkText: finalThink } = thinkParser.flush();
    if (finalNormal) {
      fullContent += finalNormal;
      onChunk?.({ type: ChunkType.TEXT_DELTA, text: fullContent });  // ⭐ 发送累积内容
    }
    if (finalThink) {
      fullReasoning += finalThink;
      onChunk?.({
        type: ChunkType.THINKING_DELTA,
        text: fullReasoning,  // ⭐ 发送累积内容
        thinking_millsec: thinkParser.getReasoningTime()
      });
    }

    // 检测是否有工具调用（需要继续迭代）
    const hasToolCalls = toolCalls.length > 0 || hasToolUseTags(fullContent);
    
    // 发送完成事件（如果有工具调用则跳过，由 provider 控制最终发送）
    // 这样可以避免多轮工具调用时重复创建块
    if (!hasToolCalls) {
      if (fullContent) {
        onChunk?.({ type: ChunkType.TEXT_COMPLETE, text: fullContent });
      }
      
      if (fullReasoning) {
        onChunk?.({
          type: ChunkType.THINKING_COMPLETE,
          text: fullReasoning,
          thinking_millsec: thinkParser.getReasoningTime()
        });
      }
    }

    // 发送全局事件
    EventEmitter.emit(EVENT_NAMES.STREAM_COMPLETE, {
      provider: 'openai-aisdk',
      model: modelId,
      content: fullContent,
      reasoning: fullReasoning,
      timestamp: Date.now()
    });

    // 检查工具使用标签（XML 模式）
    if (hasToolUseTags(fullContent)) {
      console.log(`[AI SDK Stream] 检测到 XML 工具使用标签`);
      EventEmitter.emit(EVENT_NAMES.TOOL_USE_DETECTED, {
        content: fullContent,
        model: modelId
      });
    }

    const endTime = Date.now();
    console.log(`[AI SDK Stream] 完成，耗时: ${endTime - startTime}ms`);

    // 返回结果
    return {
      content: fullContent,
      reasoning: fullReasoning || undefined,
      reasoningTime: fullReasoning ? thinkParser.getReasoningTime() : undefined,
      hasToolCalls,
      nativeToolCalls: toolCalls.length > 0 ? toolCalls : undefined
    };

  } catch (error: any) {
    console.error('[AI SDK Stream] 流式响应失败:', error);

    EventEmitter.emit(EVENT_NAMES.STREAM_ERROR, {
      provider: 'openai-aisdk',
      model: modelId,
      error: error.message,
      timestamp: Date.now()
    });

    throw error;
  }
}

/**
 * 非流式响应函数
 */
export async function nonStreamCompletion(
  client: AISDKOpenAIProvider,
  modelId: string,
  messages: any[],
  temperature?: number,
  maxTokens?: number,
  additionalParams?: StreamParams
): Promise<StreamResult> {
  console.log(`[AI SDK NonStream] 开始非流式响应, 模型: ${modelId}`);

  const startTime = Date.now();
  const signal = additionalParams?.signal;
  const model = additionalParams?.model;
  const mcpTools = additionalParams?.mcpTools || [];
  const mcpMode = additionalParams?.mcpMode || 'function';
  const enableTools = additionalParams?.enableTools !== false;

  // 获取 extraBody（优先级：模型级别 > 供应商级别）
  const extraBody = additionalParams?.extraBody || 
                    (model as any)?.extraBody || 
                    (model as any)?.providerExtraBody;

  // 获取 Responses API 开关配置（优先级：供应商配置 > 模型配置 > 默认关闭）
  const providerConfigNonStream = model ? getProviderConfig(model) : null;
  const useResponsesAPI = providerConfigNonStream?.useResponsesAPI || 
                          additionalParams?.useResponsesAPI || 
                          (model as any)?.useResponsesAPI || 
                          false;

  try {
    const processedMessages = messages.map(msg => ({
      role: msg.role as 'system' | 'user' | 'assistant',
      content: msg.content
    }));

    // 准备工具配置
    let tools: any = undefined;
    if (enableTools && mcpTools.length > 0 && mcpMode === 'function') {
      tools = convertMcpToolsToAISDK(mcpTools);
    }

    // 🛡️ Prompt 模式防幻觉：添加 stopSequences
    const isPromptMode = !enableTools && mcpTools.length > 0;
    const stopSequences = isPromptMode ? ['<tool_use_result'] : undefined;

    // 准备 providerOptions（用于传递 extraBody）
    let providerOptions: Record<string, any> | undefined;
    if (extraBody && typeof extraBody === 'object' && Object.keys(extraBody).length > 0) {
      providerOptions = {
        openai: extraBody
      };
      console.log(`[AI SDK NonStream] 合并自定义请求体参数: ${Object.keys(extraBody).join(', ')}`);
    }

    // 根据 useResponsesAPI 开关选择 API 类型
    const modelInstance = useResponsesAPI 
      ? client.responses(modelId)  // Responses API
      : client.chat(modelId);       // Chat Completions API

    console.log(`[AI SDK NonStream] 使用 ${useResponsesAPI ? 'Responses' : 'Chat Completions'} API`);

    const result = await generateText({
      model: modelInstance,
      messages: processedMessages,
      ...(temperature !== undefined && { temperature }),
      ...(maxTokens !== undefined && { maxTokens }),
      abortSignal: signal,
      ...(tools && { tools }),
      ...(providerOptions && { providerOptions }),
      ...(stopSequences && { stopSequences }),
    });

    const endTime = Date.now();
    console.log(`[AI SDK NonStream] 完成，耗时: ${endTime - startTime}ms`);

    // 提取推理内容（如果有）
    const reasoning = (result as any).reasoning;

    return {
      content: result.text,
      reasoning,
      reasoningTime: reasoning ? endTime - startTime : undefined,
      hasToolCalls: (result.toolCalls?.length ?? 0) > 0,
      nativeToolCalls: result.toolCalls as any[]
    };

  } catch (error: any) {
    console.error('[AI SDK NonStream] 非流式响应失败:', error);
    throw error;
  }
}
