/**
 * MCP 工具执行器
 * 职责：工具列举、调用（含重试和确认拦截）、提示词和资源列举
 */
import type { MCPServer, MCPTool, MCPPrompt, MCPResource, MCPCallToolResponse } from '../../../types';
import { isMemoryTool } from '../../memory/memoryTools';
import { handleMemoryToolCall } from '../../memory/memoryToolHandler';
import { ToolConfirmationService } from '../confirmation/ToolConfirmationService';
import type { MCPConnectionManager } from './MCPConnectionManager';
import type { MCPServerStore } from './MCPServerStore';

/**
 * 构建函数调用工具名称
 */
function buildFunctionCallToolName(serverName: string, toolName: string): string {
  const sanitizedServer = serverName.trim().replace(/-/g, '_');
  const sanitizedTool = toolName.trim().replace(/-/g, '_');

  let name = sanitizedTool;
  if (!sanitizedTool.includes(sanitizedServer.slice(0, 7))) {
    name = `${sanitizedServer.slice(0, 7) || ''}-${sanitizedTool || ''}`;
  }

  name = name.replace(/[^a-zA-Z0-9_-]/g, '_');

  if (!/^[a-zA-Z]/.test(name)) {
    name = `tool-${name}`;
  }

  name = name.replace(/[_-]{2,}/g, '_');

  if (name.length > 63) {
    name = name.slice(0, 63);
  }

  if (name.endsWith('_') || name.endsWith('-')) {
    name = name.slice(0, -1);
  }

  return name;
}

export class MCPToolExecutor {
  constructor(
    private connectionManager: MCPConnectionManager,
    private serverStore: MCPServerStore
  ) {}

  // ── 工具列举 ──────────────────────────────────

