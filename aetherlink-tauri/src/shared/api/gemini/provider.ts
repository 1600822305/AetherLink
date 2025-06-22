import {
  GoogleGenAI,
  FinishReason,
  GenerateContentResponse
} from '@google/genai';
import type {
  Content,
  FunctionCall,
  Part,
  PartUnion,
  Tool
} from '@google/genai';
import type { Message, Model, MCPTool } from '../../types';
import { ChunkType } from '../../types/chunk';
import { getMainTextContent } from '../../utils/messageUtils';

import {
  isGemmaModel,
  isWebSearchModel
} from '../../config/models';
import { takeRight } from 'lodash';
import { filterUserRoleStartMessages, filterEmptyMessages } from '../../utils/messageUtils/filters';
import { withRetry } from '../../utils/retryUtils';

import { GeminiConfigBuilder } from './configBuilder';
import { createGeminiEmbeddingService } from './embeddingService';
import { createGeminiMessageContentService } from './messageContentService';
import { fetchModels, createClient, testConnection } from './client';
import { createAbortController } from '../../utils/abortController';





// 接口定义
interface CompletionsParams {
  messages: Message[];
  assistant: any;
  mcpTools: MCPTool[];
  onChunk: (chunk: any) => void;
  onFilterMessages: (messages: Message[]) => void;
}

interface MCPToolResponse {
  toolUseId?: string;
  toolCallId?: string;
  tool: MCPTool;
}

interface MCPCallToolResponse {
  isError: boolean;
  content: string;
}



// 基础Provider类
export abstract class BaseProvider {
  protected model: Model;
  protected sdk: GoogleGenAI;

  constructor(model: Model) {
    this.model = model;
    this.sdk = createClient(model);
  }

  protected getAssistantSettings(assistant: any) {
    // 获取原始maxTokens值
    const maxTokens = Math.max(assistant?.maxTokens || assistant?.settings?.maxTokens || 4096, 1);

    console.log(`[GeminiProvider] maxTokens参数 - 助手设置: ${assistant?.maxTokens}, settings设置: ${assistant?.settings?.maxTokens}, 最终值: ${maxTokens}`);

    // 检查流式输出设置
    const streamOutput = assistant?.settings?.streamOutput !== false;

    return {
      contextCount: assistant?.settings?.contextCount || 10,
      maxTokens: maxTokens,
      streamOutput: streamOutput
    };
  }



  protected createAbortController(messageId?: string, autoCleanup = false) {
    // 使用统一的 createAbortController 工具函数
    return createAbortController(messageId, autoCleanup);
  }

  protected async getMessageContent(message: Message): Promise<string> {
    return getMainTextContent(message);
  }

  public convertMcpTools<T>(mcpTools: MCPTool[]): T[] {
    return mcpTools.map((tool) => {
      let toolName = tool.id || tool.name;

      // 清理工具名称
      if (/^\d/.test(toolName)) toolName = `mcp_${toolName}`;
      toolName = toolName.replace(/[^a-zA-Z0-9_.-]/g, '_');
      if (toolName.length > 64) toolName = toolName.substring(0, 64);
      if (!/^[a-zA-Z_]/.test(toolName)) toolName = `tool_${toolName}`;

      return {
        functionDeclarations: [{
          name: toolName,
          description: tool.description,
          parameters: tool.inputSchema
        }]
      };
    }) as T[];
  }

  protected setupToolsConfig<T>({ mcpTools, enableToolUse }: {
    mcpTools: MCPTool[];
    model: Model;
    enableToolUse: boolean;
  }): { tools: T[] } {
    if (!enableToolUse || !mcpTools?.length) return { tools: [] };
    return { tools: this.convertMcpTools<T>(mcpTools) };
  }

  protected get useSystemPromptForTools(): boolean {
    return false;
  }

