/**
 * OpenAI API 参数管理器
 * 统一管理所有 OpenAI API 参数的获取、验证和配置
 */

import type { Model } from '../../types';
import {
  isReasoningModel,
  isOpenAIReasoningModel,
  isClaudeReasoningModel,
  isGeminiReasoningModel,
  isQwenReasoningModel,
  isGrokReasoningModel,
  isDeepSeekReasoningModel
} from '../../utils/modelDetection';
import {
  EFFORT_RATIO,
  DEFAULT_MAX_TOKENS,
  findTokenLimit
} from '../../config/constants';
import { getDefaultThinkingEffort, getAppSettings } from '../../utils/settingsUtils';

/**
 * 参数配置接口
 */
export interface ParameterConfig {
  assistant?: any;
  model: Model;
  enableWebSearch?: boolean;
  enableTools?: boolean;
}

/**
 * 基础参数接口
 */
export interface BaseParameters {
  temperature: number;
  top_p: number;
  max_tokens: number;
  stream: boolean;
}

/**
 * OpenAI 专属参数接口
 */
export interface OpenAISpecificParameters {
  frequency_penalty?: number;
  presence_penalty?: number;
  top_k?: number;
  seed?: number;
  stop?: string[];
  logit_bias?: Record<string, number>;
  response_format?: { type: string };
  tool_choice?: string;
  parallel_tool_calls?: boolean;
}

/**
 * 推理参数接口 - Chat Completions API 格式
 */
export interface ReasoningParameters {
  reasoning_effort?: string;
  enable_thinking?: boolean;
  thinking_budget?: number;
  thinking?: {
    type: string;
    budget_tokens?: number;
  };
}

/**
 * Responses API 推理参数接口
 */
export interface ResponsesAPIReasoningParameters {
  reasoning?: {
    effort?: string;
    summary?: 'auto' | 'concise' | 'detailed';
  };
  reasoning_effort?: string;
  enable_thinking?: boolean;
  thinking_budget?: number;
  thinking?: {
    type: string;
    budget_tokens?: number;
  };
}

/**
 * 完整的 API 参数接口
 */
export interface CompleteAPIParameters extends BaseParameters, OpenAISpecificParameters, ReasoningParameters {
  model: string;
  messages: any[];
  tools?: any[];
  signal?: AbortSignal;
}

/**
 * OpenAI API 参数管理器类
 */
export class OpenAIParameterManager {
  private model: Model;
  private assistant?: any;

  constructor(config: ParameterConfig) {
    this.model = config.model;
    this.assistant = config.assistant;
  }

  /**
   * 获取基础参数
   */
  public getBaseParameters(): BaseParameters {
    const baseParams: BaseParameters = {
      temperature: this.getTemperature(),
      top_p: this.getTopP(),
      max_tokens: this.getMaxTokens(),
      stream: this.getStreamEnabled()
    };

    // 检查是否启用了最大输出Token参数
    const appSettings = getAppSettings();
    if (appSettings.enableMaxOutputTokens === false) {
      // 如果禁用了，从参数中移除max_tokens
      delete (baseParams as any).max_tokens;
      console.log(`[OpenAIParameterManager] 最大输出Token已禁用，从API参数中移除max_tokens`);
    }

    return baseParams;
  }

