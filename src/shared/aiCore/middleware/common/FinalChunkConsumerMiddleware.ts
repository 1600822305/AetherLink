/**
 * 最终 Chunk 消费者中间件
 * 对标 Cherry Studio FinalChunkConsumerMiddleware
 */
import type { CompletionsMiddleware, AccumulatedData } from '../types';
import type { CompletionsResult } from '../schemas';
import { ChunkType, type Chunk } from '../../types/chunk';

export const MIDDLEWARE_NAME = 'FinalChunkConsumerMiddleware';

/**
 * 最终 Chunk 消费者中间件
 * 消费 Chunk 流，累积结果，并通知上层
 */
export const FinalChunkConsumerMiddleware: CompletionsMiddleware = (_api) => (next) =>
  async (context, params): Promise<CompletionsResult> => {
    const { onChunk } = params;
    const accumulated = context._internal.accumulated!;

    // 包装 onChunk 以累积数据
    const wrappedOnChunk = onChunk
      ? async (chunk: Chunk) => {
          // 累积数据
          processChunkForAccumulation(chunk, accumulated);
          // 转发给原始回调
          await onChunk(chunk);
        }
      : undefined;

    // 执行下游中间件
    const result = await next(context, { ...params, onChunk: wrappedOnChunk });

    // 标记完成
    if (context._internal.flowControl) {
      context._internal.flowControl.completed = true;
    }

    // 返回增强的结果
    return {
      ...result,
      getText: () => accumulated.text || result.getText?.() || '',
      getReasoning: () => accumulated.thinking || result.getReasoning?.(),
      usage: accumulated.usage || result.usage,
      metrics: accumulated.metrics ? {
        completion_tokens: accumulated.usage?.completion_tokens,
        time_first_token_millsec: accumulated.metrics.time_first_token_ms,
        time_completion_millsec: accumulated.metrics.time_completion_ms,
      } : result.metrics,
    };
  };

/**
 * 处理 Chunk 并累积数据
 */
function processChunkForAccumulation(
  chunk: Chunk,
  accumulated: AccumulatedData
): void {
  switch (chunk.type) {
    case ChunkType.TEXT_DELTA:
      if ('text' in chunk && chunk.text) {
        accumulated.text += chunk.text;
      }
      break;

    case ChunkType.TEXT_COMPLETE:
      // 文本完成，可能包含完整文本
      if ('text' in chunk && chunk.text) {
        // 如果是完整文本，替换累积的
        // accumulated.text = chunk.text;
      }
      break;

    case ChunkType.THINKING_DELTA:
      if ('text' in chunk && chunk.text) {
        accumulated.thinking = (accumulated.thinking || '') + chunk.text;
      }
      break;

    case ChunkType.THINKING_COMPLETE:
      // 思考完成
      break;

    case ChunkType.LLM_RESPONSE_COMPLETE:
      // 响应完成，提取 usage 和 metrics
      if ('response' in chunk) {
        const response = (chunk as any).response;
        if (response?.usage) {
          accumulated.usage = response.usage;
        }
        if (response?.metrics) {
          accumulated.metrics = {
            time_first_token_ms: response.metrics.time_first_token_millsec,
            time_completion_ms: response.metrics.time_completion_millsec,
          };
        }
      }
      break;

    case ChunkType.BLOCK_COMPLETE:
      // Block 完成
      if ('response' in chunk) {
        const response = (chunk as any).response;
        if (response?.usage) {
          accumulated.usage = response.usage;
        }
      }
      break;

    case ChunkType.MCP_TOOL_IN_PROGRESS:
    case ChunkType.MCP_TOOL_COMPLETE:
      // 工具调用由 McpToolChunkMiddleware 处理
      break;

    default:
      // 其他类型暂不处理
      break;
  }
}