  public mcpToolCallResponseToMessage = (mcpToolResponse: MCPToolResponse, resp: MCPCallToolResponse, _model: Model) => {
    if ('toolUseId' in mcpToolResponse && mcpToolResponse.toolUseId) {
      return {
        role: 'user',
        parts: [{ text: !resp.isError ? resp.content : `Error: ${resp.content}` }]
      } satisfies Content;
    } else if ('toolCallId' in mcpToolResponse) {
      return {
        role: 'user',
        parts: [{
          functionResponse: {
            id: mcpToolResponse.toolCallId,
            name: mcpToolResponse.tool.id,
            response: {
              output: !resp.isError ? resp.content : undefined,
              error: resp.isError ? resp.content : undefined
            }
          }
        }]
      } satisfies Content;
    }
    return;
  }
}



// Gemini Provider实现
export default class GeminiProvider extends BaseProvider {
  constructor(provider: any) {
    const model = {
      id: provider.models?.[0]?.id || 'gemini-pro',
      apiKey: provider.apiKey,
      baseUrl: provider.apiHost
    } as Model;
    super(model);
  }





  /**
   * 获取消息内容 - 使用专门的消息内容服务
   */
  private async getMessageContents(message: Message): Promise<Content> {
    const messageContentService = createGeminiMessageContentService(this.model);
    return messageContentService.getMessageContents(message);
  }

  /**
   * 获取消息文本内容 - 模拟的 getMainTextContent
   */
  protected async getMessageContent(message: Message): Promise<string> {
    return getMainTextContent(message);
  }





