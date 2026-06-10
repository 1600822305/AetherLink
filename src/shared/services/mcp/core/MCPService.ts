/**
 * MCP 服务管理类 — 门面层
 *
 * 所有公共 API 保持不变。内部实现委托给三个子模块：
 *   - MCPServerStore      （服务器 CRUD + Dexie 持久化）
 *   - MCPConnectionManager（连接池 + 生命周期）
 *   - MCPToolExecutor     （工具列举 / 调用 / 提示词 / 资源）
 */
import type { MCPServer, MCPTool, MCPPrompt, MCPResource, MCPCallToolResponse } from '../../../types';
import { MCPServerStore } from './MCPServerStore';
import { MCPConnectionManager } from './MCPConnectionManager';
import { MCPToolExecutor } from './MCPToolExecutor';
import { AGENTIC_MODE_SERVER } from '../types/constants';

export class MCPService {
  private static instance: MCPService;

  private readonly serverStore: MCPServerStore;
  private readonly connectionManager: MCPConnectionManager;
  private readonly toolExecutor: MCPToolExecutor;

  private constructor() {
    this.serverStore = new MCPServerStore();
    this.connectionManager = new MCPConnectionManager();
    this.toolExecutor = new MCPToolExecutor(this.connectionManager, this.serverStore);
  }

  public static getInstance(): MCPService {
    if (!MCPService.instance) {
      MCPService.instance = new MCPService();
    }
    return MCPService.instance;
  }

  // ═══════════════════════════════════════════════
  //  服务器查询
  // ═══════════════════════════════════════════════

  /** @deprecated 使用 getServersAsync() 代替 */
  public getServers(): MCPServer[] {
    return this.serverStore.getServers();
  }

  public async getServersAsync(): Promise<MCPServer[]> {
    return this.serverStore.getServersAsync();
  }

  /** @deprecated 使用 getActiveServersAsync() 代替 */
  public getActiveServers(): MCPServer[] {
    return this.serverStore.getActiveServers();
  }

  public async getActiveServersAsync(): Promise<MCPServer[]> {
    return this.serverStore.getActiveServersAsync();
  }

  /** @deprecated 使用 getServerByIdAsync() 代替 */
  public getServerById(id: string): MCPServer | undefined {
    return this.serverStore.getServerById(id);
  }

  public async getServerByIdAsync(id: string): Promise<MCPServer | undefined> {
    return this.serverStore.getServerByIdAsync(id);
  }

  // ═══════════════════════════════════════════════
  //  服务器 CRUD
  // ═══════════════════════════════════════════════

  public async addServer(server: MCPServer): Promise<void> {
    await this.serverStore.addServer(server);
  }

  public async updateServer(updatedServer: MCPServer): Promise<void> {
    await this.serverStore.updateServer(updatedServer);
  }

  public async removeServer(serverId: string): Promise<void> {
    await this.serverStore.removeServer(serverId);
    // 保持原有行为：用 serverId 清理客户端缓存
    this.connectionManager.removeClientById(serverId);
  }

  // ═══════════════════════════════════════════════
  //  服务器生命周期（需同时操作 store + connection）
  // ═══════════════════════════════════════════════

  public async toggleServer(serverId: string, isActive: boolean): Promise<void> {
    const server = this.serverStore.getServerById(serverId);
    if (!server) return;

    const serverKey = this.connectionManager.getServerKey(server);

    if (!isActive) {
      await this.connectionManager.closeClient(serverKey);
    }

    await this.serverStore.setServerActive(serverId, isActive);

    if (isActive) {
      try {
        await this.connectionManager.initClient(server);
        console.log(`[MCP] 服务器已启动: ${server.name}`);
      } catch (error) {
        console.error(`[MCP] 启动服务器失败: ${server.name}`, error);
        await this.serverStore.setServerActive(serverId, false);
        throw error;
      }
    }
  }

  public async stopServer(serverId: string): Promise<void> {
    const server = this.serverStore.getServerById(serverId);
    if (server) {
      const serverKey = this.connectionManager.getServerKey(server);
      await this.connectionManager.closeClient(serverKey);
      console.log(`[MCP] 服务器已停止: ${server.name}`);
    }
  }

  public async restartServer(serverId: string): Promise<void> {
    const server = this.serverStore.getServerById(serverId);
    if (server) {
      console.log(`[MCP] 重启服务器: ${server.name}`);
      const serverKey = this.connectionManager.getServerKey(server);
      await this.connectionManager.closeClient(serverKey);

      if (server.isActive) {
        await this.connectionManager.initClient(server);
      }
    }
  }

