/**
 * 自定义 SSE 客户端，使用 event-source-polyfill 解决移动端 CORS 问题
 */

import { EventSourcePolyfill } from 'event-source-polyfill';
import { Capacitor } from '@capacitor/core';

export interface SSEClientOptions {
  headers?: Record<string, string>;
  withCredentials?: boolean;
  heartbeatTimeout?: number;
  retry?: number;
}

export class SSEClient {
  private eventSource: EventSourcePolyfill | null = null;
  private url: string;
  private options: SSEClientOptions;
  private listeners: Map<string, Set<(event: MessageEvent) => void>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor(url: string, options: SSEClientOptions = {}) {
    this.url = url;
    this.options = {
      headers: {},
      withCredentials: false,
      heartbeatTimeout: 45000,
      retry: 3000,
      ...options
    };
  }

  /**
   * 连接到 SSE 服务器
   */
  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        console.log(`[SSE Client] 连接到: ${this.url}`);

        // 移动端使用特殊配置绕过CORS
        const eventSourceOptions: any = {
          headers: {
            'Accept': 'text/event-stream',
            'Cache-Control': 'no-cache',
            ...this.options.headers
          },
          withCredentials: this.options.withCredentials,
          heartbeatTimeout: this.options.heartbeatTimeout
        };

        // 移动端添加额外的配置来绕过CORS
        if (Capacitor.isNativePlatform()) {
          console.log(`[SSE Client] 移动端模式，配置CORS绕过`);
          eventSourceOptions.headers['User-Agent'] = 'AetherLink-Mobile/1.0';
          // 禁用CORS检查（仅在支持的polyfill中有效）
          eventSourceOptions.withCredentials = false;
        }

        this.eventSource = new EventSourcePolyfill(this.url, eventSourceOptions);

        this.eventSource.onopen = (_event: Event) => {
          console.log(`[SSE Client] 连接已建立`);
          this.reconnectAttempts = 0;
          resolve();
        };

        this.eventSource.onerror = (event: Event) => {
          console.error(`[SSE Client] 连接错误:`, event);

          // 在移动端，如果是CORS错误，提供更友好的错误信息
          if (Capacitor.isNativePlatform()) {
            console.log(`[SSE Client] 移动端SSE连接错误，可能是服务器不支持或网络问题`);
          }

          if (this.eventSource?.readyState === EventSource.CLOSED) {
            console.log(`[SSE Client] 连接已关闭，尝试重连...`);
            this.handleReconnect();
          }

          if (this.reconnectAttempts === 0) {
            const errorMessage = Capacitor.isNativePlatform()
              ? 'SSE connection failed - 移动端连接失败，请检查网络或服务器状态'
              : 'SSE connection failed';
            reject(new Error(errorMessage));
          }
        };

        this.eventSource.onmessage = (event: MessageEvent) => {
          console.log(`[SSE Client] 收到消息:`, event.data);
          this.notifyListeners('message', event);
        };

      } catch (error) {
        console.error(`[SSE Client] 创建连接失败:`, error);
        reject(error);
      }
    });
  }

  /**
   * 添加事件监听器
   */
  public addEventListener(type: string, listener: (event: MessageEvent) => void): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);

    // 如果 EventSource 已经存在，直接添加监听器
    if (this.eventSource) {
      this.eventSource.addEventListener(type, listener as EventListener);
    }
  }

  /**
   * 移除事件监听器
   */
  public removeEventListener(type: string, listener: (event: MessageEvent) => void): void {
    const listeners = this.listeners.get(type);
    if (listeners) {
      listeners.delete(listener);
      if (listeners.size === 0) {
        this.listeners.delete(type);
      }
    }

    if (this.eventSource) {
      this.eventSource.removeEventListener(type, listener as EventListener);
    }
  }

  /**
   * 关闭连接
   */
  public close(): void {
    console.log(`[SSE Client] 关闭连接`);
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.listeners.clear();
  }

  /**
   * 获取连接状态
   */
  public get readyState(): number {
    return this.eventSource?.readyState ?? EventSource.CLOSED;
  }

  /**
   * 处理重连逻辑
   */
  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(`[SSE Client] 重连次数已达上限 (${this.maxReconnectAttempts})`);
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // 指数退避

    console.log(`[SSE Client] ${delay}ms 后进行第 ${this.reconnectAttempts} 次重连...`);

    setTimeout(() => {
      this.connect().catch(error => {
        console.error(`[SSE Client] 重连失败:`, error);
      });
    }, delay);
  }

  /**
   * 通知所有监听器
   */
  private notifyListeners(type: string, event: MessageEvent): void {
    const listeners = this.listeners.get(type);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          console.error(`[SSE Client] 监听器执行错误:`, error);
        }
      });
    }
  }
}

/**
 * 创建 SSE 客户端实例
 */
export function createSSEClient(url: string, options?: SSEClientOptions): SSEClient {
  return new SSEClient(url, options);
}
