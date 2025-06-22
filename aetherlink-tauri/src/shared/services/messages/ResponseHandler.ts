import store from '../../store';
import { EventEmitter, EVENT_NAMES } from '../EventService';
import { AssistantMessageStatus } from '../../types/newMessage';
import { newMessagesActions } from '../../store/slices/newMessagesSlice';
import type { Chunk } from '../../types/chunk';
import { ChunkType } from '../../types/chunk';

// 导入拆分后的处理器
import {
  ResponseChunkProcessor,
  ToolResponseHandler,
  ComparisonResultHandler,
  KnowledgeSearchHandler,
  ResponseCompletionHandler,
  ResponseErrorHandler
} from './responseHandlers';

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
  const chunkProcessor = new ResponseChunkProcessor(messageId, blockId);
  const toolHandler = new ToolResponseHandler(messageId);
  const comparisonHandler = new ComparisonResultHandler(messageId);
  const knowledgeHandler = new KnowledgeSearchHandler(messageId);
  const completionHandler = new ResponseCompletionHandler(messageId, blockId, topicId);
  const errorHandler = new ResponseErrorHandler(messageId, blockId, topicId);

  // 事件监听器清理函数
  let eventCleanupFunctions: (() => void)[] = [];

  // 实现回调系统，委托给块处理器
  const callbacks = {
    onTextChunk: (text: string) => {
      chunkProcessor.onTextChunk(text);
    },

    onThinkingChunk: (text: string, thinking_millsec?: number) => {
      chunkProcessor.onThinkingChunk(text, thinking_millsec);
    }
  };

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
     * 处理基于 Chunk 事件
     * @param chunk Chunk 事件对象
     */
    async handleChunkEvent(chunk: Chunk) {
      try {
        switch (chunk.type) {
          case ChunkType.THINKING_DELTA:
          case ChunkType.THINKING_COMPLETE:
          case ChunkType.TEXT_DELTA:
          case ChunkType.TEXT_COMPLETE:
            // 委托给块处理器
            await chunkProcessor.handleChunkEvent(chunk);
            break;

          case ChunkType.MCP_TOOL_IN_PROGRESS:
          case ChunkType.MCP_TOOL_COMPLETE:
            // 委托给工具处理器
            await toolHandler.handleChunkEvent(chunk);
            break;

          default:
            console.log(`[ResponseHandler] 忽略未处理的 chunk 类型: ${chunk.type}`);
            break;
        }
      } catch (error) {
        console.error(`[ResponseHandler] 处理 chunk 事件失败:`, error);
      }
    },

    /**
     * 处理流式响应片段（兼容旧接口）
     * @param chunk 响应片段
     * @param reasoning 推理内容（可选）
     */
    handleChunk(chunk: string, reasoning?: string) {
      // 检查是否被中断 - 如果被中断则停止处理
      const currentState = store.getState();
      const message = currentState.messages.entities[messageId];
      if (message?.status === AssistantMessageStatus.SUCCESS) {
        console.log(`[ResponseHandler] 消息已完成，停止处理新的块`);
        return chunkProcessor.content;
      }

      // 检查是否是对比结果
      if (comparisonHandler.isComparisonResult(chunk, reasoning)) {
        console.log(`[ResponseHandler] 检测到对比结果`);
        comparisonHandler.handleComparisonResult(reasoning!);
        return;
      }

      // 检查是否有推理内容
      let isThinking = false;
      let thinkingContent = '';
      let thinkingTime = 0;

      // 优先使用传入的推理内容
      if (reasoning !== undefined && reasoning.trim()) {
        isThinking = true;
        thinkingContent = reasoning;
        thinkingTime = 0;
      } else {
        // 尝试解析JSON，检查是否包含思考内容
        try {
          const parsedChunk = JSON.parse(chunk);
          if (parsedChunk && parsedChunk.reasoning) {
            isThinking = true;
            thinkingContent = parsedChunk.reasoning;
            thinkingTime = parsedChunk.reasoningTime || 0;
          }
        } catch (e) {
          // 不是JSON，按普通文本处理
        }
      }

      // 委托给回调处理
      if (isThinking) {
        callbacks.onThinkingChunk(thinkingContent, thinkingTime);
      } else {
        callbacks.onTextChunk(chunk);
      }

      // 返回当前累积的内容
      return chunkProcessor.content;
    },

    /**
     * 响应完成处理
     * @param finalContent 最终内容
     * @returns 累计的响应内容
     */
    async complete(finalContent?: string) {
      return await completionHandler.complete(finalContent, chunkProcessor);
    },

    /**
     * 响应被中断时的完成处理
     * @returns 累计的响应内容
     */
    async completeWithInterruption() {
      return await completionHandler.completeWithInterruption(chunkProcessor);
    },

    /**
     * 响应失败处理
     * @param error 错误对象
     */
    async fail(error: Error) {
      return await errorHandler.fail(error);
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
 * 创建响应状态action creator - 向后兼容
 */
export const setResponseState = ({ topicId, status, loading }: { topicId: string; status: string; loading: boolean }) => {
  // 设置流式响应状态
  const streaming = status === 'streaming';

  // 使用新的action creator
  store.dispatch(newMessagesActions.setTopicStreaming({
    topicId,
    streaming
  }));

  store.dispatch(newMessagesActions.setTopicLoading({
    topicId,
    loading
  }));

  console.log(`[ResponseHandler] 设置响应状态: topicId=${topicId}, status=${status}, loading=${loading}`);
};
