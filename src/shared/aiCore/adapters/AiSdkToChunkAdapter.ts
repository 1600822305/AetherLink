/**
 * AI SDK 到 Chunk 适配器
 * 参考 Cherry Studio AiSdkToChunkAdapter 设计
 * 将 AI SDK 的 fullStream 转换为统一的 Chunk 格式
 * 
 * 设计理念：
 * - 依赖 AI SDK 的统一事件类型，单一适配器处理所有 Provider
 * - 不需要为每个 Provider 创建独立的适配器类
 * - AI SDK 已经将各 Provider 的响应格式标准化
 */

import type { Chunk } from '../../types/chunk';
import { ChunkType } from '../../types/chunk';
import type { 
  ChunkAdapterConfig, 
  StreamProcessResult, 
  MCPTool, 
  WebSearchResult,
  AiSdkStreamPart,
  AiSdkStreamResult
} from './types';

/**
 * AI SDK 到 Chunk 统一适配器
 * 单一类处理所有 AI SDK 事件
 */
export class AiSdkToChunkAdapter {
  private onChunk: (chunk: Chunk) => void | Promise<void>;
  private mcpTools: MCPTool[];
  private accumulate: boolean;
  private enableWebSearch: boolean;
  private onSessionUpdate?: (sessionId: string) => void;
  
  // 状态管理
  private accumulatedText = '';
  private accumulatedReasoning = '';
  private webSearchResults: WebSearchResult[] = [];
  private reasoningId = '';
  private isFirstChunk = true;
  private hasTextContent = false;
  private responseStartTimestamp: number | null = null;
  private firstTokenTimestamp: number | null = null;

  constructor(config: ChunkAdapterConfig) {
    this.onChunk = config.onChunk;
    this.mcpTools = config.mcpTools || [];
    this.accumulate = config.accumulate ?? true;
    this.enableWebSearch = config.enableWebSearch ?? false;
    this.onSessionUpdate = config.onSessionUpdate;
  }

  // ==================== 公开方法 ====================

  /**
   * 处理 AI SDK 流结果
   * @param aiSdkResult AI SDK 的流结果对象
   * @returns 最终的文本内容
   */
  async processStream(aiSdkResult: AiSdkStreamResult): Promise<string> {
    if (aiSdkResult.fullStream) {
      await this.readFullStream(aiSdkResult.fullStream);
    }
    return await aiSdkResult.text;
  }

  /**
   * 获取累积的文本
   */
  getAccumulatedText(): string {
    return this.accumulatedText;
  }

  /**
   * 获取累积的思考内容
   */
  getAccumulatedReasoning(): string {
    return this.accumulatedReasoning;
  }

  // ==================== 流处理核心 ====================

  /**
   * 读取 fullStream 并转换为 Chunk
   */
  private async readFullStream(fullStream: ReadableStream<AiSdkStreamPart>): Promise<void> {
    const reader = fullStream.getReader();
    const final = {
      text: '',
      reasoningContent: '',
      webSearchResults: [] as WebSearchResult[],
      reasoningId: ''
    };
    
    this.resetTimingState();
    this.responseStartTimestamp = Date.now();
    this.isFirstChunk = true;
    this.hasTextContent = false;

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }
        
