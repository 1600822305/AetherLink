# 页面返回导航完整指南

本文档描述项目中所有"返回"行为的工作机制，包括：

1. 全局硬件返回键处理（`BackButtonHandler`）
2. 固定返回路由表（`settingsRoutes` 层级映射）
3. 智能返回架构（`useSmartBack` + `backTo` 来源标记）
4. 新增页面/新增跨上下文跳转的接入指引

相关源码：

| 文件 | 作用 |
| --- | --- |
| `src/components/BackButtonHandler.tsx` | 全局硬件返回键/Escape 键处理，含固定返回路由表 |
| `src/shared/hooks/useSmartBack.ts` | 智能返回 hook 与 `backTo` 读取工具 |
| `src/shared/hooks/useBackButton.ts` | 底层返回键事件监听（Capacitor backButton / Escape） |

---

## 1. 返回方式总览

项目中有两类"返回"入口，两者必须保持行为一致：

- **页面内返回按钮**：各页面 AppBar 左上角的箭头按钮，调用页面自己的 `handleBack`。
- **硬件返回键**：Android 实体/手势返回键（Capacitor `backButton` 事件）、Tauri Android 转发的 Escape、桌面/Web 的 Escape 键。统一由全局组件 `BackButtonHandler` 处理。

`BackButtonHandler.handleBackButton` 的处理优先级：

1. **关闭打开的对话框**（LIFO 顺序，`useAppState` 的 `hasOpenDialogs`/`closeLastDialog`）
2. `/chat`、`/welcome` 主页面 → 弹出退出确认对话框
3. `/settings*`、`/devtools`、`/knowledge/*` → 走 `handleSettingsBack` 智能返回（见下）
4. 其他页面 → 返回 `/chat`

> 注意：项目使用 HashRouter，`BackButtonHandler` 通过 `window.location.hash.replace('#', '')` 读取当前路径。

## 2. 固定返回路由表（settingsRoutes）

`handleSettingsBack` 内维护了一张**静态层级映射表**，定义每个设置页的默认上级页面：

```ts
const settingsRoutes: { [key: string]: string } = {
  '/settings': '/chat',                       // 主设置页 → 聊天页
  '/settings/web-search': '/settings',        // 一级设置页 → 主设置页
  '/settings/appearance/chat-interface': '/settings/appearance', // 二级 → 一级
  '/devtools': '/settings/about',
  // ...
};
```

表中找不到时还有一系列**动态路由规则**（按代码顺序）：

- `/settings/notes/edit?from=chat` → `/chat`（历史遗留的 query 参数方案，新代码请用 `backTo`）
- `/settings/model-provider/:id[/sub]` → 四级回三级、三级回 `/settings/default-model`
- `/settings/skills/:id` → `/settings/skills`
- `/settings/mcp-server/:id` → `/settings/mcp-server?tab=0`
- `/settings/mcp-assistant/:serverId[/domain/:domain]` → 助手详情 / `/settings/mcp-server?tab=2`
- `/settings/model-combo/:id` → `/settings/model-combo`
- `/settings/workspace/:id` → `/settings/workspace`
- `/knowledge/:id[/edit|/document/:file]` → 逐级回退到 `/settings/knowledge`
- 兜底：`navigate('/settings')`

这张表回答的是"**没有任何来源信息时，这个页面默认应该回到哪里**"。

## 3. 智能返回架构（useSmartBack + backTo）

固定路由表的问题：当用户**从聊天页的弹窗/菜单直接跳进某个设置子页**（跨上下文跳转）时，按返回会回到 `/settings` 一级页，而不是用户来的地方。

解决方案：跳转时通过 **react-router 的 location.state 携带 `backTo` 来源路径**，返回时优先回到来源。

### 机制

- react-router 会把 `navigate(path, { state })` 的 state 存进 `window.history.state.usr`，因此：
  - 页面组件可以通过 `useLocation().state` 读取；
  - 全局的 `BackButtonHandler`（非路由组件上下文）可以通过 `getBackToFromHistory()` 读取同一份数据。
- 两条返回路径（页面按钮 + 硬件返回键）读的是同一个 `backTo`，天然保持一致。
- 刷新页面后 history state 仍在；普通从设置一级页进入时没有 `backTo`，行为与原来完全相同。

### API（src/shared/hooks/useSmartBack.ts）

