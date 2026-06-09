/**
 * 统一推理参数编码层（单一事实源）
 *
 * 职责：给定 (model, effort, api)，产出对应供应商 / API 的请求参数。
 * 之前这段逻辑分散在 `adapters/openai.ts`（完整，但仅 Responses 路径使用）与
 * `formatters/openai.ts`（正式聊天使用，却只会原样下发 reasoning_effort），
 * 导致 DeepSeek V4 等混合推理模型在正式聊天里既选不到「最高」档、也无法真正关闭思考。
 *
 * 现在 formatter 与 adapter 都改为调用本模块，所有推理模型走同一套编码规则。
 */

import type { Model } from '../../../types';
import {
  isReasoningModel,
  isOpenAIReasoningModel,
  isClaudeReasoningModel,
  isGeminiReasoningModel,
  isQwenReasoningModel,
  isGrokReasoningModel,
  isDeepSeekReasoningModel,
  isDeepSeekHybridReasoningModel
} from '../../../../config/models';
import { EFFORT_RATIO, DEFAULT_MAX_TOKENS, findTokenLimit } from '../../../config/constants';

/** 推理参数面向的 API 形态 */
export type ReasoningApiFlavor = 'chat' | 'responses';

/** 编码可选项 */
export interface EncodeReasoningOptions {
  /** 目标 API 形态，默认 Chat Completions */
  api?: ReasoningApiFlavor;
  /** Claude 思考预算上限计算所需的最大输出 token（assistant.settings.maxTokens 或统一参数中的 maxOutputTokens） */
  maxTokens?: number;
}

/**
 * 归一化 effort 取值。
 * 历史上 UI 用 'off' 表示关闭，能力层用 'none'；这里统一为 'none'。
 * 返回空字符串表示「未设置」。
 */
export function normalizeReasoningEffort(effort?: string | null): string {
  if (effort === undefined || effort === null) return '';
  const value = String(effort).trim().toLowerCase();
  if (value === '') return '';
  if (value === 'off' || value === 'disabled') return 'none';
  return value;
}

/** 是否为「关闭思考」语义 */
export function isDisabledEffort(effort?: string | null): boolean {
  return normalizeReasoningEffort(effort) === 'none';
}

/**
 * 将通用 effort 值映射为 DeepSeek V4 服务端接受的值。
 * V4 规则：low/medium -> high，xhigh -> max，high/max 原样透传。
 */
export function mapDeepSeekV4Effort(effort: string): string {
  if (effort === 'low' || effort === 'medium') return 'high';
  if (effort === 'xhigh') return 'max';
  if (effort === 'high' || effort === 'max') return effort;
  return 'high';
}

/** 计算思考预算（Qwen / Claude 使用），找不到 token 限制时返回 undefined */
function computeBudgetTokens(model: Model, effort: string): number | undefined {
  const tokenLimit = findTokenLimit(model.id);
  if (!tokenLimit) return undefined;
  const ratio = EFFORT_RATIO[effort as keyof typeof EFFORT_RATIO] ?? 0.3;
  return Math.floor((tokenLimit.max - tokenLimit.min) * ratio + tokenLimit.min);
}

/** 关闭思考时的参数 */
function encodeDisabled(model: Model, api: ReasoningApiFlavor): Record<string, any> {
  // Qwen：显式关闭思考
  if (isQwenReasoningModel(model)) return { enable_thinking: false };
  // Claude：thinking.type=disabled
  if (isClaudeReasoningModel(model)) return { thinking: { type: 'disabled' } };
  // DeepSeek V4 混合模型：thinking.type=disabled
  if (isDeepSeekHybridReasoningModel(model)) return { thinking: { type: 'disabled' } };
  // Gemini（Chat 路径）：reasoning_effort='none'
  if (api === 'chat' && isGeminiReasoningModel(model)) return { reasoning_effort: 'none' };
  // OpenAI o 系列 / Grok / DeepSeek legacy：不支持关闭推理，跳过
  return {};
}

