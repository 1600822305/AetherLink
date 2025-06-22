/**
 * AI SDK OpenAI Provider
 * 使用 @ai-sdk/openai 实现的 OpenAI 供应商，解决浏览器环境下的流式响应问题
 * 继承自 BaseOpenAIProvider，保持接口一致性
 */
import { BaseOpenAIProvider } from '../openai/provider';
import { createAISDKClient } from './client';
import { streamCompletionAISDK } from './stream';
import { getAppSettings } from '../../utils/settingsUtils';
import type { Model, Message } from '../../types';

/**
 * AI SDK OpenAI Provider 实现类
 * 使用 AI SDK 替代原生 OpenAI 库，专为浏览器环境优化
 */
export class OpenAIAISDKProvider extends BaseOpenAIProvider {
  private aiSdkClient: any;

  constructor(model: Model) {
    super(model);
    // 创建AI SDK客户端
    this.aiSdkClient = createAISDKClient(model);
    console.log(`[OpenAIAISDKProvider] 初始化完成，模型: ${model.id}`);
  }

  /**
   * 发送聊天消息 - 重写以使用AI SDK
   */
  public async sendChatMessage(
    messages: Message[],
    options?: {
      onUpdate?: (content: string, reasoning?: string) => void;
      onChunk?: (chunk: any) => void;
      enableWebSearch?: boolean;
      systemPrompt?: string;
      enableTools?: boolean;
      mcpTools?: import('../../types').MCPTool[];
      mcpMode?: 'prompt' | 'function';
      abortSignal?: AbortSignal;
      assistant?: any; // 添加助手参数以获取设置
    }
  ): Promise<string | { content: string; reasoning?: string; reasoningTime?: number }> {
    console.log(`[OpenAIAISDKProvider] 开始发送聊天消息，消息数量: ${messages.length}`);

    const startTime = Date.now();

    try {
      // 准备参数 - 从助手设置中获取参数
      const params: any = {
        messages,
        temperature: this.getTemperature(options?.assistant),
        enableReasoning: this.supportsReasoning(),
        model: this.model,
        signal: options?.abortSignal,
        enableTools: options?.enableTools,
        mcpTools: options?.mcpTools,
        mcpMode: options?.mcpMode
      };

      // 检查是否启用了最大输出Token参数
      const appSettings = getAppSettings();
      if (appSettings.enableMaxOutputTokens !== false) {
        params.max_tokens = this.getMaxTokens(options?.assistant);
      } else {
        console.log(`[OpenAIAISDKProvider] 最大输出Token已禁用，从API参数中移除max_tokens`);
      }

      // 处理系统提示词
      if (options?.systemPrompt) {
        params.messages = [
          { role: 'system', content: options.systemPrompt } as any,
          ...messages.filter(msg => msg.role !== 'system')
        ];
      }

      // 使用AI SDK流式处理
      const result = await streamCompletionAISDK(
        this.aiSdkClient,
        this.model.id,
        params.messages,
        params.temperature,
        params.max_tokens, // 如果禁用了会是undefined
        options?.onUpdate,
        params,
        options?.onChunk
      );

      const endTime = Date.now();
      const reasoningTime = endTime - startTime;

      console.log(`[OpenAIAISDKProvider] 聊天消息发送完成，耗时: ${reasoningTime}ms`);

      // 如果支持推理，返回带推理信息的结果
      if (this.supportsReasoning()) {
        return {
          content: result,
          reasoningTime
        };
      }

      return result;

    } catch (error: any) {
      console.error('[OpenAIAISDKProvider] 发送聊天消息失败:', error);
      throw error;
    }
  }

  /**
   * 获取温度参数
   * @param assistant 助手配置（可选）
   */
  protected getTemperature(assistant?: any): number {
    // 优先使用助手设置，然后是模型设置，最后是默认值
    const temperature = assistant?.settings?.temperature ?? assistant?.temperature ?? this.model.temperature ?? 1.0;

    console.log(`[OpenAIAISDKProvider] temperature参数 - 助手设置: ${assistant?.settings?.temperature}, 助手直接设置: ${assistant?.temperature}, 模型设置: ${this.model.temperature}, 最终值: ${temperature}`);

    return temperature;
  }

  /**
   * 获取最大令牌数
   * @param assistant 助手配置（可选）
   */
  protected getMaxTokens(assistant?: any): number {
    // 优先使用助手设置，然后是模型设置，最后是默认值
    const maxTokens = assistant?.settings?.maxTokens ?? assistant?.maxTokens ?? this.model.maxTokens ?? 2000;

    // 确保值在合理范围内（最小1）
    const finalTokens = Math.max(maxTokens, 1);

    console.log(`[OpenAIAISDKProvider] maxTokens参数 - 助手设置: ${assistant?.settings?.maxTokens}, 助手直接设置: ${assistant?.maxTokens}, 模型设置: ${this.model.maxTokens}, 最终值: ${finalTokens}`);

    return finalTokens;
  }

  /**
   * 检查模型是否支持推理优化
   */
  protected supportsReasoning(): boolean {
    // 检查是否为推理模型（如 DeepSeek、o1 系列等）
    const modelId = this.model.id.toLowerCase();
    return modelId.includes('deepseek') || 
           modelId.includes('o1') || 
           modelId.includes('reasoning') ||
           this.model.provider === 'deepseek';
  }

  /**
   * 检查模型是否支持多模态
   */
  protected supportsMultimodal(): boolean {
    const modelId = this.model.id.toLowerCase();
    return modelId.includes('gpt-4') && 
           (modelId.includes('vision') || modelId.includes('4o') || modelId.includes('4.1'));
  }

  /**
   * 检查模型是否支持网页搜索
   */
  protected supportsWebSearch(): boolean {
    // AI SDK 版本暂时不支持网页搜索，可以后续扩展
    return false;
  }

  /**
   * 获取客户端信息（用于调试）
   */
  public getClientInfo(): any {
    return {
      type: 'ai-sdk',
      model: this.model,
      supportsReasoning: this.supportsReasoning(),
      supportsMultimodal: this.supportsMultimodal(),
      supportsWebSearch: this.supportsWebSearch()
    };
  }
}
