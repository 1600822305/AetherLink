import { throttle } from 'lodash';
import { MessageBlockStatus, MessageBlockType } from '../../../types/newMessage';
import type { MessageBlock } from '../../../types/newMessage';
import type { Chunk, TextDeltaChunk, TextCompleteChunk, ThinkingDeltaChunk, ThinkingCompleteChunk } from '../../../types/chunk';
import { ChunkType } from '../../../types/chunk';
import { v4 as uuid } from 'uuid';

// 1. 定义服务接口，便于测试和解耦
interface StorageService {
  updateBlock(blockId: string, changes: any): Promise<void>;
  saveBlock(block: MessageBlock): Promise<void>;
}

interface StateService {
  updateBlock(blockId: string, changes: any): void;
  addBlock(block: MessageBlock): void;
  addBlockReference(messageId: string, blockId: string, status: MessageBlockStatus): void;
}

// 1. 抽象内容累积器
abstract class ContentAccumulator {
  protected content = '';

  abstract accumulate(newContent: string): void;

  getContent(): string {
    return this.content;
  }

  clear(): void {
    this.content = '';
  }
}

// 2. 文本累积器
class TextAccumulator extends ContentAccumulator {
  accumulate(newText: string): void {
    if (this.content.length > 0 && newText.includes(this.content)) {
      // 完整文本替换
      this.content = newText;
    } else {
      // 增量文本追加
      this.content += newText;
    }
  }
}

// 3. 思考内容累积器
class ThinkingAccumulator extends ContentAccumulator {
  accumulate(newText: string): void {
    if (newText.length > this.content.length && newText.startsWith(this.content)) {
      this.content = newText;
    } else if (newText !== this.content && !this.content.endsWith(newText)) {
      this.content += newText;
    }
  }
}

// 4. 改进的块更新器 - 完全依赖注入
interface BlockUpdater {
  updateBlock(blockId: string, changes: any): Promise<void>;
  createBlock(block: MessageBlock): Promise<void>;
}

class ThrottledBlockUpdater implements BlockUpdater {
  private throttledStorageUpdate: (blockId: string, changes: any) => void;
  private throttledStateUpdate: (blockId: string, changes: any) => void;

  constructor(
    private stateService: StateService,
    private storageService: StorageService,
    throttleInterval: number
  ) {
    console.log('[ThrottledBlockUpdater] 创建节流更新器，间隔:', throttleInterval + 'ms');

    this.throttledStorageUpdate = throttle(
      (blockId: string, changes: any) => storageService.updateBlock(blockId, changes),
      throttleInterval
    );

    // 🚀 关键修复：Redux状态更新也使用节流
    this.throttledStateUpdate = throttle(
      (blockId: string, changes: any) => {
        console.log('[ThrottledBlockUpdater] 节流更新Redux状态');
        stateService.updateBlock(blockId, changes);
      },
      throttleInterval
    );
  }

  async updateBlock(blockId: string, changes: any): Promise<void> {
    // 🚀 修复：状态更新也使用节流，控制UI更新频率
    this.throttledStateUpdate(blockId, changes);
    // 存储更新使用节流（性能优化）
    this.throttledStorageUpdate(blockId, changes);
  }

  async createBlock(block: MessageBlock): Promise<void> {
    // 创建操作不需要节流
    this.stateService.addBlock(block);
    await this.storageService.saveBlock(block);
    this.stateService.addBlockReference(block.messageId, block.id, block.status);
  }
}

// 5. 简化的块状态管理器 - 使用状态机模式
enum BlockState {
  INITIAL = 'initial',
  TEXT_ONLY = 'text_only',
  THINKING_ONLY = 'thinking_only',
  BOTH = 'both'
}

class BlockStateManager {
  private state: BlockState = BlockState.INITIAL;
  private readonly initialBlockId: string;
  private textBlockId: string | null = null;
  private thinkingBlockId: string | null = null;

  constructor(initialBlockId: string) {
    this.initialBlockId = initialBlockId;
  }

  // 状态转换方法
  transitionToText(): { blockId: string; isNewBlock: boolean } {
    switch (this.state) {
      case BlockState.INITIAL:
        this.state = BlockState.TEXT_ONLY;
        this.textBlockId = this.initialBlockId;
        return { blockId: this.initialBlockId, isNewBlock: false };

      case BlockState.THINKING_ONLY:
        this.state = BlockState.BOTH;
        this.textBlockId = uuid();
        return { blockId: this.textBlockId, isNewBlock: true };

      default:
        return { blockId: this.textBlockId!, isNewBlock: false };
    }
  }

  transitionToThinking(): { blockId: string; isNewBlock: boolean } {
    switch (this.state) {
      case BlockState.INITIAL:
        this.state = BlockState.THINKING_ONLY;
        this.thinkingBlockId = this.initialBlockId;
        return { blockId: this.initialBlockId, isNewBlock: false };

      default:
        return { blockId: this.thinkingBlockId!, isNewBlock: false };
    }
  }

  getTextBlockId(): string | null { return this.textBlockId; }
  getThinkingBlockId(): string | null { return this.thinkingBlockId; }
  getInitialBlockId(): string { return this.initialBlockId; }
  getCurrentState(): BlockState { return this.state; }
}

// 6. 主处理器 - 更简洁的逻辑
export class ResponseChunkProcessor {
  private readonly textAccumulator = new TextAccumulator();
  private readonly thinkingAccumulator = new ThinkingAccumulator();
  private readonly blockStateManager: BlockStateManager;
  private readonly blockUpdater: BlockUpdater;

