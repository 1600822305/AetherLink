import OpenAI from 'openai';
import type { Model, MCPTool, MCPToolResponse, MCPCallToolResponse, Usage, Metrics } from '../types';
import { BaseOpenAIResponseProvider } from './BaseAIProvider';
import type { Chunk } from '../types/chunk';
import { ChunkType } from '../types/chunk';
import { parseAndCallTools } from '../utils/mcpToolParser';
import { getParameterManager } from '../api/openai/parameterManager';
import { Capacitor } from '@capacitor/core';

/**
 * OpenAI Responses API 移动端提供者
 * 专门处理 OpenAI Responses API 的移动端适配
 */
export class OpenAIResponseProvider extends BaseOpenAIResponseProvider {
  protected sdk: OpenAI;
  private parameterManager: any;

  constructor(model: Model) {
    super(model);

    // 获取 Responses API 专用的基础 URL
    const responsesAPIBaseURL = this.getResponsesAPIBaseURL(model.baseUrl);

    console.log(`[OpenAIResponseProvider] 使用 Responses API 基础 URL: ${responsesAPIBaseURL}`);
    console.log(`[OpenAIResponseProvider] 原始 baseUrl: ${model.baseUrl || '未设置'}`);

    // 初始化 OpenAI SDK - 使用 Responses API 专用配置
    this.sdk = new OpenAI({
      apiKey: model.apiKey,
      baseURL: responsesAPIBaseURL,
      dangerouslyAllowBrowser: true,
      defaultHeaders: this.getDefaultHeaders()
    });

    // 初始化参数管理器
    this.parameterManager = getParameterManager(model);
  }

  /**
   * 获取 Responses API 专用的基础 URL
   */
  private getResponsesAPIBaseURL(customBaseUrl?: string): string {
    if (customBaseUrl) {
      // 检查是否为 Azure OpenAI
      if (customBaseUrl.includes('.openai.azure.com')) {
        // Azure OpenAI 的 Responses API 格式
        if (customBaseUrl.includes('/openai/v1')) {
          // 如果已经包含 /openai/v1，直接使用
          return customBaseUrl;
        } else {
          // 添加 /openai/v1 路径
          const baseUrl = customBaseUrl.replace(/\/$/, '');
          return `${baseUrl}/openai/v1`;
        }
      }

      // 标准 OpenAI API 处理
      if (customBaseUrl.includes('/v1/chat/completions')) {
        // 如果是 Chat Completions API 的完整 URL，转换为 Responses API
        return customBaseUrl.replace('/v1/chat/completions', '/v1');
      } else if (customBaseUrl.endsWith('/v1/chat')) {
        // 如果是 /v1/chat 结尾，转换为 /v1
        return customBaseUrl.replace('/v1/chat', '/v1');
      } else if (customBaseUrl.endsWith('/v1')) {
        // 如果已经是 /v1 结尾，直接使用
        return customBaseUrl;
      } else {
        // 如果是基础域名，添加 /v1
        return customBaseUrl.replace(/\/$/, '') + '/v1';
      }
    }

    // 默认使用 OpenAI 官方 API
    return 'https://api.openai.com/v1';
  }

