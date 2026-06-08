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

### 决策：保留 vs 删除官方 OpenAI SDK
- **终态：删除**官方 `openai` 聊天实现，全部统一到 AI SDK（+ `@ai-sdk/openai-compatible`）。永久保留两套 = 重复逻辑只是被契约盖住、依赖翻倍、同一供应商两条码路，等于重构没做到位。
- **路径：先"统一保留"作过渡，最后才删**（绞杀者）。先把官方 openai 包进统一 `AIProvider` 契约 → 逐家把兼容供应商（deepseek/grok/siliconflow/volcengine/azure…）迁到 `@ai-sdk/openai-compatible` 并**逐家实测** → 全绿后最后一步删官方 openai。
- **例外**：若 Phase 0 实测发现某关键供应商在 AI SDK 下确实无法复刻某行为，则**只为那一家保留官方 openai**，其余全迁。能否 100% 删干净，由测试结果决定，不拍脑袋。

---

## 2.5 块系统与 API 的边界：`Chunk` 契约（为什么重构 API 不会震塌信息块系统）

> 这是本次重构最重要的"安全前提"。信息块（message block）系统又复杂又脆（详见 §2.6），但它和 API 层是**通过 `Chunk` 事件流解耦**的——这正是"敢动 API"的依据。

### 边界长这样
```
API provider ──emit──▶ Chunk 事件流 ──▶ ResponseHandler.handleChunk(chunk)
                       (src/shared/types/chunk)   ├ TEXT_DELTA / TEXT_COMPLETE
                                                   ├ THINKING_DELTA / THINKING_COMPLETE
                                                   └ MCP_TOOL_* ──▶ 块系统（ResponseChunkProcessor / BlockManager / slice）
```
`ResponseHandler` 只认 `Chunk` 类型，**完全不关心上游是官方 `openai` SDK 还是 Vercel AI SDK**（见 `src/shared/services/messages/ResponseHandler.ts` 顶部链路注释）。

### 推论（重构的护身符）
> **只要重构后 API 产出的 `Chunk` 序列（类型 + 顺序 + 内容）保持不变，下游那套脆弱的块逻辑就感知不到任何变化。**

这不是"应该没事"的祈祷——**Phase 0 特征测试要钉死的就是这条边界**："给定某段 SDK 响应 → 产出的 Chunk 序列不变"。测试一旦建好，改 API 时只要它还绿，就**用数据证明**块系统行为不变。

### 会破坏边界的高危改动（Phase 0 测试必须覆盖）
- **thinking 分片/时机**变了（reasoning delta 怎么切、何时发 THINKING_COMPLETE）；
- **工具调用事件**类型/时机/顺序变了（块系统对 `MCP_TOOL_*` 的顺序极敏感）；
- `TEXT_DELTA` vs `TEXT_COMPLETE` 的发送方式变了；
- 多模态 / citation / image 等 chunk 的发送方式变了。

→ **Chunk 契约 = 防火墙；Phase 0 测试 = 给防火墙装报警器。** 两者到位，API 重构就与块系统隔离。

---

## 2.6 信息块系统现状（独立的后续重构目标，不在本次 API 重构范围）

块系统本身确实"靠 bug 修 bug"，但它有自己的输入契约（= `Chunk`），与 API 重构**互不阻塞**，应**单独立项**重构。这里仅登记现状，供将来排期。

规模：`services/messages` ~5420 行、`store/thunks/message` ~2989 行、**88 处 `any`**、**~83 处 workaround 注释**（"关键修复 / 防止 / 兜底 / 临时 / 避免重复 / 参考 cherry-studio"）。

已知最脆的几处：
1. **块状态机 `BlockStateManager`**（INITIAL/TEXT_ONLY/THINKING_ONLY/BOTH）：text 与 thinking 交错流式时，靠 null 检查打补丁决定是否新建块（`ResponseChunkProcessor.ts` 注释"关键修复：如果 textBlockId 为 null…创建新块"）。
2. **从流式文本里正则抽取工具调用**（`ToolUseExtractionProcessor` + `ResponseHandler.handleTextWithToolExtraction`）："检测到工具，停止处理后续文本（防止覆盖）"、"标记已检测到工具调用后，文本将丢弃"——prompt 模式工具调用，最脆。
3. **三层节流叠加**：per-block throttle（LRUCache）+ `requestAnimationFrame` + 完成时 `flush` 强制更新。
4. **`ToolResponseHandler` 幂等去重**："防止重复创建工具块"、"幂等操作避免重复事件"。
5. **`ResponseCompletionHandler.calculateFinalBlockIds(_chunkProcessor: any)`**：参数已废弃仍留 `any`；最终块顺序靠"流式收到的原始顺序"硬保。

