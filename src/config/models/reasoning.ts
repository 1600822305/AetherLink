/**
 * 推理模型判定
 * 从 Cherry Studio 移植并适配 AetherLink
 */

import type { Model } from '../../shared/types';
import { isUserSelectedModelType, type ThinkingModelType, type ReasoningEffortOption } from './types';
import { getLowerBaseModelName, isGemini3FlashModel, isGemini3ProModel, GEMINI_FLASH_MODEL_REGEX } from './utils';
import { isEmbeddingModel, isRerankModel } from './embedding';
import { isTextToImageModel } from './vision';
import {
  isGPT5ProModel,
  isGPT5SeriesModel,
  isGPT51CodexMaxModel,
  isGPT51SeriesModel,
  isGPT52ProModel,
  isGPT52SeriesModel,
  isOpenAIDeepResearchModel,
  isOpenAIReasoningModel,
  isSupportedReasoningEffortOpenAIModel
} from './openai';

// 重新导出 OpenAI 相关函数
export { isOpenAIReasoningModel } from './openai';

// 推理模型正则
export const REASONING_REGEX =
  /^(?!.*-non-reasoning\b)(o\d+(?:-[\w-]+)?|.*\b(?:reasoning|reasoner|thinking|think)\b.*|.*-[rR]\d+.*|.*\bqwq(?:-[\w-]+)?\b.*|.*\bhunyuan-t1(?:-[\w-]+)?\b.*|.*\bglm-zero-preview\b.*|.*\bgrok-(?:3-mini|3-thinking|4|4-fast)(?:-[\w-]+)?\b.*)$/i;

// 模型类型到支持的 reasoning_effort 的映射表
export const MODEL_SUPPORTED_REASONING_EFFORT: Record<ThinkingModelType, readonly ReasoningEffortOption[]> = {
  default: ['low', 'medium', 'high'],
  o: ['low', 'medium', 'high'],
  openai_deep_research: ['medium'],
  gpt5: ['minimal', 'low', 'medium', 'high'],
  gpt5_codex: ['low', 'medium', 'high'],
  gpt5_1: ['none', 'low', 'medium', 'high'],
  gpt5_1_codex: ['none', 'medium', 'high'],
  gpt5_1_codex_max: ['none', 'medium', 'high', 'xhigh'],
  gpt5_2: ['none', 'low', 'medium', 'high', 'xhigh'],
  gpt5pro: ['high'],
  gpt52pro: ['medium', 'high', 'xhigh'],
  grok: ['low', 'high'],
  grok4_fast: ['auto'],
  gemini2_flash: ['low', 'medium', 'high', 'auto'],
  gemini2_pro: ['low', 'medium', 'high', 'auto'],
  gemini3_flash: ['minimal', 'low', 'medium', 'high'],
  gemini3_pro: ['low', 'high'],
  qwen: ['low', 'medium', 'high'],
  qwen_thinking: ['low', 'medium', 'high'],
  doubao: ['auto', 'high'],
  doubao_no_auto: ['high'],
  doubao_after_251015: ['minimal', 'low', 'medium', 'high'],
  hunyuan: ['auto'],
  mimo: ['auto'],
  zhipu: ['auto'],
  perplexity: ['low', 'medium', 'high'],
  deepseek_hybrid: ['auto']
};

