import type { Model } from '../../types';
import { logApiRequest, logApiResponse } from '../LoggerService';
import { handleError } from '../../utils/error';
import type { ImageGenerationParams, GeneratedImage } from '../../types';
import { ModelType } from '../../types';
import { log } from '../LoggerService';
import { generateImage as openaiGenerateImage, generateVideo as openaiGenerateVideo } from '../../api/openai';
import { generateVideoWithVeo } from '../../api/google/veo';
import type { VideoGenerationParams } from '../../api/openai/video';
import type { GoogleVeoParams } from '../../api/google/veo';

// 重新导出类型
export type { VideoGenerationParams, GoogleVeoParams };

/**
 * 视频生成结果接口
 */
export interface GeneratedVideo {
  url: string;
  prompt: string;
  timestamp: string;
  modelId: string;
  requestId?: string;
}

// 工具函数已移至ProviderFactory，保持APIService简洁

// 这些函数已移至ProviderFactory，保持APIService简洁

// Gemini模型获取已移至ProviderFactory

// Anthropic和Grok模型获取已移至ProviderFactory

// 分组逻辑已移至ProviderFactory，保持APIService简洁

// DeepSeek现在使用OpenAI兼容API，不需要独立实现

// 添加图像生成方法
export async function generateImage(
  model: Model,
  params: ImageGenerationParams
): Promise<GeneratedImage> {
  try {
    log('INFO', `开始生成图像，使用模型: ${model.name}`);

    // 检查模型是否支持图像生成
    // 优先检查模型编辑界面中的"输出能力"标签（modelTypes）
    const isImageGenerationModel =
      // 1. 优先检查 modelTypes 中是否包含图像生成类型（对应编辑界面的"输出能力"）
      (model.modelTypes && model.modelTypes.includes(ModelType.ImageGen)) ||
      // 2. 检查模型的图像生成标志
      model.imageGeneration ||
      model.capabilities?.imageGeneration ||
      // 3. 基于模型ID的后备检测（用于未正确配置的模型）
      model.id.toLowerCase().includes('flux') ||
      model.id.toLowerCase().includes('black-forest') ||
      model.id.toLowerCase().includes('stable-diffusion') ||
      model.id.toLowerCase().includes('sd') ||
      model.id.toLowerCase().includes('dalle') ||
      model.id.toLowerCase().includes('midjourney') ||
      model.id.toLowerCase().includes('grok-2-image') ||
      model.id === 'grok-2-image-1212' ||
      model.id === 'grok-2-image' ||
      model.id === 'grok-2-image-latest' ||
      model.id === 'gemini-2.0-flash-exp-image-generation' ||
      model.id === 'gemini-2.0-flash-preview-image-generation' ||
      (model.id === 'gemini-2.0-flash-exp' && model.imageGeneration);

    if (!isImageGenerationModel) {
      throw new Error(`模型 ${model.name} 不支持图像生成`);
    }

    // 调用OpenAI兼容API生成图像
    const imageUrls = await openaiGenerateImage(model, params);

    // 创建图像生成结果
    const generatedImage: GeneratedImage = {
      url: imageUrls[0], // 取第一个生成的图像
      prompt: params.prompt,
      timestamp: new Date().toISOString(),
      modelId: model.id
    };

    log('INFO', `图像生成成功: ${generatedImage.url.substring(0, 50)}...`);

    return generatedImage;
  } catch (error: any) {
    handleError(error, 'APIService.generateImage', {
      logLevel: 'ERROR',
      additionalData: { params },
      rethrow: true
    });
    throw error;
  }
}

/**
 * 生成视频
 * @param model 模型配置
 * @param params 视频生成参数
 * @returns 生成的视频结果
 */
export async function generateVideo(
  model: Model,
  params: VideoGenerationParams | GoogleVeoParams
): Promise<GeneratedVideo> {
  try {
    log('INFO', `开始生成视频，使用模型: ${model.name}`);

    // 检查模型是否支持视频生成
    const isVideoGenerationModel =
      // 1. 优先检查 modelTypes 中是否包含视频生成类型
      (model.modelTypes && model.modelTypes.includes('video_gen' as any)) ||
      // 2. 检查模型的视频生成标志
      (model as any).videoGeneration ||
      (model.capabilities as any)?.videoGeneration ||
      // 3. 基于模型ID的后备检测
      model.id.includes('HunyuanVideo') ||
      model.id.includes('Wan-AI/Wan2.1-T2V') ||
      model.id.includes('Wan-AI/Wan2.1-I2V') ||
      model.id === 'veo-2.0-generate-001' || // Google Veo 2
      model.id.toLowerCase().includes('video');

    if (!isVideoGenerationModel) {
      throw new Error(`模型 ${model.name} 不支持视频生成`);
    }

    let videoUrl: string;

    // 检查是否是Google Veo模型
    if (model.id === 'veo-2.0-generate-001' || model.provider === 'google') {
      if (!model.apiKey) {
        throw new Error('Google API密钥未设置');
      }

      const result = await generateVideoWithVeo(model.apiKey, params as GoogleVeoParams);

      if (!result.success) {
        throw new Error(result.error || 'Google Veo视频生成失败');
      }

      videoUrl = result.url!;
    } else {
      // 使用OpenAI兼容API生成视频（硅基流动等）
      videoUrl = await openaiGenerateVideo(model, params as VideoGenerationParams);
    }

    // 创建视频生成结果
    const generatedVideo: GeneratedVideo = {
      url: videoUrl,
      prompt: params.prompt,
      timestamp: new Date().toISOString(),
      modelId: model.id
    };

    log('INFO', `视频生成成功: ${generatedVideo.url.substring(0, 50)}...`);

    return generatedVideo;
  } catch (error: any) {
    handleError(error, 'APIService.generateVideo', {
      logLevel: 'ERROR',
      additionalData: { params },
      rethrow: true
    });
    throw error;
  }
}

/**
 * 从API提供商获取模型列表 - 简化版本，参考最佳实例架构
 * @param provider 模型提供商配置
 * @returns 模型列表
 */
export async function fetchModels(provider: any): Promise<Model[]> {
  try {
    logApiRequest('获取模型列表', 'INFO', { provider: provider.id });

    // 直接使用供应商工厂获取已格式化的模型，参考最佳实例架构
    const { fetchModels: factoryFetchModels } = await import('../ProviderFactory');
    const models = await factoryFetchModels(provider);

    logApiResponse('获取模型列表', 200, {
      provider: provider.id,
      modelsCount: models.length
    });

    return models;
  } catch (error) {
    handleError(error, 'APIService.fetchModels', {
      logLevel: 'ERROR',
      additionalData: { provider: provider.id }
    });
    logApiResponse('获取模型列表', 500, {
      provider: provider.id,
      error: error instanceof Error ? error.message : '未知错误'
    });
    return [];
  }
}