/**
 * AI SDK 流式响应模块
 * 使用 @ai-sdk/openai 的 streamText 实现流式响应
 * 支持推理内容、工具调用、<think> 标签解析
 */
import { streamText, generateText } from 'ai';
import type { OpenAIProvider as AISDKOpenAIProvider } from '@ai-sdk/openai';
import { logApiRequest } from '../../services/infra/LoggerService';
import { hasToolUseTags } from '../../utils/mcpToolParser';
import { ChunkType, type Chunk } from '../../types/chunk';
import { getAppropriateTag, DEFAULT_REASONING_TAGS } from '../../config/reasoningTags';
import type { Model, MCPTool } from '../../types';
import { convertMcpToolsToAISDK } from './tools';
import {
  ThinkTagParser,
  getProviderConfigFromStore,
  accumulateToolCall,
  emitStreamComplete,
  emitStreamError,
  detectAndEmitToolUseTags,
  PROMPT_MODE_STOP_SEQUENCES,
  type BaseStreamResult,
  type BaseStreamParams,
} from '../../ai/adapters/shared/streamShared';

/**
 * 流式响应结果类型
 */
export interface StreamResult extends BaseStreamResult {}

/**
 * 流式请求参数
 */
export interface StreamParams extends BaseStreamParams {
  /** 是否使用 Responses API（仅对 OpenAI 官方 API 有效） */
  useResponsesAPI?: boolean;
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
  const providerConfig = model ? getProviderConfigFromStore(model) : null;
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
    const stopSequences = isPromptMode ? PROMPT_MODE_STOP_SEQUENCES : undefined;

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
          accumulateToolCall(part, toolCalls, onChunk);
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
    emitStreamComplete('openai-aisdk', modelId, fullContent, fullReasoning);

    // 检查工具使用标签（XML 模式）
    detectAndEmitToolUseTags(fullContent, modelId, 'AI SDK Stream');

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
    emitStreamError('openai-aisdk', modelId, error);
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
  const providerConfigNonStream = model ? getProviderConfigFromStore(model) : null;
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
    const stopSequences = isPromptMode ? PROMPT_MODE_STOP_SEQUENCES : undefined;

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