  /**
   * 获取 OpenAI 专属参数
   */
  public getOpenAISpecificParameters(): OpenAISpecificParameters {
    const params: OpenAISpecificParameters = {};

    // Frequency Penalty
    if (this.assistant?.frequencyPenalty !== undefined && this.assistant.frequencyPenalty !== 0) {
      params.frequency_penalty = this.assistant.frequencyPenalty;
    }

    // Presence Penalty
    if (this.assistant?.presencePenalty !== undefined && this.assistant.presencePenalty !== 0) {
      params.presence_penalty = this.assistant.presencePenalty;
    }

    // Top-K (某些OpenAI兼容API支持)
    if (this.assistant?.topK !== undefined && this.assistant.topK !== 40) {
      params.top_k = this.assistant.topK;
    }

    // Seed
    if (this.assistant?.seed !== undefined && this.assistant.seed !== null) {
      params.seed = this.assistant.seed;
    }

    // Stop Sequences
    if (this.assistant?.stopSequences && Array.isArray(this.assistant.stopSequences) && this.assistant.stopSequences.length > 0) {
      params.stop = this.assistant.stopSequences;
    }

    // Logit Bias
    if (this.assistant?.logitBias && Object.keys(this.assistant.logitBias).length > 0) {
      params.logit_bias = this.assistant.logitBias;
    }

    // Response Format
    if (this.assistant?.responseFormat && this.assistant.responseFormat !== 'text') {
      params.response_format = { type: this.assistant.responseFormat };
    }

    // Tool Choice
    if (this.assistant?.toolChoice && this.assistant.toolChoice !== 'auto') {
      params.tool_choice = this.assistant.toolChoice;
    }

    // Parallel Tool Calls
    if (this.assistant?.parallelToolCalls !== undefined && this.assistant.parallelToolCalls !== true) {
      params.parallel_tool_calls = this.assistant.parallelToolCalls;
    }

    return params;
  }

  /**
   * 获取推理参数 - Chat Completions API 格式
   */
  public getReasoningParameters(): ReasoningParameters {
    // 如果模型不支持推理，返回空对象
    if (!isReasoningModel(this.model)) {
      return {};
    }

    // 获取推理努力程度 - 优先使用助手设置，否则使用全局默认设置
    const reasoningEffort = this.assistant?.settings?.reasoning_effort || getDefaultThinkingEffort();

    console.log(`[OpenAIParameterManager] 模型 ${this.model.id} 推理努力程度: ${reasoningEffort}`);

    // 如果明确禁用推理或设置为 'off'
    if (reasoningEffort === 'disabled' || reasoningEffort === 'none' || reasoningEffort === 'off') {
      return this.getDisabledReasoningParameters();
    }

    return this.getEnabledReasoningParameters(reasoningEffort);
  }

  /**
   * 获取 Responses API 格式的推理参数
   */
  public getResponsesAPIReasoningParameters(): ResponsesAPIReasoningParameters {
    // 如果模型不支持推理，返回空对象
    if (!isReasoningModel(this.model)) {
      return {};
    }

    // 获取推理努力程度 - 优先使用助手设置，否则使用全局默认设置
    const reasoningEffort = this.assistant?.settings?.reasoning_effort || getDefaultThinkingEffort();

    console.log(`[OpenAIParameterManager] Responses API 模型 ${this.model.id} 推理努力程度: ${reasoningEffort}`);

    // 如果明确禁用推理或设置为 'off'
    if (reasoningEffort === 'disabled' || reasoningEffort === 'none' || reasoningEffort === 'off') {
      return this.getDisabledResponsesAPIReasoningParameters();
    }

    return this.getEnabledResponsesAPIReasoningParameters(reasoningEffort);
  }

  /**
   * 获取完整的 API 参数
   */
  public getCompleteParameters(messages: any[], options?: {
    enableWebSearch?: boolean;
    enableTools?: boolean;
    tools?: any[];
    abortSignal?: AbortSignal;
  }): CompleteAPIParameters {
    const baseParams = this.getBaseParameters();
    const specificParams = this.getOpenAISpecificParameters();
    const reasoningParams = this.getReasoningParameters();

    const completeParams: CompleteAPIParameters = {
      model: this.model.id,
      messages,
      ...baseParams,
      ...specificParams,
      ...reasoningParams
    };

    // 添加工具参数
    if (options?.enableTools && options?.tools && options.tools.length > 0) {
      completeParams.tools = options.tools;
      completeParams.tool_choice = completeParams.tool_choice || 'auto';
    }

    // 添加中断信号
    if (options?.abortSignal) {
      completeParams.signal = options.abortSignal;
    }

    return completeParams;
  }

