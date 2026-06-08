import { throttle } from 'lodash';
import { LRUCache } from 'lru-cache';
import { MessageBlockStatus, MessageBlockType } from '../../../types/newMessage';
import type { MessageBlock } from '../../../types/newMessage';
import type { Chunk, TextDeltaChunk, TextCompleteChunk, ThinkingDeltaChunk, ThinkingCompleteChunk } from '../../../types/chunk';
import { ChunkType } from '../../../types/chunk';
import { v4 as uuid } from 'uuid';
import { EventEmitter, EVENT_NAMES } from '../../infra/EventService';

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

/**
 * ResponseChunkProcessor 暴露给「完成处理器」(ResponseCompletionHandler) 的只读视图。
 *
 * 用于取代完成处理器里散落的 `chunkProcessor: any`：完成阶段只需要读取累积内容/块ID
 * 等少量公开成员，这里把这层契约显式化，让编译器帮忙守约定（ResponseChunkProcessor
 * 结构上即满足本接口）。
 */
export interface ChunkProcessorView {
  /** 当前累积的主文本内容 */
  readonly content: string;
  /** 当前累积的思考内容 */
  readonly thinking: string;
  /** 流式新建的主文本块ID（未新建时为 null） */
  readonly textBlockId: string | null;
  /** 思考块ID（未创建时为 null） */
  readonly thinkingId: string | null;
  /** 思考耗时（毫秒），无思考时为 undefined */
  readonly thinkingDurationMs: number | undefined;
  /** 当前块状态机所处的块类型 */
  readonly blockType: string;
  /** 非流式响应手动建块后回填文本块ID */
  setTextBlockId(blockId: string): void;
  /**
   * 取消所有待处理的节流/RAF 块更新。
   * 中断/出错收尾前必须调用：否则迟到的节流 trailing + requestAnimationFrame
   * 会在 finalize 之后把块重新写回 streaming，导致思考计时「死灰复燃」。
   */
  cancelPendingUpdates(): void;
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

// 2. 文本累积器（简化版 - 供应商已发送累积内容）
class TextAccumulator extends ContentAccumulator {
  accumulate(newText: string): void {
    // 防御性检查：确保输入是字符串
    if (typeof newText !== 'string') {
      console.warn('[TextAccumulator] 输入不是字符串，跳过:', typeof newText);
      return;
    }
    // 供应商已发送累积内容，直接替换即可
    this.content = newText;
  }
}

// 3. 思考内容累积器（简化版 - 供应商已发送累积内容）
class ThinkingAccumulator extends ContentAccumulator {
  accumulate(newText: string): void {
    // 防御性检查：确保输入是字符串
    if (typeof newText !== 'string') {
      console.warn('[ThinkingAccumulator] 输入不是字符串，跳过:', typeof newText);
      return;
    }
    // 供应商已发送累积内容，直接替换即可
    this.content = newText;
  }
}

// 4. 改进的块更新器 - 智能更新策略

/**
 * 活跃块信息（参考 Cherry Studio）
 * 用于追踪当前正在流式输出的块
 */
interface ActiveBlockInfo {
  id: string;
  type: MessageBlockType;
}

interface BlockUpdater {
  updateBlock(blockId: string, changes: any, blockType: MessageBlockType, isComplete?: boolean): void;
  createBlock(block: MessageBlock): void;
}

/**
 * 智能节流块更新器 (参考 Cherry Studio 设计)
 * 
 * 核心设计：
 * 1. 每个块有独立的节流器（LRUCache 管理，防止内存泄漏）
 * 2. 使用 requestAnimationFrame 优化 UI 更新（与浏览器渲染周期同步）
 * 3. UI 更新和数据库更新分离
 * 4. 支持单个块的取消操作
 * 
 * 更新策略：
 * - 块类型变化时：取消前一个块的节流，立即更新
 * - 同类型连续更新：节流更新
 * - 块完成时：取消节流，立即更新
 */
class SmartThrottledBlockUpdater implements BlockUpdater {
  // 每个块独立的节流器（参考 Cherry Studio）
  private blockThrottlers = new LRUCache<string, ReturnType<typeof throttle>>({
    max: 100,           // 最多管理 100 个块的节流器
    ttl: 1000 * 60 * 5, // 5分钟后自动清理不活跃的节流器
  });

