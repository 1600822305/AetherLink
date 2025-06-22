import { throttle } from 'lodash';
import store from '../../../store';
import { dexieStorage } from '../../storage/DexieStorageService';
import { MessageBlockStatus, MessageBlockType } from '../../../types/newMessage';
import type { MessageBlock } from '../../../types/newMessage';
import { newMessagesActions } from '../../../store/slices/newMessagesSlice';
import { updateOneBlock, addOneBlock } from '../../../store/slices/messageBlocksSlice';
import type { Chunk } from '../../../types/chunk';
import { ChunkType } from '../../../types/chunk';
import { v4 as uuid } from 'uuid';

/**
 * 响应块处理器 - 处理文本和思考块的逻辑
 */
export class ResponseChunkProcessor {
  private messageId: string;
  private blockId: string;
  private accumulatedContent = '';
  private accumulatedThinking = '';
  private thinkingBlockId: string | null = null;
  private mainTextBlockId: string | null = null;
  private lastBlockId: string | null;
  private lastBlockType: MessageBlockType | null = MessageBlockType.UNKNOWN;
  private throttledUpdateBlock: (blockId: string, changes: any) => void;
  private throttledReduxUpdate: (blockId: string, changes: any) => void;

  constructor(messageId: string, blockId: string) {
    this.messageId = messageId;
    this.blockId = blockId;
    this.lastBlockId = blockId;

    // 🚀 统一节流频率，避免不同步更新导致的抖动
    const UNIFIED_THROTTLE_INTERVAL = 100; // 统一使用100ms

    // 创建节流函数
    this.throttledUpdateBlock = throttle((blockId: string, changes: any) => {
      dexieStorage.updateMessageBlock(blockId, changes);
    }, UNIFIED_THROTTLE_INTERVAL);

    this.throttledReduxUpdate = throttle((blockId: string, changes: any) => {
      store.dispatch(updateOneBlock({ id: blockId, changes }));
    }, UNIFIED_THROTTLE_INTERVAL);
  }

  /**
   * 处理文本块
   */
  onTextChunk = (text: string) => {
    // 检查传入的text是否为增量文本还是完整文本
    let isIncrementalText = true;

    if (this.accumulatedContent.length > 0) {
      // 如果新文本包含已累积的内容，说明这是完整文本而不是增量
      if (text.includes(this.accumulatedContent)) {
        isIncrementalText = false;
        this.accumulatedContent = text; // 直接设置为完整文本
      } else {
        // 否则是增量文本，进行累积
        this.accumulatedContent += text;
      }
    } else {
      // 第一次接收文本，直接累积
      this.accumulatedContent += text;
    }

    // 移除频繁的文本块处理日志，只在开发环境且出现问题时输出
    if (process.env.NODE_ENV === 'development' && text.length === 0) {
      console.warn(`[ResponseChunkProcessor] 收到空文本块: 增量=${isIncrementalText}`);
    }

    if (this.lastBlockType === MessageBlockType.UNKNOWN) {
      // 第一次收到文本，转换占位符块为主文本块
      this.lastBlockType = MessageBlockType.MAIN_TEXT;
      this.mainTextBlockId = this.lastBlockId;

      const initialChanges = {
        type: MessageBlockType.MAIN_TEXT,
        content: this.accumulatedContent,
        status: MessageBlockStatus.STREAMING,
        updatedAt: new Date().toISOString()
      };

      // 立即更新Redux状态（转换操作）
      store.dispatch(updateOneBlock({ id: this.lastBlockId!, changes: initialChanges }));
      // 同时保存到数据库（使用节流）
      this.throttledUpdateBlock(this.lastBlockId!, initialChanges);
    } else if (this.lastBlockType === MessageBlockType.THINKING) {
      // 如果占位符块已经被转换为思考块，需要为普通文本创建新的块
      if (!this.mainTextBlockId) {
        // 创建新的主文本块
        const newMainTextBlock: MessageBlock = {
          id: uuid(),
          messageId: this.messageId,
          type: MessageBlockType.MAIN_TEXT,
          content: this.accumulatedContent,
          createdAt: new Date().toISOString(),
          status: MessageBlockStatus.STREAMING
        };

        this.mainTextBlockId = newMainTextBlock.id;

        // 添加到Redux状态
        store.dispatch(addOneBlock(newMainTextBlock));
        // 保存到数据库
        dexieStorage.saveMessageBlock(newMainTextBlock);

        // 将新块添加到消息的blocks数组
        store.dispatch(newMessagesActions.upsertBlockReference({
          messageId: this.messageId,
          blockId: this.mainTextBlockId!,
          status: MessageBlockStatus.STREAMING
        }));
      } else {
        // 更新现有的主文本块
        const blockChanges = {
          content: this.accumulatedContent,
          status: MessageBlockStatus.STREAMING,
          updatedAt: new Date().toISOString()
        };

        this.throttledReduxUpdate(this.mainTextBlockId, blockChanges);
        this.throttledUpdateBlock(this.mainTextBlockId, blockChanges);
      }
    } else if (this.lastBlockType === MessageBlockType.MAIN_TEXT && this.mainTextBlockId) {
      // 更新现有的主文本块
      const blockChanges = {
        content: this.accumulatedContent,
        status: MessageBlockStatus.STREAMING,
        updatedAt: new Date().toISOString()
      };

      this.throttledReduxUpdate(this.mainTextBlockId, blockChanges);
      this.throttledUpdateBlock(this.mainTextBlockId, blockChanges);
    }
  };

