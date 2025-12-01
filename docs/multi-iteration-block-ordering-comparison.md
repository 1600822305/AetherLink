# 多轮工具迭代信息块排序对比分析

## 概述

本文档对比分析了 Cherry Studio 参考项目与当前项目在多轮工具调用场景下信息块排序保存逻辑的差异，并指出当前项目存在的问题和修复方案。

## 🔑 关键发现

### 核心问题

**当前项目的 `onLLMResponseCreated` 回调不会为多轮迭代创建新的占位块**，导致多轮工具调用后的思考块和文本块没有正确的时间顺序占位符。

## 对比分析

### 1. `onLLMResponseCreated` 回调

#### ✅ Cherry Studio (正确实现)

**文件**: [`docs/参考项目/cherry-studio-main/src/renderer/src/services/messageStreaming/callbacks/baseCallbacks.ts:62-67`](docs/参考项目/cherry-studio-main/src/renderer/src/services/messageStreaming/callbacks/baseCallbacks.ts:62)

```typescript
onLLMResponseCreated: async () => {
  // 🔧 关键：每次调用都创建新的占位块
  const baseBlock = createBaseMessageBlock(assistantMsgId, MessageBlockType.UNKNOWN, {
    status: MessageBlockStatus.PROCESSING
  })
  await blockManager.handleBlockTransition(baseBlock as PlaceholderMessageBlock, MessageBlockType.UNKNOWN)
}
```

**行为**: 每次 `LLM_RESPONSE_CREATED` 事件触发时，**都会创建一个新的 UNKNOWN 占位块**并追加到消息末尾。

#### ❌ 当前项目 (缺失关键逻辑)

**文件**: [`src/shared/services/streaming/callbacks/baseCallbacks.ts:139-146`](src/shared/services/streaming/callbacks/baseCallbacks.ts:139)

```typescript
onLLMResponseCreated: async () => {
  console.log('[BaseCallbacks] LLM 响应创建');
  // ❌ 问题：只检查是否有占位符，不创建新块
  if (!blockManager.hasInitialPlaceholder) {
    // 占位符块应该已经在 processAssistantResponse 中创建
    console.log('[BaseCallbacks] 使用已有的占位符块');
  }
}
```

**行为**: 只打印日志，**不创建新的占位块**。

### 2. 多轮迭代触发机制

#### ✅ 适配器层 - 两个项目都正确实现

**Cherry Studio** - [`AiSdkToChunkAdapter.ts:302-304`](docs/参考项目/cherry-studio-main/src/renderer/src/aiCore/chunk/AiSdkToChunkAdapter.ts:302):
```typescript
if (finishReason === 'tool-calls') {
  this.onChunk({ type: ChunkType.LLM_RESPONSE_CREATED })
}
```

**当前项目** - [`src/shared/aiCore/adapters/AiSdkToChunkAdapter.ts:221-223`](src/shared/aiCore/adapters/AiSdkToChunkAdapter.ts:221):
```typescript
if (finishReason === 'tool-calls') {
  this.onChunk({ type: ChunkType.LLM_RESPONSE_CREATED });
}
```

**结论**: 适配器层的触发逻辑是正确的，问题出在回调层。

### 3. 块追加顺序

#### ✅ Cherry Studio - 纯追加

**文件**: [`docs/参考项目/cherry-studio-main/src/renderer/src/store/newMessage.ts:163`](docs/参考项目/cherry-studio-main/src/renderer/src/store/newMessage.ts:163)

```typescript
// 直接追加到末尾，保持时间顺序
currentBlocks.push(blockIdToAdd)
```

#### ⚠️ 当前项目 - THINKING 前置逻辑

**文件**: [`src/shared/store/slices/newMessagesSlice.ts:373-381`](src/shared/store/slices/newMessagesSlice.ts:373)

```typescript
// 智能排序：THINKING 块应该在其他块之前
if (blockType === MessageBlockType.THINKING) {
  // THINKING 块插入到最前面
  currentBlocks.unshift(blockId);
} else {
  // 其他类型追加到末尾
  currentBlocks.push(blockId);
}
```

**问题**: 这个逻辑会将**所有** THINKING 块都放到最前面，破坏多轮迭代的时间顺序。

## 时序对比

### 多轮工具调用场景

用户问："查询天气后给我建议"

#### Cherry Studio (正确时序)

