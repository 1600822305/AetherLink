/**
 * MCP 连接池管理
 * 职责：客户端连接的初始化、缓存、健康检查、清理
 */
import type { MCPServer } from '../../../types';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createInMemoryMCPServer } from './MCPServerFactory';
import { MCPClientAdapter } from '../clients/MCPClientAdapter';
import { AiSdkMCPClient } from '../clients/AiSdkMCPClient';
import { StdioMCPClient } from '../clients/StdioMCPClient';
import { Capacitor } from '@capacitor/core';
import {
  MCPCorsError,
  createMCPError,
  isCorsError
} from '../types/MCPError';
import { MCP_CLIENT_INFO } from '../types/constants';

/**
 * 根据 URL 推断 MCP 服务器类型
 */
function getMcpServerType(url: string): 'streamableHttp' | 'sse' {
  return url.endsWith('/mcp') ? 'streamableHttp' : 'sse';
}

/**
 * 规范化服务器类型（处理向后兼容）
 */
function normalizeServerType(server: MCPServer): MCPServer['type'] {
  if (server.type === 'httpStream') {
    console.log(`[MCP] 检测到废弃的 httpStream 类型，自动转换为 sse: ${server.name}`);
    return 'sse';
  }
  if (!server.type && server.baseUrl) {
    const inferredType = getMcpServerType(server.baseUrl);
    console.log(`[MCP] 根据 URL 推断类型: ${server.name} -> ${inferredType}`);
    return inferredType;
  }
  return server.type;
}

export class MCPConnectionManager {
  private clients = new Map<string, Client>();
  private pendingClients = new Map<string, Promise<Client>>();

  private mcpClientAdapters = new Map<string, MCPClientAdapter | AiSdkMCPClient>();
  private pendingMcpClientAdapters = new Map<string, Promise<MCPClientAdapter | AiSdkMCPClient>>();

  private stdioClients = new Map<string, StdioMCPClient>();
  private pendingStdioClients = new Map<string, Promise<StdioMCPClient>>();

  // ── 服务器键 ──────────────────────────────────

  getServerKey(server: MCPServer): string {
    return JSON.stringify({
      baseUrl: server.baseUrl,
      args: server.args,
      env: server.env,
      type: server.type,
      name: server.name,
      id: server.id
    });
  }

  // ── 初始化客户端 ──────────────────────────────

