/**
 * Gemini 图像生成 API
 * 基于 Google Generative AI SDK 实现，支持真正的图像生成功能
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Part } from '@google/generative-ai';
import type { Model, ImageGenerationParams } from '../../types';
import { logApiRequest, logApiResponse, log } from '../../services/LoggerService';
import { isGenerateImageModel } from '../../config/models';
import { withRetry } from '../../utils/retryUtils';
import { GeminiConfigBuilder } from './configBuilder';

/**
 * 创建图像生成专用的助手配置
 */
function createImageAssistant(): any {
  return {
    settings: {
      // 图像生成使用较低的温度以获得更一致的结果
      temperature: 0.7
    }
  };
}

/**
 * 统一的图像生成错误处理
 */
function handleImageGenerationError(error: any, model: Model, context: string): never {
  log('ERROR', `${context}失败: ${error.message || '未知错误'}`, {
    model: model.id,
    provider: model.provider,
    error
  });
  throw error;
}

/**
 * 处理Gemini图像响应
 * @param response Gemini响应
 * @returns 图像数据数组
 */
function processGeminiImageResponse(response: any): { type: 'base64'; images: string[] } | undefined {
  const candidates = response.candidates;
  if (!candidates || !candidates[0] || !candidates[0].content) {
    return undefined;
  }

  const parts = candidates[0].content.parts;
  if (!parts) {
    return undefined;
  }

  // 提取图像数据
  const images = parts
    .filter((part: Part) => part.inlineData)
    .map((part: Part) => {
      if (!part.inlineData) {
        return null;
      }
      const dataPrefix = `data:${part.inlineData.mimeType || 'image/png'};base64,`;
      return part.inlineData.data?.startsWith('data:') ? part.inlineData.data : dataPrefix + part.inlineData.data;
    })
    .filter((image: string | null) => image !== null);

  return {
    type: 'base64',
    images: images
  };
}

/**
 * 使用 Gemini API 生成图像
 * @param model 模型配置
 * @param params 图像生成参数
 * @returns 生成的图像URL数组
 */
export async function generateImage(
  model: Model,
  params: ImageGenerationParams
): Promise<string[]> {
  try {
    // 检查模型是否支持图像生成
    if (!isGenerateImageModel(model)) {
      throw new Error(`模型 ${model.id} 不支持图像生成功能`);
    }

    // 获取API密钥
    const apiKey = model.apiKey;
    if (!apiKey) {
      throw new Error(`API密钥未设置，无法使用${model.name}生成图像`);
    }

    // 创建 Gemini 客户端
    const genAI = new GoogleGenerativeAI(apiKey);
    const geminiModel = genAI.getGenerativeModel({ model: model.id });

    // 记录API请求
    logApiRequest('Gemini Image Generation', 'INFO', {
      method: 'POST',
      model: model.id,
      provider: model.provider,
      prompt: params.prompt.substring(0, 50) + (params.prompt.length > 50 ? '...' : '')
    });

    // 构建图像生成提示词
    const imagePrompt = `Generate an image based on this description: ${params.prompt}`;

    // 使用 GeminiConfigBuilder 构建配置
    const imageAssistant = createImageAssistant();
    const configBuilder = new GeminiConfigBuilder(imageAssistant, model, 8192, undefined, []);
    const config = configBuilder.build();

    // 发送请求，在这里传递图像生成配置，并添加重试机制
    const result = await withRetry(
      () => geminiModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: imagePrompt }] }],
        generationConfig: {
          temperature: config.temperature,
          maxOutputTokens: config.maxOutputTokens,
          responseMimeType: config.responseMimeType || 'text/plain',
          responseModalities: config.responseModalities || ['TEXT', 'IMAGE']
        } as any // 使用 any 类型来支持 responseModalities
      }),
      'Gemini Image Generation API',
      3 // 最多重试3次
    );
    const response = result.response;

    // 处理图像响应
    const imageResult = processGeminiImageResponse(response);

    if (!imageResult || imageResult.images.length === 0) {
      // 如果没有图像，尝试从文本响应中获取信息
      const text = response.text();
      throw new Error(`Gemini图像生成失败: ${text || '未生成图像内容'}`);
    }

    // 记录API响应
    logApiResponse('Gemini Image Generation', 200, {
      model: model.id,
      provider: model.provider,
      imageCount: imageResult.images.length
    });

    return imageResult.images;
  } catch (error: any) {
    handleImageGenerationError(error, model, 'Gemini图像生成');
  }
}

/**
 * 在聊天中使用 Gemini 生成图像
 * @param model 模型配置
 * @param messages 消息数组
 * @param onUpdate 更新回调
 * @returns 生成的图像URL数组
 */
export async function generateImageByChat(
  model: Model,
  messages: any[],
  onUpdate?: (content: string) => void
): Promise<string[]> {
  try {
    // 获取最后一条用户消息作为提示词
    const lastUserMessage = messages.slice().reverse().find((msg: any) => msg.role === 'user');
    if (!lastUserMessage) {
      throw new Error('没有找到用户消息作为图像生成提示');
    }

    // 提取文本内容作为提示词
    let prompt = '';
    if (typeof lastUserMessage.content === 'string') {
      prompt = lastUserMessage.content;
    } else if (Array.isArray(lastUserMessage.content)) {
      // 处理多模态内容，提取文本部分
      const textParts = lastUserMessage.content.filter((part: any) => part.type === 'text');
      prompt = textParts.map((part: any) => part.text).join(' ');
    }

    if (!prompt.trim()) {
      throw new Error('没有找到有效的图像生成提示词');
    }

    // 通知开始生成
    if (onUpdate) {
      onUpdate('正在使用 Gemini 生成图像...');
    }

    // 使用基础图像生成功能
    const imageUrls = await generateImage(model, {
      prompt: prompt.trim(),
      imageSize: '1024x1024',
      batchSize: 1
    });

    // 通知生成完成
    if (onUpdate) {
      onUpdate(`Gemini 图像生成完成！生成了 ${imageUrls.length} 张图像。`);
    }

    return imageUrls;
  } catch (error: any) {
    if (onUpdate) {
      onUpdate(`Gemini 图像生成失败: ${error.message || '未知错误'}`);
    }
    handleImageGenerationError(error, model, 'Gemini聊天中图像生成');
  }
}