  /**
   * 获取温度参数
   */
  private getTemperature(): number {
    // 优先使用助手设置，然后是模型设置，最后是默认值
    const temperature = this.assistant?.settings?.temperature ?? 
                       this.assistant?.temperature ?? 
                       this.model.temperature ?? 
                       1.0;

    console.log(`[OpenAIParameterManager] temperature参数 - 助手设置: ${this.assistant?.settings?.temperature}, 助手直接设置: ${this.assistant?.temperature}, 模型设置: ${this.model.temperature}, 最终值: ${temperature}`);

    return temperature;
  }

  /**
   * 获取 top_p 参数
   */
  private getTopP(): number {
    // 优先使用助手设置，然后是模型设置，最后是默认值
    const topP = this.assistant?.settings?.topP ?? 
                 this.assistant?.topP ?? 
                 (this.model as any).top_p ?? 
                 1.0;

    console.log(`[OpenAIParameterManager] topP参数 - 助手设置: ${this.assistant?.settings?.topP}, 助手直接设置: ${this.assistant?.topP}, 模型设置: ${(this.model as any).top_p}, 最终值: ${topP}`);

    return topP;
  }

  /**
   * 获取 max_tokens 参数
   */
  private getMaxTokens(): number {
    // 优先使用助手设置，然后是模型设置，最后是默认值
    const maxTokens = this.assistant?.settings?.maxTokens ?? 
                     this.assistant?.maxTokens ?? 
                     this.model.maxTokens ?? 
                     4096;

    // 确保值在合理范围内（最小1，最大不限制，让API自己处理）
    const finalTokens = Math.max(maxTokens, 1);

    console.log(`[OpenAIParameterManager] maxTokens参数 - 助手设置: ${this.assistant?.settings?.maxTokens}, 助手直接设置: ${this.assistant?.maxTokens}, 模型设置: ${this.model.maxTokens}, 最终值: ${finalTokens}`);

    return finalTokens;
  }

  /**
   * 获取流式输出设置
   */
  private getStreamEnabled(): boolean {
    // 这里可以从设置中读取，暂时返回 true
    return true;
  }

  /**
   * 获取禁用推理的参数 - Chat Completions API 格式
   */
  private getDisabledReasoningParameters(): ReasoningParameters {
    // Qwen模型
    if (isQwenReasoningModel(this.model)) {
      return { enable_thinking: false };
    }

    // Claude模型
    if (isClaudeReasoningModel(this.model)) {
      return { thinking: { type: 'disabled' } };
    }

    // Gemini模型
    if (isGeminiReasoningModel(this.model)) {
      return { reasoning_effort: 'none' };
    }

    // DeepSeek、OpenAI、Grok模型：不支持禁用推理，返回空对象
    if (isDeepSeekReasoningModel(this.model) ||
        isOpenAIReasoningModel(this.model) ||
        isGrokReasoningModel(this.model)) {
      console.log(`[OpenAIParameterManager] ${this.model.id} 模型不支持禁用推理，跳过推理参数`);
      return {};
    }

    // 默认情况
    return {};
  }

  /**
   * 获取禁用推理的参数 - Responses API 格式
   */
  private getDisabledResponsesAPIReasoningParameters(): ResponsesAPIReasoningParameters {
    // Qwen模型
    if (isQwenReasoningModel(this.model)) {
      return { enable_thinking: false };
    }

    // Claude模型
    if (isClaudeReasoningModel(this.model)) {
      return { thinking: { type: 'disabled' } };
    }

    // OpenAI 推理模型：Responses API 不支持禁用推理
    if (isOpenAIReasoningModel(this.model)) {
      console.log(`[OpenAIParameterManager] Responses API ${this.model.id} 模型不支持禁用推理，跳过推理参数`);
      return {};
    }

    // 其他模型
    return {};
  }

  /**
   * 获取启用推理的参数 - Chat Completions API 格式
   */
  private getEnabledReasoningParameters(reasoningEffort: string): ReasoningParameters {
    // 计算推理token预算
    const effortRatio = EFFORT_RATIO[reasoningEffort as keyof typeof EFFORT_RATIO] || 0.3;
    const tokenLimit = findTokenLimit(this.model.id);

    // 如果找不到token限制，使用默认值
    if (!tokenLimit) {
      return this.getDefaultReasoningParameters(reasoningEffort);
    }

    const budgetTokens = Math.floor(
      (tokenLimit.max - tokenLimit.min) * effortRatio + tokenLimit.min
    );

    return this.getModelSpecificReasoningParameters(reasoningEffort, budgetTokens, effortRatio);
  }

