import store from '../../store';
import { EventEmitter, EVENT_NAMES } from '../EventService';
import { AssistantMessageStatus } from '../../types/newMessage';
import { newMessagesActions } from '../../store/slices/newMessagesSlice';
import type { Chunk, TextDeltaChunk, ThinkingDeltaChunk } from '../../types/chunk';
import { ChunkType } from '../../types/chunk';

// 导入拆分后的处理器
import {
  createResponseChunkProcessor,
  ToolResponseHandler,
  ComparisonResultHandler,
  KnowledgeSearchHandler,
  ResponseCompletionHandler,
  ResponseErrorHandler
} from './responseHandlers';
import { dexieStorage } from '../storage/DexieStorageService';
import { updateOneBlock, addOneBlock } from '../../store/slices/messageBlocksSlice';
import { getHighPerformanceUpdateInterval } from '../../utils/performanceSettings';

/**
 * 响应处理器配置类型
 */
type ResponseHandlerConfig = {
  messageId: string;
  blockId: string;
  topicId: string;
};

/**
 * 响应处理错误
 */
export class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiError';
  }
}



/**
 * 创建响应处理器
 * 处理API流式响应的接收、更新和完成
 */
export function createResponseHandler({ messageId, blockId, topicId }: ResponseHandlerConfig) {
  // 创建各个专门的处理器实例
  const chunkProcessor = createResponseChunkProcessor(
    messageId,
    blockId,
    store,
    dexieStorage,
    { updateOneBlock, addOneBlock, upsertBlockReference: newMessagesActions.upsertBlockReference },
    getHighPerformanceUpdateInterval()
  );
  const toolHandler = new ToolResponseHandler(messageId);
  const comparisonHandler = new ComparisonResultHandler(messageId);
  const knowledgeHandler = new KnowledgeSearchHandler(messageId);
  const completionHandler = new ResponseCompletionHandler(messageId, blockId, topicId);
  const errorHandler = new ResponseErrorHandler(messageId, blockId, topicId);

  // 事件监听器清理函数
  let eventCleanupFunctions: (() => void)[] = [];



  // 设置事件监听器
  const setupEventListeners = () => {
    console.log(`[ResponseHandler] 设置知识库搜索事件监听器`);

    // 监听知识库搜索完成事件
    const knowledgeSearchCleanup = EventEmitter.on(EVENT_NAMES.KNOWLEDGE_SEARCH_COMPLETED, async (data: any) => {
      if (data.messageId === messageId) {
        console.log(`[ResponseHandler] 处理知识库搜索完成事件，结果数量: ${data.searchResults?.length || 0}`);
        await knowledgeHandler.handleKnowledgeSearchComplete(data);
      }
    });

    eventCleanupFunctions = [knowledgeSearchCleanup];

    return () => {
      eventCleanupFunctions.forEach(cleanup => cleanup());
    };
  };

  const responseHandlerInstance = {
    /**
     * 处理标准化的 Chunk 事件 - 主要处理方法
     * @param chunk Chunk 事件对象
     */
    async handleChunk(chunk: Chunk): Promise<void> {
      try {
        switch (chunk.type) {
          case ChunkType.THINKING_DELTA:
          case ChunkType.THINKING_COMPLETE:
          case ChunkType.TEXT_DELTA:
          case ChunkType.TEXT_COMPLETE:
            // 委托给块处理器
            await chunkProcessor.handleChunk(chunk);
            break;

          case ChunkType.MCP_TOOL_IN_PROGRESS:
          case ChunkType.MCP_TOOL_COMPLETE:
            // 委托给工具处理器
            await toolHandler.handleChunk(chunk);
            break;

          default:
            console.log(`[ResponseHandler] 忽略未处理的 chunk 类型: ${chunk.type}`);
            break;
        }
      } catch (error) {
        console.error(`[ResponseHandler] 处理 chunk 事件失败:`, error);
        throw error;
      }
    },

    /**
     * 处理字符串内容（向后兼容）
     */
    async handleStringContent(content: string, reasoning?: string): Promise<string> {
      // 检查消息是否完成
      const currentState = store.getState();
      const message = currentState.messages.entities[messageId];
      if (message?.status === AssistantMessageStatus.SUCCESS) {
        console.log(`[ResponseHandler] 消息已完成，停止处理`);
        return chunkProcessor.content;
      }

      // 检查对比结果
      if (comparisonHandler.isComparisonResult(content, reasoning)) {
        console.log(`[ResponseHandler] 检测到对比结果`);
        comparisonHandler.handleComparisonResult(reasoning!);
        return chunkProcessor.content;
      }

      try {
        // 处理推理内容
        if (reasoning?.trim()) {
          const thinkingChunk: ThinkingDeltaChunk = {
            type: ChunkType.THINKING_DELTA,
            text: reasoning,
            thinking_millsec: 0
          };
          await this.handleChunk(thinkingChunk);
        } else {
          // 尝试解析JSON格式
          let textContent = content;
          try {
            const parsed = JSON.parse(content);
            if (parsed?.reasoning) {
              const thinkingChunk: ThinkingDeltaChunk = {
                type: ChunkType.THINKING_DELTA,
                text: parsed.reasoning,
                thinking_millsec: parsed.reasoningTime || 0
              };
              await this.handleChunk(thinkingChunk);
              return chunkProcessor.content;
            }
            textContent = parsed?.text || content;
          } catch {
            // 不是JSON，按普通文本处理
          }

          // 处理文本内容
          const textChunk: TextDeltaChunk = {
            type: ChunkType.TEXT_DELTA,
            text: textContent
          };
          await this.handleChunk(textChunk);
        }
      } catch (error) {
        console.error('[ResponseHandler] 处理字符串内容失败:', error);
        throw error;
      }

      return chunkProcessor.content;
    },

    /**
     * 完成处理
     */
    async complete(finalContent?: string): Promise<string> {
      return await completionHandler.complete(finalContent, chunkProcessor);
    },

    /**
     * 中断完成
     */
    async completeWithInterruption(): Promise<string> {
      return await completionHandler.completeWithInterruption(chunkProcessor);
    },

    /**
     * 失败处理
     */
    async fail(error: Error): Promise<void> {
      return await errorHandler.fail(error);
    },

    /**
     * 获取状态
     */
    getStatus() {
      return {
        textContent: chunkProcessor.content,
        thinkingContent: chunkProcessor.thinking,
        textBlockId: chunkProcessor.textBlockId,
        thinkingBlockId: chunkProcessor.thinkingId
      };
    },

    /**
     * 清理资源
     */
    cleanup: () => {
      eventCleanupFunctions.forEach(cleanup => cleanup());
    }
  };

  // 设置事件监听器
  setupEventListeners();

  return responseHandlerInstance;
}

export default createResponseHandler;

/**
 * 设置响应状态 - 向后兼容
 */
export const setResponseState = ({ topicId, status, loading }: { topicId: string; status: string; loading: boolean }) => {
  const streaming = status === 'streaming';

  store.dispatch(newMessagesActions.setTopicStreaming({ topicId, streaming }));
  store.dispatch(newMessagesActions.setTopicLoading({ topicId, loading }));

  console.log(`[ResponseHandler] 设置响应状态: topicId=${topicId}, status=${status}, loading=${loading}`);
};
