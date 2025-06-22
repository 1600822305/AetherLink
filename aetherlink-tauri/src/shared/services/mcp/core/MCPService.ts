import type { MCPServer, MCPTool, MCPPrompt, MCPResource, MCPCallToolResponse } from '../../../types';
import { getStorageItem, setStorageItem } from '../../../utils/storage';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createInMemoryMCPServer } from './MCPServerFactory';
import { getBuiltinMCPServers } from '../../../config/builtinMCPServers';
import { HttpStreamMCPClient } from '../clients/HttpStreamMCPClient';
import { CapacitorCorsMCPClient } from '../clients/CapacitorCorsMCPClient';

import { Capacitor } from '@capacitor/core';

/**
 * 构建函数调用工具名称 - 参考最佳实例逻辑
 */
function buildFunctionCallToolName(serverName: string, toolName: string): string {
  const sanitizedServer = serverName.trim().replace(/-/g, '_');
  const sanitizedTool = toolName.trim().replace(/-/g, '_');

  // Combine server name and tool name
  let name = sanitizedTool;
  if (!sanitizedTool.includes(sanitizedServer.slice(0, 7))) {
    name = `${sanitizedServer.slice(0, 7) || ''}-${sanitizedTool || ''}`;
  }

  // Replace invalid characters with underscores or dashes
  // Keep a-z, A-Z, 0-9, underscores and dashes
  name = name.replace(/[^a-zA-Z0-9_-]/g, '_');

  // Ensure name starts with a letter or underscore (for valid JavaScript identifier)
  if (!/^[a-zA-Z]/.test(name)) {
    name = `tool-${name}`;
  }

  // Remove consecutive underscores/dashes (optional improvement)
  name = name.replace(/[_-]{2,}/g, '_');

  // Truncate to 63 characters maximum
  if (name.length > 63) {
    name = name.slice(0, 63);
  }

  // Handle edge case: ensure we still have a valid name if truncation left invalid chars at edges
  if (name.endsWith('_') || name.endsWith('-')) {
    name = name.slice(0, -1);
  }

  return name;
}

/**
 * MCP 服务管理类
 * 负责管理 MCP 服务器的配置、连接和工具调用
 */
export class MCPService {
  private static instance: MCPService;
  private servers: MCPServer[] = [];
  private clients: Map<string, Client> = new Map();
  private pendingClients: Map<string, Promise<Client>> = new Map();

  // HTTP Stream 客户端缓存
  private httpStreamClients: Map<string, HttpStreamMCPClient> = new Map();
  private pendingHttpStreamClients: Map<string, Promise<HttpStreamMCPClient>> = new Map();

  // Capacitor CORS 客户端缓存
  private capacitorCorsClients: Map<string, CapacitorCorsMCPClient> = new Map();
  private pendingCapacitorCorsClients: Map<string, Promise<CapacitorCorsMCPClient>> = new Map();

  // 添加服务器状态保存字段
  private savedActiveServerIds: Set<string> = new Set();

  private constructor() {
    this.loadServers();
  }

  public static getInstance(): MCPService {
    if (!MCPService.instance) {
      MCPService.instance = new MCPService();
    }
    return MCPService.instance;
  }

  /**
   * 从存储加载 MCP 服务器配置
   */
  private async loadServers(): Promise<void> {
    try {
      const savedServers = await getStorageItem<MCPServer[]>('mcp_servers');
      if (savedServers) {
        this.servers = savedServers;
      }
    } catch (error) {
      console.error('[MCP] 加载服务器配置失败:', error);
    }
  }

  /**
   * 保存 MCP 服务器配置到存储
   */
  private async saveServers(): Promise<void> {
    try {
      await setStorageItem('mcp_servers', this.servers);
    } catch (error) {
      console.error('[MCP] 保存服务器配置失败:', error);
    }
  }

  /**
   * 获取所有 MCP 服务器
   */
  public getServers(): MCPServer[] {
    return [...this.servers];
  }

  /**
   * 获取活跃的 MCP 服务器
   */
  public getActiveServers(): MCPServer[] {
    return this.servers.filter(server => server.isActive);
  }

  /**
   * 根据 ID 获取服务器
   */
  public getServerById(id: string): MCPServer | undefined {
    return this.servers.find(server => server.id === id);
  }