> 处理顺序：**先完成 AI Provider 重构（本文档），块系统重构留待其后单独立项**。届时同样先建"Chunk → 块状态"的特征测试作护栏。

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

> ⚠️ **2026-06-08 决策修订**：下方 `adapters/<vendor>/` 的目录收敛**已放弃**（见 §6 Phase 4 / §8）。三家 `*-aisdk/provider.ts` 的高度相似属**有意为之的供应商独立性**，不去重、不搬目录（`*-aisdk` 保持现状）。`shared/streamAdapter.ts` 已以 `ai/adapters/shared/streamShared.ts` 落地（仅抽真·逐字重复的工具函数，#99）。下图保留为初始设想参考。

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
  - **✅ 已完成（本 PR，共 32 用例全绿，CI 全绿含 SonarCloud）**—四条聊天路径的 `parts/SDK 响应 → onChunk(Chunk)` 序列均被钉死：
    - 三家 AI SDK（`openai-aisdk` / `anthropic-aisdk` / `gemini-aisdk`）结构同构，合并进单文件 `src/shared/api/__tests__/aisdk-stream.characterization.test.ts`：公共契约（纯文本累积 TEXT_DELTA + 唯一 TEXT_COMPLETE、空响应、`tool-call` → MCP_TOOL_CREATED 且跳过 TEXT_COMPLETE、非流式 `nonStreamCompletion` 结果映射）由 `__tests__/shared/aisdkStreamContract.ts` 参数化套件循环跑三家；各家再补特有推理用例（OpenAI `reasoning-delta`/`raw.reasoning_content`、Anthropic Extended Thinking、Gemini THINKING_COMPLETE 时机）。**合并是为通过 SonarCloud 新代码重复率门禁**（三家独立文件曾触发 48.8% → 抽共享套件 17.7% → 合并单文件后达标）。
    - `api/openai`（官方 SDK，**删除目标**）：`stream.characterization.test.ts` — `UnifiedStreamProcessor` 负责流式 DELTA（`delta.content`/`reasoning_content`/`tool_calls` → 累积 TEXT_DELTA/THINKING_DELTA、推理转正文补发 THINKING_COMPLETE、工具增量合并）；钉死了一个关键事实：**该处理器不发 TEXT_COMPLETE / MCP_TOOL_*，那些由 `provider.ts` 在 buildResult 后发出**。
    - 新增 `.github/workflows/pr-test.yml`（PR 上跑 `npm test`）。
  - **live 基线（DeepSeek，openai 兼容路径，2026-06-08）**：`deepseek-chat` 实际 `fullStream` part 类型 = `start/start-step/raw/text-start/text-delta/text-end/finish-step/finish`；`deepseek-reasoner` 额外产出大量 `raw`，其推理内容经 `raw.choices[0].delta.reasoning_content` 传递（**印证 §2.5 的 `raw → THINKING_DELTA` 映射**）。当前 `streamCompletion` 忽略 `start*/text-start/text-end/finish-step` 等 part（无 case，等价 no-op）。
  - **lint 门禁评估（本 PR）**：`npm run lint` 当前在存量代码上报 **230 errors + 129 warnings**，故暂不能作为 PR 阻断门禁（会每个 PR 红）。留到 Phase 6 “清存量 → 设只降不升基线”再接入；本轮新增测试文件本身 `eslint` 0 问题。
  - **待办（Phase 0 可选扩展，不阻塞后续）**：`testConnection`/错误归一的特征测试；dashscope（复用官方 openai）专项用例。
- **Phase 1 — 版本对齐（零架构改动）**
  升级 `ai / @ai-sdk/*` 到最新 v6 并锁版本；`type-check` + 特征测试确认无回归。
