import { log } from '../../services/LoggerService';

/**
 * Google Veo 2 视频生成参数
 */
export interface GoogleVeoParams {
  prompt: string;
  image?: string; // base64编码的图片或图片URL
  negativePrompt?: string;
  aspectRatio?: '16:9' | '9:16';
  personGeneration?: 'dont_allow' | 'allow_adult' | 'allow_all';
  // numberOfVideos 参数不被支持，Google Veo 每次只生成一个视频
  durationSeconds?: number; // 5-8秒
  enhancePrompt?: boolean;
}

/**
 * Google Veo 2 生成结果
 */
export interface GoogleVeoResult {
  success: boolean;
  url?: string;
  error?: string;
}

/**
 * Google API 操作响应
 */
interface GoogleOperation {
  name: string;
  done: boolean;
  response?: {
    '@type'?: string;
    generateVideoResponse?: {
      generatedSamples?: Array<{
        video?: {
          uri: string;
        };
      }>;
    };
  };
  error?: {
    message: string;
  };
}

/**
 * 生成视频 - Google Veo 2
 */
export async function generateVideoWithVeo(
  apiKey: string,
  params: GoogleVeoParams
): Promise<GoogleVeoResult> {
  try {
    log('INFO', '[Google Veo] 开始视频生成', {
      prompt: params.prompt.substring(0, 50),
      aspectRatio: params.aspectRatio,
      durationSeconds: params.durationSeconds
    });

    // 1. 提交视频生成请求
    const operationName = await submitVeoGeneration(apiKey, params);
    
    // 2. 轮询获取结果
    const videoUrl = await pollVeoOperation(apiKey, operationName);
    
    log('INFO', '[Google Veo] 视频生成成功', { url: videoUrl.substring(0, 50) });
    
    return {
      success: true,
      url: videoUrl
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log('ERROR', '[Google Veo] 视频生成失败', { error: errorMessage });
    
    return {
      success: false,
      error: errorMessage
    };
  }
}

/**
 * 提交Google Veo视频生成请求
 */
export async function submitVeoGeneration(
  apiKey: string,
  params: GoogleVeoParams
): Promise<string> {
  const baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
  
  // 构建请求体
  const requestBody: any = {
    instances: [{
      prompt: params.prompt
    }],
    parameters: {
      aspectRatio: params.aspectRatio || '16:9',
      personGeneration: params.personGeneration || 'dont_allow'
    }
  };

  // 添加可选参数
  if (params.image) {
    requestBody.instances[0].image = {
      imageBytes: params.image,
      mimeType: 'image/png'
    };
  }

  if (params.negativePrompt) {
    requestBody.parameters.negativePrompt = params.negativePrompt;
  }

  if (params.durationSeconds) {
    requestBody.parameters.durationSeconds = params.durationSeconds;
  }

  if (params.enhancePrompt !== undefined) {
    requestBody.parameters.enhancePrompt = params.enhancePrompt;
  }

  log('INFO', '[Google Veo] 提交视频生成请求', { 
    prompt: params.prompt.substring(0, 50),
    hasImage: !!params.image
  });

  const response = await fetch(`${baseUrl}/models/veo-2.0-generate-001:predictLongRunning?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Veo API请求失败: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const result = await response.json();
  
  if (!result.name) {
    throw new Error('Google Veo API未返回操作名称');
  }

  log('INFO', '[Google Veo] 获得操作名称', { operationName: result.name });
  
  return result.name;
}

/**
 * 轮询Google Veo操作状态
 */
export async function pollVeoOperation(
  apiKey: string,
  operationName: string
): Promise<string> {
  const baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
  const maxAttempts = 60; // 最多轮询60次
  const pollInterval = 10000; // 每10秒轮询一次
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      log('INFO', `[Google Veo] 轮询操作状态 (${attempt}/${maxAttempts})`, { operationName });

      const response = await fetch(`${baseUrl}/${operationName}?key=${apiKey}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status >= 400 && response.status < 500) {
          throw new Error(`轮询状态失败: ${response.status} ${response.statusText}`);
        }
        // 对于5xx错误，继续重试
        if (attempt < maxAttempts) {
          await sleep(pollInterval);
          continue;
        } else {
          throw new Error(`轮询状态失败: ${response.status} ${response.statusText}`);
        }
      }

      const operation: GoogleOperation = await response.json();
      log('INFO', `[Google Veo] 操作状态`, { 
        operationName, 
        done: operation.done, 
        attempt 
      });

      if (operation.done) {
        if (operation.error) {
          throw new Error(`Google Veo生成失败: ${operation.error.message}`);
        }

        const generatedSamples = operation.response?.generateVideoResponse?.generatedSamples;
        if (!generatedSamples || generatedSamples.length === 0 || !generatedSamples[0]?.video?.uri) {
          throw new Error('Google Veo生成完成但未返回视频URL');
        }

        // 取第一个视频（Google Veo可能返回多个视频，我们只使用第一个）
        let videoUrl = generatedSamples[0].video.uri;

        // Google API返回的URL需要添加API密钥才能访问
        if (!videoUrl.includes('key=')) {
          const separator = videoUrl.includes('?') ? '&' : '?';
          videoUrl = `${videoUrl}${separator}key=${apiKey}`;
        }

        log('INFO', '[Google Veo] 视频生成完成', {
          videoUrl: videoUrl.substring(0, 50),
          totalVideos: generatedSamples.length
        });

        return videoUrl;
      }

      // 操作未完成，继续等待
      if (attempt < maxAttempts) {
        await sleep(pollInterval);
      } else {
        throw new Error('Google Veo视频生成超时，请稍后重试');
      }

    } catch (error: any) {
      if (attempt >= maxAttempts) {
        throw error;
      }
      
      log('WARN', `[Google Veo] 轮询出错，继续重试`, { 
        error: error.message, 
        attempt, 
        operationName 
      });
      
      await sleep(pollInterval);
    }
  }

  throw new Error('Google Veo视频生成超时，请稍后重试');
}

/**
 * 睡眠函数
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