  constructor(
    private readonly messageId: string,
    blockId: string,
    stateService: StateService,
    storageService: StorageService,
    throttleInterval: number
  ) {
    this.blockStateManager = new BlockStateManager(blockId);
    this.blockUpdater = new ThrottledBlockUpdater(stateService, storageService, throttleInterval);
  }

  async handleChunk(chunk: Chunk): Promise<void> {
    if (!chunk) {
      throw new Error('Chunk 不能为空');
    }

    try {
      switch (chunk.type) {
        case ChunkType.TEXT_DELTA:
          await this.handleTextDelta(chunk as TextDeltaChunk);
          break;
        case ChunkType.TEXT_COMPLETE:
          await this.handleTextComplete(chunk as TextCompleteChunk);
          break;
        case ChunkType.THINKING_DELTA:
          await this.handleThinkingDelta(chunk as ThinkingDeltaChunk);
          break;
        case ChunkType.THINKING_COMPLETE:
          await this.handleThinkingComplete(chunk as ThinkingCompleteChunk);
          break;
        default:
          console.warn(`[ResponseChunkProcessor] 未知的 chunk 类型: ${chunk.type}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      console.error(`[ResponseChunkProcessor] 处理 ${chunk.type} 失败: ${errorMessage}`, error);
      throw new Error(`处理 chunk 失败: ${errorMessage}`);
    }
  }



  private async handleTextDelta(chunk: TextDeltaChunk): Promise<void> {
    this.textAccumulator.accumulate(chunk.text);
    await this.processTextContent();
  }

  private async handleTextComplete(chunk: TextCompleteChunk): Promise<void> {
    this.textAccumulator.accumulate(chunk.text);
    await this.processTextContent();
  }

  private async handleThinkingDelta(chunk: ThinkingDeltaChunk): Promise<void> {
    this.thinkingAccumulator.accumulate(chunk.text);
    await this.processThinkingContent(chunk.thinking_millsec);
  }

  private async handleThinkingComplete(chunk: ThinkingCompleteChunk): Promise<void> {
    this.thinkingAccumulator.accumulate(chunk.text);
    await this.processThinkingContent(chunk.thinking_millsec);
  }

  private async processTextContent(): Promise<void> {
    const { blockId, isNewBlock } = this.blockStateManager.transitionToText();

    if (isNewBlock) {
      await this.createTextBlock(blockId);
    } else {
      await this.updateTextBlock(blockId);
    }
  }

  private async processThinkingContent(thinkingMillsec?: number): Promise<void> {
    const { blockId } = this.blockStateManager.transitionToThinking();
    await this.updateThinkingBlock(blockId, thinkingMillsec);
  }

  private async createTextBlock(blockId: string): Promise<void> {
    const block: MessageBlock = {
      id: blockId,
      messageId: this.messageId,
      type: MessageBlockType.MAIN_TEXT,
      content: this.textAccumulator.getContent(),
      createdAt: new Date().toISOString(),
      status: MessageBlockStatus.STREAMING
    };
    await this.blockUpdater.createBlock(block);
  }

  private async updateTextBlock(blockId: string): Promise<void> {
    const changes = {
      type: MessageBlockType.MAIN_TEXT,
      content: this.textAccumulator.getContent(),
      status: MessageBlockStatus.STREAMING,
      updatedAt: new Date().toISOString()
    };
    await this.blockUpdater.updateBlock(blockId, changes);
  }

  private async updateThinkingBlock(blockId: string, thinkingMillsec?: number): Promise<void> {
    const changes = {
      type: MessageBlockType.THINKING,
      content: this.thinkingAccumulator.getContent(),
      status: MessageBlockStatus.STREAMING,
      thinking_millsec: thinkingMillsec || 0,
      updatedAt: new Date().toISOString()
    };
    await this.blockUpdater.updateBlock(blockId, changes);
  }

  // Getters
  get content(): string { return this.textAccumulator.getContent(); }
  get thinking(): string { return this.thinkingAccumulator.getContent(); }
  get textBlockId(): string | null { return this.blockStateManager.getTextBlockId(); }
  get thinkingId(): string | null { return this.blockStateManager.getThinkingBlockId(); }
  get currentBlockId(): string { return this.blockStateManager.getInitialBlockId(); }
  get blockType(): string {
    const state = this.blockStateManager.getCurrentState();
    switch (state) {
      case BlockState.THINKING_ONLY:
        return MessageBlockType.THINKING;
      case BlockState.TEXT_ONLY:
        return MessageBlockType.MAIN_TEXT;
      case BlockState.BOTH:
        // 当有两种类型时，返回思考块类型，因为主要块是思考块
        return MessageBlockType.THINKING;
      default:
        return MessageBlockType.MAIN_TEXT; // 默认为主文本块
    }
  }
}

// 7. 工厂函数，封装依赖注入的复杂性
export function createResponseChunkProcessor(
  messageId: string,
  blockId: string,
  store: any,
  storage: any,
  actions: any,
  throttleInterval: number
): ResponseChunkProcessor {
  const stateService: StateService = {
    updateBlock: (blockId, changes) => store.dispatch(actions.updateOneBlock({ id: blockId, changes })),
    addBlock: (block) => store.dispatch(actions.addOneBlock(block)),
    addBlockReference: (messageId, blockId, status) =>
      store.dispatch(actions.upsertBlockReference({ messageId, blockId, status }))
  };

  const storageService: StorageService = {
    updateBlock: (blockId, changes) => storage.updateMessageBlock(blockId, changes),
    saveBlock: (block) => storage.saveMessageBlock(block)
  };

  return new ResponseChunkProcessor(messageId, blockId, stateService, storageService, throttleInterval);
}
