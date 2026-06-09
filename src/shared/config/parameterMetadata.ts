/**
 * 参数元数据配置
 * 定义各供应商支持的参数及其UI配置
 */

import type { ProviderType } from '../api/parameters/types';
import type { Model } from '../types';
import { getModelSupportedReasoningEffort } from '../../config/models';

/**
 * 参数类型
 */
export type ParameterInputType = 'slider' | 'number' | 'select' | 'switch' | 'text' | 'json';

/**
 * 参数元数据
 */
export interface ParameterMetadata {
  /** 参数键名 */
  key: string;
  /** 显示名称 */
  label: string;
  /** 描述 */
  description: string;
  /** 输入类型 */
  inputType: ParameterInputType;
  /** 默认值 */
  defaultValue: any;
  /** 是否必填 */
  required?: boolean;
  /** 分类 */
  category: 'basic' | 'advanced' | 'reasoning' | 'tools';
  /** 支持的供应商 */
  providers: ProviderType[];
  /** 数值范围配置 */
  range?: {
    min: number;
    max: number;
    step: number;
  };
  /** 选项配置 (select 类型) */
  options?: Array<{ value: any; label: string }>;
  /** 滑块标记 */
  marks?: Array<{ value: number; label: string }>;
  /** 单位 */
  unit?: string;
  /** 条件显示 (依赖其他参数) */
  showWhen?: {
    key: string;
    value: any;
  };
}

/**
 * 参数分类
 */
export interface ParameterCategory {
  key: string;
  label: string;
  description: string;
  icon?: string;
}

/**
 * 参数分类定义
 */
export const PARAMETER_CATEGORIES: ParameterCategory[] = [
  { key: 'basic', label: '基础参数', description: '控制生成质量和长度' },
  { key: 'advanced', label: '高级参数', description: '微调模型行为' },
  { key: 'reasoning', label: '推理参数', description: '控制思考过程' },
  { key: 'tools', label: '工具参数', description: '配置内置工具' }
];

/**
 * 所有参数元数据
 */
