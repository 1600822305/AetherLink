/**
 * AI SDK Gemini 流式响应模块
 * 使用 @ai-sdk/google 的 streamText 实现流式响应
 * 支持推理内容、工具调用、Google Search、<think> 标签解析
 */
import { streamText, generateText } from 'ai';
import type { GoogleGenerativeAIProvider } from '@ai-sdk/google';
import { logApiRequest } from '../../services/infra/LoggerService';
import { EventEmitter, EVENT_NAMES } from '../../services/infra/EventEmitter';
import { hasToolUseTags } from '../../utils/mcpToolParser';
import { ChunkType, type Chunk } from '../../types/chunk';
// ThinkTagParser 不再需要，Gemini 启用 thinkingConfig 后思考内容通过 reasoning-delta 返回
import type { Model, MCPTool } from '../../types';
import type { ModelProvider } from '../../config/defaultModels';
import { convertMcpToolsToAISDK, parseGroundingMetadata } from './tools';
import store from '../../store';
import { createLogger } from '../../services/infra/logger';

const logger = createLogger('Gemini AI SDK Stream');
const nonStreamLogger = createLogger('Gemini AI SDK NonStream');


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

    const provider = providers.find((p: ModelProvider) => p.id === model.provider);
    return provider || null;
  } catch (error) {
    logger.error('获取供应商配置失败:', error);
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
  /** Gemini 特有：搜索结果来源 */
  sources?: any[];
  /** Gemini 特有：grounding metadata */
  groundingMetadata?: any;
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
  /** 自定义请求体参数 */
  extraBody?: Record<string, any>;
  /** 是否启用 Google Search */
  enableGoogleSearch?: boolean;
  /** Gemini 思考预算配置 */
  thinkingBudget?: number;
  /** 是否包含思考内容 */
  includeThoughts?: boolean;
}

// ThinkTagParser 已移除 - Gemini 启用 thinkingConfig 后思考内容通过 reasoning-delta 返回

/**
 * AI SDK Gemini 统一流式响应函数
 */
