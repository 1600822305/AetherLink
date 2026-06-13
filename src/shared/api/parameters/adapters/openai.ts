/**
 * OpenAI 参数适配器
 * 统一的参数管理，支持 Chat Completions API 和 Responses API
 */

import type { Model } from '../../../types';
import type {
  ParameterAdapter,
  ParameterManagerConfig,
  ResolvedParameters,
  UnifiedParameters,
  OpenAISpecificParameters
} from '../types';
import { UnifiedParameterManager } from '../UnifiedParameterManager';
import { isReasoningModel } from '../../../../config/models';
import { encodeReasoningParams, type ReasoningApiFlavor } from '../reasoning/encodeReasoning';
import { getDefaultThinkingEffort, getAppSettings } from '../../../utils/settingsUtils';
import { createLogger } from '../../../services/infra/logger';

const logger = createLogger('OpenAIParameterAdapter');


/**
 * Chat Completions API 推理参数接口
 */
export interface ReasoningParameters {
  reasoning_effort?: 'low' | 'medium' | 'high' | string;
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
 * 基础参数接口（API 格式）
 */
export interface BaseAPIParameters {
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stream?: boolean;
}

/**
 * 完整 API 参数接口
 */
export interface CompleteAPIParameters extends BaseAPIParameters, Omit<OpenAISpecificParameters, 'reasoning_effort'>, ReasoningParameters {
  model: string;
  messages: any[];
  tools?: any[];
  signal?: AbortSignal;
}

/**
 * OpenAI 参数适配器
 */
export class OpenAIParameterAdapter implements ParameterAdapter<'openai'> {
  readonly providerType = 'openai' as const;
  private unifiedManager: UnifiedParameterManager;

  constructor(config: ParameterManagerConfig) {
    this.unifiedManager = new UnifiedParameterManager({
      ...config,
      providerType: 'openai'
    });
  }

  /**
   * 更新助手配置
   */
  updateAssistant(assistant?: any): void {
    this.unifiedManager.updateAssistant(assistant);
  }

  /**
   * 更新模型配置
   */
  updateModel(model: Model): void {
    this.unifiedManager.updateModel(model);
  }

  /**
   * 获取默认值
   */
  getDefaults(): Partial<UnifiedParameters> {
    return {
      temperature: 0.7,
      topP: 1.0,
      maxOutputTokens: 4096,
      stream: true
    };
  }

  /**
   * 解析统一参数
   */
  resolve(config: ParameterManagerConfig): ResolvedParameters<'openai'> {
    if (config.assistant) {
      this.unifiedManager.updateAssistant(config.assistant);
    }

    const model = config.model || this.unifiedManager.getModel();
    const isReasoning = isReasoningModel(model);

    const base = this.unifiedManager.getBaseParameters();
    const extended = this.unifiedManager.getExtendedParameters();
    const reasoning = this.unifiedManager.getReasoningParameters(isReasoning);

    return {
      base,
      extended,
      reasoning,
      providerSpecific: this.getOpenAISpecificParameters()
    };
  }

  /**
   * 获取 OpenAI 特定参数
   */
  public getOpenAISpecificParameters(): OpenAISpecificParameters {
    const assistant = this.unifiedManager.getAssistant();
    const params: OpenAISpecificParameters = {};

    // Frequency Penalty
    if (assistant?.frequencyPenalty !== undefined && assistant.frequencyPenalty !== 0) {
      params.frequency_penalty = assistant.frequencyPenalty;
    }

    // Presence Penalty
    if (assistant?.presencePenalty !== undefined && assistant.presencePenalty !== 0) {
      params.presence_penalty = assistant.presencePenalty;
    }

    // Top-K
    if (assistant?.topK !== undefined && assistant.topK !== 40) {
      params.top_k = assistant.topK;
    }

    // Seed
    if (assistant?.seed !== undefined && assistant.seed !== null) {
      params.seed = assistant.seed;
    }

    // Stop Sequences
    if (assistant?.stopSequences && Array.isArray(assistant.stopSequences) && assistant.stopSequences.length > 0) {
      params.stop = assistant.stopSequences;
    }

    // Logit Bias
    if (assistant?.logitBias && Object.keys(assistant.logitBias).length > 0) {
      params.logit_bias = assistant.logitBias;
    }

    // Response Format
    if (assistant?.responseFormat && assistant.responseFormat !== 'text') {
      params.response_format = { type: assistant.responseFormat };
    }

    // Tool Choice
    if (assistant?.toolChoice && assistant.toolChoice !== 'auto') {
      params.tool_choice = assistant.toolChoice;
    }

    // Parallel Tool Calls
    if (assistant?.parallelToolCalls !== undefined && assistant.parallelToolCalls !== true) {
      params.parallel_tool_calls = assistant.parallelToolCalls;
    }

    // Store (是否存储对话)
    if (assistant?.store !== undefined) {
      params.store = assistant.store;
    }

    // User (用户标识符)
    if (assistant?.user) {
      params.user = assistant.user;
    }

    // Logprobs (token 概率)
    if (assistant?.logprobs !== undefined) {
      params.logprobs = assistant.logprobs;
    }

    // Top Logprobs
    if (assistant?.topLogprobs !== undefined) {
      params.top_logprobs = assistant.topLogprobs;
    }

    // Max Steps (多轮工具调用)
    if (assistant?.maxSteps !== undefined && assistant.maxSteps > 1) {
      params.maxSteps = assistant.maxSteps;
    }

    return params;
  }