  /**
   * 获取启用推理的参数 - Responses API 格式
   */
  private getEnabledResponsesAPIReasoningParameters(reasoningEffort: string): ResponsesAPIReasoningParameters {
    // 计算推理token预算
    const effortRatio = EFFORT_RATIO[reasoningEffort as keyof typeof EFFORT_RATIO] || 0.3;
    const tokenLimit = findTokenLimit(this.model.id);

    // 如果找不到token限制，使用默认值
    if (!tokenLimit) {
      return this.getDefaultResponsesAPIReasoningParameters(reasoningEffort);
    }

    const budgetTokens = Math.floor(
      (tokenLimit.max - tokenLimit.min) * effortRatio + tokenLimit.min
    );

    return this.getModelSpecificResponsesAPIReasoningParameters(reasoningEffort, budgetTokens, effortRatio);
  }

  /**
   * 获取默认推理参数（当找不到token限制时）- Chat Completions API 格式
   */
  private getDefaultReasoningParameters(reasoningEffort: string): ReasoningParameters {
    // 对于DeepSeek模型，检查是否支持该推理努力程度
    if (isDeepSeekReasoningModel(this.model)) {
      const supportedEffort = reasoningEffort === 'medium' ? 'high' : reasoningEffort;
      if (supportedEffort === 'low' || supportedEffort === 'high') {
        return { reasoning_effort: supportedEffort };
      } else {
        console.log(`[OpenAIParameterManager] DeepSeek模型不支持推理努力程度 ${reasoningEffort}，跳过推理参数`);
        return {};
      }
    }

    return { reasoning_effort: reasoningEffort };
  }

  /**
   * 获取默认推理参数（当找不到token限制时）- Responses API 格式
   */
  private getDefaultResponsesAPIReasoningParameters(reasoningEffort: string): ResponsesAPIReasoningParameters {
    // OpenAI 推理模型使用 Responses API 格式
    if (isOpenAIReasoningModel(this.model)) {
      return {
        reasoning: {
          effort: reasoningEffort,
          summary: 'auto' // 默认使用自动摘要
        }
      };
    }

    // 对于其他模型，保持原有格式
    if (isDeepSeekReasoningModel(this.model)) {
      const supportedEffort = reasoningEffort === 'medium' ? 'high' : reasoningEffort;
      if (supportedEffort === 'low' || supportedEffort === 'high') {
        return { reasoning_effort: supportedEffort };
      } else {
        console.log(`[OpenAIParameterManager] DeepSeek模型不支持推理努力程度 ${reasoningEffort}，跳过推理参数`);
        return {};
      }
    }

    return { reasoning_effort: reasoningEffort };
  }

  /**
   * 获取特定模型的推理参数
   */
  private getModelSpecificReasoningParameters(
    reasoningEffort: string, 
    budgetTokens: number, 
    effortRatio: number
  ): ReasoningParameters {
    // OpenAI模型
    if (isOpenAIReasoningModel(this.model)) {
      return { reasoning_effort: reasoningEffort };
    }

    // DeepSeek推理模型
    if (isDeepSeekReasoningModel(this.model)) {
      const supportedEffort = reasoningEffort === 'medium' ? 'high' : reasoningEffort;
      if (supportedEffort === 'low' || supportedEffort === 'high') {
        return { reasoning_effort: supportedEffort };
      } else {
        console.log(`[OpenAIParameterManager] DeepSeek模型不支持推理努力程度 ${reasoningEffort}，跳过推理参数`);
        return {};
      }
    }

    // Qwen模型
    if (isQwenReasoningModel(this.model)) {
      return {
        enable_thinking: true,
        thinking_budget: budgetTokens
      };
    }

    // Grok模型
    if (isGrokReasoningModel(this.model)) {
      const supportedEffort = reasoningEffort === 'medium' ? 'high' : reasoningEffort;
      if (supportedEffort === 'low' || supportedEffort === 'high') {
        return { reasoning_effort: supportedEffort };
      } else {
        console.log(`[OpenAIParameterManager] Grok模型不支持推理努力程度 ${reasoningEffort}，跳过推理参数`);
        return {};
      }
    }

    // Gemini模型
    if (isGeminiReasoningModel(this.model)) {
      return { reasoning_effort: reasoningEffort };
    }

    // Claude模型
    if (isClaudeReasoningModel(this.model)) {
      const maxTokens = this.assistant?.settings?.maxTokens;
      return {
        thinking: {
          type: 'enabled',
          budget_tokens: Math.max(1024, Math.min(budgetTokens, (maxTokens || DEFAULT_MAX_TOKENS) * effortRatio))
        }
      };
    }

    // 默认情况
    return {};
  }