/** 启用思考时的参数 */
function encodeEnabled(
  model: Model,
  effort: string,
  api: ReasoningApiFlavor,
  maxTokens?: number
): Record<string, any> {
  // OpenAI 推理模型：Responses API 用 reasoning.effort，Chat 用 reasoning_effort
  if (isOpenAIReasoningModel(model)) {
    return api === 'responses'
      ? { reasoning: { effort, summary: 'auto' } }
      : { reasoning_effort: effort };
  }

  // DeepSeek V4 混合模型（优先于 legacy 判定）：启用思考 + effort 映射
  if (isDeepSeekHybridReasoningModel(model)) {
    return { thinking: { type: 'enabled' }, reasoning_effort: mapDeepSeekV4Effort(effort) };
  }

  // DeepSeek legacy 推理模型：仅支持 low/high（medium 视为 high）
  if (isDeepSeekReasoningModel(model)) {
    const supported = effort === 'medium' ? 'high' : effort;
    if (supported === 'low' || supported === 'high') {
      return { reasoning_effort: supported };
    }
    return {};
  }

  const budgetTokens = computeBudgetTokens(model, effort);

  // 找不到 token 限制时：除上述特判外，统一透传 reasoning_effort（与历史默认行为一致）
  if (budgetTokens === undefined) {
    return { reasoning_effort: effort };
  }

  // Qwen：启用思考 + 思考预算
  if (isQwenReasoningModel(model)) {
    return { enable_thinking: true, thinking_budget: budgetTokens };
  }

  // Grok（仅 Chat 路径）：仅支持 low/high
  if (api === 'chat' && isGrokReasoningModel(model)) {
    const supported = effort === 'medium' ? 'high' : effort;
    if (supported === 'low' || supported === 'high') {
      return { reasoning_effort: supported };
    }
    return {};
  }

  // Gemini（仅 Chat 路径）：直接透传 reasoning_effort
  if (api === 'chat' && isGeminiReasoningModel(model)) {
    return { reasoning_effort: effort };
  }

  // Claude：thinking.type=enabled + 受 maxTokens 约束的预算
  if (isClaudeReasoningModel(model)) {
    const ratio = EFFORT_RATIO[effort as keyof typeof EFFORT_RATIO] ?? 0.3;
    const cap = (maxTokens || DEFAULT_MAX_TOKENS) * ratio;
    return {
      thinking: {
        type: 'enabled',
        budget_tokens: Math.max(1024, Math.min(budgetTokens, cap))
      }
    };
  }

  return {};
}

/**
 * 统一推理参数编码入口。
 *
 * @param model         目标模型
 * @param rawEffort     原始 effort 取值（可能来自 UI 的 'off' / 'low' / 'high' / 'xhigh' 等）
 * @param options       目标 API 形态及辅助参数
 * @returns             可直接展开进请求体的推理参数；无需发送时返回 {}
 */
export function encodeReasoningParams(
  model: Model,
  rawEffort?: string | null,
  options: EncodeReasoningOptions = {}
): Record<string, any> {
  const api: ReasoningApiFlavor = options.api ?? 'chat';
  const effort = normalizeReasoningEffort(rawEffort);

  // 未设置：不发送任何推理参数
  if (!effort) return {};

  // 'default' 语义：使用模型默认推理行为，不下发任何覆盖参数
  if (effort === 'default') return {};

  // 关闭思考
  if (effort === 'none') {
    return isReasoningModel(model) ? encodeDisabled(model, api) : {};
  }

  // 第三方 / 未被识别为推理模型：保守降级，直接透传 reasoning_effort
  // （用户既然显式设置了 effort，说明该端点很可能支持；未知字段多数兼容端点会忽略）
  if (!isReasoningModel(model)) {
    return { reasoning_effort: effort };
  }

  return encodeEnabled(model, effort, api, maxTokensFrom(options));
}

function maxTokensFrom(options: EncodeReasoningOptions): number | undefined {
  return typeof options.maxTokens === 'number' ? options.maxTokens : undefined;
}