  /**
   * 核心completions方法 - 专注于聊天功能
   */
  public async completions({
    messages,
    assistant,
    mcpTools,
    onChunk,
    onFilterMessages
  }: CompletionsParams): Promise<void> {
    const model = assistant.model || this.model;

    const { contextCount, maxTokens, streamOutput } = this.getAssistantSettings(assistant);

    // 过滤消息 - 参考实现
    const userMessages = filterUserRoleStartMessages(
      filterEmptyMessages(takeRight(messages, contextCount + 2))
    );
    onFilterMessages(userMessages);

    const userLastMessage = userMessages.pop();
    const history: Content[] = [];

    for (const message of userMessages) {
      history.push(await this.getMessageContents(message));
    }

    let systemInstruction = assistant.prompt;
    const { tools } = this.setupToolsConfig<Tool>({
      mcpTools,
      model,
      enableToolUse: true
    });

    if (this.useSystemPromptForTools) {
      // 构建系统提示词（简化版）
      systemInstruction = assistant.prompt || '';
    }

    //  调试日志：显示系统提示词的最终处理结果
    console.log(`[GeminiProvider.completions] 系统提示词最终处理:`, {
      useSystemPromptForTools: this.useSystemPromptForTools,
      assistantPrompt: assistant.prompt?.substring(0, 50) + (assistant.prompt?.length > 50 ? '...' : ''),
      systemInstruction: systemInstruction?.substring(0, 50) + (systemInstruction?.length > 50 ? '...' : ''),
      systemInstructionLength: systemInstruction?.length || 0,
      isGemmaModel: isGemmaModel(model)
    });

    // const toolResponses: MCPToolResponse[] = [];

    if (assistant.enableWebSearch && isWebSearchModel(model)) {
      tools.push({
        // @ts-ignore googleSearch is not a valid tool for Gemini
        googleSearch: {}
      });
    }

    // 使用 GeminiConfigBuilder 构建配置
    const configBuilder = new GeminiConfigBuilder(assistant, model, maxTokens, systemInstruction, tools);
    const generateContentConfig = configBuilder.build();

    // 添加调试日志显示使用的参数
    console.log(`[GeminiProvider] API请求参数:`, {
      model: model.id,
      temperature: generateContentConfig.temperature,
      topP: generateContentConfig.topP,
      maxOutputTokens: generateContentConfig.maxOutputTokens,
      //  添加系统提示词信息到日志
      systemInstruction: typeof generateContentConfig.systemInstruction === 'string'
        ? generateContentConfig.systemInstruction.substring(0, 50) + (generateContentConfig.systemInstruction.length > 50 ? '...' : '')
        : generateContentConfig.systemInstruction ? '[Complex Content]' : '',
      systemInstructionLength: typeof generateContentConfig.systemInstruction === 'string'
        ? generateContentConfig.systemInstruction.length
        : 0,
      geminiSpecificParams: 'moved to configBuilder',
      assistantInfo: assistant ? {
        id: assistant.id,
        name: assistant.name,
        temperature: assistant.temperature,
        topP: assistant.topP
      } : '无助手信息'
    });

    const messageContents: Content = await this.getMessageContents(userLastMessage!);
    const chat = this.sdk.chats.create({
      model: model.id,
      config: generateContentConfig,
      history: history
    });

    // 处理Gemma模型的特殊格式
    if (isGemmaModel(model) && assistant.prompt) {
      const isFirstMessage = history.length === 0;
      if (isFirstMessage && messageContents) {
        const systemMessage = [{
          text: '<start_of_turn>user\n' + systemInstruction + '<end_of_turn>\n' +
                '<start_of_turn>user\n' + (messageContents?.parts?.[0] as Part).text + '<end_of_turn>'
        }] as Part[];
        if (messageContents && messageContents.parts) {
          messageContents.parts[0] = systemMessage[0];
        }
      }
    }

    const finalUsage = { completion_tokens: 0, prompt_tokens: 0, total_tokens: 0 };
    const finalMetrics = { completion_tokens: 0, time_completion_millsec: 0, time_first_token_millsec: 0 };
    const { cleanup, abortController } = this.createAbortController(userLastMessage?.id, true);

    // 处理流式响应的核心逻辑
    const processStream = async (
      stream: AsyncGenerator<GenerateContentResponse> | GenerateContentResponse,
      _idx: number
    ) => {
      history.push(messageContents);
      let functionCalls: FunctionCall[] = [];
      let time_first_token_millsec = 0;
      const start_time_millsec = new Date().getTime();



      if (stream instanceof GenerateContentResponse) {
        // 非流式响应处理

        const time_completion_millsec = new Date().getTime() - start_time_millsec;

        if (stream.text?.length) {
          onChunk({ type: ChunkType.TEXT_DELTA, text: stream.text });
          onChunk({ type: ChunkType.TEXT_COMPLETE, text: stream.text });
        }

        stream.candidates?.forEach((candidate) => {
          if (candidate.content) {
            history.push(candidate.content);
            candidate.content.parts?.forEach((part) => {
              if (part.functionCall) {
                functionCalls.push(part.functionCall);
              }
              const text = part.text || '';
              if (part.thought) {
                onChunk({ type: ChunkType.THINKING_DELTA, text });
                onChunk({ type: ChunkType.THINKING_COMPLETE, text });
              } else if (part.text) {
                onChunk({ type: ChunkType.TEXT_DELTA, text });
                onChunk({ type: ChunkType.TEXT_COMPLETE, text });
              }
            });
          }
        });

        onChunk({
          type: ChunkType.BLOCK_COMPLETE,
          response: {
            text: stream.text,
            usage: {
              prompt_tokens: stream.usageMetadata?.promptTokenCount || 0,
              thoughts_tokens: stream.usageMetadata?.thoughtsTokenCount || 0,
              completion_tokens: stream.usageMetadata?.candidatesTokenCount || 0,
              total_tokens: stream.usageMetadata?.totalTokenCount || 0,
            },
            metrics: {
              completion_tokens: stream.usageMetadata?.candidatesTokenCount,
              time_completion_millsec,
              time_first_token_millsec: 0
            },
            webSearch: {
              results: stream.candidates?.[0]?.groundingMetadata,
              source: 'gemini'
            }
          }
        });
      } else {
        // 流式响应处理

        let content = '';
        let thinkingContent = '';

        for await (const chunk of stream) {
          // 检查中断信号
          if (abortController.signal.aborted) {
            console.log('[GeminiProvider] 流式响应被用户中断');
            break;
          }

          if (time_first_token_millsec == 0) {
            time_first_token_millsec = new Date().getTime();
          }

          // 图像生成已在上面的决策逻辑中处理，这里不需要重复处理

          if (chunk.candidates?.[0]?.content?.parts && chunk.candidates[0].content.parts.length > 0) {
            const parts = chunk.candidates[0].content.parts;
            for (const part of parts) {
              if (!part.text) continue;

              if (part.thought) {
                // 思考过程
                if (time_first_token_millsec === 0) {
                  time_first_token_millsec = new Date().getTime();
                }
                thinkingContent += part.text;
                onChunk({ type: ChunkType.THINKING_DELTA, text: part.text || '' });
              } else {
                // 正常内容 - 修复的bug
                if (time_first_token_millsec == 0) {
                  time_first_token_millsec = new Date().getTime();
                }

                //  修复：当遇到正常文本且有思考内容时，发送THINKING_COMPLETE
                if (thinkingContent) {
                  onChunk({
                    type: ChunkType.THINKING_COMPLETE,
                    text: thinkingContent,
                    thinking_millsec: new Date().getTime() - time_first_token_millsec
                  });
                  thinkingContent = ''; // 清空思维内容
                }

                content += part.text;
                onChunk({ type: ChunkType.TEXT_DELTA, text: part.text });
              }
            }
          }

          if (chunk.candidates?.[0]?.finishReason) {
            if (content) {
              onChunk({ type: ChunkType.TEXT_COMPLETE, text: content });
            }
            if (chunk.usageMetadata) {
              finalUsage.prompt_tokens += chunk.usageMetadata.promptTokenCount || 0;
              finalUsage.completion_tokens += chunk.usageMetadata.candidatesTokenCount || 0;
              finalUsage.total_tokens += chunk.usageMetadata.totalTokenCount || 0;
            }
            if (chunk.candidates?.[0]?.groundingMetadata) {
              const groundingMetadata = chunk.candidates?.[0]?.groundingMetadata;
              onChunk({
                type: ChunkType.LLM_WEB_SEARCH_COMPLETE,
                llm_web_search: {
                  results: groundingMetadata,
                  source: 'gemini'
                }
              });
            }
            if (chunk.functionCalls) {
              chunk.candidates?.forEach((candidate) => {
                if (candidate.content) {
                  history.push(candidate.content);
                }
              });
              functionCalls = functionCalls.concat(chunk.functionCalls);
            }

            finalMetrics.completion_tokens = finalUsage.completion_tokens;
            finalMetrics.time_completion_millsec += new Date().getTime() - start_time_millsec;
            finalMetrics.time_first_token_millsec =
              (finalMetrics.time_first_token_millsec || 0) + (time_first_token_millsec - start_time_millsec);
          }
        }

        onChunk({
          type: ChunkType.BLOCK_COMPLETE,
          response: {
            usage: finalUsage,
            metrics: finalMetrics
          }
        });
      }
    };

    // const start_time_millsec = new Date().getTime();

    if (!streamOutput) {
      onChunk({ type: ChunkType.LLM_RESPONSE_CREATED });
      const response = await withRetry(
        () => chat.sendMessage({
          message: messageContents as PartUnion,
          config: {
            ...generateContentConfig,
            abortSignal: abortController.signal
          }
        }),
        'Gemini Non-Stream Request'
      );
      return await processStream(response, 0).then(cleanup);
    }

    onChunk({ type: ChunkType.LLM_RESPONSE_CREATED });
    const userMessagesStream = await withRetry(
      () => chat.sendMessageStream({
        message: messageContents as PartUnion,
        config: {
          ...generateContentConfig,
          abortSignal: abortController.signal
        }
      }),
      'Gemini Stream Request'
    );

    await processStream(userMessagesStream, 0).finally(cleanup);
  }





