/**
 * AI SDK OpenAI Provider
 * 使用 @ai-sdk/openai 实现的 OpenAI 供应商
 * 继承自 AbstractBaseProvider，一比一实现 OpenAIProvider 功能
 */
import { generateText } from 'ai';
import type { OpenAIProvider as AISDKOpenAIProvider } from '@ai-sdk/openai';
import { createClient, supportsMultimodal, supportsWebSearch, getWebSearchParams } from './client';
import { streamCompletion, nonStreamCompletion, type StreamResult } from './stream';
import { UnifiedParameterManager } from '../parameters/UnifiedParameterManager';
import { OpenAIParameterFormatter } from '../parameters/formatters';
import { isReasoningModel } from '../../../config/models';
import { AbstractBaseProvider } from '../baseProvider';
import type { Message, Model, MCPTool, MCPToolResponse, MCPCallToolResponse } from '../../types';
import { parseAndCallTools, parseToolUse, removeToolUseTags, stripToolUseResultTags } from '../../utils/mcpToolParser';
import {
  convertMcpToolsToOpenAI,
  mcpToolCallResponseToOpenAIMessage,
  convertToolCallsToMcpResponses
} from './tools';
import { ChunkType, type Chunk } from '../../types/chunk';

/**
 * AI SDK OpenAI Provider 基类
 */
export abstract class BaseOpenAIAISDKProvider extends AbstractBaseProvider {
  protected client: AISDKOpenAIProvider;
  protected parameterManager: UnifiedParameterManager;

  constructor(model: Model) {
    super(model);
    this.client = createClient(model);
    this.parameterManager = new UnifiedParameterManager({ model, providerType: 'openai' });
  }

  /**
   * 将 MCP 工具转换为 OpenAI 工具格式
   */
  public convertMcpTools<T>(mcpTools: MCPTool[]): T[] {
    return convertMcpToolsToOpenAI<T>(mcpTools);
  }

  /**
   * 检查模型是否支持多模态
   */
  protected supportsMultimodal(model?: Model): boolean {
    return supportsMultimodal(model || this.model);
  }

  /**
   * 检查模型是否支持网页搜索
   */
  protected supportsWebSearch(): boolean {
    return supportsWebSearch(this.model);
  }

  /**
   * 检查模型是否支持推理优化
   */
  protected supportsReasoning(): boolean {
    return isReasoningModel(this.model);
  }

  /**
   * 获取统一参数并转换为 OpenAI API 格式
   */
  protected getApiParams(assistant?: any): {
    unified: ReturnType<UnifiedParameterManager['getUnifiedParameters']>;
    apiParams: Record<string, any>;
  } {
    if (assistant) {
      this.parameterManager.updateAssistant(assistant);
    }
    const unified = this.parameterManager.getUnifiedParameters(isReasoningModel(this.model));
    const { customParameters, ...standardParams } = unified;
    const apiParams = OpenAIParameterFormatter.toAPIFormat(standardParams, this.model);
    
    // 🆕 合并自定义参数到 API 请求
    const finalParams = {
      ...apiParams,
      ...customParameters, // 自定义参数直接展开到请求中
    };
    
    return { unified, apiParams: finalParams };
  }

  /**
   * 准备 API 消息格式
   */
  protected async prepareAPIMessages(
    messages: Message[],
    systemPrompt?: string,
    mcpTools?: MCPTool[]
  ): Promise<any[]> {
    const apiMessages = [];

    // 获取工作区列表
    const workspaces = mcpTools && mcpTools.length > 0 ? await this.getWorkspaces() : [];

    // 添加系统提示
    const finalSystemPrompt = this.buildSystemPromptWithTools(systemPrompt || '', mcpTools, workspaces);
    if (finalSystemPrompt.trim()) {
      apiMessages.push({
        role: 'system',
        content: finalSystemPrompt
      });
    }

    // 处理用户和助手消息（跳过 system 消息，因为已通过 buildSystemPromptWithTools 合并）
    for (const message of messages) {
      // 跳过 system 消息，避免重复
      if (message.role === 'system') {
        continue;
      }
      try {
        const content = (message as any).content;
        if (content !== undefined) {
          apiMessages.push({
            role: message.role,
            content: content
          });
        }
      } catch (error) {
        console.error(`[AI SDK Provider] 处理消息失败:`, error);
        const content = (message as any).content;
        if (content && typeof content === 'string' && content.trim()) {
          apiMessages.push({
            role: message.role,
            content: content
          });
        }
      }
    }

    // 确保至少有一条消息
    if (apiMessages.length === 0 || !apiMessages.some(msg => msg.role === 'user')) {
      apiMessages.push({
        role: 'user',
        content: '你好'
      });
    }

    return apiMessages;
  }

