/**
 * BlockManager
 * 完全参考 Cherry Studio BlockManager.ts 实现
 * 负责块的更新和状态转换
 */

import type { MessageBlock } from '../../types/newMessage';
import { MessageBlockType } from '../../types/newMessage';
import { newMessagesActions } from '../../store/slices/newMessagesSlice';
import { upsertOneBlock, updateOneBlock } from '../../store/slices/messageBlocksSlice';
import type { AppDispatch, RootState } from '../../store';

interface ActiveBlockInfo {
  id: string;
  type: MessageBlockType;
}

/**
 * BlockManager 依赖配置
 * 完全参考 Cherry Studio BlockManagerDependencies
 */
export interface BlockManagerDependencies {
  dispatch: AppDispatch;
  getState: () => RootState;
  /** 保存单个块到数据库 */
  saveUpdatedBlockToDB: (
    blockId: string | null,
    messageId: string,
    topicId: string,
    getState: () => RootState
  ) => Promise<void>;
  /** 保存消息和块更新到数据库 */
  saveUpdatesToDB: (
    messageId: string,
    topicId: string,
    messageUpdates: Partial<any>,
    blocksToUpdate: MessageBlock[]
  ) => Promise<void>;
  assistantMsgId: string;
  topicId: string;
  /** 节流更新（从外部传入） */
  throttledBlockUpdate: (id: string, blockUpdate: any) => void;
  /** 取消节流更新（从外部传入） */
  cancelThrottledBlockUpdate: (id: string) => void;
}

/**
 * BlockManager
 * 完全参考 Cherry Studio 实现
 */
export class BlockManager {
  private deps: BlockManagerDependencies;

  // 简化后的状态管理
  private _activeBlockInfo: ActiveBlockInfo | null = null;
  private _lastBlockType: MessageBlockType | null = null;

  constructor(dependencies: BlockManagerDependencies) {
    this.deps = dependencies;
  }

  // Getters
  get activeBlockInfo() {
    return this._activeBlockInfo;
  }

  get lastBlockType() {
    return this._lastBlockType;
  }

  get hasInitialPlaceholder() {
    return this._activeBlockInfo?.type === MessageBlockType.UNKNOWN;
  }

  get initialPlaceholderBlockId() {
    return this.hasInitialPlaceholder ? this._activeBlockInfo?.id || null : null;
  }

  // Setters
  set lastBlockType(value: MessageBlockType | null) {
    this._lastBlockType = value;
  }

  set activeBlockInfo(value: ActiveBlockInfo | null) {
    this._activeBlockInfo = value;
  }

  /**
   * 智能更新策略：根据块类型连续性自动判断使用节流还是立即更新
   * 完全参考 Cherry Studio 实现
   */
  smartBlockUpdate(
    blockId: string,
    changes: Partial<MessageBlock>,
    blockType: MessageBlockType,
    isComplete: boolean = false
  ) {
    const isBlockTypeChanged = this._lastBlockType !== null && this._lastBlockType !== blockType;
    
    if (isBlockTypeChanged || isComplete) {
      // 如果块类型改变，则取消上一个块的节流更新
      if (isBlockTypeChanged && this._activeBlockInfo) {
        this.deps.cancelThrottledBlockUpdate(this._activeBlockInfo.id);
      }
      // 如果当前块完成，则取消当前块的节流更新
      if (isComplete) {
        this.deps.cancelThrottledBlockUpdate(blockId);
        this._activeBlockInfo = null; // 块完成时清空activeBlockInfo
      } else {
        this._activeBlockInfo = { id: blockId, type: blockType }; // 更新活跃块信息
      }
      this.deps.dispatch(updateOneBlock({ id: blockId, changes }));
      this.deps.saveUpdatedBlockToDB(blockId, this.deps.assistantMsgId, this.deps.topicId, this.deps.getState);
      this._lastBlockType = blockType;
    } else {
      this._activeBlockInfo = { id: blockId, type: blockType }; // 更新活跃块信息
      this.deps.throttledBlockUpdate(blockId, changes);
    }
  }

  /**
   * 处理块转换
   * 完全参考 Cherry Studio 实现
   */
  async handleBlockTransition(newBlock: MessageBlock, newBlockType: MessageBlockType) {
    console.log('[BlockManager] handleBlockTransition', { newBlock: newBlock.id, newBlockType });
    this._lastBlockType = newBlockType;
    this._activeBlockInfo = { id: newBlock.id, type: newBlockType }; // 设置新的活跃块信息

    this.deps.dispatch(
      newMessagesActions.updateMessage({
        topicId: this.deps.topicId,
        messageId: this.deps.assistantMsgId,
        updates: { blockInstruction: { id: newBlock.id } }
      })
    );
    this.deps.dispatch(upsertOneBlock(newBlock));
    this.deps.dispatch(
      newMessagesActions.upsertBlockReference({
        messageId: this.deps.assistantMsgId,
        blockId: newBlock.id,
        status: newBlock.status,
        blockType: newBlock.type
      })
    );

    const currentState = this.deps.getState();
    const updatedMessage = currentState.messages?.entities?.[this.deps.assistantMsgId];
    if (updatedMessage) {
      await this.deps.saveUpdatesToDB(
        this.deps.assistantMsgId,
        this.deps.topicId,
        { blocks: updatedMessage.blocks },
        [newBlock]
      );
    } else {
      console.error(
        `[BlockManager] Failed to get updated message ${this.deps.assistantMsgId} from state for DB save.`
      );
    }
  }
}

// 向后兼容的别名
export type StreamingBlockManagerConfig = BlockManagerDependencies;
export const StreamingBlockManager = BlockManager;
export function createStreamingBlockManager(config: BlockManagerDependencies): BlockManager {
  return new BlockManager(config);
}