  // RAF (requestAnimationFrame) 缓存，用于管理 UI 更新调度
  private blockRafs = new LRUCache<string, number>({max: 100,
    ttl: 1000 * 60 * 5,
  });

  // ⭐ 活跃块追踪（参考 Cherry Studio）
  // 区别于 lastBlockId/Type：完成后清空，表示“当前正在处理的块”
  private _activeBlockInfo: ActiveBlockInfo | null = null;
  
  // 保留 lastBlockType 用于块类型变化检测
  private _lastBlockType: MessageBlockType | null = null;
  private throttleInterval: number;

  constructor(
    private stateService: StateService,
    private storageService: StorageService,
    throttleInterval: number
  ) {
    this.throttleInterval = throttleInterval;
  }

  // ========== Getters ==========
  
  /**
   * 获取当前活跃块信息
   * 用于错误处理、完成处理时找到正确的块
   */
  get activeBlockInfo(): ActiveBlockInfo | null {
    return this._activeBlockInfo;
  }

  /**
   * 获取上一个块类型（用于块类型变化检测）
   */
  get lastBlockType(): MessageBlockType | null {
    return this._lastBlockType;
  }

  /**
   * 是否有活跃块
   */
  get hasActiveBlock(): boolean {
    return this._activeBlockInfo !== null;
  }

  /**
   * 获取活跃块 ID
   */
  get activeBlockId(): string | null {
    return this._activeBlockInfo?.id || null;
  }

  /**
   * 获取活跃块类型
   */
  get activeBlockType(): MessageBlockType | null {
    return this._activeBlockInfo?.type || null;
  }

  // ========== Setters ==========
  
  /**
   * 设置活跃块信息（供外部手动设置）
   */
  set activeBlockInfo(value: ActiveBlockInfo | null) {
    this._activeBlockInfo = value;
  }

  /**
   * 获取或创建块专用的节流函数
   */
  private getBlockThrottler(blockId: string): ReturnType<typeof throttle> {
    if (!this.blockThrottlers.has(blockId)) {
      const throttler = throttle(
        async (changes: any) => {
          // 取消之前的 RAF
          const existingRAF = this.blockRafs.get(blockId);
          if (existingRAF) {
            cancelAnimationFrame(existingRAF);
          }

          // ⭐ 使用 requestAnimationFrame 调度 UI 更新
          // 确保与浏览器渲染周期同步，减少不必要的重绘
          const rafId = requestAnimationFrame(() => {
            this.stateService.updateBlock(blockId, changes);
            this.blockRafs.delete(blockId);
          });

          this.blockRafs.set(blockId, rafId);

          // 数据库更新（不受 RAF 影响，独立执行）
          await this.storageService.updateBlock(blockId, changes);
        },
        this.throttleInterval
      );

      this.blockThrottlers.set(blockId, throttler);
    }

    return this.blockThrottlers.get(blockId)!;
  }

  /**
   * 取消单个块的节流更新
   */
  private cancelBlockThrottler(blockId: string): void {
    // 取消 RAF
    const rafId = this.blockRafs.get(blockId);
    if (rafId) {
      cancelAnimationFrame(rafId);
      this.blockRafs.delete(blockId);
    }

    // 取消节流器
    const throttler = this.blockThrottlers.get(blockId);
    if (throttler) {
      throttler.cancel();
      this.blockThrottlers.delete(blockId);
    }
  }

