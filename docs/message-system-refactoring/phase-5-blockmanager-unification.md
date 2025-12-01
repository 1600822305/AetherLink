# Phase 5: BlockManager 统一

> **优先级**：P2 (可选)  
> **预计工时**：2天  
> **依赖**：Phase 2 (回调模块化)

## 🎯 目标

统一 BlockManager 的职责和智能更新策略，合并分散的块管理逻辑。

---

## 📋 当前问题

### 职责分散
当前 AetherLink 的块管理分散在两个文件：
- `BlockManager.ts` (322行) - 只负责创建块
- `ResponseChunkProcessor.ts` (552行) - 负责更新策略

### Cherry Studio 的统一设计
```typescript
// BlockManager.ts (143行) - 创建+更新统一
export class BlockManager {
  smartBlockUpdate(blockId, changes, blockType, isComplete) { ... }
  handleBlockTransition(newBlock, newBlockType) { ... }
}
```

---

## 📝 详细任务

### Task 5.1: 合并 BlockManager

创建统一的 `BlockManager`，包含：
- 块创建方法
- 智能更新策略
- 块状态转换

**目标文件**：`src/shared/services/streaming/BlockManager.ts`

```typescript
import { throttle } from 'lodash';
import type { MessageBlock } from '../../types/newMessage';
import { MessageBlockStatus, MessageBlockType } from '../../types/newMessage';
import type { AppDispatch, RootState } from '../../store';

export interface BlockManagerDependencies {
  dispatch: AppDispatch;
  getState: () => RootState;
  messageId: string;
  topicId: string;
  initialBlockId: string;
  saveUpdatesToDB: (messageId: string, topicId: string, updates: any, blocks: MessageBlock[]) => Promise<void>;
  throttleInterval?: number;
}

export class BlockManager {
  private deps: BlockManagerDependencies;
  private _activeBlockInfo: { id: string; type: MessageBlockType } | null = null;
  private _lastBlockType: MessageBlockType | null = null;
  private throttledUpdate: ReturnType<typeof throttle>;

  constructor(deps: BlockManagerDependencies) {
    this.deps = deps;
    this.throttledUpdate = throttle(
      (blockId: string, changes: Partial<MessageBlock>) => {
        this.deps.dispatch(updateOneBlock({ id: blockId, changes }));
        this.deps.saveUpdatesToDB(deps.messageId, deps.topicId, {}, [{ id: blockId, ...changes } as MessageBlock]);
      },
      deps.throttleInterval || 150
    );
  }

  get activeBlockInfo() { return this._activeBlockInfo; }
  get lastBlockType() { return this._lastBlockType; }
  get hasInitialPlaceholder() { return this._activeBlockInfo?.type === MessageBlockType.UNKNOWN; }
  get initialPlaceholderBlockId() { return this.hasInitialPlaceholder ? this._activeBlockInfo?.id : null; }

  smartBlockUpdate(
    blockId: string,
    changes: Partial<MessageBlock>,
    blockType: MessageBlockType,
    isComplete: boolean = false
  ): void {
    const isTypeChanged = this._lastBlockType !== null && this._lastBlockType !== blockType;

    if (isTypeChanged || isComplete) {
      if (isTypeChanged && this._activeBlockInfo) {
        this.throttledUpdate.cancel();
      }
      if (isComplete) {
        this.throttledUpdate.cancel();
        this._activeBlockInfo = null;
      } else {
        this._activeBlockInfo = { id: blockId, type: blockType };
      }
      
      this.deps.dispatch(updateOneBlock({ id: blockId, changes }));
      this.deps.saveUpdatesToDB(this.deps.messageId, this.deps.topicId, {}, [{ id: blockId, ...changes } as MessageBlock]);
      this._lastBlockType = blockType;
    } else {
      this._activeBlockInfo = { id: blockId, type: blockType };
      this.throttledUpdate(blockId, changes);
    }
  }

  async handleBlockTransition(newBlock: MessageBlock, newBlockType: MessageBlockType): Promise<void> {
    this._lastBlockType = newBlockType;
    this._activeBlockInfo = { id: newBlock.id, type: newBlockType };

    this.deps.dispatch(newMessagesActions.updateMessage({
      id: this.deps.messageId,
      changes: { blockInstruction: { id: newBlock.id } }
    }));
    this.deps.dispatch(upsertOneBlock(newBlock));
    this.deps.dispatch(newMessagesActions.upsertBlockReference({
      messageId: this.deps.messageId,
      blockId: newBlock.id,
      status: newBlock.status
    }));

    await this.deps.saveUpdatesToDB(this.deps.messageId, this.deps.topicId, {}, [newBlock]);
  }

  cancelThrottle(): void {
    this.throttledUpdate.cancel();
  }

  flushThrottle(): void {
    this.throttledUpdate.flush();
  }
}
```

### Task 5.2: 迁移现有逻辑

1. 将 `ResponseChunkProcessor` 中的更新逻辑迁移到 `BlockManager`
2. 更新回调模块使用新的 `BlockManager`
3. 废弃旧的 `BlockManager` 和 `SmartThrottledBlockUpdater`

### Task 5.3: 更新导入和引用

更新所有使用块管理的文件，统一使用新的 `BlockManager`。

---

## ✅ 验收标准

- [ ] 块创建和更新使用统一入口
- [ ] 智能更新策略正常工作
- [ ] 节流配置可自定义
- [ ] 向后兼容现有功能

---

## 📅 里程碑

| 日期 | 任务 | 状态 |
|------|------|------|
| Day 1 | Task 5.1: 合并 BlockManager | ⏳ |
| Day 2 | Task 5.2-5.3: 迁移和测试 | ⏳ |
