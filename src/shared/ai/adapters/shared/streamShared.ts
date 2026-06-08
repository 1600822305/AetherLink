/**
 * AI SDK 适配器共享流式工具（Phase 4 去重）
 *
 * 把三家 *-aisdk 的 stream.ts 中**逐字重复**的部分抽到这里（单一副本）：
 * ThinkTagParser、基础类型、供应商配置读取、工具调用累积、全局事件 emit、
 * 防幻觉 stopSequences。各家 stream.ts 的 fullStream 循环（推理/思考时机差异）
 * 仍保留在各自文件中——这是有意为之，不强行合并真差异。
 */
import { EventEmitter, EVENT_NAMES } from '../../../services/infra/EventEmitter';
import { hasToolUseTags } from '../../../utils/mcpToolParser';
import { ChunkType, type Chunk } from '../../../types/chunk';
import type { ReasoningTag } from '../../../config/reasoningTags';
import type { Model, MCPTool } from '../../../types';
import type { ModelProvider } from '../../../config/defaultModels';
import store from '../../../store';

/**
 * 解析推理标签内容
 * 支持动态配置的开始/结束标签
 */
export class ThinkTagParser {
  private contentBuffer = '';
  private isInThinkTag = false;
  private thinkBuffer = '';
  private reasoningStartTime = 0;
  private hasReasoningContent = false;
  private openingTag: string;
  private closingTag: string;

  constructor(tag?: ReasoningTag) {
    // 支持动态配置的推理标签
    this.openingTag = tag?.openingTag || '<think>';
    this.closingTag = tag?.closingTag || '</think>';
  }

  /**
   * 处理文本块
   * @returns { normalText: string, thinkText: string, isThinking: boolean }
   */
  processChunk(text: string): { normalText: string; thinkText: string; isThinking: boolean } {
    this.contentBuffer += text;

    let normalText = '';
    let thinkText = '';
    let processedAny = true;

    while (processedAny && this.contentBuffer.length > 0) {
      processedAny = false;

      if (!this.isInThinkTag) {
        // 查找开始标签
        const thinkStartIndex = this.contentBuffer.indexOf(this.openingTag);
        if (thinkStartIndex !== -1) {
          // 处理开始标签之前的普通内容
          normalText += this.contentBuffer.substring(0, thinkStartIndex);

          // 进入思考模式
          this.isInThinkTag = true;
          if (!this.hasReasoningContent) {
            this.hasReasoningContent = true;
            this.reasoningStartTime = Date.now();
          }

          this.contentBuffer = this.contentBuffer.substring(thinkStartIndex + this.openingTag.length);
          processedAny = true;
        } else if (this.contentBuffer.length > this.openingTag.length + 5) {
          // 没有找到开始标签，输出安全的内容
          const safeLength = this.contentBuffer.length - (this.openingTag.length + 5);
          const safeContent = this.contentBuffer.substring(0, safeLength);
          normalText += safeContent;
          this.contentBuffer = this.contentBuffer.substring(safeLength);
          processedAny = true;
        }
      } else {
        // 在思考标签内，查找结束标签
        const thinkEndIndex = this.contentBuffer.indexOf(this.closingTag);
        if (thinkEndIndex !== -1) {
          // 处理思考内容
          thinkText += this.contentBuffer.substring(0, thinkEndIndex);
          this.thinkBuffer += this.contentBuffer.substring(0, thinkEndIndex);

          // 退出思考模式
          this.isInThinkTag = false;
          this.contentBuffer = this.contentBuffer.substring(thinkEndIndex + this.closingTag.length);
          processedAny = true;
        } else if (this.contentBuffer.length > this.closingTag.length + 5) {
          // 没有找到结束标签，输出安全的思考内容
          const safeLength = this.contentBuffer.length - (this.closingTag.length + 5);
          const safeThinkContent = this.contentBuffer.substring(0, safeLength);
          thinkText += safeThinkContent;
          this.thinkBuffer += safeThinkContent;
          this.contentBuffer = this.contentBuffer.substring(safeLength);
          processedAny = true;
        }
      }
    }

    return { normalText, thinkText, isThinking: this.isInThinkTag };
  }

  /**
   * 流结束时处理剩余内容
   */
  flush(): { normalText: string; thinkText: string } {
    let normalText = '';
    let thinkText = '';

    if (this.contentBuffer.length > 0) {
      if (this.isInThinkTag) {
        thinkText = this.contentBuffer;
        this.thinkBuffer += this.contentBuffer;
      } else {
        normalText = this.contentBuffer;
      }
      this.contentBuffer = '';
    }

    return { normalText, thinkText };
  }