  /**
   * 测试 API 连接
   */
  public async testConnection(): Promise<boolean> {
    try {
      // 使用 .chat() 调用 Chat Completions API（兼容 OpenAI 兼容 API）
      const result = await generateText({
        model: this.client.chat(this.model.id) as any,
        prompt: 'Hello',
        maxOutputTokens: 5,
      });
      return Boolean(result.text);
    } catch (error) {
      console.error('[AI SDK Provider] API 连接测试失败:', error);
      return false;
    }
  }

  /**
   * 将 MCP 工具调用响应转换为消息格式
   * @param useXmlFormat 是否使用 XML 格式（提示词模式用 true，函数调用模式用 false）
   */
  public mcpToolCallResponseToMessage(
    mcpToolResponse: MCPToolResponse,
    resp: MCPCallToolResponse,
    model: Model,
    useXmlFormat: boolean = false
  ): any {
    return mcpToolCallResponseToOpenAIMessage(mcpToolResponse, resp, model, useXmlFormat);
  }

  /**
   * 将工具调用转换为 MCP 工具响应
   */
  protected convertToolCallsToMcpResponses(
    toolCalls: any[],
    mcpTools: MCPTool[]
  ): MCPToolResponse[] {
    return convertToolCallsToMcpResponses(toolCalls, mcpTools);
  }

  /**
   * 检测工具列表是否包含 attempt_completion
   */
  private hasCompletionTool(toolNames: string[]): boolean {
    return toolNames.some(name =>
      name === 'attempt_completion' || name.endsWith('-attempt_completion')
    );
  }

  /**
   * 处理工具调用（Function Calling 模式）
   */
  protected async processToolCalls(
    toolCalls: any[],
    mcpTools: MCPTool[],
    onChunk?: (chunk: Chunk) => void
  ): Promise<{ messages: any[]; hasCompletion: boolean }> {
    if (!toolCalls?.length) return { messages: [], hasCompletion: false };

    const toolNames = toolCalls.map(tc => tc.function?.name || tc.name || '');
    const hasCompletion = this.hasCompletionTool(toolNames);

    console.log(`[AI SDK Provider] 处理 ${toolCalls.length} 个工具调用${hasCompletion ? '（含 attempt_completion）' : ''}`);

    const mcpToolResponses = this.convertToolCallsToMcpResponses(toolCalls, mcpTools);
    const results = await parseAndCallTools(mcpToolResponses, mcpTools, onChunk);
    // 函数调用模式：使用 AI SDK 的 ToolModelMessage 格式（useXmlFormat: false）
    const messages = results
      .map((result, i) => this.mcpToolCallResponseToMessage(mcpToolResponses[i], result, this.model, false))
      .filter(Boolean);

    return { messages, hasCompletion };
  }

  /**
   * 处理工具使用（XML 提示词模式）
   */
  protected async processToolUses(
    content: string,
    mcpTools: MCPTool[],
    onChunk?: (chunk: Chunk) => void
  ): Promise<{ messages: any[]; hasCompletion: boolean }> {
    if (!content || !mcpTools?.length) return { messages: [], hasCompletion: false };

    const toolResponses = parseToolUse(content, mcpTools);
    if (!toolResponses.length) return { messages: [], hasCompletion: false };

    const toolNames = toolResponses.map(tr => tr.tool?.name || tr.tool?.id || '');
    const hasCompletion = this.hasCompletionTool(toolNames);

    console.log(`[AI SDK Provider] 处理 ${toolResponses.length} 个 XML 工具调用${hasCompletion ? '（含 attempt_completion）' : ''}`);

    const results = await parseAndCallTools(content, mcpTools, onChunk);
    const messages: any[] = [];

    // XML 提示词模式：使用 user 角色的 XML 格式消息（useXmlFormat: true）
    for (let i = 0; i < Math.min(results.length, toolResponses.length); i++) {
      const msg = this.mcpToolCallResponseToMessage(toolResponses[i], results[i], this.model, true);
      if (msg) messages.push(msg);
    }

    return { messages, hasCompletion };
  }

