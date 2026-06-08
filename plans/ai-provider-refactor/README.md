# AI 供应商调用链重构（Master Plan + 进度追踪）

> **这份文档是 AI 调用链重构的唯一事实来源（single source of truth）。**
> 新会话接手时：① 先读本文 §1~§5 了解背景与目标；② 看 §7 进度表确认当前到哪一步；③ 严格按 §6 阶段顺序推进；④ **每完成一个阶段，必须更新 §7 进度表 + §8 变更日志**。
>
> 铁律：每个 PR 可独立发版、行为不变、先测试后重构、重构 PR 不夹带功能改动。

---

## 1. 背景

AetherLink 的 AI 调用链（页面 → `services/ai/ProviderFactory` → `api/<vendor>` → 各家 SDK）是整个 app 的地基，但目前问题最集中，是优先级最高的重构对象。

量化现状（service + api 层）：
- `api/*` 共 ~12,858 行，`any` 极密：openai 92 / gemini-aisdk 66 / openai-aisdk 53 / anthropic-aisdk 50。
- `services/ai` 4,314 行、55 `any`、138 `console`。

已确认的结构性问题：

| # | 问题 | 证据 |
|---|------|------|
| 1 | **双工厂，一套死代码且误导** | `api/providerFactory.ts` **0 调用方**，内含 `throw 'Anthropic/Gemini 尚未实现'`（实际已实现）；真用的是 `services/ai/ProviderFactory.ts` |
| 2 | **工厂返回 `any`** | `createProvider(model): any`；真实工厂内 27 处 `any` |
| 3 | **双基类职责重叠** | `AbstractBaseProvider`(api/baseProvider.ts, 6 引用) 与 `BaseAIProvider`(providers/BaseAIProvider.ts, 2 引用) 都定义 `convertMcpTools<T>` |
| 4 | **返回类型是松散 union** | `sendChatMessage(): Promise<string \| {content, reasoning?, reasoningTime?}>`，43 处调用各自 narrow |
| 5 | **靠猜模型名路由** | `inferProviderFromModel`: `modelId.includes('claude'/'gemini'/'gpt'…)` |
| 6 | **新老两套并行实现** | OpenAI 同时存在 `api/openai`（官方 SDK）与 `api/openai-aisdk`（Vercel AI SDK），逻辑重复 |
| 7 | **工具解析工具重复** | `utils/mcpToolParser` 与 `utils/mcpPrompt` 两套 |

---

## 2. 关键背景：为什么"原版 OpenAI（官方 SDK）"一直没被删？

这是反复被问到的点，调查结论如下（**不是因为某个功能坏了，而是结构原因**）：

1. **官方 `openai` SDK 是绝大多数供应商的默认/兜底实现。**
   `services/ai/ProviderFactory.ts` 的 `getProviderApi` 里，`openai / deepseek / google / grok / siliconflow / volcengine / azure-openai / default` **全部 `return openaiApi`**（官方 SDK 那套）。注释写着"默认使用 OpenAI 兼容 API，最大兼容保证"。
   → 删掉 `api/openai` 会同时打断 OpenAI 本体 + 一大批 OpenAI 兼容第三方供应商。

2. **AI SDK 版的 OpenAI 是"opt-in 实验"，从未被设为默认。**
   `defaultModels.ts` 里有两个独立供应商条目：
   - `id: 'openai'`（官方 SDK，默认启用）
   - `id: 'openai-aisdk'`，name `"OpenAI (AI SDK)" 🚀`，**`isEnabled: false`（默认关闭）**，`providerType: 'openai-aisdk'`。
   → 它是并排新增的实验入口，需要用户手动开启，而不是替换原版。

3. **Gemini / Anthropic 已完成迁移（老实现已删），但 OpenAI 没有。**
   git 历史：`cfa92ab7 feat(anthropic): 重构 Claude 为 AI SDK 版`、`2b5282e5 refactor: 重构 Gemini 为 AI SDK 版`。`api/` 下已无非 aisdk 的 anthropic/gemini 目录，唯独 OpenAI 保留 `openai` + `openai-aisdk` 两套。
   → 因为 Gemini/Anthropic 不承担"兼容第三方"的角色，能干净替换；而 OpenAI 是整个兼容生态的底座，迁移风险大，所以一直没敢删。

> **结论**：官方 OpenAI SDK 没被删 = 它是兼容生态的底座（默认/兜底），AI SDK 版只是默认关闭的实验。本次重构的目标之一，就是把这层"底座"也安全迁到 AI SDK 并最终删除官方 `openai` 聊天实现。
>
> ⚠️ 待确认：用户印象中"某个功能不正常"导致没删——目前 git 历史里**未找到**明确的"因 bug X 回退"提交。若后续定位到具体功能（如某供应商流式/工具调用在 aisdk 下异常），在 §8 补记。

---

## 3. SDK 版本说明（重要）