  /**
   * 添加新的 MCP 服务器
   */
  public async addServer(server: MCPServer): Promise<void> {
    this.servers.push(server);
    await this.saveServers();
  }

  /**
   * 更新 MCP 服务器
   */
  public async updateServer(updatedServer: MCPServer): Promise<void> {
    const index = this.servers.findIndex(server => server.id === updatedServer.id);
    if (index !== -1) {
      this.servers[index] = updatedServer;
      await this.saveServers();
    }
  }

  /**
   * 删除 MCP 服务器
   */
  public async removeServer(serverId: string): Promise<void> {
    this.servers = this.servers.filter(server => server.id !== serverId);
    // 清理客户端连接
    this.clients.delete(serverId);
    await this.saveServers();
  }

  /**
   * 启动/停止服务器
   */
  public async toggleServer(serverId: string, isActive: boolean): Promise<void> {
    const server = this.getServerById(serverId);
    if (server) {
      const serverKey = this.getServerKey(server);

      if (!isActive) {
        // 停止时清理客户端连接
        await this.closeClient(serverKey);
      }

      server.isActive = isActive;
      await this.saveServers();

      // 如果启动服务器，尝试初始化连接
      if (isActive) {
        try {
          await this.initClient(server);
          console.log(`[MCP] 服务器已启动: ${server.name}`);
        } catch (error) {
          console.error(`[MCP] 启动服务器失败: ${server.name}`, error);
          // 启动失败时回滚状态
          server.isActive = false;
          await this.saveServers();
          throw error;
        }
      }
    }
  }

  /**
   * 获取服务器的唯一键
   */
  private getServerKey(server: MCPServer): string {
    return JSON.stringify({
      baseUrl: server.baseUrl,
      args: server.args,
      env: server.env,
      type: server.type,
      name: server.name,
      id: server.id
    });
  }

  /**
   * 初始化 MCP 客户端
   */
  private async initClient(server: MCPServer): Promise<Client> {
    const serverKey = this.getServerKey(server);

    // 如果有正在初始化的客户端，等待它完成
    const pendingClient = this.pendingClients.get(serverKey);
    if (pendingClient) {
      console.log(`[MCP] 等待正在初始化的连接: ${server.name}`);
      return pendingClient;
    }

    // 检查是否已有客户端连接
    const existingClient = this.clients.get(serverKey);
    if (existingClient) {
      try {
        // 检查现有客户端是否还活着
        console.log(`[MCP] 检查现有连接健康状态: ${server.name}`);
        await existingClient.ping();
        console.log(`[MCP] 复用现有连接: ${server.name}`);
        return existingClient;
      } catch (error) {
        console.warn(`[MCP] 现有连接已失效，重新创建: ${server.name}`, error);
        // 清理失效的连接
        this.clients.delete(serverKey);
      }
    }

    // 创建初始化 Promise 并缓存
    const initPromise = (async (): Promise<Client> => {
      // 创建新的客户端
      const client = new Client(
        { name: 'AetherLink Mobile', version: '1.0.0' },
        { capabilities: {} }
      );

      try {
      let transport;

      // 根据服务器类型创建传输层
      if (server.type === 'inMemory') {
        console.log(`[MCP] 创建内存传输: ${server.name}`);
        const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

        // 创建内存服务器
        const inMemoryServer = createInMemoryMCPServer(server.name, server.args || [], server.env || {});
        await inMemoryServer.connect(serverTransport);

        transport = clientTransport;

      } else if (server.type === 'httpStream') {
        // 使用新的 HTTP Stream Transport (mcp-framework)
        if (!server.baseUrl) {
          throw new Error('HTTP Stream 服务器需要提供 baseUrl');
        }

        console.log(`[MCP] 创建 HTTP Stream 传输: ${server.baseUrl}`);

        // 对于 httpStream 类型，我们需要使用不同的处理方式
        // 在移动端使用 CapacitorCorsMCPClient，Web端使用 HttpStreamMCPClient
        const httpStreamClient = Capacitor.isNativePlatform()
          ? await this.initCapacitorCorsClient(server)
          : await this.initHttpStreamClient(server);

        // 创建一个兼容的 Client 对象
        const compatClient = {
          connect: async () => {},
          close: async () => { await httpStreamClient.close(); },
          ping: async () => { /* HTTP Stream 不支持 ping */ },
          listTools: async () => {
            const tools = await httpStreamClient.listTools();
            return { tools };
          },
          callTool: async (params: any) => {
            return await httpStreamClient.callTool(params.name, params.arguments);
          },
          listPrompts: async () => ({ prompts: [] }),
          listResources: async () => ({ resources: [] })
        } as any;

        // 缓存客户端
        this.clients.set(serverKey, compatClient);
        console.log(`[MCP] 成功连接到 HTTP Stream 服务器: ${server.name}`);
        return compatClient;
      } else {
        throw new Error(`不支持的服务器类型: ${server.type}`);
      }

      // 对于inMemory类型，连接客户端
      if (server.type === 'inMemory') {
        // 连接客户端
        await client.connect(transport);

        // 缓存客户端
        this.clients.set(serverKey, client);

        console.log(`[MCP] 成功连接到服务器: ${server.name}`);
        return client;
      }

      // 这里不应该到达，因为所有类型都已处理
      throw new Error(`未处理的服务器类型: ${server.type}`);
      } catch (error) {
        console.error(`[MCP] 连接服务器失败: ${server.name}`, error);

        // 在移动端，为CORS错误提供更友好的错误信息
        if (Capacitor.isNativePlatform() && error instanceof Error) {
          if (error.message.includes('CORS') || error.message.includes('Access to fetch')) {
            console.log(`[MCP] 移动端CORS错误，这通常表示服务器配置问题或网络问题`);
            throw new Error(`连接MCP服务器失败: ${server.name} - 网络连接问题或服务器不可用`);
          }
        }

        throw error;
      } finally {
        // 清理 pending 状态
        this.pendingClients.delete(serverKey);
      }
    })();

    // 缓存初始化 Promise
    this.pendingClients.set(serverKey, initPromise);

    return initPromise;
  }

