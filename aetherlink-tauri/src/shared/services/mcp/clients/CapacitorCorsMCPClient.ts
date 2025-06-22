/**
 * Capacitor CORS MCP Client
 * 使用 CorsBypass 插件解决 MCP 的 CORS 问题
 */

import { CorsBypass } from 'capacitor-cors-bypass-enhanced';
import { Capacitor } from '@capacitor/core';

export interface CapacitorCorsMCPClientOptions {
  baseUrl: string;
  headers?: Record<string, string>;
  timeout?: number;
  enableSSE?: boolean; // 是否启用SSE流
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: any;
}

export interface MCPCallToolResponse {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError: boolean;
}

export class CapacitorCorsMCPClient {
  private baseUrl: string;
  private sessionId: string | null = null;
  private sseConnectionId: string | null = null;
  private options: CapacitorCorsMCPClientOptions;
  private requestId = 0;
  private pendingRequests = new Map<string, { resolve: (value: any) => void; reject: (reason?: any) => void }>();
  private messageEndpoint: string | null = null; // SSE消息发送端点

  constructor(options: CapacitorCorsMCPClientOptions) {
    this.options = options;
    this.baseUrl = options.baseUrl;
    console.log(`[Capacitor CORS MCP] 初始化客户端: ${this.baseUrl}`);
    console.log(`[Capacitor CORS MCP] 平台: ${Capacitor.isNativePlatform() ? '移动端' : 'Web端'}`);
  }

  /**
   * 检查是否为SSE端点
   */
  private isSSEEndpoint(): boolean {
    return this.baseUrl.includes('/sse');
  }

  /**
   * 初始化连接
   */
  async initialize(): Promise<void> {
    console.log(`[Capacitor CORS MCP] 初始化连接: ${this.baseUrl}`);

    // 检查是否为SSE端点
    if (this.isSSEEndpoint()) {
      console.log('[Capacitor CORS MCP] 检测到SSE端点，尝试使用SSE协议');
      try {
        await this.initializeSSE();
      } catch (error) {
        console.warn('[Capacitor CORS MCP] SSE协议失败，尝试HTTP Stream协议:', error);
        // 移除/sse后缀，尝试HTTP Stream协议
        this.baseUrl = this.baseUrl.replace('/sse', '');
        console.log(`[Capacitor CORS MCP] 回退到HTTP Stream URL: ${this.baseUrl}`);
        await this.initializeHTTPStream();
      }
    } else {
      console.log('[Capacitor CORS MCP] 使用标准HTTP Stream协议');
      await this.initializeHTTPStream();
    }
  }

  /**
   * 初始化SSE连接
   */
  private async initializeSSE(): Promise<void> {
    console.log('[Capacitor CORS MCP] SSE模式，连接到SSE端点');

    return new Promise(async (resolve, reject) => {
      try {
        // 使用 CorsBypass 插件启动 SSE 连接
        const result = await CorsBypass.startSSE({
          url: this.baseUrl,
          headers: this.options.headers,
          withCredentials: false
        });

        this.sseConnectionId = result.connectionId;
        console.log('[Capacitor CORS MCP] SSE连接已建立，连接ID:', this.sseConnectionId);

        // 监听 SSE 事件
        await this.setupSSEListeners();

        // 设置会话ID和消息端点
        this.sessionId = 'sse-session';
        this.messageEndpoint = this.baseUrl.replace('/sse', '/message'); // 假设消息端点

        console.log('[Capacitor CORS MCP] SSE初始化成功');
        resolve();

      } catch (e) {
        console.error('[Capacitor CORS MCP] SSE流开启失败:', e);
        reject(e);
      }
    });
  }