  /**
   * 刷新单个块的节流更新
   */
  private flushBlockThrottler(blockId: string): void {
    const throttler = this.blockThrottlers.get(blockId);
    if (throttler) {
      throttler.flush();
    }
  }

  /**
   * 智能更新策略：根据块类型连续性自动判断使用节流还是立即更新
   */
  updateBlock(blockId: string, changes: any, blockType: MessageBlockType, isComplete: boolean = false): void {
    const isBlockTypeChanged = this._lastBlockType !== null && this._lastBlockType !== blockType;
    const isBlockIdChanged = this._activeBlockInfo !== null && this._activeBlockInfo.id !== blockId;
    const needsImmediateUpdate = isBlockTypeChanged || isBlockIdChanged || isComplete;

    if (needsImmediateUpdate) {
      // ⭐ 块类型/ID变化时：取消前一个块的节流更新
      if ((isBlockTypeChanged || isBlockIdChanged) && this._activeBlockInfo) {
        this.cancelBlockThrottler(this._activeBlockInfo.id);
      }
      
      // 块完成时：取消当前块的节流，清空活跃块
      if (isComplete) {
        this.cancelBlockThrottler(blockId);
        this._activeBlockInfo = null;  // ⭐ 完成时清空活跃块
      } else {
        this._activeBlockInfo = { id: blockId, type: blockType };  // 更新活跃块
      }

      // 立即更新 UI（不经过节流和 RAF）
      this.stateService.updateBlock(blockId, changes);
      // ⭐ 数据库异步保存，不阻塞（参考 Cherry Studio）
      this.storageService.updateBlock(blockId, changes).catch(err => 
        console.error('[SmartThrottledBlockUpdater] 数据库更新失败:', err)
      );
    } else {
      // 同类型连续更新：使用节流 + RAF
      this._activeBlockInfo = { id: blockId, type: blockType };  // 更新活跃块
      const throttler = this.getBlockThrottler(blockId);
      throttler(changes);
    }

    // 更新 lastBlockType（用于下次块类型变化检测）
    this._lastBlockType = blockType;
  }

  createBlock(block: MessageBlock): void {
    // 关键：先同步更新 Redux store（addBlock 和 addBlockReference）
    this.stateService.addBlock(block);
    this.stateService.addBlockReference(block.messageId, block.id, block.status);
    // ⭐ 数据库异步保存，不阻塞（参考 Cherry Studio）
    this.storageService.saveBlock(block).catch(err => 
      console.error('[SmartThrottledBlockUpdater] 数据库保存失败:', err)
    );
    
    // ⭐ 设置新创建的块为活跃块
    this._activeBlockInfo = { id: block.id, type: block.type };
    this._lastBlockType = block.type;
  }

  /**
   * 刷新所有待处理的节流更新
   */
  flush(): void {
    // 遍历所有节流器并刷新
    for (const [blockId] of this.blockThrottlers.entries()) {
      this.flushBlockThrottler(blockId);
    }
  }

  /**
   * 强制最终更新（确保内容完整）
   * 用于响应结束时，确保最后的内容被正确写入
   */
  forceUpdate(blockId: string, changes: any): void {
    // 取消该块的节流更新
    this.cancelBlockThrottler(blockId);
    // 立即执行最终更新
    this.stateService.updateBlock(blockId, changes);
    // ⭐ 数据库异步保存，不阻塞（参考 Cherry Studio）
    this.storageService.updateBlock(blockId, changes).catch(err => 
      console.error('[SmartThrottledBlockUpdater] 强制更新数据库失败:', err)
    );
  }

  /**
   * 取消所有待处理的节流更新
   */
  cancel(): void {
    // 取消所有 RAF
    for (const [blockId, rafId] of this.blockRafs.entries()) {
      cancelAnimationFrame(rafId);
      this.blockRafs.delete(blockId);
    }
    // 取消所有节流器
    for (const [blockId, throttler] of this.blockThrottlers.entries()) {
      throttler.cancel();
      this.blockThrottlers.delete(blockId);
    }
  }