  /**
   * 抽象方法：发送聊天消息
   */
  public abstract sendChatMessage(
    messages: Message[],
    options?: {
      onChunk?: (chunk: Chunk) => void;
      enableWebSearch?: boolean;
      systemPrompt?: string;
      enableTools?: boolean;
      mcpTools?: MCPTool[];
      mcpMode?: 'prompt' | 'function';
      abortSignal?: AbortSignal;
      assistant?: any;
    }
  ): Promise<string | { content: string; reasoning?: string; reasoningTime?: number }>;
}

/**
 * AI SDK OpenAI Provider 实现类
 */
export class OpenAIAISDKProvider extends BaseOpenAIAISDKProvider {
  constructor(model: Model) {
    super(model);
    console.log(`[OpenAIAISDKProvider] 初始化完成，模型: ${model.id}`);
  }

  /**
   * 发送聊天消息 - 核心 API 调用
   */
  public async sendChatMessage(
    messages: Message[],
    options?: {
      onChunk?: (chunk: Chunk) => void;
      enableWebSearch?: boolean;
      systemPrompt?: string;
      enableTools?: boolean;
      mcpTools?: MCPTool[];
      mcpMode?: 'prompt' | 'function';
      abortSignal?: AbortSignal;
      assistant?: any;
    }
  ): Promise<string | { content: string; reasoning?: string; reasoningTime?: number }> {
    console.log(`[OpenAIAISDKProvider] 开始 API 调用, 模型: ${this.model.id}`);

    const {
      onChunk,
      enableWebSearch = false,
      systemPrompt = '',
      enableTools = true,
      mcpTools = [],
      mcpMode = 'function',
      abortSignal,
      assistant
    } = options || {};

    // 先配置工具（设置 useSystemPromptForTools 的值）
    // 必须在 prepareAPIMessages 之前调用，否则 buildSystemPromptWithTools 会使用错误的默认值
    const { tools } = this.setupToolsConfig({
      mcpTools,
      model: this.model,
      enableToolUse: enableTools,
      mcpMode
    });

    // 准备 API 消息格式（会根据 useSystemPromptForTools 决定是否注入工具提示词）
    const apiMessages = await this.prepareAPIMessages(messages, systemPrompt, mcpTools);

    // 获取统一参数与 API 格式参数
    const { unified, apiParams } = this.getApiParams(assistant);
    const streamEnabled = unified.stream ?? true;

    console.log(`[OpenAIAISDKProvider] API 请求参数:`, {
      model: this.model.id,
      apiParams,
      stream: streamEnabled,
      工具数量: tools.length
    });

    // 检查 API 密钥
    if (!this.model.apiKey) {
      console.error('[OpenAIAISDKProvider] 错误: API 密钥未设置');
      throw new Error('API 密钥未设置，请在设置中配置 OpenAI API 密钥');
    }

    // 添加网页搜索参数：把各供应商私有 body 字段（dashscope enable_search /
    // openrouter plugins / openai web_search_options 等，见 client.getWebSearchParams）
    // 与 apiParams 合并为统一 extraBody，由 stream.ts 落到 providerOptions.openai
    // 透传进请求体（web search 字段优先，与官方 openai 路径 Object.assign 语义一致）。
    const webSearchParams = enableWebSearch && this.supportsWebSearch()
      ? getWebSearchParams(this.model, enableWebSearch)
      : {};
    const extraBody = Object.keys(webSearchParams).length > 0
      ? { ...apiParams, ...webSearchParams }
      : apiParams;

    try {
      if (streamEnabled) {
        return await this.handleStreamResponse(apiMessages, {
          temperature: apiParams.temperature,
          maxTokens: apiParams.max_tokens,
          tools,
          mcpTools,
          mcpMode,
          onChunk,
          abortSignal,
          extraBody
        });
      } else {
        return await this.handleNonStreamResponse(apiMessages, {
          temperature: apiParams.temperature,
          maxTokens: apiParams.max_tokens,
          tools,
          mcpTools,
          mcpMode,
          onChunk,
          abortSignal,
          extraBody
        });
      }
    } catch (error: any) {
      if (error?.name === 'AbortError' || error?.message?.includes('aborted')) {
        console.log('[OpenAIAISDKProvider] 请求被用户中断');
        throw new DOMException('Operation aborted', 'AbortError');
      }

      if (error?.status === 400 && error?.message?.includes('max_tokens')) {
        const modelName = this.model.name || this.model.id;
        throw new Error(`模型 ${modelName} 不支持当前的最大输出 token 设置 (${apiParams.max_tokens})。`);
      }

      console.error('[OpenAIAISDKProvider] API 请求失败:', error);
      throw error;
    }
  }