  /**
   * 获取特定模型的推理参数 - Responses API 格式
   */
  private getModelSpecificResponsesAPIReasoningParameters(
    reasoningEffort: string,
    budgetTokens: number,
    effortRatio: number
  ): ResponsesAPIReasoningParameters {
    // OpenAI模型 - 使用 Responses API 格式
    if (isOpenAIReasoningModel(this.model)) {
      return {
        reasoning: {
          effort: reasoningEffort,
          summary: 'auto' // 默认使用自动摘要
        }
      };
    }

    // DeepSeek推理模型
    if (isDeepSeekReasoningModel(this.model)) {
      const supportedEffort = reasoningEffort === 'medium' ? 'high' : reasoningEffort;
      if (supportedEffort === 'low' || supportedEffort === 'high') {
        return { reasoning_effort: supportedEffort };
      } else {
        console.log(`[OpenAIParameterManager] DeepSeek模型不支持推理努力程度 ${reasoningEffort}，跳过推理参数`);
        return {};
      }
    }

    // Qwen模型
    if (isQwenReasoningModel(this.model)) {
      return {
        enable_thinking: true,
        thinking_budget: budgetTokens
      };
    }

    // Claude模型
    if (isClaudeReasoningModel(this.model)) {
      const maxTokens = this.assistant?.settings?.maxTokens;
      return {
        thinking: {
          type: 'enabled',
          budget_tokens: Math.max(1024, Math.min(budgetTokens, (maxTokens || DEFAULT_MAX_TOKENS) * effortRatio))
        }
      };
    }

    // 默认情况
    return {};
  }

  /**
   * 验证参数有效性
   */
  public validateParameters(params: Partial<CompleteAPIParameters>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 验证温度参数
    if (params.temperature !== undefined && (params.temperature < 0 || params.temperature > 2)) {
      errors.push('Temperature must be between 0 and 2');
    }

    // 验证 top_p 参数
    if (params.top_p !== undefined && (params.top_p < 0 || params.top_p > 1)) {
      errors.push('top_p must be between 0 and 1');
    }

    // 验证 max_tokens 参数
    if (params.max_tokens !== undefined && params.max_tokens < 1) {
      errors.push('max_tokens must be greater than 0');
    }

    // 验证频率惩罚
    if (params.frequency_penalty !== undefined && (params.frequency_penalty < -2 || params.frequency_penalty > 2)) {
      errors.push('frequency_penalty must be between -2 and 2');
    }

    // 验证存在惩罚
    if (params.presence_penalty !== undefined && (params.presence_penalty < -2 || params.presence_penalty > 2)) {
      errors.push('presence_penalty must be between -2 and 2');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 更新助手配置
   */
  public updateAssistant(assistant: any): void {
    this.assistant = assistant;
  }

  /**
   * 更新模型配置
   */
  public updateModel(model: Model): void {
    this.model = model;
  }
}

/**
 * 创建参数管理器实例的工厂函数
 */
export function createParameterManager(config: ParameterConfig): OpenAIParameterManager {
  return new OpenAIParameterManager(config);
}

/**
 * 获取参数管理器的快捷函数
 */
export function getParameterManager(model: Model, assistant?: any): OpenAIParameterManager {
  return createParameterManager({ model, assistant });
}