  /**
   * 初始化 HTTP Stream 客户端
   */
  private async initHttpStreamClient(server: MCPServer): Promise<HttpStreamMCPClient> {
    const serverKey = this.getServerKey(server);

    // 检查是否已有客户端连接
    const existingClient = this.httpStreamClients.get(serverKey);
    if (existingClient) {
      console.log(`[MCP] 复用现有 HTTP Stream 连接: ${server.name}`);
      return existingClient;
    }

    // 检查是否有正在初始化的客户端
    const pendingClient = this.pendingHttpStreamClients.get(serverKey);
    if (pendingClient) {
      console.log(`[MCP] 等待正在初始化的 HTTP Stream 连接: ${server.name}`);
      return pendingClient;
    }

    // 创建初始化 Promise
    const initPromise = (async (): Promise<HttpStreamMCPClient> => {
      try {
        // HttpStreamMCPClient内部会处理代理URL
        const client = new HttpStreamMCPClient({
          baseUrl: server.baseUrl!,
          headers: server.headers,
          timeout: (server.timeout || 60) * 1000,
          enableSSE: server.enableSSE // 传递SSE配置
        });

        await client.initialize();

        // 缓存客户端
        this.httpStreamClients.set(serverKey, client);
        console.log(`[MCP] HTTP Stream 客户端初始化成功: ${server.name}`);

        return client;
      } catch (error) {
        console.error(`[MCP] HTTP Stream 客户端初始化失败: ${server.name}`, error);
        throw error;
      } finally {
        // 清理 pending 状态
        this.pendingHttpStreamClients.delete(serverKey);
      }
    })();

    // 缓存初始化 Promise
    this.pendingHttpStreamClients.set(serverKey, initPromise);

    return initPromise;
  }

