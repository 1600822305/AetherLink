# Phase 4: Chunk 系统增强

> **优先级**：P1 (建议)  
> **预计工时**：1天  
> **依赖**：Phase 1 (适配器层)

## 🎯 目标

增强 Chunk 类型系统，添加 Cherry Studio 支持但 AetherLink 缺少的 Chunk 类型。

---

## 📋 当前差距

| 类型 | Cherry Studio | AetherLink | 说明 |
|------|:-------------:|:----------:|------|
| TEXT_START | ✅ | ❌ | 文本块开始标记 |
| MCP_TOOL_PENDING | ✅ | ❌ | 工具等待状态 |
| RAW | ✅ | ❌ | 原始数据透传 |
| VIDEO_SEARCHED | ✅ | ❌ | 视频检索结果 |
| KNOWLEDGE_SEARCH_* | ✅ | ❌ | 知识库搜索 |

---

## 📝 详细任务

### Task 4.1: 添加新 ChunkType 枚举

修改 `src/shared/types/chunk.ts`：

```typescript
export enum ChunkType {
  // 现有类型保持不变...
  
  // 新增类型
  TEXT_START = 'text.start',
  MCP_TOOL_PENDING = 'mcp_tool_pending',
  RAW = 'raw',
  VIDEO_SEARCHED = 'video.searched',
  IMAGE_SEARCHED = 'image.searched',
  KNOWLEDGE_SEARCH_IN_PROGRESS = 'knowledge_search_in_progress',
  KNOWLEDGE_SEARCH_COMPLETE = 'knowledge_search_complete'
}
```

### Task 4.2: 添加新 Chunk 接口

```typescript
export interface TextStartChunk {
  type: ChunkType.TEXT_START;
  chunk_id?: number;
}

export interface MCPToolPendingChunk {
  type: ChunkType.MCP_TOOL_PENDING;
  responses: MCPToolResponse[];
}

export interface RawChunk {
  type: ChunkType.RAW;
  content: unknown;
  metadata?: Record<string, any>;
}
```

### Task 4.3: 更新 StreamProcessor

在 `createStreamProcessor` 中添加新类型的处理分支。

### Task 4.4: 更新回调类型

在 `StreamProcessorCallbacks` 接口中添加：
- `onToolCallPending`
- `onRawData`
- `onKnowledgeSearchInProgress`
- `onKnowledgeSearchComplete`

### Task 4.5: 更新适配器

在 `BaseChunkAdapter` 中添加 `emitTextStart()` 等辅助方法。

---

## ✅ 验收标准

- [ ] 新 Chunk 类型可正常发送和接收
- [ ] TEXT_START 在适配器中正确触发
- [ ] RAW 类型可透传 SDK 原始数据
- [ ] 类型安全，编译无错误

---

## 📅 里程碑

| 日期 | 任务 | 状态 |
|------|------|------|
| Day 1 | Task 4.1-4.5 | ⏳ |
