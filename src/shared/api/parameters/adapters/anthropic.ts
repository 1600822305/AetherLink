/**
 * Anthropic 参数适配器
 * 处理 Claude 模型的参数转换
 */

import type { Model } from '../../../types';
import type {
  ParameterAdapter,
  ParameterManagerConfig,
  ResolvedParameters,
  UnifiedParameters,
  AnthropicSpecificParameters
} from '../types';
import { UnifiedParameterManager } from '../UnifiedParameterManager';
import { isClaudeReasoningModel } from '../../../../config/models';
import { findTokenLimit } from '../../../config/constants';
import { getDefaultThinkingEffort } from '../../../utils/settingsUtils';
import { isDisabledEffort } from '../reasoning/encodeReasoning';

/**
 * Anthropic 参数适配器
 */
export class AnthropicParameterAdapter implements ParameterAdapter<'anthropic'> {
  readonly providerType = 'anthropic' as const;
  private unifiedManager: UnifiedParameterManager;

  constructor(config: ParameterManagerConfig) {
    this.unifiedManager = new UnifiedParameterManager({
      ...config,
      providerType: 'anthropic'
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
      temperature: 1.0,
      topP: 1.0,
      maxOutputTokens: 4096,
      stream: true
    };
  }

  /**
   * 解析统一参数
   */
  resolve(config: ParameterManagerConfig): ResolvedParameters<'anthropic'> {
    if (config.assistant) {
      this.unifiedManager.updateAssistant(config.assistant);
    }

    const model = config.model || this.unifiedManager.getModel();
    const isReasoning = isClaudeReasoningModel(model);

    const base = this.unifiedManager.getBaseParameters();
    const extended = this.unifiedManager.getExtendedParameters();
    const reasoning = this.unifiedManager.getReasoningParameters(isReasoning);

    return {
      base,
      extended,
      reasoning,
      providerSpecific: this.getAnthropicSpecificParameters()
    };
  }

  /**
   * 获取 Anthropic 特定参数
   */
  private getAnthropicSpecificParameters(): AnthropicSpecificParameters {
    const assistant = this.unifiedManager.getAssistant();
    const params: AnthropicSpecificParameters = {};

    // Top-K
    if (assistant?.topK !== undefined && assistant.topK !== 40) {
      params.top_k = assistant.topK;
    }

    // Stop Sequences
    if (assistant?.stopSequences && Array.isArray(assistant.stopSequences) && assistant.stopSequences.length > 0) {
      params.stop_sequences = assistant.stopSequences;
    }

    // Cache Control
    if (assistant?.cacheControl) {
      params.cacheControl = assistant.cacheControl;
    }

    // Structured Output Mode
    if (assistant?.structuredOutputMode) {
      params.structuredOutputMode = assistant.structuredOutputMode;
    }

    // User
    if (assistant?.user) {
      params.user = assistant.user;
    }

    // Web Search
    if (assistant?.webSearchEnabled) {
      params.webSearchEnabled = true;
      if (assistant?.webSearchConfig) {
        params.webSearchConfig = assistant.webSearchConfig;
      }
    }

    // Code Execution
    if (assistant?.codeExecutionEnabled) {
      params.codeExecutionEnabled = true;
    }

    // Computer Use
    if (assistant?.computerUseConfig) {
      params.computerUseConfig = assistant.computerUseConfig;
    }

    return params;
  }

  /**
   * 获取 Extended Thinking 参数
   */
  getThinkingParameters(): AnthropicSpecificParameters['thinking'] | undefined {
    const model = this.unifiedManager.getModel();
    const assistant = this.unifiedManager.getAssistant();

    if (!isClaudeReasoningModel(model)) {
      return undefined;
    }

    const reasoningEffort = assistant?.settings?.reasoning_effort || getDefaultThinkingEffort();

    // 检查是否禁用（与统一推理编码层使用同一套关闭语义判定）
    if (isDisabledEffort(reasoningEffort)) {
      return { type: 'disabled' };
    }

    // 计算 token 预算
    const tokenLimitInfo = findTokenLimit(model.id);
    const tokenLimit: number = tokenLimitInfo?.max || 8192;
    const effortMap: Record<string, number> = {
      low: 0.2,
      medium: 0.5,
      high: 0.8,
      max: 1.0
    };
    const ratio: number = effortMap[reasoningEffort] || 0.5;
    let budgetTokens = Math.floor(tokenLimit * ratio);
    budgetTokens = Math.max(1024, Math.min(budgetTokens, 128000));

    return {
      type: 'enabled',
      budgetTokens
    };
  }

  /**
   * 转换为 Anthropic API 格式
   */
  toAPIFormat(params: ResolvedParameters<'anthropic'>): Record<string, any> {
    const apiParams: Record<string, any> = {};

    // 只有参数存在时才添加
    if (params.base.temperature !== undefined) {
      apiParams.temperature = params.base.temperature;
    }
    if (params.base.topP !== undefined) {
      apiParams.top_p = params.base.topP;
    }
    if (params.base.maxOutputTokens !== undefined) {
      apiParams.max_tokens = params.base.maxOutputTokens;
    }

    // 添加 Anthropic 特定参数
    if (params.providerSpecific.top_k !== undefined) {
      apiParams.top_k = params.providerSpecific.top_k;
    }
    if (params.providerSpecific.stop_sequences) {
      apiParams.stop_sequences = params.providerSpecific.stop_sequences;
    }

    // 添加 thinking 参数
    const thinking = this.getThinkingParameters();
    if (thinking) {
      apiParams.thinking = thinking;
    }

    return apiParams;
  }

  /**
   * 获取工具选择参数
   */
  getToolChoice(): string | undefined {
    const assistant = this.unifiedManager.getAssistant();
    if (assistant?.toolChoice && assistant.toolChoice !== 'auto') {
      return assistant.toolChoice;
    }
    return undefined;
  }
}

/**
 * 创建 Anthropic 参数适配器
 */
export function createAnthropicAdapter(config: ParameterManagerConfig): AnthropicParameterAdapter {
  return new AnthropicParameterAdapter(config);
}