// 模型类型到支持选项的映射表
export const MODEL_SUPPORTED_OPTIONS: Record<ThinkingModelType, readonly ReasoningEffortOption[]> = {
  default: ['default', 'none', ...MODEL_SUPPORTED_REASONING_EFFORT.default],
  o: ['default', ...MODEL_SUPPORTED_REASONING_EFFORT.o],
  openai_deep_research: ['default', ...MODEL_SUPPORTED_REASONING_EFFORT.openai_deep_research],
  gpt5: ['default', ...MODEL_SUPPORTED_REASONING_EFFORT.gpt5],
  gpt5pro: ['default', ...MODEL_SUPPORTED_REASONING_EFFORT.gpt5pro],
  gpt5_codex: ['default', ...MODEL_SUPPORTED_REASONING_EFFORT.gpt5_codex],
  gpt5_1: ['default', ...MODEL_SUPPORTED_REASONING_EFFORT.gpt5_1],
  gpt5_1_codex: ['default', ...MODEL_SUPPORTED_REASONING_EFFORT.gpt5_1_codex],
  gpt5_2: ['default', ...MODEL_SUPPORTED_REASONING_EFFORT.gpt5_2],
  gpt5_1_codex_max: ['default', ...MODEL_SUPPORTED_REASONING_EFFORT.gpt5_1_codex_max],
  gpt52pro: ['default', ...MODEL_SUPPORTED_REASONING_EFFORT.gpt52pro],
  grok: ['default', ...MODEL_SUPPORTED_REASONING_EFFORT.grok],
  grok4_fast: ['default', 'none', ...MODEL_SUPPORTED_REASONING_EFFORT.grok4_fast],
  gemini2_flash: ['default', 'none', ...MODEL_SUPPORTED_REASONING_EFFORT.gemini2_flash],
  gemini2_pro: ['default', ...MODEL_SUPPORTED_REASONING_EFFORT.gemini2_pro],
  gemini3_flash: ['default', ...MODEL_SUPPORTED_REASONING_EFFORT.gemini3_flash],
  gemini3_pro: ['default', ...MODEL_SUPPORTED_REASONING_EFFORT.gemini3_pro],
  qwen: ['default', 'none', ...MODEL_SUPPORTED_REASONING_EFFORT.qwen],
  qwen_thinking: ['default', ...MODEL_SUPPORTED_REASONING_EFFORT.qwen_thinking],
  doubao: ['default', 'none', ...MODEL_SUPPORTED_REASONING_EFFORT.doubao],
  doubao_no_auto: ['default', 'none', ...MODEL_SUPPORTED_REASONING_EFFORT.doubao_no_auto],
  doubao_after_251015: ['default', ...MODEL_SUPPORTED_REASONING_EFFORT.doubao_after_251015],
  mimo: ['default', 'none', ...MODEL_SUPPORTED_REASONING_EFFORT.mimo],
  hunyuan: ['default', 'none', ...MODEL_SUPPORTED_REASONING_EFFORT.hunyuan],
  zhipu: ['default', 'none', ...MODEL_SUPPORTED_REASONING_EFFORT.zhipu],
  perplexity: ['default', ...MODEL_SUPPORTED_REASONING_EFFORT.perplexity],
  deepseek_hybrid: ['default', 'none', ...MODEL_SUPPORTED_REASONING_EFFORT.deepseek_hybrid]
};

/**
 * 检查是否为 Grok 推理模型
 */
export function isGrokReasoningModel(model?: Model): boolean {
  if (!model) return false;
  const modelId = getLowerBaseModelName(model.id);
  return modelId.includes('grok-3-mini') || modelId.includes('grok-3-thinking');
}

/**
 * 检查是否为 Grok 4 Fast 推理模型
 */
export function isGrok4FastReasoningModel(model?: Model): boolean {
  if (!model) return false;
  const modelId = getLowerBaseModelName(model.id);
  return modelId.includes('grok-4-fast');
}

/**
 * 检查是否支持 reasoning effort 的 Grok 模型
 */
export function isSupportedReasoningEffortGrokModel(model?: Model): boolean {
  return isGrokReasoningModel(model);
}

/**
 * 检查是否为 Claude 推理模型
 */
export function isClaudeReasoningModel(model?: Model): boolean {
  if (!model) return false;
  const modelId = getLowerBaseModelName(model.id);
  return modelId.includes('claude-3');
}

/**
 * 检查是否为 Claude 4.5 推理模型
 */
export function isClaude45ReasoningModel(model?: Model): boolean {
  if (!model) return false;
  const modelId = getLowerBaseModelName(model.id);
  return modelId.includes('claude-4.5') || modelId.includes('claude-4-5');
}

/**
 * 检查是否为 Gemini 推理模型
 */
export function isGeminiReasoningModel(model?: Model): boolean {
  if (!model) return false;
  const modelId = getLowerBaseModelName(model.id);
  return modelId.includes('gemini-2.5') || modelId.includes('gemini-1.5-pro');
}

/**
 * 检查是否支持 thinking token 的 Gemini 模型
 */
export function isSupportedThinkingTokenGeminiModel(model?: Model): boolean {
  if (!model) return false;
  const modelId = getLowerBaseModelName(model.id);
  return (
    modelId.includes('gemini-2.5') ||
    modelId.includes('gemini-2.0') ||
    isGemini3FlashModel(model) ||
    isGemini3ProModel(model)
  );
}

