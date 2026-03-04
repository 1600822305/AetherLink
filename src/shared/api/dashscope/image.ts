/**
 * DashScope (阿里云百炼) 文生图 API
 * 使用 DashScope 原生接口，非 OpenAI 兼容格式
 *
 * 官方文档: https://help.aliyun.com/zh/model-studio/qwen-image-api
 *
 * 支持模型:
 * - qwen-image-2.0-pro (推荐)
 * - qwen-image-2.0 (加速版)
 * - qwen-image-max
 * - qwen-image-plus
 */
import type { Model, ImageGenerationParams } from '../../types';
import { dashScopeRequest, getDashScopeBaseUrl } from './client';
import { logApiRequest, logApiResponse, log } from '../../services/infra/LoggerService';

// DashScope 文生图 API 路径
const IMAGE_GENERATION_PATH = '/api/v1/services/aigc/multimodal-generation/generation';

// qwen-image-2.0 系列支持的尺寸范围：512*512 ~ 2048*2048
// qwen-image-max/plus 系列支持的固定尺寸
const QWEN_IMAGE_MAX_PLUS_SIZES = [
  '1664*928',   // 16:9
  '1472*1104',  // 4:3
  '1328*1328',  // 1:1
  '1104*1472',  // 3:4
  '928*1664'    // 9:16
];

/**
 * DashScope 文生图请求体
 */
interface DashScopeImageRequest {
  model: string;
  input: {
    messages: Array<{
      role: 'user';
      content: Array<{ text: string }>;
    }>;
  };
  parameters?: {
    size?: string;
    n?: number;
    negative_prompt?: string;
    seed?: number;
    prompt_extend?: boolean;
    watermark?: boolean;
  };
}

/**
 * DashScope 文生图响应体
 */
interface DashScopeImageResponse {
  output: {
    choices: Array<{
      finish_reason: string;
      message: {
        content: Array<{ image?: string; text?: string }>;
        role: string;
      };
    }>;
  };
  usage: {
    image_count: number;
    width: number;
    height: number;
  };
  request_id: string;
}

/**
 * 将 'WxH' 格式转换为 'W*H' 格式（DashScope 使用 * 分隔）
 */
function convertSizeFormat(size: string): string {
  return size.replace('x', '*');
}

/**
 * 验证并标准化图片尺寸
 */
function normalizeImageSize(size: string | undefined, modelId: string): string {
  const normalizedSize = size ? convertSizeFormat(size) : '1024*1024';

  // qwen-image-max / qwen-image-plus 系列只支持固定尺寸
  if (modelId.includes('qwen-image-max') || modelId.includes('qwen-image-plus')) {
    if (QWEN_IMAGE_MAX_PLUS_SIZES.includes(normalizedSize)) {
      return normalizedSize;
    }
    return '1664*928'; // 默认 16:9
  }

  // qwen-image-2.0 系列支持自由设置，只要在 512*512 ~ 2048*2048 范围内
  const parts = normalizedSize.split('*').map(Number);
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    const [w, h] = parts;
    if (w >= 512 && w <= 2048 && h >= 512 && h <= 2048) {
      return normalizedSize;
    }
  }

  return '1024*1024'; // 默认值
}

/**
 * 判断模型是否支持批量生成
 */
function getMaxBatchSize(modelId: string): number {
  // qwen-image-2.0 系列支持 1-6 张
  if (modelId.includes('qwen-image-2.0')) {
    return 6;
  }
  // qwen-image-max / qwen-image-plus 固定 1 张
  return 1;
}

/**
 * 使用 DashScope 原生 API 生成图像
 * @param model 模型配置
 * @param params 图像生成参数
 * @returns 生成的图像 URL 数组
 */
export async function generateImage(
  model: Model,
  params: ImageGenerationParams
): Promise<string[]> {
  try {
    const apiKey = model.apiKey;
    if (!apiKey) {
      throw new Error(`API密钥未设置，无法使用 ${model.name} 生成图像`);
    }

    const baseUrl = getDashScopeBaseUrl(model);
    const modelId = model.id;
    const imageSize = normalizeImageSize(params.imageSize, modelId);
    const maxBatch = getMaxBatchSize(modelId);
    const batchSize = Math.min(params.batchSize || 1, maxBatch);

    // 构建 DashScope 原生请求体
    const requestBody: DashScopeImageRequest = {
      model: modelId,
      input: {
        messages: [
          {
            role: 'user',
            content: [{ text: params.prompt }]
          }
        ]
      },
      parameters: {
        size: imageSize,
        n: batchSize,
        prompt_extend: params.promptEnhancement ?? true,
        watermark: false
      }
    };

    // 添加可选参数
    if (params.negativePrompt) {
      requestBody.parameters!.negative_prompt = params.negativePrompt;
    }

    if (params.seed !== undefined && params.seed !== null) {
      requestBody.parameters!.seed = typeof params.seed === 'string'
        ? parseInt(params.seed, 10)
        : params.seed;
    }

    // 记录 API 请求
    logApiRequest('DashScope Image Generation', 'INFO', {
      method: 'POST',
      url: `${baseUrl}${IMAGE_GENERATION_PATH}`,
      model: modelId,
      provider: 'dashscope',
      params: {
        size: imageSize,
        n: batchSize,
        prompt: params.prompt.substring(0, 50) + (params.prompt.length > 50 ? '...' : '')
      }
    });

    // 发送请求
    const response = await dashScopeRequest<DashScopeImageResponse>({
      path: IMAGE_GENERATION_PATH,
      body: requestBody,
      apiKey,
      baseUrl
    });

    // 解析响应，提取图像 URL
    const imageUrls: string[] = [];
    if (response.output?.choices) {
      for (const choice of response.output.choices) {
        if (choice.message?.content) {
          for (const item of choice.message.content) {
            if (item.image) {
              imageUrls.push(item.image);
            }
          }
        }
      }
    }

    if (imageUrls.length === 0) {
      throw new Error('DashScope 文生图 API 没有返回有效的图像 URL');
    }

    // 记录 API 响应
    logApiResponse('DashScope Image Generation', 200, {
      model: modelId,
      provider: 'dashscope',
      imageCount: imageUrls.length,
      requestId: response.request_id,
      firstImageUrl: imageUrls[0]?.substring(0, 50) + '...'
    });

    return imageUrls;
  } catch (error: any) {
    log('ERROR', `[DashScope] 图像生成失败: ${error.message || '未知错误'}`, {
      model: model.id,
      provider: 'dashscope',
      error
    });
    throw error;
  }
}

/**
 * 检查模型是否为 DashScope 文生图模型
 */
export function isDashScopeImageModel(model: Model): boolean {
  const modelId = model.id.toLowerCase();
  return (
    (model.provider === 'dashscope' || model.providerType === 'dashscope') &&
    modelId.includes('qwen-image')
  );
}
