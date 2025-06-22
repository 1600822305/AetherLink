/**
 * 模型检测函数
 * 用于检测模型的各种能力和特性
 */
import type { Model } from '../types';

/**
 * 检查模型是否支持推理功能
 * @param model 模型对象
 * @returns 是否支持推理
 */
export function isReasoningModel(model: Model): boolean {
  // 首先检查模型类型是否包含推理类型
  if (model.modelTypes && model.modelTypes.includes('reasoning')) {
    return true;
  }

  const modelId = model.id;

  // 如果是deepseek-reasoner模型，则默认支持推理
  if (modelId === 'deepseek-reasoner') {
    return true;
  }

  // 如果是deepseek-chat模型，则需要检查modelTypes
  if (modelId === 'deepseek-chat') {
    // 如果明确设置了modelTypes但不包含reasoning，则不支持推理
    if (model.modelTypes && !model.modelTypes.includes('reasoning')) {
      return false;
    }
  }

  return Boolean(
    model.capabilities?.reasoning ||
    modelId.includes('gpt-4') ||
    modelId.includes('gpt-4o') ||
    modelId.includes('claude-3') ||
    modelId.includes('gemini') ||
    modelId.includes('qwen3') ||
    modelId.includes('deepseek-coder') ||
    (modelId.includes('deepseek-chat') && !model.modelTypes) || // 只有在未设置modelTypes时才默认支持
    modelId.includes('grok')
  );
}

/**
 * 检查模型是否支持OpenAI风格的推理参数
 * @param model 模型对象
 * @returns 是否支持OpenAI风格的推理参数
 */
export function isOpenAIReasoningModel(model: Model): boolean {
  const modelId = model.id;

  return Boolean(
    modelId.includes('gpt-4') ||
    modelId.includes('gpt-4o')
  );
}

/**
 * 检查模型是否支持Claude风格的推理参数
 * @param model 模型对象
 * @returns 是否支持Claude风格的推理参数
 */
export function isClaudeReasoningModel(model: Model): boolean {
  const modelId = model.id;

  return Boolean(
    modelId.includes('claude-3')
  );
}

/**
 * 检查模型是否支持Gemini风格的推理参数
 * @param model 模型对象
 * @returns 是否支持Gemini风格的推理参数
 */
export function isGeminiReasoningModel(model: Model): boolean {
  const modelId = model.id;

  return Boolean(
    modelId.includes('gemini')
  );
}

/**
 * 检查模型是否支持Qwen风格的推理参数
 * @param model 模型对象
 * @returns 是否支持Qwen风格的推理参数
 */
export function isQwenReasoningModel(model: Model): boolean {
  const modelId = model.id;

  return Boolean(
    modelId.includes('qwen3')
  );
}

/**
 * 检查模型是否支持Grok风格的推理参数
 * @param model 模型对象
 * @returns 是否支持Grok风格的推理参数
 */
export function isGrokReasoningModel(model: Model): boolean {
  const modelId = model.id;

  return Boolean(
    modelId.includes('grok')
  );
}

/**
 * 检查模型是否支持推理努力程度参数
 * @param model 模型对象
 * @returns 是否支持推理努力程度参数
 */
export function isSupportedReasoningEffortModel(model: Model): boolean {
  return isOpenAIReasoningModel(model) || isGrokReasoningModel(model);
}

/**
 * 检查模型是否支持思考token参数
 * @param model 模型对象
 * @returns 是否支持思考token参数
 */
export function isSupportedThinkingTokenModel(model: Model): boolean {
  return isClaudeReasoningModel(model) || isGeminiReasoningModel(model) || isQwenReasoningModel(model);
}

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
 * 支持函数调用的模型列表
 */
const FUNCTION_CALLING_MODELS = [
  // OpenAI 模型
  'gpt-4',
  'gpt-4-turbo',
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-3.5-turbo',
  'gpt-3.5-turbo-16k',

  // Anthropic 模型
  'claude-3-opus',
  'claude-3-sonnet',
  'claude-3-haiku',
  'claude-3-5-sonnet',
  'claude-3-5-haiku',

  // Google 模型
  'gemini-pro',
  'gemini-1.5-pro',
  'gemini-1.5-flash',
  'gemini-ultra',

  // 其他支持函数调用的模型
  'mistral-large',
  'mistral-medium',
  'command-r',
  'command-r-plus',
];

/**
 * 支持函数调用的模型模式匹配
 */
const FUNCTION_CALLING_PATTERNS = [
  /^gpt-4/i,
  /^gpt-3\.5-turbo/i,
  /^claude-3/i,
  /^gemini/i,
  /^mistral/i,
  /^command-r/i,
  /^llama.*function/i,
  /^qwen.*chat/i,
  /^yi.*chat/i,
];

/**
 * 检查模型是否支持函数调用
 * @param model 模型对象
 * @returns 是否支持函数调用
 */
