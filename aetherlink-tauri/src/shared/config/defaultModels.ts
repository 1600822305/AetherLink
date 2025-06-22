import type { Model } from '../types';

// 导出负载均衡策略类型
export type LoadBalanceStrategy = 'round_robin' | 'priority' | 'least_used' | 'random';

// API Key 配置接口
export interface ApiKeyConfig {
  id: string; // 唯一标识符
  key: string; // API Key 值
  name?: string; // 可选的 Key 名称/备注
  isEnabled: boolean; // 是否启用
  priority: number; // 优先级 (1-10, 数字越小优先级越高)
  maxRequestsPerMinute?: number; // 每分钟最大请求数限制
  // 使用统计
  usage: {
    totalRequests: number; // 总请求数
    successfulRequests: number; // 成功请求数
    failedRequests: number; // 失败请求数
    lastUsed?: number; // 最后使用时间戳
    consecutiveFailures: number; // 连续失败次数
  };
  // 状态信息
  status: 'active' | 'disabled' | 'error' | 'rate_limited'; // Key 状态
  lastError?: string; // 最后的错误信息
  createdAt: number; // 创建时间戳
  updatedAt: number; // 更新时间戳
}

export interface ModelProvider {
  id: string;
  name: string;
  avatar: string;
  color: string;
  isEnabled: boolean;
  // 保持向后兼容的单个 API Key
  apiKey?: string;
  // 新增：多 Key 支持
  apiKeys?: ApiKeyConfig[];
  // Key 管理配置
  keyManagement?: {
    strategy: 'round_robin' | 'priority' | 'least_used' | 'random'; // 负载均衡策略
    maxFailuresBeforeDisable: number; // 连续失败多少次后禁用 Key
    failureRecoveryTime: number; // 失败后多久重新尝试 (分钟)
    enableAutoRecovery: boolean; // 是否启用自动恢复
  };
  baseUrl?: string;
  models: Model[];
  providerType?: string;
  isSystem?: boolean; // 标记是否为系统供应商
  extraHeaders?: Record<string, string>; // 额外的请求头
  customModelEndpoint?: string; // 自定义模型端点URL
}

