/**
 * 模型匹配模式常量
 * 定义用于识别不同类型模型的正则表达式和常量
 */

// 推理模型正则表达式
export const REASONING_REGEX =
  /^(o\d+(?:-[\w-]+)?|.*\b(?:reasoning|reasoner|thinking)\b.*|.*-[rR]\d+.*|.*\bqwq(?:-[\w-]+)?\b.*|.*\bhunyuan-t1(?:-[\w-]+)?\b.*|.*\bglm-zero-preview\b.*|.*\bgrok-3-mini(?:-[\w-]+)?\b.*)$/i;

// 视觉模型允许列表
const visionAllowedModels = [
  'gpt-4-vision',
  'gpt-4-vision-preview',
  'gpt-4o',
  'gpt-4o-mini',
  'claude-3',
  'claude-3-opus',
  'claude-3-sonnet',
  'claude-3-haiku',
  'gemini',
  'gemini-pro',
  'gemini-pro-vision',
  'gemini-1.5',
  'gemini-1.5-pro',
  'gemini-1.5-flash',
  'qwen-vl',
  'qwen-vl-plus',
  'qwen-vl-max',
  'qwen-vl-chat',
  'qwen-vl-chat-plus'
];

// 视觉模型排除列表
const visionExcludedModels = [
  'gpt-4-\\d+-preview',
  'gpt-4-turbo-preview',
  'gpt-4-32k',
  'gpt-4-\\d+',
  'o1-mini',
  'o3-mini',
  'o1-preview'
];

// 视觉模型正则表达式
export const VISION_REGEX = new RegExp(
  `\\b(?!(?:${visionExcludedModels.join('|')})\\b)(${visionAllowedModels.join('|')})\\b`,
  'i'
);

// 函数调用模型列表
export const FUNCTION_CALLING_MODELS = [
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-4',
  'gpt-4.5',
  'o(1|3|4)(?:-[\\w-]+)?',
  'claude',
  'qwen',
  'qwen3',
  'hunyuan',
  'deepseek',
  'glm-4(?:-[\\w-]+)?',
  'learnlm(?:-[\\w-]+)?',
  'gemini(?:-[\\w-]+)?',
  'grok-3(?:-[\\w-]+)?'
];

// 函数调用排除模型列表
const FUNCTION_CALLING_EXCLUDED_MODELS = [
  'aqa(?:-[\\w-]+)?',
  'imagen(?:-[\\w-]+)?',
  'o1-mini',
  'o1-preview'
];

// 函数调用模型正则表达式
export const FUNCTION_CALLING_REGEX = new RegExp(
  `\\b(?!(?:${FUNCTION_CALLING_EXCLUDED_MODELS.join('|')})\\b)(?:${FUNCTION_CALLING_MODELS.join('|')})\\b`,
  'i'
);

// Claude支持网页搜索的模型正则表达式
export const CLAUDE_SUPPORTED_WEBSEARCH_REGEX = new RegExp(
  `\\b(?:claude-3(-|\\.)(7|5)-sonnet(?:-[\\w-]+)|claude-3(-|\\.)5-haiku(?:-[\\w-]+))\\b`,
  'i'
);

// 不支持的模型正则表达式
export const NOT_SUPPORTED_REGEX = /(?:^tts|whisper|speech)/i;

// Gemini搜索模型列表
export const GEMINI_SEARCH_MODELS = [
  'gemini-1.5-pro',
  'gemini-1.5-flash',
  'gemini-2.0-pro',
  'gemini-2.0-flash',
  'gemini-2.0-pro-exp-02-05',
  'gemini-2.0-flash-exp',
  'gemini-2.0-flash-search',
  'gemini-2.0-flash-exp-search',
  'gemini-2.0-pro-exp-02-05-search',
  'gemini-2.5-pro-preview-06-05',
  'gemini-2.5-pro-preview-05-06',
  'gemini-2.5-flash-preview-04-17'
];

// Perplexity搜索模型列表
export const PERPLEXITY_SEARCH_MODELS = [
  'pplx-7b-online',
  'pplx-70b-online',
  'pplx-7b-chat',
  'pplx-70b-chat',
  'sonar-small-online',
  'sonar-medium-online',
  'sonar-small-chat',
  'sonar-medium-chat'
];