- **Phase 2 — 零风险清理**
  删死代码 `api/providerFactory.ts`（已删，PR #91）；用 `knip`/`ts-prune` 扫未引用导出出清单；~~合并 `mcpToolParser` 与 `mcpPrompt`~~ → **移至 Phase 3**（见下，二者非行为等价的重复，绑定到两个待合并基类）。
- **Phase 3 — 立契约 + 合并基类**
  新建 `ai/core/types.ts`；`ai/core/BaseProvider.ts` 合并两个旧基类；工厂 `getProviderApi` 返回类型 `any` → `AIProvider`（逼出隐藏耦合）。**并入：统一 `mcpToolParser.getMCPSystemPrompt`（Responses 路径）与 `mcpPrompt.buildSystemPrompt`（主路径）两套 MCP 提示词**——它俩分别绑在本阶段要合并的两个基类上，提示词统一会改 OpenAI Responses 路径文本（行为改动），故随基类合并一起做。
- **Phase 4 — 适配器化（一次一家）**
  原计划：`*-aisdk` 收敛成 `adapters/<vendor>`，公共流式抽到 `shared/streamAdapter.ts`；**删除 `api/openai`（官方 SDK 聊天）**，OpenAI 统一走 `@ai-sdk/openai`；第三方兼容供应商接 `@ai-sdk/openai-compatible`，私有参数按 §5 逐个搬 + 实测。每迁一家跑该家特征测试。
  - **4a ✅ 补护栏**（#97）：给 0 覆盖的 OpenAI **Responses** 路径补 9 个特征测试（41/41），纯加测试零行为。
  - **4d ✅ 流式去重**（#99）：三家 `*-aisdk/stream.ts` 的**逐字重复**工具（`ThinkTagParser`、基础类型、`getProviderConfigFromStore`、`accumulateToolCall`、emit helpers、`PROMPT_MODE_STOP_SEQUENCES`）抽到单一共享件 `ai/adapters/shared/streamShared.ts`；各家 `fullStream` 循环（推理时机真差异）保留不动。-455/+61 行，零行为。
  - **⛔ 决策（2026-06-08）：放弃 provider.ts 去重 + 目录收敛。** 量化发现 stream 去重后三家目录仍有 25.5% 跨家重复，大头是 `provider.ts`（1019 行，几乎全在 agentic 工具调用循环）。但这些重复属**有意为之的供应商独立性**——每家 provider 业务逻辑应可独立演进，硬抽共享基类是 god-base 过度设计。故 **provider.ts 保持各家独立、不去重**；连带地 **`*-aisdk` 目录不收敛到 `ai/adapters/<vendor>`**（搬动会把旧重复算成新代码、再触发门禁；不动则属旧代码、不卡门禁）。`shared/streamAdapter.ts` 的产物即 4d 的 `streamShared.ts`（仅抽真·逐字重复的工具函数）。
  - **4e–4g（待排期，需 live key）**：接 `@ai-sdk/openai-compatible` + 私有参数搬 `providerOptions`（§5）→ 逐家灰度切默认聊天引擎 → 删官方 `openai` **聊天实现**（image/video/models 留 Phase 6）。
- **Phase 5 — 工厂/路由收口**
  工厂改注册表；显式 `providerType` 优先、`inferProviderFromModel` 降为兜底；能力判断改 `provider.capabilities.*`；`chat()` 返回 union → `ChatResult`，逐个修 43 处调用方。
- **Phase 6 — 收尾**
  抽离 `rest/`（视频/模型列表/图像/embedding）；删旧目录/旧基类/死代码；该链路 `any` 清零、`console` 换 LoggerService；评估移除官方 `openai` 依赖。

---

## 7. 进度追踪（每阶段完成后更新）