// 默认模型供应商配置
export const getDefaultModelProviders = (): ModelProvider[] => [
  {
    id: 'model-combo',
    name: '模型组合',
    avatar: '🧠',
    color: '#f43f5e',
    isEnabled: true,
    apiKey: '',
    baseUrl: '',
    isSystem: true, // 标记为系统供应商
    models: [] // 动态从模型组合服务加载
  },
  {
    id: 'openai',
    name: 'OpenAI',
    avatar: 'O',
    color: '#10a37f',
    isEnabled: false,
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    providerType: 'openai',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', enabled: true, isDefault: true },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', enabled: true, isDefault: false },
      { id: 'gpt-4.1', name: 'GPT-4.1', provider: 'openai', enabled: true, isDefault: false },
      { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', provider: 'openai', enabled: true, isDefault: false },
      { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano', provider: 'openai', enabled: true, isDefault: false },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'openai', enabled: true, isDefault: false },
      { id: 'o1', name: 'o1', provider: 'openai', enabled: true, isDefault: false },
      { id: 'o1-mini', name: 'o1-mini', provider: 'openai', enabled: true, isDefault: false },
      { id: 'o1-pro', name: 'o1-pro', provider: 'openai', enabled: true, isDefault: false },
      { id: 'o3', name: 'o3', provider: 'openai', enabled: true, isDefault: false },
      { id: 'o4-mini', name: 'o4-mini', provider: 'openai', enabled: true, isDefault: false },
    ]
  },
  {
    id: 'openai-aisdk',
    name: 'OpenAI (AI SDK)',
    avatar: '🚀',
    color: '#10a37f',
    isEnabled: false,
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    providerType: 'openai-aisdk',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai-aisdk', enabled: true, isDefault: false },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai-aisdk', enabled: true, isDefault: false },
      { id: 'gpt-4.1', name: 'GPT-4.1', provider: 'openai-aisdk', enabled: true, isDefault: false },
      { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', provider: 'openai-aisdk', enabled: true, isDefault: false },
      { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano', provider: 'openai-aisdk', enabled: true, isDefault: false },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'openai-aisdk', enabled: true, isDefault: false },
      { id: 'o1', name: 'o1', provider: 'openai-aisdk', enabled: true, isDefault: false },
      { id: 'o1-mini', name: 'o1-mini', provider: 'openai-aisdk', enabled: true, isDefault: false },
      { id: 'o1-pro', name: 'o1-pro', provider: 'openai-aisdk', enabled: true, isDefault: false },
      { id: 'o3', name: 'o3', provider: 'openai-aisdk', enabled: true, isDefault: false },
      { id: 'o3-mini', name: 'o3-mini', provider: 'openai-aisdk', enabled: true, isDefault: false },
      { id: 'o4-mini', name: 'o4-mini', provider: 'openai-aisdk', enabled: true, isDefault: false },
    ]
  },
  {
    id: 'gemini',
    name: 'Gemini',
    avatar: 'G',
    color: '#4285f4',
    isEnabled: false,
    apiKey: '',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    providerType: 'gemini',
    models: [
      { id: 'gemini-2.5-pro-preview-06-05', name: 'Gemini 2.5 Pro Preview (0605)', provider: 'gemini', enabled: true, isDefault: false },
      { id: 'gemini-2.5-pro-preview-05-06', name: 'Gemini 2.5 Pro Preview (0506)', provider: 'gemini', enabled: true, isDefault: false },
      { id: 'gemini-2.5-flash-preview-04-17', name: 'Gemini 2.5 Flash Preview', provider: 'gemini', enabled: true, isDefault: false },
      { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash Experimental', provider: 'gemini', enabled: true, isDefault: false },
      { id: 'gemini-2.0-flash-001', name: 'Gemini 2.0 Flash', provider: 'gemini', enabled: true, isDefault: false },
      { id: 'gemini-1.5-pro-002', name: 'Gemini 1.5 Pro', provider: 'gemini', enabled: true, isDefault: false },
      { id: 'gemini-1.5-flash-002', name: 'Gemini 1.5 Flash', provider: 'gemini', enabled: true, isDefault: false },
      {
        id: 'veo-2.0-generate-001',
        name: 'Veo 2 (视频生成)',
        provider: 'google',
        enabled: true,
        isDefault: false,
        description: 'Google Veo 2高质量视频生成模型，支持文本和图片生成视频',
        capabilities: {
          videoGeneration: true
        },
        modelTypes: ['video_gen' as any]
      },
    ]
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    avatar: 'A',
    color: '#b83280',
    isEnabled: false,
    apiKey: '',
    baseUrl: 'https://api.anthropic.com/v1',
    providerType: 'anthropic',
    models: [
      { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', provider: 'anthropic', enabled: true, isDefault: false },
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', provider: 'anthropic', enabled: true, isDefault: false },
      { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet', provider: 'anthropic', enabled: true, isDefault: false },
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'anthropic', enabled: true, isDefault: false },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', provider: 'anthropic', enabled: true, isDefault: false },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', provider: 'anthropic', enabled: true, isDefault: false },
    ]
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    avatar: 'D',
    color: '#754AB4',
    isEnabled: false,
    apiKey: '',
    baseUrl: 'https://api.deepseek.com',
    providerType: 'openai',
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek-V3', provider: 'deepseek', enabled: true, isDefault: false, description: '最新一代通用对话模型，性能全面提升' },
      { id: 'deepseek-reasoner', name: 'DeepSeek-R1', provider: 'deepseek', enabled: true, isDefault: false, description: '推理专用模型，在数学、编程、科学推理等领域表现突出' },
    ]
  },
  {
    id: 'volcengine',
    name: '火山引擎',
    avatar: 'V',
    color: '#ff3d00',
    isEnabled: false,
    apiKey: '',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    providerType: 'volcengine',
    models: [
      { id: 'doubao-1.5-pro', name: '豆包 1.5 Pro', provider: 'volcengine', enabled: true, isDefault: false, description: '豆包大模型专业版，综合能力强' },
      { id: 'doubao-1.5-lite', name: '豆包 1.5 Lite', provider: 'volcengine', enabled: true, isDefault: false, description: '豆包大模型轻量版，快速响应' },
      { id: 'doubao-1.5-thinking-pro', name: '豆包 1.5 Thinking Pro', provider: 'volcengine', enabled: true, isDefault: false, description: '原生多模态深度思考模型，在数学、编程、科学推理等专业领域表现突出' },
      { id: 'deepseek-r1', name: 'DeepSeek R1', provider: 'volcengine', enabled: true, isDefault: false, description: 'DeepSeek R1推理模型，通过火山引擎提供' }
    ]
  },
  {
    id: 'zhipu',
    name: '智谱AI',
    avatar: '智',
    color: '#4f46e5',
    isEnabled: false,
    apiKey: '',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4/',
    providerType: 'zhipu',
    models: [
      { id: 'glm-5-plus', name: 'GLM-5-Plus', provider: 'zhipu', enabled: true, isDefault: false, description: 'GLM-5增强版，最新一代大模型' },
      { id: 'glm-5-air', name: 'GLM-5-Air', provider: 'zhipu', enabled: true, isDefault: false, description: 'GLM-5轻量版，平衡性能与速度' },
      { id: 'glm-4-0520', name: 'GLM-4-0520', provider: 'zhipu', enabled: true, isDefault: false, description: 'GLM-4最新版本，性能优化' },
      { id: 'glm-4-plus', name: 'GLM-4-Plus', provider: 'zhipu', enabled: true, isDefault: false, description: 'GLM-4增强版，更强推理能力' },
      { id: 'glm-4-long', name: 'GLM-4-Long', provider: 'zhipu', enabled: true, isDefault: false, description: 'GLM-4长文本版，支持超长上下文' },
      { id: 'glm-4-air', name: 'GLM-4-Air', provider: 'zhipu', enabled: true, isDefault: false, description: 'GLM-4轻量版，快速响应' },
      { id: 'glm-4-airx', name: 'GLM-4-AirX', provider: 'zhipu', enabled: true, isDefault: false, description: 'GLM-4轻量增强版' },
      { id: 'glm-4-flash', name: 'GLM-4-Flash', provider: 'zhipu', enabled: true, isDefault: false, description: 'GLM-4极速版，超快响应' },
      { id: 'glm-4-flashx', name: 'GLM-4-FlashX', provider: 'zhipu', enabled: true, isDefault: false, description: 'GLM-4极速增强版' },
      { id: 'glm-4v', name: 'GLM-4V', provider: 'zhipu', enabled: true, isDefault: false, description: 'GLM-4视觉版，支持图像理解' },
      { id: 'glm-4v-flash', name: 'GLM-4V-Flash', provider: 'zhipu', enabled: true, isDefault: false, description: 'GLM-4V极速版' },
      { id: 'glm-4v-plus', name: 'GLM-4V-Plus', provider: 'zhipu', enabled: true, isDefault: false, description: 'GLM-4V增强版' },
      { id: 'glm-4-alltools', name: 'GLM-4-AllTools', provider: 'zhipu', enabled: true, isDefault: false, description: 'GLM-4全工具版，支持网络搜索等工具' }
    ]
  }
];

// 获取默认模型ID
export const getDefaultModelId = (providers: ModelProvider[]): string | undefined => {
  for (const provider of providers) {
    if (provider.isEnabled) {
      const defaultModel = provider.models.find(m => m.isDefault && m.enabled);
      if (defaultModel) return defaultModel.id;

      // 如果没有默认模型，取第一个启用的模型
      const firstEnabledModel = provider.models.find(m => m.enabled);
      if (firstEnabledModel) return firstEnabledModel.id;
    }
  }
  return undefined;
};
