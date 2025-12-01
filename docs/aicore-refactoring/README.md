# AiCore 重构计划 - 完全对标 Cherry Studio

> **目标**：按照 Cherry Studio 架构一比一复刻 aiCore 模块
> **预计工时**：8-12 天
> **开始日期**：2025-12-01

---

## 📊 当前状态 vs 目标状态

| 功能 | 当前状态 | 目标状态 | 优先级 |
|------|---------|----------|--------|
| OpenAI 兼容 | ✅ 已实现 | ✅ 优化 | - |
| Gemini | ✅ 已实现 | ✅ 优化 | - |
| Anthropic | ❌ 缺失 | ✅ 完整 | P0 |
| Azure OpenAI | ⚠️ 部分 | ✅ 完整 | P1 |
| AWS Bedrock | ❌ 缺失 | ✅ 完整 | P2 |
| MCP 工具 (函数调用) | ⚠️ 基础 | ✅ 完整 | P0 |
| Web 搜索 | ⚠️ 基础 | ✅ 完整 | P1 |
| 中间件系统 | ⚠️ 基础 | ✅ 完整 | P0 |
| Trace/Span | ❌ 简化 | ✅ 完整 | P2 |
| 错误重试 | ❌ 缺失 | ✅ 完整 | P1 |

---

## 📁 目标目录结构

```
src/shared/aiCore/
├── index.ts                          # 统一入口（参考 CS legacy/index.ts）
├── AiProvider.ts                     # 主入口类（重构）
│
├── clients/                          # SDK 客户端层
│   ├── ApiClientFactory.ts           # 客户端工厂（参考 CS）
│   ├── BaseApiClient.ts              # 抽象基类（增强）
│   ├── types.ts                      # 客户端类型定义
│   ├── openai/
│   │   ├── OpenAIAPIClient.ts        # OpenAI 客户端（重构）
│   │   ├── OpenAIBaseClient.ts       # OpenAI 基类
│   │   └── OpenAIResponseAPIClient.ts # Response API 支持
│   ├── anthropic/
│   │   └── AnthropicAPIClient.ts     # 新增 Anthropic 客户端
│   ├── gemini/
│   │   ├── GeminiAPIClient.ts        # Gemini 客户端（重构）
│   │   └── VertexAPIClient.ts        # Vertex AI 支持
│   ├── azure/
│   │   └── AzureOpenAIClient.ts      # Azure OpenAI（新增）
│   └── bedrock/
│       └── BedrockAPIClient.ts       # AWS Bedrock（新增）
│
├── middleware/                       # 中间件层（完全重构）
│   ├── builder.ts                    # 中间件构建器
│   ├── composer.ts                   # Redux 风格组合器
│   ├── register.ts                   # 中间件注册表
│   ├── schemas.ts                    # 中间件数据结构
│   ├── types.ts                      # 中间件类型
│   ├── common/                       # 通用中间件
│   │   ├── AbortHandlerMiddleware.ts
│   │   ├── ErrorHandlerMiddleware.ts
│   │   ├── FinalChunkConsumerMiddleware.ts
│   │   └── LoggingMiddleware.ts
│   ├── core/                         # 核心流程中间件
│   │   ├── TransformCoreToSdkParamsMiddleware.ts
│   │   ├── StreamAdapterMiddleware.ts
│   │   ├── ResponseTransformMiddleware.ts
│   │   ├── TextChunkMiddleware.ts
│   │   ├── ThinkChunkMiddleware.ts
│   │   └── RawStreamListenerMiddleware.ts
│   └── feat/                         # 功能中间件
│       ├── McpToolChunkMiddleware.ts # MCP 工具处理（重点）
│       ├── WebSearchMiddleware.ts    # Web 搜索
│       ├── ThinkingTagExtractionMiddleware.ts
│       ├── ToolUseExtractionMiddleware.ts
│       └── ImageGenerationMiddleware.ts
│
├── chunk/                            # Chunk 适配器层
│   ├── AiSdkToChunkAdapter.ts        # AI SDK → Chunk（保留优化）
│   └── handleToolCallChunk.ts        # 工具调用处理
│
├── types/                            # 类型定义
│   ├── chunk.ts                      # Chunk 类型（增强）
│   ├── provider.ts                   # Provider 类型
│   ├── sdk.ts                        # SDK 通用类型
│   └── index.ts
│
└── utils/                            # 工具函数
    ├── linkConverter.ts              # 链接转换
    ├── errorUtils.ts                 # 错误处理工具
    └── tokenUtils.ts                 # Token 计算工具
```

