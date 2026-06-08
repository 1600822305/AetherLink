/**
 * AI SDK Anthropic 流式响应模块
 * 使用 @ai-sdk/anthropic 的 streamText 实现流式响应
 * 支持 Extended Thinking、工具调用
 */
import { streamText, generateText } from 'ai';
import type { AnthropicProvider as AISDKAnthropicProvider } from '@ai-sdk/anthropic';
import { logApiRequest } from '../../services/infra/LoggerService';
import { hasToolUseTags } from '../../utils/mcpToolParser';
import { ChunkType, type Chunk } from '../../types/chunk';
import type { Model } from '../../types';
import { convertMcpToolsToAISDK } from './tools';
import { supportsExtendedThinking, isClaudeReasoningModel } from './client';
import { getAppropriateTag, DEFAULT_REASONING_TAGS } from '../../config/reasoningTags';
import {
  ThinkTagParser,
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
  /** 是否启用 Extended Thinking */
  enableThinking?: boolean;
  /** 思考预算 Token 数 */
  thinkingBudgetTokens?: number;
  /** 是否启用交错思考 */
  enableInterleavedThinking?: boolean;
}

/**
 * AI SDK Anthropic 统一流式响应函数
 */
export async function streamCompletion(
  client: AISDKAnthropicProvider,
  modelId: string,
  messages: any[],
  temperature?: number,
  maxTokens?: number,
  additionalParams?: StreamParams,
  onChunk?: (chunk: Chunk) => void
): Promise<StreamResult> {
  console.log(`[Anthropic SDK Stream] 开始流式响应, 模型: ${modelId}`);

  const startTime = Date.now();
  const signal = additionalParams?.signal;
  const model = additionalParams?.model;
  const mcpTools = additionalParams?.mcpTools || [];
  const mcpMode = additionalParams?.mcpMode || 'function';
  const enableTools = additionalParams?.enableTools !== false;

  // Extended Thinking 配置
  const enableThinking = additionalParams?.enableThinking ?? 
                         (model ? isClaudeReasoningModel(model) : false);
  const thinkingBudgetTokens = additionalParams?.thinkingBudgetTokens || 10000;
  const enableInterleavedThinking = additionalParams?.enableInterleavedThinking || false;

  // 获取 extraBody
  const extraBody = additionalParams?.extraBody || 
                    (model as any)?.extraBody || 
                    (model as any)?.providerExtraBody;

  try {
    // 准备消息
    const processedMessages = messages.map(msg => ({
      role: msg.role as 'system' | 'user' | 'assistant',
      content: msg.content
    }));

    // 记录 API 请求
    logApiRequest('AI SDK Anthropic Stream', 'INFO', {
      provider: 'anthropic-aisdk',
      model: modelId,
      messageCount: processedMessages.length,
      temperature,
      maxTokens,
      enableThinking,
      thinkingBudgetTokens,
      timestamp: Date.now()
    });

    // 准备工具配置
    let tools: any = undefined;
    if (enableTools && mcpTools.length > 0 && mcpMode === 'function') {
      tools = convertMcpToolsToAISDK(mcpTools);
      console.log(`[Anthropic SDK Stream] 启用 ${Object.keys(tools).length} 个工具`);
    }

    // 🛡️ Prompt 模式防幻觉：添加 stopSequences
    const isPromptMode = !enableTools && mcpTools.length > 0;
    const stopSequences = isPromptMode ? PROMPT_MODE_STOP_SEQUENCES : undefined;

    // 准备 providerOptions
    let providerOptions: Record<string, any> = {};
    
    // 获取推理标签配置（根据模型动态选择）
    const reasoningTag = model ? getAppropriateTag(model) : DEFAULT_REASONING_TAGS[0];

    // Extended Thinking 配置
    if (enableThinking && model && supportsExtendedThinking(model)) {
      providerOptions.anthropic = {
        thinking: {
          type: 'enabled',
          budgetTokens: thinkingBudgetTokens
        },
        ...(extraBody || {})
      };
      console.log(`[Anthropic SDK Stream] 启用 Extended Thinking, 预算: ${thinkingBudgetTokens} tokens`);
    } else if (extraBody && typeof extraBody === 'object' && Object.keys(extraBody).length > 0) {
      providerOptions.anthropic = extraBody;
    }

    // 创建 ThinkTag 解析器（用于兼容非原生推理模式）
    const thinkParser = new ThinkTagParser(reasoningTag);

    // 准备请求头（交错思考）
    let headers: Record<string, string> | undefined;
    if (enableInterleavedThinking) {
      headers = {
        'anthropic-beta': 'interleaved-thinking-2025-05-14'
      };
      console.log(`[Anthropic SDK Stream] 启用交错思考模式`);
    }

    const result = await streamText({
      model: client(modelId),
      messages: processedMessages,
      ...(temperature !== undefined && { temperature }),
      ...(maxTokens !== undefined && { maxTokens }),
      abortSignal: signal,
      ...(tools && { tools }),
      ...(Object.keys(providerOptions).length > 0 && { providerOptions }),
      ...(headers && { headers }),
      ...(stopSequences && { stopSequences }),
    });

    let fullContent = '';
    let fullReasoning = '';
    const toolCalls: any[] = [];
    let reasoningStartTime = 0;

    // 处理流式响应
    for await (const part of result.fullStream) {
      switch (part.type) {
        case 'text-delta':
          // 解析 <thinking> 标签（兼容非原生推理模式）
          const rawTextContent = (part as any).text || (part as any).textDelta || '';
          const { normalText, thinkText } = thinkParser.processChunk(rawTextContent);
          
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

        case 'reasoning-delta':
          // Claude Extended Thinking 原生推理内容
          const reasoningText = (part as any).text || (part as any).textDelta || (part as any).reasoning || '';
          if (reasoningText) {
            if (!reasoningStartTime) {
              reasoningStartTime = Date.now();
            }
            fullReasoning += reasoningText;
            onChunk?.({
              type: ChunkType.THINKING_DELTA,
              text: fullReasoning,  // ⭐ 发送累积内容
              thinking_millsec: Date.now() - reasoningStartTime
            });
          }
          break;

        case 'reasoning-start':
          // 推理开始
          if (!reasoningStartTime) {
            reasoningStartTime = Date.now();
          }
          break;

        case 'reasoning-end':
          // 推理结束
          console.log(`[Anthropic SDK Stream] 推理完成`);
          break;

        case 'tool-call':
          console.log(`[Anthropic SDK Stream] 检测到工具调用: ${part.toolName}`);
          accumulateToolCall(part, toolCalls, onChunk, { includeToolUseId: true });
          break;

        case 'finish':
          console.log(`[Anthropic SDK Stream] 流式响应完成`);
          break;
      }
    }

    // 处理剩余内容（ThinkTagParser flush）
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

    // 检测是否有工具调用
    const hasToolCalls = toolCalls.length > 0 || hasToolUseTags(fullContent);
    
    // 发送完成事件
    if (!hasToolCalls) {
      if (fullContent) {
        onChunk?.({ type: ChunkType.TEXT_COMPLETE, text: fullContent });
      }
      
      if (fullReasoning) {
        onChunk?.({
          type: ChunkType.THINKING_COMPLETE,
          text: fullReasoning,
          thinking_millsec: reasoningStartTime ? Date.now() - reasoningStartTime : 0
        });
      }
    }

    // 发送全局事件
    emitStreamComplete('anthropic-aisdk', modelId, fullContent, fullReasoning);

    // 检查工具使用标签（XML 模式）
    detectAndEmitToolUseTags(fullContent, modelId, 'Anthropic SDK Stream');

    const endTime = Date.now();
    console.log(`[Anthropic SDK Stream] 完成，耗时: ${endTime - startTime}ms`);

    return {
      content: fullContent,
      reasoning: fullReasoning || undefined,
      reasoningTime: fullReasoning && reasoningStartTime ? Date.now() - reasoningStartTime : undefined,
      hasToolCalls,
      nativeToolCalls: toolCalls.length > 0 ? toolCalls : undefined
    };

  } catch (error: any) {
    console.error('[Anthropic SDK Stream] 流式响应失败:', error);
    emitStreamError('anthropic-aisdk', modelId, error);
    throw error;
  }
}

