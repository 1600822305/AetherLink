import type { Model } from '../../../types';
import type { UnifiedParameters } from '../types';
import { encodeReasoningParams } from '../reasoning/encodeReasoning';

/**
 * OpenAI 参数格式转换器
 * 用于 OpenAI 及 OpenAI 兼容供应商
 */
export class OpenAIParameterFormatter {
  /** 将统一参数转换为 OpenAI API 请求体格式 */
  static toAPIFormat(unified: UnifiedParameters, model: Model): Record<string, any> {
    const params: Record<string, any> = {};

    // 基础参数
    if (unified.temperature !== undefined) params.temperature = unified.temperature;
    if (unified.topP !== undefined) params.top_p = unified.topP;
    if (unified.maxOutputTokens !== undefined) params.max_tokens = unified.maxOutputTokens;
    if (unified.stream !== undefined) {
      params.stream = unified.stream;
      // 流式模式下添加 stream_options 以获取 usage 信息
      if (unified.stream) {
        params.stream_options = { include_usage: true };
      }
    }

    // 扩展参数
    if (unified.topK !== undefined) params.top_k = unified.topK;
    if (unified.frequencyPenalty !== undefined) params.frequency_penalty = unified.frequencyPenalty;
    if (unified.presencePenalty !== undefined) params.presence_penalty = unified.presencePenalty;
    if (unified.seed !== undefined) params.seed = unified.seed;
    if (unified.stopSequences?.length) params.stop = unified.stopSequences;
    if (unified.responseFormat) params.response_format = unified.responseFormat;

    // 并行工具调用
    const parallelToolCalls = (unified as any).parallelToolCalls;
    if (parallelToolCalls !== undefined) {
      params.parallel_tool_calls = parallelToolCalls;
    }

    // User 标识符
    const user = (unified as any).user;
    if (user) {
      params.user = user;
    }

    // 推理参数：统一交给推理编码层处理，按模型 / 供应商产出
    // reasoning_effort / thinking(enable|disable) 等。这样 DeepSeek V4 等混合
    // 推理模型在正式聊天里也能正确开启/关闭思考并选择「最高」强度。
    const reasoningEffort = (unified as any).reasoningEffort;
    const reasoningParams = encodeReasoningParams(model, reasoningEffort, {
      api: 'chat',
      maxTokens: unified.maxOutputTokens
    });
    Object.assign(params, reasoningParams);

    // 思考预算：OpenAI 兼容 API 使用 thinking 格式（类似 Anthropic）
    // 仅当推理编码层未产出 thinking 时才回退到预算式 thinking，避免互相覆盖。
    const thinkingBudget = (unified as any).thinkingBudget;
    if (thinkingBudget && params.thinking === undefined) {
      params.thinking = {
        type: 'enabled',
        budget_tokens: thinkingBudget
      };
    }

    return params;
  }
}
