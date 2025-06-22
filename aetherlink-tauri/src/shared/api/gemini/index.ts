/**
 * Gemini API模块
 * 导出统一的API接口
 */

// 导入必要的类型
import type { Model, Message, ImageGenerationParams } from '../../types';
import GeminiProvider from './provider';
import { generateImage, generateImageByChat } from './image.ts';
import { isGenerateImageModel } from '../../config/models';

// 导出客户端模块
export {
  createClient,
  testConnection,
  fetchModels
} from './client.ts';

// 导出提供商模块
export {
  BaseProvider
} from './provider';
export { default as GeminiProvider } from './provider';

// 导出嵌入服务模块
export {
  GeminiEmbeddingService,
  createGeminiEmbeddingService,
  getGeminiEmbedding,
  getGeminiEmbeddingDimensions
} from './embeddingService';

// 创建Provider实例的工厂函数
export function createProvider(model: Model): GeminiProvider {
  return new GeminiProvider({
    id: model.id,
    name: model.name || 'Gemini',
    apiKey: model.apiKey,
    apiHost: model.baseUrl || 'https://generativelanguage.googleapis.com/v1beta',
    models: [{ id: model.id }]
  });
}

// 导出图像生成模块
export {
  generateImage,
  generateImageByChat
} from './image.ts';

// 导出文件服务模块
export {
  GeminiFileService,
  createGeminiFileService
} from './fileService.ts';

// 导入文件服务用于内部使用
import { createGeminiFileService } from './fileService.ts';

/**
 * 创建Gemini API适配器
 * @param model 模型配置
 * @returns Gemini API适配器对象
 *
 * 使用方法:
 * ```
 * const api = createGeminiAPI(model);
 * const response = await api.sendMessage(messages, {
 *   onUpdate: (content) => console.log(content)
 * });
 * ```
 */
