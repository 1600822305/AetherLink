/**
 * 系统内置供应商配置
 */
import type { Provider, ProviderType } from '../../types/provider';

/**
 * 系统供应商配置类型
 */
export interface SystemProviderConfig extends Omit<Provider, 'apiKey'> {
  /** 默认API Host */
  defaultApiHost: string;
  /** 是否需要API Key */
  requiresApiKey: boolean;
  /** 支持的功能 */
  features: {
    chat: boolean;
    imageGeneration?: boolean;
    embedding?: boolean;
    functionCalling?: boolean;
    streaming?: boolean;
    multimodal?: boolean;
  };
}

/**
 * 系统内置供应商配置
 */
export const SYSTEM_PROVIDERS: Record<string, SystemProviderConfig> = {
  openai: {
    id: 'openai',
    type: 'openai' as ProviderType,
    name: 'OpenAI',
    apiHost: 'https://api.openai.com/v1',
    defaultApiHost: 'https://api.openai.com/v1',
    models: [],
    isSystem: true,
    enabled: false,
    requiresApiKey: true,
    features: {
      chat: true,
      imageGeneration: true,
      embedding: true,
      functionCalling: true,
      streaming: true,
      multimodal: true,
    },
  },

  anthropic: {
    id: 'anthropic',
    type: 'anthropic' as ProviderType,
    name: 'Anthropic',
    apiHost: 'https://api.anthropic.com',
    defaultApiHost: 'https://api.anthropic.com',
    models: [],
    isSystem: true,
    enabled: false,
    requiresApiKey: true,
    features: {
      chat: true,
      functionCalling: true,
      streaming: true,
      multimodal: true,
    },
  },

  gemini: {
    id: 'gemini',
    type: 'gemini' as ProviderType,
    name: 'Google Gemini',
    apiHost: 'https://generativelanguage.googleapis.com/v1beta',
    defaultApiHost: 'https://generativelanguage.googleapis.com/v1beta',
    models: [],
    isSystem: true,
    enabled: false,
    requiresApiKey: true,
    features: {
      chat: true,
      functionCalling: true,
      streaming: true,
      multimodal: true,
    },
  },

  deepseek: {
    id: 'deepseek',
    type: 'openai' as ProviderType,
    name: 'DeepSeek',
    apiHost: 'https://api.deepseek.com',
    defaultApiHost: 'https://api.deepseek.com',
    models: [],
    isSystem: true,
    enabled: false,
    requiresApiKey: true,
    features: {
      chat: true,
      functionCalling: true,
      streaming: true,
    },
  },

  zhipu: {
    id: 'zhipu',
    type: 'openai' as ProviderType,
    name: '智谱AI',
    apiHost: 'https://open.bigmodel.cn/api/paas/v4/',
    defaultApiHost: 'https://open.bigmodel.cn/api/paas/v4/',
    models: [],
    isSystem: true,
    enabled: false,
    requiresApiKey: true,
    features: {
      chat: true,
      functionCalling: true,
      streaming: true,
      multimodal: true,
    },
  },

  siliconflow: {
    id: 'siliconflow',
    type: 'openai' as ProviderType,
    name: '硅基流动',
    apiHost: 'https://api.siliconflow.cn/v1',
    defaultApiHost: 'https://api.siliconflow.cn/v1',
    models: [],
    isSystem: true,
    enabled: false,
    requiresApiKey: true,
    features: {
      chat: true,
      imageGeneration: true,
      streaming: true,
    },
  },

  moonshot: {
    id: 'moonshot',
    type: 'openai' as ProviderType,
    name: 'Moonshot AI',
    apiHost: 'https://api.moonshot.cn/v1',
    defaultApiHost: 'https://api.moonshot.cn/v1',
    models: [],
    isSystem: true,
    enabled: false,
    requiresApiKey: true,
    features: {
      chat: true,
      functionCalling: true,
      streaming: true,
    },
  },

  groq: {
    id: 'groq',
    type: 'openai' as ProviderType,
    name: 'Groq',
    apiHost: 'https://api.groq.com/openai/v1',
    defaultApiHost: 'https://api.groq.com/openai/v1',
    models: [],
    isSystem: true,
    enabled: false,
    requiresApiKey: true,
    features: {
      chat: true,
      functionCalling: true,
      streaming: true,
    },
  },

  ollama: {
    id: 'ollama',
    type: 'openai' as ProviderType,
    name: 'Ollama',
    apiHost: 'http://localhost:11434/v1',
    defaultApiHost: 'http://localhost:11434/v1',
    models: [],
    isSystem: true,
    enabled: false,
    requiresApiKey: false,
    features: {
      chat: true,
      embedding: true,
      streaming: true,
    },
  },

  lmstudio: {
    id: 'lmstudio',
    type: 'openai' as ProviderType,
    name: 'LM Studio',
    apiHost: 'http://localhost:1234/v1',
    defaultApiHost: 'http://localhost:1234/v1',
    models: [],
    isSystem: true,
    enabled: false,
    requiresApiKey: false,
    features: {
      chat: true,
      streaming: true,
    },
  },
};

/**
 * 获取所有系统供应商配置
 */
export function getSystemProviders(): SystemProviderConfig[] {
  return Object.values(SYSTEM_PROVIDERS);
}

/**
 * 获取指定供应商配置
 */
export function getSystemProvider(id: string): SystemProviderConfig | undefined {
  return SYSTEM_PROVIDERS[id];
}

/**
 * 检查是否为系统供应商
 */
export function isSystemProvider(providerId: string): boolean {
  return providerId in SYSTEM_PROVIDERS;
}

/**
 * 创建带API Key的完整Provider
 */
export function createProviderFromConfig(
  configId: string,
  apiKey: string,
  overrides?: Partial<Provider>
): Provider | undefined {
  const config = SYSTEM_PROVIDERS[configId];
  if (!config) return undefined;

  return {
    id: config.id,
    type: config.type,
    name: config.name,
    apiKey,
    apiHost: overrides?.apiHost || config.defaultApiHost,
    models: config.models,
    isSystem: true,
    enabled: !!apiKey || !config.requiresApiKey,
    ...overrides,
  };
}
