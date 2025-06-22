/**
 * 思考过程配置常量
 * 定义思考过程相关的配置选项和常量
 */
import type { Model } from '../types';
import {
  isOpenAIReasoningModel,
  isClaudeReasoningModel,
  isGeminiReasoningModel,
  isQwenReasoningModel,
  isGrokReasoningModel
} from './models';
import { EFFORT_RATIO } from './constants';

/**
 * 检查模型是否支持DeepSeek风格的推理参数
 * @param model 模型对象
 * @returns 是否支持DeepSeek风格的推理参数
 */
export function isDeepSeekReasoningModel(model: Model): boolean {
  const modelId = model.id;
  return Boolean(
    modelId.includes('deepseek')
  );
}

/**
 * 思考选项类型
 */
export type ThinkingOption = 'off' | 'low' | 'medium' | 'high' | 'auto';

/**
 * 模型类型到支持选项的映射表
 */
export const MODEL_SUPPORTED_OPTIONS: Record<string, ThinkingOption[]> = {
  default: ['off', 'low', 'medium', 'high'],
  grok: ['off', 'low', 'high'],
  gemini: ['off', 'low', 'medium', 'high', 'auto'],
  qwen: ['off', 'low', 'medium', 'high'],
  claude: ['off', 'low', 'medium', 'high'],
  openai: ['off', 'low', 'medium', 'high'],
  deepseek: ['off', 'high']
};

/**
 * 选项转换映射表：当选项不支持时使用的替代选项
 */
export const OPTION_FALLBACK: Record<ThinkingOption, ThinkingOption> = {
  off: 'off',
  low: 'low',
  medium: 'high', // medium -> high (for Grok models)
  high: 'high',
  auto: 'high' // auto -> high (for non-Gemini models)
};

/**
 * 获取模型支持的思考选项
 * @param model 模型对象
 * @returns 支持的思考选项数组
 */
export function getSupportedOptions(model: Model): ThinkingOption[] {
  if (isGrokReasoningModel(model)) {
    return MODEL_SUPPORTED_OPTIONS.grok;
  }

  if (isGeminiReasoningModel(model)) {
    return MODEL_SUPPORTED_OPTIONS.gemini;
  }

  if (isQwenReasoningModel(model)) {
    return MODEL_SUPPORTED_OPTIONS.qwen;
  }

  if (isClaudeReasoningModel(model)) {
    return MODEL_SUPPORTED_OPTIONS.claude;
  }

  if (isOpenAIReasoningModel(model)) {
    return MODEL_SUPPORTED_OPTIONS.openai;
  }

  if (isDeepSeekReasoningModel(model)) {
    return MODEL_SUPPORTED_OPTIONS.deepseek;
  }

  return MODEL_SUPPORTED_OPTIONS.default;
}

/**
 * 获取模型的思考预算
 * @param model 模型对象
 * @param effort 思考深度
 * @param maxTokens 最大令牌数
 * @returns 思考预算
 */
export function getThinkingBudget(model: Model, effort: ThinkingOption, maxTokens: number = 4096): number {
  if (effort === 'off') {
    return 0;
  }

  // 获取努力程度比率
  const effortRatio = EFFORT_RATIO[effort === 'auto' ? 'high' : effort];

  // 计算预算令牌数
  const tokenLimit = getModelTokenLimit(model);
  const budgetTokens = Math.floor(
    (tokenLimit.max - tokenLimit.min) * effortRatio + tokenLimit.min
  );

  // 确保预算不超过最大令牌数
  return Math.min(budgetTokens, maxTokens * effortRatio);
}

/**
 * 获取模型的令牌限制
 * @param model 模型对象
 * @returns 令牌限制对象
 */
export function getModelTokenLimit(model: Model): { min: number; max: number } {
  // 这里可以根据不同模型返回不同的令牌限制
  // 简化版本，实际应用中应该有更详细的模型令牌限制表
  if (model.id.includes('gpt-4')) {
    return { min: 1024, max: 8192 };
  }

  if (model.id.includes('claude-3')) {
    return { min: 1024, max: 16384 };
  }

  if (model.id.includes('gemini')) {
    return { min: 1024, max: 8192 };
  }

  if (model.id.includes('grok')) {
    return { min: 1024, max: 4096 };
  }

  // 默认值
  return { min: 1024, max: 4096 };
}
