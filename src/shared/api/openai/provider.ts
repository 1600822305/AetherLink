/**
 * OpenAI Provider
 * 负责与OpenAI API通信
 */
import OpenAI from 'openai';
import { createClient } from './client';
import { unifiedStreamCompletion } from './unifiedStreamProcessor';
import { OpenAIParameterManager, createParameterManager } from './parameterManager';
// import { createResponseHandler } from './responseHandler'; // 暂时注释，将来使用

import {
  supportsMultimodal,
  supportsWebSearch,
  getWebSearchParams
} from './client';

import {
  isReasoningModel
} from '../../utils/modelDetection';

import { getStreamOutputSetting } from '../../utils/settingsUtils';
import { AbstractBaseProvider } from '../baseProvider';
import type { Message, Model, MCPTool, MCPToolResponse, MCPCallToolResponse } from '../../types';
import { ChunkType } from '../../types/chunk';
import { parseAndCallTools, parseToolUse, removeToolUseTags } from '../../utils/mcpToolParser';
import {
  convertMcpToolsToOpenAI,
  mcpToolCallResponseToOpenAIMessage,
  convertToolCallsToMcpResponses
} from './tools';



/**
 * 基础OpenAI Provider
 */
export abstract class BaseOpenAIProvider extends AbstractBaseProvider {
  protected client: OpenAI;
  protected parameterManager: OpenAIParameterManager;

  constructor(model: Model) {
    super(model);
    this.client = createClient(model);
    this.parameterManager = createParameterManager({ model });
  }

  /**
   * 将 MCP 工具转换为 OpenAI 工具格式
   */
  public convertMcpTools<T>(mcpTools: MCPTool[]): T[] {
    return convertMcpToolsToOpenAI<T>(mcpTools);
  }

  /**
   * 检查模型是否支持多模态
   * @param model 模型对象（可选）
   * @returns 是否支持多模态
   */
  protected supportsMultimodal(model?: Model): boolean {
    const actualModel = model || this.model;
    return supportsMultimodal(actualModel);
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
    // 使用导入的模型检测函数
    return isReasoningModel(this.model);
  }

  /**
   * 获取温度参数
   * @param assistant 助手配置（可选）
   */
  protected getTemperature(assistant?: any): number {
    this.parameterManager.updateAssistant(assistant);
    return this.parameterManager.getBaseParameters().temperature;
  }

  /**
   * 获取top_p参数
   * @param assistant 助手配置（可选）
   */
  protected getTopP(assistant?: any): number {
    this.parameterManager.updateAssistant(assistant);
    return this.parameterManager.getBaseParameters().top_p;
  }

  /**
   * 获取max_tokens参数
   * @param assistant 助手配置（可选）
   */
  protected getMaxTokens(assistant?: any): number {
    this.parameterManager.updateAssistant(assistant);
    return this.parameterManager.getBaseParameters().max_tokens;
  }

  /**
   * 获取OpenAI专属参数
   * @param assistant 助手配置（可选）
   */
  protected getOpenAISpecificParameters(assistant?: any): any {
    this.parameterManager.updateAssistant(assistant);
    return this.parameterManager.getOpenAISpecificParameters();
  }

  /**
   * 获取推理优化参数 - 使用参数管理器 (Chat Completions API 格式)
   * 根据模型类型和助手设置返回不同的推理参数
   * @param assistant 助手对象
   * @param model 模型对象
   * @returns 推理参数
   */
  protected getReasoningEffort(assistant?: any, model?: Model): any {
    // 如果传入了不同的模型，更新参数管理器
    if (model && model !== this.model) {
      this.parameterManager.updateModel(model);
    }

    this.parameterManager.updateAssistant(assistant);
    return this.parameterManager.getReasoningParameters();
  }

  /**
   * 获取 Responses API 格式的推理参数
   * @param assistant 助手对象
   * @param model 模型对象
   * @returns Responses API 格式的推理参数
   */
  protected getResponsesAPIReasoningEffort(assistant?: any, model?: Model): any {
    // 如果传入了不同的模型，更新参数管理器
    if (model && model !== this.model) {
      this.parameterManager.updateModel(model);
    }

    this.parameterManager.updateAssistant(assistant);
    return this.parameterManager.getResponsesAPIReasoningParameters();
  }