  /**
   * 清理资源（响应完成后调用）
   */
  cleanup(): void {
    this.cancel();
    this.blockThrottlers.clear();
    this.blockRafs.clear();
    this._activeBlockInfo = null;
    this._lastBlockType = null;
  }

  /**
   * 清空活跃块（手动调用）
   */
  clearActiveBlock(): void {
    this._activeBlockInfo = null;
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

  // 状态转换方法（模仿参考项目：检查 blockId 是否为 null 来决定是否创建新块）
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
        // 关键修复：如果 textBlockId 为 null（被 resetTextBlock 重置），创建新块
        if (!this.textBlockId) {
          this.textBlockId = uuid();
          return { blockId: this.textBlockId, isNewBlock: true };
        }
        return { blockId: this.textBlockId, isNewBlock: false };
    }
  }

  transitionToThinking(): { blockId: string; isNewBlock: boolean } {
    switch (this.state) {
      case BlockState.INITIAL:
        this.state = BlockState.THINKING_ONLY;
        this.thinkingBlockId = this.initialBlockId;
        return { blockId: this.initialBlockId, isNewBlock: false };

      default:
        // 关键：如果 thinkingBlockId 为 null（被 resetThinkingBlock 重置），创建新块
        if (!this.thinkingBlockId) {
          this.thinkingBlockId = uuid();
          return { blockId: this.thinkingBlockId, isNewBlock: true };
        }
        return { blockId: this.thinkingBlockId, isNewBlock: false };
    }
  }

  getTextBlockId(): string | null { return this.textBlockId; }
  getThinkingBlockId(): string | null { return this.thinkingBlockId; }
  getInitialBlockId(): string { return this.initialBlockId; }
  getCurrentState(): BlockState { return this.state; }

  /** 重置思考块状态，下一轮可创建新块 */
  resetThinkingBlock(): void {
    this.thinkingBlockId = null;
  }

  /** 重置文本块状态，下一轮可创建新块 */
  resetTextBlock(): void {
    this.textBlockId = null;
  }
  
  /** 设置文本块ID（用于非流式响应时手动创建块后设置） */
  setTextBlockId(blockId: string): void {
    this.textBlockId = blockId;
    // 如果当前状态是 THINKING_ONLY，转换为 BOTH
    if (this.state === BlockState.THINKING_ONLY) {
      this.state = BlockState.BOTH;
    }
  }
}

// 6. 主处理器 - 智能更新策略
export class ResponseChunkProcessor {
  private readonly textAccumulator = new TextAccumulator();
  private readonly thinkingAccumulator = new ThinkingAccumulator();
  private readonly blockStateManager: BlockStateManager;
  private readonly blockUpdater: SmartThrottledBlockUpdater;
  private reasoningStartTime: number | null = null;
  private lastThinkingMilliseconds?: number;

  constructor(
    private readonly messageId: string,
    blockId: string,
    stateService: StateService,
    storageService: StorageService,
    throttleInterval: number
  ) {
    this.blockStateManager = new BlockStateManager(blockId);
    this.blockUpdater = new SmartThrottledBlockUpdater(stateService, storageService, throttleInterval);
  }

  /**
   * 取消所有待处理的节流/RAF 块更新（中断/出错收尾前调用）。
   * 正常完成时每个块走 forceUpdate(isComplete) 已逐块取消节流；中断没有完成 chunk，
   * 末尾的 streaming 更新可能仍挂在 throttle/RAF 队列里，会在 finalize 之后触发回写，
   * 把已收尾的块重新打回 streaming。此方法在收尾前清空这些待处理写入。
   */
  cancelPendingUpdates(): void {
    this.blockUpdater.cancel();
  }