  getFullThinkContent(): string {
    return this.thinkBuffer;
  }

  getReasoningTime(): number {
    return this.hasReasoningContent ? Date.now() - this.reasoningStartTime : 0;
  }
}

/**
 * 流式响应结果基础类型（各家可 extends 扩展私有字段）
 */
export interface BaseStreamResult {
  content: string;
  reasoning?: string;
  reasoningTime?: number;
  hasToolCalls?: boolean;
  nativeToolCalls?: any[];
}

/**
 * 流式请求参数基础类型（各家可 extends 扩展私有字段）
 */
export interface BaseStreamParams {
  messages?: any[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  tools?: any[];
  tool_choice?: any;
  signal?: AbortSignal;
  enableTools?: boolean;
  mcpTools?: MCPTool[];
  mcpMode?: 'prompt' | 'function';
  model?: Model;
  /** 自定义请求体参数（优先级：模型级别 > 供应商级别） */
  extraBody?: Record<string, any>;
}

/**
 * 获取模型对应的供应商配置
 */
export function getProviderConfigFromStore(model: Model): ModelProvider | null {
  try {
    const state = store.getState();
    const providers = state.settings?.providers;

    if (!providers || !Array.isArray(providers)) {
      return null;
    }

    // 根据模型的 provider 字段查找对应的供应商
    const provider = providers.find((p: ModelProvider) => p.id === model.provider);
    return provider || null;
  } catch (error) {
    console.error('[AI SDK Stream] 获取供应商配置失败:', error);
    return null;
  }
}

/**
 * 累积一个 AI SDK `tool-call` part：推入 toolCalls 数组并发出 MCP_TOOL_CREATED。
 * @param opts.includeToolUseId 是否额外带 toolUseId 字段（Anthropic 需要）
 */
export function accumulateToolCall(
  part: any,
  toolCalls: any[],
  onChunk?: (chunk: Chunk) => void,
  opts?: { includeToolUseId?: boolean }
): void {
  // AI SDK v6 使用 input 而不是 args
  const toolInput = part.input || part.args || {};
  const entry: any = {
    id: part.toolCallId,
    type: 'function',
    function: {
      name: part.toolName,
      arguments: JSON.stringify(toolInput)
    }
  };
  if (opts?.includeToolUseId) {
    entry.toolUseId = part.toolCallId;
  }
  toolCalls.push(entry);

  // 使用 MCP_TOOL_CREATED 类型
  onChunk?.({
    type: ChunkType.MCP_TOOL_CREATED,
    responses: [{
      id: part.toolCallId,
      name: part.toolName,
      arguments: toolInput,
      status: 'pending'
    }]
  });
}

/**
 * 发送流式完成的全局事件
 */
export function emitStreamComplete(
  provider: string,
  modelId: string,
  content: string,
  reasoning: string
): void {
  EventEmitter.emit(EVENT_NAMES.STREAM_COMPLETE, {
    provider,
    model: modelId,
    content,
    reasoning,
    timestamp: Date.now()
  });
}

/**
 * 发送流式错误的全局事件
 */
export function emitStreamError(provider: string, modelId: string, error: any): void {
  EventEmitter.emit(EVENT_NAMES.STREAM_ERROR, {
    provider,
    model: modelId,
    error: error?.message,
    timestamp: Date.now()
  });
}

/**
 * 检查内容里的 XML 工具使用标签，命中则发出 TOOL_USE_DETECTED 全局事件
 */
export function detectAndEmitToolUseTags(content: string, modelId: string, logLabel: string): void {
  if (hasToolUseTags(content)) {
    console.log(`[${logLabel}] 检测到 XML 工具使用标签`);
    EventEmitter.emit(EVENT_NAMES.TOOL_USE_DETECTED, {
      content,
      model: modelId
    });
  }
}

/**
 * 🛡️ Prompt 模式防幻觉的 stop sequence
 * 当工具通过系统提示词注入（非原生函数调用）时，模型可能在 </tool_use> 后
 * 继续生成 <tool_use_result> 幻觉内容。添加 stop sequence 强制模型停止。
 */
export const PROMPT_MODE_STOP_SEQUENCES = ['<tool_use_result'];