/**
 * 非流式响应函数
 */
export async function nonStreamCompletion(
  client: AISDKAnthropicProvider,
  modelId: string,
  messages: any[],
  temperature?: number,
  maxTokens?: number,
  additionalParams?: StreamParams
): Promise<StreamResult> {
  console.log(`[Anthropic SDK NonStream] 开始非流式响应, 模型: ${modelId}`);

  const startTime = Date.now();
  const signal = additionalParams?.signal;
  const model = additionalParams?.model;
  const mcpTools = additionalParams?.mcpTools || [];
  const mcpMode = additionalParams?.mcpMode || 'function';
  const enableTools = additionalParams?.enableTools !== false;

  // Extended Thinking 配置
  const enableThinking = additionalParams?.enableThinking ?? 
                         (model ? isClaudeReasoningModel(model) : false);
  const thinkingBudgetTokens = additionalParams?.thinkingBudgetTokens || 10000;

  // 获取 extraBody
  const extraBody = additionalParams?.extraBody || 
                    (model as any)?.extraBody || 
                    (model as any)?.providerExtraBody;

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

    // 准备 providerOptions
    let providerOptions: Record<string, any> = {};
    
    if (enableThinking && model && supportsExtendedThinking(model)) {
      providerOptions.anthropic = {
        thinking: {
          type: 'enabled',
          budgetTokens: thinkingBudgetTokens
        },
        ...(extraBody || {})
      };
    } else if (extraBody && typeof extraBody === 'object' && Object.keys(extraBody).length > 0) {
      providerOptions.anthropic = extraBody;
    }

    const result = await generateText({
      model: client(modelId),
      messages: processedMessages,
      ...(temperature !== undefined && { temperature }),
      ...(maxTokens !== undefined && { maxTokens }),
      abortSignal: signal,
      ...(tools && { tools }),
      ...(Object.keys(providerOptions).length > 0 && { providerOptions }),
      ...(stopSequences && { stopSequences }),
    });

    const endTime = Date.now();
    console.log(`[Anthropic SDK NonStream] 完成，耗时: ${endTime - startTime}ms`);

    // 提取推理内容
    const reasoning = (result as any).reasoning || (result as any).reasoningText;
    const reasoningDetails = (result as any).reasoningDetails;

    return {
      content: result.text,
      reasoning: reasoning || (reasoningDetails ? JSON.stringify(reasoningDetails) : undefined),
      reasoningTime: reasoning ? endTime - startTime : undefined,
      hasToolCalls: (result.toolCalls?.length ?? 0) > 0,
      nativeToolCalls: result.toolCalls as any[]
    };

  } catch (error: any) {
    console.error('[Anthropic SDK NonStream] 非流式响应失败:', error);
    throw error;
  }
}