  async initClient(server: MCPServer): Promise<Client> {
    const serverKey = this.getServerKey(server);

    const pendingClient = this.pendingClients.get(serverKey);
    if (pendingClient) {
      console.log(`[MCP] 等待正在初始化的连接: ${server.name}`);
      return pendingClient;
    }

    const existingClient = this.clients.get(serverKey);
    if (existingClient) {
      try {
        console.log(`[MCP] 检查现有连接健康状态: ${server.name}`);
        await existingClient.ping();
        console.log(`[MCP] 复用现有连接: ${server.name}`);
        return existingClient;
      } catch (error) {
        console.warn(`[MCP] 现有连接已失效，重新创建: ${server.name}`, error);
        this.clients.delete(serverKey);
      }
    }

    const initPromise = (async (): Promise<Client> => {
      const isMobilePlatform = Capacitor.isNativePlatform();
      const clientInfo = isMobilePlatform ? MCP_CLIENT_INFO.MOBILE : MCP_CLIENT_INFO.WEB;
      const client = new Client(clientInfo, { capabilities: {} });

      try {
        let transport;

        if (server.type === 'inMemory') {
          console.log(`[MCP] 创建内存传输: ${server.name}`);
          const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
          const inMemoryServer = createInMemoryMCPServer(server.name, server.args || [], server.env || {});
          await inMemoryServer.connect(serverTransport);
          transport = clientTransport;

        } else if (server.type === 'stdio') {
          if (!StdioMCPClient.isAvailable()) {
            throw new Error('stdio 传输仅在 Tauri 桌面端可用');
          }
          if (!server.command) {
            throw new Error('stdio 服务器需要提供 command（要执行的命令）');
          }

          console.log(`[MCP] 创建 stdio 传输: ${server.command} ${(server.args || []).join(' ')}`);
          const stdioClient = await this.initStdioClient(server);

          stdioClient.onProcessExit = (code) => {
            console.log(`[MCP] stdio 子进程退出 (${server.name})，code: ${code}，清理缓存`);
            this.clients.delete(serverKey);
            this.stdioClients.delete(serverKey);
          };

          const compatClient = {
            connect: async () => {},
            close: async () => { await stdioClient.close(); },
            ping: async () => {
              if (!stdioClient.isAlive()) {
                throw new Error('stdio 子进程已退出');
              }
            },
            listTools: async () => {
              const tools = await stdioClient.listTools();
              return { tools };
            },
            callTool: async (params: { name: string; arguments: Record<string, unknown> }) => {
              return await stdioClient.callTool(params.name, params.arguments);
            },
            listPrompts: async () => {
              const prompts = await stdioClient.listPrompts();
              return { prompts };
            },
            listResources: async () => {
              const resources = await stdioClient.listResources();
              return { resources };
            }
          } as unknown as Client;

          this.clients.set(serverKey, compatClient);
          console.log(`[MCP] 成功连接到 stdio 服务器: ${server.name}`);
          return compatClient;

        } else if (server.type === 'sse' || server.type === 'streamableHttp' || server.type === 'httpStream') {
          const normalizedType = normalizeServerType(server);
          if (!server.baseUrl) {
            throw new Error(`${normalizedType} 服务器需要提供 baseUrl`);
          }

          console.log(`[MCP] 创建 ${normalizedType} 传输: ${server.baseUrl}`);
          const httpStreamClient = await this.initMcpClientAdapter({ ...server, type: normalizedType });

          const compatClient = {
            connect: async () => {},
            close: async () => { await httpStreamClient.close(); },
            ping: async () => {
              await httpStreamClient.listTools();
            },
            listTools: async () => {
              const tools = await httpStreamClient.listTools();
              return { tools };
            },
            callTool: async (params: { name: string; arguments: Record<string, unknown> }) => {
              return await httpStreamClient.callTool(params.name, params.arguments);
            },
            listPrompts: async () => {
              try {
                const prompts = await httpStreamClient.listPrompts();
                return { prompts };
              } catch {
                return { prompts: [] };
              }
            },
            listResources: async () => {
              try {
                const resources = await httpStreamClient.listResources();
                return { resources };
              } catch {
                return { resources: [] };
              }
            }
          } as unknown as Client;

          this.clients.set(serverKey, compatClient);
          console.log(`[MCP] 成功连接到 HTTP Stream 服务器: ${server.name}`);
          return compatClient;
        } else {
          throw new Error(`不支持的服务器类型: ${server.type}`);
        }

        if (server.type === 'inMemory') {
          await client.connect(transport);
          this.clients.set(serverKey, client);
          console.log(`[MCP] 成功连接到服务器: ${server.name}`);
          return client;
        }

        throw new Error(`未处理的服务器类型: ${server.type}`);
      } catch (error) {
        console.error(`[MCP] 连接服务器失败: ${server.name}`, error);

        if (error instanceof Error) {
          if (Capacitor.isNativePlatform() && isCorsError(error)) {
            console.log(`[MCP] 移动端CORS错误，这通常表示服务器配置问题或网络问题`);
            throw new MCPCorsError(
              `连接MCP服务器失败: ${server.name} - 网络连接问题或服务器不可用`,
              { serverName: server.name, cause: error }
            );
          }
          throw createMCPError(error, server.name);
        }
        throw error;
      } finally {
        this.pendingClients.delete(serverKey);
      }
    })();

    this.pendingClients.set(serverKey, initPromise);
    return initPromise;
  }

  // ── HTTP/SSE 适配器 ───────────────────────────

  private async initMcpClientAdapter(server: MCPServer): Promise<MCPClientAdapter | AiSdkMCPClient> {
    const serverKey = this.getServerKey(server);

    const existingClient = this.mcpClientAdapters.get(serverKey);
    if (existingClient) {
      console.log(`[MCP] 复用现有 MCP 客户端: ${server.name}`);
      return existingClient;
    }

    const pendingClient = this.pendingMcpClientAdapters.get(serverKey);
    if (pendingClient) {
      console.log(`[MCP] 等待正在初始化的 MCP 客户端: ${server.name}`);
      return pendingClient;
    }

    const initPromise = (async (): Promise<MCPClientAdapter | AiSdkMCPClient> => {
      try {
        const normalizedType = normalizeServerType(server);
        const transportType = normalizedType === 'streamableHttp' ? 'streamableHttp' : 'sse';

        const isMobile = Capacitor.isNativePlatform();
        console.log(`[MCP] 创建 MCP 客户端，传输类型: ${transportType}，平台: ${isMobile ? '移动端' : 'Web端'}`);

        console.log(`[MCP] ${isMobile ? '移动端' : 'Web端'} 使用 MCPClientAdapter`);

        let finalHeaders = server.headers || {};
        if (isMobile && finalHeaders) {
          const filteredHeaders: Record<string, string> = {};
          for (const [key, value] of Object.entries(finalHeaders)) {
            const lowerKey = key.toLowerCase();
            if (lowerKey !== 'origin' && lowerKey !== 'referer') {
              filteredHeaders[key] = value;
            }
          }
          finalHeaders = filteredHeaders;
          console.log(`[MCP] 移动端过滤 headers，移除 origin/referer`);
        }

        const client = new MCPClientAdapter({
          baseUrl: server.baseUrl!,
          headers: finalHeaders,
          timeout: (server.timeout || 60) * 1000,
          type: transportType
        });

        await client.initialize();

        this.mcpClientAdapters.set(serverKey, client as any);
        console.log(`[MCP] MCP 客户端初始化成功: ${server.name}`);

        return client;
      } catch (error) {
        console.error(`[MCP] MCP 客户端初始化失败: ${server.name}`, error);
        throw error;
      } finally {
        this.pendingMcpClientAdapters.delete(serverKey);
      }
    })();

    this.pendingMcpClientAdapters.set(serverKey, initPromise as any);
    return initPromise;
  }

