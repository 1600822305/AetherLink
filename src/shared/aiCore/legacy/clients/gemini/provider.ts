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
import type { Message, Model, MCPTool, MCPToolResponse as GlobalMCPToolResponse } from '../../../../types';
import { ChunkType } from '../../../../types/chunk';
import { getMainTextContent } from '../../../../utils/messageUtils';

import {
  isGemmaModel,
  isWebSearchModel
} from '../../../../config/models';
import { takeRight } from 'lodash';
import { filterUserRoleStartMessages, filterEmptyMessages } from '../../../../utils/messageUtils/filters';
import { withRetry } from '../../../../utils/retryUtils';

import { GeminiConfigBuilder } from './configBuilder';
import { createGeminiEmbeddingService } from './embeddingService';
import { createGeminiMessageContentService } from './messageContentService';
import { fetchModels, createClient, testConnection } from './client';
import { createAbortController } from '../../../../utils/abortController';
import { parseAndCallTools, getMCPSystemPrompt } from '../../../../utils/mcpToolParser';





// 接口定义
interface CompletionsParams {
  messages: Message[];
  assistant: any;
  mcpTools: MCPTool[];
  mcpMode?: 'prompt' | 'function';  // 工具调用模式
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

    // 🔧 修复：检查多个可能的位置获取 streamOutput 设置
    // 可能在 assistant.settings.streamOutput 或 assistant.streamOutput
    const streamOutputValue = assistant?.settings?.streamOutput ?? assistant?.streamOutput;
    const streamOutput = streamOutputValue !== false;

