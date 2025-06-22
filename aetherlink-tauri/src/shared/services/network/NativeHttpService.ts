/**
 * 原生HTTP服务 - 绕过WebView的CORS限制
 * 专门用于移动端的MCP服务器通信
 */

import { Capacitor } from '@capacitor/core';
import { CorsBypass } from 'capacitor-cors-bypass-enhanced';

export interface NativeHttpResponse {
  status: number;
  statusText: string;
  data: string;
  headers: Record<string, string>;
  url: string;
  ok: boolean;
  text(): Promise<string>;
  json(): Promise<any>;
}

export class NativeHttpService {
  private static instance: NativeHttpService;

  static getInstance(): NativeHttpService {
    if (!NativeHttpService.instance) {
      NativeHttpService.instance = new NativeHttpService();
    }
    return NativeHttpService.instance;
  }

  /**
   * 检查是否应该使用原生HTTP
   */
  shouldUseNativeHttp(url: string): boolean {
    // 只在移动端使用
    if (!Capacitor.isNativePlatform()) {
      return false;
    }

    // 对所有外部URL使用原生HTTP
    try {
      const urlObj = new URL(url);
      const currentOrigin = window.location.origin;

      // 排除本地地址
      const hostname = urlObj.hostname;
      if (hostname === 'localhost' ||
          hostname === '127.0.0.1' ||
          hostname.startsWith('192.168.') ||
          hostname.startsWith('10.0.') ||
          hostname.startsWith('172.')) {
        return false;
      }

      // 所有非本地的外部URL都使用原生HTTP
      const isExternal = urlObj.origin !== currentOrigin;
      if (isExternal) {
        console.log(`[Native HTTP] 检测到外部URL，使用原生HTTP: ${url}`);
      }

      return isExternal;
    } catch {
      return false;
    }
  }

  /**
   * 执行原生HTTP请求 - 使用 CorsBypass 插件
   */
  async request(url: string, options: RequestInit = {}): Promise<NativeHttpResponse> {
    console.log('[Native HTTP] 执行 CorsBypass 请求:', url);

    try {
      // 使用 CorsBypass 插件进行请求
      const result = await CorsBypass.request({
        url,
        method: (options.method || 'GET') as any,
        headers: this.extractHeaders(options.headers),
        data: options.body,
        timeout: 30000,
        responseType: 'text'
      });

      console.log('[Native HTTP] CorsBypass 请求成功:', result.status, result.statusText);

      // 包装成类似fetch Response的对象
      const response: NativeHttpResponse = {
        status: result.status,
        statusText: result.statusText,
        data: result.data,
        headers: result.headers,
        url: result.url,
        ok: result.status >= 200 && result.status < 300,
        text: async () => result.data,
        json: async () => {
          try {
            return JSON.parse(result.data);
          } catch (e) {
            throw new Error('Invalid JSON response');
          }
        }
      };

      return response;
    } catch (error) {
      console.error('[Native HTTP] CorsBypass 请求失败:', error);
      throw error;
    }
  }

  /**
   * 提取请求头
   */
  private extractHeaders(headers?: HeadersInit): Record<string, string> {
    const result: Record<string, string> = {};

    if (!headers) {
      return result;
    }

    if (headers instanceof Headers) {
      headers.forEach((value, key) => {
        result[key] = value;
      });
    } else if (Array.isArray(headers)) {
      headers.forEach(([key, value]) => {
        result[key] = value;
      });
    } else {
      Object.entries(headers).forEach(([key, value]) => {
        result[key] = value;
      });
    }

    return result;
  }
}

/**
 * 原生EventSource - 使用 CorsBypass 插件绕过CORS限制
 */
export class NativeEventSource {
  private connectionId: string;
  private url: string;
  private headers: Record<string, string>;
  private listeners: Map<string, ((event: any) => void)[]> = new Map();
  private isConnected = false;

  constructor(url: string, options: { headers?: Record<string, string> } = {}) {
    this.url = url;
    this.headers = options.headers || {};
    this.connectionId = `sse_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 监听 CorsBypass SSE 事件
    this.setupCorsBypassListeners();
  }

  private async setupCorsBypassListeners() {
    // 监听 SSE 消息事件
    await CorsBypass.addListener('sseMessage', (event) => {
      if (event.connectionId === this.connectionId) {
        this.dispatchEvent('message', {
          data: event.data,
          type: event.type || 'message'
        });
        // 如果有特定事件类型，也触发对应的监听器
        if (event.type && event.type !== 'message') {
          this.dispatchEvent(event.type, { data: event.data });
        }
      }
    });

    // 监听 SSE 连接打开事件
    await CorsBypass.addListener('sseOpen', (event) => {
      if (event.connectionId === this.connectionId) {
        this.isConnected = true;
        this.dispatchEvent('open', {});
      }
    });

    // 监听 SSE 错误事件
    await CorsBypass.addListener('sseError', (event) => {
      if (event.connectionId === this.connectionId) {
        this.isConnected = false;
        this.dispatchEvent('error', { error: event.error });
      }
    });

    // 监听 SSE 关闭事件
    await CorsBypass.addListener('sseClose', (event) => {
      if (event.connectionId === this.connectionId) {
        this.isConnected = false;
        this.dispatchEvent('close', {});
      }
    });
  }



  private dispatchEvent(type: string, data: any) {
    const listeners = this.listeners.get(type) || [];
    listeners.forEach(listener => {
      try {
        listener(data);
      } catch (e) {
        console.error(`[Native EventSource] 事件监听器错误:`, e);
      }
    });
  }

  addEventListener(type: string, listener: (event: any) => void) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(listener);
  }

  removeEventListener(type: string, listener: (event: any) => void) {
    const listeners = this.listeners.get(type);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    console.log(`[Native EventSource] 使用 CorsBypass 连接到: ${this.url}`);

    try {
      const result = await CorsBypass.startSSE({
        url: this.url,
        headers: this.headers,
        withCredentials: false
      });

      // 使用插件返回的连接ID
      this.connectionId = result.connectionId;
      console.log(`[Native EventSource] CorsBypass SSE 连接成功，连接ID: ${this.connectionId}`);
    } catch (error) {
      console.error(`[Native EventSource] CorsBypass 连接失败:`, error);
      throw error;
    }
  }

  async close(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    console.log(`[Native EventSource] 使用 CorsBypass 断开连接: ${this.url}`);

    try {
      await CorsBypass.stopSSE({
        connectionId: this.connectionId
      });
      console.log(`[Native EventSource] CorsBypass SSE 连接已断开`);
    } catch (error) {
      console.error(`[Native EventSource] CorsBypass 断开连接失败:`, error);
    }

    this.isConnected = false;
  }

  get readyState(): number {
    return this.isConnected ? 1 : 0; // 1 = OPEN, 0 = CONNECTING/CLOSED
  }

  // 兼容标准EventSource API
  set onopen(handler: ((event: any) => void) | null) {
    if (handler) {
      this.addEventListener('open', handler);
    }
  }

  set onmessage(handler: ((event: any) => void) | null) {
    if (handler) {
      this.addEventListener('message', handler);
    }
  }

  set onerror(handler: ((event: any) => void) | null) {
    if (handler) {
      this.addEventListener('error', handler);
    }
  }
}