  /**
   * 设置 SSE 事件监听器
   */
  private async setupSSEListeners(): Promise<void> {
    // 监听 SSE 消息事件
    await CorsBypass.addListener('sseMessage', (event) => {
      if (event.connectionId === this.sseConnectionId) {
        try {
          console.log('[Capacitor CORS MCP] 收到原始SSE数据:', event.data);
          const message = JSON.parse(event.data);
          console.log('[Capacitor CORS MCP] 解析后的SSE消息:', message);
          this.handleServerMessage(message);
        } catch (e) {
          console.error('[Capacitor CORS MCP] 解析SSE消息失败:', e, '原始数据:', event.data);
        }
      }
    });

    // 监听 SSE 连接打开事件
    await CorsBypass.addListener('sseOpen', (event) => {
      if (event.connectionId === this.sseConnectionId) {
        console.log('[Capacitor CORS MCP] SSE连接已打开');
      }
    });

    // 监听 SSE 错误事件
    await CorsBypass.addListener('sseError', (event) => {
      if (event.connectionId === this.sseConnectionId) {
        console.error('[Capacitor CORS MCP] SSE连接错误:', event.error);
      }
    });

    // 监听 SSE 关闭事件
    await CorsBypass.addListener('sseClose', (event) => {
      if (event.connectionId === this.sseConnectionId) {
        console.log('[Capacitor CORS MCP] SSE连接已关闭');
      }
    });
  }

  /**
   * 初始化HTTP Stream连接
   */
  private async initializeHTTPStream(): Promise<void> {
    const initRequest = {
      jsonrpc: "2.0",
      id: this.generateRequestId(),
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: {
          name: "AetherLink",
          version: "1.0.0"
        }
      }
    };

    try {
      const response = await CorsBypass.post({
        url: this.baseUrl,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
          ...this.options.headers
        },
        data: initRequest,
        timeout: this.options.timeout || 30000,
        responseType: 'json'
      });

      // 调试：打印完整的响应信息
      console.log(`[Capacitor CORS MCP] 响应状态: ${response.status} ${response.statusText}`);
      console.log(`[Capacitor CORS MCP] 响应头:`, response.headers);

      // 获取会话ID
      this.sessionId = response.headers['Mcp-Session-Id'] || response.headers['mcp-session-id'];
      console.log(`[Capacitor CORS MCP] 会话ID: ${this.sessionId}`);

      if (!this.sessionId) {
        console.log(`[Capacitor CORS MCP] 响应数据:`, response.data);
        throw new Error(`服务器未返回会话ID。响应: ${JSON.stringify(response.data).substring(0, 200)}`);
      }

      // 处理初始化响应
      if (response.data && response.data.error) {
        throw new Error(`初始化失败: ${response.data.error.message}`);
      }

      console.log('[Capacitor CORS MCP] 初始化响应:', response.data);

