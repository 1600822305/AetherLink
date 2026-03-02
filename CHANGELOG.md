# AetherLink 更新日志

## v0.6.3 (2026-03-02)

### 新功能

- **MCP 服务器分类体系** — 新增 `external`/`builtin`/`assistant` 三类分类，MCP 设置页改为 Tab 布局，支持左右滑动切换
- **AI Settings MCP Server** — 新增 AI 智能助手管理应用设置 + 敏感操作确认系统
- **@aether/grok-search 内置搜索工具** — 基于 ai-search-mcp 的内置 AI 搜索工具
- **@aether/searxng 内置搜索工具** — 添加 SearXNG 内置 MCP 搜索工具，支持翻页和安全搜索参数
- **OpenClaw 风格技能系统** — 拆分 MCP/技能独立开关 + 新闻分析技能 + `read_skill` 独立工具 + 桥梁模式全局设置
- **统一引用系统** — CitationBlock 同时承载知识库 + Web 搜索引用，知识库引用角标点击可展开查看全文
- **多知识库并行搜索** — 实现工作负载感知的并发任务队列系统，支持多知识库同时搜索
- **知识库专业功能增强** — PDF 预处理架构升级、批量向量化性能优化
- **MCP 工具面板升级** — 输入框 MCP 工具面板改为领域分组视图 + 子 Tab 切换
- **助手详情页优化** — 分组总开关 + 固定高度滚动 + 展开性能优化
- **模型供应商智能化** — 新增 `providers.tools.ts` 工具模块，统一供应商名称显示
- **单例运行功能** — Tauri 桌面端添加单例运行支持
- **统一发布工作流** — CI 添加 `v*` tag 自动构建全平台并发布到 GitHub Releases

### 架构重构

- **统一消息存储架构** — 移除双重存储架构，统一使用 messages 表，解决 P0 级数据丢失问题
- **统一网络 fetch 层** — 消除 4 个 provider 重复代码，重设计代理设置页面，支持 SOCKS5 代理
- **服务层目录重组** — 按领域重组目录结构，精简 `services/index.ts`（300 行→59 行）
- **输入框系统重构** — 清理冗余组件仅保留 `IntegratedChatInput`，抽取 `useInputState` hook，DRY/类型安全/Redux 迁移
- **settingsSlice 重构** — 消除双重持久化、简化 loadSettings、文件拆分
- **统一 regenerateResponse** — 合并 `resendUserMessage` 和 `regenerateMessage`，减少约 150 行重复代码，用户重发支持版本管理
- **MCP 设置页组件拆分** — 权限系统强化 + Tab 记忆
- **知识库设置页面重构** — PDF 预处理架构升级
- **全局替换 Scrollbar 组件** — 移除所有手动 webkit-scrollbar 样式

### Bug 修复

- **修复移动端 MCP 连接失败** — 修复 Capacitor 移动端连接 Termux 等本地 MCP 服务器时报错 `Response with null body status cannot have body`，正确处理 HTTP 204/205/304 null-body 状态码
- **修复 stdio MCP 子进程退出后状态不同步** — 子进程退出后自动清理缓存，避免复用死连接；`ping()` 改为检测子进程存活状态，支持断连检测
- **修复 Windows 平台 npx 命令检测不可靠** — 改用 `platformDetection.isWindows()`
- **stdio MCP 添加 cwd 工作目录支持** — `MCPServer` 新增 `cwd` 字段，全链路透传到 `Command.create()`
- **修复 P0 数据丢失和文件粘贴问题**
- **修复消息重复和流式显示问题**
- **修复 MCP 服务器配置竞态条件**
- **修复 MCP stdio 相关问题**（Tauri 桌面端）
- **修复话题标题/追加提示词被锁死**和模型切换按钮显示不一致
- **修复知识库功能多个问题**
- **修复侧边栏助手按拼音排序无效**
- **防止 prompt 模式下工具调用幻觉**（模型伪造 tool_use_result）
- **修复模型供应商配置页面多个 bug**
- **修复翻译页面输入区白底问题** + 硬编码颜色改为主题 token
- **修复嵌入模型选择器显示供应商 ID 而非名称**
- **修复翻译页面记忆源语言和目标语言选择**
- **修复 Tauri 桌面端全屏对话框顶部被窗口标题栏遮挡**
- **修复 SOCKS5 代理连接问题**
- **修复模型添加按钮点击偏移**（触感按钮鼠标事件处理）
- **修复知识库引用块样式** — 背景对齐毛玻璃样式、点击高亮闪烁
- **修复 MCP 工具面板列表项文字与按钮/开关重叠**
- **修复子 Tab 滑动与主 Tab 滑动手势冲突**
- **修复侧边栏快捷入口关闭后重启又出现**
- **修复滚动条布局抖动**

### 性能优化

- **升级到 Vite 8 Beta** (8.0.0-beta.16)
- **替换 plugin-react-swc 为 plugin-react@5.x** (Oxc 原生编译)
- **批量向量化优化** — 知识库嵌入性能提升

### 依赖升级

- **AI SDK v5 → v6**
- **更新 37 项依赖**（axios、lodash、react-router-dom、react 等安全修复）
- **清理死代码和废弃文件**