  /**
   * 翻译方法
   */
  public async translate(
    content: string,
    assistant: any,
    onResponse?: (text: string, isComplete: boolean) => void,
    abortSignal?: AbortSignal
  ) {
    const model = assistant.model || this.model;
    const { maxTokens } = this.getAssistantSettings(assistant);

    const _content = isGemmaModel(model) && assistant.prompt
      ? `<start_of_turn>user\n${assistant.prompt}<end_of_turn>\n<start_of_turn>user\n${content}<end_of_turn>`
      : content;

    // 使用 GeminiConfigBuilder 构建配置
    const configBuilder = new GeminiConfigBuilder(assistant, model, maxTokens, assistant.prompt, []);
    const config = configBuilder.build();

    if (!onResponse) {
      const response = await withRetry(
        () => this.sdk.models.generateContent({
          model: model.id,
          config: config,
          contents: [{ role: 'user', parts: [{ text: _content }] }]
        }),
        'Gemini Translate'
      );
      return response.text || '';
    }

    const response = await withRetry(
      () => this.sdk.models.generateContentStream({
        model: model.id,
        config: config,
        contents: [{ role: 'user', parts: [{ text: content }] }]
      }),
      'Gemini Translate Stream'
    );

    let text = '';
    for await (const chunk of response) {
      // 检查中断信号
      if (abortSignal?.aborted) {
        console.log('[GeminiProvider.translate] 流式响应被用户中断');
        break;
      }

      text += chunk.text;
      onResponse?.(text, false);
    }
    onResponse?.(text, true);
    return text;
  }