    console.log(`[GeminiProvider] getAssistantSettings:`, {
      'assistant.settings.streamOutput': assistant?.settings?.streamOutput,
      'assistant.streamOutput': assistant?.streamOutput,
      'streamOutputValue': streamOutputValue,
      'streamOutput (final)': streamOutput
    });

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
   * 处理 Gemini Function Calling
   * 
   * 将 Gemini 的 FunctionCall 转换为 MCP 工具调用格式，执行工具并返回结果
   */
  protected async processGeminiFunctionCalls(
    functionCalls: FunctionCall[],
    mcpTools: MCPTool[],
    onChunk?: (chunk: any) => void
  ): Promise<Content[]> {
    if (!functionCalls || functionCalls.length === 0) {
      return [];
    }

    console.log(`[Gemini] 处理 ${functionCalls.length} 个工具调用`);

    // 将 Gemini FunctionCall 转换为 MCP 工具响应格式
    const mcpToolResponses: GlobalMCPToolResponse[] = functionCalls.map((fc) => {
      const tool = mcpTools.find(t => {
        const toolName = (t.id || t.name).replace(/[^a-zA-Z0-9_.-]/g, '_');
        return toolName === fc.name || t.id === fc.name || t.name === fc.name;
      });
      
      const toolId = fc.id || `gemini_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      return {
        id: toolId,
        toolCallId: toolId,
        tool: tool!,
        arguments: fc.args || {},
        status: 'pending' as const
      };
    }).filter(r => r.tool);

    if (mcpToolResponses.length === 0) {
      console.warn(`[Gemini] 无法匹配任何工具调用`);
      return [];
    }

    // 调用工具并获取结果
    const results = await parseAndCallTools(
      mcpToolResponses,
      mcpTools,
      onChunk // 传递 onChunk 以发送工具执行状态事件
    );

    // 转换结果为 Gemini 格式的消息
    return results.map((result, index) => {
      const mcpResponse = mcpToolResponses[index];
      return {
        role: 'user',
        parts: [{
          functionResponse: {
            id: mcpResponse.toolCallId,
            name: mcpResponse.tool.id || mcpResponse.tool.name,
            response: {
              output: !result.isError ? result.content : undefined,
              error: result.isError ? result.content : undefined
            }
          }
        }]
      } as Content;
    });
  }



  /**
   * 核心completions方法 - 专注于聊天功能
   * 
   * ============= 流式/非流式输出链路 =============
   * while (iteration < maxIterations) {
   *   1. 发送消息，获取响应
   *   2. processStream 处理响应：
   *      - 发送 THINKING_COMPLETE (如有)
   *      - 发送 TEXT_COMPLETE
   *      - 收集 functionCalls
   *   3. 如果有 functionCalls：
   *      - processGeminiFunctionCalls 执行工具
   *      - 发送 MCP_TOOL_* 创建工具块
   *      - 将结果添加到 history
   *      - continue 下一轮
   *   4. 没有工具调用 → 发送 BLOCK_COMPLETE → break
   * }
   * 
   * ============= 关键设计 =============
   * - 所有 onChunk 调用都 await，避免竞态条件
   * - 工具调用前先发送文本块，保证块顺序
   * - 支持多轮工具调用循环（最多 5 轮）
   */
  public async completions({
    messages,
    assistant,
    mcpTools,
    mcpMode = 'function',  // 默认使用函数调用模式
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

    let systemInstruction = assistant.prompt || '';
    
    // 🔧 根据 mcpMode 决定使用哪种模式
    const usePromptMode = mcpMode === 'prompt';
    let tools: Tool[] = [];
    
    if (mcpTools && mcpTools.length > 0) {
      if (usePromptMode) {
        // 提示词注入模式：只注入系统提示词，不使用 Function Calling
        const mcpToolPrompt = getMCPSystemPrompt(mcpTools);
        if (mcpToolPrompt) {
          systemInstruction = systemInstruction + '\n\n' + mcpToolPrompt;
          console.log(`[GeminiProvider] 提示词模式：已注入 ${mcpTools.length} 个工具的提示词到系统提示词`);
        }
        // tools 保持为空数组
      } else {
        // 函数调用模式：使用 Function Calling API
        const toolsConfig = this.setupToolsConfig<Tool>({
          mcpTools,
          model,
          enableToolUse: true
        });
        tools = toolsConfig.tools;
        console.log(`[GeminiProvider] 函数调用模式：使用 ${tools.length} 个工具`);
      }
    }

    //  调试日志：显示系统提示词的最终处理结果
    console.log(`[GeminiProvider.completions] 系统提示词最终处理:`, {
      mcpMode,
      usePromptMode,
      mcpToolsCount: mcpTools?.length || 0,
      toolsCount: tools.length,
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
    // 返回 functionCalls 以支持多轮工具调用循环
    const processStream = async (
      stream: AsyncGenerator<GenerateContentResponse> | GenerateContentResponse,
      _idx: number
    ): Promise<{ functionCalls: FunctionCall[]; textContent: string }> => {
      let functionCalls: FunctionCall[] = [];
      let time_first_token_millsec = 0;
      const start_time_millsec = new Date().getTime();
      let finalTextContent = '';

      if (stream instanceof GenerateContentResponse) {
        // 非流式响应处理
        // 
        // ============= 非流式输出链路 =============
        // 1. 先收集所有 thinking 和 text 内容
        // 2. 按正确顺序发送：THINKING_COMPLETE → TEXT_COMPLETE → 工具块
        // 3. 有工具调用时先发送文本块，再处理工具
        // 4. 所有 onChunk 调用都 await，避免竞态条件

        const time_completion_millsec = new Date().getTime() - start_time_millsec;
        
        // 收集内容
        let thinkingContent = '';
        let textContent = '';
        
        console.log(`[Gemini processStream] 非流式响应 - candidates数量: ${stream.candidates?.length || 0}, stream.text长度: ${stream.text?.length || 0}`);
        
        stream.candidates?.forEach((candidate, candidateIdx) => {
          if (candidate.content) {
            history.push(candidate.content);
            console.log(`[Gemini processStream] candidate[${candidateIdx}] parts数量: ${candidate.content.parts?.length || 0}`);
            candidate.content.parts?.forEach((part, partIdx) => {
              console.log(`[Gemini processStream] part[${partIdx}]:`, {
                hasText: !!part.text,
                textLength: part.text?.length || 0,
                thought: part.thought,
                hasFunctionCall: !!part.functionCall
              });
              if (part.functionCall) {
                functionCalls.push(part.functionCall);
              }
              if (part.thought && part.text) {
                thinkingContent += part.text;
              } else if (part.text) {
                textContent += part.text;
              }
            });
          }
        });
        
        // 使用 stream.text 作为后备（如果 parts 没有提取到文本）
        if (!textContent && stream.text?.length) {
          console.log(`[Gemini processStream] 使用 stream.text 作为后备文本`);
          textContent = stream.text;
        }
        
        finalTextContent = textContent;
        
        console.log(`[Gemini processStream] 最终内容 - thinking: ${thinkingContent.length}字符, text: ${textContent.length}字符`);
        
        // 按正确顺序发送：先 thinking，后 text
        if (thinkingContent) {
          console.log(`[Gemini processStream] 发送 THINKING_COMPLETE`);
          await onChunk({ type: ChunkType.THINKING_COMPLETE, text: thinkingContent, thinking_millsec: time_completion_millsec });
        }
        
        // 有工具调用时也要发送文本块（在工具块之前）
        if (textContent) {
          console.log(`[Gemini processStream] 发送 TEXT_COMPLETE`);
          await onChunk({ type: ChunkType.TEXT_COMPLETE, text: textContent });
        } else {
          console.log(`[Gemini processStream] 没有文本内容，跳过 TEXT_COMPLETE`);
        }

        // 只有在没有工具调用时才发送 BLOCK_COMPLETE
        if (functionCalls.length === 0) {
          await onChunk({
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
        }
      } else {
        // 流式响应处理
        // 
        // ============= 流式输出链路 =============
        // 1. 遍历 chunks，累积 thinking 和 text
        // 2. 遇到 text 且有 thinking 时，先发送 THINKING_COMPLETE
        // 3. 所有 onChunk 调用都 await，避免竞态条件

        let content = '';
        let thinkingContent = '';
        let chunkIndex = 0;

        for await (const chunk of stream) {
          chunkIndex++;
          
          // 检查中断信号
          if (abortController.signal.aborted) {
            console.log('[GeminiProvider] 流式响应被用户中断');
            break;
          }

          if (time_first_token_millsec == 0) {
            time_first_token_millsec = new Date().getTime();
          }

          const partsCount = chunk.candidates?.[0]?.content?.parts?.length || 0;
          console.log(`[Gemini 流式] chunk[${chunkIndex}] - parts数量: ${partsCount}, finishReason: ${chunk.candidates?.[0]?.finishReason || 'none'}`);

          if (chunk.candidates?.[0]?.content?.parts && chunk.candidates[0].content.parts.length > 0) {
            const parts = chunk.candidates[0].content.parts;
            for (const part of parts) {
              console.log(`[Gemini 流式] part - thought: ${part.thought}, hasText: ${!!part.text}, textLen: ${part.text?.length || 0}`);
              
              if (!part.text) continue;

              if (part.thought) {
                // 思考过程
                if (time_first_token_millsec === 0) {
                  time_first_token_millsec = new Date().getTime();
                }
                thinkingContent += part.text;
                await onChunk({ type: ChunkType.THINKING_DELTA, text: part.text || '' });
              } else {
                // 正常内容
                if (time_first_token_millsec == 0) {
                  time_first_token_millsec = new Date().getTime();
                }

                // 当遇到正常文本且有思考内容时，发送 THINKING_COMPLETE
                if (thinkingContent) {
                  console.log(`[Gemini 流式] 发送 THINKING_COMPLETE (${thinkingContent.length}字符)`);
                  await onChunk({
                    type: ChunkType.THINKING_COMPLETE,
                    text: thinkingContent,
                    thinking_millsec: new Date().getTime() - time_first_token_millsec
                  });
                  thinkingContent = ''; // 清空思维内容
                }

                content += part.text;
                await onChunk({ type: ChunkType.TEXT_DELTA, text: part.text });
              }
            }
          }

          if (chunk.candidates?.[0]?.finishReason) {
            console.log(`[Gemini 流式] 完成 - content长度: ${content.length}, thinkingContent长度: ${thinkingContent.length}`);
            
            // 🔧 修复：如果只有思考内容没有普通文本，把思考内容作为普通文本发送
            if (!content && thinkingContent) {
              console.log(`[Gemini 流式] 只有思考内容，作为普通文本发送`);
              content = thinkingContent;
              thinkingContent = '';
            }
            
            if (content) {
              console.log(`[Gemini 流式] 发送 TEXT_COMPLETE (${content.length}字符)`);
              await onChunk({ type: ChunkType.TEXT_COMPLETE, text: content });
            }
            if (chunk.usageMetadata) {
              finalUsage.prompt_tokens += chunk.usageMetadata.promptTokenCount || 0;
              finalUsage.completion_tokens += chunk.usageMetadata.candidatesTokenCount || 0;
              finalUsage.total_tokens += chunk.usageMetadata.totalTokenCount || 0;
            }
            if (chunk.candidates?.[0]?.groundingMetadata) {
              const groundingMetadata = chunk.candidates?.[0]?.groundingMetadata;
              await onChunk({
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

        finalTextContent = content;

        // 只有在没有工具调用时才发送 BLOCK_COMPLETE
        if (functionCalls.length === 0) {
          await onChunk({
            type: ChunkType.BLOCK_COMPLETE,
            response: {
              usage: finalUsage,
              metrics: finalMetrics
            }
          });
        }
      }

      return { functionCalls, textContent: finalTextContent };
    };

    // ============= 多轮工具调用循环 =============
    // 类似 OpenAI provider 的设计：
    // 1. 发送消息，获取响应
    // 2. 如果有工具调用，执行工具，将结果添加到 history
    // 3. 重复直到没有工具调用
    
    const maxIterations = 5;
    let iteration = 0;
    let currentMessage = messageContents;

    try {
      await onChunk({ type: ChunkType.LLM_RESPONSE_CREATED });

      while (iteration < maxIterations) {
        iteration++;
        console.log(`[Gemini] 第 ${iteration} 轮迭代`);

        let response;
        if (!streamOutput) {
          // 非流式
          response = await withRetry(
            () => chat.sendMessage({
              message: currentMessage as PartUnion,
              config: {
                ...generateContentConfig,
                abortSignal: abortController.signal
              }
            }),
            'Gemini Non-Stream Request'
          );
        } else {
          // 流式
          response = await withRetry(
            () => chat.sendMessageStream({
              message: currentMessage as PartUnion,
              config: {
                ...generateContentConfig,
                abortSignal: abortController.signal
              }
            }),
            'Gemini Stream Request'
          );
        }

        // 处理响应
        const { functionCalls, textContent } = await processStream(response, iteration - 1);

        // 如果有工具调用，处理它们
        if (functionCalls.length > 0 && mcpTools.length > 0) {
          console.log(`[Gemini] 第 ${iteration} 轮检测到 ${functionCalls.length} 个工具调用`);
          
          // 执行工具调用
          const toolResults = await this.processGeminiFunctionCalls(functionCalls, mcpTools, onChunk);
          
          if (toolResults.length > 0) {
            // 将工具结果添加到历史
            history.push(...toolResults);
            
            // 准备下一轮的消息（空消息，让模型继续）
            currentMessage = { role: 'user', parts: [{ text: '请根据工具执行结果继续回答。' }] } as Content;
            
            continue; // 继续下一轮
          }
        }

        // 没有工具调用，发送 BLOCK_COMPLETE 并结束
        await onChunk({
          type: ChunkType.BLOCK_COMPLETE,
          response: {
            text: textContent,
            usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
            metrics: { completion_tokens: 0, time_completion_millsec: 0, time_first_token_millsec: 0 }
          }
        });
        break;
      }
    } finally {
      cleanup();
    }
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
   * 
   * 🔧 修复：直接调用 completions 方法，复用工具处理逻辑
   */
  public async sendChatMessage(
    messages: Message[],
    options?: {
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
    // 🔧 修复：正确处理 streamOutput 设置
    // 从传入的 assistant 中读取，支持多种位置
    const inputAssistant = options?.assistant;
    const streamOutputSetting = inputAssistant?.settings?.streamOutput ?? inputAssistant?.streamOutput;
    const streamOutput = streamOutputSetting !== false;
    
    console.log(`[GeminiProvider.sendChatMessage] streamOutput 检测:`, {
      'inputAssistant?.settings?.streamOutput': inputAssistant?.settings?.streamOutput,
      'inputAssistant?.streamOutput': inputAssistant?.streamOutput,
      'streamOutputSetting': streamOutputSetting,
      'streamOutput (final)': streamOutput
    });
    
    // 构建 assistant 对象
    const assistant = inputAssistant ? {
      ...inputAssistant,
      settings: {
        ...inputAssistant.settings,
        streamOutput: streamOutput  // 确保 streamOutput 正确设置
      }
    } : {
      model: this.model,
      prompt: options?.systemPrompt || '',
      settings: {
        streamOutput: streamOutput
      },
      enableWebSearch: options?.enableWebSearch || false,
      enableGenerateImage: false
    };

    // 如果有传入的 assistant 但没有 prompt，使用 systemPrompt
    if (inputAssistant && options?.systemPrompt && !inputAssistant.prompt) {
      assistant.prompt = options.systemPrompt;
    }

    console.log(`[GeminiProvider.sendChatMessage] 调用 completions - mcpTools: ${options?.mcpTools?.length || 0}, mcpMode: ${options?.mcpMode || 'function'}, streamOutput: ${streamOutput}`);

    // 收集响应内容
    let content = '';
    let reasoning = '';
    let reasoningTime = 0;

    // 🔧 修复：直接调用 completions 方法，复用所有工具处理逻辑
    await this.completions({
      messages,
      assistant,
      mcpTools: options?.mcpTools || [],
      mcpMode: options?.mcpMode || 'function',
      onChunk: (chunk: any) => {
        // 转发 chunk 并收集内容
        if (chunk.type === ChunkType.TEXT_DELTA) {
          content += chunk.text || '';
        } else if (chunk.type === ChunkType.TEXT_COMPLETE) {
          content = chunk.text || content;
        } else if (chunk.type === ChunkType.THINKING_DELTA) {
          reasoning += chunk.text || '';
        } else if (chunk.type === ChunkType.THINKING_COMPLETE) {
          reasoning = chunk.text || reasoning;
          reasoningTime = chunk.thinking_millsec || 0;
        }
        
        // 转发给外部 onChunk
        options?.onChunk?.(chunk);
      },
      onFilterMessages: () => {}
    });

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