  /**
   * 获取基础 API 参数（API 格式: snake_case）
   */
  getBaseAPIParameters(): BaseAPIParameters {
    const model = this.unifiedManager.getModel();
    const assistant = this.unifiedManager.getAssistant();
    const appSettings = getAppSettings();
    
    const params: BaseAPIParameters = {
      stream: true // 默认流式
    };

    // 温度参数
    if (appSettings.enableTemperature) {
      params.temperature = appSettings.temperature ?? 0.7;
    } else {
      const temp = assistant?.settings?.temperature ?? 
                   assistant?.temperature ?? 
                   model.temperature;
      if (temp !== undefined) {
        params.temperature = temp;
      }
    }

    // TopP 参数
    if (appSettings.enableTopP) {
      params.top_p = appSettings.topP ?? 1.0;
    } else {
      const topP = assistant?.settings?.topP ?? 
                   assistant?.topP ?? 
                   (model as any).top_p;
      if (topP !== undefined) {
        params.top_p = topP;
      }
    }

    // 最大输出 token
    if (appSettings.enableMaxOutputTokens !== false) {
      const maxTokens = assistant?.settings?.maxTokens ?? 
                        assistant?.maxTokens ?? 
                        model.maxTokens ?? 
                        4096;
      params.max_tokens = Math.max(maxTokens, 1);
    }

    return params;
  }

  /**
   * 获取推理参数 - Chat Completions API 格式
   */
  getReasoningParameters(): ReasoningParameters {
    return this.encodeReasoning('chat');
  }

  /**
   * 获取 Responses API 格式的推理参数
   */
  getResponsesAPIReasoningParameters(): ResponsesAPIReasoningParameters {
    return this.encodeReasoning('responses');
  }

  /**
   * 统一推理参数编码：读取 effort 与 maxTokens 后交给共享的 encodeReasoningParams。
   * 所有按模型 / 供应商的差异化逻辑都收敛在 encodeReasoning 模块中（单一事实源）。
   */
  private encodeReasoning(api: ReasoningApiFlavor): Record<string, any> {
    const model = this.unifiedManager.getModel();
    if (!isReasoningModel(model)) {
      return {};
    }
    const assistant = this.unifiedManager.getAssistant();
    const reasoningEffort = assistant?.settings?.reasoning_effort || getDefaultThinkingEffort();
    return encodeReasoningParams(model, reasoningEffort, {
      api,
      maxTokens: assistant?.settings?.maxTokens
    });
  }

  /**
   * 获取完整的 API 参数
   */
  getCompleteParameters(messages: any[], options?: {
    enableWebSearch?: boolean;
    enableTools?: boolean;
    tools?: any[];
    abortSignal?: AbortSignal;
  }): CompleteAPIParameters {
    const model = this.unifiedManager.getModel();
    const baseParams = this.getBaseAPIParameters();
    const specificParams = this.getOpenAISpecificParameters();
    const reasoningParams = this.getReasoningParameters();

    const completeParams: CompleteAPIParameters = {
      model: model.id,
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

    // 合并自定义请求体参数
    const extraBody = model.extraBody || model.providerExtraBody;
    if (extraBody && typeof extraBody === 'object') {
      Object.assign(completeParams, extraBody);
      logger.debug(`合并自定义请求体参数: ${Object.keys(extraBody).join(', ')}`);
    }

    return completeParams;
  }

  /**
   * 验证参数有效性
   */
  validateParameters(params: Partial<CompleteAPIParameters>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (params.temperature !== undefined && (params.temperature < 0 || params.temperature > 2)) {
      errors.push('Temperature must be between 0 and 2');
    }

    if (params.top_p !== undefined && (params.top_p < 0 || params.top_p > 1)) {
      errors.push('top_p must be between 0 and 1');
    }

    if (params.max_tokens !== undefined && params.max_tokens < 1) {
      errors.push('max_tokens must be greater than 0');
    }

    if (params.frequency_penalty !== undefined && (params.frequency_penalty < -2 || params.frequency_penalty > 2)) {
      errors.push('frequency_penalty must be between -2 and 2');
    }

    if (params.presence_penalty !== undefined && (params.presence_penalty < -2 || params.presence_penalty > 2)) {
      errors.push('presence_penalty must be between -2 and 2');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * 转换为 OpenAI API 格式
   */
  toAPIFormat(params: ResolvedParameters<'openai'>): Record<string, any> {
    const apiParams: Record<string, any> = {};

    // 只有参数存在时才添加
    if (params.base.temperature !== undefined) {
      apiParams.temperature = params.base.temperature;
    }
    if (params.base.topP !== undefined) {
      apiParams.top_p = params.base.topP;
    }
    if (params.base.stream !== undefined) {
      apiParams.stream = params.base.stream;
    }
    if (params.base.maxOutputTokens !== undefined) {
      apiParams.max_tokens = params.base.maxOutputTokens;
    }

    // 添加 OpenAI 特定参数
    Object.assign(apiParams, params.providerSpecific);

    // 添加推理参数
    if (params.reasoning?.enabled) {
      const reasoningParams = this.getReasoningParameters();
      Object.assign(apiParams, reasoningParams);
    }

    return apiParams;
  }
}

/**
 * 创建 OpenAI 参数适配器
 */
export function createOpenAIAdapter(config: ParameterManagerConfig): OpenAIParameterAdapter {
  return new OpenAIParameterAdapter(config);
}
