/**
 * OpenAI 到 AI SDK 格式适配器
 * 将 OpenAI 原生的 SSE chunk 转换为 AI SDK 格式的事件流
 * 
 * 这样可以复用 AiSdkToChunkAdapter 的完整事件处理逻辑
 * 
 * 参考 Cherry Studio 架构：所有 Provider 都通过统一的适配器层处理
 */

import type { AiSdkStreamPart, AiSdkStreamResult } from './types';

/**
 * OpenAI 流式响应 Chunk 类型
 */
interface OpenAIStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta?: OpenAIContentSource;
    message?: OpenAIContentSource;
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface OpenAIContentSource {
  role?: string;
  content?: string | null;
  reasoning_content?: string;
  reasoning?: string;
  thinking?: { content?: string };
  tool_calls?: Array<{
    index: number;
    id?: string;
    type?: string;
    function?: {
      name?: string;
      arguments?: string;
    };
  }>;
}

/**
 * OpenAI 到 AI SDK 适配器
 * 将 OpenAI 原生格式转换为 AI SDK 的 fullStream 格式
 */
export class OpenAIToAiSdkAdapter {
  private toolCallsBuffer: Map<number, { id: string; name: string; arguments: string }> = new Map();
  private accumulatedText = '';
  private accumulatedReasoning = '';
  private isThinking = false;
  private hasStartedText = false;
  private lastUsage: { inputTokens: number; outputTokens: number; totalTokens: number } | null = null;

  /**
   * 将 OpenAI AsyncIterable 转换为 AI SDK 格式的 ReadableStream
   */
  async convertToAiSdkStream(
    openAIStream: AsyncIterable<OpenAIStreamChunk>
  ): Promise<AiSdkStreamResult> {
    const self = this;
    
    // 创建一个 ReadableStream
    const stream = new ReadableStream<AiSdkStreamPart>({
      async start(controller) {
        try {
          for await (const chunk of openAIStream) {
            const aiSdkParts = self.convertChunk(chunk);
            for (const part of aiSdkParts) {
              controller.enqueue(part);
            }
          }
          
          // 流结束时发送 finish 事件
          const finishParts = self.emitFinish();
          for (const part of finishParts) {
            controller.enqueue(part);
          }
          
          controller.close();
        } catch (error) {
          controller.enqueue({
            type: 'error',
            error: error instanceof Error ? error : new Error(String(error))
          } as AiSdkStreamPart);
          controller.close();
        }
      }
    });

    return {
      fullStream: stream,
      text: Promise.resolve(this.accumulatedText)
    };
  }

