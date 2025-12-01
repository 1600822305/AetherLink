/**
 * 图片生成中间件
 * 对标 Cherry Studio ImageGenerationMiddleware
 * 
 * 处理图片生成模型的请求
 */
import type { CompletionsMiddleware } from '../types';
import type { CompletionsResult } from '../schemas';
import { ChunkType } from '../../types/chunk';

export const MIDDLEWARE_NAME = 'ImageGenerationMiddleware';

/**
 * 图片生成模型 ID 模式
 */
const IMAGE_MODEL_PATTERNS = [
  'dall-e',
  'dall-e-2',
  'dall-e-3',
  'stable-diffusion',
  'midjourney',
  'imagen',
  'flux',
];

/**
 * 检查是否是专用图片生成模型
 */
function isDedicatedImageGenerationModel(modelId: string): boolean {
  const lowerModelId = modelId.toLowerCase();
  return IMAGE_MODEL_PATTERNS.some(pattern => lowerModelId.includes(pattern));
}

/**
 * 从消息中提取 prompt
 */
function extractPromptFromMessages(messages: any[]): string {
  // 获取最后一条用户消息
  const userMessages = messages.filter(m => m.role === 'user');
  if (userMessages.length === 0) {
    return '';
  }

  const lastUserMessage = userMessages[userMessages.length - 1];
  
  if (typeof lastUserMessage.content === 'string') {
    return lastUserMessage.content;
  }
  
  if (Array.isArray(lastUserMessage.content)) {
    const textParts = lastUserMessage.content
      .filter((p: any) => p.type === 'text')
      .map((p: any) => p.text);
    return textParts.join('\n');
  }
  
  return '';
}

/**
 * 图片生成中间件
 * 拦截图片生成模型的请求，调用 generateImage API
 */
export const ImageGenerationMiddleware: CompletionsMiddleware = (_api) => (next) =>
  async (context, params): Promise<CompletionsResult> => {
    const { assistant, messages, onChunk, enableGenerateImage } = params;
    const { apiClientInstance } = context;
    const model = assistant?.model;

    // 检查是否是图片生成模型
    if (!model || !isDedicatedImageGenerationModel(model.id)) {
      // 如果不是专用图片生成模型但启用了图片生成，继续正常流程
      if (!enableGenerateImage) {
        return next(context, params);
      }
    }

    console.log(`[ImageGenerationMiddleware] Handling image generation for model: ${model?.id}`);

    // 提取 prompt
    const prompt = extractPromptFromMessages(messages);
    if (!prompt) {
      console.warn('[ImageGenerationMiddleware] No prompt found in messages');
      return next(context, params);
    }

    // 发送图片创建开始事件
    if (onChunk) {
      await onChunk({ type: ChunkType.IMAGE_CREATED });
    }

    try {
      // 调用图片生成 API
      const images = await apiClientInstance.generateImage({
        model: model?.id || 'dall-e-3',
        prompt,
        n: 1,
        size: '1024x1024',
        quality: 'standard',
      });

      console.log(`[ImageGenerationMiddleware] Generated ${images.length} images`);

      // 发送图片完成事件
      if (onChunk) {
        await onChunk({
          type: ChunkType.IMAGE_COMPLETE,
          image: {
            type: 'base64',
            images: images.map(url => {
              // 如果是 URL，保持原样；如果是 base64，添加前缀
              if (url.startsWith('http')) {
                return url;
              }
              return url.startsWith('data:') ? url : `data:image/png;base64,${url}`;
            }),
          },
        });
      }

      // 返回结果
      return {
        getText: () => `Generated ${images.length} image(s)`,
        getReasoning: () => undefined,
        rawOutput: { images },
      };
    } catch (error) {
      console.error('[ImageGenerationMiddleware] Image generation failed:', error);

      // 发送错误事件
      if (onChunk) {
        await onChunk({
          type: ChunkType.ERROR,
          error: {
            message: error instanceof Error ? error.message : String(error),
            type: 'IMAGE_GENERATION_ERROR',
          },
        });
      }

      throw error;
    }
  };
