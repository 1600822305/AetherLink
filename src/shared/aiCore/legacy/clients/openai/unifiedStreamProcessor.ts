/**
 * 统一流式响应处理器
 * 合并 streamProcessor.ts 和 stream.ts 的功能，去除重复代码
 */
import OpenAI from 'openai';
import {
  asyncGeneratorToReadableStream,
  readableStreamAsyncIterable,
  openAIChunkToTextDelta
} from '../../../../utils/streamUtils';
import type { OpenAIStreamChunk } from '../../../../utils/streamUtils';
import { EventEmitter, EVENT_NAMES } from '../../../../services/EventEmitter';
import { getAppropriateTag } from '../../../../config/reasoningTags';
import { extractReasoningMiddleware } from '../../../../middlewares/extractReasoningMiddleware';
import { createAbortController, isAbortError } from '../../../../utils/abortController';
import { ChunkType } from '../../../../types/chunk';
import { hasToolUseTags } from '../../../../utils/mcpToolParser';
import type { Model } from '../../../../types';
import type { Chunk } from '../../../../types/chunk';

/**
 * 统一流处理选项
 */
export interface UnifiedStreamOptions {
  // 基础选项
  model: Model;
  onChunk?: (chunk: Chunk) => void;
  abortSignal?: AbortSignal;

  // 推理相关选项
  enableReasoning?: boolean;
  messageId?: string;
  blockId?: string;
  thinkingBlockId?: string;
  topicId?: string;

  // 工具相关
  enableTools?: boolean;
  mcpTools?: any[];
}

/**
 * 流处理结果
 */
export interface StreamProcessingResult {
  content: string;
  reasoning?: string;
  reasoningTime?: number;
  hasToolCalls?: boolean;
  /** 原生 Function Calling 工具调用（流式积累后的完整数据） */
  nativeToolCalls?: any[];
}

/**
 * 流处理状态
 */
interface StreamProcessingState {
  content: string;
  reasoning: string;
  reasoningStartTime: number;
  toolCalls: any[]; // 用于积累流式工具调用
  emittedToolIndices: Set<number>; // 记录已发送事件的工具索引
}

/**
 * 统一流式响应处理器类
 * 整合了原有两个处理器的所有功能
 */
export class UnifiedStreamProcessor {
  private options: UnifiedStreamOptions;
  private state: StreamProcessingState = {
    content: '',
    reasoning: '',
    reasoningStartTime: 0,
    toolCalls: [],
    emittedToolIndices: new Set()
  };

  // AbortController管理
  private abortController?: AbortController;
  private cleanup?: () => void;

  constructor(options: UnifiedStreamOptions) {
    this.options = options;

    // 设置AbortController
    if (options.messageId) {
      const { abortController, cleanup } = createAbortController(options.messageId, true);
      this.abortController = abortController;
      this.cleanup = cleanup;
    }
  }

  /**
   * 检查是否已中断
   */
  private isAborted(): boolean {
    return this.options.abortSignal?.aborted || this.abortController?.signal.aborted || false;
  }

  /**
   * 处理流式响应 - 统一入口
   */
  async processStream(stream: AsyncIterable<any>): Promise<StreamProcessingResult> {
    try {
      return await this.processAdvancedStream(stream);
    } catch (error) {
      if (isAbortError(error)) {
        console.log('[UnifiedStreamProcessor] 流式响应被用户中断');
        return {
          content: this.state.content,
          reasoning: this.state.reasoning || undefined,
          reasoningTime: this.state.reasoningStartTime > 0 ? (Date.now() - this.state.reasoningStartTime) : undefined
        };
      }
      console.error('[UnifiedStreamProcessor] 处理流式响应失败:', error);
      throw error;
    } finally {
      if (this.cleanup) {
        this.cleanup();
      }
    }
  }

  /**
   * 流处理模式 - 使用中间件和完整功能
   */
  private async processAdvancedStream(stream: AsyncIterable<any>): Promise<StreamProcessingResult> {
    console.log(`[UnifiedStreamProcessor] 处理流式响应，模型: ${this.options.model.id}`);

    // 检查中断
    if (this.isAborted()) {
      throw new DOMException('Operation aborted', 'AbortError');
    }

    // 获取推理标签
    const reasoningTag = getAppropriateTag(this.options.model);

    // 使用中间件处理 - 显式指定泛型类型以支持 tool_calls
    const { stream: processedStream } = await extractReasoningMiddleware<OpenAIStreamChunk>({
      openingTag: reasoningTag.openingTag,
      closingTag: reasoningTag.closingTag,
      separator: reasoningTag.separator,
      enableReasoning: this.options.enableReasoning ?? true
    }).wrapStream({
      doStream: async () => ({
        stream: asyncGeneratorToReadableStream(openAIChunkToTextDelta(stream))
      })
    });

    // 处理流
    for await (const chunk of readableStreamAsyncIterable(processedStream)) {
      if (this.isAborted()) {
        break;
      }
      await this.handleAdvancedChunk(chunk);
    }

    return this.buildResult();
  }