  /**
   * 转换单个 OpenAI chunk 为 AI SDK 格式的事件数组
   */
  private convertChunk(chunk: OpenAIStreamChunk): AiSdkStreamPart[] {
    const parts: AiSdkStreamPart[] = [];

    // 更新 usage 信息
    if (chunk.usage) {
      this.lastUsage = {
        inputTokens: chunk.usage.prompt_tokens || 0,
        outputTokens: chunk.usage.completion_tokens || 0,
        totalTokens: chunk.usage.total_tokens || 0
      };
    }

    // 处理 choices
    if (chunk.choices && chunk.choices.length > 0) {
      for (const choice of chunk.choices) {
        if (!choice) continue;

        const contentSource = choice.delta || choice.message;
        if (!contentSource) {
          // 检查 finish_reason
          if (choice.finish_reason) {
            parts.push(...this.handleFinishReason(choice.finish_reason));
          }
          continue;
        }

        // === 处理推理/思考内容 ===
        const reasoningText = 
          contentSource.reasoning_content || 
          contentSource.reasoning || 
          contentSource.thinking?.content;
        
        if (reasoningText) {
          if (!this.isThinking) {
            this.isThinking = true;
            parts.push({ type: 'reasoning-start', id: `reasoning-${Date.now()}` } as AiSdkStreamPart);
          }
          this.accumulatedReasoning += reasoningText;
          parts.push({ type: 'reasoning-delta', text: reasoningText } as AiSdkStreamPart);
        }

        // === 处理文本内容 ===
        if (contentSource.content) {
          // 如果之前在思考，先结束思考
          if (this.isThinking) {
            parts.push({ type: 'reasoning-end' } as AiSdkStreamPart);
            this.isThinking = false;
          }
          
          // 第一次文本，发送 text-start
          if (!this.hasStartedText) {
            this.hasStartedText = true;
            parts.push({ type: 'text-start' } as AiSdkStreamPart);
            console.log('[OpenAIToAiSdkAdapter] 发送 text-start');
          }
          
          this.accumulatedText += contentSource.content;
          parts.push({ type: 'text-delta', text: contentSource.content } as AiSdkStreamPart);
          console.log('[OpenAIToAiSdkAdapter] 发送 text-delta (增量):', contentSource.content.substring(0, 30));
        }

        // === 处理工具调用 ===
        if (contentSource.tool_calls) {
          for (const toolCall of contentSource.tool_calls) {
            if ('index' in toolCall) {
              const { id, index } = toolCall;
              const func = toolCall.function;
              
              if (func?.name) {
                // 新工具调用
                this.toolCallsBuffer.set(index, {
                  id: id || `tool-${index}`,
                  name: func.name,
                  arguments: func.arguments || ''
                });
              } else if (func?.arguments) {
                // 追加参数
                const existing = this.toolCallsBuffer.get(index);
                if (existing) {
                  existing.arguments += func.arguments;
                }
              }
            }
          }
        }

        // === 处理 finish_reason ===
        if (choice.finish_reason) {
          parts.push(...this.handleFinishReason(choice.finish_reason));
        }
      }
    }

    return parts;
  }

  /**
   * 处理 finish_reason
   */
  private handleFinishReason(finishReason: string): AiSdkStreamPart[] {
    const parts: AiSdkStreamPart[] = [];

    // 结束思考
    if (this.isThinking) {
      parts.push({ type: 'reasoning-end' } as AiSdkStreamPart);
      this.isThinking = false;
    }

    // 结束文本
    if (this.hasStartedText) {
      parts.push({ 
        type: 'text-end',
        providerMetadata: { text: { value: this.accumulatedText } }
      } as AiSdkStreamPart);
    }

    // 发送工具调用事件
    if (this.toolCallsBuffer.size > 0) {
      for (const [_, toolCall] of this.toolCallsBuffer) {
        let args: Record<string, any> = {};
        try {
          args = JSON.parse(toolCall.arguments || '{}');
        } catch {
          args = { raw: toolCall.arguments };
        }
        
        parts.push({
          type: 'tool-call',
          toolCallId: toolCall.id,
          toolName: toolCall.name,
          args
        } as AiSdkStreamPart);
      }
    }

    // 发送 finish-step
    parts.push({
      type: 'finish-step',
      finishReason: finishReason === 'tool_calls' ? 'tool-calls' : finishReason,
      providerMetadata: {}
    } as AiSdkStreamPart);

    return parts;
  }

  /**
   * 发送最终的 finish 事件
   */
  private emitFinish(): AiSdkStreamPart[] {
    return [{
      type: 'finish',
      totalUsage: this.lastUsage || {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0
      }
    } as AiSdkStreamPart];
  }

  /**
   * 重置状态（用于多轮调用）
   */
  reset(): void {
    this.toolCallsBuffer.clear();
    this.accumulatedText = '';
    this.accumulatedReasoning = '';
    this.isThinking = false;
    this.hasStartedText = false;
    this.lastUsage = null;
  }

  /**
   * 获取累积的文本
   */
  getAccumulatedText(): string {
    return this.accumulatedText;
  }

  /**
   * 获取累积的推理内容
   */
  getAccumulatedReasoning(): string {
    return this.accumulatedReasoning;
  }
}

export default OpenAIToAiSdkAdapter;