export const PARAMETER_METADATA: ParameterMetadata[] = [
  // ==================== 基础参数 ====================
  {
    key: 'temperature',
    label: '温度',
    description: '控制输出随机性。较高值产生更多样化的输出，较低值更确定性',
    inputType: 'slider',
    defaultValue: 0.7,
    category: 'basic',
    providers: ['openai', 'anthropic', 'gemini', 'openai-compatible'],
    range: { min: 0, max: 2, step: 0.1 },
    marks: [
      { value: 0, label: '精确' },
      { value: 0.7, label: '平衡' },
      { value: 1.5, label: '创意' },
      { value: 2, label: '随机' }
    ]
  },
  {
    key: 'topP',
    label: 'Top P (核采样)',
    description: '从概率和达到 P 的 token 中采样。建议不与温度同时调整',
    inputType: 'slider',
    defaultValue: 1.0,
    category: 'basic',
    providers: ['openai', 'anthropic', 'gemini', 'openai-compatible'],
    range: { min: 0, max: 1, step: 0.05 },
    marks: [
      { value: 0.1, label: '0.1' },
      { value: 0.5, label: '0.5' },
      { value: 0.9, label: '0.9' },
      { value: 1, label: '1' }
    ]
  },
  {
    key: 'maxOutputTokens',
    label: '最大输出 Token',
    description: '限制生成回复的最大长度',
    inputType: 'slider',
    defaultValue: 4096,
    category: 'basic',
    providers: ['openai', 'anthropic', 'gemini', 'openai-compatible'],
    range: { min: 256, max: 65536, step: 256 },
    marks: [
      { value: 2048, label: '2K' },
      { value: 8192, label: '8K' },
      { value: 32768, label: '32K' },
      { value: 65536, label: '64K' }
    ],
    unit: 'tokens'
  },
  {
    key: 'topK',
    label: 'Top K',
    description: '从概率最高的 K 个 token 中采样',
    inputType: 'slider',
    defaultValue: 40,
    category: 'basic',
    providers: ['anthropic', 'gemini', 'openai-compatible'],
    range: { min: 1, max: 100, step: 1 },
    marks: [
      { value: 1, label: '1' },
      { value: 40, label: '40' },
      { value: 100, label: '100' }
    ]
  },

  // ==================== 高级参数 ====================
  {
    key: 'frequencyPenalty',
    label: '频率惩罚',
    description: '降低重复使用相同词语的可能性',
    inputType: 'slider',
    defaultValue: 0,
    category: 'advanced',
    providers: ['openai', 'openai-compatible'],
    range: { min: -2, max: 2, step: 0.1 },
    marks: [
      { value: -2, label: '-2' },
      { value: 0, label: '0' },
      { value: 2, label: '2' }
    ]
  },
  {
    key: 'presencePenalty',
    label: '存在惩罚',
    description: '降低重复已出现主题的可能性',
    inputType: 'slider',
    defaultValue: 0,
    category: 'advanced',
    providers: ['openai', 'openai-compatible'],
    range: { min: -2, max: 2, step: 0.1 },
    marks: [
      { value: -2, label: '-2' },
      { value: 0, label: '0' },
      { value: 2, label: '2' }
    ]
  },
  {
    key: 'seed',
    label: '随机种子',
    description: '设置相同种子可获得确定性输出',
    inputType: 'number',
    defaultValue: null,
    category: 'advanced',
    providers: ['openai', 'openai-compatible']
  },
  {
    key: 'stopSequences',
    label: '停止序列',
    description: '遇到这些文本时停止生成 (逗号分隔)',
    inputType: 'text',
    defaultValue: '',
    category: 'advanced',
    providers: ['openai', 'anthropic', 'gemini', 'openai-compatible']
  },
  {
    key: 'responseFormat',
    label: '响应格式',
    description: '指定输出格式',
    inputType: 'select',
    defaultValue: 'text',
    category: 'advanced',
    providers: ['openai', 'openai-compatible'],
    options: [
      { value: 'text', label: '文本' },
      { value: 'json_object', label: 'JSON 对象' }
    ]
  },
  {
    key: 'streamOutput',
    label: '流式输出',
    description: '启用流式输出，实时显示生成内容。关闭后将等待完整响应后一次性显示',
    inputType: 'switch',
    defaultValue: true,
    category: 'advanced',
    providers: ['openai', 'anthropic', 'gemini', 'openai-compatible']
  },
  {
    key: 'parallelToolCalls',
    label: '并行工具调用',
    description: '允许模型同时调用多个工具',
    inputType: 'switch',
    defaultValue: true,
    category: 'advanced',
    providers: ['openai', 'openai-compatible']
  },
  {
    key: 'logprobs',
    label: 'Token 概率',
    description: '返回每个 token 的概率信息',
    inputType: 'switch',
    defaultValue: false,
    category: 'advanced',
    providers: ['openai']
  },
  {
    key: 'user',
    label: '用户标识',
    description: '用于追踪和分析的用户 ID',
    inputType: 'text',
    defaultValue: '',
    category: 'advanced',
    providers: ['openai', 'anthropic']
  },

  // ==================== 推理参数 ====================
  {
    key: 'reasoningEffort',
    label: '推理努力程度',
    description: '控制模型思考的深度',
    inputType: 'select',
    defaultValue: 'medium',
    category: 'reasoning',
    providers: ['openai', 'anthropic', 'gemini', 'openai-compatible'],
    options: [
      { value: 'off', label: '关闭' },
      { value: 'low', label: '低' },
      { value: 'medium', label: '中 (推荐)' },
      { value: 'high', label: '高' }
    ]
  },
  {
    key: 'thinkingBudget',
    label: '思考预算',
    description: '分配给思考过程的 token 数量',
    inputType: 'slider',
    defaultValue: 2048,
    category: 'reasoning',
    providers: ['openai', 'anthropic', 'gemini', 'openai-compatible'],
    range: { min: 128, max: 32768, step: 128 },
    marks: [
      { value: 128, label: '128' },
      { value: 4096, label: '4K' },
      { value: 16384, label: '16K' },
      { value: 32768, label: '32K' }
    ],
    unit: 'tokens',
    showWhen: { key: 'reasoningEffort', value: ['minimal', 'low', 'medium', 'high', 'xhigh', 'auto'] }
  },
  {
    key: 'includeThoughts',
    label: '显示思考过程',
    description: '在响应中包含模型的思考过程',
    inputType: 'switch',
    defaultValue: true,
    category: 'reasoning',
    providers: ['gemini'],
    showWhen: { key: 'reasoningEffort', value: ['minimal', 'low', 'medium', 'high', 'xhigh', 'auto'] }
  },

  // ==================== Anthropic 特有参数 ====================
  {
    key: 'cacheControl',
    label: '提示缓存',
    description: '启用提示缓存以加速重复请求',
    inputType: 'switch',
    defaultValue: false,
    category: 'advanced',
    providers: ['anthropic']
  },
  {
    key: 'structuredOutputMode',
    label: '结构化输出模式',
    description: '控制结构化输出的生成方式',
    inputType: 'select',
    defaultValue: 'auto',
    category: 'advanced',
    providers: ['anthropic'],
    options: [
      { value: 'auto', label: '自动' },
      { value: 'outputFormat', label: '输出格式' },
      { value: 'jsonTool', label: 'JSON 工具' }
    ]
  },

  // ==================== 工具参数 ====================
  {
    key: 'webSearchEnabled',
    label: 'Web 搜索',
    description: '允许模型搜索网络获取最新信息',
    inputType: 'switch',
    defaultValue: false,
    category: 'tools',
    providers: ['anthropic']
  },
  {
    key: 'codeExecutionEnabled',
    label: '代码执行',
    description: '允许模型执行 Python 代码',
    inputType: 'switch',
    defaultValue: false,
    category: 'tools',
    providers: ['anthropic']
  },
  {
    key: 'useSearchGrounding',
    label: 'Google 搜索',
    description: '使用 Google 搜索获取最新信息',
    inputType: 'switch',
    defaultValue: false,
    category: 'tools',
    providers: ['gemini']
  },

  // ==================== Gemini 安全设置 ====================
  {
    key: 'safetyLevel',
    label: '安全级别',
    description: '控制内容安全过滤强度',
    inputType: 'select',
    defaultValue: 'BLOCK_MEDIUM_AND_ABOVE',
    category: 'advanced',
    providers: ['gemini'],
    options: [
      { value: 'BLOCK_NONE', label: '无限制' },
      { value: 'BLOCK_ONLY_HIGH', label: '仅阻止高风险' },
      { value: 'BLOCK_MEDIUM_AND_ABOVE', label: '阻止中等及以上风险' },
      { value: 'BLOCK_LOW_AND_ABOVE', label: '阻止低等及以上风险' }
    ]
  }
];