  /**
   * 处理高级模式的chunk
   */
  private async handleAdvancedChunk(chunk: any): Promise<void> {
    if (chunk.type === 'text-delta') {
      // 注意：DeepSeek 的重复检测已经在 streamUtils.ts 的 openAIChunkToTextDelta 中处理
      // 这里接收到的 textDelta 已经是经过去重的增量内容

      // 检查是否是推理阶段结束（第一次收到内容）
      const isFirstContent = this.state.content === '' && this.state.reasoning !== '';

      this.state.content += chunk.textDelta;

      // 如果是推理阶段结束，先发送推理完成事件
      if (isFirstContent && this.options.onChunk && this.state.reasoning) {
        console.log('[UnifiedStreamProcessor] 推理阶段结束，发送 THINKING_COMPLETE');
        this.options.onChunk({
          type: ChunkType.THINKING_COMPLETE,
          text: this.state.reasoning,
          thinking_millsec: this.state.reasoningStartTime ? (Date.now() - this.state.reasoningStartTime) : 0,
          blockId: this.options.thinkingBlockId
        } as Chunk);
      }

      // 发送文本增量事件
      if (this.options.onChunk) {
        this.options.onChunk({
          type: ChunkType.TEXT_DELTA,
          text: chunk.textDelta,
          messageId: this.options.messageId,
          blockId: this.options.blockId,
          topicId: this.options.topicId
        });
      }
    } else if (chunk.type === 'reasoning') {
      if (!this.state.reasoningStartTime) {
        this.state.reasoningStartTime = Date.now();
      }

      this.state.reasoning += chunk.textDelta;

if (this.options.onChunk) {
        this.options.onChunk({
          type: ChunkType.THINKING_DELTA,
          text: chunk.textDelta,
          blockId: this.options.thinkingBlockId
        } as Chunk);
      }
    } else if (chunk.type === 'tool_calls') {
      // 处理原生 Function Calling 工具调用
      this.handleNativeToolCalls(chunk.toolCalls);
    } else if (chunk.type === 'finish') {
      // 处理完成 - 对于只有推理内容没有普通内容的模型（如纯推理模型）
      if (this.state.content.trim() === '' && this.state.reasoning && this.state.reasoning.trim() !== '') {
        console.log('[UnifiedStreamProcessor] 纯推理模型：使用推理内容作为最终回复');
        // 将推理内容设置为最终内容
        this.state.content = this.state.reasoning;

        // 通过 onChunk 发送最终内容
        if (this.options.onChunk) {
          this.options.onChunk({
            type: ChunkType.TEXT_COMPLETE,
            text: this.state.content,
            messageId: this.options.messageId,
            blockId: this.options.blockId,
            topicId: this.options.topicId
          } as Chunk);
        }
      }

      // 通过onChunk发送完成事件
      if (this.options.onChunk && this.state.content) {
        this.options.onChunk({
          type: ChunkType.TEXT_COMPLETE,
          text: this.state.content,
          messageId: this.options.messageId,
          blockId: this.options.blockId,
          topicId: this.options.topicId
        } as Chunk);
      }

      // 发送思考完成事件
      if (this.state.reasoning) {
        EventEmitter.emit(EVENT_NAMES.STREAM_THINKING_COMPLETE, {
          text: this.state.reasoning,
          thinking_millsec: this.state.reasoningStartTime ? (Date.now() - this.state.reasoningStartTime) : 0,
          messageId: this.options.messageId,
          blockId: this.options.thinkingBlockId,
          topicId: this.options.topicId
        });
      }

      // 发送文本完成事件（使用最终的content）
      EventEmitter.emit(EVENT_NAMES.STREAM_TEXT_COMPLETE, {
        text: this.state.content,
        messageId: this.options.messageId,
        blockId: this.options.blockId,
        topicId: this.options.topicId
      });

      // 发送流完成事件
      EventEmitter.emit(EVENT_NAMES.STREAM_COMPLETE, {
        status: 'success',
        response: {
          content: this.state.content,
          reasoning: this.state.reasoning,
          reasoningTime: this.state.reasoningStartTime ? (Date.now() - this.state.reasoningStartTime) : 0
        }
      });
    }
  }