/**
 * 检查是否为 Qwen 推理模型
 */
export function isQwenReasoningModel(model?: Model): boolean {
  if (!model) return false;
  const modelId = getLowerBaseModelName(model.id);
  return modelId.includes('qwen3') || modelId.includes('qwen-max') || modelId.includes('qwen-plus');
}

/**
 * 检查是否支持 thinking token 的 Qwen 模型
 */
export function isSupportedThinkingTokenQwenModel(model?: Model): boolean {
  return isQwenReasoningModel(model);
}

/**
 * 检查是否为 Qwen 始终思考的模型
 */
export function isQwenAlwaysThinkModel(model?: Model): boolean {
  if (!model) return false;
  const modelId = getLowerBaseModelName(model.id);
  return modelId.includes('qwq') || modelId.includes('qwen3-thinking');
}

/**
 * 检查是否为 DeepSeek 推理模型
 */
export function isDeepSeekReasoningModel(model?: Model): boolean {
  if (!model) return false;
  const modelId = getLowerBaseModelName(model.id);
  
  if (modelId.includes('deepseek-reasoner') || modelId.includes('deepseek-coder')) {
    return true;
  }
  
  if (model.name && (model.name.includes('DeepSeek-R') || model.name.includes('DeepSeek Reasoner'))) {
    return true;
  }
  
  if (model.provider === 'deepseek' && (modelId.includes('reasoner') || modelId.includes('r1'))) {
    return true;
  }
  
  return false;
}

/**
 * 检查是否为智谱推理模型
 */
export function isZhipuReasoningModel(model?: Model): boolean {
  if (!model) return false;
  const modelId = getLowerBaseModelName(model.id);
  return modelId.includes('glm-z1') || modelId.includes('glm-4') ||
    (model.provider === 'zhipu' && (modelId.includes('glm-z1') || modelId.includes('glm-4')));
}

/**
 * 检查是否为豆包推理模型
 */
export function isDoubaoReasoningModel(model?: Model): boolean {
  if (!model) return false;
  const modelId = getLowerBaseModelName(model.id);
  return modelId.includes('doubao') && (modelId.includes('thinking') || modelId.includes('reasoner') || modelId.includes('seed-1-8'));
}

/**
 * 检查是否为豆包 1.6+ 版本的思考模型 (支持更多 reasoning effort 选项)
 */
export function isDoubao16ThinkingModel(model?: Model): boolean {
  if (!model) return false;
  const modelId = getLowerBaseModelName(model.id);
  return modelId.includes('doubao-seed-1-6-thinking') || modelId.includes('doubao-seed-1-8');
}

/**
 * 检查是否为豆包不支持 auto 选项的思考模型
 */
export function isDoubaoNoAutoModel(model?: Model): boolean {
  if (!model) return false;
  const modelId = getLowerBaseModelName(model.id);
  // 旧版豆包思考模型不支持 auto
  return modelId.includes('doubao') && modelId.includes('thinking') && 
    !modelId.includes('seed-1-6') && !modelId.includes('seed-1-8');
}

/**
 * 检查是否支持 reasoning effort 参数
 */
export function isSupportedReasoningEffortModel(model?: Model): boolean {
  if (!model) return false;
  return isSupportedReasoningEffortOpenAIModel(model) || isGrokReasoningModel(model);
}

/**
 * 检查是否支持 thinking token 参数
 */
export function isSupportedThinkingTokenModel(model?: Model): boolean {
  if (!model) return false;
  return (
    isClaudeReasoningModel(model) ||
    isSupportedThinkingTokenGeminiModel(model) ||
    isSupportedThinkingTokenQwenModel(model)
  );
}

/**
 * 检查模型是否为推理模型
 */