  // ── Stdio 客户端 ──────────────────────────────

  private async initStdioClient(server: MCPServer): Promise<StdioMCPClient> {
    const serverKey = this.getServerKey(server);

    const existingClient = this.stdioClients.get(serverKey);
    if (existingClient) {
      if (existingClient.isAlive()) {
        console.log(`[MCP] 复用现有 Stdio 客户端: ${server.name}`);
        return existingClient;
      }
      console.warn(`[MCP] Stdio 客户端已失效，重新创建: ${server.name}`);
      this.stdioClients.delete(serverKey);
    }

    const pendingClient = this.pendingStdioClients.get(serverKey);
    if (pendingClient) {
      console.log(`[MCP] 等待正在初始化的 Stdio 客户端: ${server.name}`);
      return pendingClient;
    }

    const initPromise = (async (): Promise<StdioMCPClient> => {
      try {
        console.log(`[MCP] 创建 Stdio 客户端: ${server.command} ${(server.args || []).join(' ')}`);

        const client = new StdioMCPClient({
          command: server.command!,
          args: server.args || [],
          env: server.env || {},
          cwd: server.cwd,
          timeout: (server.timeout || 60) * 1000
        });

        await client.initialize();

        this.stdioClients.set(serverKey, client);
        console.log(`[MCP] Stdio 客户端初始化成功: ${server.name}`);

        return client;
      } catch (error) {
        console.error(`[MCP] Stdio 客户端初始化失败: ${server.name}`, error);
        throw error;
      } finally {
        this.pendingStdioClients.delete(serverKey);
      }
    })();

    this.pendingStdioClients.set(serverKey, initPromise);
    return initPromise;
  }

  // ── 关闭 / 清理 ──────────────────────────────

  async closeClient(serverKey: string): Promise<void> {
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

    const mcpClientAdapter = this.mcpClientAdapters.get(serverKey);
    if (mcpClientAdapter) {
      try {
        await mcpClientAdapter.close();
        console.log(`[MCP] 已关闭 MCP 客户端: ${serverKey}`);
      } catch (error) {
        console.error(`[MCP] 关闭 MCP 客户端连接失败:`, error);
      }
      this.mcpClientAdapters.delete(serverKey);
    }

    const stdioClient = this.stdioClients.get(serverKey);
    if (stdioClient) {
      try {
        await stdioClient.close();
        console.log(`[MCP] 已关闭 Stdio 客户端: ${serverKey}`);
      } catch (error) {
        console.error(`[MCP] 关闭 Stdio 客户端连接失败:`, error);
      }
      this.stdioClients.delete(serverKey);
    }

    this.pendingClients.delete(serverKey);
    this.pendingMcpClientAdapters.delete(serverKey);
    this.pendingStdioClients.delete(serverKey);
  }

  /** 删除指定 serverId 对应的客户端缓存 */
  removeClientById(serverId: string): void {
    this.clients.delete(serverId);
  }

  // ── 健康检查 / 状态 ──────────────────────────

  async testConnection(server: MCPServer): Promise<boolean> {
    try {
      console.log(`[MCP] 测试连接到服务器: ${server.name}`);
      const client = await this.initClient(server);
      await client.listTools();
      console.log(`[MCP] 连接测试成功: ${server.name}`);
      return true;
    } catch (error) {
      console.error(`[MCP] 连接测试失败: ${server.name}`, error);
      const serverKey = this.getServerKey(server);
      await this.closeClient(serverKey);
      return false;
    }
  }

  async checkConnectionHealth(server: MCPServer): Promise<boolean> {
    const serverKey = this.getServerKey(server);
    const client = this.clients.get(serverKey);

    if (!client) return false;

    try {
      await client.ping();
      return true;
    } catch (error) {
      console.warn(`[MCP] 连接健康检查失败: ${server.name}`, error);
      this.clients.delete(serverKey);
      return false;
    }
  }

  getConnectionStatus(): {
    activeConnections: number;
    pendingConnections: number;
    connections: Array<{ serverKey: string; status: 'active' | 'pending' }>;
  } {
    const connections: Array<{ serverKey: string; status: 'active' | 'pending' }> = [];

    for (const serverKey of this.clients.keys()) {
      connections.push({ serverKey, status: 'active' });
    }
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

  async cleanup(): Promise<void> {
    const promises = Array.from(this.clients.keys()).map(key => this.closeClient(key));
    await Promise.all(promises);
    this.pendingClients.clear();
    console.log('[MCP] 所有连接已清理');
  }
}