        // 转换并发送 chunk
        this.convertAndEmitChunk(value, final);
      }
    } finally {
      reader.releaseLock();
      this.resetTimingState();
    }
  }

  /**
   * 转换 AI SDK chunk 为 Cherry Studio chunk 并调用回调
   * 参考 Cherry Studio convertAndEmitChunk 实现
   */
  private convertAndEmitChunk(
    chunk: AiSdkStreamPart,
    final: { 
      text: string; 
      reasoningContent: string; 
      webSearchResults: WebSearchResult[]; 
      reasoningId: string 
    }
  ): void {
    switch (chunk.type) {
      // === 文本相关事件 ===
      case 'text-start':
        this.emit({ type: ChunkType.TEXT_START });
        break;

      case 'text-delta': {
        this.hasTextContent = true;
        const processedText = chunk.text || '';
        
        if (this.accumulate) {
          final.text += processedText;
          this.accumulatedText = final.text;
        } else {
          final.text = processedText;
          this.accumulatedText += processedText;
        }

        if (processedText) {
          this.markFirstTokenIfNeeded();
          this.emit({
            type: ChunkType.TEXT_DELTA,
            text: this.accumulate ? final.text : processedText
          });
        }
        break;
      }

      case 'text-end':
        this.emit({
          type: ChunkType.TEXT_COMPLETE,
          text: (chunk.providerMetadata?.text?.value as string) ?? final.text ?? ''
        });
        final.text = '';
        break;

      // === 思考/推理相关事件 ===
      case 'reasoning-start':
        final.reasoningId = chunk.id;
        this.reasoningId = chunk.id;
        this.emit({ type: ChunkType.THINKING_START });
        break;

      case 'reasoning-delta':
        final.reasoningContent += chunk.text || '';
        this.accumulatedReasoning = final.reasoningContent;
        if (chunk.text) {
          this.markFirstTokenIfNeeded();
        }
        this.emit({
          type: ChunkType.THINKING_DELTA,
          text: final.reasoningContent || ''
        });
        break;

      case 'reasoning-end':
        this.emit({
          type: ChunkType.THINKING_COMPLETE,
          text: final.reasoningContent || ''
        });
        final.reasoningContent = '';
        break;

      // === 工具调用相关事件 ===
      case 'tool-call':
        this.handleToolCall(chunk);
        break;

      case 'tool-result':
        this.handleToolResult(chunk);
        break;

      case 'tool-error':
        this.handleToolError(chunk);
        break;

      // === 步骤完成事件 ===
      case 'finish-step': {
        const { providerMetadata, finishReason } = chunk;
        
        // 处理 Web 搜索结果
        if (final.webSearchResults.length > 0) {
          this.emit({
            type: ChunkType.LLM_WEB_SEARCH_COMPLETE,
            llm_web_search: {
              results: final.webSearchResults
            }
          });
          final.webSearchResults = [];
        }

        // 工具调用完成后，创建新的 LLM 响应
        if (finishReason === 'tool-calls') {
          this.emit({ type: ChunkType.LLM_RESPONSE_CREATED });
        }
        break;
      }

      // === 最终完成事件 ===
      case 'finish': {
        const usage = {
          completion_tokens: chunk.totalUsage?.outputTokens || 0,
          prompt_tokens: chunk.totalUsage?.inputTokens || 0,
          total_tokens: chunk.totalUsage?.totalTokens || 0
        };
        const metrics = this.buildMetrics(chunk.totalUsage);
        const baseResponse = {
          text: final.text || this.accumulatedText,
          reasoning_content: final.reasoningContent || this.accumulatedReasoning
        };

        this.emit({
          type: ChunkType.BLOCK_COMPLETE,
          response: {
            ...baseResponse,
            usage: { ...usage },
            metrics: metrics ? { ...metrics } : undefined
          }
        });

        this.emit({
          type: ChunkType.LLM_RESPONSE_COMPLETE,
          response: {
            ...baseResponse,
            usage: { ...usage },
            metrics: metrics ? { ...metrics } : undefined
          }
        });
        
        this.resetTimingState();
        break;
      }

      // === 搜索源事件 ===
      case 'source':
        if (chunk.sourceType === 'url' && chunk.url) {
          final.webSearchResults.push({
            url: chunk.url,
            title: chunk.title
          });
          this.webSearchResults = final.webSearchResults;
        }
        break;

      // === 文件事件（图片生成等）===
      case 'file':
        this.emit({
          type: ChunkType.IMAGE_COMPLETE,
          image: {
            type: 'base64',
            images: [`data:${chunk.file.mediaType};base64,${chunk.file.base64}`]
          }
        });
        break;

      // === 中止事件 ===
      case 'abort':
        this.emit({
          type: ChunkType.ERROR,
          error: { message: 'Request was aborted', type: 'AbortError' }
        });
        break;

      // === 错误事件 ===
      case 'error':
        this.emit({
          type: ChunkType.ERROR,
          error: { 
            message: chunk.error?.message || 'Unknown error',
            type: chunk.error?.name || 'Error'
          }
        });
        break;

      // === 原始数据事件 ===
      case 'raw':
        // 处理 session 更新等原始事件
        if (chunk.rawValue?.type === 'init' && chunk.rawValue?.session_id) {
          this.onSessionUpdate?.(chunk.rawValue.session_id);
        }
        break;

      default:
        // 未知事件类型，忽略
        break;
    }
  }

  // ==================== 工具调用处理 ====================

  private handleToolCall(chunk: { toolCallId: string; toolName: string; args: Record<string, any> }): void {
    // 查找匹配的 MCP 工具
    const mcpTool = this.mcpTools.find(t => t.name === chunk.toolName);
    
    this.emit({
      type: ChunkType.MCP_TOOL_IN_PROGRESS,
      responses: [{
        id: chunk.toolCallId,
        name: chunk.toolName,
        arguments: chunk.args,
        status: 'running',
        toolCallId: chunk.toolCallId,
        ...(mcpTool && { serverId: mcpTool.serverId })
      }]
    });
  }

  private handleToolResult(chunk: { toolCallId: string; result: any }): void {
    this.emit({
      type: ChunkType.MCP_TOOL_COMPLETE,
      responses: [{
        id: chunk.toolCallId,
        name: '',
        arguments: {},
        status: 'done',
        toolCallId: chunk.toolCallId,
        result: chunk.result
      }]
    });
  }

  private handleToolError(chunk: { toolCallId: string; error: any }): void {
    this.emit({
      type: ChunkType.MCP_TOOL_COMPLETE,
      responses: [{
        id: chunk.toolCallId,
        name: '',
        arguments: {},
        status: 'error',
        toolCallId: chunk.toolCallId,
        error: chunk.error
      }]
    });
  }

  // ==================== 辅助方法 ====================

  /**
   * 发送 Chunk 事件
   */
  private emit(chunk: Chunk): void {
    this.onChunk(chunk);
  }

  /**
   * 标记首个 token 时间
   */
  private markFirstTokenIfNeeded(): void {
    if (this.firstTokenTimestamp === null && this.responseStartTimestamp !== null) {
      this.firstTokenTimestamp = Date.now();
    }
  }

  /**
   * 重置计时状态
   */
  private resetTimingState(): void {
    this.responseStartTimestamp = null;
    this.firstTokenTimestamp = null;
  }

  /**
   * 构建性能指标
   */
  private buildMetrics(totalUsage?: {
    inputTokens?: number | null;
    outputTokens?: number | null;
    totalTokens?: number | null;
  }): StreamProcessResult['metrics'] | undefined {
    if (!totalUsage) {
      return undefined;
    }

    const completionTokens = totalUsage.outputTokens ?? 0;
    const now = Date.now();
    const start = this.responseStartTimestamp ?? now;
    const firstToken = this.firstTokenTimestamp;
    const timeFirstToken = Math.max(firstToken != null ? firstToken - start : 0, 0);
    const baseForCompletion = firstToken ?? start;
    let timeCompletion = Math.max(now - baseForCompletion, 0);

    if (timeCompletion === 0 && completionTokens > 0) {
      timeCompletion = 1;
    }

    return {
      completion_tokens: completionTokens,
      time_first_token_millsec: timeFirstToken,
      time_completion_millsec: timeCompletion
    };
  }

  /**
   * 重置所有状态
   */
  reset(): void {
    this.accumulatedText = '';
    this.accumulatedReasoning = '';
    this.webSearchResults = [];
    this.reasoningId = '';
    this.isFirstChunk = true;
    this.hasTextContent = false;
    this.resetTimingState();
  }
}

export default AiSdkToChunkAdapter;