  handleChunk(chunk: Chunk): void {
    if (!chunk) {
      throw new Error('Chunk 不能为空');
    }

    try {
      switch (chunk.type) {
        case ChunkType.TEXT_DELTA:
          this.handleTextDelta(chunk as TextDeltaChunk);
          break;
        case ChunkType.TEXT_COMPLETE:
          this.handleTextComplete(chunk as TextCompleteChunk);
          break;
        case ChunkType.THINKING_DELTA:
          this.handleThinkingDelta(chunk as ThinkingDeltaChunk);
          break;
        case ChunkType.THINKING_COMPLETE:
          this.handleThinkingComplete(chunk as ThinkingCompleteChunk);
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



  private handleTextDelta(chunk: TextDeltaChunk): void {
    // 供应商已发送累积内容，直接累积即可
    this.textAccumulator.accumulate(chunk.text);
    this.processTextContent();
  }

  private handleTextComplete(chunk: TextCompleteChunk): void {
    this.textAccumulator.accumulate(chunk.text);
    this.processTextContent(true);
  }

  private handleThinkingDelta(chunk: ThinkingDeltaChunk): void {
    this.thinkingAccumulator.accumulate(chunk.text);
    this.processThinkingContent(chunk.thinking_millsec);
  }

  private handleThinkingComplete(chunk: ThinkingCompleteChunk): void {
    this.thinkingAccumulator.accumulate(chunk.text);
    this.processThinkingContent(chunk.thinking_millsec, true);
  }

  private processTextContent(isComplete: boolean = false): void {
    const { blockId, isNewBlock } = this.blockStateManager.transitionToText();

    if (isNewBlock) {
      this.createTextBlock(blockId);
      if (isComplete) {
        this.updateTextBlock(blockId, true);
      }
    } else {
      this.updateTextBlock(blockId, isComplete);
    }

    // 完成后重置状态，让下一轮可以创建新块
    if (isComplete) {
      this.blockStateManager.resetTextBlock();
    }
  }

  private processThinkingContent(thinkingMillsec?: number, isComplete: boolean = false): void {
    const { blockId, isNewBlock } = this.blockStateManager.transitionToThinking();
    const computedThinkingMillis = this.updateThinkingTimer(thinkingMillsec);
    
    if (isNewBlock) {
      this.createThinkingBlock(blockId);
      if (isComplete) {
        this.updateThinkingBlock(blockId, computedThinkingMillis, true);
      }
    } else {
      this.updateThinkingBlock(blockId, computedThinkingMillis, isComplete);
    }
    
    // 完成后重置状态，让下一轮可以创建新块
    if (isComplete) {
      this.blockStateManager.resetThinkingBlock();
      this.reasoningStartTime = null;
    }
  }

  private updateThinkingTimer(thinkingMillsec?: number): number | undefined {
    const now = Date.now();

    // 如果提供了有效的思考时间，优先使用它
    if (typeof thinkingMillsec === 'number' && thinkingMillsec > 0) {
      this.lastThinkingMilliseconds = thinkingMillsec;

      // 同步起始时间，确保后续增量计算一致
      const inferredStartTime = now - thinkingMillsec;
      if (this.reasoningStartTime === null || inferredStartTime < this.reasoningStartTime) {
        this.reasoningStartTime = inferredStartTime;
      }

      return this.lastThinkingMilliseconds;
    }

    if (this.reasoningStartTime === null) {
      this.reasoningStartTime = now;
    }

    const elapsed = now - this.reasoningStartTime;
    this.lastThinkingMilliseconds = Math.max(this.lastThinkingMilliseconds ?? 0, elapsed);

    return this.lastThinkingMilliseconds;
  }

  private createTextBlock(blockId: string): void {
    const block: MessageBlock = {
      id: blockId,
      messageId: this.messageId,
      type: MessageBlockType.MAIN_TEXT,
      content: this.textAccumulator.getContent(),
      createdAt: new Date().toISOString(),
      status: MessageBlockStatus.STREAMING
    };
    this.blockUpdater.createBlock(block);
  }

  private createThinkingBlock(blockId: string): void {
    const block: MessageBlock = {
      id: blockId,
      messageId: this.messageId,
      type: MessageBlockType.THINKING,
      content: this.thinkingAccumulator.getContent(),
      createdAt: new Date().toISOString(),
      status: MessageBlockStatus.STREAMING,
      thinking_millsec: 0,
      // 计时以时间戳派生：落一次起始时刻，UI 用它算实时耗时、收尾用它定格
      thinkingStartTime: this.reasoningStartTime ?? Date.now()
    } as MessageBlock;
    this.blockUpdater.createBlock(block);
  }

  private updateTextBlock(blockId: string, isComplete: boolean = false): void {
    const changes = {
      type: MessageBlockType.MAIN_TEXT,
      content: this.textAccumulator.getContent(),
      status: isComplete ? MessageBlockStatus.SUCCESS : MessageBlockStatus.STREAMING,
      updatedAt: new Date().toISOString()
    };
    
    if (isComplete) {
      // 完成时使用强制更新，确保内容完整
      this.blockUpdater.forceUpdate(blockId, changes);
    } else {
      this.blockUpdater.updateBlock(blockId, changes, MessageBlockType.MAIN_TEXT, isComplete);
      // ⭐ 发送流式文本事件，触发自动滚动
      EventEmitter.emit(EVENT_NAMES.STREAM_TEXT_DELTA, {
        blockId,
        messageId: this.messageId,
        content: this.textAccumulator.getContent()
      });
    }
  }

  private updateThinkingBlock(blockId: string, thinkingMillis?: number, isComplete: boolean = false): void {
    const changes: any = {
      type: MessageBlockType.THINKING,
      content: this.thinkingAccumulator.getContent(),
      status: isComplete ? MessageBlockStatus.SUCCESS : MessageBlockStatus.STREAMING,
      updatedAt: new Date().toISOString()
    };
    if (typeof thinkingMillis === 'number') {
      changes.thinking_millsec = thinkingMillis;
    }
    
    if (isComplete) {
      // 完成时使用强制更新，确保内容完整
      this.blockUpdater.forceUpdate(blockId, changes);
    } else {
      this.blockUpdater.updateBlock(blockId, changes, MessageBlockType.THINKING, isComplete);
      // ⭐ 发送流式思考事件，触发自动滚动
      EventEmitter.emit(EVENT_NAMES.STREAM_THINKING_DELTA, {
        blockId,
        messageId: this.messageId,
        content: this.thinkingAccumulator.getContent()
      });
    }
  }

  /**
   * 完成当前文本块（检测到工具时调用）
   */
  completeCurrentTextBlock(): string | null {
    const textBlockId = this.blockStateManager.getTextBlockId();
    if (textBlockId && this.textAccumulator.getContent()) {
      this.updateTextBlock(textBlockId, true);
      return textBlockId;
    }
    return null;
  }

  /**
   * 重置文本块状态（模仿参考项目：工具调用后调用，下一轮可创建新块）
   */
  resetTextBlock(): void {
    this.blockStateManager.resetTextBlock();
    this.textAccumulator.clear(); // 工具调用后需要清空
  }

  // Getters
  get content(): string { return this.textAccumulator.getContent(); }
  get thinking(): string { return this.thinkingAccumulator.getContent(); }
  get textBlockId(): string | null { return this.blockStateManager.getTextBlockId(); }
  get thinkingId(): string | null { return this.blockStateManager.getThinkingBlockId(); }
  get currentBlockId(): string { return this.blockStateManager.getInitialBlockId(); }
  get thinkingDurationMs(): number | undefined { return this.lastThinkingMilliseconds; }
  
  // Setter for textBlockId (用于非流式响应时设置)
  setTextBlockId(blockId: string): void {
    this.blockStateManager.setTextBlockId(blockId);
  }
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
