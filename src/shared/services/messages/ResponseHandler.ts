import store from '../../store';
import { EventEmitter, EVENT_NAMES } from '../infra/EventService';
import { AssistantMessageStatus } from '../../types/newMessage';
import { newMessagesActions } from '../../store/slices/newMessagesSlice';
import type { Chunk, TextDeltaChunk, ThinkingDeltaChunk, ThinkingCompleteChunk } from '../../types/chunk';
import { ChunkType } from '../../types/chunk';

// 导入拆分后的处理器
import {
  createResponseChunkProcessor,
  ToolResponseHandler,
  ToolUseExtractionProcessor,
  KnowledgeSearchHandler,
  ResponseCompletionHandler,
  ResponseErrorHandler
} from './responseHandlers';
import { dexieStorage } from '../storage/DexieStorageService';
import { updateOneBlock, addOneBlock } from '../../store/slices/messageBlocksSlice';
import { getHighPerformanceUpdateInterval } from '../../utils/performanceSettings';
import { StreamIncrementTracker } from './responseHandlers/StreamIncrementTracker';

/**
 * 响应处理器配置类型
 */
type ResponseHandlerConfig = {
  messageId: string;
  blockId: string;
  topicId: string;
  /** 可用的 MCP 工具名称列表，用于流式工具检测 */
  toolNames?: string[];
  /** 完整的 MCP 工具列表，用于工具执行 */
  mcpTools?: import('../../types').MCPTool[];
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
 * 处理API流式/非流式响应的接收、更新和完成
 * 
 * ============= 响应处理链路 =============
 * 
 * Provider.sendChatMessage
 *   ↓ onChunk 回调
 * ResponseHandler.handleChunk
 *   ├─ THINKING_DELTA/COMPLETE → handleThinkingChunk (增量归一后委托块处理器)
 *   ├─ TEXT_DELTA/COMPLETE → handleTextWithToolExtraction
 *   │     ├─ 工具提取器检测工具标签
 *   │     ├─ 纯文本 → chunkProcessor.handleChunk (保持原始类型)
 *   │     └─ 工具检测 → 完成当前块 + 重置块状态
 *   └─ MCP_TOOL_* → toolHandler.handleChunk
 * 
 * ============= 关键设计 =============
 * - handleChunk 是 async，Provider 必须 await
 * - TEXT 类型经过 handleTextWithToolExtraction 过滤工具标签
 * - 保持原始 chunk 类型（DELTA 或 COMPLETE），不强制转换
 * - 工具检测后重置块状态，让下一轮创建新块
 */
export function createResponseHandler({ messageId, blockId, topicId, toolNames = [], mcpTools = [] }: ResponseHandlerConfig) {
  // 创建各个专门的处理器实例
  const chunkProcessor = createResponseChunkProcessor(
    messageId,
    blockId,
    store,
    dexieStorage,
    { updateOneBlock, addOneBlock, upsertBlockReference: newMessagesActions.upsertBlockReference },
    getHighPerformanceUpdateInterval() // 根据节流强度设置动态调整
  );
  const toolHandler = new ToolResponseHandler(messageId, mcpTools);
  const toolExtractionProcessor = new ToolUseExtractionProcessor(toolNames);
  const knowledgeHandler = new KnowledgeSearchHandler(messageId);
  const completionHandler = new ResponseCompletionHandler(messageId, blockId, topicId);
  const errorHandler = new ResponseErrorHandler(messageId, blockId, topicId);

  // ⭐ 归一化边界：把上游「累积全文 / 增量」统一归一成增量，块层不再自行猜测。
  // 文本与思考各持一个增量归一器（互不干扰）。
  const textTracker = new StreamIncrementTracker();
  const thinkingTracker = new StreamIncrementTracker();
  // 思考内容归一后回填的累积全文（下游 chunkProcessor 仍按累积语义消费）
  let thinkingCumulative = '';
  // 累积过滤后的文本内容（工具标签已移除）
  let accumulatedCleanText = '';
  // 🛡️ 幻觉防护：一旦检测到工具调用，丢弃后续所有非标签文本
  // 参考 Cherry Studio ToolUseExtractionMiddleware 的 hasAnyToolUse 守卫
  let hasAnyToolUse = false;

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
            // 思考内容经增量归一后委托给块处理器
            await this.handleThinkingChunk(chunk as ThinkingDeltaChunk | ThinkingCompleteChunk);
            break;

          case ChunkType.TEXT_DELTA:
          case ChunkType.TEXT_COMPLETE:
            // 文本内容通过工具提取处理器过滤（移除工具标签）
            await this.handleTextWithToolExtraction(chunk);
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
     * 处理思考(reasoning)内容：经增量归一后回填累积全文交给块处理器。
     *
     * chunkProcessor 仍按「累积」语义消费思考内容（替换写入），因此这里把上游的
     * 累积/增量统一转成累积全文，保持块层零改动。累积语义供应商行为与原来一致，
     * 增量语义（如 AI SDK reasoning-delta）在这里被归一。
     */
    async handleThinkingChunk(chunk: ThinkingDeltaChunk | ThinkingCompleteChunk): Promise<void> {
      const hasDelta = typeof (chunk as ThinkingDeltaChunk).delta === 'string';

      // 累积语义的「思考完成」：完成块携带完整思考全文，直接转发（保持原替换写入行为）
      if (chunk.type === ChunkType.THINKING_COMPLETE && !hasDelta) {
        thinkingCumulative = chunk.text ?? '';
        await chunkProcessor.handleChunk(chunk);
        thinkingTracker.reset();
        thinkingCumulative = '';
        return;
      }

      const { increment, newRound } = thinkingTracker.next({
        text: chunk.text,
        delta: (chunk as ThinkingDeltaChunk).delta,
        isFirstChunk: (chunk as ThinkingDeltaChunk).isFirstChunk
      });
      if (newRound) {
        // ⭐ 新一轮思考开始（如 思考→工具→再思考）：先把上一段思考块定稿，
        // 再清空状态，让本段思考生成独立、可折叠的新块（与文本块对称）。
        chunkProcessor.completeCurrentThinkingBlock();
        chunkProcessor.resetThinkingBlock();
        thinkingCumulative = '';
      }
      thinkingCumulative += increment;

      const normalized = { ...chunk, text: thinkingCumulative } as ThinkingDeltaChunk | ThinkingCompleteChunk;
      delete (normalized as ThinkingDeltaChunk).delta;
      await chunkProcessor.handleChunk(normalized);

      // 增量语义的思考完成：重置以便下一轮
      if (chunk.type === ChunkType.THINKING_COMPLETE) {
        thinkingTracker.reset();
        thinkingCumulative = '';
      }
    },

    /**
     * 处理文本内容并检测工具调用
     * 
     * ⭐ 参考 Cherry Studio 架构：
     * 1. 从累积内容提取增量部分
     * 2. 增量部分给工具提取器处理
     * 3. 累积过滤后的文本（工具标签已移除）
     * 4. 发送累积内容给 chunkProcessor
     * 5. 检测到工具后，停止处理后续文本（防止覆盖）
     * 
     * 重要：此处只负责块切换逻辑，不执行工具！
     */
    async handleTextWithToolExtraction(chunk: TextDeltaChunk | { type: ChunkType.TEXT_COMPLETE; text: string }): Promise<void> {
      const text = chunk.text;
      if (!text) return;

      // 保存原始 chunk 类型（DELTA 或 COMPLETE）
      const originalChunkType = chunk.type;

      // ⭐ Step 1: 归一成增量（累积/增量两种上游语义都收敛到这一处，块层不再猜测）
      const { increment: incrementalText, newRound } = textTracker.next({
        text,
        delta: (chunk as TextDeltaChunk).delta,
        isFirstChunk: (chunk as TextDeltaChunk).isFirstChunk
      });

      if (newRound) {
        // ⭐ 新一轮响应开始：先完成当前文本块（保存内容），再准备新块
        console.log(`[ResponseHandler] 检测到新一轮响应，先保存当前内容再准备新文本块`);
        const savedBlockId = chunkProcessor.completeCurrentTextBlock();
        if (savedBlockId) {
          console.log(`[ResponseHandler] 已保存上一轮文本块: ${savedBlockId}`);
        }
        // ⭐ 新一轮正式回答开始前，把上一段（思考阶段）的思考块也定稿并重置，
        // 避免下一段思考复用同一块、覆盖上一段内容。
        chunkProcessor.completeCurrentThinkingBlock();
        chunkProcessor.resetThinkingBlock();
        accumulatedCleanText = '';
        hasAnyToolUse = false;  // 🛡️ 重置幻觉守卫，新一轮可能输出最终文本答案
        chunkProcessor.resetTextBlock();
        toolExtractionProcessor.reset();  // 🔧 重置工具提取器，避免内容重复
      }
      // 如果没有新增内容，跳过处理
      if (!incrementalText) return;

      // ⭐ Step 2: 通过工具提取处理器处理增量文本
      const results = toolExtractionProcessor.processText(incrementalText);

      // ⭐ Step 3: 处理结果，累积过滤后的文本
      for (const result of results) {
        switch (result.type) {
          case 'text':
            if (result.content && !hasAnyToolUse) {
              // 🛡️ 只有在尚未检测到工具调用时才累积文本
              // 检测到工具后的文本内容（如 <tool_use_result> 幻觉）会被丢弃
              accumulatedCleanText += result.content;
              
              // ⭐ Step 4: 发送累积内容给 chunkProcessor（参考 Cherry Studio TextChunkMiddleware）
              const textChunk: Chunk = {
                type: originalChunkType,
                text: accumulatedCleanText  // 发送累积内容，不是增量
              };
              chunkProcessor.handleChunk(textChunk);
            }
            break;

          case 'tool_created':
            // 检测到工具时的块切换逻辑
            if (result.responses && result.responses.length > 0) {
              // 🛡️ 标记已检测到工具调用，后续文本将被丢弃（防止幻觉）
              hasAnyToolUse = true;
              // 只完成当前文本块，不重置状态
              const completedBlockId = chunkProcessor.completeCurrentTextBlock();
              console.log(`[ResponseHandler] 工具检测：完成文本块 ${completedBlockId}，标记 hasAnyToolUse=true`);
            }
            break;
        }
      }
    },

    /**
     * 处理字符串内容（简化版）
     * 主要用于图像生成完成后的简单状态消息
     */
    async handleStringContent(content: string): Promise<string> {
      // 检查消息是否完成
      const currentState = store.getState();
      const message = currentState.messages.entities[messageId];
      if (message?.status === AssistantMessageStatus.SUCCESS) {
        console.log(`[ResponseHandler] 消息已完成，停止处理`);
        return chunkProcessor.content;
      }

      try {
        // 直接作为文本内容处理
        const textChunk: TextDeltaChunk = {
          type: ChunkType.TEXT_DELTA,
          text: content
        };
        await this.handleChunk(textChunk);
      } catch (error) {
        console.error('[ResponseHandler] 处理字符串内容失败:', error);
        throw error;
      }

      return chunkProcessor.content;
    },

    /**
     * 完成处理
     * @param finalContent 最终文本内容
     * @param finalReasoning 最终思考内容（非流式响应时使用）
     */
    async complete(finalContent?: string, finalReasoning?: string): Promise<string> {
      return await completionHandler.complete(finalContent, chunkProcessor, finalReasoning);
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
