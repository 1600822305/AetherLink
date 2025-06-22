import store from '../../store';
import { EventEmitter } from '../EventService';
import { AssistantMessageStatus } from '../../types/newMessage';
import { newMessagesActions } from '../../store/slices/newMessagesSlice';
import { addOneBlock, updateOneBlock } from '../../store/slices/messageBlocksSlice';
import type { Chunk } from '../../types/chunk';
import { ChunkType } from '../../types/chunk';
import { MessageBlockType, MessageBlockStatus } from '../../types/newMessage';
import { v4 as uuidv4 } from 'uuid';

/**
 * OpenAI Responses API 响应处理器配置类型
 */
type OpenAIResponseHandlerConfig = {
  messageId: string;
  blockId: string;
  topicId: string;
};

/**
 * OpenAI Responses API 响应处理器
 * 专门处理 OpenAI Responses API 的移动端响应流
 */
export class OpenAIResponseHandler {
  private messageId: string;
  private blockId: string;
  private topicId: string;
  private currentContent: string = '';
  private thinkingContent: string = '';
  private toolBlocks: Map<string, string> = new Map(); // toolId -> blockId

  constructor(config: OpenAIResponseHandlerConfig) {
    this.messageId = config.messageId;
    this.blockId = config.blockId;
    this.topicId = config.topicId;
  }

  /**
   * 处理响应块
   */
  public handleChunk(chunk: Chunk): void {
    try {
      switch (chunk.type) {
        case ChunkType.LLM_RESPONSE_CREATED:
          this.handleResponseCreated();
          break;

        case ChunkType.TEXT_DELTA:
          this.handleTextDelta(chunk);
          break;

        case ChunkType.TEXT_COMPLETE:
          this.handleTextComplete(chunk);
          break;

        case ChunkType.THINKING_DELTA:
          this.handleThinkingDelta(chunk);
          break;

        case ChunkType.THINKING_COMPLETE:
          this.handleThinkingComplete(chunk);
          break;

        case ChunkType.MCP_TOOL_IN_PROGRESS:
          this.handleToolInProgress(chunk);
          break;

        case ChunkType.MCP_TOOL_COMPLETE:
          this.handleToolComplete(chunk);
          break;

        case ChunkType.LLM_RESPONSE_COMPLETE:
          this.handleResponseComplete();
          break;

        case ChunkType.ERROR:
          this.handleError(chunk);
          break;

        default:
          console.log(`[OpenAIResponseHandler] 未处理的块类型: ${chunk.type}`);
      }
    } catch (error) {
      console.error('[OpenAIResponseHandler] 处理响应块失败:', error);
      this.handleError({
        type: ChunkType.ERROR,
        error: {
          message: error instanceof Error ? error.message : '响应处理失败',
          type: 'handler_error'
        }
      });
    }
  }

  /**
   * 处理响应创建
   */
  private handleResponseCreated(): void {
    // 更新消息状态为流式处理中
    store.dispatch(newMessagesActions.updateMessageStatus({
      topicId: this.topicId,
      messageId: this.messageId,
      status: AssistantMessageStatus.STREAMING
    }));

    // 创建主文本块
    store.dispatch(addOneBlock({
      id: this.blockId,
      messageId: this.messageId,
      type: MessageBlockType.MAIN_TEXT,
      status: MessageBlockStatus.STREAMING,
      content: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }));

    // 发送事件
    EventEmitter.emit('ASSISTANT_MESSAGE_STARTED', {
      messageId: this.messageId,
      topicId: this.topicId
    });
  }

  /**
   * 处理文本增量
   */
  private handleTextDelta(chunk: any): void {
    this.currentContent += chunk.text;

    // 更新主文本块内容
    store.dispatch(updateOneBlock({
      id: this.blockId,
      changes: {
        content: this.currentContent,
        status: MessageBlockStatus.STREAMING,
        updatedAt: new Date().toISOString()
      }
    }));

    // 发送流式更新事件
    EventEmitter.emit('ASSISTANT_MESSAGE_STREAMING', {
      messageId: this.messageId,
      topicId: this.topicId,
      content: this.currentContent,
      delta: chunk.text
    });
  }

  /**
   * 处理文本完成
   */
  private handleTextComplete(chunk: any): void {
    // 更新主文本块状态为成功
    store.dispatch(updateOneBlock({
      id: this.blockId,
      changes: {
        content: chunk.text || this.currentContent,
        status: MessageBlockStatus.SUCCESS,
        updatedAt: new Date().toISOString()
      }
    }));
  }

