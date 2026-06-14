/**
 * Gemini AI SDK 图像生成服务
 * 使用 @ai-sdk/google 实现图像生成
 */
import type { Model } from '../../types';
import { createLogger } from '../../services/infra/logger';

const logger = createLogger('GeminiImage');


/**
 * 图像生成结果
 */
export interface GeneratedImage {
  url?: string;
  base64?: string;
  mimeType?: string;
}

/**
 * 图像生成选项
 */
export interface ImageGenerationOptions {
  prompt: string;
  imageSize?: string;
  batchSize?: number;
  quality?: string;
  style?: string;
}

/**
 * 生成图像
 * 使用 Gemini 的图像生成能力
 * @param model 模型配置
 * @param options 生成选项
 * @returns 图像 URL 数组
 */
export async function generateImage(
  model: Model,
  options: ImageGenerationOptions
): Promise<string[]> {
  const { prompt } = options;
  // 注意: Gemini 当前不支持批量图像生成，batchSize 参数保留用于未来扩展

  const apiKey = model.apiKey;
  const baseUrl = model.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
  
  // 使用 Gemini 2.0 Flash 的图像生成能力
  const imageModelId = model.id || 'gemini-2.0-flash-exp-image-generation';
  
  try {
    logger.debug(`开始生成图像, 模型: ${imageModelId}`);
    
    const url = `${baseUrl}/models/${imageModelId}:generateContent?key=${apiKey}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
          responseMimeType: 'text/plain'
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini 图像生成失败: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    
    // 解析响应中的图像，转换为 data URL
    const imageUrls: string[] = [];
    
    if (data.candidates && data.candidates[0]?.content?.parts) {
      for (const part of data.candidates[0].content.parts) {
        if (part.inlineData) {
          const mimeType = part.inlineData.mimeType || 'image/png';
          const base64Data = part.inlineData.data;
          // 转换为 data URL 格式
          const dataUrl = `data:${mimeType};base64,${base64Data}`;
          imageUrls.push(dataUrl);
        }
      }
    }

    if (imageUrls.length === 0) {
      logger.warn('响应中没有图像数据');
      throw new Error('Gemini 没有返回图像数据');
    }

    logger.debug(`成功生成 ${imageUrls.length} 张图像`);
    return imageUrls;
    
  } catch (error) {
    logger.error('图像生成失败:', error);
    throw error;
  }
}

/**
 * 默认导出
 */
export default generateImage;
