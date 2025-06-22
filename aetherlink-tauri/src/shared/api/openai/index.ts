/**
 * OpenAI API模块
 * 导出统一的API接口
 */

// 导入必要的类型
import type { Model, Message } from '../../types';
import { OpenAIProvider } from './provider';

// 导出客户端模块
export {
  createClient,
  supportsMultimodal,
  supportsWebSearch,
  supportsReasoning,
  getWebSearchParams,
  testConnection,
  isAzureOpenAI
} from './client';

// 导入统一的聊天模块
import { sendChatMessage } from './chat';

// 导出模型管理模块
export {
  fetchModels,
  fetchModelsWithSDK
} from './models';

// 导出多模态处理模块
export {
  convertToOpenAIMessages,
  hasImages,
  hasOpenAIFormatImages,
  type MessageContentItem
} from './multimodal';

// 导出工具调用模块
export {
  WEB_SEARCH_TOOL
} from './tools';

// 导出统一流式响应模块
export {
  unifiedStreamCompletion as streamCompletion,
  createAdvancedStreamProcessor as OpenAIStreamProcessor,
  createUnifiedStreamProcessor
} from './unifiedStreamProcessor';

// 导出图像生成模块
export {
  generateImage,
  generateImageByChat
} from './image';

// 导出视频生成模块
export {
  generateVideo,
  type VideoGenerationParams,
  type GeneratedVideo
} from './video';

// 导出Provider类
export {
  BaseOpenAIProvider,
  OpenAIProvider
} from './provider';

// 导出参数管理器
export {
  OpenAIParameterManager,
  createParameterManager,
  getParameterManager,
  type ParameterConfig,
  type BaseParameters,
  type OpenAISpecificParameters,
  type ReasoningParameters,
  type CompleteAPIParameters
} from './parameterManager';

// 导出统一聊天模块
export {
  sendChatMessage,
  type ChatOptions,
  type ChatResponse
} from './chat';

// 导出响应处理器
export {
  createResponseHandler,
  ResponseHandler,
  defaultResponseHandler
} from './responseHandler';

// 使用统一聊天模块的包装函数
export async function sendChatRequest(
  messages: any[],
  model: Model,
  options?: {
    onUpdate?: (content: string, reasoning?: string) => void;
    systemPrompt?: string;
  }
): Promise<string | { content: string; reasoning?: string; reasoningTime?: number }> {
  const onUpdate = options?.onUpdate;
  const systemPrompt = options?.systemPrompt || '';

  console.log(`[openai/index.ts] 使用统一聊天模块 - 模型ID: ${model.id}, 消息数量: ${messages.length}`);

  return sendChatMessage(messages, model, {
    onUpdate,
    systemPrompt
  });
}

/**
 * 创建OpenAI API适配器
 * @param model 模型配置
 * @returns OpenAI API适配器对象
 *
 * 使用方法:
 * ```
 * const api = createOpenAIAPI(model);
 * const response = await api.sendMessage(messages, {
 *   enableWebSearch: true,
 *   systemPrompt: "你是一个有用的助手"
 * });
 * ```
 */
export function createOpenAIAPI(model: Model) {
  console.log(`[openai/index.ts] 创建OpenAI API适配器 - 模型ID: ${model.id}`);
  const provider = new OpenAIProvider(model);

  return {
    /**
     * 发送消息并获取响应 - 使用统一聊天模块
     */
    sendMessage: (
      messages: Message[],
      options?: {
        onUpdate?: (content: string, reasoning?: string) => void;
        enableWebSearch?: boolean;
        systemPrompt?: string;
        enableTools?: boolean;
        mcpTools?: import('../../types').MCPTool[];
        mcpMode?: 'prompt' | 'function';
        abortSignal?: AbortSignal;
        assistant?: any;
      }
    ) => {
      console.log(`[openai/index.ts] 通过统一聊天模块发送消息 - 模型ID: ${model.id}, 消息数量: ${messages.length}`);
      return sendChatMessage(messages, model, options);
    },

    /**
     * 测试API连接
     */
    testConnection: () => provider.testConnection()
  };
}
