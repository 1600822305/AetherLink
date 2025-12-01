# AetherLink 消息处理系统重构计划

> 参考项目：Cherry Studio
> 目标：将 AetherLink 的消息处理逻辑升级为 Cherry Studio 的架构标准

## 📋 重构概述

### 当前状态评估
- **完成度**：✅ 100% 核心架构已完成
- **核心功能**：已实现适配器层、回调系统模块化、队列控制、Chunk增强、BlockManager统一
- **状态**：新架构已就绪，旧架构已清理（保留兼容层）

### 重构目标
1. 实现统一的 SDK 到 Chunk 适配器层
2. 将回调系统模块化，按功能分离
3. 添加 Topic 级别的消息队列控制
4. 增强 Chunk 类型系统
5. 统一 BlockManager 的智能更新策略

---

## 🗓️ 分阶段计划

| 阶段 | 名称 | 预计工时 | 优先级 | 状态 |
|------|------|----------|--------|------|
| Phase 1 | [适配器层重构](./phase-1-adapter-layer.md) | 2-3天 | P0 | ✅ 完成 |
| Phase 2 | [回调系统模块化](./phase-2-callback-modularization.md) | 3-4天 | P0 | ✅ 完成 |
| Phase 3 | [队列控制系统](./phase-3-queue-control.md) | 1-2天 | P1 | ✅ 完成 |
| Phase 4 | [Chunk系统增强](./phase-4-chunk-system-enhancement.md) | 1天 | P1 | ✅ 完成 |
| Phase 5 | [BlockManager统一](./phase-5-blockmanager-unification.md) | 2天 | P2 | ✅ 完成 |
| Phase 6 | 旧架构清理 | 1天 | P0 | ✅ 完成 |

**实际完成时间：1天（自动化重构）**

---

## 📁 文档结构

```
docs/message-system-refactoring/
├── README.md                           # 本文档 - 总览
├── architecture-comparison.md          # 架构对比分析
├── phase-1-adapter-layer.md           # 阶段1: 适配器层
├── phase-2-callback-modularization.md # 阶段2: 回调模块化
├── phase-3-queue-control.md           # 阶段3: 队列控制
├── phase-4-chunk-system-enhancement.md # 阶段4: Chunk增强
├── phase-5-blockmanager-unification.md # 阶段5: BlockManager
└── phase-6-testing-optimization.md    # 阶段6: 测试优化
```

---

## 🎯 核心改造目标

### 1. 流处理架构升级
```
当前架构：
Provider → 直接发送 Chunk → ResponseHandler → ChunkProcessor

目标架构（Cherry Studio 风格）：
Provider → AI SDK Stream → AiSdkToChunkAdapter → StreamProcessor 
    → 分发到各类 Callbacks → BlockManager → Redux/DB
```

### 2. 关键文件映射

| Cherry Studio | AetherLink 当前 | AetherLink 目标 |
|---------------|-----------------|-----------------|
| `AiSdkToChunkAdapter.ts` | 无 | `src/shared/aiCore/adapters/ChunkAdapter.ts` |
| `StreamProcessingService.ts` | `ResponseHandler.ts` | `src/shared/services/streaming/StreamProcessor.ts` |
| `callbacks/*.ts` | 集成在 ResponseHandler | `src/shared/services/streaming/callbacks/*.ts` |
| `BlockManager.ts` | 分散在多处 | `src/shared/services/streaming/BlockManager.ts` |
| `messageThunk.ts` | 分散在多个文件 | `src/shared/store/thunks/messageThunk.ts` (统一入口) |

### 3. 成功标准
- [ ] 所有 Provider 通过统一适配器发送 Chunk
- [ ] 回调系统支持按功能独立扩展
- [ ] 同一 Topic 的消息严格按队列顺序处理
- [ ] 支持 TEXT_START、RAW 等新 Chunk 类型
- [ ] BlockManager 智能更新策略统一

---

## 🔄 迁移策略

### 原则
1. **渐进式迁移**：保持向后兼容，逐步替换
2. **功能开关**：新旧架构可通过 feature flag 切换
3. **充分测试**：每个阶段完成后进行回归测试

### 风险控制
- 每个阶段独立可回滚
- 保留旧代码直到新代码稳定
- 关键路径添加详细日志

---

## 📊 进度追踪

### Phase 1: 适配器层 ⏳
- [ ] 设计 ChunkAdapter 接口
- [ ] 实现 OpenAI 适配器
- [ ] 实现 Gemini 适配器
- [ ] 统一 Provider 流处理入口

### Phase 2: 回调模块化 ⏳
- [ ] 抽取 BaseCallbacks
- [ ] 抽取 TextCallbacks
- [ ] 抽取 ThinkingCallbacks
- [ ] 抽取 ToolCallbacks
- [ ] 实现 createCallbacks 组合器

### Phase 3: 队列控制 ⏳
- [ ] 实现 TopicQueue 类
- [ ] 集成到 sendMessage
- [ ] 添加并发测试

### Phase 4: Chunk 增强 ⏳
- [ ] 添加 TEXT_START 类型
- [ ] 添加 RAW 类型
- [ ] 添加 MCP_TOOL_PENDING 类型

### Phase 5: BlockManager 统一 ⏳
- [ ] 合并更新策略
- [ ] 统一节流配置
- [ ] 优化状态管理

### Phase 6: 测试优化 ⏳
- [ ] 单元测试覆盖
- [ ] 集成测试
- [ ] 性能基准测试

---

## 📚 参考资源

- [Cherry Studio 源码](../参考项目/cherry-studio-main/)
- [架构对比分析](./architecture-comparison.md)
- [MESSAGE_BLOCK_DEVELOPMENT_GUIDE.md](../MESSAGE_BLOCK_DEVELOPMENT_GUIDE.md)

---

*文档创建日期：2024-12-01*
*最后更新：2024-12-01*