  /**
   * 初始化 Capacitor CORS 客户端
   */
  private async initCapacitorCorsClient(server: MCPServer): Promise<CapacitorCorsMCPClient> {
    const serverKey = this.getServerKey(server);

    // 检查是否已有客户端连接
    const existingClient = this.capacitorCorsClients.get(serverKey);
    if (existingClient) {
      console.log(`[MCP] 复用现有 Capacitor CORS 连接: ${server.name}`);
      return existingClient;
    }

    // 检查是否有正在初始化的客户端
    const pendingClient = this.pendingCapacitorCorsClients.get(serverKey);
    if (pendingClient) {
      console.log(`[MCP] 等待正在初始化的 Capacitor CORS 连接: ${server.name}`);
      return pendingClient;
    }

    // 创建初始化 Promise
    const initPromise = (async (): Promise<CapacitorCorsMCPClient> => {
      try {
        // CapacitorCorsMCPClient 内部会使用 CorsBypass 插件
        const client = new CapacitorCorsMCPClient({
          baseUrl: server.baseUrl!,
          headers: server.headers,
          timeout: (server.timeout || 60) * 1000,
          enableSSE: server.enableSSE // 传递SSE配置
        });

        await client.initialize();

        // 缓存客户端
        this.capacitorCorsClients.set(serverKey, client);
        console.log(`[MCP] Capacitor CORS 客户端初始化成功: ${server.name}`);

        return client;
      } catch (error) {
        console.error(`[MCP] Capacitor CORS 客户端初始化失败: ${server.name}`, error);
        throw error;
      } finally {
        // 清理 pending 状态
        this.pendingCapacitorCorsClients.delete(serverKey);
      }
    })();

    // 缓存初始化 Promise
    this.pendingCapacitorCorsClients.set(serverKey, initPromise);

    return initPromise;
  }

  /**
   * 关闭客户端连接
   */
  private async closeClient(serverKey: string): Promise<void> {
    const client = this.clients.get(serverKey);
    if (client) {
      try {
        await client.close();
        console.log(`[MCP] 已关闭连接: ${serverKey}`);
      } catch (error) {
        console.error(`[MCP] 关闭客户端连接失败:`, error);
      }
      this.clients.delete(serverKey);
    }

    // 关闭 HTTP Stream 客户端
    const httpStreamClient = this.httpStreamClients.get(serverKey);
    if (httpStreamClient) {
      try {
        await httpStreamClient.close();
        console.log(`[MCP] 已关闭 HTTP Stream 连接: ${serverKey}`);
      } catch (error) {
        console.error(`[MCP] 关闭 HTTP Stream 客户端连接失败:`, error);
      }
      this.httpStreamClients.delete(serverKey);
    }

    // 关闭 Capacitor CORS 客户端
    const capacitorCorsClient = this.capacitorCorsClients.get(serverKey);
    if (capacitorCorsClient) {
      try {
        await capacitorCorsClient.close();
        console.log(`[MCP] 已关闭 Capacitor CORS 连接: ${serverKey}`);
      } catch (error) {
        console.error(`[MCP] 关闭 Capacitor CORS 客户端连接失败:`, error);
      }
      this.capacitorCorsClients.delete(serverKey);
    }

    // 同时清理 pending 状态
    this.pendingClients.delete(serverKey);
    this.pendingHttpStreamClients.delete(serverKey);
    this.pendingCapacitorCorsClients.delete(serverKey);
  }

  /**
   * 测试服务器连接
   */
  public async testConnection(server: MCPServer): Promise<boolean> {
    try {
      console.log(`[MCP] 测试连接到服务器: ${server.name}`);

      const client = await this.initClient(server);

      // 尝试列出工具来测试连接
      await client.listTools();

      console.log(`[MCP] 连接测试成功: ${server.name}`);
      return true;
    } catch (error) {
      console.error(`[MCP] 连接测试失败: ${server.name}`, error);

      // 清理失败的连接
      const serverKey = this.getServerKey(server);
      await this.closeClient(serverKey);

      return false;
    }
  }

