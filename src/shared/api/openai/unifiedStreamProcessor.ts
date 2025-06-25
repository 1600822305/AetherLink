/**
 * 统一流式响应处理器
 * 合并 streamProcessor.ts 和 stream.ts 的功能，去除重复代码
 */
import OpenAI from 'openai';
import {
  openAIChunkToTextDelta
} from '../../utils/streamUtils';
import { EventEmitter, EVENT_NAMES } from '../../services/EventEmitter';
import { getAppropriateTag } from '../../config/reasoningTags';
import { createAbortController, isAbortError } from '../../utils/abortController';
import { ChunkType } from '../../types/chunk';
import { hasToolUseTags } from '../../utils/mcpToolParser';
import type { Model } from '../../types';
import type { Chunk } from '../../types/chunk';

// 移除了未使用的导入:
// - asyncGeneratorToReadableStream
// - readableStreamAsyncIterable
// - extractReasoningMiddleware

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

  // 在类定义开始处添加缓存
  private static tagCache = new Map<string, any>();
  private contentBuffer = '';
  private reasoningBuffer = '';
  private lastFlushTime = 0;
  private readonly FLUSH_INTERVAL = 16; // 约60fps的更新频率

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

    // 获取推理标签 - 使用缓存避免重复计算
    const modelId = this.options.model.id;
    let reasoningTag;
    
    if (UnifiedStreamProcessor.tagCache.has(modelId)) {
      reasoningTag = UnifiedStreamProcessor.tagCache.get(modelId);
    } else {
      reasoningTag = getAppropriateTag(this.options.model);
      UnifiedStreamProcessor.tagCache.set(modelId, reasoningTag);
    }

    try {
      // 创建更高效的处理管道
      const processedStream = this.createOptimizedStreamPipeline(stream, reasoningTag);
      
      // 使用批处理更新
      for await (const chunk of processedStream) {
        if (this.options.abortSignal?.aborted || this.abortController?.signal.aborted) {
          break;
        }
        
        // 将chunk添加到缓冲区
        this.bufferChunk(chunk);
        
        // 定期刷新缓冲区
        const now = performance.now();
        if (now - this.lastFlushTime >= this.FLUSH_INTERVAL) {
          await this.flushBuffers();
          this.lastFlushTime = now;
        }
      }
      
      // 确保处理完所有剩余内容
      await this.flushBuffers();
      
      // 处理完成事件
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

      // 发送文本完成事件
      EventEmitter.emit(EVENT_NAMES.STREAM_TEXT_COMPLETE, {
        text: this.state.content,
        messageId: this.options.messageId,
        blockId: this.options.blockId,
        topicId: this.options.topicId
      });
      
      return this.buildResult();
    } catch (error) {
      if (isAbortError(error)) {
        throw error;
      }
      console.error('[UnifiedStreamProcessor] 处理流时出错:', error);
      throw error;
    }
  }

  /**
   * 创建优化的流处理管道
   */
  private createOptimizedStreamPipeline(stream: AsyncIterable<any>, reasoningTag: any): AsyncIterable<any> {
    // 直接使用转换流，减少中间步骤
    return {
      [Symbol.asyncIterator]: async function* () {
        // 转换为文本增量
        const textDeltaStream = openAIChunkToTextDelta(stream);
        
        // 提取推理内容
        let isInThinkTag = false;
        let buffer = '';
        
        for await (const chunk of textDeltaStream) {
          if (chunk.type === 'text-delta') {
            const text = chunk.textDelta;
            buffer += text;
            
            // 检查开始标签
            if (!isInThinkTag && buffer.includes(reasoningTag.openingTag)) {
              const parts = buffer.split(reasoningTag.openingTag);
              if (parts[0]) {
                yield { type: 'text-delta', textDelta: parts[0] };
              }
              buffer = parts[1] || '';
              isInThinkTag = true;
              continue;
            }
            
            // 检查结束标签
            if (isInThinkTag && buffer.includes(reasoningTag.closingTag)) {
              const parts = buffer.split(reasoningTag.closingTag);
              if (parts[0]) {
                yield { type: 'reasoning', textDelta: parts[0] };
              }
              buffer = parts[1] || '';
              isInThinkTag = false;
              continue;
            }
            
            // 输出缓冲区内容
            if (buffer.length > 0) {
              if (isInThinkTag) {
                yield { type: 'reasoning', textDelta: buffer };
              } else {
                yield { type: 'text-delta', textDelta: buffer };
              }
              buffer = '';
            }
          } else {
            // 直接传递其他类型的chunk
            yield chunk;
          }
        }
        
        // 处理剩余的缓冲区内容
        if (buffer.length > 0) {
          if (isInThinkTag) {
            yield { type: 'reasoning', textDelta: buffer };
          } else {
            yield { type: 'text-delta', textDelta: buffer };
          }
        }
      }
    };
  }

  /**
   * 将chunk添加到适当的缓冲区
   */
  private bufferChunk(chunk: any): void {
    // 处理特殊类型的chunk
    if (chunk.type === 'finish') {
      // 直接使用原来的handleAdvancedChunk方法处理finish事件
      this.handleAdvancedChunk(chunk);
      return;
    }
    
    // 处理常规文本和推理内容
    if (chunk.type === 'text-delta') {
      this.contentBuffer += chunk.textDelta;
    } else if (chunk.type === 'reasoning') {
      this.reasoningBuffer += chunk.textDelta;
    }
  }

  /**
   * 刷新缓冲区并更新UI
   */
  private async flushBuffers(): Promise<void> {
    // 处理推理缓冲区
    if (this.reasoningBuffer.length > 0) {
      if (!this.state.reasoningStartTime) {
        this.state.reasoningStartTime = Date.now();
      }
      
      this.state.reasoning += this.reasoningBuffer;
      
      if (this.options.onChunk) {
        this.options.onChunk({
          type: ChunkType.THINKING_DELTA,
          text: this.reasoningBuffer,
          blockId: this.options.thinkingBlockId
        } as Chunk);
      } else if (this.options.onUpdate) {
        this.options.onUpdate('', this.state.reasoning);
      }
      
      this.reasoningBuffer = '';
    }
    
    // 处理内容缓冲区
    if (this.contentBuffer.length > 0) {
      // 检查是否是推理阶段结束（第一次收到内容）
      const isFirstContent = this.state.content === '' && this.state.reasoning !== '';
      
      this.state.content += this.contentBuffer;
      
      // 如果是推理阶段结束，先发送推理完成信号
      if (isFirstContent && this.options.onUpdate) {
        console.log('[UnifiedStreamProcessor] 推理阶段结束，开始内容阶段');
        // 发送推理完成信号，让模型组合知道推理阶段结束
        this.options.onUpdate(this.contentBuffer, '');
      } else {
        // 发送事件
        if (this.options.onChunk) {
          this.options.onChunk({
            type: ChunkType.TEXT_DELTA,
            text: this.contentBuffer,
            messageId: this.options.messageId,
            blockId: this.options.blockId,
            topicId: this.options.topicId
          });
        } else if (this.options.onUpdate) {
          this.options.onUpdate(this.state.content, '');
        }
      }
      
      this.contentBuffer = '';
    }
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
        this.options.onUpdate(this.state.content, '');
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