核实结论：**项目并不在"旧大版本"上。**

| 包 | 当前声明 | 最新 latest | 大版本 |
|----|---------|------------|--------|
| `ai` | `^6.0.103` | 6.0.197 | ✅ v6（最新稳定）|
| `@ai-sdk/openai` | `^3.0.33` | 3.0.68 | ✅ |
| `@ai-sdk/anthropic` | `^3.0.47` | 3.0.81 | ✅ |
| `@ai-sdk/google` | `^3.0.33` | 3.0.80 | ✅ |
| `openai`（官方）| `^6.25.0` | 6.42.0 | ✅ |

- AI SDK 的 `latest` 就是 **v6**；**v7 仍是 beta（`7.0.0-beta.116`），本次重构不上 v7。**
- 代码已使用 v6 写法（`streamText` + `result.fullStream` + parts）。
- "升级到最新版" = v6 内部补丁号 bump（caret 范围本就会自动跟进），非跨大版本迁移。
- **长期价值**：本次收敛成单一 `AIProvider` 契约后，未来 v7 转正时只需改 `adapters/` 一处，而非满仓库改。

---

## 4. 目标架构

核心思想：**对"一个 AI 供应商能做什么"定义强类型契约，每家只实现差异；公共逻辑（工具调度、系统提示词、流式聚合、错误归一）下沉到单一基类；工厂只做"选适配器"，返回契约类型而非 `any`。** 聊天统一走 Vercel AI SDK v6；非聊天功能（视频/模型列表/私有图像/embedding）保持裸 REST，独立成 `rest/` 模块。

### 4.1 强类型契约
```ts
// src/shared/ai/core/types.ts
export interface ChatParams {
  messages: NormalizedMessage[];
  model: Model;
  systemPrompt?: string;
  tools?: MCPTool[];
  toolMode?: 'function' | 'prompt';
  enableWebSearch?: boolean;
  enableThinking?: boolean;
  abortSignal?: AbortSignal;
  onChunk?: (chunk: Chunk) => void;       // 复用现有 types/chunk
}
export interface ChatResult {              // 取代 string | {…} union
  content: string;
  reasoning?: string;
  reasoningTimeMs?: number;
  toolCalls?: ToolCall[];
  usage?: Usage;
  finishReason?: FinishReason;
}
export interface ProviderCapabilities {
  streaming: boolean; tools: boolean; vision: boolean;
  reasoning: boolean; imageGen: boolean; embedding: boolean;
}
export interface AIProvider {
  readonly capabilities: ProviderCapabilities;
  chat(params: ChatParams): Promise<ChatResult>;
  testConnection(): Promise<ConnectionResult>;
  listModels?(): Promise<Model[]>;
}
```

### 4.2 目标目录结构
```
src/shared/ai/
  core/
    types.ts          # AIProvider / ChatParams / ChatResult / ProviderCapabilities
    BaseProvider.ts    # 唯一基类（合并 AbstractBaseProvider + BaseAIProvider）
    registry.ts        # createProvider(model): AIProvider（注册表，删死工厂）
    errors.ts          # 统一 AIError
  adapters/
    openai/            # @ai-sdk/openai
    anthropic/         # @ai-sdk/anthropic
    google/            # @ai-sdk/google
    openai-compatible/ # @ai-sdk/openai-compatible（deepseek/doubao/minimax/volcengine/zhipu/qwen 等共用）
  shared/
    streamAdapter.ts   # result.fullStream parts → Chunk 事件（合并各家重复 stream.ts）
    toolBridge.ts      # MCP ↔ AI SDK tools（合并两套 parser）
    providerOptions/   # 各供应商私有参数映射（见 §5）
  rest/                # 裸 REST：videoService / modelsService / imageService / embeddingService
  index.ts             # 对外唯一出口
```

### 4.3 依赖调整
```jsonc
"ai": "^6.0.197",
"@ai-sdk/openai": "^3.0.68",
"@ai-sdk/anthropic": "^3.0.81",
"@ai-sdk/google": "^3.0.80",
"@ai-sdk/openai-compatible": "^2.0.48",   // 新增
// 移除：官方 "openai"（聊天迁完后；若图像/视频仍依赖其类型，单独评估）
```

---

## 5. 各供应商私有参数 → `providerOptions` 映射（迁移真正的坑）

现 `getWebSearchParams` 给各家塞私有 body 字段，迁到 AI SDK 须逐个落到 `providerOptions` 并**逐家实测**：

| 供应商 | 现在的私有字段 | AI SDK v6 方式 |
|--------|--------------|----------------|
| OpenAI | `web_search_options` | `openai.tools.webSearch(...)` 或 `providerOptions.openai` |
| dashscope(通义) | `enable_search` / `search_options.forced_search` | `providerOptions.<name>` 透传 body |
| hunyuan | `enable_enhancement` / `citation` / `search_info` | `providerOptions.<name>` 透传 |
| openrouter | `plugins:[{id:'web'}]` | `providerOptions.<name>` 透传 |
| 通用兜底 | `tools:[{type:'retrieval'}]` | 按供应商逐个确认 |