  public async stopAllActiveServers(): Promise<void> {
    const activeServers = this.serverStore.getActiveServers();
    console.log(`[MCP] 正在关闭 ${activeServers.length} 个活跃服务器`);

    this.serverStore.saveActiveServerIds();

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

  public async restoreSavedActiveServers(): Promise<void> {
    if (!this.serverStore.hasSavedActiveServers()) {
      console.log('[MCP] 没有保存的活跃服务器状态需要恢复');
      return;
    }

    const ids = this.serverStore.getSavedActiveServerIds();
    console.log(`[MCP] 正在恢复 ${ids.length} 个服务器的活跃状态`);

    const promises = ids.map(async (serverId) => {
      try {
        const server = this.serverStore.getServerById(serverId);
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

    this.serverStore.clearSavedActiveServerIds();
  }

  public hasSavedActiveServers(): boolean {
    return this.serverStore.hasSavedActiveServers();
  }

  // ═══════════════════════════════════════════════
  //  内置服务器
  // ═══════════════════════════════════════════════

  public getBuiltinServers(): MCPServer[] {
    return this.serverStore.getBuiltinServers();
  }

  public async addBuiltinServer(serverName: string, config?: Partial<MCPServer>): Promise<void> {
    try {
      const builtinServers = this.serverStore.getBuiltinServers();
      const defaultConfig = builtinServers.find(server => server.name === serverName);

      if (!defaultConfig) {
        throw new Error(`未找到内置服务器: ${serverName}`);
      }

      const serverConfig: MCPServer = {
        ...defaultConfig,
        ...config,
        id: config?.id || `builtin-${Date.now()}`,
        name: serverName,
        isActive: config?.isActive !== undefined ? config.isActive : true
      };

      await this.serverStore.addServer(serverConfig);
      console.log(`[MCP] 成功添加内置服务器: ${serverName}`);
    } catch (error) {
      console.error(`[MCP] 添加内置服务器失败: ${serverName}`, error);
      throw error;
    }
  }

  public isBuiltinServer(serverName: string): boolean {
    return this.serverStore.isBuiltinServer(serverName);
  }

  // ═══════════════════════════════════════════════
  //  工具操作
  // ═══════════════════════════════════════════════

  public async listTools(server: MCPServer, options?: { includeDisabled?: boolean }): Promise<MCPTool[]> {
    return this.toolExecutor.listTools(server, options);
  }

  public async callTool(
    server: MCPServer,
    toolName: string,
    args: Record<string, any>
  ): Promise<MCPCallToolResponse> {
    return this.toolExecutor.callTool(server, toolName, args);
  }

  public async listPrompts(server: MCPServer): Promise<MCPPrompt[]> {
    return this.toolExecutor.listPrompts(server);
  }

  public async listResources(server: MCPServer): Promise<MCPResource[]> {
    return this.toolExecutor.listResources(server);
  }

  public async getAllAvailableTools(): Promise<MCPTool[]> {
    return this.toolExecutor.getAllAvailableTools();
  }

  // ═══════════════════════════════════════════════
  //  连接状态 / 健康检查
  // ═══════════════════════════════════════════════

  public async testConnection(server: MCPServer): Promise<boolean> {
    return this.connectionManager.testConnection(server);
  }

  public async checkConnectionHealth(server: MCPServer): Promise<boolean> {
    return this.connectionManager.checkConnectionHealth(server);
  }

  public getConnectionStatus(): {
    activeConnections: number;
    pendingConnections: number;
    connections: Array<{ serverKey: string; status: 'active' | 'pending' }>;
  } {
    return this.connectionManager.getConnectionStatus();
  }

  public async cleanup(): Promise<void> {
    return this.connectionManager.cleanup();
  }

  // ═══════════════════════════════════════════════
  //  Agentic 模式查询
  // ═══════════════════════════════════════════════

  public getActiveServerNames(): string[] {
    return this.serverStore.getActiveServers().map(s => s.name);
  }

  public hasActiveServer(serverName: string): boolean {
    return this.getActiveServerNames().includes(serverName);
  }

  public shouldEnableAgenticMode(): boolean {
    return this.hasActiveServer(AGENTIC_MODE_SERVER);
  }
}

// 导出单例实例
export const mcpService = MCPService.getInstance();
