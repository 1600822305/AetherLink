import type { PresetModel } from '../types';
import { ModelType } from '../types';
import { getProviderIcon } from '../utils/providerIcons';

// 预设模型列表
export const presetModels: PresetModel[] = [
  // OpenAI 模型
  {
    id: 'gpt-5-latest',
    name: 'GPT-5',
    provider: 'openai',
    description: 'OpenAI最新旗舰模型（2025年8月），具有卓越的推理能力和代码生成能力，适合复杂任务。',
    capabilities: ['复杂推理', '代码生成', '高级内容创作', '多步骤问题解决', '最新知识库'],
    requiresApiKey: true,
    defaultBaseUrl: 'https://api.openai.com/v1',
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    description: 'OpenAI的多模态旗舰模型，支持文本和图像输入，性能卓越。',
    capabilities: ['多模态理解', '复杂推理', '代码生成', '图像分析', '高级内容创作'],
    requiresApiKey: true,
    defaultBaseUrl: 'https://api.openai.com/v1',
    multimodal: true,
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    description: '轻量级高效模型，成本低廉，适合日常任务和快速响应。',
    capabilities: ['聊天对话', '内容生成', '代码辅助', '快速响应'],
    requiresApiKey: true,
    defaultBaseUrl: 'https://api.openai.com/v1',
  },

  // SiliconFlow 模型
  {
    id: 'deepseek-ai/DeepSeek-V3',
    name: 'DeepSeek V3',
    provider: 'siliconflow',
    description: '由SiliconFlow提供的DeepSeek V3模型，拥有强大的中文理解和生成能力。',
    capabilities: ['聊天对话', '内容生成', '中文优化', '代码辅助', '思考过程'],
    requiresApiKey: true,
    defaultBaseUrl: 'https://api.siliconflow.cn/v1',
  },
  {
    id: 'Qwen/Qwen2-VL-72B-Instruct',
    name: 'Qwen2 VL 72B',
    provider: 'siliconflow',
    description: '通义千问多模态模型，支持图像理解和视觉分析。',
    capabilities: ['多模态理解', '图像分析', '内容创作', '中文优化', '视觉问答'],
    requiresApiKey: true,
    defaultBaseUrl: 'https://api.siliconflow.cn/v1',
    multimodal: true,
  },
  {
    id: 'Qwen/Qwen3-32B',
    name: 'Qwen3 32B',
    provider: 'siliconflow',
    description: '通义千问第三代旗舰大模型，具有卓越的中文理解和创作能力。',
    capabilities: ['复杂推理', '内容创作', '代码生成', '中文优化'],
    requiresApiKey: true,
    defaultBaseUrl: 'https://api.siliconflow.cn/v1',
  },
  {
    id: 'Qwen/Qwen2.5-Coder-32B-Instruct',
    name: 'Qwen2.5 Coder',
    provider: 'siliconflow',
    description: '通义千问专门优化的代码模型，擅长编程和技术文档生成。',
    capabilities: ['代码生成', '代码解释', '技术文档', 'API设计'],
    requiresApiKey: true,
    defaultBaseUrl: 'https://api.siliconflow.cn/v1',
  },
  {
    id: 'Qwen/Qwen2.5-Math-72B-Instruct',
    name: 'Qwen2.5 Math',
    provider: 'siliconflow',
    description: '通义千问数学专精模型，擅长数学推理和解题。',
    capabilities: ['数学推理', '问题解决', '公式推导', '数据分析'],
    requiresApiKey: true,
    defaultBaseUrl: 'https://api.siliconflow.cn/v1',
  },

  // Anthropic 模型
  {
    id: 'claude-sonnet-4-5-20250929',
    name: 'Claude Sonnet 4.5',
    provider: 'anthropic',
    description: 'Anthropic最新旗舰模型（2025年9月），具有卓越的代码生成和推理能力，支持长时间编码。',
    capabilities: ['复杂推理', '代码生成', '高级内容创作', '多步骤问题解决', '长文本处理'],
    requiresApiKey: true,
    defaultBaseUrl: 'https://api.anthropic.com/v1',
  },
  {
    id: 'claude-haiku-4-5-20251001',
    name: 'Claude Haiku 4.5',
    provider: 'anthropic',
    description: 'Claude 4.5系列的轻量级模型，性能接近Sonnet 4，成本仅为1/3。',
    capabilities: ['快速响应', '聊天对话', '内容生成', '代码辅助', '经济实惠'],
    requiresApiKey: true,
    defaultBaseUrl: 'https://api.anthropic.com/v1',
  },
  {
    id: 'claude-opus-4-1-20250805',
    name: 'Claude Opus 4.1',
    provider: 'anthropic',
    description: 'Claude 4系列的旗舰模型（2025年8月），具有最强的推理和创意能力。',
    capabilities: ['复杂推理', '高级内容创作', '代码生成', '多步骤问题解决'],
    requiresApiKey: true,
    defaultBaseUrl: 'https://api.anthropic.com/v1',
  },

  // Google 模型
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'google',
    description: 'Google最新旗舰模型，具有卓越的推理能力和多模态理解。',
    capabilities: ['复杂推理', '多模态理解', '代码生成', '高级内容创作', '思考过程'],
    requiresApiKey: true,
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    multimodal: true,
  },
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'google',
    description: 'Google的高速多模态模型，性能与速度的完美平衡。',
    capabilities: ['快速响应', '多模态理解', '内容生成', '代码辅助', '图像分析'],
    requiresApiKey: true,
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    multimodal: true,
  },
  {
    id: 'gemini-2.0-flash-exp',
    name: 'Gemini 2.0 Flash Exp',
    provider: 'google',
    description: 'Google Gemini 2.0 Flash实验版，支持图像生成功能。',
    capabilities: ['聊天对话', '图像生成', '多模态理解', '实验功能'],
    requiresApiKey: true,
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    multimodal: true,
    imageGeneration: true,
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    provider: 'google',
    description: 'Google的高性能模型，具有强大的推理和生成能力。',
    capabilities: ['复杂推理', '内容生成', '代码辅助', '多语言支持'],
    requiresApiKey: true,
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
  },

  // Grok 模型
  {
    id: 'grok-1',
    name: 'Grok-1',
    provider: 'grok',
    description: 'xAI的第一代Grok模型，擅长幽默风格回复和实时信息获取。',
    capabilities: ['实时知识', '网络搜索', '幽默回复', '代码生成'],
    requiresApiKey: true,
    defaultBaseUrl: 'https://api.x.ai/v1',
  },
  {
    id: 'grok-2',
    name: 'Grok-2',
    provider: 'grok',
    description: 'xAI的第二代Grok模型，具有增强的推理能力和多模态理解。',
    capabilities: ['复杂推理', '实时知识', '代码生成', '问题解决', '多模态理解'],
    requiresApiKey: true,
    defaultBaseUrl: 'https://api.x.ai/v1',
    multimodal: true,
  },
  {
    id: 'grok-3',
    name: 'Grok-3',
    provider: 'grok',
    description: 'xAI最新旗舰模型（2025年），具有卓越的推理能力和多模态理解。',
    capabilities: ['复杂推理', '多模态理解', '代码生成', '实时知识', '高级问题解决'],
    requiresApiKey: true,
    defaultBaseUrl: 'https://api.x.ai/v1',
    multimodal: true,
  },
  {
    id: 'grok-3-thinking',
    name: 'Grok-3 Thinking',
    provider: 'grok',
    description: 'Grok-3的思考增强版本，展示详细的推理过程和思考链。',
    capabilities: ['思考过程', '复杂推理', '问题解决', '代码生成', '逻辑分析'],
    requiresApiKey: true,
    defaultBaseUrl: 'https://api.x.ai/v1',
  },
  {
    id: 'grok-4-fast',
    name: 'Grok-4 Fast',
    provider: 'grok',
    description: 'Grok-4的快速版本，平衡性能与响应速度，适合实时对话。',
    capabilities: ['快速响应', '实时对话', '代码辅助', '基础推理'],
    requiresApiKey: true,
    defaultBaseUrl: 'https://api.x.ai/v1',
  },

  // 火山引擎模型
  {
    id: 'DBV1.5-pro',
    name: '豆包 1.5 Pro',
    provider: 'volcengine',
    description: '火山引擎旗舰级大模型，具有强大的中文理解和生成能力。',
    capabilities: ['复杂推理', '内容创作', '代码生成', '中文优化'],
    requiresApiKey: true,
    defaultBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3/',
  },
  {
    id: 'DBV1.5-lite',
    name: '豆包 1.5 Lite',
    provider: 'volcengine',
    description: '火山引擎轻量级模型，快速响应，适合一般对话场景。',
    capabilities: ['快速回复', '内容生成', '中文优化', '基础问答'],
    requiresApiKey: true,
    defaultBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3/',
  },
  {
    id: 'DBV1.5-thinking-pro',
    name: '豆包 1.5 思考 Pro',
    provider: 'volcengine',
    description: '火山引擎思考增强模型，展示详细的思考过程，提高推理能力。',
    capabilities: ['思考过程', '复杂推理', '内容创作', '代码生成'],
    requiresApiKey: true,
    defaultBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3/',
  },
  {
    id: 'deepseek-r1',
    name: 'DeepSeek R1',
    provider: 'volcengine',
    description: '火山引擎提供的DeepSeek R1模型，具有卓越的代码能力和综合表现。',
    capabilities: ['代码生成', '复杂推理', '技术文档', 'API设计'],
    requiresApiKey: true,
    defaultBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3/',
  },

  // DeepSeek 模型
  {
    id: 'deepseek-chat',
    name: 'DeepSeek-V3.2',
    provider: 'deepseek',
    description: 'DeepSeek最新的大型语言模型（V3.2-Exp），具有优秀的中文和代码能力，128K上下文窗口。',
    capabilities: ['聊天对话', '内容生成', '中文优化', '代码辅助', 'JSON输出', '函数调用'],
    requiresApiKey: true,
    defaultBaseUrl: 'https://api.deepseek.com',
  },
  {
    id: 'deepseek-reasoner',
    name: 'DeepSeek-R1',
    provider: 'deepseek',
    description: 'DeepSeek的推理模型（V3.2-Exp思考模式），擅长解决复杂推理问题，支持最大64K输出。',
    capabilities: ['复杂推理', '思考过程', '代码生成', '多步骤问题解决', '长输出'],
    requiresApiKey: true,
    defaultBaseUrl: 'https://api.deepseek.com',
  },

  // 硅基流动模型
  {
    id: 'siliconflow-llama3-8b-chat',
    name: 'Llama3-8B Chat',
    provider: 'siliconflow',
    description: '高效的Llama3-8B聊天模型',
    capabilities: ['聊天对话', '指令跟随'],
    requiresApiKey: true,
    defaultBaseUrl: 'https://api.siliconflow.cn',
    modelTypes: [ModelType.Chat]
  },
  {
    id: 'siliconflow-llama3-70b-chat',
    name: 'Llama3-70B Chat',
    provider: 'siliconflow',
    description: '强大的Llama3-70B聊天模型',
    capabilities: ['聊天对话', '文本生成', '指令跟随'],
    requiresApiKey: true,
    defaultBaseUrl: 'https://api.siliconflow.cn',
    modelTypes: [ModelType.Chat]
  },
  {
    id: 'siliconflow-xcomposer2',
    name: 'XComposer2',
    provider: 'siliconflow',
    description: '专业的编写和创作模型',
    capabilities: ['文本生成', '编写创作', '内容生成'],
    requiresApiKey: true,
    defaultBaseUrl: 'https://api.siliconflow.cn',
    modelTypes: [ModelType.Chat]
  },
  {
    id: 'siliconflow-deepseek-v2',
    name: 'DeepSeek V2',
    provider: 'siliconflow',
    description: '强大的中英双语大模型',
    capabilities: ['中英双语', '聊天对话', '知识问答'],
    requiresApiKey: true,
    defaultBaseUrl: 'https://api.siliconflow.cn',
    modelTypes: [ModelType.Chat]
  },

  // 新增: 硅基流动图像生成模型
  {
    id: 'Kwai-Kolors/Kolors',
    name: 'Kolors',
    provider: 'siliconflow',
    description: '快手开源的高质量图像生成模型',
    capabilities: ['图像生成', '文本到图像', '创意绘画'],
    requiresApiKey: true,
    defaultBaseUrl: 'https://api.siliconflow.cn',
    imageGeneration: true,
    modelTypes: [ModelType.ImageGen]
  },
  {
    id: 'stability-ai/sdxl',
    name: 'SDXL',
    provider: 'siliconflow',
    description: 'Stable Diffusion XL图像生成模型',
    capabilities: ['图像生成', '文本到图像', '高清图像'],
    requiresApiKey: true,
    defaultBaseUrl: 'https://api.siliconflow.cn',
    imageGeneration: true,
    modelTypes: [ModelType.ImageGen]
  },

  // 新增: 硅基流动视频生成模型
  {
    id: 'tencent/HunyuanVideo',
    name: 'HunyuanVideo',
    provider: 'siliconflow',
    description: '腾讯混元视频生成模型，支持文生视频',
    capabilities: ['视频生成', '文本到视频', '创意视频'],
    requiresApiKey: true,
    defaultBaseUrl: 'https://api.siliconflow.cn',
    videoGeneration: true,
    modelTypes: [ModelType.VideoGen]
  },
  {
    id: 'Wan-AI/Wan2.1-T2V-14B',
    name: 'Wan2.1 T2V 14B',
    provider: 'siliconflow',
    description: 'Wan AI文生视频模型，高质量视频生成',
    capabilities: ['视频生成', '文本到视频', '高清视频'],
    requiresApiKey: true,
    defaultBaseUrl: 'https://api.siliconflow.cn',
    videoGeneration: true,
    modelTypes: [ModelType.VideoGen]
  },
  {
    id: 'Wan-AI/Wan2.1-T2V-14B-Turbo',
    name: 'Wan2.1 T2V 14B Turbo',
    provider: 'siliconflow',
    description: 'Wan AI文生视频模型（加速版），快速视频生成',
    capabilities: ['视频生成', '文本到视频', '快速生成'],
    requiresApiKey: true,
    defaultBaseUrl: 'https://api.siliconflow.cn',
    videoGeneration: true,
    modelTypes: [ModelType.VideoGen]
  },
  {
    id: 'Wan-AI/Wan2.1-I2V-14B-720P',
    name: 'Wan2.1 I2V 14B 720P',
    provider: 'siliconflow',
    description: 'Wan AI图生视频模型，支持图像到视频转换',
    capabilities: ['视频生成', '图像到视频', '720P高清'],
    requiresApiKey: true,
    defaultBaseUrl: 'https://api.siliconflow.cn',
    videoGeneration: true,
    modelTypes: [ModelType.VideoGen]
  },
  {
    id: 'Wan-AI/Wan2.1-I2V-14B-720P-Turbo',
    name: 'Wan2.1 I2V 14B 720P Turbo',
    provider: 'siliconflow',
    description: 'Wan AI图生视频模型（加速版），快速图像到视频转换',
    capabilities: ['视频生成', '图像到视频', '快速生成'],
    requiresApiKey: true,
    defaultBaseUrl: 'https://api.siliconflow.cn',
    videoGeneration: true,
    modelTypes: [ModelType.VideoGen]
  },
  {
    id: 'black-forest-labs/FLUX.1-schnell',
    name: 'FLUX.1 Schnell',
    provider: 'siliconflow',
    description: 'Black Forest Labs的快速图像生成模型',
    capabilities: ['图像生成', '文本到图像', '快速生成'],
    requiresApiKey: true,
    defaultBaseUrl: 'https://api.siliconflow.cn',
    imageGeneration: true,
    modelTypes: [ModelType.ImageGen]
  },
  {
    id: 'black-forest-labs/FLUX.1-dev',
    name: 'FLUX.1 Dev',
    provider: 'siliconflow',
    description: 'FLUX.1开发版，更高质量的图像生成',
    capabilities: ['图像生成', '文本到图像', '高质量生成'],
    requiresApiKey: true,
    defaultBaseUrl: 'https://api.siliconflow.cn',
    imageGeneration: true,
    modelTypes: [ModelType.ImageGen]
  },

  // 新增: Grok 图像生成模型
  {
    id: 'grok-2-image-1212',
    name: 'Grok-2 Image 1212',
    provider: 'grok',
    description: 'xAI的Grok-2图像生成模型，支持高质量图像创作',
    capabilities: ['图像生成', '文本到图像', '创意绘画', '高质量输出'],
    requiresApiKey: true,
    defaultBaseUrl: 'https://api.x.ai/v1',
    imageGeneration: true,
    modelTypes: [ModelType.ImageGen]
  },
  {
    id: 'grok-2-image',
    name: 'Grok-2 Image',
    provider: 'grok',
    description: 'xAI的Grok-2图像生成模型',
    capabilities: ['图像生成', '文本到图像', '创意绘画'],
    requiresApiKey: true,
    defaultBaseUrl: 'https://api.x.ai/v1',
    imageGeneration: true,
    modelTypes: [ModelType.ImageGen]
  },
  {
    id: 'grok-2-image-latest',
    name: 'Grok-2 Image Latest',
    provider: 'grok',
    description: 'xAI的最新Grok-2图像生成模型',
    capabilities: ['图像生成', '文本到图像', '创意绘画', '最新功能'],
    requiresApiKey: true,
    defaultBaseUrl: 'https://api.x.ai/v1',
    imageGeneration: true,
    modelTypes: [ModelType.ImageGen]
  },

  // 新增: Gemini 图像生成模型
  {
    id: 'gemini-2.0-flash-exp-image-generation',
    name: 'Gemini 2.0 Flash Exp Image',
    provider: 'google',
    description: 'Google Gemini 2.0 Flash实验版图像生成模型',
    capabilities: ['图像生成', '文本到图像', '多模态理解', '实验功能'],
    requiresApiKey: true,
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    imageGeneration: true,
    modelTypes: [ModelType.ImageGen]
  },
  {
    id: 'gemini-2.0-flash-preview-image-generation',
    name: 'Gemini 2.0 Flash Preview Image',
    provider: 'google',
    description: 'Google Gemini 2.0 Flash预览版图像生成模型',
    capabilities: ['图像生成', '文本到图像', '多模态理解', '预览功能'],
    requiresApiKey: true,
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    imageGeneration: true,
    modelTypes: [ModelType.ImageGen]
  },
  {
    id: 'gemini-2.0-flash-exp',
    name: 'Gemini 2.0 Flash Exp',
    provider: 'google',
    description: 'Google Gemini 2.0 Flash实验版，支持图像生成功能',
    capabilities: ['聊天对话', '图像生成', '文本到图像', '多模态理解', '实验功能'],
    requiresApiKey: true,
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    imageGeneration: true,
    modelTypes: [ModelType.Chat, ModelType.ImageGen]
  },
];

// 获取模型图标
/**
 * 获取模型图标
 * @param provider 供应商ID
 * @param isDark 是否为深色主题（可选，默认从系统主题判断）
 * @returns 图标路径
 */
export const getModelIcon = (provider: string, isDark?: boolean): string => {
  // 如果未指定 isDark，尝试从系统主题判断
  const theme = isDark ?? (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  return getProviderIcon(provider, theme);
};

// 内置供应商名称映射（用于无 Redux store 时的回退）
const BUILTIN_PROVIDER_NAMES: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  grok: 'xAI (Grok)',
  siliconflow: '硅基流动 (SiliconFlow)',
  volcengine: '火山引擎 (VolcEngine)',
  custom: '自定义',
};

// 获取模型提供商名称（优先从 Redux store 查询，支持自定义供应商）
export const getProviderName = (provider: string): string => {
  if (!provider) return '';
  try {
    const store = require('../store').default;
    const state = store.getState();
    const found = state?.settings?.providers?.find((p: any) => p.id === provider);
    if (found?.name) return found.name;
  } catch {
    // store 未初始化时忽略
  }
  return BUILTIN_PROVIDER_NAMES[provider] || provider;
};