  /**
   * 处理思考块
   */
  onThinkingChunk = (text: string, thinking_millsec?: number) => {
    // 改进的内容处理逻辑：更精确地处理增量和累积内容
    if (text.length > this.accumulatedThinking.length && text.startsWith(this.accumulatedThinking)) {
      // 如果新文本包含已有内容且更长，说明是累积内容，直接设置
      this.accumulatedThinking = text;
    } else if (text !== this.accumulatedThinking) {
      // 检查是否为真正的增量内容
      if (this.accumulatedThinking.length === 0 || !this.accumulatedThinking.endsWith(text)) {
        // 如果是空的或者不是重复的尾部内容，则累加
        this.accumulatedThinking += text;
      } else {
        // 跳过重复内容
        return;
      }
    } else {
      // 跳过完全相同的内容
      return;
    }

    if (this.lastBlockId) {
      if (this.lastBlockType === MessageBlockType.UNKNOWN) {
        // 第一次收到思考内容，转换占位符块为思考块（立即执行，不节流）
        this.lastBlockType = MessageBlockType.THINKING;
        this.thinkingBlockId = this.lastBlockId;

        const initialChanges = {
          type: MessageBlockType.THINKING,
          content: this.accumulatedThinking,
          status: MessageBlockStatus.STREAMING,
          thinking_millsec: thinking_millsec || 0,
          updatedAt: new Date().toISOString()
        };

        // 立即更新Redux状态（转换操作）
        store.dispatch(updateOneBlock({ id: this.lastBlockId, changes: initialChanges }));
        // 同时保存到数据库（使用节流）
        this.throttledUpdateBlock(this.lastBlockId, initialChanges);
      } else if (this.lastBlockType === MessageBlockType.THINKING) {
        // 后续思考内容更新，使用节流更新Redux和数据库
        const blockChanges = {
          content: this.accumulatedThinking,
          status: MessageBlockStatus.STREAMING,
          thinking_millsec: thinking_millsec || 0,
          updatedAt: new Date().toISOString()
        };

        // 使用节流更新Redux状态，避免过度渲染
        this.throttledReduxUpdate(this.lastBlockId, blockChanges);
        // 使用节流更新数据库
        this.throttledUpdateBlock(this.lastBlockId, blockChanges);
      }
    }
  };