  /**
   * 处理流式响应
   */
  private async handleStreamResponse(
    messages: any[],
    options: {
      temperature?: number;
      maxTokens?: number;
      tools: any[];
      mcpTools: MCPTool[];
      mcpMode: 'prompt' | 'function';
      onChunk?: (chunk: Chunk) => void;
      abortSignal?: AbortSignal;
      extraBody?: Record<string, any>;
    }
  ): Promise<string | { content: string; reasoning?: string; reasoningTime?: number }> {
    const {
      temperature,
      maxTokens,
      tools,
      mcpTools,
      mcpMode,
      onChunk,
      abortSignal,
      extraBody
    } = options;

    let currentMessages = [...messages];
    let iteration = 0;
    const maxIterations = 10;

    while (iteration < maxIterations) {
      iteration++;
      console.log(`[OpenAIAISDKProvider] 流式工具调用迭代 ${iteration}`);

      // 准备工具配置
      const usePromptMode = this.getUseSystemPromptForTools();
      const streamTools = usePromptMode ? [] : tools;

      const result: StreamResult = await streamCompletion(
        this.client,
        this.model.id,
        currentMessages,
        temperature,
        maxTokens,
        {
          signal: abortSignal,
          enableTools: !usePromptMode && tools.length > 0,
          mcpTools,
          mcpMode,
          model: this.model,
          tools: streamTools,
          extraBody
        },
        onChunk
      );

      // 检查是否有工具调用
      if (result.hasToolCalls) {
        console.log(`[OpenAIAISDKProvider] 检测到工具调用`);

        const content = result.content;
        const nativeToolCalls = result.nativeToolCalls;

        if (usePromptMode) {
          // 提示词模式：XML 格式工具调用
          const { messages: xmlToolResults, hasCompletion } = await this.processToolUses(
            content,
            mcpTools,
            onChunk
          );

          if (xmlToolResults.length > 0) {
            // 🛡️ 清理模型幻觉的 <tool_use_result> 内容，防止污染对话历史
            const sanitizedContent = stripToolUseResultTags(content);
            currentMessages.push({ role: 'assistant', content: sanitizedContent });
            currentMessages.push(...xmlToolResults);

            if (hasCompletion) {
              console.log(`[OpenAIAISDKProvider] attempt_completion 已执行`);
              return this.formatResult(result);
            }
            continue;
          }
        } else if (nativeToolCalls && nativeToolCalls.length > 0) {
          // 函数调用模式：使用 AI SDK 期望的 AssistantModelMessage 格式
          const toolCallParts = nativeToolCalls.map((tc: any) => {
            let input = tc.function?.arguments || tc.args || {};
            if (typeof input === 'string') {
              try {
                input = JSON.parse(input);
              } catch {
                input = {};
              }
            }
            return {
              type: 'tool-call' as const,
              toolCallId: tc.id || tc.toolCallId,
              toolName: tc.function?.name || tc.name || tc.toolName,
              input
            };
          });
          
          const assistantContent = content 
            ? [{ type: 'text' as const, text: content }, ...toolCallParts]
            : toolCallParts;
          
          currentMessages.push({
            role: 'assistant',
            content: assistantContent
          });

          const { messages: toolResults, hasCompletion } = await this.processToolCalls(
            nativeToolCalls,
            mcpTools,
            onChunk
          );

          if (toolResults.length > 0) {
            currentMessages.push(...toolResults);

            if (hasCompletion) {
              console.log(`[OpenAIAISDKProvider] attempt_completion 已执行`);
              return this.formatResult(result);
            }
            continue;
          }
        }
      }

      // 没有工具调用，返回结果
      return this.formatResult(result);
    }

    console.warn(`[OpenAIAISDKProvider] 达到最大迭代次数 ${maxIterations}`);
    return '';
  }

