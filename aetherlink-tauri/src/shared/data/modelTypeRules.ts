import { ModelType } from '../types';
import type { ModelTypeRule } from '../types';

// 预设的模型类型匹配规则
export const defaultModelTypeRules: ModelTypeRule[] = [
  // 视觉模型匹配规则
  {
    pattern: 'VL|vision|visual|image',
    types: [ModelType.Vision, ModelType.Chat],
  },
  {
    pattern: 'gpt-4-vision|gpt-4v',
    types: [ModelType.Vision, ModelType.Chat],
    provider: 'openai'
  },
  {
    pattern: 'gpt-4o',
    types: [ModelType.Vision, ModelType.Chat, ModelType.FunctionCalling, ModelType.WebSearch],
    provider: 'openai'
  },
  {
    pattern: 'gemini-(pro|ultra)-vision',
    types: [ModelType.Vision, ModelType.Chat],
    provider: 'google'
  },
  {
    pattern: 'claude-3-(opus|sonnet|haiku)',
    types: [ModelType.Vision, ModelType.Chat, ModelType.FunctionCalling],
    provider: 'anthropic'
  },
  {
    pattern: 'qwen.*vl',
    types: [ModelType.Vision, ModelType.Chat],
    provider: 'siliconflow'
  },

  // 图像生成模型匹配规则
  {
    pattern: 'FLUX|flux|black-forest|stable-diffusion|sd|dalle|midjourney',
    types: [ModelType.ImageGen],
  },
  {
    pattern: 'image|img|picture|generate',
    types: [ModelType.ImageGen],
  },

  // 视频生成模型匹配规则
  {
    pattern: 'HunyuanVideo|Wan.*T2V|Wan.*I2V|video.*gen|video.*generation',
    types: [ModelType.VideoGen],
  },
  {
    pattern: 'video|movie|film|motion',
    types: [ModelType.VideoGen],
  },

  // 嵌入模型匹配规则
  {
    pattern: 'embedding|text-embedding|embeddings',
    types: [ModelType.Embedding],
  },
  {
    pattern: 'text-embedding-.*|embedding-.*',
    types: [ModelType.Embedding],
    provider: 'openai'
  },
  {
    pattern: '.*-embedding-.*',
    types: [ModelType.Embedding],
    provider: 'google'
  },

  // 语音模型匹配规则
  {
    pattern: 'tts|whisper|audio|speech',
    types: [ModelType.Audio, ModelType.Transcription],
  },

  // 工具使用模型匹配规则
  {
    pattern: 'tool|function|plugin',
    types: [ModelType.Tool, ModelType.Chat, ModelType.FunctionCalling],
  },

  // 函数调用模型匹配规则
  {
    pattern: 'function.*calling|function-calling',
    types: [ModelType.FunctionCalling, ModelType.Chat],
  },
  {
    pattern: 'gpt-4-turbo|gpt-3.5-turbo',
    types: [ModelType.Chat, ModelType.FunctionCalling],
    provider: 'openai'
  },

  // 网络搜索模型匹配规则
  {
    pattern: 'web.*search|search|browse',
    types: [ModelType.WebSearch, ModelType.Chat],
  },
  {
    pattern: 'gpt-4-turbo-search|gpt-4o-search',
    types: [ModelType.WebSearch, ModelType.Chat],
    provider: 'openai'
  },

  // 重排序模型匹配规则
  {
    pattern: 'rerank|rank',
    types: [ModelType.Rerank],
  },

  // 代码生成模型匹配规则
  {
    pattern: 'code|codex|coder|copilot|starcoder|codellama',
    types: [ModelType.CodeGen, ModelType.Chat],
  },

  // 翻译模型匹配规则
  {
    pattern: 'translate|translation',
    types: [ModelType.Translation, ModelType.Chat],
  },

  // 推理模型匹配规则
  {
    pattern: 'reasoning|think|coder|math',
    types: [ModelType.Reasoning, ModelType.Chat],
  },
  {
    pattern: '.*-thinking-.*',
    types: [ModelType.Reasoning, ModelType.Chat],
  },
  {
    pattern: 'deepseek-reasoner|deepseek-r1',
    types: [ModelType.Reasoning, ModelType.Chat],
    provider: 'deepseek'
  },

  // 默认聊天模型规则
  {
    pattern: '.*',
    types: [ModelType.Chat],
  },
];

/**
 * 根据模型ID和提供商匹配相应的模型类型
 * @param modelId 模型ID
 * @param provider 提供商
 * @param rules 规则列表，默认使用预设规则
 * @returns 匹配的模型类型数组
 */
export function matchModelTypes(
  modelId: string,
  provider: string,
  rules: ModelTypeRule[] = defaultModelTypeRules
): ModelType[] {
  for (const rule of rules) {
    // 如果规则指定了提供商且不匹配，则跳过
    if (rule.provider && rule.provider !== provider) {
      continue;
    }

    try {
      const regex = new RegExp(rule.pattern, 'i');
      if (regex.test(modelId)) {
        return rule.types;
      }
    } catch (error) {
      // 如果正则表达式无效，则使用简单字符串匹配
      if (modelId.toLowerCase().includes(rule.pattern.toLowerCase())) {
        return rule.types;
      }
    }
  }

  // 默认返回Chat类型
  return [ModelType.Chat];
}

/**
 * 检查模型是否支持特定类型
 * @param modelTypes 模型类型数组
 * @param type 要检查的类型
 * @returns 是否支持该类型
 */
export function supportsModelType(modelTypes: ModelType[] | undefined, type: ModelType): boolean {
  return modelTypes ? modelTypes.includes(type) : false;
}

/**
 * 检查模型是否支持视觉功能
 * @param modelTypes 模型类型数组
 * @returns 是否支持视觉
 */
export function supportsVision(modelTypes: ModelType[] | undefined): boolean {
  return supportsModelType(modelTypes, ModelType.Vision);
}

/**
 * 检查模型是否支持音频功能
 * @param modelTypes 模型类型数组
 * @returns 是否支持音频
 */
export function supportsAudio(modelTypes: ModelType[] | undefined): boolean {
  return supportsModelType(modelTypes, ModelType.Audio);
}

/**
 * 获取模型类型的中文显示名称
 * @param type 模型类型
 * @returns 类型名称
 */
export function getModelTypeDisplayName(type: ModelType): string {
  const displayNames: Record<ModelType, string> = {
    [ModelType.Chat]: '聊天',
    [ModelType.Vision]: '视觉',
    [ModelType.Audio]: '语音',
    [ModelType.Embedding]: '嵌入向量',
    [ModelType.Tool]: '工具使用',
    [ModelType.Reasoning]: '推理',
    [ModelType.ImageGen]: '图像生成',
    [ModelType.VideoGen]: '视频生成',
    [ModelType.FunctionCalling]: '函数调用',
    [ModelType.WebSearch]: '网络搜索',
    [ModelType.Rerank]: '重排序',
    [ModelType.CodeGen]: '代码生成',
    [ModelType.Translation]: '翻译',
    [ModelType.Transcription]: '转录'
  };

  return displayNames[type] || type;
}