      // 根据配置决定是否开启SSE流
      if (this.options.enableSSE === true) {
        console.log('[Capacitor CORS MCP] 启用SSE流模式');
        try {
          await this.openEventStream();
        } catch (e) {
          console.warn('[Capacitor CORS MCP] SSE流开启失败，将使用HTTP请求/响应模式:', e);
        }
      } else {
        console.log('[Capacitor CORS MCP] SSE流已禁用，仅使用HTTP请求/响应模式');
      }

    } catch (error) {
      console.error('[Capacitor CORS MCP] 初始化失败:', error);
      throw error;
    }
  }

  /**
   * 开启SSE事件流（仅用于HTTP Stream端点）
   */
  private async openEventStream(): Promise<void> {
    if (!this.sessionId) {
      throw new Error('会话未初始化');
    }

    // 对于HTTP Stream端点，添加session参数
    const url = new URL(this.baseUrl);
    url.searchParams.append('session', this.sessionId);
    const sseUrl = url.toString();
    console.log(`[Capacitor CORS MCP] 开启SSE流（HTTP Stream端点）: ${sseUrl}`);

    try {
      const result = await CorsBypass.startSSE({
        url: sseUrl,
        headers: this.options.headers,
        withCredentials: false
      });

      this.sseConnectionId = result.connectionId;
      await this.setupSSEListeners();
      console.log('[Capacitor CORS MCP] SSE流已开启');
    } catch (error) {
      console.warn('[Capacitor CORS MCP] SSE连接错误 (可能服务器不支持SSE):', error);
      throw error;
    }
  }

  /**
   * 生成请求ID
   */
  private generateRequestId(): string {
    return `req_${++this.requestId}_${Date.now()}`;
  }

  /**
   * 处理服务器消息
   */
  private handleServerMessage(message: any): void {
    if (message.id && this.pendingRequests.has(message.id)) {
      const { resolve, reject } = this.pendingRequests.get(message.id)!;
      this.pendingRequests.delete(message.id);

      if (message.error) {
        reject(new Error(message.error.message));
      } else {
        resolve(message.result);
      }
    }
  }

  /**
   * 发送请求
   */
  async sendRequest(method: string, params: any = {}): Promise<any> {
    if (!this.sessionId) {
      throw new Error('会话未初始化');
    }

    // 如果有消息端点，说明是SSE模式
    if (this.messageEndpoint) {
      // 对于SSE端点，通过SSE流发送请求
      return this.sendSSERequest(method, params);
    } else {
      // 对于HTTP Stream端点，使用POST请求
      return this.sendHTTPStreamRequest(method, params);
    }
  }

  /**
   * 通过SSE发送请求
   */
  private async sendSSERequest(method: string, params: any = {}): Promise<any> {
    if (!this.messageEndpoint) {
      throw new Error('消息端点未初始化');
    }

    const requestId = this.generateRequestId();
    const request = {
      jsonrpc: "2.0",
      id: requestId,
      method,
      params
    };

    console.log(`[Capacitor CORS MCP] 发送SSE请求到消息端点: ${method}`, params);
    console.log(`[Capacitor CORS MCP] 消息端点: ${this.messageEndpoint}`);

    // 根据mcp-framework文档，通过POST请求发送到消息端点
    return new Promise(async (resolve, reject) => {
      this.pendingRequests.set(requestId, { resolve, reject });

      try {
        const response = await CorsBypass.post({
          url: this.messageEndpoint!,
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...this.options.headers
          },
          data: request,
          timeout: this.options.timeout || 30000,
          responseType: 'json'
        });

        // 检查响应
        if (response.status >= 400) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // 响应应该通过SSE流返回，这里只是确认请求已发送
        console.log('[Capacitor CORS MCP] SSE请求已发送，等待SSE响应');

      } catch (error) {
        this.pendingRequests.delete(requestId);
        reject(error);
      }

      // 设置超时
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error('请求超时'));
        }
      }, this.options.timeout || 30000);
    });
  }

  /**
   * 通过HTTP Stream发送请求
   */
  private async sendHTTPStreamRequest(method: string, params: any = {}): Promise<any> {
    const requestId = this.generateRequestId();
    const request = {
      jsonrpc: "2.0",
      id: requestId,
      method,
      params
    };

    console.log(`[Capacitor CORS MCP] 发送HTTP Stream请求: ${method}`, params);

    const response = await CorsBypass.post({
      url: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'Mcp-Session-Id': this.sessionId!,
        ...this.options.headers
      },
      data: request,
      timeout: this.options.timeout || 30000,
      responseType: 'json'
    });

    // 检查响应
    if (response.status >= 400) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // 对于 CorsBypass，我们直接处理 JSON 响应
    if (response.data && response.data.error) {
      throw new Error(response.data.error.message);
    }

    return response.data ? response.data.result : response.data;
  }

  /**
   * 列出工具
   */
  async listTools(): Promise<MCPTool[]> {
    const result = await this.sendRequest('tools/list');
    return result.tools || [];
  }

  /**
   * 调用工具
   */
  async callTool(name: string, arguments_: Record<string, any>): Promise<MCPCallToolResponse> {
    const result = await this.sendRequest('tools/call', {
      name,
      arguments: arguments_
    });

    return {
      content: result.content || [],
      isError: Boolean(result.isError)
    };
  }

  /**
   * 关闭连接
   */
  async close(): Promise<void> {
    console.log('[Capacitor CORS MCP] 关闭连接');

    // 关闭 SSE 连接
    if (this.sseConnectionId) {
      try {
        await CorsBypass.stopSSE({
          connectionId: this.sseConnectionId
        });
        console.log('[Capacitor CORS MCP] SSE连接已关闭');
      } catch (error) {
        console.error('[Capacitor CORS MCP] 关闭SSE连接失败:', error);
      }
      this.sseConnectionId = null;
    }

    // 清理待处理的请求
    this.pendingRequests.clear();
    this.sessionId = null;
    this.messageEndpoint = null;
  }
}
