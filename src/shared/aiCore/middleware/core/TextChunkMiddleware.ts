/**
 * 文本 Chunk 中间件
 * 对标 Cherry Studio TextChunkMiddleware
 * 
 * 处理文本增量和完成事件
 */
import type { CompletionsMiddleware } from '../types';
import type { CompletionsResult } from '../schemas';
import { ChunkType, type Chunk } from '../../types/chunk';

export const MIDDLEWARE_NAME = 'TextChunkMiddleware';

/**
 * 文本 Chunk 中间件
 * 处理文本相关的 Chunk 事件
 */
export const TextChunkMiddleware: CompletionsMiddleware = (_api) => (next) =>
  async (context, params): Promise<CompletionsResult> => {
    const { onChunk } = params;
    const accumulated = context._internal.accumulated!;

    let hasTextStarted = false;

    // 包装 onChunk 处理文本事件
    const wrappedOnChunk = onChunk
      ? async (chunk: Chunk) => {
          switch (chunk.type) {
            case ChunkType.TEXT_START:
              hasTextStarted = true;
              break;

            case ChunkType.TEXT_DELTA:
              if ('text' in chunk && chunk.text) {
                // 如果没有收到 TEXT_START，先发送
                if (!hasTextStarted) {
                  hasTextStarted = true;
                  await onChunk({ type: ChunkType.TEXT_START });
                }
                // 累积文本
                accumulated.text += chunk.text;
              }
              break;

            case ChunkType.TEXT_COMPLETE:
              if ('text' in chunk && chunk.text) {
                // 如果 complete 包含完整文本且当前累积为空，使用它
                if (!accumulated.text) {
                  accumulated.text = chunk.text;
                }
              }
              break;
          }

          // 转发原始 chunk
          await onChunk(chunk);
        }
      : undefined;

    // 执行下游中间件
    const result = await next(context, { ...params, onChunk: wrappedOnChunk });

    // 确保有文本完成事件
    if (hasTextStarted && accumulated.text && onChunk) {
      // 文本完成事件在 FinalChunkConsumer 中处理
    }

    return result;
  };