  /**
   * 获取服务器工具列表
   */
  public async listTools(server: MCPServer): Promise<MCPTool[]> {
    try {
      console.log(`[MCP] 获取服务器工具: ${server.name}`);

      const client = await this.initClient(server);
      console.log(`[MCP] 客户端已连接，正在调用 listTools...`);

      const result = await client.listTools();
      console.log(`[MCP] listTools 响应:`, result);

      const tools = result.tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        serverName: server.name,
        serverId: server.id,
        id: buildFunctionCallToolName(server.name, tool.name)
      }));

      console.log(`[MCP] 服务器 ${server.name} 返回 ${tools.length} 个工具:`, tools.map(t => t.name));
      return tools;
    } catch (error) {
      console.error(`[MCP] 获取工具列表失败:`, error);
      return [];
    }
  }

  /**
   * 调用 MCP 工具
   */
  public async callTool(
    server: MCPServer,
    toolName: string,
    args: Record<string, any>
  ): Promise<MCPCallToolResponse> {
    try {
      console.log(`[MCP] 调用工具: ${server.name}.${toolName}`, args);

      const client = await this.initClient(server);
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
      console.error(`[MCP] 工具调用失败:`, error);
      return {
        content: [
          {
            type: 'text',
            text: `工具调用失败: ${error instanceof Error ? error.message : '未知错误'}`
          }
        ],
        isError: true
      };
    }
  }

  /**
   * 获取服务器提示词列表
   */
  public async listPrompts(server: MCPServer): Promise<MCPPrompt[]> {
    try {
      console.log(`[MCP] 获取服务器提示词: ${server.name}`);

      const client = await this.initClient(server);
      const result = await client.listPrompts();

      return result.prompts.map(prompt => ({
        name: prompt.name,
        description: prompt.description,
        arguments: prompt.arguments,
        serverName: server.name,
        serverId: server.id
      }));
    } catch (error) {
      // 如果是 Method not found 错误，说明服务器不支持此功能，静默处理
      if (error instanceof Error && error.message.includes('-32601')) {
        console.log(`[MCP] 服务器 ${server.name} 不支持提示词功能`);
        return [];
      }
      console.error(`[MCP] 获取提示词列表失败:`, error);
      return [];
    }
  }

  /**
   * 获取服务器资源列表
   */
  public async listResources(server: MCPServer): Promise<MCPResource[]> {
    try {
      console.log(`[MCP] 获取服务器资源: ${server.name}`);

      const client = await this.initClient(server);
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
      // 如果是 Method not found 错误，说明服务器不支持此功能，静默处理
      if (error instanceof Error && error.message.includes('-32601')) {
        console.log(`[MCP] 服务器 ${server.name} 不支持资源功能`);
        return [];
      }
      console.error(`[MCP] 获取资源列表失败:`, error);
      return [];
    }
  }

  /**
   * 停止服务器
   */
  public async stopServer(serverId: string): Promise<void> {
    const server = this.getServerById(serverId);
    if (server) {
      const serverKey = this.getServerKey(server);
      await this.closeClient(serverKey);
      console.log(`[MCP] 服务器已停止: ${server.name}`);
    }
  }

  /**
   * 重启服务器
   */
  public async restartServer(serverId: string): Promise<void> {
    const server = this.getServerById(serverId);
    if (server) {
      console.log(`[MCP] 重启服务器: ${server.name}`);
      const serverKey = this.getServerKey(server);
      await this.closeClient(serverKey);

      if (server.isActive) {
        // 重新初始化连接
        await this.initClient(server);
      }
    }
  }

  /**
   * 获取内置服务器列表
   */
  public getBuiltinServers(): MCPServer[] {
    return getBuiltinMCPServers();
  }

  /**
   * 添加内置服务器
   */
  public async addBuiltinServer(serverName: string, config?: Partial<MCPServer>): Promise<void> {
    try {
      // 从内置服务器列表中查找配置
      const builtinServers = this.getBuiltinServers();
      const defaultConfig = builtinServers.find(server => server.name === serverName);

      if (!defaultConfig) {
        throw new Error(`未找到内置服务器: ${serverName}`);
      }

      // 合并配置
      const serverConfig: MCPServer = {
        ...defaultConfig,
        ...config,
        id: config?.id || `builtin-${Date.now()}`,
        name: serverName,
        isActive: config?.isActive !== undefined ? config.isActive : true
      };

      // 添加到服务器列表
      await this.addServer(serverConfig);
      console.log(`[MCP] 成功添加内置服务器: ${serverName}`);
    } catch (error) {
      console.error(`[MCP] 添加内置服务器失败: ${serverName}`, error);
      throw error;
    }
  }

  /**
   * 检查服务器是否为内置服务器
   */
  public isBuiltinServer(serverName: string): boolean {
    const builtinNames = [
      '@aether/memory',
      '@aether/sequentialthinking',
      '@aether/brave-search',
      '@aether/fetch',
      '@aether/filesystem',
      '@aether/dify-knowledge'
    ];
    return builtinNames.includes(serverName);
  }

  /**
   * 获取所有可用的 MCP 工具
   */
  public async getAllAvailableTools(): Promise<MCPTool[]> {
    const allServers = this.getServers();
    const activeServers = this.getActiveServers();
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

  /**
   * 检查连接健康状态
   */
  public async checkConnectionHealth(server: MCPServer): Promise<boolean> {
    const serverKey = this.getServerKey(server);
    const client = this.clients.get(serverKey);

    if (!client) {
      return false;
    }

    try {
      await client.ping();
      return true;
    } catch (error) {
      console.warn(`[MCP] 连接健康检查失败: ${server.name}`, error);
      // 清理失效的连接
      this.clients.delete(serverKey);
      return false;
    }
  }

  /**
   * 获取连接状态信息
   */
  public getConnectionStatus(): {
    activeConnections: number;
    pendingConnections: number;
    connections: Array<{ serverKey: string; status: 'active' | 'pending' }>;
  } {
    const connections: Array<{ serverKey: string; status: 'active' | 'pending' }> = [];

    // 活跃连接
    for (const serverKey of this.clients.keys()) {
      connections.push({ serverKey, status: 'active' });
    }

    // 待连接
    for (const serverKey of this.pendingClients.keys()) {
      if (!this.clients.has(serverKey)) {
        connections.push({ serverKey, status: 'pending' });
      }
    }

    return {
      activeConnections: this.clients.size,
      pendingConnections: this.pendingClients.size,
      connections
    };
  }

  /**
   * 关闭所有活跃的服务器
   */
  public async stopAllActiveServers(): Promise<void> {
    const activeServers = this.getActiveServers();
    console.log(`[MCP] 正在关闭 ${activeServers.length} 个活跃服务器`);

    // 保存当前活跃服务器的ID，以便后续恢复
    this.savedActiveServerIds.clear();
    activeServers.forEach(server => {
      this.savedActiveServerIds.add(server.id);
    });
    console.log(`[MCP] 已保存 ${this.savedActiveServerIds.size} 个活跃服务器的状态`);

    const promises = activeServers.map(async (server) => {
      try {
        await this.toggleServer(server.id, false);
        console.log(`[MCP] 已关闭服务器: ${server.name}`);
      } catch (error) {
        console.error(`[MCP] 关闭服务器失败: ${server.name}`, error);
      }
    });

    await Promise.all(promises);
    console.log('[MCP] 所有活跃服务器已关闭');
  }

  /**
   * 恢复之前保存的活跃服务器状态
   */
  public async restoreSavedActiveServers(): Promise<void> {
    if (this.savedActiveServerIds.size === 0) {
      console.log('[MCP] 没有保存的活跃服务器状态需要恢复');
      return;
    }

    console.log(`[MCP] 正在恢复 ${this.savedActiveServerIds.size} 个服务器的活跃状态`);

    const promises = Array.from(this.savedActiveServerIds).map(async (serverId) => {
      try {
        const server = this.getServerById(serverId);
        if (server) {
          await this.toggleServer(serverId, true);
          console.log(`[MCP] 已恢复服务器: ${server.name}`);
        }
      } catch (error) {
        console.error(`[MCP] 恢复服务器失败: ${serverId}`, error);
      }
    });

    await Promise.all(promises);
    console.log('[MCP] 所有保存的活跃服务器状态已恢复');

    // 清空保存的状态
    this.savedActiveServerIds.clear();
  }

  /**
   * 检查是否有保存的活跃服务器状态
   */
  public hasSavedActiveServers(): boolean {
    return this.savedActiveServerIds.size > 0;
  }

  /**
   * 清理所有连接
   */
  public async cleanup(): Promise<void> {
    const promises = Array.from(this.clients.keys()).map(key => this.closeClient(key));
    await Promise.all(promises);
    this.pendingClients.clear();
    console.log('[MCP] 所有连接已清理');
  }
}

// 导出单例实例
export const mcpService = MCPService.getInstance();
