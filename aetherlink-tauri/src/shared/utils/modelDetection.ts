/**
 * 模型检测工具函数
 * 提供各种模型能力检测函数
 */
import type { Model } from '../types';
import { REASONING_REGEX } from '../config/modelPatterns';

/**
 * 检查模型是否支持OpenAI风格的推理
 * @param model 模型对象
 * @returns 是否支持OpenAI风格的推理
 */
export function isOpenAIReasoningModel(model?: Model): boolean {
  if (!model) return false;

  return model.id.includes('o1') ||
         model.id.includes('o3') ||
         model.id.includes('o4') ||
         model.id.includes('gpt-4') ||
         model.id.includes('gpt-4o');
}

/**
 * 检查模型是否支持Claude风格的推理
 * @param model 模型对象
 * @returns 是否支持Claude风格的推理
 */
export function isClaudeReasoningModel(model?: Model): boolean {
  if (!model) return false;

  return model.id.includes('claude-3');
}

/**
 * 检查模型是否支持Gemini风格的推理
 * @param model 模型对象
 * @returns 是否支持Gemini风格的推理
 */
export function isGeminiReasoningModel(model?: Model): boolean {
  if (!model) return false;

  return model.id.includes('gemini-2.5') ||
         model.id.includes('gemini-1.5-pro');
}

/**
 * 检查模型是否支持Qwen风格的推理
 * @param model 模型对象
 * @returns 是否支持Qwen风格的推理
 */
export function isQwenReasoningModel(model?: Model): boolean {
  if (!model) return false;

  return model.id.includes('qwen3') ||
         model.id.includes('qwen-max') ||
         model.id.includes('qwen-plus');
}

/**
 * 检查模型是否支持Grok风格的推理
 * @param model 模型对象
 * @returns 是否支持Grok风格的推理
 */
export function isGrokReasoningModel(model?: Model): boolean {
  if (!model) return false;

  return model.id.includes('grok-3-mini');
}

/**
 * 检查模型是否支持DeepSeek风格的推理
 * @param model 模型对象
 * @returns 是否支持DeepSeek风格的推理
 */
export function isDeepSeekReasoningModel(model?: Model): boolean {
  if (!model) return false;

  // 检查模型ID是否包含deepseek-reasoner或deepseek-coder
  if (model.id.includes('deepseek-reasoner') || model.id.includes('deepseek-coder')) {
    return true;
  }

  // 检查模型名称是否包含DeepSeek-R
  if (model.name && (model.name.includes('DeepSeek-R') || model.name.includes('DeepSeek Reasoner'))) {
    return true;
  }

  // 检查提供商是否为deepseek，且模型ID包含reasoner
  if (model.provider === 'deepseek' && (model.id.includes('reasoner') || model.id.includes('r1'))) {
    return true;
  }

  return false;
}

/**
 * 检查模型是否支持智谱AI风格的推理
 * @param model 模型对象
 * @returns 是否支持智谱AI风格的推理
 */
export function isZhipuReasoningModel(model?: Model): boolean {
  if (!model) return false;

  return model.id.includes('glm-z1') ||
         model.id.includes('glm-4') ||
         (model.provider === 'zhipu' && (
           model.id.includes('glm-z1') ||
           model.id.includes('glm-4')
         ));
}

/**
 * 检查模型是否支持推理努力程度参数
 * @param model 模型对象
 * @returns 是否支持推理努力程度参数
 */
export function isSupportedReasoningEffortModel(model?: Model): boolean {
  if (!model) return false;

  return isOpenAIReasoningModel(model) || isGrokReasoningModel(model);
}

/**
 * 检查模型是否支持思考token参数
 * @param model 模型对象
 * @returns 是否支持思考token参数
 */
export function isSupportedThinkingTokenModel(model?: Model): boolean {
  if (!model) return false;

  return isClaudeReasoningModel(model) ||
         isGeminiReasoningModel(model) ||
         isQwenReasoningModel(model);
}

/**
 * 检查模型是否支持推理功能
 * @param model 模型对象
 * @returns 是否支持推理功能
 */
export function isReasoningModel(model?: Model): boolean {
  if (!model) return false;

  // 检查模型类型是否包含推理类型
  if (model.modelTypes?.includes('reasoning')) {
    return true;
  }

  // 检查模型能力是否包含推理
  if (model.capabilities?.reasoning) {
    return true;
  }

  // 检查提供商特定逻辑
  if (model.provider === 'doubao') {
    return REASONING_REGEX.test(model.name || '') ||
           Boolean(model.modelTypes?.includes('reasoning'));
  }

  // 检查特定模型类型
  if (
    isClaudeReasoningModel(model) ||
    isOpenAIReasoningModel(model) ||
    isGeminiReasoningModel(model) ||
    isQwenReasoningModel(model) ||
    isGrokReasoningModel(model) ||
    isDeepSeekReasoningModel(model) ||
    isZhipuReasoningModel(model)
  ) {
    return true;
  }

  // 使用正则表达式检查模型ID
  return REASONING_REGEX.test(model.id) ||
         Boolean(model.modelTypes?.includes('reasoning'));
}

// 别名导出，保持与最佳实例命名一致
export const isSupportedReasoningEffortGrokModel = isGrokReasoningModel;
export const isSupportedThinkingTokenGeminiModel = isGeminiReasoningModel;
export const isSupportedThinkingTokenQwenModel = isQwenReasoningModel;
export const isSupportedThinkingTokenClaudeModel = isClaudeReasoningModel;
