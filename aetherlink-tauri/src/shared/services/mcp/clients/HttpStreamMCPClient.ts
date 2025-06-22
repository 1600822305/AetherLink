/**
 * HTTP Stream MCP Client
 * 兼容 mcp-framework 的 HTTP Stream Transport 协议
 */

import { universalFetch, getFullProxyUrl } from '../../../utils/universalFetch';
import { Capacitor } from '@capacitor/core';

export interface HttpStreamMCPClientOptions {
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

export class HttpStreamMCPClient {
  private baseUrl: string;
  private sessionId: string | null = null;
  private eventSource: EventSource | null = null;
  private options: HttpStreamMCPClientOptions;
  private requestId = 0;
  private pendingRequests = new Map<string, { resolve: (value: any) => void; reject: (reason?: any) => void }>();
  private messageEndpoint: string | null = null; // SSE消息发送端点

  constructor(options: HttpStreamMCPClientOptions) {
    this.options = options;
    // 使用代理URL，原始URL应该已经包含正确的路径
    this.baseUrl = getFullProxyUrl(options.baseUrl);
    console.log(`[HTTP Stream MCP] 原始URL: ${options.baseUrl}`);
    console.log(`[HTTP Stream MCP] 代理URL: ${this.baseUrl}`);
    console.log(`[HTTP Stream MCP] 平台: ${Capacitor.isNativePlatform() ? '移动端' : 'Web端'}`);
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
    console.log(`[HTTP Stream MCP] 初始化连接: ${this.baseUrl}`);

    // 检查是否为SSE端点
    if (this.isSSEEndpoint()) {
      console.log('[HTTP Stream MCP] 检测到SSE端点，尝试使用SSE协议');
      try {
        await this.initializeSSE();
      } catch (error) {
        console.warn('[HTTP Stream MCP] SSE协议失败，尝试HTTP Stream协议:', error);
        // 移除/sse后缀，尝试HTTP Stream协议
        this.baseUrl = this.baseUrl.replace('/sse', '');

        // 对于glama.ai，可能需要特殊的HTTP Stream端点
        if (this.baseUrl.includes('glama.ai')) {
          // glama.ai可能不支持HTTP Stream，只支持SSE
          console.error('[HTTP Stream MCP] glama.ai可能只支持SSE协议，HTTP Stream不可用');
          throw new Error('glama.ai服务器只支持SSE协议，请检查服务器配置');
        }

        console.log(`[HTTP Stream MCP] 回退到HTTP Stream URL: ${this.baseUrl}`);
        await this.initializeHTTPStream();
      }
    } else {
      console.log('[HTTP Stream MCP] 使用标准HTTP Stream协议');
      await this.initializeHTTPStream();
    }
  }