  /**
   * 生成摘要
   */
  public async summaries(messages: Message[], assistant: any): Promise<string> {
    const model = assistant.model || this.model;
    const userMessages = takeRight(messages, 5)
      .filter((message) => !message.isPreset)
      .map((message) => ({
        role: message.role,
        content: getMainTextContent(message)
      }));

    const userMessageContent = userMessages.reduce((prev, curr) => {
      const content = curr.role === 'user' ? `User: ${curr.content}` : `Assistant: ${curr.content}`;
      return prev + (prev ? '\n' : '') + content;
    }, '');

    const systemMessage = {
      role: 'system',
      content: '请为以下对话生成一个简洁的标题'
    };

    const userMessage = { role: 'user', content: userMessageContent };
    const content = isGemmaModel(model)
      ? `<start_of_turn>user\n${systemMessage.content}<end_of_turn>\n<start_of_turn>user\n${userMessage.content}<end_of_turn>`
      : userMessage.content;

    // 使用 GeminiConfigBuilder 构建配置
    const configBuilder = new GeminiConfigBuilder(assistant, model, 4096, systemMessage.content, []);
    const config = configBuilder.build();

    const response = await this.sdk.models.generateContent({
      model: model.id,
      config: config,
      contents: [{ role: 'user', parts: [{ text: content }] }]
    });

    return response.text || '';
  }

  /**
   * 生成文本
   */
  public async generateText({ prompt, content }: { prompt: string; content: string }): Promise<string> {
    const model = this.model;
    const MessageContent = isGemmaModel(model)
      ? `<start_of_turn>user\n${prompt}<end_of_turn>\n<start_of_turn>user\n${content}<end_of_turn>`
      : content;

    // 创建临时助手对象用于配置构建
    const tempAssistant = { prompt: prompt };

    // 使用 GeminiConfigBuilder 构建配置
    const configBuilder = new GeminiConfigBuilder(tempAssistant, model, 4096, prompt, []);
    const config = configBuilder.build();

    const response = await this.sdk.models.generateContent({
      model: model.id,
      config: config,
      contents: [{ role: 'user', parts: [{ text: MessageContent }] }]
    });

    return response.text || '';
  }

  /**
   * 生成建议
   */
  public async suggestions(): Promise<any[]> {
    return [];
  }

