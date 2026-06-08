/**
 * DashScope (阿里云百炼) API 模块
 * 导出统一的 API 接口
 */
import type { Model, Message } from '../../types';
import { sendChatMessage as openaiSendChatMessage } from '../openai/chat';
import { getDashScopeCompatibleUrl } from './client';

// 导出客户端模块
export {
  createCompatibleClient,
  dashScopeRequest,
  getDashScopeBaseUrl,
  getDashScopeCompatibleUrl,
  isDashScopeProvider
} from './client';

// 导出图像生成模块
export {
  generateImage,
  isDashScopeImageModel
} from './image';

// 导出 Provider
export { DashScopeProvider } from './provider';

/**
 * 发送聊天请求（走 OpenAI 兼容模式）
 */
export async function sendChatRequest(
  messages: any[],
  model: Model,
  options?: { systemPrompt?: string }
): Promise<string | { content: string; reasoning?: string; reasoningTime?: number }> {
  const compatibleModel = {
    ...model,
    baseUrl: getDashScopeCompatibleUrl(model)
  };

  console.log(`[DashScope] sendChatRequest - 模型: ${model.id}, 使用兼容模式`);

  return openaiSendChatMessage(messages as Message[], compatibleModel, {
    systemPrompt: options?.systemPrompt
  });
}

/**
 * 获取 DashScope 模型列表
 * DashScope 不支持标准的 /v1/models 接口，返回预设列表
 */
export async function fetchModels(_provider: any): Promise<any[]> {
  console.log(`[DashScope] 使用预设模型列表`);
  return [
    // 聊天模型
    { id: 'qwen-max', name: 'Qwen-Max', description: '通义千问超大规模语言模型，适合复杂任务', owned_by: 'dashscope' },
    { id: 'qwen-plus', name: 'Qwen-Plus', description: '通义千问大规模语言模型，平衡效果与成本', owned_by: 'dashscope' },
    { id: 'qwen-turbo', name: 'Qwen-Turbo', description: '通义千问快速模型，适合简单任务', owned_by: 'dashscope' },
    { id: 'qwen-long', name: 'Qwen-Long', description: '通义千问长文本模型，支持超长上下文', owned_by: 'dashscope' },
    { id: 'qwen3-235b-a22b', name: 'Qwen3-235B-A22B', description: 'Qwen3 旗舰模型，MoE架构', owned_by: 'dashscope' },
    { id: 'qwen3-32b', name: 'Qwen3-32B', description: 'Qwen3 32B 密集模型', owned_by: 'dashscope' },
    { id: 'qwen3-30b-a3b', name: 'Qwen3-30B-A3B', description: 'Qwen3 MoE轻量模型', owned_by: 'dashscope' },
    // 视觉模型
    { id: 'qwen-vl-max', name: 'Qwen-VL-Max', description: '通义千问视觉模型旗舰版', owned_by: 'dashscope' },
    { id: 'qwen-vl-plus', name: 'Qwen-VL-Plus', description: '通义千问视觉模型增强版', owned_by: 'dashscope' },
    // 文生图模型
    { id: 'qwen-image-2.0-pro', name: 'Qwen-Image 2.0 Pro', description: '千问图像生成Pro，文字渲染和真实质感更强', owned_by: 'dashscope' },
    { id: 'qwen-image-2.0', name: 'Qwen-Image 2.0', description: '千问图像生成加速版，兼顾效果与速度', owned_by: 'dashscope' },
    { id: 'qwen-image-max', name: 'Qwen-Image Max', description: '千问图像生成Max，真实感和自然度更强', owned_by: 'dashscope' },
    { id: 'qwen-image-plus', name: 'Qwen-Image Plus', description: '千问图像生成Plus，擅长多样化艺术风格', owned_by: 'dashscope' },
  ];
}
