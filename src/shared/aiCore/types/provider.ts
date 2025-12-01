/**
 * Provider 类型定义
 * 参考 Cherry Studio 的 types/provider.ts
 */
import * as z from 'zod';

// ==================== Provider Type Schema ====================

/**
 * 供应商类型枚举
 * 每种类型对应不同的API调用方式
 */
export const ProviderTypeSchema = z.enum([
  'openai',           // OpenAI Chat Completions API
  'openai-response',  // OpenAI Responses API (新版)
  'anthropic',        // Anthropic Claude API
  'gemini',           // Google Gemini API
  'azure-openai',     // Azure OpenAI Service
  'vertexai',         // Google Vertex AI
  'aws-bedrock',      // AWS Bedrock
  'deepseek',         // DeepSeek (OpenAI兼容)
  'zhipu',            // 智谱AI (OpenAI兼容)
  'siliconflow',      // 硅基流动 (OpenAI兼容)
  'volcengine',       // 火山引擎 (OpenAI兼容)
  'grok',             // xAI Grok (OpenAI兼容)
  'moonshot',         // Moonshot AI (OpenAI兼容)
  'groq',             // Groq (OpenAI兼容)
  'ollama',           // Ollama 本地模型
  'lmstudio',         // LM Studio 本地模型
  'custom'            // 自定义OpenAI兼容
]);

export type ProviderType = z.infer<typeof ProviderTypeSchema>;

// ==================== Provider API Options ====================

/**
 * Provider API能力标志
 * undefined 视为支持，用于控制特定功能的开关
 */
export interface ProviderApiOptions {
  /** 是否不支持 message content 为数组类型 */
  isNotSupportArrayContent?: boolean;
  /** 是否不支持 stream_options 参数 */
  isNotSupportStreamOptions?: boolean;
  /** 是否支持 developer role */
  isSupportDeveloperRole?: boolean;
  /** 是否支持 service_tier 参数 */
  isSupportServiceTier?: boolean;
  /** 是否不支持 enable_thinking 参数 */
  isNotSupportEnableThinking?: boolean;
  /** 是否支持原生 function calling */
  isSupportFunctionCalling?: boolean;
  /** 是否支持流式输出 */
  isSupportStreaming?: boolean;
  /** 是否支持多模态（图像输入） */
  isSupportMultimodal?: boolean;
  /** 是否支持图像生成 */
  isSupportImageGeneration?: boolean;
  /** 是否支持视频生成 */
  isSupportVideoGeneration?: boolean;
}

// ==================== Service Tier ====================

export const ServiceTierSchema = z.enum([
  'auto',
  'default',
  'flex',
  'priority'
]).nullable().optional();

export type ServiceTier = z.infer<typeof ServiceTierSchema>;

// ==================== Provider Model ====================

/**
 * Provider关联的模型信息 Schema
 */
export const ProviderModelSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  group: z.string().optional(),
  enabled: z.boolean().optional().default(true),
});

export type ProviderModel = z.infer<typeof ProviderModelSchema>;

// ==================== Provider Interface ====================

/**
 * Provider 核心接口
 * 描述一个AI服务供应商的完整配置
 */
export interface Provider {
  /** 唯一标识符 */
  id: string;
  /** Provider类型，决定使用哪种API客户端 */
  type: ProviderType;
  /** 显示名称 */
  name: string;
  /** API密钥，支持逗号分隔多个密钥轮询 */
  apiKey: string;
  /** API基础URL */
  apiHost: string;
  /** 关联的模型列表 */
  models: ProviderModel[];
  /** 是否启用 */
  enabled?: boolean;
  /** 是否为系统内置供应商 */
  isSystem?: boolean;
  /** API能力选项 */
  apiOptions?: ProviderApiOptions;
  /** Service Tier配置 */
  serviceTier?: ServiceTier;
  /** 额外请求头 */
  extraHeaders?: Record<string, string>;
  /** 额外请求体参数 */
  extraBody?: Record<string, unknown>;
  /** 备注信息 */
  notes?: string;
  /** 速率限制 (请求/分钟) */
  rateLimit?: number;

  // ===== 特定供应商字段 =====
  /** Anthropic API Host (用于AiHubMix等中转) */
  anthropicApiHost?: string;
  /** API版本 (Azure OpenAI) */
  apiVersion?: string;
  /** 是否为Vertex AI模式 */
  isVertex?: boolean;
  /** 认证类型 */
  authType?: 'apiKey' | 'oauth';
  /** 自定义模型获取端点 */
  customModelEndpoint?: string;
}

// ==================== System Provider ====================

/**
 * 系统内置供应商ID枚举
 */
export const SystemProviderIdSchema = z.enum([
  'openai',
  'anthropic',
  'gemini',
  'azure-openai',
  'deepseek',
  'zhipu',
  'siliconflow',
  'volcengine',
  'grok',
  'moonshot',
  'groq',
  'ollama',
  'lmstudio'
]);

export type SystemProviderId = z.infer<typeof SystemProviderIdSchema>;

