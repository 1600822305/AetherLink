/**
 * 流适配中间件
 * 对标 Cherry Studio StreamAdapterMiddleware
 * 
 * 将原始 SDK 流转换为统一的 Chunk 流
 */
import type { CompletionsMiddleware } from '../types';
import type { CompletionsResult } from '../schemas';
import { ChunkType, type Chunk } from '../../types/chunk';

export const MIDDLEWARE_NAME = 'StreamAdapterMiddleware';

/**
 * 流适配中间件
 * 读取原始 SDK 流，使用客户端的 ResponseChunkTransformer 转换为 Chunk
 */
export const StreamAdapterMiddleware: CompletionsMiddleware = (_api) => (next) =>
  async (context, params): Promise<CompletionsResult> => {
    // 先执行下游中间件获取原始流
    const result = await next(context, params);

    const { apiClientInstance, _internal } = context;
    const { onChunk } = params;
    const rawStream = _internal.rawStream;

    // 如果没有原始流，直接返回
    if (!rawStream) {
      console.warn('[StreamAdapterMiddleware] No raw stream found');
      return result;
    }

    console.log('[StreamAdapterMiddleware] Processing raw stream...');

    try {
      // 获取响应转换器
      const transformer = apiClientInstance.getResponseChunkTransformer({
        model: params.assistant?.model,
        provider: apiClientInstance.provider,
      } as any);

      // 遍历原始流并转换
      for await (const rawChunk of rawStream) {
        // 检查是否中止
        if (_internal.flowControl?.aborted) {
          console.log('[StreamAdapterMiddleware] Stream aborted');
          break;
        }

        // 转换为 Chunk 数组
        const chunks: Chunk[] = transformer.transform(rawChunk);

        // 发送每个 Chunk
        for (const chunk of chunks) {
          if (onChunk) {
            await onChunk(chunk);
          }
        }
      }

      console.log('[StreamAdapterMiddleware] Stream processing complete');
    } catch (error) {
      console.error('[StreamAdapterMiddleware] Stream processing error:', error);
      
      // 发送错误 Chunk
      if (onChunk) {
        await onChunk({
          type: ChunkType.ERROR,
          error: {
            message: error instanceof Error ? error.message : String(error),
          },
        });
      }
      
      throw error;
    }

    return result;
  };