> `@ai-sdk/openai-compatible` 支持把 `providerOptions.<providerName>.{...}` 合并进请求体，私有字段都能透传——**但每家都要实测回归**，这是迁移里唯一需要专门排期的部分。

---

## 6. 分阶段计划（Strangler，全程可发版）

> 每个 Phase = 一个独立 PR。完成后更新 §7 进度表与 §8 日志。

- **Phase 0 — 护栏**
  给聊天链路补特征测试（characterization tests）：openai / anthropic / gemini 的流式 + 非流式 + 工具调用 + testConnection；mock SDK 输出，固定"输入 → Chunk 序列"快照（范式：`src/shared/api/openai/__tests__/tools.characterization.test.ts`）。CI 接 `type-check + lint + vitest`。
- **Phase 1 — 版本对齐（零架构改动）**
  升级 `ai / @ai-sdk/*` 到最新 v6 并锁版本；`type-check` + 特征测试确认无回归。
- **Phase 2 — 零风险清理**
  删死代码 `api/providerFactory.ts`；用 `knip`/`ts-prune` 扫未引用导出出清单；合并 `mcpToolParser` 与 `mcpPrompt`。
- **Phase 3 — 立契约 + 合并基类**
  新建 `ai/core/types.ts`；`ai/core/BaseProvider.ts` 合并两个旧基类；工厂 `getProviderApi` 返回类型 `any` → `AIProvider`（逼出隐藏耦合）。
- **Phase 4 — 适配器化（一次一家）**
  `*-aisdk` 收敛成 `adapters/<vendor>`，公共流式抽到 `shared/streamAdapter.ts`；**删除 `api/openai`（官方 SDK 聊天）**，OpenAI 统一走 `@ai-sdk/openai`；第三方兼容供应商接 `@ai-sdk/openai-compatible`，私有参数按 §5 逐个搬 + 实测。每迁一家跑该家特征测试。
- **Phase 5 — 工厂/路由收口**
  工厂改注册表；显式 `providerType` 优先、`inferProviderFromModel` 降为兜底；能力判断改 `provider.capabilities.*`；`chat()` 返回 union → `ChatResult`，逐个修 43 处调用方。
- **Phase 6 — 收尾**
  抽离 `rest/`（视频/模型列表/图像/embedding）；删旧目录/旧基类/死代码；该链路 `any` 清零、`console` 换 LoggerService；评估移除官方 `openai` 依赖。

---

## 7. 进度追踪（每阶段完成后更新）

| Phase | 名称 | 状态 | PR | 完成日期 | 备注 |
|------:|------|:----:|----|----------|------|
| — | 文档与计划（本文）| ✅ 完成 | 本 PR | 2026-06-08 | 建立 single source of truth |
| 0 | 护栏（测试 + CI）| ⬜ 未开始 | | | |
| 1 | 版本对齐 v6 | ⬜ 未开始 | | | |
| 2 | 零风险清理 | ⬜ 未开始 | | | 删 `api/providerFactory.ts` |
| 3 | 立契约 + 合并基类 | ⬜ 未开始 | | | |
| 4 | 适配器化（逐家）| ⬜ 未开始 | | | 删 `api/openai`、接 openai-compatible |
| 5 | 工厂/路由收口 | ⬜ 未开始 | | | 改 43 处调用方 |
| 6 | 收尾（rest/ + 清理）| ⬜ 未开始 | | | |

状态图例：⬜ 未开始 / 🔵 进行中 / ✅ 完成 / ⚠️ 阻塞。

---

## 8. 变更日志（每阶段追加）

- **2026-06-08** — 建立本重构计划文档与进度追踪器；完成现状诊断、SDK 版本核实（确认在 v6 最新稳定线、v7 仍 beta）、"为何官方 OpenAI 未删"的根因调查（结论：兼容生态底座 + AI SDK 版为默认关闭的实验，未发现明确的 bug 回退提交）。

---

## 9. 新会话接手指南

1. 读本文 §1~§5，建立背景。
2. 看 §7 进度表，找到第一个非 ✅ 的 Phase，即当前任务。
3. 按 §6 对应 Phase 的描述推进；**只做当前 Phase，不跨阶段**。
4. 动手前先确认 Phase 0 护栏存在（特征测试 + CI）；若不存在，先补 Phase 0。
5. 完成后：跑 `npm run type-check`、`npm run lint`、`npm test`（或 `vitest run`）；更新 §7 进度表 + §8 日志；提独立 PR。
6. 遇到 §2 提到的"功能不正常"线索，务必在 §8 记录具体供应商/功能，避免重复踩坑。
