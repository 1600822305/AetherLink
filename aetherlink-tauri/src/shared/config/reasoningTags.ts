/**
 * 思考标签配置
 * 定义各种模型的思考标签格式
 */
import type { Model } from '../types';
import {
  isOpenAIReasoningModel,
  isClaudeReasoningModel,
  isGeminiReasoningModel,
  isQwenReasoningModel,
  isGrokReasoningModel,
  isDeepSeekReasoningModel,
  isZhipuReasoningModel
} from '../utils/modelDetection';

/**
 * 思考标签接口
 */
export interface ReasoningTag {
  openingTag: string;
  closingTag: string;
  separator: string;
}

/**
 * OpenAI模型思考标签
 */
export const OPENAI_REASONING_TAGS: ReasoningTag[] = [
  { openingTag: '<think>', closingTag: '</think>', separator: '\n' },
  { openingTag: '###Thinking', closingTag: '###Response', separator: '\n' }
];

/**
 * Claude模型思考标签
 */
export const CLAUDE_REASONING_TAGS: ReasoningTag[] = [
  { openingTag: '<thinking>', closingTag: '</thinking>', separator: '\n' }
];

/**
 * Gemini模型思考标签
 */
export const GEMINI_REASONING_TAGS: ReasoningTag[] = [
  { openingTag: '<thinking>', closingTag: '</thinking>', separator: '\n' }
];

/**
 * Qwen模型思考标签
 */
export const QWEN_REASONING_TAGS: ReasoningTag[] = [
  { openingTag: '<think>', closingTag: '</think>', separator: '\n' }
];

/**
 * Grok模型思考标签
 */
export const GROK_REASONING_TAGS: ReasoningTag[] = [
  { openingTag: '<reasoning>', closingTag: '</reasoning>', separator: '\n' }
];

/**
 * DeepSeek模型思考标签
 */
export const DEEPSEEK_REASONING_TAGS: ReasoningTag[] = [
  { openingTag: '<reasoning>', closingTag: '</reasoning>', separator: '\n' }
];

/**
 * 智谱AI模型思考标签
 */
export const ZHIPU_REASONING_TAGS: ReasoningTag[] = [
  { openingTag: '<think>', closingTag: '</think>', separator: '\n' }
];

/**
 * 默认思考标签
 */
export const DEFAULT_REASONING_TAGS: ReasoningTag[] = [
  { openingTag: '<think>', closingTag: '</think>', separator: '\n' },
  { openingTag: '<thinking>', closingTag: '</thinking>', separator: '\n' },
  { openingTag: '<reasoning>', closingTag: '</reasoning>', separator: '\n' },
  { openingTag: '###Thinking', closingTag: '###Response', separator: '\n' }
];

/**
 * 获取适合模型的思考标签
 * @param model 模型对象
 * @returns 适合的思考标签
 */
export function getAppropriateTag(model: Model): ReasoningTag {
  if (isOpenAIReasoningModel(model)) {
    if (model.id.includes('qwen3')) {
      return QWEN_REASONING_TAGS[0];
    }
    return OPENAI_REASONING_TAGS[0];
  }

  if (isClaudeReasoningModel(model)) {
    return CLAUDE_REASONING_TAGS[0];
  }

  if (isGeminiReasoningModel(model)) {
    return GEMINI_REASONING_TAGS[0];
  }

  if (isQwenReasoningModel(model)) {
    return QWEN_REASONING_TAGS[0];
  }

  if (isGrokReasoningModel(model)) {
    return GROK_REASONING_TAGS[0];
  }

  if (isDeepSeekReasoningModel(model)) {
    return DEEPSEEK_REASONING_TAGS[0];
  }

  if (isZhipuReasoningModel(model)) {
    return ZHIPU_REASONING_TAGS[0];
  }

  // 默认使用第一个标签
  return DEFAULT_REASONING_TAGS[0];
}
