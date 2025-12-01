/**
 * 统一的 StreamingBlockManager
 * 负责块的更新和状态转换（不负责创建，创建使用 blockFactory）
 * 
 * 参考 Cherry Studio BlockManager 简洁设计
 */

import { throttle } from 'lodash';
import type { MessageBlock } from '../../types/newMessage';
import { MessageBlockType } from '../../types/newMessage';
import { newMessagesActions } from '../../store/slices/newMessagesSlice';
import { upsertOneBlock, updateOneBlock } from '../../store/slices/messageBlocksSlice';
import type { AppDispatch, RootState } from '../../store';

/**
 * BlockManager 依赖配置
 * 参考 Cherry Studio 的依赖注入设计
 */
export interface StreamingBlockManagerConfig {
  /** Redux dispatch */
  dispatch: AppDispatch;
  /** 获取 Redux 状态 */
  getState: () => RootState;
  /** 消息 ID */
  messageId: string;
  /** 主题 ID */
  topicId: string;
  /** 初始占位符块 ID（可选）*/
  initialBlockId?: string;
  /** 保存更新到数据库 */
  saveUpdatesToDB: (
    messageId: string,
    topicId: string,
    messageUpdates: any,
    blocksToUpdate: MessageBlock[]
  ) => Promise<void>;
  /** 节流间隔（毫秒）*/
  throttleInterval?: number;
}

/**
 * 统一的流式块管理器
 * 负责块的更新和状态转换（块创建使用 blockFactory）
 */
export class StreamingBlockManager {
  private config: StreamingBlockManagerConfig;
  private _activeBlockInfo: { id: string; type: string } | null = null;
  private _lastBlockType: string | null = null;
  private _initialPlaceholderBlockId: string | null = null;
  private throttledUpdate: ReturnType<typeof throttle>;
  private pendingUpdates: Map<string, Record<string, any>> = new Map();

  constructor(config: StreamingBlockManagerConfig) {
    this.config = {
      throttleInterval: 100,
      ...config
    };

    this._initialPlaceholderBlockId = config.initialBlockId || null;
    if (config.initialBlockId) {
      this._activeBlockInfo = { id: config.initialBlockId, type: MessageBlockType.UNKNOWN };
    }

    // 创建节流更新函数
    this.throttledUpdate = throttle(
      this.flushUpdate.bind(this),
      this.config.throttleInterval
    );
  }

  // ==================== Getters ====================

  /** 当前活跃块信息 */
  get activeBlockInfo() {
    return this._activeBlockInfo;
  }

  /** 最后的块类型 */
  get lastBlockType() {
    return this._lastBlockType;
  }

  /** 初始占位符块 ID */
  get initialPlaceholderBlockId() {
    return this._initialPlaceholderBlockId;
  }

  /** 是否有初始占位符（动态检查，占位符被使用后自动变为 false） */
  get hasInitialPlaceholder() {
    // 参考 Cherry Studio：检查当前活跃块是否是 UNKNOWN 类型
    return this._activeBlockInfo?.type === MessageBlockType.UNKNOWN;
  }

  // ==================== Core Methods ====================

  /**
   * 智能更新块
   * 根据块类型变化和完成状态决定立即更新还是节流更新
   */
  smartBlockUpdate(
    blockId: string,
    changes: Partial<MessageBlock>,
    blockType: string,
    isComplete: boolean = false
  ): void {
    const isTypeChanged = this._lastBlockType !== null && this._lastBlockType !== blockType;

    // 类型变化或完成时立即更新
    if (isTypeChanged || isComplete) {
      // 取消之前的节流更新
      this.throttledUpdate.cancel();
      
      // 先刷新之前的待更新内容
      if (this._activeBlockInfo && this.pendingUpdates.has(this._activeBlockInfo.id)) {
        this.flushUpdate();
      }

      if (isComplete) {
        this._activeBlockInfo = null;
      } else {
        this._activeBlockInfo = { id: blockId, type: blockType };
      }

      // 立即更新 Redux
      this.config.dispatch(updateOneBlock({ id: blockId, changes: changes as any }));
      
      // 🔧 关键修复：从 Redux 获取完整块对象来保存（参考 Cherry Studio）
      const state = this.config.getState();
      const fullBlock = state.messageBlocks?.entities?.[blockId];
      if (fullBlock) {
        this.config.saveUpdatesToDB(
          this.config.messageId,
          this.config.topicId,
          {},
          [fullBlock]  // 保存完整的块对象，而不是部分数据
        ).catch(err => console.error('[BlockManager] 保存块失败:', err));
      }
      
      this._lastBlockType = blockType;
    } else {
      // 普通更新，使用节流
      this._activeBlockInfo = { id: blockId, type: blockType };
      this._lastBlockType = blockType;
      
      // 累积更新
      const existing = this.pendingUpdates.get(blockId) || {};
      this.pendingUpdates.set(blockId, { ...existing, ...changes });
      
      this.throttledUpdate();
    }
  }

