/**
 * MCP Bridge Tool — OpenClaw 式动态工具调用
 *
 * 核心思想：用 1 个虚拟工具替代注入所有 MCP 工具定义
 * 模型通过此工具按需发现和调用任意 MCP server 的工具
 *
 * 对比：
 *   传统模式：tools = [tool1, tool2, ..., tool50]  → 大量上下文
 *   桥梁模式：tools = [mcp_bridge]                  → 1 个工具定义
 */

import type { MCPTool, MCPCallToolResponse } from '../../types';
import { mcpService } from './index';
import { createLogger } from '../infra/logger';

const logger = createLogger('McpBridge');


// ======================== 工具定义 ========================

/** Bridge 工具的 MCPTool 定义（注入到 API 的 tools 参数中） */
export const MCP_BRIDGE_TOOL_DEFINITION: MCPTool = {
  name: 'mcp_bridge',
  description: '动态调用 MCP 工具服务器。支持：list_servers（列出服务器）、list_tools（列出工具）、call（调用工具）。',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['list_servers', 'list_tools', 'call'],
        description: '操作类型：list_servers=列出服务器，list_tools=列出工具，call=调用工具',
      },
      server: {
        type: 'string',
        description: '服务器名称（list_tools 和 call 时必填）',
      },
      tool: {
        type: 'string',
        description: '工具名称（call 时必填）',
      },
      arguments: {
        type: 'object',
        description: '工具调用参数（call 时使用）',
        additionalProperties: true,
      },
    },
    required: ['action'],
  },
  serverName: '__bridge__',
  serverId: '__bridge__',
};

/** Bridge 工具的名称常量 */
export const MCP_BRIDGE_TOOL_NAME = 'mcp_bridge';

/** Bridge 技能的 ID */
export const MCP_BRIDGE_SKILL_ID = 'builtin-mcp-bridge';

// ======================== 执行器 ========================

/**
 * 执行 bridge 工具调用
 * 根据 action 分发到不同的处理逻辑
 */
export async function executeBridgeToolCall(
  args: Record<string, any>,
): Promise<MCPCallToolResponse> {
  const { action, server, tool, arguments: toolArgs } = args;

  try {
    switch (action) {
      case 'list_servers':
        return await handleListServers();
      case 'list_tools':
        return await handleListTools(server);
      case 'call':
        return await handleCallTool(server, tool, toolArgs || {});
      default:
        return makeErrorResponse(`未知操作: ${action}。支持的操作: list_servers, list_tools, call`);
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`执行失败:`, error);
    return makeErrorResponse(`Bridge 执行失败: ${msg}`);
  }
}

// ======================== Action 处理器 ========================

/**
 * list_servers — 列出所有已配置的 MCP 服务器
 */
async function handleListServers(): Promise<MCPCallToolResponse> {
  const allServers = await mcpService.getServersAsync();

  if (allServers.length === 0) {
    return makeTextResponse('当前没有配置任何 MCP 服务器。请在设置中添加 MCP 服务器。');
  }

  const serverList = allServers.map(s => ({
    name: s.name,
    id: s.id,
    type: s.type || 'unknown',
    isActive: s.isActive,
    description: s.description || '',
  }));

  const summary = allServers.map(s =>
    `- ${s.name} [${s.isActive ? '✅ 已启用' : '⬚ 未启用'}] ${s.description || ''}`
  ).join('\n');

  return makeTextResponse(
    `可用的 MCP 服务器（${allServers.length} 个）：\n${summary}\n\n` +
    `提示：使用 list_tools 查看具体服务器的工具列表，使用 call 调用工具。\n` +
    `注意：仅已启用（✅）的服务器可以调用，未启用的服务器需先在设置中手动启用。\n\n` +
    `详细数据：\n${JSON.stringify(serverList, null, 2)}`
  );
}

/**
 * list_tools — 列出指定服务器的工具
 * 如果服务器未启动，会临时连接获取工具列表
 */
async function handleListTools(serverName?: string): Promise<MCPCallToolResponse> {
  if (!serverName) {
    return makeErrorResponse('list_tools 需要提供 server 参数（服务器名称）');
  }

  // 查找服务器
  const server = await findServerByName(serverName);
  if (!server) {
    const available = (await mcpService.getServersAsync()).map(s => s.name).join(', ');
    return makeErrorResponse(
      `未找到服务器: "${serverName}"。可用的服务器: ${available || '无'}`
    );
  }

  try {
    // 获取工具列表（会自动建立连接）
    const tools = await mcpService.listTools(server);

    if (tools.length === 0) {
      return makeTextResponse(`服务器 "${server.name}" 没有提供任何工具。`);
    }

    const toolList = tools.map(t => ({
      name: t.name,
      description: t.description || '',
      parameters: t.inputSchema,
    }));

    const summary = tools.map(t =>
      `- ${t.name}: ${t.description || '无描述'}`
    ).join('\n');

    return makeTextResponse(
      `服务器 "${server.name}" 提供 ${tools.length} 个工具：\n${summary}\n\n` +
      `详细参数：\n${JSON.stringify(toolList, null, 2)}`
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return makeErrorResponse(`获取服务器 "${server.name}" 的工具列表失败: ${msg}`);
  }
}

/**
 * call — 调用指定服务器的指定工具
 * 如果服务器未启动，会自动连接
 */
async function handleCallTool(
  serverName?: string,
  toolName?: string,
  toolArgs: Record<string, any> = {},
): Promise<MCPCallToolResponse> {
  if (!serverName) {
    return makeErrorResponse('call 需要提供 server 参数（服务器名称）');
  }
  if (!toolName) {
    return makeErrorResponse('call 需要提供 tool 参数（工具名称）');
  }

  // 查找服务器
  const server = await findServerByName(serverName);
  if (!server) {
    const available = (await mcpService.getServersAsync()).map(s => s.name).join(', ');
    return makeErrorResponse(
      `未找到服务器: "${serverName}"。可用的服务器: ${available || '无'}`
    );
  }

  logger.debug(`调用 ${server.name}.${toolName}`, toolArgs);

  // 执行调用（MCPService.callTool 内部会处理连接和重试）
  const result = await mcpService.callTool(server, toolName, toolArgs);
  return result;
}

// ======================== 辅助函数 ========================

/**
 * 按名称查找服务器（模糊匹配）
 */
async function findServerByName(name: string) {
  const servers = await mcpService.getServersAsync();

  // 精确匹配
  let server = servers.find(s => s.name === name);
  if (server) return server;

  // 不区分大小写
  server = servers.find(s => s.name.toLowerCase() === name.toLowerCase());
  if (server) return server;

  // 部分匹配
  server = servers.find(s => s.name.toLowerCase().includes(name.toLowerCase()));
  return server || null;
}

function makeTextResponse(text: string): MCPCallToolResponse {
  return { content: [{ type: 'text', text }], isError: false };
}

function makeErrorResponse(text: string): MCPCallToolResponse {
  return { content: [{ type: 'text', text }], isError: true };
}