export function isReasoningModel(model?: Model): boolean {
  if (!model || isEmbeddingModel(model) || isRerankModel(model) || isTextToImageModel(model)) {
    return false;
  }

  // 排除 Grok-4 fast 系列模型
  const modelId = getLowerBaseModelName(model.id);
  if (modelId.includes('grok-4-fast')) {
    return false;
  }

  // 检查用户自定义类型
  const userSelected = isUserSelectedModelType(model, 'reasoning');
  if (userSelected !== undefined) {
    return userSelected;
  }

  // 检查 capabilities
  if (model.capabilities?.reasoning) {
    return true;
  }

  // 检查 modelTypes
  if (model.modelTypes?.includes('reasoning' as any)) {
    return true;
  }

  // 豆包特殊处理
  if (model.provider === 'doubao') {
    return REASONING_REGEX.test(model.name || '') || Boolean(model.modelTypes?.includes('reasoning' as any));
  }

  // 检查特定模型类型
  if (
    isClaudeReasoningModel(model) ||
    isOpenAIReasoningModel(model) ||
    isSupportedThinkingTokenGeminiModel(model) ||
    isQwenReasoningModel(model) ||
    isGrokReasoningModel(model) ||
    isDeepSeekReasoningModel(model) ||
    isZhipuReasoningModel(model)
  ) {
    return true;
  }

  return REASONING_REGEX.test(modelId);
}

/**
 * 获取思考模型类型
 */
export function getThinkModelType(model?: Model): ThinkingModelType {
  if (!model) return 'default';

  let thinkingModelType: ThinkingModelType = 'default';
  const modelId = getLowerBaseModelName(model.id);

  if (isOpenAIDeepResearchModel(model)) {
    return 'openai_deep_research';
  } else if (isGPT51SeriesModel(model)) {
    if (modelId.includes('codex')) {
      thinkingModelType = 'gpt5_1_codex';
      if (isGPT51CodexMaxModel(model)) {
        thinkingModelType = 'gpt5_1_codex_max';
      }
    } else {
      thinkingModelType = 'gpt5_1';
    }
  } else if (isGPT52SeriesModel(model)) {
    thinkingModelType = 'gpt5_2';
    if (isGPT52ProModel(model)) {
      thinkingModelType = 'gpt52pro';
    }
  } else if (isGPT5SeriesModel(model)) {
    if (modelId.includes('codex')) {
      thinkingModelType = 'gpt5_codex';
    } else {
      thinkingModelType = 'gpt5';
      if (isGPT5ProModel(model)) {
        thinkingModelType = 'gpt5pro';
      }
    }
  } else if (isSupportedReasoningEffortOpenAIModel(model)) {
    thinkingModelType = 'o';
  } else if (isGrok4FastReasoningModel(model)) {
    thinkingModelType = 'grok4_fast';
  } else if (isSupportedThinkingTokenGeminiModel(model)) {
    if (isGemini3FlashModel(model)) {
      thinkingModelType = 'gemini3_flash';
    } else if (isGemini3ProModel(model)) {
      thinkingModelType = 'gemini3_pro';
    } else if (GEMINI_FLASH_MODEL_REGEX.test(model.id)) {
      thinkingModelType = 'gemini2_flash';
    } else {
      thinkingModelType = 'gemini2_pro';
    }
  } else if (isSupportedReasoningEffortGrokModel(model)) {
    thinkingModelType = 'grok';
  } else if (isSupportedThinkingTokenQwenModel(model)) {
    if (isQwenAlwaysThinkModel(model)) {
      thinkingModelType = 'qwen_thinking';
    } else {
      thinkingModelType = 'qwen';
    }
  } else if (isDeepSeekReasoningModel(model)) {
    thinkingModelType = 'deepseek_hybrid';
  } else if (isZhipuReasoningModel(model)) {
    thinkingModelType = 'zhipu';
  } else if (isDoubaoReasoningModel(model)) {
    if (isDoubao16ThinkingModel(model)) {
      thinkingModelType = 'doubao_after_251015';
    } else if (isDoubaoNoAutoModel(model)) {
      thinkingModelType = 'doubao_no_auto';
    } else {
      thinkingModelType = 'doubao';
    }
  }

  return thinkingModelType;
}

/**
 * 获取模型支持的推理努力选项
 */
export function getModelSupportedReasoningEffort(model?: Model): readonly ReasoningEffortOption[] {
  const type = getThinkModelType(model);
  return MODEL_SUPPORTED_OPTIONS[type] || MODEL_SUPPORTED_OPTIONS.default;
}

// 别名导出，保持兼容
export const isSupportedThinkingTokenClaudeModel = isClaudeReasoningModel;