  /**
   * 处理思考增量
   */
  private handleThinkingDelta(chunk: any): void {
    this.thinkingContent += chunk.text;

    // 查找或创建思考块
    let thinkingBlockId = this.findThinkingBlock();
    if (!thinkingBlockId) {
      thinkingBlockId = uuidv4();
      this.createThinkingBlock(thinkingBlockId);
    }

    // 更新思考块内容
    store.dispatch(updateOneBlock({
      id: thinkingBlockId,
      changes: {
        content: this.thinkingContent,
        status: MessageBlockStatus.STREAMING,
        updatedAt: new Date().toISOString()
      }
    }));
  }

  /**
   * 处理思考完成
   */
  private handleThinkingComplete(chunk: any): void {
    const thinkingBlockId = this.findThinkingBlock();
    if (thinkingBlockId) {
      store.dispatch(updateOneBlock({
        id: thinkingBlockId,
        changes: {
          content: chunk.text || this.thinkingContent,
          status: MessageBlockStatus.SUCCESS,
          updatedAt: new Date().toISOString()
        }
      }));
    }
  }

  /**
   * 处理工具调用进行中
   */
  private handleToolInProgress(chunk: any): void {
    if (chunk.responses && Array.isArray(chunk.responses)) {
      chunk.responses.forEach((toolCall: any) => {
        const toolBlockId = uuidv4();
        this.toolBlocks.set(toolCall.id || toolCall.name, toolBlockId);

        // 创建工具块
        store.dispatch(addOneBlock({
          id: toolBlockId,
          messageId: this.messageId,
          type: MessageBlockType.TOOL,
          status: MessageBlockStatus.PROCESSING,
          toolId: toolCall.id || toolCall.name,
          toolName: toolCall.function?.name || toolCall.name,
          arguments: toolCall.function?.arguments || toolCall.input,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }));

        // 更新消息的块列表
        this.addBlockToMessage(toolBlockId);
      });
    }
  }

  /**
   * 处理工具调用完成
   */
  private handleToolComplete(chunk: any): void {
    if (chunk.responses && Array.isArray(chunk.responses)) {
      chunk.responses.forEach((toolResult: any) => {
        const toolBlockId = this.toolBlocks.get(toolResult.id || toolResult.name);
        if (toolBlockId) {
          store.dispatch(updateOneBlock({
            id: toolBlockId,
            changes: {
              content: toolResult.result || toolResult.response,
              status: MessageBlockStatus.SUCCESS,
              updatedAt: new Date().toISOString()
            }
          }));
        }
      });
    }
  }

  /**
   * 处理响应完成
   */
  private handleResponseComplete(): void {
    // 更新消息状态为成功
    store.dispatch(newMessagesActions.updateMessageStatus({
      topicId: this.topicId,
      messageId: this.messageId,
      status: AssistantMessageStatus.SUCCESS
    }));

    // 发送完成事件
    EventEmitter.emit('ASSISTANT_MESSAGE_COMPLETED', {
      messageId: this.messageId,
      topicId: this.topicId,
      content: this.currentContent
    });
  }

  /**
   * 处理错误
   */
  private handleError(chunk: any): void {
    const errorBlockId = uuidv4();

    // 创建错误块
    store.dispatch(addOneBlock({
      id: errorBlockId,
      messageId: this.messageId,
      type: MessageBlockType.ERROR,
      status: MessageBlockStatus.ERROR,
      content: chunk.error?.message || '发生错误',
      error: chunk.error,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }));

    // 更新消息状态为错误
    store.dispatch(newMessagesActions.updateMessageStatus({
      topicId: this.topicId,
      messageId: this.messageId,
      status: AssistantMessageStatus.ERROR
    }));

    // 添加错误块到消息
    this.addBlockToMessage(errorBlockId);

    // 发送错误事件
    EventEmitter.emit('ASSISTANT_MESSAGE_ERROR', {
      messageId: this.messageId,
      topicId: this.topicId,
      error: chunk.error
    });
  }

  /**
   * 查找思考块
   */
  private findThinkingBlock(): string | null {
    const state = store.getState();
    const message = state.messages.entities[this.messageId];
    if (!message?.blocks) return null;

    for (const blockId of message.blocks) {
      const block = state.messageBlocks.entities[blockId];
      if (block?.type === MessageBlockType.THINKING) {
        return blockId;
      }
    }
    return null;
  }

  /**
   * 创建思考块
   */
  private createThinkingBlock(blockId: string): void {
    store.dispatch(addOneBlock({
      id: blockId,
      messageId: this.messageId,
      type: MessageBlockType.THINKING,
      status: MessageBlockStatus.STREAMING,
      content: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }));

    this.addBlockToMessage(blockId);
  }

  /**
   * 添加块到消息
   */
  private addBlockToMessage(blockId: string): void {
    store.dispatch(newMessagesActions.upsertBlockReference({
      messageId: this.messageId,
      blockId
    }));
  }
}
