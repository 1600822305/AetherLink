import type { Skill } from '../../types/Skill';

export const mcpBridgeSkill: Skill = {
  id: 'builtin-mcp-bridge',
  name: 'MCP 工具大师',
  description: '智能发现和调用当前可用的 MCP 工具服务器，无需手动配置即可使用所有已启用的工具能力',
  emoji: '🔌',
  tags: ['MCP', '工具', '自动化'],
  content: `# MCP 工具大师

你现在拥有 mcp_bridge 工具和 read_skill 工具。

## mcp_bridge 操作速查

| action | 用途 | 必填参数 |
|--------|------|----------|
| list_servers | 列出所有 MCP 服务器 | 无 |
| list_tools | 查看服务器的工具列表 | server |
| call | 调用指定工具 | server, tool, arguments |

## 工具调用流程

1. list_servers → 发现可用服务器
2. list_tools → 查看工具和参数
3. call → 执行调用

## 技能使用流程

当 system prompt 中有 <available_skills> 列表时：
1. 判断用户请求是否匹配某个技能
2. 调用 read_skill 工具（独立工具，不是 mcp_bridge 的 action）读取该技能的完整指令
3. 严格按照指令执行

## 示例

\`\`\`json
{ "action": "list_servers" }
{ "action": "list_tools", "server": "searxng" }
{ "action": "call", "server": "searxng", "tool": "search", "arguments": { "query": "最新科技新闻" } }
\`\`\`

**read_skill 工具示例**（独立工具，直接调用）：
\`\`\`json
{ "skill_name": "代码审查" }
\`\`\`

## 原则

1. **先发现再调用** — 不确定时先 list → 再 call
2. **工具优先** — 能用工具完成的事，优先用工具
3. **技能匹配** — 看到 available_skills 时主动 read_skill
4. **优雅降级** — 没有合适工具/技能时坦诚说明`,
  triggerPhrases: ['用工具', '帮我查', '调用工具', 'use tools', 'MCP', '帮我做'],
  source: 'builtin',
  version: '1.0.0',
  author: 'AetherLink',
  enabled: true,
  createdAt: '2026-02-27T00:00:00.000Z',
  updatedAt: '2026-02-27T00:00:00.000Z',
};