export function createGeminiAPI(model: Model) {
  console.log(`[gemini/index.ts] 创建Gemini API适配器 - 模型ID: ${model.id}`);
  const provider = createProvider(model);

  return {
    /**
     * 发送消息并获取响应 - 使用completions方法
     */
    sendMessage: async (
      messages: Message[],
      options?: {
        onUpdate?: (content: string) => void;
        enableWebSearch?: boolean;
        enableThinking?: boolean;
        enableTools?: boolean;
        mcpTools?: import('../../types').MCPTool[];
        mcpMode?: 'prompt' | 'function';
        systemPrompt?: string;
        abortSignal?: AbortSignal;
        assistant?: any;
      }
    ) => {
      console.log(`[gemini/index.ts] 通过API适配器发送消息 - 模型ID: ${model.id}, 消息数量: ${messages.length}`);

      // 转换为的参数格式
      const assistant = options?.assistant || {
        model: model,
        prompt: options?.systemPrompt || '',
        settings: {
          streamOutput: true
        },
        enableWebSearch: options?.enableWebSearch || false,
        // 对于图像生成模型，默认启用图像生成
        enableGenerateImage: isGenerateImageModel(model)
      };

      let result = '';
      const mcpTools = options?.mcpTools || [];

      await provider.completions({
        messages,
        assistant,
        mcpTools,
        onChunk: (chunk: any) => {
          if (chunk.type === 'TEXT_DELTA' && chunk.text) {
            result += chunk.text;
            // 传递增量文本给前端，让前端自己累积
            options?.onUpdate?.(chunk.text);
          }
        },
        onFilterMessages: () => {}
      });

      return result;
    },

    /**
     * 生成图像
     */
    generateImage: (
      params: ImageGenerationParams
    ) => {
      console.log(`[gemini/index.ts] 通过API适配器生成图像 - 模型ID: ${model.id}`);
      return generateImage(model, params);
    },

    /**
     * 在聊天中生成图像
     */
    generateImageByChat: (
      messages: Message[],
      options?: {
        onUpdate?: (content: string) => void;
        assistant?: any;
      }
    ) => {
      console.log(`[gemini/index.ts] 通过API适配器在聊天中生成图像 - 模型ID: ${model.id}`);
      // 使用导入的函数而不是 provider 方法
      return generateImageByChat(model, messages, options?.onUpdate);
    },

    /**
     * 上传文件到 Gemini
     */
    uploadFile: async (file: import('../../types').FileType) => {
      console.log(`[gemini/index.ts] 通过API适配器上传文件 - 模型ID: ${model.id}, 文件: ${file.origin_name}`);
      try {
        const fileService = createGeminiFileService(model);
        return await fileService.uploadFile(file);
      } catch (error) {
        console.error(`[gemini/index.ts] 文件上传失败:`, error);
        throw error;
      }
    },

    /**
     * 获取文件的 base64 编码
     */
    getBase64File: async (file: import('../../types').FileType) => {
      console.log(`[gemini/index.ts] 通过API适配器获取文件base64 - 模型ID: ${model.id}, 文件: ${file.origin_name}`);
      try {
        const fileService = createGeminiFileService(model);
        const result = await fileService.getBase64File(file);
        return result.data;
      } catch (error) {
        console.error(`[gemini/index.ts] 获取文件base64失败:`, error);
        throw error;
      }
    },

    /**
     * 列出已上传的文件
     */
    listFiles: async () => {
      console.log(`[gemini/index.ts] 通过API适配器获取文件列表 - 模型ID: ${model.id}`);
      try {
        const fileService = createGeminiFileService(model);
        return await fileService.listFiles();
      } catch (error) {
        console.error(`[gemini/index.ts] 获取文件列表失败:`, error);
        throw error;
      }
    },

    /**
     * 删除已上传的文件
     */
    deleteFile: async (fileId: string) => {
      console.log(`[gemini/index.ts] 通过API适配器删除文件 - 模型ID: ${model.id}, 文件ID: ${fileId}`);
      try {
        const fileService = createGeminiFileService(model);
        await fileService.deleteFile(fileId);
        return true;
      } catch (error) {
        console.error(`[gemini/index.ts] 删除文件失败:`, error);
        throw error;
      }
    },

    /**
     * 获取文本嵌入
     */
    getEmbedding: async (text: string, options?: {
      taskType?: 'RETRIEVAL_QUERY' | 'RETRIEVAL_DOCUMENT' | 'SEMANTIC_SIMILARITY' | 'CLASSIFICATION' | 'CLUSTERING';
      title?: string;
    }) => {
      console.log(`[gemini/index.ts] 通过API适配器获取嵌入 - 模型ID: ${model.id}, 文本长度: ${text.length}`);
      return provider.getEmbedding(text, options);
    },

    /**
     * 获取嵌入维度
     */
    getEmbeddingDimensions: async () => {
      console.log(`[gemini/index.ts] 通过API适配器获取嵌入维度 - 模型ID: ${model.id}`);
      return provider.getEmbeddingDimensions(model);
    },

    /**
     * 测试API连接
     */
    testConnection: () => provider.check(model)
  };
}

/**
 * 发送聊天请求
 * 兼容旧版API
 */
export const sendChatRequest = async (
  messages: Message[],
  model: Model,
  onUpdate?: (content: string) => void
): Promise<string> => {
  console.log(`[gemini/index.ts] 发送聊天请求 - 模型ID: ${model.id}, 消息数量: ${messages.length}`);
  const provider = createProvider(model);

  const assistant = {
    model: model,
    prompt: '',
    settings: {
      streamOutput: true
    },
    // 对于图像生成模型，默认启用图像生成
    enableGenerateImage: isGenerateImageModel(model)
  };

  let result = '';
  await provider.completions({
    messages,
    assistant,
    mcpTools: [],
    onChunk: (chunk: any) => {
      if (chunk.type === 'TEXT_DELTA' && chunk.text) {
        result += chunk.text;
        // 传递增量文本给前端，让前端自己累积
        onUpdate?.(chunk.text);
      }
    },
    onFilterMessages: () => {}
  });

  return result;
};

