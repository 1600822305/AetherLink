/**
 * 统一流式响应处理器
 * 合并 streamProcessor.ts 和 stream.ts 的功能，去除重复代码
 */
import OpenAI from 'openai';
import {
  asyncGeneratorToReadableStream,
  readableStreamAsyncIterable,
  openAIChunkToTextDelta
} from '../../utils/streamUtils';
import { EventEmitter, EVENT_NAMES } from '../../services/EventEmitter';
import { getAppropriateTag } from '../../config/reasoningTags';
import { extractReasoningMiddleware } from '../../middlewares/extractReasoningMiddleware';
import { createAbortController, isAbortError } from '../../utils/abortController';
import { ChunkType } from '../../types/chunk';
import { hasToolUseTags } from '../../utils/mcpToolParser';
import type { Model } from '../../types';
import type { Chunk } from '../../types/chunk';

/**
 * 统一流处理选项
 */
export interface UnifiedStreamOptions {
  // 基础选项
  model: Model;
  onUpdate?: (content: string, reasoning?: string) => void;
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
}

/**
 * 流处理状态
 */
interface StreamProcessingState {
  content: string;
  reasoning: string;
  reasoningStartTime: number;
  previousCompleteResponse: string;
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
    previousCompleteResponse: ''
  };

  // DeepSeek特殊处理
  private isDeepSeekProvider: boolean = false;

  // AbortController管理
  private abortController?: AbortController;
  private cleanup?: () => void;

  constructor(options: UnifiedStreamOptions) {
    this.options = options;

    // 检查是否为DeepSeek提供商
    this.isDeepSeekProvider = options.model.provider === 'deepseek' ||
                             (typeof options.model.id === 'string' && options.model.id.includes('deepseek'));

    // 设置AbortController
    if (options.messageId) {
      const { abortController, cleanup } = createAbortController(options.messageId, true);
      this.abortController = abortController;
      this.cleanup = cleanup;
    }
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
    if (this.options.abortSignal?.aborted || this.abortController?.signal.aborted) {
      throw new DOMException('Operation aborted', 'AbortError');
    }

    // 获取推理标签
    const reasoningTag = getAppropriateTag(this.options.model);

    // 使用中间件处理
    const { stream: processedStream } = await extractReasoningMiddleware({
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
      if (this.options.abortSignal?.aborted || this.abortController?.signal.aborted) {
        break;
      }
      await this.handleAdvancedChunk(chunk);
    }

    return this.buildResult();
  }



  /**
   * DeepSeek重复内容检测
   */
  private shouldSkipDeepSeekContent(newContent: string): boolean {
    if (!this.isDeepSeekProvider) {
      return false;
    }

    const potentialCompleteResponse = this.state.content + newContent;

    if (this.state.previousCompleteResponse &&
        potentialCompleteResponse.length < this.state.previousCompleteResponse.length &&
        this.state.previousCompleteResponse.startsWith(potentialCompleteResponse)) {
      console.log('[UnifiedStreamProcessor] 跳过疑似重复内容块');
      return true;
    }

    this.state.previousCompleteResponse = potentialCompleteResponse;
    return false;
  }

  /**
   * 处理高级模式的chunk
   */
  private async handleAdvancedChunk(chunk: any): Promise<void> {
    if (chunk.type === 'text-delta') {
      // DeepSeek重复内容检测
      if (this.shouldSkipDeepSeekContent(chunk.textDelta)) {
        return;
      }

      // 检查是否是推理阶段结束（第一次收到内容）
      const isFirstContent = this.state.content === '' && this.state.reasoning !== '';

      this.state.content += chunk.textDelta;

      // 如果是推理阶段结束，先发送推理完成信号
      if (isFirstContent && this.options.onUpdate) {
        console.log('[UnifiedStreamProcessor] 推理阶段结束，开始内容阶段');
        // 发送推理完成信号，让模型组合知道推理阶段结束
        this.options.onUpdate(chunk.textDelta, '');
        return; // 这次调用已经发送了内容，直接返回
      }

      // 发送事件
      if (this.options.onChunk) {
        this.options.onChunk({
          type: ChunkType.TEXT_DELTA,
          text: chunk.textDelta,
          messageId: this.options.messageId,
          blockId: this.options.blockId,
          topicId: this.options.topicId
        });
      } else if (this.options.onUpdate) {
        // 传递增量内容而不是累积内容，避免重复显示
        this.options.onUpdate(chunk.textDelta, '');
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
      } else if (this.options.onUpdate) {
        // 为模型组合功能提供实时推理片段
        // 传递空字符串作为content，推理片段作为reasoning
        this.options.onUpdate('', chunk.textDelta);
      }
    } else if (chunk.type === 'finish') {
      // 处理完成 - 对于只有推理内容没有普通内容的模型（如纯推理模型）
      if (this.state.content.trim() === '' && this.state.reasoning && this.state.reasoning.trim() !== '') {
        console.log('[UnifiedStreamProcessor] 纯推理模型：使用推理内容作为最终回复');
        // 将推理内容设置为最终内容
        this.state.content = this.state.reasoning;

        // 发送最终内容
        if (this.options.onUpdate) {
          this.options.onUpdate(this.state.content, '');
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
   * 构建最终结果
   */
  private buildResult(): StreamProcessingResult {
    const result: StreamProcessingResult = {
      content: this.state.content,
      reasoning: this.state.reasoning || undefined,
      reasoningTime: this.state.reasoningStartTime > 0 ? (Date.now() - this.state.reasoningStartTime) : undefined
    };

    // 检查工具调用
    if (this.options.enableTools && this.options.mcpTools && this.options.mcpTools.length > 0) {
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
 * 简化的函数式接口 - 兼容原 streamCompletion
 */
export async function unifiedStreamCompletion(
  client: OpenAI,
  modelId: string,
  messages: any[],
  temperature?: number,
  maxTokens?: number,
  onUpdate?: (content: string, reasoning?: string) => void,
  additionalParams?: any,
  onChunk?: (chunk: Chunk) => void
): Promise<string | StreamProcessingResult> {
  const model: Model = {
    id: modelId,
    provider: additionalParams?.model?.provider || 'openai'
  } as Model;

  const processor = new UnifiedStreamProcessor({
    model,
    onUpdate,
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

  // 创建流
  const stream = await client.chat.completions.create({
    model: modelId,
    messages,
    temperature: temperature || 1.0,
    max_tokens: maxTokens,
    stream: true,
    ...additionalParams
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