  /**
   * 搜索摘要
   */
  public async summaryForSearch(messages: Message[], assistant: any): Promise<string> {
    const model = assistant.model || this.model;
    const systemMessage = { role: 'system', content: assistant.prompt };
    const userMessageContent = messages.map(getMainTextContent).join('\n');

    const content = isGemmaModel(model)
      ? `<start_of_turn>user\n${systemMessage.content}<end_of_turn>\n<start_of_turn>user\n${userMessageContent}<end_of_turn>`
      : userMessageContent;

    const lastUserMessage = messages[messages.length - 1];
    const { abortController, cleanup } = this.createAbortController(lastUserMessage?.id);
    const { signal } = abortController;

    // 使用 GeminiConfigBuilder 构建配置
    const configBuilder = new GeminiConfigBuilder(assistant, model, 4096, systemMessage.content, []);
    const config = configBuilder.build();

    // 添加特定的配置项
    const finalConfig = {
      ...config,
      httpOptions: { timeout: 20 * 1000 },
      abortSignal: signal
    };

    const response = await this.sdk.models
      .generateContent({
        model: model.id,
        config: finalConfig,
        contents: [{ role: 'user', parts: [{ text: content }] }]
      })
      .finally(cleanup);

    return response.text || '';
  }

  /**
   * 生成图像
   */
  public async generateImage(): Promise<string[]> {
    return [];
  }

  /**
   * 检查模型有效性
   */
  public async check(model: Model, stream: boolean = false): Promise<{ valid: boolean; error: Error | null }> {
    if (!model) {
      return { valid: false, error: new Error('No model found') };
    }

    // 使用 GeminiConfigBuilder 构建配置，但设置最小的 maxTokens 用于测试
    const testAssistant = {
      enableThinking: false,
      thinkingBudget: 0
    };
    const configBuilder = new GeminiConfigBuilder(testAssistant, model, 1, undefined, []);
    const config = configBuilder.build();

    try {
      if (!stream) {
        const result = await this.sdk.models.generateContent({
          model: model.id,
          contents: [{ role: 'user', parts: [{ text: 'hi' }] }],
          config: config
        });
        if (!result.text) {
          throw new Error('Empty response');
        }
      } else {
        const response = await this.sdk.models.generateContentStream({
          model: model.id,
          contents: [{ role: 'user', parts: [{ text: 'hi' }] }],
          config: config
        });
        let hasContent = false;
        for await (const chunk of response) {
          if (chunk.candidates && chunk.candidates[0].finishReason === FinishReason.MAX_TOKENS) {
            hasContent = true;
            break;
          }
        }
        if (!hasContent) {
          throw new Error('Empty streaming response');
        }
      }
      return { valid: true, error: null };
    } catch (error: any) {
      return { valid: false, error };
    }
  }



  /**
   * 获取文本嵌入
   */
  public async getEmbedding(
    text: string,
    options?: {
      taskType?: 'RETRIEVAL_QUERY' | 'RETRIEVAL_DOCUMENT' | 'SEMANTIC_SIMILARITY' | 'CLASSIFICATION' | 'CLUSTERING';
      title?: string;
    }
  ): Promise<number[]> {
    const embeddingService = createGeminiEmbeddingService(this.model);
    const result = await embeddingService.getEmbedding({
      text,
      model: this.model,
      taskType: options?.taskType,
      title: options?.title
    });
    return result.embedding;
  }

  /**
   * 获取嵌入维度
   */
  public async getEmbeddingDimensions(model: Model): Promise<number> {
    const embeddingService = createGeminiEmbeddingService(model);
    return embeddingService.getEmbeddingDimensions(model);
  }

