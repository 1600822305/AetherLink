/**
 * 参数转换中间件
 * 对标 Cherry Studio TransformCoreToSdkParamsMiddleware
 * 
 * 将通用 CompletionsParams 转换为特定 SDK 的请求参数
 */
import type { CompletionsMiddleware } from '../types';
import type { CompletionsResult } from '../schemas';

export const MIDDLEWARE_NAME = 'TransformCoreToSdkParamsMiddleware';

/**
 * 参数转换中间件
 * 使用客户端的 RequestTransformer 将参数转换为 SDK 格式
 */
export const TransformCoreToSdkParamsMiddleware: CompletionsMiddleware = (_api) => (next) =>
  async (context, params): Promise<CompletionsResult> => {
    const { apiClientInstance } = context;

    console.log('[TransformParamsMiddleware] Transforming parameters...');

    try {
      // 获取请求转换器
      const transformer = apiClientInstance.getRequestTransformer();
      
      // 转换参数 - 使用 as any 因为中间件 CompletionsParams 比 client CompletionsParams 更丰富
      const sdkPayload = transformer.transform({
        messages: params.messages,
        assistant: params.assistant,
        mcpTools: params.mcpTools,
        enableToolUse: params.enableToolUse,
        enableWebSearch: params.enableWebSearch,
      } as any);

      // 存储到上下文
      context._internal.sdkPayload = sdkPayload;

      console.log('[TransformParamsMiddleware] Parameters transformed:', {
        model: (sdkPayload as any)?.model,
        messageCount: (sdkPayload as any)?.messages?.length,
        hasTools: !!(sdkPayload as any)?.tools?.length,
      });

      // 继续执行下游中间件
      return next(context, params);
    } catch (error) {
      console.error('[TransformParamsMiddleware] Transform failed:', error);
      throw error;
    }
  };