  /**
   * 构建系统提示
   * 智能版本：根据模式自动注入 MCP 工具信息
   * @param prompt 系统提示词
   * @param mcpTools MCP 工具列表
   * @returns 构建后的系统提示
   */
  protected buildSystemPrompt(prompt: string, mcpTools?: MCPTool[]): string {
    return this.buildSystemPromptWithTools(prompt, mcpTools);
  }

  /**
   * 准备API消息格式
   * 将业务消息转换为API格式
   */
  protected prepareAPIMessages(messages: Message[], systemPrompt?: string, mcpTools?: MCPTool[]): any[] {
    const apiMessages = [];

    // 添加系统提示
    const finalSystemPrompt = this.buildSystemPrompt(systemPrompt || '', mcpTools);
    if (finalSystemPrompt.trim()) {
      apiMessages.push({
        role: 'system',
        content: finalSystemPrompt
      });
    }

    // 处理用户和助手消息
    for (const message of messages) {
      try {
        const content = (message as any).content;
        if (content !== undefined) {
          apiMessages.push({
            role: message.role,
            content: content
          });
        }
      } catch (error) {
        console.error(`[OpenAIProvider] 处理消息失败:`, error);
        // 降级处理
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
   * 测试API连接
   */
  public async testConnection(): Promise<boolean> {
    try {
      // 使用参数管理器获取基础参数进行连接测试
      const baseParams = this.parameterManager.getBaseParameters();

      const response = await this.client.chat.completions.create({
        model: this.model.id,
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 5,
        temperature: baseParams.temperature,
        stream: false
      });
      return Boolean(response.choices[0].message);
    } catch (error) {
      console.error('API连接测试失败:', error);
      return false;
    }
  }

  /**
   * 将 MCP 工具调用响应转换为消息格式
   */
  public mcpToolCallResponseToMessage(
    mcpToolResponse: MCPToolResponse,
    resp: MCPCallToolResponse,
    model: Model
  ): any {
    return mcpToolCallResponseToOpenAIMessage(mcpToolResponse, resp, model);
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
   * 处理工具调用
   */
  protected async processToolCalls(
    toolCalls: any[],
    mcpTools: MCPTool[]
  ): Promise<any[]> {
    if (!toolCalls || toolCalls.length === 0) {
      return [];
    }

    console.log(`[OpenAI] 处理 ${toolCalls.length} 个工具调用`);

    const mcpToolResponses = this.convertToolCallsToMcpResponses(toolCalls, mcpTools);

    const results = await parseAndCallTools(
      mcpToolResponses,
      mcpTools
    );

    return results.map((result, index) =>
      this.mcpToolCallResponseToMessage(mcpToolResponses[index], result, this.model)
    ).filter(Boolean);
  }

  /**
   * 处理工具使用（XML 格式）
   */
  protected async processToolUses(
    content: string,
    mcpTools: MCPTool[],
    onChunk?: (chunk: import('../../types/chunk').Chunk) => void
  ): Promise<any[]> {
    if (!content || !mcpTools || mcpTools.length === 0) {
      console.log(`[OpenAI] processToolUses 跳过 - 内容: ${!!content}, 工具数量: ${mcpTools?.length || 0}`);
      return [];
    }

    console.log(`[OpenAI] 检查 XML 格式的工具使用 - 工具数量: ${mcpTools.length}`);
    console.log(`[OpenAI] 可用工具列表:`, mcpTools.map(t => ({ id: t.id, name: t.name })));

    // 从内容中解析工具响应
    const toolResponses = parseToolUse(content, mcpTools);
    console.log(`[OpenAI] 解析到的工具响应数量: ${toolResponses.length}`);

    if (toolResponses.length === 0) {
      console.warn(`[OpenAI] 未检测到工具调用，内容包含工具标签但解析失败`);
      return [];
    }

    const results = await parseAndCallTools(
      content,
      mcpTools,
      undefined, // onUpdate 回调
      onChunk    // onChunk 回调 - 传递给工具调用处理
    );

    console.log(`[OpenAI] 工具调用结果数量: ${results.length}`);

    // 安全地处理工具调用结果，避免索引越界
    const toolMessages = [];
    const maxIndex = Math.min(results.length, toolResponses.length);

    for (let i = 0; i < maxIndex; i++) {
      try {
        const toolMessage = this.mcpToolCallResponseToMessage(toolResponses[i], results[i], this.model);
        if (toolMessage) {
          toolMessages.push(toolMessage);
        }
      } catch (error) {
        console.warn(`[OpenAI] 处理工具调用结果 ${i} 失败:`, error);
      }
    }

    return toolMessages;
  }

  /**
   * 抽象方法：发送聊天消息
   */
  public abstract sendChatMessage(
    messages: Message[],
    options?: {
      onUpdate?: (content: string, reasoning?: string) => void;
      enableWebSearch?: boolean;
      systemPrompt?: string;
      enableTools?: boolean; // 添加工具开关参数
      mcpTools?: import('../../types').MCPTool[]; // 添加 MCP 工具参数
      mcpMode?: 'prompt' | 'function'; // 添加 MCP 模式参数
      abortSignal?: AbortSignal;
      assistant?: any; // 添加助手参数以获取设置
    }
  ): Promise<string | { content: string; reasoning?: string; reasoningTime?: number }>;
}

/**
 * OpenAI Provider实现类
 */
export class OpenAIProvider extends BaseOpenAIProvider {
  constructor(model: Model) {
    super(model);
  }

  /**
   * 发送聊天消息 - 底层API调用
   * 专注于API调用，业务逻辑由chat.ts处理
   * @param messages 消息数组
   * @param options 选项
   * @returns 响应内容
   */
  public async sendChatMessage(
    messages: Message[],
    options?: {
      onUpdate?: (content: string, reasoning?: string) => void;
      onChunk?: (chunk: import('../../types/chunk').Chunk) => void;
      enableWebSearch?: boolean;
      systemPrompt?: string;
      enableTools?: boolean;
      mcpTools?: import('../../types').MCPTool[];
      mcpMode?: 'prompt' | 'function';
      abortSignal?: AbortSignal;
      assistant?: any;
    }
  ): Promise<string | { content: string; reasoning?: string; reasoningTime?: number }> {
    console.log(`[OpenAIProvider] 开始API调用, 模型: ${this.model.id}`);

    const {
      onUpdate,
      onChunk,
      enableWebSearch = false,
      systemPrompt = '',
      enableTools = true,
      mcpTools = [],
      mcpMode = 'function',
      abortSignal,
      assistant
    } = options || {};

    // 准备API消息格式
    const apiMessages = this.prepareAPIMessages(messages, systemPrompt, mcpTools);

    // 配置工具
    const { tools } = this.setupToolsConfig({
      mcpTools,
      model: this.model,
      enableToolUse: enableTools,
      mcpMode
    });

    // 构建请求参数 - 使用参数管理器统一管理
    const streamEnabled = getStreamOutputSetting();

    // 更新参数管理器的助手配置
    this.parameterManager.updateAssistant(assistant);

    // 获取完整的API参数
    const requestParams = this.parameterManager.getCompleteParameters(apiMessages, {
      enableWebSearch,
      enableTools,
      tools: tools.length > 0 ? tools : undefined,
      abortSignal
    });

    // 覆盖流式设置（从全局设置中读取）
    requestParams.stream = streamEnabled;

    // 验证参数有效性
    const validation = this.parameterManager.validateParameters(requestParams);
    if (!validation.valid) {
      console.error(`[OpenAIProvider] 参数验证失败:`, validation.errors);
      throw new Error(`参数验证失败: ${validation.errors.join(', ')}`);
    }

    // 添加调试日志显示使用的参数
    console.log(`[OpenAIProvider] API请求参数:`, {
      model: requestParams.model,
      temperature: requestParams.temperature,
      top_p: requestParams.top_p,
      max_tokens: requestParams.max_tokens,
      stream: requestParams.stream,
      工具数量: requestParams.tools?.length || 0,
      assistantInfo: assistant ? {
        id: assistant.id,
        name: assistant.name,
        temperature: assistant.temperature,
        topP: assistant.topP,
        maxTokens: assistant.maxTokens
      } : '无助手信息'
    });

    // 处理工具参数 - 在提示词模式下移除 tools 参数避免冲突
    if (this.getUseSystemPromptForTools()) {
      delete requestParams.tools;
      delete requestParams.tool_choice;
      console.log(`[OpenAIProvider] 提示词模式：移除 API 中的 tools 参数`);
    } else if (enableTools && tools.length > 0) {
      console.log(`[OpenAIProvider] 函数调用模式：使用 ${tools.length} 个 MCP 工具`);
    } else {
      console.log(`[OpenAIProvider] 不使用工具 - 模式: ${this.getUseSystemPromptForTools() ? '提示词' : '函数调用'}, 工具数量: ${tools.length}, 启用: ${enableTools}`);
    }

    // 检查API密钥和基础URL是否设置
    if (!this.model.apiKey) {
      console.error('[OpenAIProvider.sendChatMessage] 错误: API密钥未设置');
      throw new Error('API密钥未设置，请在设置中配置OpenAI API密钥');
    }

    if (!this.model.baseUrl) {
      console.warn('[OpenAIProvider.sendChatMessage] 警告: 基础URL未设置，使用默认值');
    }

    // 添加网页搜索参数
    if (enableWebSearch && this.supportsWebSearch()) {
      Object.assign(requestParams, getWebSearchParams(this.model, enableWebSearch));
    }

    try {
      // 根据流式输出设置选择响应处理方式
      if (streamEnabled) {
        // 使用流式响应处理
        if (onUpdate) {
          return await this.handleStreamResponse(requestParams, onUpdate, enableTools, mcpTools, abortSignal, onChunk);
        } else {
          return await this.handleStreamResponseWithoutCallback(requestParams, enableTools, mcpTools, abortSignal, onChunk);
        }
      } else {
        // 使用非流式响应处理
        return await this.handleNonStreamResponse(requestParams, onUpdate, onChunk, enableTools, mcpTools, abortSignal);
      }
    } catch (error: any) {
      // 检查是否为中断错误
      if (error?.name === 'AbortError' || error?.message?.includes('aborted')) {
        console.log('[OpenAIProvider.sendChatMessage] 请求被用户中断');
        throw new DOMException('Operation aborted', 'AbortError');
      }

      // 检查是否为参数错误，提供友好的错误信息
      if (error?.status === 400 && error?.message?.includes('max_tokens')) {
        const modelName = this.model.name || this.model.id;
        const currentMaxTokens = requestParams.max_tokens;
        console.error(`[OpenAIProvider] ${modelName} 模型的 max_tokens 参数超出限制: ${currentMaxTokens}`);
        throw new Error(`模型 ${modelName} 不支持当前的最大输出token设置 (${currentMaxTokens})。请在模型设置中降低最大输出token数量。`);
      }

      console.error('[OpenAIProvider.sendChatMessage] API请求失败:', error);
      throw error;
    }
  }



  /**
   * 处理流式响应
   * @param params 请求参数
   * @param onUpdate 更新回调
   * @param enableTools 是否启用工具
   * @param mcpTools MCP 工具列表
   * @param abortSignal 中断信号
   * @returns 响应内容
   */
  private async handleStreamResponse(
    params: any,
    onUpdate: (content: string, reasoning?: string) => void,
    enableTools: boolean = true,
    mcpTools: import('../../types').MCPTool[] = [],
    abortSignal?: AbortSignal,
    onChunk?: (chunk: import('../../types/chunk').Chunk) => void
  ): Promise<string | { content: string; reasoning?: string; reasoningTime?: number }> {

    // 工具调用循环处理（类似非流式响应）
    let currentMessages = [...params.messages];
    let iteration = 0;
    let accumulatedContent = ''; // 累积的内容

    while (true) {
      iteration++;
      console.log(`[OpenAIProvider] 流式工具调用迭代 ${iteration}`);

      // 创建当前迭代的回调函数
      const enhancedCallback = (content: string, reasoning?: string) => {
        if (iteration === 1) {
          // 第一次迭代，直接使用内容
          accumulatedContent = content;
          onUpdate(content, reasoning);
        } else {
          // 后续迭代，添加分隔符并传递新增的内容
          const separator = accumulatedContent.trim() ? '\n\n' : '';
          const newContent = separator + content;
          accumulatedContent += newContent;
          onUpdate(newContent, reasoning); // 传递包含分隔符的新增内容
        }
      };

      // 准备请求参数，确保工具配置正确
      const iterationParams = {
        ...params,
        messages: currentMessages, // 使用当前消息
        signal: abortSignal
      };

      // 在提示词模式下，移除 tools 参数避免冲突
      if (this.getUseSystemPromptForTools()) {
        delete iterationParams.tools;
        delete iterationParams.tool_choice;
        console.log(`[OpenAIProvider] 提示词模式：移除 API 中的 tools 参数`);
      }

      //  智能选择处理方式：
      // 1. 如果有 onChunk 回调，说明是普通消息处理，使用 OpenAIStreamProcessor 分离思考标签
      // 2. 如果只有 onUpdate 回调，说明可能是组合模型调用，使用 streamCompletion 保持推理内容
      let result;
      //  关键修复：确保工具参数传递给 streamCompletion
      const streamParams = {
        ...iterationParams,
        enableTools,
        mcpTools
      };

      // 统一使用 unifiedStreamCompletion 处理流式响应
      result = await unifiedStreamCompletion(
        this.client,
        this.model.id,
        currentMessages,
        params.temperature,
        params.max_tokens || params.max_completion_tokens,
        enhancedCallback,
        streamParams,
        onChunk
      );



      console.log(`[OpenAIProvider] 流式响应结果类型: ${typeof result}, hasToolCalls: ${typeof result === 'object' && (result as any)?.hasToolCalls}`);

      // 检查是否有工具调用标记
      if (typeof result === 'object' && (result as any).hasToolCalls) {
        console.log(`[OpenAIProvider] 流式响应检测到工具调用`);

        const content = result.content;

        // 处理工具调用
        const xmlToolResults = await this.processToolUses(content, mcpTools, onChunk);

        if (xmlToolResults.length > 0) {
          //  修复：保留 XML 标签，让 MainTextBlock 在原位置渲染工具块
          // 但是对话历史中需要清理后的内容，避免重复处理
          const cleanContent = removeToolUseTags(content);
          console.log(`[OpenAIProvider] 流式：对话历史使用清理后的内容，长度: ${cleanContent.length}`);

          // 添加助手消息到对话历史（使用清理后的内容）
          currentMessages.push({
            role: 'assistant',
            content: cleanContent
          });

          // 添加工具结果到对话历史
          currentMessages.push(...xmlToolResults);

          console.log(`[OpenAIProvider] 流式工具调用完成，继续下一轮对话`);
          continue; // 继续下一轮对话
        }
      }

      // 没有工具调用或工具调用处理完成，返回结果
      return result;
    }

    // 正常情况下不会到达这里，因为循环中会有return语句
    throw new Error('工具调用处理异常');
  }

  /**
   * 处理流式响应（无回调）
   * 使用流式响应但不使用回调，结果会在完成后一次性返回
   * 这与最佳实例的行为一致
   * @param params 请求参数
   * @param enableTools 是否启用工具
   * @param mcpTools MCP 工具列表
   * @param abortSignal 中断信号
   * @returns 响应内容
   */
  private async handleStreamResponseWithoutCallback(
    params: any,
    _enableTools: boolean = true,
    mcpTools: import('../../types').MCPTool[] = [],
    abortSignal?: AbortSignal,
    onChunk?: (chunk: import('../../types/chunk').Chunk) => void
  ): Promise<string | { content: string; reasoning?: string; reasoningTime?: number }> {
    try {
      console.log('[OpenAIProvider.handleStreamResponseWithoutCallback] 开始处理流式响应（无回调）');

      // 工具调用循环处理
      let currentMessages = [...params.messages];
      let iteration = 0;
      let accumulatedContent = ''; // 累积的内容

      while (true) {
        iteration++;
        console.log(`[OpenAIProvider] 无回调流式工具调用迭代 ${iteration}`);

        // 创建一个虚拟回调函数，用于处理流式响应
        let fullResponse = '';
        let lastUpdateTime = Date.now();
        const updateInterval = 50; // 50毫秒更新一次，避免过于频繁的更新

        // 创建一个虚拟回调函数
        const virtualCallback = (content: string) => {
          // 只在内容有变化且距离上次更新超过指定时间间隔时才触发回调
          if (content !== fullResponse && (Date.now() - lastUpdateTime) > updateInterval) {
            // 处理内容累积
            if (iteration === 1) {
              // 第一次迭代，直接使用内容
              accumulatedContent = content;
              fullResponse = content;
            } else {
              // 后续迭代，添加分隔符并追加内容
              const separator = accumulatedContent.trim() ? '\n\n' : '';
              const newContent = separator + content;
              accumulatedContent += newContent;
              fullResponse = accumulatedContent;
            }

            // 更新最后更新时间
            lastUpdateTime = Date.now();

            // 这里我们可以添加其他处理逻辑，例如更新UI
            console.log(`[OpenAIProvider.virtualCallback] 更新内容，当前长度: ${fullResponse.length}`);
          }
        };

        // 准备请求参数，确保工具配置正确
        const iterationParams = {
          ...params,
          messages: currentMessages, // 使用当前消息
          signal: abortSignal
        };

        // 在提示词模式下，移除 tools 参数避免冲突
        if (this.getUseSystemPromptForTools()) {
          delete iterationParams.tools;
          delete iterationParams.tool_choice;
          console.log(`[OpenAIProvider] 无回调提示词模式：移除 API 中的 tools 参数`);
        }

        //  关键修复：确保工具参数传递给 streamCompletion
        const streamParams = {
          ...iterationParams,
          enableTools: _enableTools,
          mcpTools
        };

        // 统一使用 unifiedStreamCompletion 处理流式响应
        const result = await unifiedStreamCompletion(
          this.client,
          this.model.id,
          currentMessages,
          params.temperature,
          params.max_tokens || params.max_completion_tokens,
          virtualCallback,
          streamParams,
          onChunk
        );

        // 检查是否有工具调用标记
        if (typeof result === 'object' && (result as any).hasToolCalls) {
          console.log(`[OpenAIProvider] 无回调流式响应检测到工具调用`);

          const content = result.content;

          // 处理工具调用
          const xmlToolResults = await this.processToolUses(content, mcpTools, onChunk);

          if (xmlToolResults.length > 0) {
            //  关键修复：从内容中移除 XML 标签，与非流式响应保持一致
            const cleanContent = removeToolUseTags(content);
            console.log(`[OpenAIProvider] 无回调流式：移除工具使用标签后的内容长度: ${cleanContent.length}`);

            // 添加助手消息到对话历史（使用清理后的内容）
            currentMessages.push({
              role: 'assistant',
              content: cleanContent
            });

            // 添加工具结果到对话历史
            currentMessages.push(...xmlToolResults);

            console.log(`[OpenAIProvider] 无回调流式工具调用完成，继续下一轮对话`);
            continue; // 继续下一轮对话
          }
        }

        // 没有工具调用或工具调用处理完成，返回结果
        return result;
      }

      // 正常情况下不会到达这里，因为循环中会有return语句
      throw new Error('工具调用处理异常');
    } catch (error) {
      console.error('OpenAI API流式请求失败:', error);
      // 不使用logApiError，直接记录错误
      console.error('错误详情:', error);
      throw error;
    }
  }

  /**
   * 处理非流式响应
   * @param params 请求参数
   * @param onUpdate 更新回调（可选）
   * @param onChunk Chunk事件回调（可选）
   * @param enableTools 是否启用工具
   * @param mcpTools MCP 工具列表
   * @param abortSignal 中断信号
   * @returns 响应内容
   */
  private async handleNonStreamResponse(
    params: any,
    onUpdate?: (content: string, reasoning?: string) => void,
    onChunk?: (chunk: import('../../types/chunk').Chunk) => void,
    enableTools: boolean = true,
    mcpTools: import('../../types').MCPTool[] = [],
    abortSignal?: AbortSignal
  ): Promise<string | { content: string; reasoning?: string; reasoningTime?: number }> {
    try {
      console.log('[OpenAIProvider.handleNonStreamResponse] 开始处理非流式响应');

      // 工具调用循环处理
      let currentMessages = [...params.messages];
      let finalContent = '';
      let finalReasoning: string | undefined;
      let maxIterations = 5; // 防止无限循环
      let iteration = 0;

      while (iteration < maxIterations) {
        iteration++;
        console.log(`[OpenAIProvider] 非流式工具调用迭代 ${iteration}`);

        const currentRequestParams = {
          ...params,
          messages: currentMessages,
          stream: false, // 确保是非流式
          signal: abortSignal // 传递中断信号
        };

        // 调用非流式API
        const response = await this.client.chat.completions.create(currentRequestParams);

        console.log('[OpenAIProvider.handleNonStreamResponse] 收到非流式响应');

        // 提取响应内容
        const choice = response.choices?.[0];
        if (!choice) {
          throw new Error('API响应中没有选择项');
        }

        const content = choice.message?.content || '';
        // 对于推理模型，尝试从多个可能的字段中获取推理内容
        const reasoning = (choice.message as any)?.reasoning ||
                         (choice.message as any)?.reasoning_content ||
                         undefined;

        finalContent = content;
        finalReasoning = reasoning;

        // 检查是否有工具调用（函数调用模式）
        const toolCalls = choice.message?.tool_calls;
        let toolResults: any[] = [];

        if (toolCalls && toolCalls.length > 0 && enableTools && mcpTools.length > 0) {
          console.log(`[OpenAIProvider] 检测到 ${toolCalls.length} 个函数调用`);

          // 添加助手消息到对话历史
          currentMessages.push({
            role: 'assistant',
            content: content || '',
            tool_calls: toolCalls
          });

          // 处理工具调用
          toolResults = await this.processToolCalls(toolCalls, mcpTools);
        }

        // 检查是否有工具使用（提示词模式）
        if (content && content.length > 0 && enableTools && mcpTools.length > 0) {
          console.log(`[OpenAI] 检查工具使用 - 内容长度: ${content.length}, 工具数量: ${mcpTools.length}`);
          console.log(`[OpenAI] 内容预览: ${content.substring(0, 200)}...`);

          const xmlToolResults = await this.processToolUses(content, mcpTools, onChunk);
          console.log(`[OpenAI] XML 工具调用结果数量: ${xmlToolResults.length}`);

          toolResults = toolResults.concat(xmlToolResults);

          // 如果检测到工具调用，从内容中移除 XML 标签
          if (xmlToolResults.length > 0) {
            finalContent = removeToolUseTags(content);
            console.log(`[OpenAI] 移除工具使用标签后的内容长度: ${finalContent.length}`);
          }
        }

        // 如果有工具结果，添加到对话历史并继续
        if (toolResults.length > 0) {
          // 添加工具结果到对话历史
          currentMessages.push(...toolResults);

          console.log(`[OpenAIProvider] 工具调用完成，继续下一轮对话`);
          continue; // 继续下一轮对话
        } else {
          // 没有工具调用，结束循环
          break;
        }
      }

      // 参考最佳实例实现：优先使用 onChunk 回调，避免重复处理
      if (onChunk) {
        console.log(`[OpenAIProvider] 非流式：使用 onChunk 回调处理响应`);
        // 先发送完整的思考过程（如果有）
        if (finalReasoning && finalReasoning.trim()) {
          console.log(`[OpenAIProvider] 非流式：发送思考内容，长度: ${finalReasoning.length}`);
          // 发送思考完成事件（非流式时直接发送完整内容）
          onChunk({
            type: ChunkType.THINKING_COMPLETE,
            text: finalReasoning,
            thinking_millsec: 0
          });
        }
        // 再发送完整的普通文本（如果有）
        if (finalContent && finalContent.trim()) {
          console.log(`[OpenAIProvider] 非流式：发送普通文本，长度: ${finalContent.length}`);
          // 发送文本完成事件（非流式时直接发送完整内容）
          onChunk({
            type: ChunkType.TEXT_COMPLETE,
            text: finalContent
          });
        }
      } else if (onUpdate) {
        console.log(`[OpenAIProvider] 非流式：使用 onUpdate 回调处理响应（兼容模式）`);
        // 兼容旧的 onUpdate 回调
        if (finalReasoning && finalReasoning.trim()) {
          console.log(`[OpenAIProvider] 非流式：发送思考内容（兼容模式），长度: ${finalReasoning.length}`);
          onUpdate('', finalReasoning);
        }
        if (finalContent && finalContent.trim()) {
          console.log(`[OpenAIProvider] 非流式：发送普通文本（兼容模式），长度: ${finalContent.length}`);
          onUpdate(finalContent);
        }
      }

      // 返回结果
      if (finalReasoning) {
        return {
          content: finalContent,
          reasoning: finalReasoning,
          reasoningTime: 0 // 非流式响应没有推理时间
        };
      } else {
        return finalContent;
      }
    } catch (error) {
      console.error('[OpenAIProvider.handleNonStreamResponse] 非流式API请求失败:', error);
      throw error;
    }
  }
}
