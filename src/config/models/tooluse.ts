/**
 * 工具调用/函数调用模型判定
 * 从 Cherry Studio 移植并适配 AetherLink
 */

import type { Model } from '../../shared/types';
import { getLowerBaseModelName } from './utils';
import { isEmbeddingModel, isRerankModel } from './embedding';

// 函数调用模型白名单
const FUNCTION_CALLING_MODELS = [
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-4',
  'gpt-4.5',
  'gpt-5',
  'o(1|3|4)(?:-[\\w-]+)?',
  'claude',
  'qwen',
  'qwen3',
  'hunyuan',
  'deepseek',
  'glm-4(?:-[\\w-]+)?',
  'learnlm(?:-[\\w-]+)?',
  'gemini(?:-[\\w-]+)?',
  'grok-3(?:-[\\w-]+)?',
  'grok-4(?:-[\\w-]+)?',
  'minimax-m\\d'
];

// 函数调用排除模型
const FUNCTION_CALLING_EXCLUDED_MODELS = [
  'aqa(?:-[\\w-]+)?',
  'imagen(?:-[\\w-]+)?',
  'o1-mini',
  'o1-preview'
];

// 函数调用模型正则
const FUNCTION_CALLING_REGEX = new RegExp(
  `\\b(?!(?:${FUNCTION_CALLING_EXCLUDED_MODELS.join('|')})\\b)(?:${FUNCTION_CALLING_MODELS.join('|')})\\b`,
  'i'
);

/**
 * 检查模型是否支持函数调用
 */
export function isFunctionCallingModel(model?: Model): boolean {
  if (!model || isEmbeddingModel(model) || isRerankModel(model)) {
    return false;
  }

  // 检查 modelTypes
  if (model.modelTypes?.includes('function_calling' as any) || model.modelTypes?.includes('tool' as any)) {
    return true;
  }

  // 检查 capabilities
  if (model.capabilities?.functionCalling || model.capabilities?.toolUse) {
    return true;
  }

  const modelId = getLowerBaseModelName(model.id);
  return FUNCTION_CALLING_REGEX.test(modelId);
}

/**
 * 检查模型是否支持工具使用
 */
export function isToolUseModel(model?: Model): boolean {
  return isFunctionCallingModel(model);
}
