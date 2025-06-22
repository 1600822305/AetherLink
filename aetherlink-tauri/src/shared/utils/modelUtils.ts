/**
 * 模型工具函数
 * 提供与模型相关的工具函数
 */
import type { Model } from '../types';

/**
 * 检查模型是否支持多模态输入
 * @param model 模型对象
 * @returns 是否支持多模态输入
 */
export function isVisionModel(model: Model): boolean {
  const modelId = model.id;

  return Boolean(
    model.capabilities?.multimodal ||
    modelId.includes('gpt-4-vision') ||
    modelId.includes('gpt-4o') ||
    modelId.includes('claude-3') ||
    modelId.includes('gemini')
  );
}

/**
 * 检查模型是否是Claude模型
 * @param model 模型对象
 * @returns 是否是Claude模型
 */
export function isClaudeModel(model: Model): boolean {
  const modelId = model.id;

  return Boolean(
    modelId.includes('claude')
  );
}

/**
 * 检查模型是否是Gemini模型
 * @param model 模型对象
 * @returns 是否是Gemini模型
 */
export function isGeminiModel(model: Model): boolean {
  const modelId = model.id;

  return Boolean(
    modelId.includes('gemini')
  );
}

/**
 * 检查模型是否是Qwen模型
 * @param model 模型对象
 * @returns 是否是Qwen模型
 */
export function isQwenModel(model: Model): boolean {
  const modelId = model.id;

  return Boolean(
    modelId.includes('qwen')
  );
}

/**
 * 检查模型是否是Gemma模型
 * @param model 模型对象
 * @returns 是否是Gemma模型
 */
export function isGemmaModel(model: Model): boolean {
  const modelId = model.id;

  return Boolean(
    modelId.includes('gemma')
  );
}

/**
 * 检查模型是否是Mistral模型
 * @param model 模型对象
 * @returns 是否是Mistral模型
 */
export function isMistralModel(model: Model): boolean {
  const modelId = model.id;

  return Boolean(
    modelId.includes('mistral')
  );
}

/**
 * 检查模型是否是Llama模型
 * @param model 模型对象
 * @returns 是否是Llama模型
 */
export function isLlamaModel(model: Model): boolean {
  const modelId = model.id;

  return Boolean(
    modelId.includes('llama')
  );
}

/**
 * 检查模型是否是Grok模型
 * @param model 模型对象
 * @returns 是否是Grok模型
 */
export function isGrokModel(model: Model): boolean {
  const modelId = model.id;

  return Boolean(
    modelId.includes('grok')
  );
}

/**
 * 检查模型是否是DeepSeek模型
 * @param model 模型对象
 * @returns 是否是DeepSeek模型
 */
export function isDeepSeekModel(model: Model): boolean {
  const modelId = model.id;

  return Boolean(
    modelId.includes('deepseek')
  );
}

/**
 * 检查模型是否是Zhipu模型
 * @param model 模型对象
 * @returns 是否是Zhipu模型
 */
export function isZhipuModel(model: Model): boolean {
  const modelId = model.id;

  return Boolean(
    modelId.includes('zhipu') ||
    modelId.includes('glm')
  );
}

/**
 * 获取模型的最大上下文长度
 * @param model 模型对象
 * @returns 最大上下文长度
 */
export function getModelMaxContextLength(model: Model): number {
  // 如果模型对象中有maxContextLength属性，直接返回
  if ((model as any).maxContextLength) {
    return (model as any).maxContextLength;
  }

  const modelId = model.id;

  // GPT-4 Turbo
  if (modelId.includes('gpt-4-turbo')) {
    return 128000;
  }

  // GPT-4o
  if (modelId.includes('gpt-4o')) {
    return 128000;
  }

  // GPT-4
  if (modelId.includes('gpt-4')) {
    return 8192;
  }

  // GPT-3.5 Turbo
  if (modelId.includes('gpt-3.5-turbo')) {
    return 16384;
  }

  // Claude 3 Opus
  if (modelId.includes('claude-3-opus')) {
    return 200000;
  }

  // Claude 3 Sonnet
  if (modelId.includes('claude-3-sonnet')) {
    return 200000;
  }

  // Claude 3 Haiku
  if (modelId.includes('claude-3-haiku')) {
    return 200000;
  }

  // Claude 2
  if (modelId.includes('claude-2')) {
    return 100000;
  }

  // Gemini Pro
  if (modelId.includes('gemini-pro')) {
    return 32768;
  }

  // Gemini Ultra
  if (modelId.includes('gemini-ultra')) {
    return 32768;
  }

  // Qwen
  if (modelId.includes('qwen')) {
    return 32768;
  }

  // 默认值
  return 4096;
}

/**
 * 获取模型的最大输出长度
 * @param model 模型对象
 * @returns 最大输出长度
 */
export function getModelMaxOutputLength(model: Model): number {
  // 如果模型对象中有maxTokens属性，直接返回
  if (model.maxTokens) {
    return model.maxTokens;
  }

  const modelId = model.id;

  // GPT-4 Turbo
  if (modelId.includes('gpt-4-turbo')) {
    return 4096;
  }

  // GPT-4o
  if (modelId.includes('gpt-4o')) {
    return 4096;
  }

  // GPT-4
  if (modelId.includes('gpt-4')) {
    return 4096;
  }

  // GPT-3.5 Turbo
  if (modelId.includes('gpt-3.5-turbo')) {
    return 4096;
  }

  // Claude 3
  if (modelId.includes('claude-3')) {
    return 4096;
  }

  // Claude 2
  if (modelId.includes('claude-2')) {
    return 4096;
  }

  // Gemini
  if (modelId.includes('gemini')) {
    return 8192;
  }

  // Qwen
  if (modelId.includes('qwen')) {
    return 8192;
  }

  // 默认值
  return 2048;
}