```ts
// 页面内使用：返回 handleBack 函数，优先回 backTo，否则回 fallbackPath
function useSmartBack(fallbackPath: string): () => void;

// 从任意路由 state 中读取 backTo
function getBackTo(state: unknown): string | undefined;

// 供非组件环境（BackButtonHandler）读取当前 history 中的 backTo
function getBackToFromHistory(): string | undefined;
```

`BackButtonHandler.handleSettingsBack` 的第一步就是检查 `getBackToFromHistory()`，命中则直接返回来源页，**优先级高于固定路由表**。

### 已接入的跨上下文入口

| 入口（来源） | 目标页面 |
| --- | --- |
| 搜索提供商选择弹窗（点击"需要配置"的提供商 / "搜索设置"入口） | `/settings/web-search` |
| MCP 快捷面板（输入框工具按钮） | `/settings/mcp-server`、`/settings/skills` |
| 侧边栏 MCP 控件 | `/settings/mcp-server` |
| AI 辩论按钮弹窗的"前往设置" | `/settings/ai-debate` |
| 消息导出菜单"保存为笔记"（未配置时） | `/settings/notes` |

已使用 `useSmartBack` 的页面：`WebSearchSettings`、`MCPServerSettings`、`SkillsSettings`、`AIDebateSettings`、`NoteSettings`。

### 扩展：携带额外意图

`backTo` 之外还可以在 state 里携带其他意图字段。例如搜索提供商弹窗跳转时会带 `selectProvider`，`WebSearchSettings` 挂载时自动在下拉框中选中对应提供商：

```ts
// 入口
navigate('/settings/web-search', {
  state: { backTo: location.pathname, selectProvider: providerId }
});

// 目标页
useEffect(() => {
  const selectProvider = (location.state as { selectProvider?: string } | null)?.selectProvider;
  if (selectProvider) dispatch(setWebSearchProvider(selectProvider as WebSearchProvider));
}, [location.state, dispatch]);
```

## 4. 新页面 / 新跳转的接入指引

### 4.1 新增一个普通设置页面

1. 在 `BackButtonHandler.tsx` 的 `settingsRoutes` 表中加一行，声明它的默认上级：

   ```ts
   '/settings/my-new-page': '/settings',
   ```

   动态路由（带 `:id`）则在表后面的动态规则区按现有写法加一条 `startsWith` 判断。

2. 页面的返回按钮使用 `useSmartBack`，参数填与路由表一致的默认上级：

   ```ts
   import { useSmartBack } from '../../shared/hooks/useSmartBack';

   const handleBack = useSmartBack('/settings');
   // <IconButton onClick={handleBack}>...
   ```

   即使页面暂时没有跨上下文入口，也建议直接用 `useSmartBack`（无 `backTo` 时等价于固定返回），以后接入新入口时页面无需再改。

### 4.2 新增一个跨上下文跳转入口

在跳转处携带 `backTo`（以及需要的话其他意图字段）：

```ts
import { useNavigate, useLocation } from 'react-router-dom';

const navigate = useNavigate();
const location = useLocation();

navigate('/settings/my-new-page', { state: { backTo: location.pathname } });
```

只要目标页面用了 `useSmartBack`，页面返回按钮和硬件返回键就都会回到来源页，无需改 `BackButtonHandler`。

### 4.3 检查清单

- [ ] `settingsRoutes`（或动态规则区）已声明页面的默认上级
- [ ] 页面 `handleBack` 使用 `useSmartBack(默认上级)`，两处回退路径一致
- [ ] 所有跨上下文入口的 `navigate` 都带了 `{ state: { backTo: location.pathname } }`
- [ ] 不要再新增 `from=chat` 之类的 query 参数方案（`/settings/notes/edit` 为历史遗留）

## 5. 常见问题

**Q: 为什么不用 `navigate(-1)`？**
A: `navigate(-1)` 依赖浏览器历史栈，刷新、深链接进入或历史栈被对话框路由污染时行为不可控；且硬件返回键处理器无法判断"上一条历史"是哪个页面。显式的 `backTo` + 固定回退表行为可预期。

**Q: 用户从来源页跳转后又在设置内部继续导航，返回会怎样？**
A: `backTo` 跟随具体的 history 条目。继续向更深层导航时新条目没有 `backTo`，会按固定路由表逐级返回；回到带 `backTo` 的那个条目时才会跳回来源页。

**Q: 对话框打开时按返回键？**
A: `BackButtonHandler` 优先关闭最后打开的对话框（LIFO），不会触发页面级返回。