  /**
   * 处理原生工具调用（流式积累）
   * OpenAI 流式返回的 tool_calls 是增量的，需要合并
   */
  private handleNativeToolCalls(toolCallDeltas: any[]): void {
    for (const delta of toolCallDeltas) {
      const index = delta.index ?? 0;

      // 初始化或更新工具调用
      if (!this.state.toolCalls[index]) {
        this.state.toolCalls[index] = {
          id: delta.id || '',
          type: delta.type || 'function',
          function: {
            name: delta.function?.name || '',
            arguments: delta.function?.arguments || ''
          }
        };
      } else {
        // 合并增量数据
        if (delta.id) {
          this.state.toolCalls[index].id = delta.id;
        }
        if (delta.function?.name) {
          this.state.toolCalls[index].function.name += delta.function.name;
        }
        if (delta.function?.arguments) {
          this.state.toolCalls[index].function.arguments += delta.function.arguments;
        }
      }

      // 首次看到该工具时发送 MCP_TOOL_IN_PROGRESS 事件（用于 UI 显示）
      if (!this.state.emittedToolIndices.has(index) && this.state.toolCalls[index].function.name) {
        this.state.emittedToolIndices.add(index);

        if (this.options.onChunk) {
          const toolCall = this.state.toolCalls[index];
          console.log(`[UnifiedStreamProcessor] 检测到原生工具调用: ${toolCall.function.name}`);
          this.options.onChunk({
            type: ChunkType.MCP_TOOL_IN_PROGRESS,
            responses: [{
              id: toolCall.id,
              name: toolCall.function.name,
              status: 'invoking',
              arguments: {} // 参数尚未完整
            }]
          } as Chunk);
        }
      }
    }
  }

  /**
   * 构建最终结果
   */
  private buildResult(): StreamProcessingResult {
    const result: StreamProcessingResult = {
      content: this.state.content,
      reasoning: this.state.reasoning || undefined,
      reasoningTime: this.state.reasoningStartTime > 0 ? (Date.now() - this.state.reasoningStartTime) : undefined
    };

    // 检查原生工具调用
    if (this.state.toolCalls.length > 0) {
      result.hasToolCalls = true;
      result.nativeToolCalls = this.state.toolCalls;
      console.log(`[UnifiedStreamProcessor] 流式积累完成，原生工具调用数量: ${this.state.toolCalls.length}`);
    }

    // 检查 XML 格式工具调用
    if (!result.hasToolCalls && this.options.enableTools && this.options.mcpTools && this.options.mcpTools.length > 0) {
      const hasTools = hasToolUseTags(this.state.content, this.options.mcpTools);
      if (hasTools) {
        result.hasToolCalls = true;
      }
    }

    return result;
  }

  /**
   * 设置思考块ID
   */
  public setThinkingBlockId(blockId: string): void {
    if (blockId && blockId !== this.options.thinkingBlockId) {
      console.log(`[UnifiedStreamProcessor] 更新思考块ID: ${blockId}`);
      this.options.thinkingBlockId = blockId;
    }
  }

  /**
   * 获取当前内容
   */
  public getContent(): string {
    return this.state.content;
  }

  /**
   * 获取当前推理内容
   */
  public getReasoning(): string {
    return this.state.reasoning;
  }
}

/**
 * 简化的函数式接口
 */
export async function unifiedStreamCompletion(
  client: OpenAI,
  modelId: string,
  messages: any[],
  temperature?: number,
  maxTokens?: number,
  additionalParams?: any,
  onChunk?: (chunk: Chunk) => void
): Promise<string | StreamProcessingResult> {
  const model: Model = {
    id: modelId,
    provider: additionalParams?.model?.provider || 'openai'
  } as Model;

  const processor = new UnifiedStreamProcessor({
    model,
    onChunk,
    enableTools: additionalParams?.enableTools,
    mcpTools: additionalParams?.mcpTools,
    abortSignal: additionalParams?.signal,
    enableReasoning: true,
    messageId: additionalParams?.messageId,
    blockId: additionalParams?.blockId,
    thinkingBlockId: additionalParams?.thinkingBlockId,
    topicId: additionalParams?.topicId
  });

  // 过滤掉内部使用的参数和某些 API 不支持的参数
  const {
    enableTools,
    mcpTools,
    signal,
    messageId,
    blockId,
    thinkingBlockId,
    topicId,
    model: _model,
    top_p,  // 某些 API 不支持此参数
    ...apiParams
  } = additionalParams || {};
  
  // 创建流
  const stream = await client.chat.completions.create({
    model: modelId,
    messages,
    temperature: temperature || 1.0,
    max_tokens: maxTokens,
    stream: true,
    ...apiParams
  });

  const result = await processor.processStream(stream as any);
  
  // 兼容原接口
  if (result.hasToolCalls) {
    return result;
  }
  
  return result.content;
}

/**
 * 创建统一流处理器的工厂函数
 */
export function createUnifiedStreamProcessor(options: UnifiedStreamOptions): UnifiedStreamProcessor {
  return new UnifiedStreamProcessor(options);
}

/**
 * 创建流处理器 - 替代原 OpenAIStreamProcessor
 */
export function createAdvancedStreamProcessor(options: UnifiedStreamOptions): UnifiedStreamProcessor {
  return new UnifiedStreamProcessor(options);
}

// 重新导出类型以保持兼容性
export type { UnifiedStreamOptions as OpenAIStreamProcessorOptions };
export type { StreamProcessingResult as OpenAIStreamResult };
