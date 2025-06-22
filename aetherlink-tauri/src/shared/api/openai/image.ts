/**
 * OpenAI兼容格式的图像生成API
 */
import type { Model, ImageGenerationParams } from '../../types';
import { createClient } from './client';
import { logApiRequest, logApiResponse, log } from '../../services/LoggerService';

/**
 * 使用OpenAI兼容格式生成图像 - 完整支持版本
 * @param model 模型配置
 * @param params 图像生成参数
 * @returns 生成的图像URL数组
 */
export async function generateImage(
  model: Model,
  params: ImageGenerationParams
): Promise<string[]> {
  try {
    // 获取API密钥和基础URL
    const apiKey = model.apiKey;
    const baseUrl = model.baseUrl || 'https://api.siliconflow.cn/v1';

    if (!apiKey) {
      throw new Error(`API密钥未设置，无法使用${model.name}生成图像`);
    }

    // 创建OpenAI兼容客户端
    const client = createClient(model);

    // 检查是否为 Grok 模型
    const isGrokModel = model.id.includes('grok') || model.provider === 'grok';

    // 准备请求参数 - 根据模型类型使用不同参数
    let requestParams: any = {
      model: model.id,
      prompt: params.prompt,
      response_format: isGrokModel ? 'b64_json' : 'url'
    };

    if (isGrokModel) {
      // Grok 模型只支持基础参数
    } else {
      // 其他模型使用完整参数
      // 确保size参数符合OpenAI API的要求
      let imageSize = params.imageSize || '1024x1024';
      // 检查是否是有效的尺寸
      if (!['256x256', '512x512', '1024x1024', '1024x1536', '1536x1024'].includes(imageSize)) {
        // 默认使用1024x1024
        imageSize = '1024x1024';
      }

      requestParams.size = imageSize;
      requestParams.n = params.batchSize || 1;
      requestParams.quality = params.quality || 'standard';
      requestParams.style = params.style || 'natural';
    }

    // 添加高级参数（如果支持）
    if (params.negativePrompt) {
      requestParams.negative_prompt = params.negativePrompt;
    }

    if (params.seed !== undefined && params.seed !== null) {
      requestParams.seed = parseInt(params.seed.toString());
    }

    if (params.steps !== undefined) {
      requestParams.num_inference_steps = params.steps;
    }

    if (params.guidanceScale !== undefined) {
      requestParams.guidance_scale = params.guidanceScale;
    }

    if (params.promptEnhancement !== undefined) {
      requestParams.prompt_enhancement = params.promptEnhancement;
    }

    // 记录API请求
    logApiRequest('Image Generation', 'INFO', {
      method: 'POST',
      url: `${baseUrl}/images/generations`,
      model: model.id,
      provider: model.provider,
      params: {
        ...requestParams,
        prompt: params.prompt.substring(0, 50) + (params.prompt.length > 50 ? '...' : '')
      }
    });

    // 发送请求
    const response = await client.images.generate(requestParams);

    // 处理响应 - 根据模型类型处理不同格式
    let imageUrls: string[] = [];

    if (isGrokModel) {
      // Grok 模型返回 base64 格式，需要转换为 data URL
      imageUrls = response.data?.map(item => {
        if (item.b64_json) {
          return `data:image/png;base64,${item.b64_json}`;
        }
        return '';
      }).filter(Boolean) || [];
    } else {
      // 其他模型返回 URL 格式
      imageUrls = response.data?.map(item => item.url || '') || [];
    }

    // 如果没有返回图像URL，抛出错误
    if (imageUrls.length === 0) {
      throw new Error('图像生成API没有返回有效的图像URL');
    }

    // 记录API响应
    logApiResponse('Image Generation', 200, {
      model: model.id,
      provider: model.provider,
      imageCount: imageUrls.length,
      firstImageUrl: imageUrls[0]?.substring(0, 50) + '...'
    });

    return imageUrls;
  } catch (error: any) {
    // 记录错误
    log('ERROR', `图像生成失败: ${error.message || '未知错误'}`, {
      model: model.id,
      provider: model.provider,
      error
    });

    throw error;
  }
}

/**
 * 在聊天中生成图像 - 完整支持版本
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
      onUpdate('正在生成图像...');
    }

    // 使用基础图像生成功能
    const imageUrls = await generateImage(model, {
      prompt: prompt.trim(),
      imageSize: '1024x1024',
      batchSize: 1
    });

    // 通知生成完成
    if (onUpdate) {
      onUpdate(`图像生成完成！生成了 ${imageUrls.length} 张图像。`);
    }

    return imageUrls;
  } catch (error: any) {
    log('ERROR', `聊天中图像生成失败: ${error.message || '未知错误'}`, {
      model: model.id,
      provider: model.provider,
      error
    });

    if (onUpdate) {
      onUpdate(`图像生成失败: ${error.message || '未知错误'}`);
    }

    throw error;
  }
}