  async listTools(server: MCPServer): Promise<MCPTool[]> {
    try {
      console.log(`[MCP] 获取服务器工具: ${server.name}`);

      const client = await this.connectionManager.initClient(server);
      console.log(`[MCP] 客户端已连接，正在调用 listTools...`);

      const result = await client.listTools();
      console.log(`[MCP] listTools 响应:`, result);

      const allTools = result.tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        serverName: server.name,
        serverId: server.id,
        id: buildFunctionCallToolName(server.name, tool.name)
      }));

      const disabledTools = server.disabledTools || [];
      const tools = disabledTools.length > 0
        ? allTools.filter(tool => !disabledTools.includes(tool.name))
        : allTools;

      if (disabledTools.length > 0) {
        console.log(`[MCP] 服务器 ${server.name} 过滤了 ${allTools.length - tools.length} 个禁用工具`);
      }
      console.log(`[MCP] 服务器 ${server.name} 返回 ${tools.length} 个工具:`, tools.map(t => t.name));
      return tools;
    } catch (error) {
      console.error(`[MCP] 获取工具列表失败:`, error);
      return [];
    }
  }

  async getAllAvailableTools(): Promise<MCPTool[]> {
    const allServers = await this.serverStore.getServersAsync();
    const activeServers = await this.serverStore.getActiveServersAsync();
    const allTools: MCPTool[] = [];

    console.log(`[MCP] 总服务器数量: ${allServers.length}, 活跃服务器数量: ${activeServers.length}`);

    if (allServers.length > 0) {
      console.log(`[MCP] 所有服务器:`, allServers.map(s => `${s.name}(${s.isActive ? '活跃' : '非活跃'})`).join(', '));
    }

    if (activeServers.length === 0) {
      console.log(`[MCP] 没有活跃的 MCP 服务器`);
      return allTools;
    }

    for (const server of activeServers) {
      try {
        console.log(`[MCP] 正在获取服务器 ${server.name} 的工具...`);
        const tools = await this.listTools(server);
        console.log(`[MCP] 服务器 ${server.name} 提供 ${tools.length} 个工具`);
        allTools.push(...tools);
      } catch (error) {
        console.error(`[MCP] 获取服务器 ${server.name} 的工具失败:`, error);
      }
    }

    return allTools;
  }

  // ── 工具调用 ──────────────────────────────────

  async callTool(
    server: MCPServer,
    toolName: string,
    args: Record<string, any>
  ): Promise<MCPCallToolResponse> {
    // 记忆工具走内置处理器
    if (isMemoryTool(toolName)) {
      console.log(`[Memory] 调用记忆工具: ${toolName}`, args);
      const result = await handleMemoryToolCall(toolName, args);
      return {
        content: [{ type: 'text', text: result.message }],
        isError: !result.success
      };
    }

    // 禁用工具拦截
    const disabledTools = server.disabledTools || [];
    if (disabledTools.includes(toolName)) {
      console.warn(`[MCP] 工具 ${toolName} 已被用户禁用，拒绝调用`);
      return {
        content: [{ type: 'text', text: `工具 ${toolName} 已被用户禁用。` }],
        isError: true
      };
    }

    // 敏感操作确认拦截
    const confirmService = ToolConfirmationService.getInstance();
    const permOverrides = server.toolPermissionOverrides || {};
    const overriddenPerm = permOverrides[toolName];

    const needsConfirm = overriddenPerm
      ? overriddenPerm === 'confirm'
      : confirmService.needsConfirmation(toolName);

    if (needsConfirm) {
      const approved = await confirmService.requestConfirmation(
        server.name,
        toolName,
        args
      );
      if (!approved) {
        return {
          content: [{ type: 'text', text: '用户已拒绝此操作。' }],
          isError: true
        };
      }
    }

    // 带重试的工具调用
    const maxRetries = 3;
    let lastError: any;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        console.log(`[MCP] 调用工具: ${server.name}.${toolName} (尝试 ${attempt + 1}/${maxRetries})`, args);

        const client = await this.connectionManager.initClient(server);
        const result = await client.callTool(
          { name: toolName, arguments: args },
          undefined,
          { timeout: (server.timeout || 60) * 1000 }
        );

        return {
          content: result.content as Array<{
            type: 'text' | 'image' | 'resource';
            text?: string;
            data?: string;
            mimeType?: string;
          }>,
          isError: Boolean(result.isError)
        };
      } catch (error) {
        lastError = error;
        console.warn(`[MCP] 工具调用失败 (尝试 ${attempt + 1}/${maxRetries}):`, error);

        if (attempt < maxRetries - 1) {
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    console.error(`[MCP] 工具调用最终失败:`, lastError);
    return {
      content: [
        {
          type: 'text',
          text: `工具调用失败: ${lastError instanceof Error ? lastError.message : '未知错误'}`
        }
      ],
      isError: true
    };
  }

  // ── 提示词 / 资源 ────────────────────────────

  async listPrompts(server: MCPServer): Promise<MCPPrompt[]> {
    try {
      console.log(`[MCP] 获取服务器提示词: ${server.name}`);

      const client = await this.connectionManager.initClient(server);
      const result = await client.listPrompts();

      return result.prompts.map(prompt => ({
        name: prompt.name,
        description: prompt.description,
        arguments: prompt.arguments,
        serverName: server.name,
        serverId: server.id
      }));
    } catch (error) {
      if (error instanceof Error && error.message.includes('-32601')) {
        console.log(`[MCP] 服务器 ${server.name} 不支持提示词功能`);
        return [];
      }
      console.error(`[MCP] 获取提示词列表失败:`, error);
      return [];
    }
  }

  async listResources(server: MCPServer): Promise<MCPResource[]> {
    try {
      console.log(`[MCP] 获取服务器资源: ${server.name}`);

      const client = await this.connectionManager.initClient(server);
      const result = await client.listResources();

      return result.resources.map(resource => ({
        uri: resource.uri,
        name: resource.name,
        description: resource.description,
        mimeType: resource.mimeType,
        serverName: server.name,
        serverId: server.id
      }));
    } catch (error) {
      if (error instanceof Error && error.message.includes('-32601')) {
        console.log(`[MCP] 服务器 ${server.name} 不支持资源功能`);
        return [];
      }
      console.error(`[MCP] 获取资源列表失败:`, error);
      return [];
    }
  }
}