  /**
   * 兼容性方法：sendChatMessage - 转换为completions调用
   */
  public async sendChatMessage(
    messages: Message[],
    options?: {
      onUpdate?: (content: string, reasoning?: string) => void;
      onChunk?: (chunk: any) => void;
      enableWebSearch?: boolean;
      enableThinking?: boolean;
      enableTools?: boolean;
      mcpTools?: MCPTool[];
      mcpMode?: 'prompt' | 'function';
      systemPrompt?: string;
      abortSignal?: AbortSignal;
      assistant?: any;
    }
  ): Promise<string | { content: string; reasoning?: string; reasoningTime?: number }> {
    //  修复：正确处理系统提示词传递
    // 如果有传入的assistant，使用它；否则创建一个新的assistant对象
    const assistant = options?.assistant || {
      model: this.model,
      //  关键修复：使用systemPrompt参数作为prompt
      prompt: options?.systemPrompt || '',
      settings: {
        streamOutput: true
      },
      enableWebSearch: options?.enableWebSearch || false,
      // 图像生成功能由上层决策处理
      enableGenerateImage: false
    };

    //  修复：如果有传入的assistant但没有prompt，使用systemPrompt
    if (options?.assistant && options?.systemPrompt && !options.assistant.prompt) {
      assistant.prompt = options.systemPrompt;
    }

    //  调试日志：显示最终使用的系统提示词
    console.log(`[GeminiProvider.sendChatMessage] 系统提示词处理:`, {
      hasSystemPrompt: !!options?.systemPrompt,
      systemPromptLength: options?.systemPrompt?.length || 0,
      assistantPrompt: assistant.prompt?.substring(0, 50) + (assistant.prompt?.length > 50 ? '...' : ''),
      assistantPromptLength: assistant.prompt?.length || 0
    });

    // 按照的方式：直接使用 SDK 的流式响应
    let content = '';
    let reasoning = '';
    let reasoningTime = 0;

    // 转换消息格式 - 使用现有的方法，包含历史消息
    const messageContentService = createGeminiMessageContentService(this.model);
    const userLastMessage = messages[messages.length - 1];
    const messageContents = await messageContentService.getMessageContents(userLastMessage);

    // 构建历史消息
    const history: Content[] = [];
    const userMessages = messages.slice(0, -1); // 除了最后一条消息的所有消息
    for (const message of userMessages) {
      if (message.role !== 'system') { // 跳过系统消息
        history.push(await messageContentService.getMessageContents(message));
      }
    }

    console.log(`[sendChatMessage] 包含历史消息数量: ${history.length}`);

    // 构建配置 - 使用现有的方法
    const configBuilder = new GeminiConfigBuilder(assistant, this.model, 4096, assistant.prompt, []);
    const config = configBuilder.build();

    // 使用chat方式包含历史消息
    const chat = this.sdk.chats.create({
      model: this.model.id,
      config: config,
      history: history
    });

    // 发送消息并获取流式响应
    const response = await chat.sendMessageStream({
      message: messageContents as any,
      config: config
    });

    // 按照的方式处理流式响应
    for await (const chunk of response) {
      // 检查中断信号
      if (options?.abortSignal?.aborted) {
        console.log('[GeminiProvider.sendChatMessage] 流式响应被用户中断');
        break;
      }

      if (chunk.candidates?.[0]?.content?.parts) {
        const parts = chunk.candidates[0].content.parts;
        for (const part of parts) {
          if (part.text) {
            if (part.thought) {
              // 思考内容
              reasoning += part.text;
              // 如果有 onChunk，发送 THINKING_DELTA
              options?.onChunk?.({ type: ChunkType.THINKING_DELTA, text: part.text });
              // 兼容 onUpdate
              options?.onUpdate?.(content, reasoning);
            } else {
              // 正常文本内容
              content += part.text;
              // 如果有 onChunk，发送 TEXT_DELTA
              options?.onChunk?.({ type: ChunkType.TEXT_DELTA, text: part.text });
              // 兼容 onUpdate
              options?.onUpdate?.(content, reasoning);
            }
          }
        }
      }

      // 处理完成状态
      if (chunk.candidates?.[0]?.finishReason) {
        // 在完成时发送 THINKING_COMPLETE 和 TEXT_COMPLETE
        if (reasoning) {
          options?.onChunk?.({ type: ChunkType.THINKING_COMPLETE, text: reasoning });
        }
        if (content) {
          options?.onChunk?.({ type: ChunkType.TEXT_COMPLETE, text: content });
        }
        break;
      }
    }

    return { content, reasoning, reasoningTime };
  }

  /**
   * 兼容性方法：testConnection
   */
  public async testConnection(): Promise<boolean> {
    return testConnection(this.model);
  }

  /**
   * 兼容性方法：getModels
   */
  public async getModels(): Promise<any[]> {
    return fetchModels(this.model);
  }
}

// 同时提供命名导出以确保兼容性
export { GeminiProvider };