  /**
   * 获取默认请求头 - 移动端优化
   */
  private getDefaultHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'User-Agent': 'AetherLink-Mobile/1.0'
    };

    // 移动端特定头部
    if (Capacitor.isNativePlatform()) {
      headers['X-Platform'] = Capacitor.getPlatform();
      headers['X-Mobile-Client'] = 'true';
    }

    return headers;
  }

  /**
   * 转换 MCP 工具为 OpenAI Responses API 格式
   */
  public convertMcpTools<T>(mcpTools: MCPTool[]): T[] {
    return mcpTools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema
      }
    })) as T[];
  }

  /**
   * 将 MCP 工具调用响应转换为消息格式
   */
  public mcpToolCallResponseToMessage(
    mcpToolResponse: MCPToolResponse,
    resp: MCPCallToolResponse,
    _model: Model
  ): any {
    if ('toolCallId' in mcpToolResponse && mcpToolResponse.toolCallId) {
      return {
        role: 'tool',
        tool_call_id: mcpToolResponse.toolCallId,
        content: JSON.stringify(resp.content)
      };
    }

    return {
      role: 'user',
      content: `工具 ${mcpToolResponse.tool.name} 的执行结果: ${JSON.stringify(resp.content)}`
    };
  }

  /**
   * 转换工具调用为 MCP 响应
   */
  protected convertToolCallsToMcpResponses(
    toolCalls: any[],
    mcpTools: MCPTool[]
  ): MCPToolResponse[] {
    const results: MCPToolResponse[] = [];

    for (let index = 0; index < toolCalls.length; index++) {
      const toolCall = toolCalls[index];
      const mcpTool = mcpTools.find(tool =>
        tool.id === toolCall.function?.name || tool.name === toolCall.function?.name
      );

      if (!mcpTool) {
        console.warn(`[OpenAIResponseProvider] 未找到工具: ${toolCall.function?.name}`);
        continue;
      }

      let parsedArgs;
      try {
        parsedArgs = JSON.parse(toolCall.function.arguments);
      } catch {
        parsedArgs = toolCall.function.arguments;
      }

      results.push({
        id: toolCall.id || `tool-${index}`,
        toolCallId: toolCall.id,
        tool: mcpTool,
        arguments: parsedArgs,
        status: 'pending' as const
      });
    }

    return results;
  }

  /**
   * 获取响应消息参数 - Responses API 格式
   */
  protected async getResponseMessageParam(message: any, _model: Model): Promise<any> {
    const content = await this.getMessageContent(message);
    
    // 简化的移动端实现，主要处理文本内容
    if (message.role === 'assistant') {
      return {
        role: 'assistant',
        content: content
      };
    } else {
      return {
        role: message.role === 'system' ? 'user' : message.role,
        content: content ? [{ type: 'input_text', text: content }] : []
      };
    }
  }

  /**
   * 获取消息内容
   */
  private async getMessageContent(message: any): Promise<string> {
    // 移动端简化实现，主要处理文本内容
    if (typeof message.content === 'string') {
      return message.content;
    }

    if (Array.isArray(message.content)) {
      return message.content
        .filter((item: any) => item.type === 'text')
        .map((item: any) => item.text)
        .join('\n');
    }

    return '';
  }

  /**
   * 获取 Responses API 格式的推理参数 - 重写基类方法
   */
  protected getResponseReasoningEffort(assistant: any, model?: Model): any {
    // 如果传入了不同的模型，更新参数管理器
    if (model && model !== this.model) {
      this.parameterManager = getParameterManager(model);
    }

    // 更新助手配置
    this.parameterManager.updateAssistant(assistant);

    // 获取 Responses API 格式的推理参数
    return this.parameterManager.getResponsesAPIReasoningParameters();
  }

  /**
   * 获取工具选择策略
   */
  private getToolChoice(assistant: any, hasTools: boolean): string | undefined {
    // 如果没有工具，返回 undefined
    if (!hasTools) {
      return undefined;
    }

    // 检查助手设置中的工具选择策略
    const toolChoice = assistant?.settings?.toolChoice || assistant?.toolChoice;

    if (toolChoice) {
      return toolChoice; // 'auto', 'none', 'required' 等
    }

    // 默认策略：有工具时使用 auto
    return 'auto';
  }

  /**
   * 获取并行工具调用设置
   */
  private getParallelToolCalls(assistant: any, hasTools: boolean): boolean | undefined {
    // 如果没有工具，返回 undefined
    if (!hasTools) {
      return undefined;
    }

    // 检查助手设置中的并行工具调用配置
    const parallelToolCalls = assistant?.settings?.parallelToolCalls ?? assistant?.parallelToolCalls;

    if (typeof parallelToolCalls === 'boolean') {
      return parallelToolCalls;
    }

    // 默认启用并行工具调用
    return true;
  }

  /**
   * 发送聊天消息 - 实现基础接口
   */
  public async sendChatMessage(
    messages: any[],
    options?: {
      onUpdate?: (content: string, reasoning?: string) => void;
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
    console.log(`[OpenAIResponseProvider] 开始发送聊天消息，消息数量: ${messages.length}`);

    const startTime = Date.now();
    let accumulatedContent = '';
    let accumulatedReasoning = '';

    try {
      // 使用 completions 方法处理消息
      await this.completions({
        messages,
        assistant: options?.assistant || {},
        mcpTools: options?.mcpTools || [],
        onChunk: (chunk: Chunk) => {
          // 处理不同类型的 chunk
          switch (chunk.type) {
            case ChunkType.TEXT_DELTA:
              if (chunk.text) {
                accumulatedContent += chunk.text;
                // 注意：不在这里调用 onUpdate，让响应处理器处理累积
              }
              break;
            case ChunkType.THINKING_DELTA:
              if (chunk.text) {
                accumulatedReasoning += chunk.text;
              }
              break;
            case ChunkType.TEXT_COMPLETE:
              if (chunk.text) {
                // 使用服务器返回的完整文本，确保准确性
                accumulatedContent = chunk.text;
                // 在完成时调用 onUpdate
                options?.onUpdate?.(accumulatedContent, accumulatedReasoning);
              }
              break;
            case ChunkType.THINKING_COMPLETE:
              if (chunk.text) {
                accumulatedReasoning = chunk.text;
                options?.onUpdate?.(accumulatedContent, accumulatedReasoning);
              }
              break;
          }

          // 转发 chunk 给调用者 - 让响应处理器处理累积逻辑
          options?.onChunk?.(chunk);
        }
      });

      const endTime = Date.now();
      const reasoningTime = endTime - startTime;

      console.log(`[OpenAIResponseProvider] 聊天消息发送完成，耗时: ${reasoningTime}ms`);

      // 如果有推理内容，返回带推理信息的结果
      if (accumulatedReasoning) {
        return {
          content: accumulatedContent,
          reasoning: accumulatedReasoning,
          reasoningTime
        };
      }

      return accumulatedContent;

    } catch (error: any) {
      console.error('[OpenAIResponseProvider] 发送聊天消息失败:', error);
      throw error;
    }
  }

  /**
   * 完成对话生成 - 使用 Responses API
   */
  public async completions(params: {
    messages: any[];
    assistant: any;
    mcpTools?: MCPTool[];
    onChunk?: (chunk: Chunk) => void;
    onFilterMessages?: (messages: any[]) => void;
    previousResponseId?: string;
    instructions?: string;
    metadata?: Record<string, any>;
    background?: boolean;
  }): Promise<void> {
    const { messages, assistant, mcpTools = [], onChunk, onFilterMessages, previousResponseId, instructions, metadata, background } = params;
    
    try {
      // 准备消息
      const processedMessages = [];
      for (const message of messages) {
        const processedMessage = await this.getResponseMessageParam(message, this.model);
        processedMessages.push(processedMessage);
      }

      if (onFilterMessages) {
        onFilterMessages(processedMessages);
      }

      // 准备工具
      const tools = this.convertMcpTools(mcpTools);
      
      // 初始化使用统计
      const finalUsage: Usage = {
        completionTokens: 0,
        promptTokens: 0,
        totalTokens: 0
      };

      const finalMetrics: Metrics = {
        latency: 0,
        firstTokenLatency: 0
      };

      const toolResponses: MCPToolResponse[] = [];

      // 发送请求
      if (onChunk) {
        onChunk({ type: ChunkType.LLM_RESPONSE_CREATED });
      }

      const hasTools = tools.length > 0;
      const toolChoice = this.getToolChoice(assistant, hasTools);
      const parallelToolCalls = this.getParallelToolCalls(assistant, hasTools);

      const stream = await this.sdk.responses.create({
        model: this.model.id,
        input: processedMessages,
        instructions: instructions,
        temperature: assistant.temperature || 0.7,
        top_p: assistant.topP || 1.0,
        max_output_tokens: assistant.maxTokens || 4096,
        stream: true,
        tools: hasTools ? tools : undefined,
        tool_choice: toolChoice,
        parallel_tool_calls: parallelToolCalls,
        previous_response_id: previousResponseId,
        metadata: metadata,
        background: background,
        service_tier: this.getServiceTier(this.model),
        ...this.getResponseReasoningEffort(assistant, this.model)
      }, {
        timeout: this.getTimeout(this.model)
      });

      // 处理流式响应
      await this.processStream(stream, onChunk!, finalUsage, finalMetrics, toolResponses);

    } catch (error) {
      console.error('[OpenAIResponseProvider] 完成对话生成失败:', error);
      if (onChunk) {
        onChunk({
          type: ChunkType.ERROR,
          error: {
            message: error instanceof Error ? error.message : '未知错误',
            type: 'api_error'
          }
        });
      }
      throw error;
    }
  }

  /**
   * 处理流式响应 - 移动端优化
   */
  protected async processStream(
    stream: any,
    onChunk: (chunk: Chunk) => void,
    finalUsage: Usage,
    finalMetrics: Metrics,
    toolResponses: MCPToolResponse[]
  ): Promise<void> {
    const startTime = Date.now();
    let firstTokenTime = 0;
    let accumulatedText = '';
    const toolCalls: any[] = [];

    try {
      for await (const chunk of stream) {
        // 记录第一个 token 时间
        if (firstTokenTime === 0) {
          firstTokenTime = Date.now() - startTime;
          finalMetrics.firstTokenLatency = firstTokenTime;
        }

        // 处理官方 Responses API 流式事件类型
        switch (chunk.type) {
          case 'response.output_text.delta':
            const deltaText = chunk.delta || '';
            accumulatedText += deltaText;

            // 发送文本增量
            onChunk({
              type: ChunkType.TEXT_DELTA,
              text: deltaText
            });
            break;

          case 'response.output_text.done':
            // 文本完成事件 - 使用服务器返回的完整文本
            if (chunk.text) {
              accumulatedText = chunk.text;
              onChunk({
                type: ChunkType.TEXT_COMPLETE,
                text: chunk.text
              });
            }
            break;

          case 'response.reasoning.delta':
            // 处理推理增量
            if (chunk.delta) {
              onChunk({
                type: ChunkType.THINKING_DELTA,
                text: chunk.delta
              });
            }
            break;

          case 'response.reasoning.done':
            // 推理完成事件
            if (chunk.reasoning) {
              onChunk({
                type: ChunkType.THINKING_COMPLETE,
                text: chunk.reasoning
              });
            }
            break;

          case 'response.function_call.delta':
            // 工具调用增量
            if (chunk.function_call) {
              toolCalls.push(chunk.function_call);
            }
            break;

          case 'response.function_call.done':
            // 工具调用完成
            if (chunk.function_call) {
              toolCalls.push(chunk.function_call);
            }
            break;

          case 'response.completed':
            // 响应完成
            console.log('[OpenAIResponseProvider] 响应完成');
            break;

          case 'response.created':
          case 'response.in_progress':
          case 'response.output_item.added':
          case 'response.content_part.added':
          case 'response.content_part.done':
          case 'response.output_item.done':
            // 这些事件不需要特殊处理，只是状态更新
            console.log(`[OpenAIResponseProvider] 收到事件: ${chunk.type}`);
            break;

          default:
            // 兼容旧格式 - 处理 output 数组格式
            if (chunk.output) {
              for (const output of chunk.output) {
                switch (output.type) {
                  case 'message':
                    if (output.content) {
                      for (const content of output.content) {
                        if (content.type === 'output_text') {
                          const deltaText = content.text || '';
                          accumulatedText += deltaText;

                          onChunk({
                            type: ChunkType.TEXT_DELTA,
                            text: deltaText
                          });
                        }
                      }
                    }
                    break;

                  case 'function_call':
                    toolCalls.push(output);
                    break;

                  case 'reasoning':
                    if (output.content) {
                      onChunk({
                        type: ChunkType.THINKING_DELTA,
                        text: output.content
                      });
                    }
                    break;
                }
              }
            }
            break;
        }

        // 处理使用统计
        if (chunk.usage) {
          finalUsage.completionTokens = chunk.usage.output_tokens || 0;
          finalUsage.promptTokens = chunk.usage.input_tokens || 0;
          finalUsage.totalTokens = chunk.usage.total_tokens || 0;
        }
      }

      // 注意：TEXT_COMPLETE 已在 response.output_text.done 事件中发送，这里不再重复发送

      // 处理工具调用
      if (toolCalls.length > 0) {
        await this.handleToolCalls(toolCalls, onChunk, toolResponses);
      }

      // 计算完成时间
      finalMetrics.latency = Date.now() - startTime;

      // 发送完成信号
      onChunk({
        type: ChunkType.LLM_RESPONSE_COMPLETE
      });

    } catch (error) {
      console.error('[OpenAIResponseProvider] 流式响应处理失败:', error);
      onChunk({
        type: ChunkType.ERROR,
        error: {
          message: error instanceof Error ? error.message : '流式响应处理失败',
          type: 'stream_error'
        }
      });
      throw error;
    }
  }

  /**
   * 处理工具调用
   */
  private async handleToolCalls(
    toolCalls: any[],
    onChunk: (chunk: Chunk) => void,
    _toolResponses: MCPToolResponse[]
  ): Promise<void> {
    try {
      onChunk({
        type: ChunkType.MCP_TOOL_IN_PROGRESS,
        responses: toolCalls
      });

      // 这里可以添加具体的工具调用处理逻辑
      // 暂时发送完成信号
      onChunk({
        type: ChunkType.MCP_TOOL_COMPLETE,
        responses: toolCalls
      });

    } catch (error) {
      console.error('[OpenAIResponseProvider] 工具调用处理失败:', error);
      onChunk({
        type: ChunkType.ERROR,
        error: {
          message: error instanceof Error ? error.message : '工具调用处理失败',
          type: 'tool_error'
        }
      });
    }
  }

  /**
   * 处理工具调用 - Responses API 格式
   */
  protected async processToolCalls(
    mcpTools: MCPTool[],
    toolCalls: any[]
  ): Promise<any[]> {
    if (!toolCalls || toolCalls.length === 0) {
      return [];
    }

    try {
      const mcpToolResponses = this.convertToolCallsToMcpResponses(toolCalls, mcpTools);

      const results = await parseAndCallTools(
        mcpToolResponses,
        mcpTools,
        (toolResponse: MCPToolResponse, _result: MCPCallToolResponse) => {
          console.log(`[OpenAIResponseProvider] 工具调用完成: ${toolResponse.tool.name}`);
        }
      );

      return results.map((result, index) =>
        this.mcpToolCallResponseToMessage(mcpToolResponses[index], result, this.model)
      ).filter(Boolean);

    } catch (error) {
      console.error('[OpenAIResponseProvider] 工具调用处理失败:', error);
      return [];
    }
  }

  /**
   * 处理工具使用 - XML 格式
   */
  protected async processToolUses(content: string): Promise<any[]> {
    if (!content || !content.includes('<tool_use>')) {
      return [];
    }

    try {
      // 解析 XML 格式的工具使用
      const toolUseRegex = /<tool_use>([\s\S]*?)<\/tool_use>/g;
      const matches = Array.from(content.matchAll(toolUseRegex));

      if (matches.length === 0) {
        return [];
      }

      // 这里可以添加具体的 XML 工具使用处理逻辑
      console.log(`[OpenAIResponseProvider] 检测到 ${matches.length} 个工具使用`);

      return [];

    } catch (error) {
      console.error('[OpenAIResponseProvider] XML 工具使用处理失败:', error);
      return [];
    }
  }

  /**
   * 获取模型列表 - 使用 OpenAI SDK
   */
  public async getModels(): Promise<any[]> {
    try {
      console.log('[OpenAIResponseProvider] 获取模型列表');

      // 使用 OpenAI SDK 获取模型列表
      const response = await this.sdk.models.list();
      const models = response.data || [];

      // 清理模型ID
      models.forEach((model) => {
        model.id = model.id.trim();
      });

      // 过滤出支持 Responses API 的模型
      const supportedModels = models.filter(model => {
        const supportedModelIds = [
          'gpt-4o',
          'gpt-4o-mini',
          'gpt-4o-2024-11-20',
          'gpt-4o-2024-08-06',
          'gpt-4o-2024-05-13',
          'gpt-4o-mini-2024-07-18',
          'computer-use-preview',
          'gpt-4.1',
          'gpt-4.1-nano',
          'gpt-4.1-mini',
          'gpt-image-1',
          'o3',
          'o4-mini',
          'o1-preview',
          'o1-mini'
        ];

        return supportedModelIds.some(supportedId =>
          model.id.includes(supportedId) || model.id === supportedId
        );
      });

      console.log(`[OpenAIResponseProvider] 获取到 ${models.length} 个模型，其中 ${supportedModels.length} 个支持 Responses API`);

      return supportedModels.length > 0 ? supportedModels : models;
    } catch (error) {
      console.error('[OpenAIResponseProvider] 获取模型列表失败:', error);

      // 返回预设的支持 Responses API 的模型列表
      return [
        {
          id: 'gpt-4o',
          name: 'GPT-4o',
          description: 'GPT-4o - 支持 Responses API 的多模态模型',
          object: 'model',
          created: Date.now(),
          owned_by: 'openai'
        },
        {
          id: 'gpt-4o-mini',
          name: 'GPT-4o Mini',
          description: 'GPT-4o Mini - 支持 Responses API 的轻量级模型',
          object: 'model',
          created: Date.now(),
          owned_by: 'openai'
        },
        {
          id: 'gpt-4.1',
          name: 'GPT-4.1',
          description: 'GPT-4.1 - 最新的 Responses API 模型',
          object: 'model',
          created: Date.now(),
          owned_by: 'openai'
        },
        {
          id: 'gpt-4.1-mini',
          name: 'GPT-4.1 Mini',
          description: 'GPT-4.1 Mini - 轻量级最新模型',
          object: 'model',
          created: Date.now(),
          owned_by: 'openai'
        },
        {
          id: 'o3',
          name: 'o3',
          description: 'o3 - 最新推理模型',
          object: 'model',
          created: Date.now(),
          owned_by: 'openai'
        },
        {
          id: 'o4-mini',
          name: 'o4-mini',
          description: 'o4-mini - 轻量级推理模型',
          object: 'model',
          created: Date.now(),
          owned_by: 'openai'
        },
        {
          id: 'o1-preview',
          name: 'o1-preview',
          description: 'o1-preview - 支持推理的 Responses API 模型',
          object: 'model',
          created: Date.now(),
          owned_by: 'openai'
        },
        {
          id: 'o1-mini',
          name: 'o1-mini',
          description: 'o1-mini - 轻量级推理 Responses API 模型',
          object: 'model',
          created: Date.now(),
          owned_by: 'openai'
        }
      ];
    }
  }

  /**
   * 测试 API 连接 - 使用 Responses API 端点
   */
  public async testConnection(): Promise<boolean> {
    try {
      console.log('[OpenAIResponseProvider] 测试 Responses API 连接');

      // 使用 Responses API 进行连接测试
      const testResponse = await this.sdk.responses.create({
        model: 'gpt-4o-mini', // 使用一个确定支持 Responses API 的模型
        input: [
          {
            role: 'user',
            content: [{ type: 'input_text', text: 'test' }]
          }
        ],
        max_output_tokens: 1,
        stream: false
      });

      if (testResponse) {
        console.log('[OpenAIResponseProvider] Responses API 连接测试成功');
        return true;
      } else {
        console.warn('[OpenAIResponseProvider] Responses API 连接测试失败：未获取到响应');
        return false;
      }
    } catch (error) {
      console.error('[OpenAIResponseProvider] Responses API 连接测试失败:', error);
      return false;
    }
  }
}
