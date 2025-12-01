/**
 * 思考 Chunk 中间件
 * 对标 Cherry Studio ThinkChunkMiddleware
 * 
 * 处理思考/推理内容的增量和完成事件
 */
import type { CompletionsMiddleware } from '../types';
import type { CompletionsResult } from '../schemas';
import { ChunkType, type Chunk } from '../../types/chunk';

export const MIDDLEWARE_NAME = 'ThinkChunkMiddleware';

/**
 * 思考 Chunk 中间件
 * 处理 THINKING_START, THINKING_DELTA, THINKING_COMPLETE 事件
 */
export const ThinkChunkMiddleware: CompletionsMiddleware = (_api) => (next) =>
  async (context, params): Promise<CompletionsResult> => {
    const { onChunk } = params;
    const accumulated = context._internal.accumulated!;

    let hasThinkingStarted = false;
    let thinkingStartTime = 0;

    // 包装 onChunk 处理思考事件
    const wrappedOnChunk = onChunk
      ? async (chunk: Chunk) => {
          switch (chunk.type) {
            case ChunkType.THINKING_START:
              hasThinkingStarted = true;
              thinkingStartTime = Date.now();
              accumulated.thinking = '';
              break;

            case ChunkType.THINKING_DELTA:
              if ('text' in chunk && chunk.text) {
                // 如果没有收到 THINKING_START，先发送
                if (!hasThinkingStarted) {
                  hasThinkingStarted = true;
                  thinkingStartTime = Date.now();
                  accumulated.thinking = '';
                  await onChunk({ type: ChunkType.THINKING_START });
                }
                // 累积思考内容
                accumulated.thinking = (accumulated.thinking || '') + chunk.text;
              }
              break;

            case ChunkType.THINKING_COMPLETE:
              if ('text' in chunk && chunk.text) {
                // 如果 complete 包含完整内容且当前累积为空，使用它
                if (!accumulated.thinking) {
                  accumulated.thinking = chunk.text;
                }
              }
              
              // 计算思考时间
              if (thinkingStartTime) {
                const thinkingDuration = Date.now() - thinkingStartTime;
                console.log(`[ThinkChunkMiddleware] Thinking duration: ${thinkingDuration}ms`);
              }
              break;
          }

          // 转发原始 chunk
          await onChunk(chunk);
        }
      : undefined;

    // 执行下游中间件
    return next(context, { ...params, onChunk: wrappedOnChunk });
  };
