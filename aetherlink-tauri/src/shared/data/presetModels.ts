import type { PresetModel } from '../types';
import { ModelType } from '../types';

// 预设模型列表
export const presetModels: PresetModel[] = [
  // OpenAI 模型
  {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    provider: 'openai',
    description: '快速、经济实惠的AI助手，适合大多数日常任务。',
    capabilities: ['聊天对话', '内容生成', '简单问答', '代码辅助'],
    requiresApiKey: true,
    defaultBaseUrl: 'https://api.openai.com/v1',
  },
  {
    id: 'gpt-4',
    name: 'GPT-4',
    provider: 'openai',
    description: '强大的大型语言模型，具有更强的推理能力和更广泛的知识。',
    capabilities: ['复杂推理', '高级内容创作', '代码生成', '多步骤问题解决'],
    requiresApiKey: true,
    defaultBaseUrl: 'https://api.openai.com/v1',
  },
  {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    provider: 'openai',
    description: 'GPT-4的优化版本，提供更快的响应速度和更新的知识。',
    capabilities: ['复杂推理', '高级内容创作', '代码生成', '多步骤问题解决', '更新的知识库'],
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
    id: 'claude-3-opus',
    name: 'Claude 3 Opus',
    provider: 'anthropic',
    description: 'Anthropic最强大的模型，具有卓越的推理能力和创造力。',
    capabilities: ['复杂推理', '高级内容创作', '代码生成', '多步骤问题解决', '更准确的回答'],
    requiresApiKey: true,
    defaultBaseUrl: 'https://api.anthropic.com/v1',
  },
  {
    id: 'claude-3-sonnet',
    name: 'Claude 3 Sonnet',
    provider: 'anthropic',
    description: '平衡性能和速度的中端模型，适合大多数任务。',
    capabilities: ['聊天对话', '内容生成', '代码辅助', '问题解决'],
    requiresApiKey: true,
    defaultBaseUrl: 'https://api.anthropic.com/v1',
  },
  {
    id: 'claude-3-haiku',
    name: 'Claude 3 Haiku',
    provider: 'anthropic',
    description: '快速、轻量级的模型，适合简单任务和实时应用。',
    capabilities: ['快速回复', '简单问答', '基础内容生成'],
    requiresApiKey: true,
    defaultBaseUrl: 'https://api.anthropic.com/v1',
  },

  // Google 模型
  {
    id: 'gemini-pro',
    name: 'Gemini Pro',
    provider: 'google',
    description: 'Google的高性能大语言模型，具有强大的推理和生成能力。',
    capabilities: ['复杂推理', '内容生成', '代码辅助', '多语言支持'],
    requiresApiKey: true,
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
  },
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'google',
    description: 'Google的快速大模型，具有良好的响应速度和质量的平衡。',
    capabilities: ['快速响应', '内容生成', '代码辅助'],
    requiresApiKey: true,
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
  },
  {
    id: 'gemini-2.5-flash-preview-04-17',
    name: 'Gemini 2.5 Flash Preview 04-17',
    provider: 'google',
    description: 'Google最新的思考模型预览版，具有更强的推理能力和思考功能。',
    capabilities: ['思考过程', '复杂推理', '内容生成', '代码辅助', '支持系统指令'],
    requiresApiKey: true,
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
  },
  {
    id: 'gemini-ultra',
    name: 'Gemini Ultra',
    provider: 'google',
    description: 'Google最先进的大语言模型，具有卓越的多模态能力。',
    capabilities: ['复杂推理', '高级内容创作', '代码生成', '多模态理解'],
    requiresApiKey: true,
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1',
  },

  // Grok 模型
  {
    id: 'grok-1',
    name: 'Grok-1',
    provider: 'grok',
    description: 'xAI的Grok模型，擅长幽默风格回复和实时信息。',
    capabilities: ['实时知识', '网络搜索', '幽默回复', '代码生成'],
    requiresApiKey: true,
    defaultBaseUrl: 'https://api.x.ai/v1',
  },
  {
    id: 'grok-2',
    name: 'Grok-2',
    provider: 'grok',
    description: 'xAI的最新Grok模型，具有增强的推理能力和更新的知识库。',
    capabilities: ['复杂推理', '实时知识', '代码生成', '问题解决', '多模态理解'],
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
    name: 'DeepSeek-V3',
    provider: 'deepseek',
    description: 'DeepSeek最新的大型语言模型，具有优秀的中文和代码能力。',
    capabilities: ['聊天对话', '内容生成', '中文优化', '代码辅助', '思考过程'],
    requiresApiKey: true,
    defaultBaseUrl: 'https://api.deepseek.com',
  },
  {
    id: 'deepseek-reasoner',
    name: 'DeepSeek-R1',
    provider: 'deepseek',
    description: 'DeepSeek的推理模型，擅长解决复杂推理问题。',
    capabilities: ['复杂推理', '思考过程', '代码生成', '多步骤问题解决'],
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
export const getModelIcon = (provider: string): string => {
  switch (provider) {
    case 'openai':
      return '/icons/openai.png';
    case 'anthropic':
      return '/icons/anthropic.png';
    case 'google':
      return '/icons/google.png';
    case 'grok':
      return '/icons/grok.png';
    case 'siliconflow':
      return '/icons/siliconflow.png';
    case 'volcengine':
      return '/icons/volcengine.png';
    case 'custom':
      return '/icons/custom.png';
    default:
      return '/icons/ai.png';
  }
};

// 获取模型提供商名称
export const getProviderName = (provider: string): string => {
  switch (provider) {
    case 'openai':
      return 'OpenAI';
    case 'anthropic':
      return 'Anthropic';
    case 'google':
      return 'Google';
    case 'grok':
      return 'xAI (Grok)';
    case 'siliconflow':
      return '硅基流动 (SiliconFlow)';
    case 'volcengine':
      return '火山引擎 (VolcEngine)';
    case 'custom':
      return '自定义';
    default:
      return provider;
  }
};
