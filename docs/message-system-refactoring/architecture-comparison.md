# 架构对比分析：AetherLink vs Cherry Studio

## 一、整体架构对比

### Cherry Studio 架构
```
用户输入 → sendMessage (thunk)
    ↓
创建用户消息 + Block → 保存到 DB & Redux
    ↓
创建助手消息 → 加入队列
    ↓
transformMessagesAndFetch → fetchChatCompletion
    ↓
AiProvider.completions → 流式/非流式处理
    ↓
AiSdkToChunkAdapter → 转换为 Chunk
    ↓
StreamProcessor → 分发到各类 Callbacks
    ↓
BlockManager → 更新 Redux + DB
    ↓
UI 渲染
```

### AetherLink 当前架构
```
用户输入 → sendMessage (thunk)
    ↓
创建用户消息 + Block → 保存到 DB & Redux
    ↓
创建助手消息 + 占位符块
    ↓
processAssistantResponse
    ↓
apiProvider.sendChatMessage(onChunk)
    ↓
Provider 直接发送 Chunk → ResponseHandler
    ↓
ResponseChunkProcessor → 更新 Redux + DB
    ↓
UI 渲染
```

---

## 二、核心模块对比

### 1. 流数据适配层

#### Cherry Studio ✅
```typescript
// AiSdkToChunkAdapter.ts (433行)
export class AiSdkToChunkAdapter {
  async processStream(aiSdkResult: any): Promise<string> {
    if (aiSdkResult.fullStream) {
      await this.readFullStream(aiSdkResult.fullStream)
    }
    return await aiSdkResult.text
  }

  private convertAndEmitChunk(chunk: TextStreamPart) {
    switch (chunk.type) {
      case 'text-start':
        this.onChunk({ type: ChunkType.TEXT_START })
        break
      case 'text-delta':
        this.onChunk({ type: ChunkType.TEXT_DELTA, text: chunk.text })
        break
      case 'reasoning-delta':
        this.onChunk({ type: ChunkType.THINKING_DELTA, text: ... })
        break
      case 'finish':
        this.onChunk({ type: ChunkType.BLOCK_COMPLETE, response: {...} })
        break
    }
  }
}
```

#### AetherLink ❌ 缺失
- 每个 Provider 直接构建 Chunk，没有统一适配层
- 导致 Provider 间实现不一致

---

### 2. 回调系统

#### Cherry Studio ✅ 高度模块化
```typescript
// callbacks/index.ts
export const createCallbacks = (deps) => {
  const baseCallbacks = createBaseCallbacks(deps)      // 143行
  const textCallbacks = createTextCallbacks(deps)      // 87行
  const thinkingCallbacks = createThinkingCallbacks(deps)  // 63行
  const toolCallbacks = createToolCallbacks(deps)      // 120行
  const imageCallbacks = createImageCallbacks(deps)    // 85行
  const citationCallbacks = createCitationCallbacks(deps)  // 127行
  const videoCallbacks = createVideoCallbacks(deps)    // 33行
  const compactCallbacks = createCompactCallbacks(deps)    // 153行
  
  return {
    ...baseCallbacks,
    ...textCallbacks,
    ...thinkingCallbacks,
    ...toolCallbacks,
    ...imageCallbacks,
    ...citationCallbacks,
    ...videoCallbacks,
    ...compactCallbacks
  }
}
```

**文件结构：**
```
callbacks/
├── index.ts           # 组合器
├── baseCallbacks.ts   # LLM 生命周期
├── textCallbacks.ts   # 文本处理
├── thinkingCallbacks.ts # 思考链
├── toolCallbacks.ts   # 工具调用
├── imageCallbacks.ts  # 图像生成
├── citationCallbacks.ts # 引用处理
├── videoCallbacks.ts  # 视频处理
└── compactCallbacks.ts # 紧凑模式
```

#### AetherLink ⚠️ 集中式
```typescript
// ResponseHandler.ts (292行) - 一个大的处理类
async handleChunk(chunk: Chunk): Promise<void> {
  switch (chunk.type) {
    case ChunkType.THINKING_START:
    case ChunkType.THINKING_DELTA:
    case ChunkType.THINKING_COMPLETE:
      await chunkProcessor.handleChunk(chunk);
      break;
    case ChunkType.TEXT_DELTA:
    case ChunkType.TEXT_COMPLETE:
      await this.handleTextWithToolExtraction(chunk);
      break;
    case ChunkType.MCP_TOOL_IN_PROGRESS:
    case ChunkType.MCP_TOOL_COMPLETE:
      await toolHandler.handleChunk(chunk);
      break;
  }
}
```

**问题：** 扩展新类型需要修改核心文件

---

### 3. BlockManager

#### Cherry Studio
```typescript
// BlockManager.ts (143行)
export class BlockManager {
  private _activeBlockInfo: ActiveBlockInfo | null = null
  private _lastBlockType: MessageBlockType | null = null

  smartBlockUpdate(blockId, changes, blockType, isComplete = false) {
    const isBlockTypeChanged = this._lastBlockType !== blockType
    
    if (isBlockTypeChanged || isComplete) {
      // 立即更新
      this.deps.dispatch(updateOneBlock({ id: blockId, changes }))
      this.deps.saveUpdatedBlockToDB(blockId, ...)
    } else {
      // 节流更新 (150ms)
      this.deps.throttledBlockUpdate(blockId, changes)
    }
  }

  async handleBlockTransition(newBlock, newBlockType) {
    // 处理块类型转换
    this.deps.dispatch(upsertOneBlock(newBlock))
    this.deps.dispatch(upsertBlockReference({...}))
    await this.deps.saveUpdatesToDB(...)
  }
}
```