---

## 📋 实施阶段

### Phase 1: 中间件系统重构 (3天)
- [ ] 1.1 重构 `middleware/types.ts` - 对标 CS 类型定义
- [ ] 1.2 实现 Redux 风格 `composer.ts`
- [ ] 1.3 实现 `MiddlewareBuilder` 构建器
- [ ] 1.4 实现 `MiddlewareRegistry` 注册表
- [ ] 1.5 实现核心中间件（13个）

### Phase 2: 客户端重构 (2天)
- [ ] 2.1 重构 `BaseApiClient` 基类
- [ ] 2.2 重构 `ApiClientFactory` 工厂
- [ ] 2.3 重构 `OpenAIAPIClient`
- [ ] 2.4 新增 `AnthropicAPIClient`
- [ ] 2.5 增强 Azure/Vertex 支持

### Phase 3: MCP 工具调用完善 (2天)
- [ ] 3.1 实现 `McpToolChunkMiddleware`
- [ ] 3.2 实现工具调用递归逻辑
- [ ] 3.3 完善函数调用/提示词注入双模式
- [ ] 3.4 工具结果格式化

### Phase 4: 功能中间件 (2天)
- [ ] 4.1 实现 `WebSearchMiddleware`
- [ ] 4.2 实现 `ThinkingTagExtractionMiddleware`
- [ ] 4.3 实现 `ImageGenerationMiddleware`
- [ ] 4.4 实现错误重试逻辑

### Phase 5: 集成测试与优化 (1-3天)
- [ ] 5.1 AiProvider 入口重构
- [ ] 5.2 集成测试
- [ ] 5.3 性能优化
- [ ] 5.4 文档完善

---

## 🔗 相关文档

- [Phase 1: 中间件系统重构](./phase-1-middleware.md)
- [Phase 2: 客户端重构](./phase-2-clients.md)
- [Phase 3: MCP 工具调用](./phase-3-mcp-tools.md)
- [Phase 4: 功能中间件](./phase-4-features.md)
- [Phase 5: 集成优化](./phase-5-integration.md)
- [Cherry Studio 架构参考](./cherry-studio-architecture.md)

---

## ✅ 进度追踪

| 阶段 | 状态 | 开始日期 | 完成日期 | 备注 |
|------|------|----------|----------|------|
| Phase 1 | ✅ 完成 | 2025-12-01 | 2025-12-01 | 6个核心中间件 |
| Phase 2 | ✅ 完成 | 2025-12-01 | 2025-12-01 | Anthropic 客户端 |
| Phase 3 | ✅ 完成 | 2025-12-01 | 2025-12-01 | 合并到 Phase 1 |
| Phase 4 | ✅ 完成 | 2025-12-01 | 2025-12-01 | 8个功能中间件 |
| Phase 5 | ✅ 完成 | 2025-12-01 | 2025-12-01 | AiProvider.completionsV2 |

---

## 📂 文档目录

| 文档 | 描述 | 预计工时 |
|------|------|----------|
| [README.md](./README.md) | 总览和进度追踪 | - |
| [phase-1-middleware.md](./phase-1-middleware.md) | 中间件系统重构 | 3天 |
| [phase-2-clients.md](./phase-2-clients.md) | 客户端重构 | 2天 |
| [phase-3-mcp-tools.md](./phase-3-mcp-tools.md) | MCP 工具调用 | 2天 |
| [phase-4-features.md](./phase-4-features.md) | 功能中间件 | 2天 |
| [phase-5-integration.md](./phase-5-integration.md) | 集成优化 | 1-3天 |
| [cherry-studio-architecture.md](./cherry-studio-architecture.md) | CS 架构参考 | - |

---

## 📌 关键原则

1. **一比一复刻**：完全对标 Cherry Studio 的架构设计
2. **渐进式迁移**：保持向后兼容，逐步替换
3. **类型安全**：充分利用 TypeScript 泛型
4. **单一职责**：每个中间件只做一件事
5. **可测试性**：每个组件可独立测试
