/**
 * 常量定义文件
 * 包含应用程序中使用的各种常量
 */

// 默认设置
export const DEFAULT_TEMPERATURE = 1.0;
export const DEFAULT_CONTEXTCOUNT = 5;
export const DEFAULT_MAX_TOKENS = 4096;

// 推理努力程度比率
export type ReasoningEffortOptions = 'low' | 'medium' | 'high' | 'auto';
export type EffortRatio = Record<ReasoningEffortOptions, number>;

export const EFFORT_RATIO: EffortRatio = {
  low: 0.2,
  medium: 0.5,
  high: 0.8,
  auto: 2
};

// 模型思考token限制
export const THINKING_TOKEN_MAP: Record<string, { min: number; max: number }> = {
  // OpenAI models
  'gpt-4-.*$': { min: 1024, max: 128000 },
  'gpt-4o-.*$': { min: 1024, max: 128000 },
  
  // Gemini models
  'gemini-.*$': { min: 0, max: 24576 },

  // Qwen models
  'qwen-plus-.*$': { min: 0, max: 38912 },
  'qwen-turbo-.*$': { min: 0, max: 38912 },
  'qwen3-0\\.6b$': { min: 0, max: 30720 },
  'qwen3-1\\.7b$': { min: 0, max: 30720 },
  'qwen3-.*$': { min: 1024, max: 38912 },

  // Claude models
  'claude-3[.-]7.*sonnet.*$': { min: 1024, max: 64000 },
  'claude-3-.*$': { min: 1024, max: 64000 }
};

/**
 * 查找模型的token限制
 * @param modelId 模型ID
 * @returns token限制，如果未找到则返回undefined
 */
export function findTokenLimit(modelId: string): { min: number; max: number } | undefined {
  for (const [pattern, limits] of Object.entries(THINKING_TOKEN_MAP)) {
    if (new RegExp(pattern, 'i').test(modelId)) {
      return limits;
    }
  }
  return undefined;
}

// 文件大小常量
export const KB = 1024;
export const MB = 1024 * KB;
export const GB = 1024 * MB;