  /**
   * 处理块转换（创建新块）
   */
  async handleBlockTransition(newBlock: MessageBlock, newBlockType: string): Promise<void> {
    // 先完成之前的块
    if (this._activeBlockInfo) {
      this.throttledUpdate.cancel();
      this.flushUpdate();
    }

    this._lastBlockType = newBlockType;
    this._activeBlockInfo = { id: newBlock.id, type: newBlockType };

    // 添加块到 Redux
    this.config.dispatch(upsertOneBlock(newBlock));

    // 更新消息的块引用（Redux）
    this.config.dispatch(newMessagesActions.upsertBlockReference({
      messageId: this.config.messageId,
      blockId: newBlock.id,
      status: newBlock.status
    }));

    // 🔧 关键修复：保存新块到数据库
    await this.config.saveUpdatesToDB(
      this.config.messageId,
      this.config.topicId,
      {},
      [newBlock]
    );
    
    // 🔧 关键修复：同时保存更新后的 message.blocks 数组到数据库
    const state = this.config.getState();
    const message = state.messages?.entities?.[this.config.messageId];
    if (message?.blocks) {
      const dexieStorage = (await import('../../services/storage/DexieStorageService')).dexieStorage;
      await dexieStorage.updateMessage(this.config.messageId, { blocks: message.blocks });
      console.log(`[BlockManager] 更新消息块列表: ${message.blocks.length} 个块`);
    }
  }

  // ==================== Throttle Control ====================

  /**
   * 取消节流更新
   */
  cancelThrottle(): void {
    this.throttledUpdate.cancel();
    this.pendingUpdates.clear();
  }

  /**
   * 刷新节流更新（立即执行待更新内容）
   */
  flushThrottle(): void {
    this.throttledUpdate.flush();
  }

  /**
   * 内部刷新更新
   */
  private flushUpdate(): void {
    if (this.pendingUpdates.size === 0) return;

    // 先更新 Redux
    this.pendingUpdates.forEach((changes, blockId) => {
      this.config.dispatch(updateOneBlock({ id: blockId, changes: changes as any }));
    });

    // 🔧 关键修复：从 Redux 获取完整块对象来保存（参考 Cherry Studio）
    const state = this.config.getState();
    const blocksToUpdate: MessageBlock[] = [];
    
    this.pendingUpdates.forEach((_, blockId) => {
      const fullBlock = state.messageBlocks?.entities?.[blockId];
      if (fullBlock) {
        blocksToUpdate.push(fullBlock);
      }
    });

    if (blocksToUpdate.length > 0) {
      this.config.saveUpdatesToDB(
        this.config.messageId,
        this.config.topicId,
        {},
        blocksToUpdate
      ).catch(err => console.error('[BlockManager] 刷新保存失败:', err));
    }

    this.pendingUpdates.clear();
  }

  // ==================== Cleanup ====================

  /**
   * 清理资源
   */
  cleanup(): void {
    this.throttledUpdate.cancel();
    this.pendingUpdates.clear();
    this._activeBlockInfo = null;
    this._lastBlockType = null;
  }
}

/**
 * 创建 BlockManager 工厂函数
 */
export function createStreamingBlockManager(config: StreamingBlockManagerConfig): StreamingBlockManager {
  return new StreamingBlockManager(config);
}
