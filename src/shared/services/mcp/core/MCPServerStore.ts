/**
 * MCP 服务器数据存储
 * 职责：服务器配置的 CRUD 和 Dexie 持久化
 */
import type { MCPServer } from '../../../types';
import { getStorageItem, setStorageItem } from '../../../utils/storage';
import { getBuiltinMCPServers, isBuiltinServer } from '../../../config/builtinMCPServers';

export class MCPServerStore {
  private servers: MCPServer[] = [];
  private loadingPromise: Promise<void> | null = null;
  private isLoaded = false;

  // 用于 stopAll / restore 场景的临时状态
  private savedActiveServerIds = new Set<string>();

  constructor() {
    this.loadingPromise = this.loadServers();
  }

  // ── 加载 / 持久化 ──────────────────────────────

  async ensureLoaded(): Promise<void> {
    if (this.isLoaded) return;
    if (this.loadingPromise) await this.loadingPromise;
  }

  private async loadServers(): Promise<void> {
    try {
      const saved = await getStorageItem<MCPServer[]>('mcp_servers');
      if (saved) {
        this.servers = saved;
        console.log(`[MCP] 成功加载 ${saved.length} 个服务器配置`);
      }
    } catch (error) {
      console.error('[MCP] 加载服务器配置失败:', error);
    } finally {
      this.isLoaded = true;
      this.loadingPromise = null;
    }
  }

  async saveServers(): Promise<void> {
    try {
      await setStorageItem('mcp_servers', this.servers);
    } catch (error) {
      console.error('[MCP] 保存服务器配置失败:', error);
    }
  }

  // ── 查询 ──────────────────────────────────────

  /**
   * @deprecated 使用 getServersAsync() 代替，同步版本在初始化完成前可能返回空数组
   */
  getServers(): MCPServer[] {
    return [...this.servers];
  }

  async getServersAsync(): Promise<MCPServer[]> {
    await this.ensureLoaded();
    return [...this.servers];
  }

  /**
   * @deprecated 使用 getActiveServersAsync() 代替
   */
  getActiveServers(): MCPServer[] {
    return this.servers.filter(s => s.isActive);
  }

  async getActiveServersAsync(): Promise<MCPServer[]> {
    await this.ensureLoaded();
    return this.servers.filter(s => s.isActive);
  }

  /**
   * @deprecated 使用 getServerByIdAsync() 代替
   */
  getServerById(id: string): MCPServer | undefined {
    return this.servers.find(s => s.id === id);
  }

  async getServerByIdAsync(id: string): Promise<MCPServer | undefined> {
    await this.ensureLoaded();
    return this.servers.find(s => s.id === id);
  }

  // ── 变更 ──────────────────────────────────────

  async addServer(server: MCPServer): Promise<void> {
    await this.ensureLoaded();
    this.servers.push(server);
    console.log(`[MCP] 添加服务器: ${server.name}, type=${server.type}, command=${server.command || 'N/A'}`);
    await this.saveServers();
  }

  async updateServer(updatedServer: MCPServer): Promise<void> {
    await this.ensureLoaded();
    const idx = this.servers.findIndex(s => s.id === updatedServer.id);
    if (idx !== -1) {
      console.log(`[MCP] 更新服务器: ${updatedServer.name}, type=${updatedServer.type}, command=${updatedServer.command || 'N/A'}`);
      this.servers[idx] = updatedServer;
      await this.saveServers();
    } else {
      console.warn(`[MCP] 未找到要更新的服务器: ${updatedServer.id}`);
    }
  }

  async removeServer(serverId: string): Promise<void> {
    await this.ensureLoaded();
    this.servers = this.servers.filter(s => s.id !== serverId);
    await this.saveServers();
  }

  /** 仅更新 isActive 标志并持久化 */
  async setServerActive(serverId: string, isActive: boolean): Promise<void> {
    const server = this.getServerById(serverId);
    if (server) {
      server.isActive = isActive;
      await this.saveServers();
    }
  }

  // ── 内置服务器 ────────────────────────────────

  getBuiltinServers(): MCPServer[] {
    return getBuiltinMCPServers();
  }

  isBuiltinServer(name: string): boolean {
    return isBuiltinServer(name);
  }

  // ── 保存 / 恢复活跃状态 ──────────────────────

  saveActiveServerIds(): void {
    this.savedActiveServerIds.clear();
    for (const s of this.servers.filter(s => s.isActive)) {
      this.savedActiveServerIds.add(s.id);
    }
    console.log(`[MCP] 已保存 ${this.savedActiveServerIds.size} 个活跃服务器的状态`);
  }

  getSavedActiveServerIds(): string[] {
    return Array.from(this.savedActiveServerIds);
  }

  clearSavedActiveServerIds(): void {
    this.savedActiveServerIds.clear();
  }

  hasSavedActiveServers(): boolean {
    return this.savedActiveServerIds.size > 0;
  }
}