| Phase | 名称 | 状态 | PR | 完成日期 | 备注 |
|------:|------|:----:|----|----------|------|
| — | 文档与计划（本文）| ✅ 完成 | 本 PR | 2026-06-08 | 建立 single source of truth |
| 0 | 护栏（测试 + CI）| ✅ 完成 | #89 | 2026-06-08 | 4 条聊天路径 Chunk 契约特征测试（32 用例）+ PR Test(vitest) CI；CI 全绿（type-check/test/build/SonarCloud）；lint 因存量 230 errors 暂不门禁，留待 Phase 6 |
| 1 | 版本对齐 v6 | ✅ 完成 | [#90](https://github.com/1600822305/AetherLink/pull/90) | 2026-06-08 | `ai`/`@ai-sdk/*` 升至最新稳定 v6 并 pin 精确版本；零架构改动；官方 `openai` 不动（Phase 4 删）；type-check/test(32)/build 全绿 |
| 2 | 零风险清理 | ✅ 完成 | [#91](https://github.com/1600822305/AetherLink/pull/91) | 2026-06-08 | 已删死代码 `api/providerFactory.ts`（0 引用、含误导 throw）；`tsc`/test(32)/build 全绿；`mcpToolParser`↔`mcpPrompt` 提示词统一移至 Phase 3（非等价重复、绑两基类、属行为改动）；`ts-prune` 本仓无可用输出 |
| 3 | 立契约 + 合并基类 | ✅ 完成 | [#92](https://github.com/1600822305/AetherLink/pull/92) [#93](https://github.com/1600822305/AetherLink/pull/93) [#94](https://github.com/1600822305/AetherLink/pull/94) [#95](https://github.com/1600822305/AetherLink/pull/95) [#96](https://github.com/1600822305/AetherLink/pull/96) | 2026-06-08 | 拆 4 个栈式 PR：3a 清死代码（`OpenAI/AnthropicCompatibleProvider`、`createAIProvider`、随之变死的 mcpToolParser 导出）；3b 立契约 `ai/core/types.ts`（`AIProvider`/`ProviderApi`）；3c 合并基类到 `ai/core/BaseProvider.ts` + 抽共享根 `AbstractProviderCore`，旧路径留 re-export 垫片；3d `getProviderApi` 返回 `any→ProviderApi`。每步零行为改动、type-check/test(32)/build 全绿。#96 为修栈式合并落点（3b/3c/3d 曾落中间分支）把三步并入 main |
| 4 | 适配器化（逐家）| 🔵 进行中 | [#97](https://github.com/1600822305/AetherLink/pull/97) [#99](https://github.com/1600822305/AetherLink/pull/99) [#101](https://github.com/1600822305/AetherLink/pull/101) | 2026-06-08 | 4a 补 Responses 特征测试（#97，41 用例）；4d 抽 `streamShared.ts` 去重三家 stream.ts（#99，零行为）；**4e（首步）修 openai-aisdk web search 私有参数丢弃 bug**（#101，46 用例，默认引擎未动、现网零影响）。**决策：provider.ts 保持各家独立、不去重；`*-aisdk` 目录不收敛**（重复属有意的供应商独立性，强抽=god-base 过度设计）。剩 4f–4g 灰度切默认引擎 + 删官方 openai 聊天（需 live key，待排期）|
| 5 | 工厂/路由收口 | ⬜ 未开始 | | | 改 43 处调用方 |
| 6 | 收尾（rest/ + 清理）| ⬜ 未开始 | | | |

状态图例：⬜ 未开始 / 🔵 进行中 / ✅ 完成 / ⚠️ 阻塞。

---

## 8. 变更日志（每阶段追加）

- **2026-06-08（Phase 4a/4d 完成 + 4 方向决策）** — Phase 4 改为「先补护栏 → 先去重 → 再搬目录」的安全顺序，并在量化后**调整范围**：
  - **4a 补护栏**（[#97](https://github.com/1600822305/AetherLink/pull/97)）：OpenAI **Responses** 路径此前 0 特征测试覆盖，补 9 个用例钉死 `Responses 事件 → onChunk(Chunk)` 契约（41/41）。纯加测试、零生产改动。
  - **4d 流式去重**（[#99](https://github.com/1600822305/AetherLink/pull/99)）：先前 #98 直接 `git mv` 搬 `anthropic-aisdk → ai/adapters/anthropic` 撞 SonarCloud 新代码重复率门禁（36.8% > 3%，三家 stream.ts 近乎逐字重复被算成新代码），已关闭。改为「先去重」：新建 `src/shared/ai/adapters/shared/streamShared.ts` 收纳三家逐字重复部分（`ThinkTagParser`、`BaseStreamResult/BaseStreamParams`、`getProviderConfigFromStore`、`accumulateToolCall`、`emitStreamComplete/Error`、`detectAndEmitToolUseTags`、`PROMPT_MODE_STOP_SEQUENCES`），三家 `stream.ts` 删本地副本改 import、`fullStream` 循环不动；一个 PR 同改三家（只改一家会与未迁移版本重复、仍触发门禁）。-455/+61 行，type-check/test(32)/build 全绿。
  - **⛔ 决策：放弃 provider.ts 去重 + 目录收敛。** jscpd 量化（`--min-lines 10 --min-tokens 70`）：stream 去重后三家 `*-aisdk` 目录仍 25.5% 跨家重复，`provider.ts` 占 1019 行、几乎全在 agentic 工具调用循环（`handleStreamResponse`/`handleNonStreamResponse`/`formatResult`/`processToolCalls`/`processToolUses`），跨家差异极小（日志 label + 调用 options）。评估认为这属**有意为之的供应商独立性**：每家 provider 业务逻辑应保持可读、可独立演进，为重复率指标硬塞共享基类是 god-base 反模式。故 **provider.ts 不去重、保持各家独立**；连带 **`*-aisdk` 目录不收敛到 `ai/adapters/<vendor>`**（搬动 = 旧重复重算为新代码、再触发门禁；不动 = 旧代码、不卡门禁）。§4.2「`shared/streamAdapter.ts`」的落地即 4d 的 `streamShared.ts`（只抽真·逐字重复的工具函数，不抽 provider 业务逻辑）。
  - 剩余 **4e–4g**（引擎切换 + 删官方 openai 聊天）真动运行逻辑、风险最高，需各供应商**临时 live key** 做回归，单独排期。
- **2026-06-08（Phase 4e 首步 + 分析）** — 出 Phase 4e 拆解+风险评估（`phase4e-analysis.md`），三条关键发现：①`openai-aisdk` 已是 OpenAI-compatible 客户端（`createOpenAI`+`.chat()`+自定义 baseURL/headers/fetch+`extraBody→providerOptions`），切引擎大概率**无需**装 `@ai-sdk/openai-compatible`、无需建新目录；②两层路由（`services/messages/ApiProvider.ts` 主路径 `createProviderInstance` default + `services/ai/ProviderFactory.ts` 次路径 `getProviderApi` default）默认都落官方 `OpenAIProvider`，命中官方兜底的有 `openai/deepseek/grok/siliconflow/volcengine/azure`+未识别兼容供应商；③（最大坑·已修）`OpenAIAISDKProvider` 算出 `webSearchParams` 却被 `handleStreamResponse` 丢弃、`handleNonStreamResponse` 没收到，导致 dashscope `enable_search`/openrouter `plugins`/openai `web_search_options` 在 AI SDK 路径全失效。
  - **4e 首步修复**（[#101](https://github.com/1600822305/AetherLink/pull/101)）：把 `webSearchParams` 并入 `extraBody`（web search 字段优先，对齐官方 `Object.assign` 语义），由 `stream.ts` 已有通道落到 `providerOptions.openai`；移除死字段 `webSearchParams?: any`。新增 `openai-aisdk/__tests__/web-search-params.test.ts`（5 用例）钉死透传。**默认引擎仍是官方 openai，现网零影响**（`OpenAIAISDKProvider` 仅在 `providerType==='openai-aisdk'` 时走到）。type-check/test(46)/build + CI 全绿。
  - **依赖决策（待 live 验证）**：采用**选项 1**——复用 `OpenAIAISDKProvider`（`@ai-sdk/openai` 的 `.chat()`）作默认引擎、不装 `@ai-sdk/openai-compatible`、不建新目录（契合「不收敛目录」决策）；是否最终需要 openai-compatible，由 4f live 实测「`.chat()` 是否把 `providerOptions.openai` 的任意私有字段透传进 body」决定。
- **2026-06-08** — 建立本重构计划文档与进度追踪器；完成现状诊断、SDK 版本核实（确认在 v6 最新稳定线、v7 仍 beta）、"为何官方 OpenAI 未删"的根因调查（结论：兼容生态底座 + AI SDK 版为默认关闭的实验，未发现明确的 bug 回退提交）。
- **2026-06-08** — 补充 §2 决策（保留 vs 删除官方 OpenAI：终态删、过渡先统一保留、例外按测试结果定）；新增 §2.5 `Chunk` 契约边界（论证 API 与信息块系统通过 Chunk 解耦，只要 Chunk 序列不变块系统不受影响，并列出高危改动让 Phase 0 测试覆盖）；新增 §2.6 信息块系统现状登记（~83 处 workaround，列为独立后续重构目标，不在本次 API 重构范围）。
- **2026-06-08（Phase 0）** — 为四条聊天路径补齐 Chunk 契约特征测试（openai-aisdk 流式+非流式、官方 openai `UnifiedStreamProcessor`、anthropic-aisdk、gemini-aisdk），连同既有 tools 测试共 **33 用例全绿**；新增 `.github/workflows/pr-test.yml` 把 vitest 接入 PR CI（此前仅有 type-check 与 build）；用 DeepSeek 临时 key 跑通 live 基线，证实 `raw.reasoning_content` 推理映射与契约一致；评估 lint 门禁（存量 230 errors，暂缓）。详见 §6 Phase 0。
- **2026-06-08（Phase 0 完成）** — 为通过 SonarCloud 新代码重复率门禁，将三家同构 AI SDK 测试（曾各自独立、重复率 48.8%）抽出共享参数化套件 `__tests__/shared/aisdkStreamContract.ts` 并合并进单文件 `__tests__/aisdk-stream.characterization.test.ts`（循环跑公共契约 + 各家特有推理用例），重复率降至达标；合并后 **32 用例全绿**，PR #89 CI 全绿（type-check / test / build / SonarCloud）。**Phase 0 标记完成**，可开始 Phase 1（版本对齐）。
- **2026-06-08（Phase 1 完成）** — 版本对齐（零架构/逻辑改动）：把 `ai` `^6.0.103→6.0.197`、`@ai-sdk/openai` `^3.0.33→3.0.68`、`@ai-sdk/anthropic` `^3.0.47→3.0.81`、`@ai-sdk/google` `^3.0.33→3.0.80` 升至 npm 最新稳定 v6，并按"锁版本"要求 **pin 成精确版本（去 `^`）**；v7 仍 beta 未升。官方 `openai`（6.25.0）**保持不动**（Phase 4 删除目标，且本 Phase 范围仅含 `ai`/`@ai-sdk/*`）。`package-lock.json` 改动仅落在 `ai`/`@ai-sdk/*` 子树（含传递依赖 `@ai-sdk/provider`/`provider-utils`/`gateway`、`@vercel/oidc`、`eventsource-parser`），无不相关包变动。本机验证全绿：`type-check`（增量 + `tsc --noEmit` 全量）、`npm test` 32/32（Phase 0 Chunk 契约护栏未回归）、`vite build`（7990 modules）。PR [#90](https://github.com/1600822305/AetherLink/pull/90)。
- **2026-06-08（Phase 2 完成）** — 零风险清理：删除死代码 `src/shared/api/providerFactory.ts`（整文件 90 行）。该文件 **0 引用**（barrel `api/index.ts` 未 re-export，导出名仅文件内自引），且内含**误导性** `throw 'Anthropic/Gemini 尚未实现'`，而这两家实际已迁 AI SDK 实现；真工厂是 `services/ai/ProviderFactory.ts`。删后本机 `tsc --noEmit` / `npm test` 32/32 / `vite build`(7990 modules) 全绿，零行为改动。PR [#91](https://github.com/1600822305/AetherLink/pull/91)。**范围调整**：①`mcpToolParser` ↔ `mcpPrompt` 的「合并」经读码确认**不是行为等价的重复**——`getMCPSystemPrompt`（中文追加式，仅 OpenAI Responses 经 `providers/BaseAIProvider` 用）与 `buildSystemPrompt`（英文/Agentic 替换式，所有主 provider 经 `api/baseProvider` 用）是两套不同提示词，统一会改 Responses 提示词文本（行为改动），且分别绑定 Phase 3 待合并的两个基类，故**移至 Phase 3** 随基类合并一起做；②`ts-prune` 在本仓 TS 配置下无可用输出，未出清单，留作后续（不阻塞）。
- **2026-06-08（Phase 3 完成）** — 立契约 + 合并基类，拆成 4 个栈式 PR，每步零运行行为改动、本机 `tsc`/`npm test` 32/32/`vite build` 全绿：
  - **3a**（PR [#92](https://github.com/1600822305/AetherLink/pull/92)）清死代码：删 `providers/BaseAIProvider.ts` 中 0 引用的 `OpenAICompatibleProvider`/`AnthropicCompatibleProvider`/`createAIProvider` 及仅服务它们的死方法（`getSystemPromptWithTools`、2 参 `processToolCalls`/`processToolUses`、`isToolUseEnabled`），并删 `mcpToolParser` 中随之变死的导出（`getMCPSystemPrompt`、`mcpToolsTo{OpenAI,Anthropic,Gemini}Tools`）。**修正 Phase 2 的判断**：`getMCPSystemPrompt` 唯一调用者 `getSystemPromptWithTools` 全仓 0 引用 → 那套中文提示词是死代码，“统一两套提示词”实为删死的、留唯一在用的 `buildSystemPrompt`，近零风险。保留 Responses 在用的 `BaseOpenAIResponseProvider` 链。
  - **3b**（PR [#93](https://github.com/1600822305/AetherLink/pull/93)）立契约：新增 `src/shared/ai/core/types.ts`，定义 `AIProvider`（provider 实例面：`sendChatMessage`/`testConnection`/`convertMcpTools`）与 `ProviderApi`（工厂返回面：`sendChatRequest`/`testConnection?`/`fetchModels?`）；`AbstractBaseProvider implements AIProvider` 证明 5 个主 provider 符合契约，仅类型标注、零逻辑改动。
  - **3c**（PR [#94](https://github.com/1600822305/AetherLink/pull/94)）合并基类：新增 `src/shared/ai/core/BaseProvider.ts` 作为基类家族唯一承载处，抽出真正共有的根 `AbstractProviderCore`（`model` + 构造器 + 抽象 `convertMcpTools<T>`），消除 §1 点名的「两基类都声明 `convertMcpTools<T>`」重复；`api/baseProvider.ts` 与 `providers/BaseAIProvider.ts` 变为 re-export 垫片，下游 import 不变。按 ISP/LSP，`sendChatMessage` 系（`AbstractBaseProvider`，5 主 provider）与 `completions` 系（`BaseOpenAIResponseProvider`，Responses）保持独立分支，不强并为单一具体基类。
  - **3d**（PR [#95](https://github.com/1600822305/AetherLink/pull/95)）收紧返回类型：`getProviderApi(model): any → ProviderApi`，逼出 `model-combo` 分支无 `testConnection` 的真实耦合 → 将契约 `testConnection` 改为可选并对唯一调用方加等价守卫（`model-combo` 旧行为 `undefined()` 抛错→catch→`false`，新行为直接 `false`，可观测等价）。
  - **落点修复**（PR [#96](https://github.com/1600822305/AetherLink/pull/96)）：3b/3c/3d 的栈式 PR 当时 base 指向各自上游特性分支，合并后落到了中间分支而非 main（GitHub 栈式 PR 常见陷阱）；#96 把这三个 commit 一次性并入 main（3a 已是 main 祖先，diff 不含 3a）。
  - **遗留风险**：OpenAI Responses 路径（`OpenAIResponseProvider`）仍 0 特征测试覆盖（Phase 0 仅覆盖 3 家 AI SDK + 官方 openai 4 条路径）；本阶段未动其运行逻辑（仅搬基类定义 + 留垫片）。§4.1 的归一化目标契约（`chat(params): ChatResult`）需先补 Responses 特征测试再做，作为独立里程碑。

---

## 9. 新会话接手指南

1. 读本文 §1~§5，建立背景。
2. 看 §7 进度表，找到第一个非 ✅ 的 Phase，即当前任务。
3. 按 §6 对应 Phase 的描述推进；**只做当前 Phase，不跨阶段**。
4. 动手前先确认 Phase 0 护栏存在（特征测试 + CI）；若不存在，先补 Phase 0。
5. 完成后：跑 `npm run type-check`、`npm run lint`、`npm test`（或 `vitest run`）；更新 §7 进度表 + §8 日志；提独立 PR。
6. 遇到 §2 提到的"功能不正常"线索，务必在 §8 记录具体供应商/功能，避免重复踩坑。
