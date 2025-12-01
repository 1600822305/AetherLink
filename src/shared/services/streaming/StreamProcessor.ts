/**
 * 流处理器
 * 将 Chunk 分发到对应的回调处理
 * 
 * 参考 Cherry Studio StreamProcessingService 设计
 */

import type { Chunk } from '../../types/chunk';
import { ChunkType } from '../../types/chunk';
import { AssistantMessageStatus } from '../../types/newMessage';
import type { StreamProcessorCallbacks } from './callbacks/types';

/**
 * 创建流处理器
 * 返回一个函数，用于处理流式 Chunk 并分发到对应回调
 * 
 * @param callbacks 回调函数集合
 * @returns Chunk 处理函数
 */
export function createStreamProcessor(callbacks: StreamProcessorCallbacks) {
  return async (chunk: Chunk): Promise<void> => {
    try {
      switch (chunk.type) {
        // ===== 生命周期 =====
        case ChunkType.LLM_RESPONSE_CREATED:
          await callbacks.onLLMResponseCreated?.();
          break;

        case ChunkType.LLM_RESPONSE_COMPLETE:
          await callbacks.onLLMResponseComplete?.((chunk as any).response);
          break;

        case ChunkType.BLOCK_CREATED:
          await callbacks.onBlockCreated?.();
          break;

        case ChunkType.BLOCK_COMPLETE:
          await callbacks.onBlockComplete?.((chunk as any).response);
          await callbacks.onComplete?.(AssistantMessageStatus.SUCCESS, (chunk as any).response);
          break;

        // ===== 文本 =====
        case ChunkType.TEXT_START:
          await callbacks.onTextStart?.();
          break;

        case ChunkType.TEXT_DELTA:
          await callbacks.onTextChunk?.((chunk as any).text);
          break;

        case ChunkType.TEXT_COMPLETE:
          await callbacks.onTextComplete?.((chunk as any).text);
          break;

        // ===== 思考链 =====
        case ChunkType.THINKING_START:
          await callbacks.onThinkingStart?.();
          break;

        case ChunkType.THINKING_DELTA:
          await callbacks.onThinkingChunk?.(
            (chunk as any).text, 
            (chunk as any).thinking_millsec
          );
          break;

        case ChunkType.THINKING_COMPLETE:
          await callbacks.onThinkingComplete?.(
            (chunk as any).text, 
            (chunk as any).thinking_millsec
          );
          break;

        // ===== 工具调用 =====
        case ChunkType.MCP_TOOL_PENDING:
          const pendingResponses = (chunk as any).responses || [];
          for (const resp of pendingResponses) {
            await callbacks.onToolCallPending?.(resp);
          }
          break;

        case ChunkType.MCP_TOOL_IN_PROGRESS:
          const inProgressResponses = (chunk as any).responses || [];
          for (const resp of inProgressResponses) {
            await callbacks.onToolCallInProgress?.(resp);
          }
          break;

        case ChunkType.MCP_TOOL_COMPLETE:
          const completeResponses = (chunk as any).responses || [];
          for (const resp of completeResponses) {
            await callbacks.onToolCallComplete?.(resp);
          }
          break;

        // ===== 图像 =====
        case ChunkType.IMAGE_CREATED:
          await callbacks.onImageCreated?.();
          break;

        case ChunkType.IMAGE_DELTA:
          await callbacks.onImageDelta?.((chunk as any).image);
          break;

        case ChunkType.IMAGE_COMPLETE:
          await callbacks.onImageComplete?.((chunk as any).image);
          break;

        // ===== 知识库搜索 =====
        case ChunkType.KNOWLEDGE_SEARCH_IN_PROGRESS:
          await callbacks.onKnowledgeSearchInProgress?.((chunk as any).query);
          break;

        case ChunkType.KNOWLEDGE_SEARCH_COMPLETE:
          await callbacks.onKnowledgeSearchComplete?.((chunk as any).references);
          break;

        // ===== 引用 =====
        case ChunkType.CITATION_DELTA:
          await callbacks.onCitationDelta?.((chunk as any).citations);
          break;

        case ChunkType.CITATION_COMPLETE:
          await callbacks.onCitationComplete?.((chunk as any).citations);
          break;

        // ===== 原始数据 =====
        case ChunkType.RAW:
          await callbacks.onRawData?.((chunk as any).content, (chunk as any).metadata);
          break;

        // ===== 视频/图像搜索 =====
        case ChunkType.VIDEO_SEARCHED:
          await callbacks.onVideoSearched?.((chunk as any).videos);
          break;

        case ChunkType.IMAGE_SEARCHED:
          await callbacks.onImageSearched?.((chunk as any).images);
          break;

        // ===== 错误 =====
        case ChunkType.ERROR:
          await callbacks.onError?.((chunk as any).error);
          break;

        default:
          // 未知类型，记录日志但不抛出错误
          console.log(`[StreamProcessor] 未处理的 Chunk 类型: ${chunk.type}`);
      }
    } catch (error) {
      console.error('[StreamProcessor] 处理 Chunk 错误:', error);
      await callbacks.onError?.(error);
    }
  };
}

/**
 * 创建简化的流处理器（仅处理文本和思考）
 */
export function createMinimalStreamProcessor(callbacks: Pick<
  StreamProcessorCallbacks, 
  'onTextStart' | 'onTextChunk' | 'onTextComplete' | 
  'onThinkingStart' | 'onThinkingChunk' | 'onThinkingComplete' |
  'onError' | 'onComplete'
>) {
  return createStreamProcessor(callbacks as StreamProcessorCallbacks);
}