  /**
   * 初始化SSE连接
   */
  private async initializeSSE(): Promise<void> {
    console.log('[HTTP Stream MCP] SSE模式，连接到SSE端点');

    return new Promise((resolve, reject) => {
      try {
        // 直接连接到SSE端点，不带任何参数
        this.eventSource = new EventSource(this.baseUrl);

        // 监听endpoint事件 - 服务器会发送消息端点URL
        this.eventSource.addEventListener('endpoint', (event) => {
          const endpointPath = event.data;

          console.log('[HTTP Stream MCP] 收到原始消息端点:', endpointPath);

          // 智能处理消息端点URL
          if (endpointPath.startsWith('http://') || endpointPath.startsWith('https://')) {
            // 已经是完整URL，直接使用
            this.messageEndpoint = endpointPath;
          } else if (endpointPath.startsWith('/')) {
            // 相对路径，需要转换为完整URL
            const baseUrlObj = new URL(this.baseUrl);
            this.messageEndpoint = `${baseUrlObj.origin}${endpointPath}`;
          } else {
            // 其他格式，尝试作为相对路径处理
            const baseUrlObj = new URL(this.baseUrl);
            this.messageEndpoint = `${baseUrlObj.origin}/${endpointPath}`;
          }

          this.sessionId = 'sse-session';
          console.log('[HTTP Stream MCP] 处理后的消息端点:', this.messageEndpoint);
          console.log('[HTTP Stream MCP] SSE初始化成功');
          resolve();
        });

        // 监听普通消息
        this.eventSource.onmessage = (event) => {
          try {
            console.log('[HTTP Stream MCP] 收到原始SSE数据:', event.data);
            const message = JSON.parse(event.data);
            console.log('[HTTP Stream MCP] 解析后的SSE消息:', message);
            this.handleServerMessage(message);
          } catch (e) {
            console.error('[HTTP Stream MCP] 解析SSE消息失败:', e, '原始数据:', event.data);
          }
        };

        this.eventSource.onopen = (event) => {
          console.log('[HTTP Stream MCP] SSE连接已打开:', event);
        };

        this.eventSource.onerror = (error) => {
          console.error('[HTTP Stream MCP] SSE连接错误:', error);
          console.error('[HTTP Stream MCP] 连接URL:', this.baseUrl);
          console.error('[HTTP Stream MCP] 原始URL:', this.options.baseUrl);
          reject(new Error('SSE连接失败'));
        };

        // 设置超时
        setTimeout(() => {
          if (!this.messageEndpoint) {
            reject(new Error('SSE初始化超时：未收到endpoint事件'));
          }
        }, this.options.timeout || 30000);

      } catch (e) {
        console.error('[HTTP Stream MCP] SSE流开启失败:', e);
        reject(e);
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
      const response = await universalFetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
          ...this.options.headers
        },
        body: JSON.stringify(initRequest),
        timeout: this.options.timeout || 30000
      });

      // 调试：打印完整的响应信息
      console.log(`[HTTP Stream MCP] 响应状态: ${response.status} ${response.statusText}`);
      console.log(`[HTTP Stream MCP] 响应头:`, Object.fromEntries(response.headers.entries()));

      // 获取会话ID
      this.sessionId = response.headers.get('Mcp-Session-Id');
      console.log(`[HTTP Stream MCP] 会话ID: ${this.sessionId}`);

      // 检查响应内容
      const contentType = response.headers.get('Content-Type');
      console.log(`[HTTP Stream MCP] Content-Type: ${contentType}`);

      if (!this.sessionId) {
        // 尝试读取响应体来获取更多信息
        try {
          const responseText = await response.text();
          console.log(`[HTTP Stream MCP] 响应体:`, responseText);
          throw new Error(`服务器未返回会话ID。响应: ${responseText.substring(0, 200)}`);
        } catch (e) {
          console.error('[HTTP Stream MCP] 读取响应体失败:', e);
          throw new Error('服务器未返回会话ID');
        }
      }

      // 处理初始化响应
      if (response.headers.get('Content-Type')?.includes('text/event-stream')) {
        await this.processStreamResponse(response);
      } else {
        const result = await response.json();
        console.log('[HTTP Stream MCP] 初始化响应:', result);

        if (result.error) {
          throw new Error(`初始化失败: ${result.error.message}`);
        }
      }

      // 根据配置决定是否开启SSE流
      if (this.options.enableSSE === true) { // 只有明确启用时才开启SSE
        console.log('[HTTP Stream MCP] 启用SSE流模式');
        try {
          this.openEventStream();
        } catch (e) {
          console.warn('[HTTP Stream MCP] SSE流开启失败，将使用HTTP请求/响应模式:', e);
        }
      } else {
        console.log('[HTTP Stream MCP] SSE流已禁用，仅使用HTTP请求/响应模式');
      }

    } catch (error) {
      console.error('[HTTP Stream MCP] 初始化失败:', error);
      throw error;
    }
  }