export async function streamCompletion(
  client: GoogleGenerativeAIProvider,
  modelId: string,
  messages: any[],
  temperature?: number,
  maxTokens?: number,
  additionalParams?: StreamParams,
  onChunk?: (chunk: Chunk) => void
): Promise<StreamResult> {
  logger.debug(`开始流式响应, 模型: ${modelId}`);

  const startTime = Date.now();
  const signal = additionalParams?.signal;
  const model = additionalParams?.model;
  const mcpTools = additionalParams?.mcpTools || [];
  const mcpMode = additionalParams?.mcpMode || 'function';
  const enableTools = additionalParams?.enableTools !== false;
  const enableGoogleSearch = additionalParams?.enableGoogleSearch || false;

  // 获取供应商配置和 extraBody
  const providerConfig = model ? getProviderConfig(model) : null;
  const extraBody = additionalParams?.extraBody || 
                    providerConfig?.extraBody ||
                    (model as any)?.extraBody || 
                    (model as any)?.providerExtraBody;

  try {
    // 准备消息
    const processedMessages = messages.map(msg => ({
      role: msg.role as 'system' | 'user' | 'assistant',
      content: msg.content
    }));

    // 记录 API 请求
    logApiRequest('AI SDK Gemini Stream', 'INFO', {
      provider: 'gemini-aisdk',
      model: modelId,
      messageCount: processedMessages.length,
      temperature,
      maxTokens,
      enableGoogleSearch,
      extraBody: extraBody ? Object.keys(extraBody) : undefined,
      timestamp: Date.now()
    });

    // 准备工具配置
    // 优先使用传入的已转换好的 tools，避免双重转换
    let tools: Record<string, any> | undefined;
    if (enableTools && mcpMode === 'function') {
      const passedTools = additionalParams?.tools;
      if (passedTools && Array.isArray(passedTools) && passedTools.length > 0) {
        // 使用传入的工具（已由 provider 转换）
        tools = {};
        passedTools.forEach((tool: any) => {
          if (tool.function?.name) {
            tools![tool.function.name] = {
              description: tool.function.description,
              parameters: tool.function.parameters
            };
          }
        });
      } else if (mcpTools.length > 0) {
        // 回退：从 mcpTools 转换
        const convertedTools = convertMcpToolsToAISDK(mcpTools);
        tools = {};
        convertedTools.forEach((tool: any) => {
          if (tool.function?.name) {
            tools![tool.function.name] = {
              description: tool.function.description,
              parameters: tool.function.parameters
            };
          }
        });
      }
      if (tools && Object.keys(tools).length > 0) {
        logger.debug(`启用 ${Object.keys(tools).length} 个工具`);
      }
    }

    // 准备 providerOptions（Gemini 特有配置）
    let providerOptions: Record<string, any> | undefined;
    const googleOptions: Record<string, any> = {};

    // 添加 extraBody
    if (extraBody && typeof extraBody === 'object' && Object.keys(extraBody).length > 0) {
      Object.assign(googleOptions, extraBody);
      logger.debug(`合并自定义请求体参数: ${Object.keys(extraBody).join(', ')}`);
    }

    // 添加思考配置（如果模型支持）
    if (additionalParams?.thinkingBudget || additionalParams?.includeThoughts) {
      googleOptions.thinkingConfig = {
        thinkingBudget: additionalParams.thinkingBudget || 1024,
        includeThoughts: additionalParams.includeThoughts !== false
      };
      logger.debug(`启用思考配置: budget=${googleOptions.thinkingConfig.thinkingBudget}`);
    }

    if (Object.keys(googleOptions).length > 0) {
      providerOptions = { google: googleOptions };
    }

    // 如果启用 Google Search，使用特殊的工具配置
    // 注意：Google Search 需要通过 providerOptions 或特殊工具启用
    if (enableGoogleSearch) {
      logger.debug(`启用 Google Search Grounding`);
      // Google Search 通过 providerOptions 启用
      if (!providerOptions) providerOptions = { google: {} };
      providerOptions.google = providerOptions.google || {};
      // 设置 grounding 配置
      providerOptions.google.useSearchGrounding = true;
    }

    // 🛡️ Prompt 模式防幻觉：添加 stopSequences
    const isPromptMode = !enableTools && mcpTools.length > 0;
    const stopSequences = isPromptMode ? ['<tool_use_result'] : undefined;

    logger.debug(`创建流式请求`);

    const result = await streamText({
      model: client(modelId),
      messages: processedMessages,
      temperature: temperature ?? 0.7,
      maxOutputTokens: maxTokens ?? 2000,
      abortSignal: signal,
      ...(tools && Object.keys(tools).length > 0 && { tools }),
      ...(providerOptions && { providerOptions }),
      ...(stopSequences && { stopSequences }),
    });

    // Gemini 启用 thinkingConfig 后，思考内容通过 reasoning-delta 返回，不需要 ThinkTagParser
    let fullContent = '';
    let fullReasoning = '';
    const toolCalls: any[] = [];
    let groundingMetadata: any = null;
    let sources: any[] = [];
    
    // 精确计算思考时间：当收到第一个 text-delta 时停止计时
    let reasoningEndTime: number | null = null;
    let isReasoningPhase = true;

    // 处理流式响应
    for await (const part of result.fullStream) {
      switch (part.type) {
        case 'text-delta':
          // AI SDK: text-delta 的内容在 text 字段
          const textContent = (part as any).text || '';
          // Gemini 启用 thinkingConfig 后，text-delta 只包含普通文本（不含思考标签）
          if (textContent) {
            // 收到第一个 text-delta 时，标记思考阶段结束
            if (isReasoningPhase && fullReasoning) {
              reasoningEndTime = Date.now();
              isReasoningPhase = false;
              // 发送思考完成事件（带精确时间）
              onChunk?.({
                type: ChunkType.THINKING_COMPLETE,
                text: fullReasoning,
                thinking_millsec: reasoningEndTime - startTime
              });
            }
            fullContent += textContent;
            // ⭐ 累积模式：发送完整累积内容（参考 Cherry Studio）
            onChunk?.({ type: ChunkType.TEXT_DELTA, text: fullContent });  // 发送累积内容
          }
          break;

        case 'tool-call':
          logger.debug(`检测到工具调用: ${part.toolName}`);
          const toolInput = (part as any).input || (part as any).args || {};
          toolCalls.push({
            id: part.toolCallId,
            type: 'function',
            function: {
              name: part.toolName,
              arguments: JSON.stringify(toolInput)
            }
          });
          
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
          // AI SDK: reasoning-delta 的内容在 text 字段
          const reasoningText = (part as any).text || '';
          if (reasoningText) {
            fullReasoning += reasoningText;
            // ⭐ 累积模式：发送完整累积内容
            onChunk?.({
              type: ChunkType.THINKING_DELTA,
              text: fullReasoning,  // 发送累积内容
              thinking_millsec: Date.now() - startTime
            });
          }
          break;

        case 'finish':
          // 尝试获取 grounding metadata
          const finishPart = part as any;
          if (finishPart.providerMetadata?.google) {
            const parsed = parseGroundingMetadata(finishPart.providerMetadata.google);
            groundingMetadata = finishPart.providerMetadata.google.groundingMetadata;
            sources = parsed.sources || [];
          }
          break;
      }
    }

    // 检测是否有工具调用（需要继续迭代）
    const hasToolCalls = toolCalls.length > 0 || hasToolUseTags(fullContent);
    
    // 计算最终的思考时间
    const finalReasoningTime = fullReasoning 
      ? (reasoningEndTime ? reasoningEndTime - startTime : Date.now() - startTime)
      : undefined;
    
    // 发送完成事件（如果有工具调用则跳过，由 provider 控制最终发送）
    // 这样可以避免多轮工具调用时重复创建块
    if (!hasToolCalls) {
      if (fullContent) {
        onChunk?.({ type: ChunkType.TEXT_COMPLETE, text: fullContent });
      }
      
      // 如果思考阶段还没结束（没有收到 text-delta），在这里发送完成事件
      if (fullReasoning && isReasoningPhase) {
        onChunk?.({
          type: ChunkType.THINKING_COMPLETE,
          text: fullReasoning,
          thinking_millsec: finalReasoningTime || 0
        });
      }
    }

    // 发送全局事件
    EventEmitter.emit(EVENT_NAMES.STREAM_COMPLETE, {
      provider: 'gemini-aisdk',
      model: modelId,
      content: fullContent,
      reasoning: fullReasoning,
      timestamp: Date.now()
    });

    // 检查工具使用标签（XML 模式）
    if (hasToolUseTags(fullContent)) {
      logger.debug(`检测到 XML 工具使用标签`);
      EventEmitter.emit(EVENT_NAMES.TOOL_USE_DETECTED, {
        content: fullContent,
        model: modelId
      });
    }

    const endTime = Date.now();
    logger.debug(`完成，耗时: ${endTime - startTime}ms`);

    return {
      content: fullContent,
      reasoning: fullReasoning || undefined,
      reasoningTime: finalReasoningTime,
      hasToolCalls,
      nativeToolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      sources: sources.length > 0 ? sources : undefined,
      groundingMetadata
    };

  } catch (error: any) {
    logger.error('流式响应失败:', error);

    EventEmitter.emit(EVENT_NAMES.STREAM_ERROR, {
      provider: 'gemini-aisdk',
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
  client: GoogleGenerativeAIProvider,
  modelId: string,
  messages: any[],
  temperature?: number,
  maxTokens?: number,
  additionalParams?: StreamParams
): Promise<StreamResult> {
  nonStreamLogger.debug(`开始非流式响应, 模型: ${modelId}`);

  const startTime = Date.now();
  const signal = additionalParams?.signal;
  const model = additionalParams?.model;
  const mcpTools = additionalParams?.mcpTools || [];
  const mcpMode = additionalParams?.mcpMode || 'function';
  const enableTools = additionalParams?.enableTools !== false;
  const enableGoogleSearch = additionalParams?.enableGoogleSearch || false;

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
    // 优先使用传入的已转换好的 tools，避免双重转换
    let tools: Record<string, any> | undefined;
    if (enableTools && mcpMode === 'function') {
      const passedTools = additionalParams?.tools;
      if (passedTools && Array.isArray(passedTools) && passedTools.length > 0) {
        // 使用传入的工具（已由 provider 转换）
        tools = {};
        passedTools.forEach((tool: any) => {
          if (tool.function?.name) {
            tools![tool.function.name] = {
              description: tool.function.description,
              parameters: tool.function.parameters
            };
          }
        });
      } else if (mcpTools.length > 0) {
        // 回退：从 mcpTools 转换
        const convertedTools = convertMcpToolsToAISDK(mcpTools);
        tools = {};
        convertedTools.forEach((tool: any) => {
          if (tool.function?.name) {
            tools![tool.function.name] = {
              description: tool.function.description,
              parameters: tool.function.parameters
            };
          }
        });
      }
    }

    // 准备 providerOptions
    let providerOptions: Record<string, any> | undefined;
    const googleOptions: Record<string, any> = {};

    if (extraBody && typeof extraBody === 'object' && Object.keys(extraBody).length > 0) {
      Object.assign(googleOptions, extraBody);
      nonStreamLogger.debug(`合并自定义请求体参数: ${Object.keys(extraBody).join(', ')}`);
    }

    if (additionalParams?.thinkingBudget || additionalParams?.includeThoughts) {
      googleOptions.thinkingConfig = {
        thinkingBudget: additionalParams.thinkingBudget || 1024,
        includeThoughts: additionalParams.includeThoughts !== false
      };
    }

    if (enableGoogleSearch) {
      googleOptions.useSearchGrounding = true;
    }

    if (Object.keys(googleOptions).length > 0) {
      providerOptions = { google: googleOptions };
    }

    // 🛡️ Prompt 模式防幻觉：添加 stopSequences
    const isPromptMode = !enableTools && mcpTools.length > 0;
    const stopSequences = isPromptMode ? ['<tool_use_result'] : undefined;

    const result = await generateText({
      model: client(modelId),
      messages: processedMessages,
      temperature: temperature ?? 0.7,
      maxOutputTokens: maxTokens ?? 2000,
      abortSignal: signal,
      ...(tools && Object.keys(tools).length > 0 && { tools }),
      ...(providerOptions && { providerOptions }),
      ...(stopSequences && { stopSequences }),
    });

    const endTime = Date.now();
    const totalTime = endTime - startTime;
    nonStreamLogger.debug(`完成，耗时: ${totalTime}ms`);

    // 提取推理内容和 grounding metadata
    // AI SDK v5: result.reasoningText 是字符串，result.reasoning 是数组
    const reasoning = (result as any).reasoningText || 
                      (Array.isArray((result as any).reasoning) 
                        ? (result as any).reasoning.map((r: any) => r.text || '').join('') 
                        : (result as any).reasoning);
    const providerMetadata = (result as any).providerMetadata;
    let groundingMetadata: any = null;
    let sources: any[] = [];

    if (providerMetadata?.google) {
      const parsed = parseGroundingMetadata(providerMetadata.google);
      groundingMetadata = providerMetadata.google.groundingMetadata;
      sources = parsed.sources || [];
    }

    // 估算思考时间：基于 token 比例计算
    // 如果有 usageMetadata，可以通过 thoughtsTokenCount 和 totalTokenCount 估算
    let reasoningTime: number | undefined;
    if (reasoning) {
      const usageMetadata = providerMetadata?.google?.usageMetadata;
      if (usageMetadata?.thoughtsTokenCount && usageMetadata?.totalTokenCount) {
        // 按 token 比例估算思考时间
        const thoughtsRatio = usageMetadata.thoughtsTokenCount / usageMetadata.totalTokenCount;
        reasoningTime = Math.round(totalTime * thoughtsRatio);
        nonStreamLogger.debug(`思考时间估算: ${reasoningTime}ms (tokens: ${usageMetadata.thoughtsTokenCount}/${usageMetadata.totalTokenCount})`);
      } else {
        // 回退：使用总时间
        reasoningTime = totalTime;
      }
    }

    return {
      content: result.text,
      reasoning,
      reasoningTime,
      hasToolCalls: (result.toolCalls?.length ?? 0) > 0,
      nativeToolCalls: result.toolCalls as any[],
      sources: sources.length > 0 ? sources : undefined,
      groundingMetadata
    };

  } catch (error: any) {
    nonStreamLogger.error('非流式响应失败:', error);
    throw error;
  }
}
