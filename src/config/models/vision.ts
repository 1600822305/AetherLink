/**
 * 视觉模型判定
 * 从 Cherry Studio 移植并适配 AetherLink
 */

import type { Model } from '../../shared/types';
import { isUserSelectedModelType } from './types';
import { getLowerBaseModelName } from './utils';
import { isEmbeddingModel, isRerankModel } from './embedding.ts';
import { isFunctionCallingModel } from './tooluse.ts';

// 视觉模型白名单
const visionAllowedModels = [
  'llava',
  'moondream',
  'minicpm',
  'gemini-1\\.5',
  'gemini-2\\.0',
  'gemini-2\\.5',
  'gemini-3-(?:flash|pro)(?:-preview)?',
  'gemini-(flash|pro|flash-lite)-latest',
  'gemini-exp',
  'claude-3',
  'claude-haiku-4',
  'claude-sonnet-4',
  'claude-opus-4',
  'vision',
  'glm-4(?:\\.\\d+)?v(?:-[\\w-]+)?',
  'qwen-vl',
  'qwen2-vl',
  'qwen2.5-vl',
  'qwen3-vl',
  'qwen2.5-omni',
  'qwen3-omni(?:-[\\w-]+)?',
  'qvq',
  'internvl2',
  'grok-vision-beta',
  'grok-4(?:-[\\w-]+)?',
  'pixtral',
  'gpt-4(?:-[\\w-]+)',
  'gpt-4.1(?:-[\\w-]+)?',
  'gpt-4o(?:-[\\w-]+)?',
  'gpt-4.5(?:-[\\w-]+)',
  'gpt-5(?:-[\\w-]+)?',
  'chatgpt-4o(?:-[\\w-]+)?',
  'o1(?:-[\\w-]+)?',
  'o3(?:-[\\w-]+)?',
  'o4(?:-[\\w-]+)?',
  'deepseek-vl(?:[\\w-]+)?',
  'kimi-latest',
  'gemma-3(?:-[\\w-]+)',
  'doubao-seed-1[.-][68](?:-[\\w-]+)?',
  'doubao-seed-code(?:-[\\w-]+)?',
  'kimi-thinking-preview',
  `gemma3(?:[-:\\w]+)?`,
  'kimi-vl-a3b-thinking(?:-[\\w-]+)?',
  'llama-guard-4(?:-[\\w-]+)?',
  'llama-4(?:-[\\w-]+)?',
  'step-1o(?:.*vision)?',
  'step-1v(?:-[\\w-]+)?',
  'qwen-omni(?:-[\\w-]+)?',
  'mistral-large-(2512|latest)',
  'mistral-medium-(2508|latest)',
  'mistral-small-(2506|latest)',
  'minimax-m3(?:-[\\w-]+)?'
];

// 视觉模型排除列表
const visionExcludedModels = [
  'gpt-4-\\d+-preview',
  'gpt-4-turbo-preview',
  'gpt-4-32k',
  'gpt-4-\\d+',
  'o1-mini',
  'o3-mini',
  'o1-preview',
  'AIDC-AI/Marco-o1'
];

// 视觉模型正则
const VISION_REGEX = new RegExp(
  `\\b(?!(?:${visionExcludedModels.join('|')})\\b)(${visionAllowedModels.join('|')})\\b`,
  'i'
);

// 专用图像生成模型
const DEDICATED_IMAGE_MODELS = [
  'grok-2-image(?:-[\\w-]+)?',
  'dall-e(?:-[\\w-]+)?',
  'gpt-image-1(?:-[\\w-]+)?',
  'imagen(?:-[\\w-]+)?'
];

// 图像增强模型
const IMAGE_ENHANCEMENT_MODELS = [
  'grok-2-image(?:-[\\w-]+)?',
  'qwen-image-edit',
  'gpt-image-1',
  'gemini-2.5-flash-image(?:-[\\w-]+)?',
  'gemini-2.0-flash-preview-image-generation',
  'gemini-3(?:\\.\\d+)?-pro-image(?:-[\\w-]+)?'
];

const IMAGE_ENHANCEMENT_MODELS_REGEX = new RegExp(IMAGE_ENHANCEMENT_MODELS.join('|'), 'i');
const DEDICATED_IMAGE_MODELS_REGEX = new RegExp(DEDICATED_IMAGE_MODELS.join('|'), 'i');

// 自动启用图像生成的模型
const AUTO_ENABLE_IMAGE_MODELS = [
  'gemini-2.5-flash-image(?:-[\\w-]+)?',
  'gemini-3(?:\\.\\d+)?-pro-image(?:-[\\w-]+)?',
  ...DEDICATED_IMAGE_MODELS
];
const AUTO_ENABLE_IMAGE_MODELS_REGEX = new RegExp(AUTO_ENABLE_IMAGE_MODELS.join('|'), 'i');

// OpenAI工具使用图像生成模型
const OPENAI_TOOL_USE_IMAGE_GENERATION_MODELS = [
  'o3',
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-4.1',
  'gpt-4.1-mini',
  'gpt-4.1-nano',
  'gpt-5'
];