#### AetherLink
```typescript
// BlockManager.ts (322行) - 只负责创建
export class BlockManager {
  async createMainTextBlock(messageId: string): Promise<MessageBlock> { ... }
  async createThinkingBlock(messageId: string): Promise<MessageBlock> { ... }
  async createErrorBlock(messageId: string, errorMessage: string): Promise<MessageBlock> { ... }
  // ... 其他创建方法
}

// ResponseChunkProcessor.ts (552行) - 负责更新策略
class SmartThrottledBlockUpdater {
  async updateBlock(blockId, changes, blockType, isComplete = false) {
    if (needsImmediateUpdate) {
      this.stateService.updateBlock(blockId, changes)
    } else {
      this.throttledStateUpdate(blockId, changes)
    }
  }
}
```

**差异：** AetherLink 职责分离更清晰，但缺少统一入口

---

### 4. 队列控制

#### Cherry Studio ✅
```typescript
// messageThunk.ts
const queue = getTopicQueue(topicId)
queue.add(async () => {
  await fetchAndProcessAssistantResponseImpl(...)
})

// utils/queue.ts
export function getTopicQueue(topicId: string): PQueue {
  if (!topicQueues.has(topicId)) {
    topicQueues.set(topicId, new PQueue({ concurrency: 1 }))
  }
  return topicQueues.get(topicId)!
}
```

#### AetherLink ❌ 缺失
```typescript
// sendMessage.ts - 直接 await
await processAssistantResponse(dispatch, getState, assistantMessage, ...)
```

**问题：** 多消息并发时可能出现竞态条件

---

### 5. Chunk 类型对比

| 类型 | Cherry Studio | AetherLink | 说明 |
|------|:-------------:|:----------:|------|
| TEXT_START | ✅ | ❌ | 文本块开始标记 |
| TEXT_DELTA | ✅ | ✅ | 流式文本增量 |
| TEXT_COMPLETE | ✅ | ✅ | 文本完成 |
| THINKING_START | ✅ | ✅ | 思考开始 |
| THINKING_DELTA | ✅ | ✅ | 思考增量 |
| THINKING_COMPLETE | ✅ | ✅ | 思考完成 |
| MCP_TOOL_PENDING | ✅ | ❌ | 工具等待状态 |
| MCP_TOOL_IN_PROGRESS | ✅ | ✅ | 工具执行中 |
| MCP_TOOL_COMPLETE | ✅ | ✅ | 工具完成 |
| MCP_TOOL_CREATED | ❌ | ✅ | AetherLink 特有 |
| VIDEO_SEARCHED | ✅ | ❌ | 视频检索 |
| RAW | ✅ | ❌ | 原始数据透传 |
| IMAGE_CREATED | ✅ | ✅ | 图像创建 |
| IMAGE_DELTA | ✅ | ✅ | 图像增量 |
| IMAGE_COMPLETE | ✅ | ✅ | 图像完成 |
| ERROR | ✅ | ✅ | 错误 |
| BLOCK_COMPLETE | ✅ | ✅ | 块完成 |

---

## 三、代码规模对比

| 模块 | Cherry Studio | AetherLink |
|------|---------------|------------|
| 消息发送入口 | `messageThunk.ts` (1733行) | 分散在多个文件 (~600行) |
| 流处理分发 | `StreamProcessingService.ts` (167行) | `ResponseHandler.ts` (292行) |
| 块管理 | `BlockManager.ts` (143行) | `BlockManager.ts` (322行) + `ResponseChunkProcessor.ts` (552行) |
| 回调系统 | `callbacks/` (9个文件, ~800行) | 集成在 responseHandlers (~400行) |
| SDK适配 | `AiSdkToChunkAdapter.ts` (433行) | 无 |
| Chunk类型 | `chunk.ts` (466行) | `chunk.ts` (421行) |

---

## 四、优劣势总结

### AetherLink 优势 ✅
1. **职责分离**：BlockManager（创建）与 ChunkProcessor（更新）分离
2. **状态机模式**：完整的 BlockStateManager 状态机
3. **内容累积器**：独立的 TextAccumulator 和 ThinkingAccumulator 类
4. **工具提取**：专门的 ToolUseExtractionProcessor

### AetherLink 差距 ⚠️
1. **缺少适配器层**：没有 AI SDK 到 Chunk 的统一适配器
2. **回调不够模块化**：没有按功能分离回调
3. **缺少队列控制**：没有 Topic 级别的消息队列
4. **缺少 TEXT_START**：无法区分文本块的开始时机
5. **缺少 RAW 类型**：无法透传原始 SDK 数据

---

## 五、改造优先级

1. **P0 - 必须改造**
   - 适配器层（统一流处理）
   - 回调模块化（可扩展性）
   - 队列控制（并发安全）

2. **P1 - 建议改造**
   - Chunk 类型增强
   - 统一入口 thunk

3. **P2 - 可选改造**
   - BlockManager 合并
   - 性能优化
