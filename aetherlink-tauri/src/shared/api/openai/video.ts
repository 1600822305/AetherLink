import type { Model } from '../../types';
import { log } from '../../services/LoggerService';

/**
 * 视频生成参数接口 - 符合硅基流动官方API
 */
export interface VideoGenerationParams {
  prompt: string;
  negative_prompt?: string;
  image_size?: '1280x720' | '720x1280' | '960x960'; // 支持的分辨率
  image?: string; // 图生视频时使用，需要是URL
  seed?: number;
}

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

/**
 * 硅基流动视频生成API响应接口
 */
interface VideoSubmitResponse {
  requestId: string;
}

interface VideoStatusResponse {
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'InQueue' | 'Succeed';
  reason?: string;
  results?: {
    videos?: Array<{
      url: string;
    }>;
    timings?: {
      inference: number;
    };
    seed?: number;
  };
  // 兼容其他格式
  video_url?: string;
  videos?: string[];
  error?: string;
}

/**
 * 使用硅基流动专用API生成视频
 * 注意：视频生成不使用OpenAI兼容格式，而是使用硅基流动专门的视频生成API
 * @param model 模型配置
 * @param params 视频生成参数
 * @returns 生成的视频URL
 */
export async function generateVideo(
  model: Model,
  params: VideoGenerationParams
): Promise<string> {
  try {
    log('INFO', `开始视频生成: ${model.name}`, {
      modelId: model.id,
      prompt: params.prompt.substring(0, 100),
      imageSize: params.image_size
    });

    // 获取API密钥和基础URL
    const apiKey = model.apiKey;
    const baseUrl = model.baseUrl || 'https://api.siliconflow.cn/v1';

    if (!apiKey) {
      throw new Error(`API密钥未设置，无法使用${model.name}生成视频`);
    }

    // 1. 提交视频生成请求
    const requestId = await submitVideoGeneration(baseUrl, apiKey, model.id, params);
    
    log('INFO', `视频生成请求已提交: ${requestId}`, {
      modelId: model.id,
      requestId
    });

    // 2. 轮询获取结果
    const videoUrl = await pollVideoStatusInternal(baseUrl, apiKey, requestId);

    log('INFO', `视频生成完成: ${videoUrl.substring(0, 50)}...`, {
      modelId: model.id,
      requestId
    });

    return videoUrl;

  } catch (error: any) {
    log('ERROR', `视频生成失败: ${error.message}`, {
      modelId: model.id,
      error
    });
    throw error;
  }
}

/**
 * 提交视频生成请求
 */
export async function submitVideoGeneration(
  baseUrl: string,
  apiKey: string,
  modelId: string,
  params: VideoGenerationParams
): Promise<string> {
  try {
    // 准备请求参数
    const requestBody: any = {
      model: modelId,
      prompt: params.prompt
    };

    // 添加可选参数
    if (params.negative_prompt) {
      requestBody.negative_prompt = params.negative_prompt;
    }
    if (params.image_size) {
      requestBody.image_size = params.image_size;
    }
    if (params.image) {
      requestBody.image = params.image;
    }
    if (params.seed !== undefined) {
      requestBody.seed = params.seed;
    }

    log('INFO', '发送视频生成请求', {
      url: `${baseUrl}/video/submit`,
      model: modelId,
      hasImage: !!params.image
    });

    // 发送请求到正确的硅基流动视频生成端点
    const response = await fetch(`${baseUrl}/video/submit`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`视频生成请求失败: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
    }

    const result: VideoSubmitResponse = await response.json();
    
    if (!result.requestId) {
      throw new Error('视频生成请求失败: 未返回requestId');
    }

    return result.requestId;

  } catch (error: any) {
    log('ERROR', `提交视频生成请求失败: ${error.message}`, { error });
    throw error;
  }
}

/**
 * 轮询视频生成状态
 */
export async function pollVideoStatusInternal(
  baseUrl: string,
  apiKey: string,
  requestId: string
): Promise<string> {
  const maxAttempts = 60; // 最多轮询60次
  const pollInterval = 10000; // 每10秒轮询一次
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      log('INFO', `轮询视频状态 (${attempt}/${maxAttempts})`, { requestId });

      const response = await fetch(`${baseUrl}/video/status`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ requestId })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        log('WARN', `轮询状态请求失败: ${response.status}`, { errorData });
        
        // 如果是客户端错误，直接抛出异常
        if (response.status >= 400 && response.status < 500) {
          throw new Error(`轮询状态失败: ${response.status} ${response.statusText}`);
        }
        
        // 服务器错误，继续重试
        if (attempt < maxAttempts) {
          await sleep(pollInterval);
          continue;
        } else {
          throw new Error(`轮询状态失败: ${response.status} ${response.statusText}`);
        }
      }

      const result: VideoStatusResponse = await response.json();
      
      log('INFO', `视频状态: ${result.status}`, { requestId, attempt });

      switch (result.status) {
        case 'completed':
        case 'Succeed':
          // 按照硅基流动官方文档格式获取视频URL
          const videoUrl = result.results?.videos?.[0]?.url ||
                          result.video_url ||
                          (result.videos && result.videos[0]) ||
                          null;

          if (!videoUrl) {
            log('ERROR', '视频生成完成但未返回视频URL', result);
            throw new Error('视频生成完成但未返回视频URL');
          }

          log('INFO', `视频生成完成: ${videoUrl}`, { requestId });
          return videoUrl;

        case 'failed':
          throw new Error(`视频生成失败: ${result.error || '未知错误'}`);

        case 'pending':
        case 'processing':
        case 'InQueue':
          // 继续轮询
          if (attempt < maxAttempts) {
            await sleep(pollInterval);
            break;
          } else {
            throw new Error('视频生成超时，请稍后重试');
          }

        default:
          log('WARN', `未知的视频状态: ${result.status}`, { requestId, result });
          if (attempt < maxAttempts) {
            await sleep(pollInterval);
            break;
          } else {
            throw new Error(`视频生成状态异常: ${result.status}`);
          }
      }

    } catch (error: any) {
      log('ERROR', `轮询视频状态失败 (${attempt}/${maxAttempts}): ${error.message}`, {
        requestId,
        error
      });
      
      // 如果是最后一次尝试，抛出异常
      if (attempt >= maxAttempts) {
        throw error;
      }
      
      // 否则等待后继续重试
      await sleep(pollInterval);
    }
  }

  throw new Error('视频生成超时，请稍后重试');
}

/**
 * 睡眠函数
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