/**
 * 推理努力程度各档位的中文标签
 */
const REASONING_EFFORT_LABELS: Record<string, string> = {
  default: '默认',
  none: '关闭',
  off: '关闭',
  minimal: '极简',
  low: '低',
  medium: '中 (推荐)',
  high: '高',
  xhigh: '最高',
  auto: '自动'
};

/** 无模型信息时的回退选项（与旧静态选项保持一致） */
const DEFAULT_REASONING_EFFORT_OPTIONS: Array<{ value: any; label: string }> = [
  { value: 'off', label: '关闭' },
  { value: 'low', label: '低' },
  { value: 'medium', label: '中 (推荐)' },
  { value: 'high', label: '高' }
];

/**
 * 根据具体模型获取「推理努力程度」可选项（单一事实源：config/models 能力表）。
 * 例如 DeepSeek V4 只暴露 关闭 / 高 / 最高；GPT-5 暴露 极简/低/中/高 等。
 * 未提供 modelId 时回退到静态默认选项。
 */
export function getReasoningEffortOptions(modelId?: string): Array<{ value: any; label: string }> {
  if (!modelId) return DEFAULT_REASONING_EFFORT_OPTIONS;
  const efforts = getModelSupportedReasoningEffort({ id: modelId } as Model);
  if (!efforts || efforts.length === 0) return DEFAULT_REASONING_EFFORT_OPTIONS;
  return efforts.map(effort => ({
    value: effort,
    label: REASONING_EFFORT_LABELS[effort] ?? effort
  }));
}

/**
 * 获取供应商支持的参数
 */
export function getParametersForProvider(providerType: ProviderType): ParameterMetadata[] {
  return PARAMETER_METADATA.filter(param => param.providers.includes(providerType));
}

/**
 * 按分类获取参数
 */
export function getParametersByCategory(
  providerType: ProviderType,
  category: 'basic' | 'advanced' | 'reasoning' | 'tools'
): ParameterMetadata[] {
  return PARAMETER_METADATA.filter(
    param => param.providers.includes(providerType) && param.category === category
  );
}

/**
 * 获取供应商支持的分类
 */
export function getCategoriesForProvider(providerType: ProviderType): ParameterCategory[] {
  const supportedParams = getParametersForProvider(providerType);
  const categories = new Set(supportedParams.map(p => p.category));
  return PARAMETER_CATEGORIES.filter(cat => 
    categories.has(cat.key as 'basic' | 'advanced' | 'reasoning' | 'tools')
  );
}

/**
 * 根据模型ID检测供应商类型
 */
export function detectProviderFromModel(modelId: string): ProviderType {
  const id = modelId.toLowerCase();
  
  if (id.includes('claude') || id.includes('anthropic')) {
    return 'anthropic';
  }
  if (id.includes('gemini') || id.includes('palm')) {
    return 'gemini';
  }
  if (id.includes('gpt') || id.includes('o1') || id.includes('o3')) {
    return 'openai';
  }
  
  return 'openai-compatible';
}