/**
 * 判断是否为系统内置供应商ID
 */
export const isSystemProviderId = (id: string): id is SystemProviderId => {
  return SystemProviderIdSchema.safeParse(id).success;
};

/**
 * 系统供应商类型
 */
export interface SystemProvider extends Provider {
  id: SystemProviderId;
  isSystem: true;
}

/**
 * 判断是否为系统供应商
 */
export const isSystemProvider = (provider: Provider): provider is SystemProvider => {
  return isSystemProviderId(provider.id) && provider.isSystem === true;
};

// ==================== Special Provider Types ====================

/**
 * Azure OpenAI Provider
 */
export interface AzureOpenAIProvider extends Provider {
  type: 'azure-openai';
  apiVersion: string;
}

export const isAzureOpenAIProvider = (provider: Provider): provider is AzureOpenAIProvider => {
  return provider.type === 'azure-openai';
};

/**
 * Vertex AI Provider
 */
export interface VertexAIProvider extends Provider {
  type: 'vertexai';
  googleCredentials: {
    privateKey: string;
    clientEmail: string;
  };
  project: string;
  location: string;
}

export const isVertexAIProvider = (provider: Provider): provider is VertexAIProvider => {
  return provider.type === 'vertexai';
};

/**
 * Gemini Provider
 */
export interface GeminiProvider extends Provider {
  type: 'gemini';
  isVertex?: boolean;
}

export const isGeminiProvider = (provider: Provider): provider is GeminiProvider => {
  return provider.type === 'gemini';
};

// ==================== Provider Validation Schema ====================

/**
 * API Options Schema
 */
const ProviderApiOptionsSchema = z.object({
  isNotSupportArrayContent: z.boolean().optional(),
  isNotSupportStreamOptions: z.boolean().optional(),
  isSupportDeveloperRole: z.boolean().optional(),
  isSupportServiceTier: z.boolean().optional(),
  isNotSupportEnableThinking: z.boolean().optional(),
  isSupportFunctionCalling: z.boolean().optional(),
  isSupportStreaming: z.boolean().optional(),
  isSupportMultimodal: z.boolean().optional(),
  isSupportImageGeneration: z.boolean().optional(),
  isSupportVideoGeneration: z.boolean().optional(),
}).optional();

/**
 * Provider Schema 用于运行时验证
 */
export const ProviderSchema = z.object({
  id: z.string().min(1, 'Provider ID 不能为空'),
  type: ProviderTypeSchema,
  name: z.string().min(1, 'Provider 名称不能为空'),
  apiKey: z.string(),
  apiHost: z.string().url('请输入有效的 URL').or(
    z.string().startsWith('http://localhost')
  ).or(
    z.string().regex(/^https?:\/\//, '请输入有效的 URL')
  ),
  models: z.array(ProviderModelSchema).default([]),
  enabled: z.boolean().optional().default(false),
  isSystem: z.boolean().optional(),
  apiOptions: ProviderApiOptionsSchema,
  serviceTier: ServiceTierSchema,
  extraHeaders: z.record(z.string()).optional(),
  extraBody: z.record(z.unknown()).optional(),
  notes: z.string().optional(),
  rateLimit: z.number().positive().optional(),
  anthropicApiHost: z.string().optional(),
  apiVersion: z.string().optional(),
  isVertex: z.boolean().optional(),
  authType: z.enum(['apiKey', 'oauth']).optional(),
  customModelEndpoint: z.string().optional(),
});

// ==================== Validation Functions ====================

/**
 * 验证Provider配置（抛出异常）
 */
export function validateProvider(provider: unknown): Provider {
  return ProviderSchema.parse(provider) as Provider;
}

/**
 * 安全验证Provider配置（不抛出异常）
 */
export function safeValidateProvider(provider: unknown): {
  success: true;
  data: Provider;
} | {
  success: false;
  error: z.ZodError;
} {
  const result = ProviderSchema.safeParse(provider);
  if (result.success) {
    return { success: true, data: result.data as Provider };
  }
  return { success: false, error: result.error };
}

/**
 * 获取验证错误的友好消息
 */
export function getValidationErrorMessages(error: z.ZodError): string[] {
  return error.errors.map(e => {
    const path = e.path.join('.');
    return path ? `${path}: ${e.message}` : e.message;
  });
}

// ==================== Provider Utilities ====================

/**
 * 创建默认Provider配置
 */
export function createDefaultProvider(partial: Partial<Provider> & { id: string; type: ProviderType; name: string }): Provider {
  return {
    apiKey: '',
    apiHost: '',
    models: [],
    enabled: false,
    ...partial,
  };
}

/**
 * 合并Provider配置
 */
export function mergeProvider(base: Provider, updates: Partial<Provider>): Provider {
  return {
    ...base,
    ...updates,
    models: updates.models ?? base.models,
    apiOptions: {
      ...base.apiOptions,
      ...updates.apiOptions,
    },
    extraHeaders: {
      ...base.extraHeaders,
      ...updates.extraHeaders,
    },
  };
}