const OPENAI_IMAGE_GENERATION_MODELS = [...OPENAI_TOOL_USE_IMAGE_GENERATION_MODELS, 'gpt-image-1'];
const OPENAI_IMAGE_GENERATION_MODELS_REGEX = new RegExp(OPENAI_IMAGE_GENERATION_MODELS.join('|'), 'i');

// 现代图像模型
const MODERN_IMAGE_MODELS = ['gemini-3(?:\\.\\d+)?-pro-image(?:-[\\w-]+)?'];

// 图像生成模型
const GENERATE_IMAGE_MODELS = [
  'gemini-2.0-flash-exp(?:-[\\w-]+)?',
  'gemini-2.5-flash-image(?:-[\\w-]+)?',
  'gemini-2.0-flash-preview-image-generation',
  ...MODERN_IMAGE_MODELS,
  ...DEDICATED_IMAGE_MODELS
];
const GENERATE_IMAGE_MODELS_REGEX = new RegExp(GENERATE_IMAGE_MODELS.join('|'), 'i');
const MODERN_GENERATE_IMAGE_MODELS_REGEX = new RegExp(MODERN_IMAGE_MODELS.join('|'), 'i');

// 文本到图像模型正则
const TEXT_TO_IMAGE_REGEX = /flux|diffusion|stabilityai|sd-|dall|cogview|janus|midjourney|mj-|imagen|gpt-image/i;

/**
 * 检查模型是否为视觉模型
 */
export function isVisionModel(model?: Model): boolean {
  if (!model || isEmbeddingModel(model) || isRerankModel(model)) {
    return false;
  }

  // 检查用户自定义类型
  const userSelected = isUserSelectedModelType(model, 'vision');
  if (userSelected !== undefined) {
    return userSelected;
  }

  // 检查 capabilities
  if (model.capabilities?.multimodal || model.capabilities?.vision) {
    return true;
  }

  const modelId = getLowerBaseModelName(model.id);
  
  // 豆包模型特殊处理
  if (model.provider === 'doubao' || modelId.includes('doubao')) {
    return VISION_REGEX.test(model.name || '') || VISION_REGEX.test(modelId);
  }

  return VISION_REGEX.test(modelId) || IMAGE_ENHANCEMENT_MODELS_REGEX.test(modelId);
}

/**
 * 检查模型是否为专用图像生成模型
 */
export function isDedicatedImageGenerationModel(model?: Model): boolean {
  if (!model) return false;
  const modelId = getLowerBaseModelName(model.id);
  return DEDICATED_IMAGE_MODELS_REGEX.test(modelId);
}

/**
 * 检查模型是否自动启用图像生成
 */
export function isAutoEnableImageGenerationModel(model?: Model): boolean {
  if (!model) return false;
  const modelId = getLowerBaseModelName(model.id);
  return AUTO_ENABLE_IMAGE_MODELS_REGEX.test(modelId);
}

/**
 * 检查模型是否支持对话式图片生成
 */
export function isGenerateImageModel(model?: Model): boolean {
  if (!model || isEmbeddingModel(model) || isRerankModel(model)) {
    return false;
  }

  // 检查 capabilities
  if (model.capabilities?.imageGeneration || model.imageGeneration) {
    return true;
  }

  // 检查 modelTypes
  if (model.modelTypes?.includes('image_gen' as any)) {
    return true;
  }

  const modelId = getLowerBaseModelName(model.id, '/');

  // OpenAI Response 模式特殊处理
  if (model.provider === 'openai-response') {
    return OPENAI_IMAGE_GENERATION_MODELS_REGEX.test(modelId) || GENERATE_IMAGE_MODELS_REGEX.test(modelId);
  }

  return GENERATE_IMAGE_MODELS_REGEX.test(modelId);
}

/**
 * 检查模型是否为纯图片生成模型（不支持工具调用）
 */
export function isPureGenerateImageModel(model?: Model): boolean {
  if (!model) return false;
  
  if (!isGenerateImageModel(model) && !isTextToImageModel(model)) {
    return false;
  }

  if (isFunctionCallingModel(model)) {
    return false;
  }

  const modelId = getLowerBaseModelName(model.id);
  if (GENERATE_IMAGE_MODELS_REGEX.test(modelId) && !MODERN_GENERATE_IMAGE_MODELS_REGEX.test(modelId)) {
    return true;
  }

  return !OPENAI_TOOL_USE_IMAGE_GENERATION_MODELS.some((m) => modelId.includes(m));
}

/**
 * 检查模型是否为文本到图像模型
 */
export function isTextToImageModel(model?: Model): boolean {
  if (!model) return false;
  const modelId = getLowerBaseModelName(model.id);
  return TEXT_TO_IMAGE_REGEX.test(modelId);
}

/**
 * 检查模型是否支持图像增强
 */
export function isImageEnhancementModel(model?: Model): boolean {
  if (!model) return false;
  const modelId = getLowerBaseModelName(model.id);
  return IMAGE_ENHANCEMENT_MODELS_REGEX.test(modelId);
}

/**
 * 检查多个模型是否都是视觉模型
 */
export function isVisionModels(models: Model[]): boolean {
  return models.every((model) => isVisionModel(model));
}

/**
 * 检查多个模型是否都是图像生成模型
 */
export function isGenerateImageModels(models: Model[]): boolean {
  return models.every((model) => isGenerateImageModel(model));
}