  /**
   * 处理基于 Chunk 事件的文本和思考块
   */
  async handleChunkEvent(chunk: Chunk) {
    try {
      switch (chunk.type) {
        case ChunkType.THINKING_DELTA:
          const thinkingDelta = chunk as import('../../../types/chunk').ThinkingDeltaChunk;
          this.onThinkingChunk(thinkingDelta.text, thinkingDelta.thinking_millsec);
          break;

        case ChunkType.THINKING_COMPLETE:
          const thinkingComplete = chunk as import('../../../types/chunk').ThinkingCompleteChunk;
          // 对于完成事件，直接设置完整的思考内容，不调用增量回调
          this.accumulatedThinking = thinkingComplete.text;

          // 直接处理思考块转换，不使用增量回调
          if (this.lastBlockId && this.lastBlockType === MessageBlockType.UNKNOWN) {
            // 第一次收到思考内容，转换占位符块为思考块
            this.lastBlockType = MessageBlockType.THINKING;
            this.thinkingBlockId = this.lastBlockId;

            const initialChanges = {
              type: MessageBlockType.THINKING,
              content: this.accumulatedThinking,
              status: MessageBlockStatus.STREAMING,
              thinking_millsec: thinkingComplete.thinking_millsec || 0,
              updatedAt: new Date().toISOString()
            };

            console.log(`[ResponseChunkProcessor] 将占位符块 ${this.blockId} 转换为思考块（完成事件）`);

            // 立即更新Redux状态
            store.dispatch(updateOneBlock({ id: this.lastBlockId, changes: initialChanges }));
            // 同时保存到数据库
            this.throttledUpdateBlock(this.lastBlockId, initialChanges);
          }
          break;

        case ChunkType.TEXT_DELTA:
          const textDelta = chunk as import('../../../types/chunk').TextDeltaChunk;
          this.onTextChunk(textDelta.text);
          break;

        case ChunkType.TEXT_COMPLETE:
          const textComplete = chunk as import('../../../types/chunk').TextCompleteChunk;
          console.log(`[ResponseChunkProcessor] 处理文本完成，总长度: ${textComplete.text.length}`);

          // 关键修复：检查是否需要追加内容而不是覆盖
          if (this.accumulatedContent.trim() && !textComplete.text.includes(this.accumulatedContent)) {
            // 如果已有内容且新内容不包含旧内容，则追加
            const separator = '\n\n';
            this.accumulatedContent = this.accumulatedContent + separator + textComplete.text;
            console.log(`[ResponseChunkProcessor] 追加文本内容，累积长度: ${this.accumulatedContent.length}`);
          } else {
            // 否则直接设置（第一次或新内容已包含旧内容）
            this.accumulatedContent = textComplete.text;
            console.log(`[ResponseChunkProcessor] 设置文本内容，长度: ${this.accumulatedContent.length}`);
          }

          // 直接处理文本块转换，不使用增量回调
          if (this.lastBlockType === MessageBlockType.UNKNOWN) {
            // 第一次收到文本，转换占位符块为主文本块
            this.lastBlockType = MessageBlockType.MAIN_TEXT;
            this.mainTextBlockId = this.lastBlockId;

            const initialChanges = {
              type: MessageBlockType.MAIN_TEXT,
              content: this.accumulatedContent,
              status: MessageBlockStatus.STREAMING,
              updatedAt: new Date().toISOString()
            };

            console.log(`[ResponseChunkProcessor] 将占位符块 ${this.blockId} 转换为主文本块（完成事件）`);

            // 立即更新Redux状态
            store.dispatch(updateOneBlock({ id: this.lastBlockId!, changes: initialChanges }));
            // 同时保存到数据库
            this.throttledUpdateBlock(this.lastBlockId!, initialChanges);
          } else if (this.lastBlockType === MessageBlockType.THINKING) {
            // 如果占位符块已经被转换为思考块，需要为普通文本创建新的块
            if (!this.mainTextBlockId) {
              // 创建新的主文本块
              const newMainTextBlock: MessageBlock = {
                id: uuid(),
                messageId: this.messageId,
                type: MessageBlockType.MAIN_TEXT,
                content: this.accumulatedContent,
                createdAt: new Date().toISOString(),
                status: MessageBlockStatus.STREAMING
              };

              this.mainTextBlockId = newMainTextBlock.id;

              console.log(`[ResponseChunkProcessor] 创建新的主文本块 ${this.mainTextBlockId}（完成事件）`);

              // 添加到Redux状态
              store.dispatch(addOneBlock(newMainTextBlock));
              // 保存到数据库
              dexieStorage.saveMessageBlock(newMainTextBlock);

              // 将新块添加到消息的blocks数组
              store.dispatch(newMessagesActions.upsertBlockReference({
                messageId: this.messageId,
                blockId: this.mainTextBlockId,
                status: MessageBlockStatus.STREAMING
              }));
            }
          }
          break;

        default:
          // 其他类型的chunk由其他处理器处理
          break;
      }
    } catch (error) {
      console.error(`[ResponseChunkProcessor] 处理 chunk 事件失败:`, error);
    }
  }

  // Getter 方法
  get content() { return this.accumulatedContent; }
  get thinking() { return this.accumulatedThinking; }
  get blockType() { return this.lastBlockType; }
  get textBlockId() { return this.mainTextBlockId; }
  get thinkingId() { return this.thinkingBlockId; }
  get currentBlockId() { return this.lastBlockId; }
}