```
1. LLM_RESPONSE_CREATED  → 创建 UNKNOWN 占位块 #1
2. THINKING_START        → 占位块 #1 转为 THINKING
3. THINKING_DELTA        → 更新 THINKING 内容
4. THINKING_COMPLETE     → 完成 THINKING 块
5. TEXT_START            → 创建新 TEXT 块 #2
6. TEXT_DELTA            → 更新 TEXT 内容（"我来查一下天气"）
7. TEXT_COMPLETE         → 完成 TEXT 块
8. MCP_TOOL_IN_PROGRESS  → 创建 TOOL 块 #3（查询天气）
9. MCP_TOOL_COMPLETE     → 工具执行完成
10. finish-step(tool-calls) → 触发新一轮
11. LLM_RESPONSE_CREATED → 🔧 创建新 UNKNOWN 占位块 #4 ← 关键！
12. THINKING_START       → 占位块 #4 转为 THINKING
13. TEXT_START           → 创建新 TEXT 块 #5
14. TEXT_COMPLETE        → 完成（"根据天气情况..."）
```

**最终块顺序**: `[THINKING#1, TEXT#2, TOOL#3, THINKING#4, TEXT#5]` ✅

#### 当前项目 (错误时序)

```
1. 初始占位块在 processAssistantResponse 中创建
2. LLM_RESPONSE_CREATED  → 只打印日志，不创建新块
3. THINKING_START        → 复用占位块
... (第一轮正常)
10. finish-step(tool-calls) → 触发新一轮
11. LLM_RESPONSE_CREATED → ❌ 只打印日志，不创建新占位块
12. THINKING_START       → 没有占位块可用，需要创建新块
                          → 但新块通过 upsertBlockReference 添加
                          → THINKING 被 unshift 到最前面
```

**可能的错误块顺序**: `[THINKING#4, THINKING#1, TEXT#2, TOOL#3, TEXT#5]` ❌

## 修复方案

### 方案 1: 修复 `onLLMResponseCreated` (推荐)

**修改文件**: [`src/shared/services/streaming/callbacks/baseCallbacks.ts`](src/shared/services/streaming/callbacks/baseCallbacks.ts)

```typescript
// 修改 onLLMResponseCreated 回调
onLLMResponseCreated: async () => {
  console.log('[BaseCallbacks] LLM 响应创建 - 创建新占位块');
  
  // 🔧 关键修复：每次都创建新的占位块（参考 Cherry Studio）
  const newPlaceholderBlock: MessageBlock = {
    id: uuid(),
    messageId,
    type: MessageBlockType.UNKNOWN,
    content: '',
    createdAt: new Date().toISOString(),
    status: MessageBlockStatus.PROCESSING
  };
  
  await blockManager.handleBlockTransition(newPlaceholderBlock, MessageBlockType.UNKNOWN);
}
```

### 方案 2: 移除 THINKING 前置逻辑

**修改文件**: [`src/shared/store/slices/newMessagesSlice.ts`](src/shared/store/slices/newMessagesSlice.ts)

```typescript
// 在 upsertBlockReference reducer 中
// 移除 THINKING 块的特殊前置逻辑，统一使用追加

// 原代码
if (blockType === MessageBlockType.THINKING) {
  currentBlocks.unshift(blockId);
} else {
  currentBlocks.push(blockId);
}

// 修改为
currentBlocks.push(blockId);  // 统一追加到末尾
```

## 文件修改清单

| 文件路径 | 修改类型 | 优先级 |
|---------|---------|--------|
| [`src/shared/services/streaming/callbacks/baseCallbacks.ts`](src/shared/services/streaming/callbacks/baseCallbacks.ts) | 修改 `onLLMResponseCreated` | **高** |
| [`src/shared/store/slices/newMessagesSlice.ts`](src/shared/store/slices/newMessagesSlice.ts) | 移除 THINKING 前置逻辑 | 中 |

## 测试验证

### 测试场景

1. **单轮对话** - 验证基本块顺序
2. **多轮工具调用** - 验证多轮迭代块顺序
3. **工具调用后思考** - 验证 THINKING 块在工具调用后的位置

### 预期结果

```
消息块顺序应该完全按时间顺序排列：
[THINKING_1, TEXT_1, TOOL_1, THINKING_2, TEXT_2, TOOL_2, THINKING_3, TEXT_3]
```

## 总结

| 项目 | `onLLMResponseCreated` | 块追加策略 | 多轮时序 |
|-----|------------------------|-----------|---------|
| Cherry Studio | ✅ 每次创建新占位块 | ✅ 纯追加 | ✅ 正确 |
| 当前项目 | ❌ 只打印日志 | ⚠️ THINKING 前置 | ❌ 可能错乱 |

**根本原因**: 当前项目的 `onLLMResponseCreated` 回调没有实现创建新占位块的逻辑，导致多轮迭代时无法为新一轮的内容预留正确位置。