export function isFunctionCallingModel(model: Model): boolean {
  if (!model || !model.id) {
    return false;
  }

  // 首先检查模型能力配置
  if (model.capabilities?.functionCalling !== undefined) {
    return model.capabilities.functionCalling;
  }

  const modelId = model.id.toLowerCase();

  // 检查精确匹配
  if (FUNCTION_CALLING_MODELS.some(m => modelId.includes(m.toLowerCase()))) {
    return true;
  }

  // 检查模式匹配
  if (FUNCTION_CALLING_PATTERNS.some(pattern => pattern.test(modelId))) {
    return true;
  }

  // 检查提供商特定的函数调用支持
  if (model.provider) {
    switch (model.provider.toLowerCase()) {
      case 'openai':
        // OpenAI 的大部分模型都支持函数调用
        return modelId.includes('gpt') && !modelId.includes('instruct');

      case 'anthropic':
        // Anthropic 的 Claude 3 系列支持函数调用
        return modelId.includes('claude-3');

      case 'google':
      case 'gemini':
        // Google 的 Gemini 系列支持函数调用
        return modelId.includes('gemini');

      case 'mistral':
        // Mistral 的部分模型支持函数调用
        return modelId.includes('large') || modelId.includes('medium');

      case 'cohere':
        // Cohere 的 Command R 系列支持函数调用
        return modelId.includes('command-r');

      default:
        return false;
    }
  }

  return false;
}

/**
 * 检查模型是否支持图像生成
 * @param model 模型对象
 * @returns 是否支持图像生成
 */
export function isGenerateImageModel(model: Model): boolean {
  const modelId = model.id;

  return Boolean(
    model.capabilities?.imageGeneration ||
    modelId.includes('gemini-2.0-flash') ||
    modelId.includes('gemini-exp-1206') ||
    modelId.includes('dall-e') ||
    modelId.includes('midjourney') ||
    modelId.includes('stable-diffusion')
  );
}

/**
 * 检查模型是否支持网络搜索
 * @param model 模型对象
 * @returns 是否支持网络搜索
 */
export function isWebSearchModel(model: Model): boolean {
  const modelId = model.id;

  return Boolean(
    model.capabilities?.webSearch ||
    modelId.includes('gemini') ||
    modelId.includes('gpt-4o') ||
    modelId.includes('claude-3')
  );
}

/**
 * 检查模型是否支持嵌入向量
 * @param model 模型对象
 * @returns 是否支持嵌入向量
 */
export function isEmbeddingModel(model: Model): boolean {
  // 首先检查模型类型是否包含嵌入类型
  if (model.modelTypes && model.modelTypes.includes('embedding')) {
    return true;
  }

  const modelId = model.id;

  // 检查常见的嵌入模型ID模式
  return Boolean(
    modelId.includes('embedding') ||
    modelId.includes('text-embedding') ||
    modelId.includes('embed') ||
    modelId === 'text-embedding-3-small' ||
    modelId === 'text-embedding-3-large' ||
    modelId === 'text-embedding-ada-002' ||
    modelId.includes('gemini-embedding') ||
    modelId.includes('Doubao-embedding') ||
    modelId.includes('bge-') ||
    modelId.includes('jina-embeddings')
  );
}

/**
 * 检查是否为Gemma模型
 * @param model 模型对象
 * @returns 是否为Gemma模型
 */
export function isGemmaModel(model: Model): boolean {
  const modelId = model.id;
  return modelId.includes('gemma');
}

/**
 * 查找模型的token限制
 * @param modelId 模型ID
 * @returns token限制信息
 */
export function findTokenLimit(modelId: string): { max: number; input?: number; output?: number } | null {
  const limits: Record<string, { max: number; input?: number; output?: number }> = {
    'gemini-1.5-pro': { max: 2097152, input: 2097152, output: 8192 },
    'gemini-1.5-flash': { max: 1048576, input: 1048576, output: 8192 },
    'gemini-2.0-flash-exp': { max: 1048576, input: 1048576, output: 8192 },
    'gemini-2.5-pro': { max: 2097152, input: 1048576, output: 65536 },
    'gemini-2.5-flash': { max: 1048576, input: 1048576, output: 65536 },
    'gemini-2.5-flash-lite': { max: 1048576, input: 1048576, output: 8192 },
    'gemini-2.5-pro-preview-06-05': { max: 2097152, input: 1048576, output: 65536 },
    'gemini-2.5-pro-preview-05-06': { max: 2097152, input: 1048576, output: 65536 },
    'gemini-2.5-flash-preview-04-17': { max: 1048576, input: 1048576, output: 65536 },
    'gemini-pro': { max: 32768, input: 30720, output: 2048 },
    'gemini-pro-vision': { max: 16384, input: 12288, output: 4096 },
    'gpt-4': { max: 8192, input: 8192, output: 4096 },
    'gpt-4-turbo': { max: 128000, input: 128000, output: 4096 },
    'gpt-4o': { max: 128000, input: 128000, output: 16384 },
    'claude-3-opus': { max: 200000, input: 200000, output: 4096 },
    'claude-3-sonnet': { max: 200000, input: 200000, output: 4096 },
    'claude-3-haiku': { max: 200000, input: 200000, output: 4096 }
  };

  return limits[modelId] || null;
}