  /**
   * 开启SSE事件流（仅用于HTTP Stream端点）
   */
  private openEventStream(): void {
    if (!this.sessionId) {
      throw new Error('会话未初始化');
    }

    // 对于HTTP Stream端点，添加session参数
    const url = new URL(this.baseUrl);
    url.searchParams.append('session', this.sessionId);
    const sseUrl = url.toString();
    console.log(`[HTTP Stream MCP] 开启SSE流（HTTP Stream端点）: ${sseUrl}`);

    this.eventSource = new EventSource(sseUrl);

    this.eventSource.onmessage = (event) => {
      try {
        console.log('[HTTP Stream MCP] 收到原始SSE数据:', event.data);
        const message = JSON.parse(event.data);
        console.log('[HTTP Stream MCP] 解析后的SSE消息:', message);
        this.handleServerMessage(message);
      } catch (e) {
        console.error('[HTTP Stream MCP] 解析SSE消息失败:', e, '原始数据:', event.data);
      }
    };

    this.eventSource.onopen = (event) => {
      console.log('[HTTP Stream MCP] SSE连接已打开:', event);
    };

    this.eventSource.onerror = (error) => {
      console.warn('[HTTP Stream MCP] SSE连接错误 (可能服务器不支持SSE):', error);
      // 不自动重连，因为可能服务器不支持SSE
      if (this.eventSource) {
        this.eventSource.close();
        this.eventSource = null;
      }
    };

    console.log('[HTTP Stream MCP] SSE流已开启');
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
   * 处理流式响应
   */
  private async processStreamResponse(response: Response): Promise<void> {
    const reader = response.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const decodedValue = decoder.decode(value, { stream: true });
        if (decodedValue) {
          buffer += decodedValue;
        }

        // 处理SSE事件 - 添加安全检查
        if (buffer) {
          const events = buffer.split("\n\n");
          buffer = events.pop() || "";

          for (const event of events) {
            if (!event) continue; // 跳过空事件
            const lines = event.split("\n");
            const data = lines.find((line: string) => line && line.startsWith("data:"))?.slice(5);

            if (data) {
              try {
                const message = JSON.parse(data);
                console.log('[HTTP Stream MCP] 收到流消息:', message);
                this.handleServerMessage(message);
              } catch (e) {
                console.error('[HTTP Stream MCP] 解析流消息失败:', e);
              }
            }
          }
        }
      }
    } catch (e) {
      console.error('[HTTP Stream MCP] 读取流失败:', e);
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

    console.log(`[HTTP Stream MCP] 发送SSE请求到消息端点: ${method}`, params);
    console.log(`[HTTP Stream MCP] 消息端点: ${this.messageEndpoint}`);

    // 根据mcp-framework文档，通过POST请求发送到消息端点
    return new Promise(async (resolve, reject) => {
      this.pendingRequests.set(requestId, { resolve, reject });

      try {
        if (!this.messageEndpoint) {
          throw new Error('Message endpoint is not configured');
        }
        const response = await universalFetch(this.messageEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...this.options.headers
          },
          body: JSON.stringify(request),
          timeout: this.options.timeout || 30000
        });

        // 检查响应
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // 响应应该通过SSE流返回，这里只是确认请求已发送
        console.log('[HTTP Stream MCP] SSE请求已发送，等待SSE响应');

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

    console.log(`[HTTP Stream MCP] 发送HTTP Stream请求: ${method}`, params);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      ...this.options.headers
    };

    if (this.sessionId) {
      headers['Mcp-Session-Id'] = this.sessionId;
    }

    const response = await universalFetch(this.baseUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
      timeout: this.options.timeout || 30000
    });

    if (response.headers.get('Content-Type')?.includes('text/event-stream')) {
      // 流式响应，通过SSE处理
      this.processStreamResponse(response);

      // 等待响应
      return new Promise((resolve, reject) => {
        this.pendingRequests.set(requestId, { resolve, reject });

        // 设置超时
        setTimeout(() => {
          if (this.pendingRequests.has(requestId)) {
            this.pendingRequests.delete(requestId);
            reject(new Error('请求超时'));
          }
        }, this.options.timeout || 30000);
      });
    } else {
      // JSON响应
      const result = await response.json();
      if (result.error) {
        throw new Error(result.error.message);
      }
      return result.result;
    }
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
   * 生成请求ID
   */
  private generateRequestId(): string {
    return `req-${++this.requestId}-${Date.now()}`;
  }

  /**
   * 关闭连接
   */
  async close(): Promise<void> {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    if (this.sessionId) {
      try {
        await universalFetch(this.baseUrl, {
          method: 'DELETE',
          headers: {
            'Mcp-Session-Id': this.sessionId
          }
        });
        console.log('[HTTP Stream MCP] 会话已终止');
      } catch (e) {
        console.error('[HTTP Stream MCP] 终止会话失败:', e);
      }

      this.sessionId = null;
    }
  }
}