  /**
   * 处理非流式响应
   */
  private async handleNonStreamResponse(
    messages: any[],
    options: {
      temperature?: number;
      maxTokens?: number;
      tools: any[];
      mcpTools: MCPTool[];
      mcpMode: 'prompt' | 'function';
      onChunk?: (chunk: Chunk) => void;
      abortSignal?: AbortSignal;
      extraBody?: Record<string, any>;
    }
  ): Promise<string | { content: string; reasoning?: string; reasoningTime?: number }> {
    const {
      temperature,
      maxTokens,
      tools,
      mcpTools,
      mcpMode,
      onChunk,
      abortSignal,
      extraBody
    } = options;

    let currentMessages = [...messages];
    let iteration = 0;
    const maxIterations = 5;
    let allReasoningParts: string[] = [];

    while (iteration < maxIterations) {
      iteration++;

      const usePromptMode = this.getUseSystemPromptForTools();
      const streamTools = usePromptMode ? [] : tools;

      const result: StreamResult = await nonStreamCompletion(
        this.client,
        this.model.id,
        currentMessages,
        temperature,
        maxTokens,
        {
          signal: abortSignal,
          enableTools: !usePromptMode && tools.length > 0,
          mcpTools,
          mcpMode,
          model: this.model,
          tools: streamTools,
          extraBody
        }
      );

      // 发送推理块
      if (result.reasoning && onChunk) {
        onChunk({
          type: ChunkType.THINKING_COMPLETE,
          text: result.reasoning,
          thinking_millsec: result.reasoningTime || 0
        });
        allReasoningParts.push(result.reasoning);
      }

      const content = result.content;
      const nativeToolCalls = result.nativeToolCalls;
      let toolResults: any[] = [];
      let hasCompletion = false;

      // 处理函数调用
      if (nativeToolCalls && nativeToolCalls.length > 0 && mcpTools.length > 0) {
        if (onChunk) {
          onChunk({ type: ChunkType.TEXT_COMPLETE, text: content || '' });
        }

        // 函数调用模式：使用 AI SDK 期望的 AssistantModelMessage 格式
        const toolCallParts = nativeToolCalls.map((tc: any) => {
          let input = tc.function?.arguments || tc.args || {};
          if (typeof input === 'string') {
            try {
              input = JSON.parse(input);
            } catch {
              input = {};
            }
          }
          return {
            type: 'tool-call' as const,
            toolCallId: tc.id || tc.toolCallId,
            toolName: tc.function?.name || tc.name || tc.toolName,
            input
          };
        });
        
        const assistantContent = content 
          ? [{ type: 'text' as const, text: content }, ...toolCallParts]
          : toolCallParts;
        
        currentMessages.push({
          role: 'assistant',
          content: assistantContent
        });

        const callResult = await this.processToolCalls(nativeToolCalls, mcpTools, onChunk);
        toolResults = callResult.messages;
        hasCompletion = callResult.hasCompletion;
      }

      // 处理 XML 工具调用
      if (content && mcpTools.length > 0) {
        const textWithoutTools = removeToolUseTags(content);
        const hasToolTags = textWithoutTools.length < content.length;

        if (hasToolTags) {
          if (textWithoutTools.trim() && onChunk) {
            onChunk({ type: ChunkType.TEXT_COMPLETE, text: textWithoutTools });
          }

          // 🛡️ 清理模型幻觉的 <tool_use_result> 内容，防止污染对话历史
          const sanitizedXmlContent = stripToolUseResultTags(content);
          currentMessages.push({ role: 'assistant', content: sanitizedXmlContent });

          const xmlResult = await this.processToolUses(content, mcpTools, onChunk);
          toolResults = toolResults.concat(xmlResult.messages);
          hasCompletion = hasCompletion || xmlResult.hasCompletion;
        }
      }

      if (hasCompletion) {
        if (toolResults.length > 0) {
          currentMessages.push(...toolResults);
        }
        break;
      }

      if (toolResults.length > 0) {
        currentMessages.push(...toolResults);
        continue;
      }

      // 发送最终文本
      if (onChunk) {
        onChunk({ type: ChunkType.TEXT_COMPLETE, text: content || '' });
      }

      // 返回结果
      const finalReasoning = allReasoningParts.length > 0
        ? allReasoningParts.join('\n\n---\n\n')
        : undefined;

      if (finalReasoning) {
        return { content, reasoning: finalReasoning, reasoningTime: 0 };
      }
      return content;
    }

    return '';
  }

  /**
   * 格式化结果
   */
  private formatResult(result: StreamResult): string | { content: string; reasoning?: string; reasoningTime?: number } {
    if (result.reasoning) {
      return {
        content: result.content,
        reasoning: result.reasoning,
        reasoningTime: result.reasoningTime
      };
    }
    return result.content;
  }
}

// 导出
export { BaseOpenAIAISDKProvider as BaseOpenAIProvider };
