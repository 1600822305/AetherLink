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
 * 流处理模式
 */
export type StreamProcessingMode = 'simple' | 'advanced';

/**
 * 统一流处理选项
 */
export interface UnifiedStreamOptions {
  // 基础选项
  model: Model;
  onUpdate?: (content: string, reasoning?: string) => void;
  onChunk?: (chunk: Chunk) => void;
  abortSignal?: AbortSignal;
  
  // 高级选项（仅在 advanced 模式下使用）
  enableReasoning?: boolean;
  messageId?: string;
  blockId?: string;
  thinkingBlockId?: string;
  topicId?: string;
  
  // 工具相关
  enableTools?: boolean;
  mcpTools?: any[];
  
  // 处理模式
  mode?: StreamProcessingMode;
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
 * 统一流式响应处理器类
 * 整合了原有两个处理器的所有功能
 */
export class UnifiedStreamProcessor {
  private options: UnifiedStreamOptions;
  private content: string = '';
  private reasoning: string = '';
  private reasoningStartTime: number = 0;
  
  // DeepSeek特殊处理
  private isDeepSeekProvider: boolean = false;
  private previousCompleteResponse: string = '';
  
  // AbortController管理
  private abortController?: AbortController;
  private cleanup?: () => void;

  constructor(options: UnifiedStreamOptions) {
    this.options = options;
    
    // 检查是否为DeepSeek提供商
    this.isDeepSeekProvider = options.model.provider === 'deepseek' ||
                             (typeof options.model.id === 'string' && options.model.id.includes('deepseek'));
    
    // 设置AbortController（仅在高级模式下）
    if (options.mode === 'advanced' && options.messageId) {
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
      if (this.options.mode === 'advanced') {
        return await this.processAdvancedStream(stream);
      } else {
        return await this.processSimpleStream(stream);
      }
    } catch (error) {
      if (isAbortError(error)) {
        console.log('[UnifiedStreamProcessor] 流式响应被用户中断');
        return {
          content: this.content,
          reasoning: this.reasoning || undefined,
          reasoningTime: this.reasoningStartTime > 0 ? (Date.now() - this.reasoningStartTime) : undefined
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
   * 高级流处理模式 - 使用中间件和完整功能
   */
  private async processAdvancedStream(stream: AsyncIterable<any>): Promise<StreamProcessingResult> {
    console.log(`[UnifiedStreamProcessor] 使用高级模式处理流式响应，模型: ${this.options.model.id}`);

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
   * 简单流处理模式 - 直接处理，兼容原 stream.ts
   */
  private async processSimpleStream(stream: AsyncIterable<any>): Promise<StreamProcessingResult> {
    console.log(`[UnifiedStreamProcessor] 使用简单模式处理流式响应，模型: ${this.options.model.id}`);

    let fullContent = '';
    let fullReasoning = '';
    let contentBuffer = '';
    let isInThinkTag = false;
    let thinkBuffer = '';
    let hasReasoningContent = false;
    let reasoningStartTime = 0;
    let reasoningEndTime = 0;

    try {
      for await (const chunk of stream) {
        // 检查中断
        if (this.options.abortSignal?.aborted) {
          console.log('[UnifiedStreamProcessor] 简单模式流式响应被中断');
          break;
        }

        // 处理chunk
        const delta = chunk.choices?.[0]?.delta?.content || '';
        if (!delta) continue;

        // DeepSeek重复内容检测（简单模式）
        if (this.isDeepSeekProvider) {
          const potentialCompleteResponse = fullContent + delta;

          if (this.previousCompleteResponse &&
              potentialCompleteResponse.length < this.previousCompleteResponse.length &&
              this.previousCompleteResponse.startsWith(potentialCompleteResponse)) {
            console.log('[UnifiedStreamProcessor] 简单模式跳过疑似重复内容块');
            continue;
          }

          this.previousCompleteResponse = potentialCompleteResponse;
        }

        contentBuffer += delta;

        // 处理推理标签
        const { content: processedContent, reasoning: processedReasoning, buffer: newBuffer, isInThinkTag: newIsInThinkTag } =
          this.processThinkTags(contentBuffer, isInThinkTag, thinkBuffer, hasReasoningContent, reasoningStartTime);

        contentBuffer = newBuffer;
        isInThinkTag = newIsInThinkTag;

        if (processedContent) {
          fullContent += processedContent;

          // 发送内容更新
          if (this.options.onChunk) {
            this.options.onChunk({
              type: ChunkType.TEXT_DELTA,
              text: processedContent,
              messageId: this.options.messageId,
              blockId: this.options.blockId,
              topicId: this.options.topicId
            });
          } else if (this.options.onUpdate) {
            this.options.onUpdate(fullContent, fullReasoning);
          }
        }

        if (processedReasoning) {
          fullReasoning += processedReasoning;
          
          if (!hasReasoningContent) {
            hasReasoningContent = true;
            reasoningStartTime = Date.now();
          }
          
          // 发送推理更新
          if (this.options.onChunk) {
            this.options.onChunk({
              type: ChunkType.THINKING_DELTA,
              text: processedReasoning,
              blockId: this.options.thinkingBlockId
            } as Chunk);
          }
        }
      }

      if (hasReasoningContent) {
        reasoningEndTime = Date.now();
      }

      // 处理剩余内容
      if (contentBuffer.length > 0) {
        if (isInThinkTag) {
          fullReasoning += contentBuffer;
        } else {
          fullContent += contentBuffer;
        }
      }

      // 推理模型特殊处理：如果内容为空但有推理内容，使用推理内容作为回复
      if (fullContent.trim() === '' && fullReasoning && fullReasoning.trim() !== '') {
        console.log('[UnifiedStreamProcessor] 推理模型：使用推理内容作为主要回复');
        fullContent = fullReasoning;

        // 发送文本完成事件
        if (this.options.onChunk) {
          this.options.onChunk({
            type: ChunkType.TEXT_COMPLETE,
            text: fullReasoning,
            messageId: this.options.messageId,
            blockId: this.options.blockId,
            topicId: this.options.topicId
          } as Chunk);
        } else if (this.options.onUpdate) {
          this.options.onUpdate(fullContent, '');
        }
      }

      this.content = fullContent;
      this.reasoning = fullReasoning;

      // 发送完成事件
      EventEmitter.emit(EVENT_NAMES.STREAM_COMPLETE, {
        status: 'success',
        response: {
          content: fullContent,
          reasoning: fullReasoning,
          reasoningTime: hasReasoningContent ? (reasoningEndTime - reasoningStartTime) : 0
        }
      });

      return this.buildResult();

    } catch (error) {
      console.error('[UnifiedStreamProcessor] 简单模式处理失败:', error);
      
      EventEmitter.emit(EVENT_NAMES.STREAM_ERROR, {
        error,
        timestamp: Date.now()
      });
      
      throw error;
    }
  }

  /**
   * 处理高级模式的chunk
   */
  private async handleAdvancedChunk(chunk: any): Promise<void> {
    if (chunk.type === 'text-delta') {
      // DeepSeek重复内容检测
      if (this.isDeepSeekProvider) {
        const potentialCompleteResponse = this.content + chunk.textDelta;
        
        if (this.previousCompleteResponse &&
            potentialCompleteResponse.length < this.previousCompleteResponse.length &&
            this.previousCompleteResponse.startsWith(potentialCompleteResponse)) {
          console.log('[UnifiedStreamProcessor] 跳过疑似重复内容块');
          return;
        }
        
        this.previousCompleteResponse = potentialCompleteResponse;
      }

      this.content += chunk.textDelta;

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
        this.options.onUpdate(this.content, this.reasoning);
      }
    } else if (chunk.type === 'reasoning') {
      if (!this.reasoningStartTime) {
        this.reasoningStartTime = Date.now();
      }

      this.reasoning += chunk.textDelta;

      if (this.options.onChunk) {
        this.options.onChunk({
          type: ChunkType.THINKING_DELTA,
          text: chunk.textDelta,
          blockId: this.options.thinkingBlockId
        } as Chunk);
      }
    } else if (chunk.type === 'finish') {
      // 处理完成 - 推理模型特殊处理
      if (this.content.trim() === '' && this.reasoning && this.reasoning.trim() !== '') {
        console.log('[UnifiedStreamProcessor] 高级模式推理模型：使用推理内容作为主要回复');
        const reasoningAsContent = this.reasoning;
        this.content = reasoningAsContent;

        // 只通过onChunk发送，不重复发送TEXT_COMPLETE事件
        if (this.options.onChunk) {
          this.options.onChunk({
            type: ChunkType.TEXT_COMPLETE,
            text: reasoningAsContent,
            messageId: this.options.messageId,
            blockId: this.options.blockId,
            topicId: this.options.topicId
          } as Chunk);
        } else if (this.options.onUpdate) {
          this.options.onUpdate(reasoningAsContent, '');
        }
      }

      // 发送思考完成事件
      if (this.reasoning) {
        EventEmitter.emit(EVENT_NAMES.STREAM_THINKING_COMPLETE, {
          text: this.reasoning,
          thinking_millsec: this.reasoningStartTime ? (Date.now() - this.reasoningStartTime) : 0,
          messageId: this.options.messageId,
          blockId: this.options.thinkingBlockId,
          topicId: this.options.topicId
        });
      }

      // 发送文本完成事件（使用最终的content）
      EventEmitter.emit(EVENT_NAMES.STREAM_TEXT_COMPLETE, {
        text: this.content,
        messageId: this.options.messageId,
        blockId: this.options.blockId,
        topicId: this.options.topicId
      });

      // 发送流完成事件
      EventEmitter.emit(EVENT_NAMES.STREAM_COMPLETE, {
        status: 'success',
        response: {
          content: this.content,
          reasoning: this.reasoning,
          reasoningTime: this.reasoningStartTime ? (Date.now() - this.reasoningStartTime) : 0
        }
      });
    }
  }

  /**
   * 处理思考标签（简单模式使用）
   */
  private processThinkTags(
    buffer: string,
    isInThinkTag: boolean,
    _thinkBuffer: string,
    _hasReasoningContent: boolean,
    _reasoningStartTime: number
  ): { content: string; reasoning: string; buffer: string; isInThinkTag: boolean } {
    // 这里实现简单的标签解析逻辑
    // 类似于原 stream.ts 中的逻辑

    let content = '';
    let reasoning = '';
    let newBuffer = '';
    let newIsInThinkTag = isInThinkTag;

    // 简化的标签处理逻辑
    const thinkOpenTag = '<think>';
    const thinkCloseTag = '</think>';

    if (!isInThinkTag && buffer.includes(thinkOpenTag)) {
      const openIndex = buffer.indexOf(thinkOpenTag);
      content = buffer.substring(0, openIndex);
      newBuffer = buffer.substring(openIndex + thinkOpenTag.length);
      newIsInThinkTag = true;

      // 检查是否在同一个buffer中也有关闭标签
      if (newBuffer.includes(thinkCloseTag)) {
        const closeIndex = newBuffer.indexOf(thinkCloseTag);
        reasoning = newBuffer.substring(0, closeIndex);
        newBuffer = newBuffer.substring(closeIndex + thinkCloseTag.length);
        newIsInThinkTag = false;
      }
    } else if (isInThinkTag && buffer.includes(thinkCloseTag)) {
      const closeIndex = buffer.indexOf(thinkCloseTag);
      reasoning = buffer.substring(0, closeIndex);
      newBuffer = buffer.substring(closeIndex + thinkCloseTag.length);
      newIsInThinkTag = false;
    } else if (isInThinkTag) {
      // 在思考标签内，所有内容都是推理内容
      reasoning = buffer;
      newBuffer = '';
    } else {
      // 没有思考标签，所有内容都是普通内容
      content = buffer;
      newBuffer = '';
    }

    return { content, reasoning, buffer: newBuffer, isInThinkTag: newIsInThinkTag };
  }

  /**
   * 构建最终结果
   */
  private buildResult(): StreamProcessingResult {
    const result: StreamProcessingResult = {
      content: this.content,
      reasoning: this.reasoning || undefined,
      reasoningTime: this.reasoningStartTime > 0 ? (Date.now() - this.reasoningStartTime) : undefined
    };

    // 检查工具调用
    if (this.options.enableTools && this.options.mcpTools && this.options.mcpTools.length > 0) {
      const hasTools = hasToolUseTags(this.content, this.options.mcpTools);
      if (hasTools) {
        result.hasToolCalls = true;
      }
    }

    return result;
  }

  /**
   * 设置思考块ID（高级模式）
   */
  public setThinkingBlockId(blockId: string): void {
    if (this.options.mode === 'advanced' && blockId && blockId !== this.options.thinkingBlockId) {
      console.log(`[UnifiedStreamProcessor] 更新思考块ID: ${blockId}`);
      this.options.thinkingBlockId = blockId;
    }
  }

  /**
   * 获取当前内容
   */
  public getContent(): string {
    return this.content;
  }

  /**
   * 获取当前推理内容
   */
  public getReasoning(): string {
    return this.reasoning;
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
    mode: onChunk ? 'advanced' : 'simple' // 有onChunk时使用高级模式
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
 * 高级模式处理器 - 替代原 OpenAIStreamProcessor
 */
export function createAdvancedStreamProcessor(options: Omit<UnifiedStreamOptions, 'mode'>): UnifiedStreamProcessor {
  return new UnifiedStreamProcessor({
    ...options,
    mode: 'advanced'
  });
}

/**
 * 简单模式处理器 - 替代原 streamCompletion
 */
export function createSimpleStreamProcessor(options: Omit<UnifiedStreamOptions, 'mode'>): UnifiedStreamProcessor {
  return new UnifiedStreamProcessor({
    ...options,
    mode: 'simple'
  });
}

// 重新导出类型以保持兼容性
export type { UnifiedStreamOptions as OpenAIStreamProcessorOptions };
export type { StreamProcessingResult as OpenAIStreamResult };
