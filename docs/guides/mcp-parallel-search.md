# Parallel Search MCP 使用指南 | Setup guide

[English](#english) | [中文](#中文)

## English

[Parallel Search MCP](https://docs.parallel.ai/integrations/mcp/search-mcp) provides free web search and page fetching without an account or API key. Anonymous searches use Fast mode. This guide covers the **Tauri desktop app**, using AetherLink's existing external MCP server settings.

### Import the server

1. Open **Settings → MCP Server → External → Import Config**.
2. Paste the following JSON and select **Import**:

   ```json
   {
     "mcpServers": {
       "Parallel Search MCP": {
         "type": "streamableHttp",
         "url": "https://search.parallel.ai/mcp",
         "headers": {
           "User-Agent": "AetherLink/0.6.5"
         }
       }
     }
   }
   ```

3. Turn on the imported server. Imports are initially inactive.
4. Open its details and select **Test**. After a successful connection, the **Tools** section should contain `web_search` and `web_fetch`.

Keep `"type": "streamableHttp"` in the JSON. AetherLink's importer treats a URL-only entry as SSE, which is a different transport. This is an in-app configuration; paste it into **Import Config**, not the repository's `.cursor/mcp.json`.

### Research in chat

Use a configured model that supports tool calling. Open the chat's MCP tools panel (wrench icon), enable MCP tools and make sure **Parallel Search MCP** is active. For example, ask:

> Use Parallel's web_search to find the current stable TypeScript release on the official TypeScript site. Then use web_fetch on the release announcement and summarize three changes with source URLs.

`web_search` takes an `objective` and a nonempty `search_queries` array. `web_fetch` takes a `urls` array and can use an `objective` to focus the returned excerpts. Inspect the tool results and source URLs before relying on the answer. Enabling this server does not select a provider in AetherLink's separate web search settings.

### Troubleshooting and limits

- **Connection fails:** check the exact `/mcp` URL, Streamable HTTP type and network access. `/mcp-oauth` requires authentication and is not the anonymous endpoint used here.
- **No tool calls:** check both the server switch and the chat's MCP tools switch, and use a model with tool calling enabled. A connection test checks the server connection, not the model's ability to call it.
- **Usage limit reached:** anonymous access is intended for exploration and light use. Follow the service's retry guidance and reduce request frequency. For higher limits, turn off the server, use a key from [Parallel Platform](https://platform.parallel.ai) in the server details under **Advanced → Custom Headers**, with `Authorization` as the header name and `Bearer YOUR_PARALLEL_API_KEY` as its value, save, then re-enable the server to reconnect with the new header. Keep real keys out of shared configuration.
- **Disable:** turn off only **Parallel Search MCP** in the server list when it is no longer needed.

## 中文

[Parallel Search MCP](https://docs.parallel.ai/integrations/mcp/search-mcp) 提供免费的网页搜索和网页内容提取，无需账号或 API 密钥。匿名搜索使用 Fast 模式。本指南适用于 **Tauri 桌面端**，通过 AetherLink 现有的外部 MCP 服务器设置连接。

### 导入服务器

1. 打开 **设置 → MCP 服务器 → 外部服务器 → 导入配置**。
2. 粘贴以下 JSON，点击 **导入**：

   ```json
   {
     "mcpServers": {
       "Parallel Search MCP": {
         "type": "streamableHttp",
         "url": "https://search.parallel.ai/mcp",
         "headers": {
           "User-Agent": "AetherLink/0.6.5"
         }
       }
     }
   }
   ```

3. 打开导入的服务器开关。导入后默认处于未启用状态。
4. 进入服务器详情，点击 **测试**。连接成功后，**工具** 区域应显示 `web_search` 和 `web_fetch`。

请保留 `"type": "streamableHttp"`。AetherLink 导入仅含 URL 的配置时会将其识别为 SSE，这是另一种传输方式。这是应用内配置，请粘贴到 **导入配置**，而非仓库的 `.cursor/mcp.json`。

### 在聊天中检索

选择已配置且支持工具调用的模型，打开聊天中的 MCP 工具面板（扳手图标），启用 MCP 工具，并确认 **Parallel Search MCP** 已启用。例如：

> 使用 Parallel 的 web_search 在 TypeScript 官网查找当前稳定版本，再用 web_fetch 阅读发布公告，总结三项变化并附上来源链接。

`web_search` 需要 `objective` 和非空的 `search_queries` 数组；`web_fetch` 需要 `urls` 数组，可通过 `objective` 指定内容提取目标。使用回答前，请检查工具结果及来源链接。启用此服务器不会在 AetherLink 独立的网络搜索设置中选择搜索提供商。

### 故障排除与限制

- **连接失败：** 检查 `/mcp` URL、Streamable HTTP 类型和网络连接。`/mcp-oauth` 需要认证，并非本指南使用的匿名端点。
- **模型不调用工具：** 检查服务器开关和聊天中的 MCP 工具总开关，并确认模型支持且已启用工具调用。连接测试仅检查服务器连接，不验证模型能否调用工具。
- **达到使用限制：** 匿名访问适合探索和轻量使用，请按服务返回的重试提示操作并降低请求频率。如需更高限额，请先停用服务器，从 [Parallel Platform](https://platform.parallel.ai) 获取密钥，在服务器详情的 **高级设置 → 自定义请求头** 中添加 `Authorization`，值为 `Bearer YOUR_PARALLEL_API_KEY`，保存后重新启用服务器，以新请求头建立连接。请勿在共享配置中包含真实密钥。
- **停用：** 不再需要时，在服务器列表中关闭 **Parallel Search MCP** 即可。
