/**
 * 增强网络监控服务
 * 提供类似浏览器开发者工具的网络面板功能
 * 捕获所有网络请求，包括 fetch、XMLHttpRequest、axios 等
 */

export type NetworkMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
export type NetworkStatus = 'pending' | 'success' | 'error' | 'cancelled';

export interface NetworkEntry {
  id: string;
  method: NetworkMethod;
  url: string;
  status: NetworkStatus;
  statusCode?: number;
  statusText?: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  requestHeaders: Record<string, string>;
  responseHeaders: Record<string, string>;
  requestPayload?: any;
  responseData?: any;
  responseSize?: number;
  requestSize?: number;
  type: 'fetch' | 'xhr' | 'axios';
  error?: {
    message: string;
    stack?: string;
  };
  initiator?: {
    stack: string;
    url: string;
    line: number;
    column: number;
  };
}

export interface NetworkFilter {
  methods: Set<NetworkMethod>;
  statuses: Set<NetworkStatus>;
  searchText: string;
  hideDataUrls: boolean;
  onlyErrors: boolean;
}

class EnhancedNetworkService {
  private static instance: EnhancedNetworkService;
  private entries: NetworkEntry[] = [];
  private maxEntries = 500;
  private listeners: ((entries: NetworkEntry[]) => void)[] = [];
  private isIntercepting = false;
  private originalFetch: typeof fetch;
  private originalXHROpen: typeof XMLHttpRequest.prototype.open;
  private originalXHRSend: typeof XMLHttpRequest.prototype.send;

  private constructor() {
    this.originalFetch = window.fetch.bind(window);
    this.originalXHROpen = XMLHttpRequest.prototype.open;
    this.originalXHRSend = XMLHttpRequest.prototype.send;
    this.setupNetworkInterception();
  }

  public static getInstance(): EnhancedNetworkService {
    if (!EnhancedNetworkService.instance) {
      EnhancedNetworkService.instance = new EnhancedNetworkService();
    }
    return EnhancedNetworkService.instance;
  }

  private setupNetworkInterception(): void {
    if (this.isIntercepting) return;

    this.interceptFetch();
    this.interceptXHR();
    this.isIntercepting = true;
  }

  private interceptFetch(): void {
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const id = this.generateId();
      const url = typeof input === 'string' ? input : 
                  input instanceof URL ? input.toString() : 
                  (input as Request).url;
      
      const method = (init?.method || 
                     (input instanceof Request ? input.method : 'GET')).toUpperCase() as NetworkMethod;

      const requestHeaders = this.extractHeaders(init?.headers || 
                                               (input instanceof Request ? input.headers : undefined));
      
      const entry: NetworkEntry = {
        id,
        method,
        url,
        status: 'pending',
        startTime: performance.now(),
        requestHeaders,
        responseHeaders: {},
        type: 'fetch',
        initiator: this.getInitiator()
      };

      // 处理请求体
      if (init?.body) {
        try {
          entry.requestPayload = this.serializeRequestBodySync(init.body);
          entry.requestSize = this.calculateSize(init.body);
        } catch (error) {
          entry.requestPayload = '[Failed to serialize request body]';
        }
      }

      this.addEntry(entry);

      try {
        const response = await this.originalFetch(input, init);
        const endTime = performance.now();

        // 检查是否是流式响应，避免缓冲问题
        const contentType = response.headers.get('content-type') || '';
        const isStreamResponse = contentType.includes('text/event-stream') ||
                                contentType.includes('application/stream') ||
                                url.includes('/chat/completions');

        if (isStreamResponse) {
          // 对于流式响应，只记录基本信息，不读取响应体以避免缓冲
          this.updateEntry(id, {
            status: response.ok ? 'success' : 'error',
            statusCode: response.status,
            statusText: response.statusText,
            endTime,
            duration: endTime - entry.startTime,
            responseHeaders: this.extractHeaders(response.headers),
            responseData: '[Streaming Response - Not Captured]',
            responseSize: 0
          });
        } else {
          // 非流式响应，正常处理
          const clonedResponse = response.clone();
          let responseData: any;
          let responseSize = 0;

          try {
            const contentLength = response.headers.get('content-length');

            if (contentLength) {
              responseSize = parseInt(contentLength, 10);
            }

            if (contentType.includes('application/json')) {
              responseData = await clonedResponse.json();
            } else if (contentType.includes('text/')) {
              responseData = await clonedResponse.text();
            } else if (contentType.includes('image/') || contentType.includes('video/') || contentType.includes('audio/')) {
              responseData = `[${contentType} - ${responseSize} bytes]`;
            } else {
              responseData = '[Binary Data]';
            }

            if (!responseSize && responseData) {
              responseSize = this.calculateSize(responseData);
            }
          } catch (e) {
            responseData = '[Failed to parse response]';
          }

          this.updateEntry(id, {
            status: response.ok ? 'success' : 'error',
            statusCode: response.status,
            statusText: response.statusText,
            endTime,
            duration: endTime - entry.startTime,
            responseHeaders: this.extractHeaders(response.headers),
            responseData,
            responseSize
          });
        }

        return response;
      } catch (error: any) {
        const endTime = performance.now();
        
        this.updateEntry(id, {
          status: 'error',
          endTime,
          duration: endTime - entry.startTime,
          error: {
            message: error.message,
            stack: error.stack
          }
        });

        throw error;
      }
    };
  }

  private interceptXHR(): void {
    const generateId = this.generateId.bind(this);
    const getInitiator = this.getInitiator.bind(this);
    const addEntry = this.addEntry.bind(this);
    const updateEntry = this.updateEntry.bind(this);
    const calculateSize = this.calculateSize.bind(this);
    const serializeRequestBodySync = this.serializeRequestBodySync.bind(this);
    const originalXHROpen = this.originalXHROpen;
    const originalXHRSend = this.originalXHRSend;

    XMLHttpRequest.prototype.open = function(method: string, url: string | URL, async?: boolean, user?: string | null, password?: string | null) {
      const id = generateId();
      const urlString = typeof url === 'string' ? url : url.toString();

      const entry: NetworkEntry = {
        id,
        method: method.toUpperCase() as NetworkMethod,
        url: urlString,
        status: 'pending',
        startTime: performance.now(),
        requestHeaders: {},
        responseHeaders: {},
        type: 'xhr',
        initiator: getInitiator()
      };

      // 存储到XHR实例上
      (this as any).__networkEntry = entry;
      addEntry(entry);

      // 监听状态变化
      this.addEventListener('readystatechange', function() {
        const entry = (this as any).__networkEntry as NetworkEntry;
        if (!entry) return;

        if (this.readyState === XMLHttpRequest.DONE) {
          const endTime = performance.now();
          let responseData: any;

          try {
            const contentType = this.getResponseHeader('content-type') || '';
            if (contentType.includes('application/json')) {
              responseData = JSON.parse(this.responseText);
            } else {
              responseData = this.responseText;
            }
          } catch (e) {
            responseData = this.responseText || '[Failed to parse response]';
          }

          // 提取响应头
          const responseHeaders: Record<string, string> = {};
          const headerString = this.getAllResponseHeaders();
          if (headerString) {
            headerString.split('\r\n').forEach(line => {
              const [key, value] = line.split(': ');
              if (key && value) {
                responseHeaders[key.toLowerCase()] = value;
              }
            });
          }

          updateEntry(entry.id, {
            status: this.status >= 200 && this.status < 300 ? 'success' : 'error',
            statusCode: this.status,
            statusText: this.statusText,
            endTime,
            duration: endTime - entry.startTime,
            responseHeaders,
            responseData,
            responseSize: calculateSize(responseData)
          });
        }
      });

      // 监听错误
      this.addEventListener('error', function() {
        const entry = (this as any).__networkEntry as NetworkEntry;
        if (!entry) return;

        const endTime = performance.now();
        updateEntry(entry.id, {
          status: 'error',
          endTime,
          duration: endTime - entry.startTime,
          error: {
            message: 'Network Error'
          }
        });
      });

      // 监听中止
      this.addEventListener('abort', function() {
        const entry = (this as any).__networkEntry as NetworkEntry;
        if (!entry) return;

        const endTime = performance.now();
        updateEntry(entry.id, {
          status: 'cancelled',
          endTime,
          duration: endTime - entry.startTime
        });
      });

      return originalXHROpen.call(this, method, url, async ?? true, user, password);
    };

    XMLHttpRequest.prototype.send = function(body?: any) {
      const entry = (this as any).__networkEntry as NetworkEntry;
      if (entry && body) {
        // 同步处理请求体
        try {
          entry.requestPayload = serializeRequestBodySync(body);
          entry.requestSize = calculateSize(body);
        } catch (error) {
          entry.requestPayload = '[Failed to serialize request body]';
        }
      }

      return originalXHRSend.call(this, body);
    };

    // 拦截 setRequestHeader
    const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
    XMLHttpRequest.prototype.setRequestHeader = function(name: string, value: string) {
      const entry = (this as any).__networkEntry as NetworkEntry;
      if (entry) {
        entry.requestHeaders[name.toLowerCase()] = value;
      }
      return originalSetRequestHeader.call(this, name, value);
    };
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }

  private extractHeaders(headers: HeadersInit | Headers | undefined): Record<string, string> {
    const result: Record<string, string> = {};
    
    if (!headers) return result;
    
    if (headers instanceof Headers) {
      headers.forEach((value, key) => {
        result[key.toLowerCase()] = value;
      });
    } else if (Array.isArray(headers)) {
      headers.forEach(([key, value]) => {
        result[key.toLowerCase()] = value;
      });
    } else {
      Object.entries(headers).forEach(([key, value]) => {
        result[key.toLowerCase()] = value;
      });
    }
    
    return result;
  }



  private serializeRequestBodySync(body: any): any {
    if (!body) return undefined;
    
    if (typeof body === 'string') return body;
    if (body instanceof FormData) {
      const result: Record<string, any> = {};
      body.forEach((value, key) => {
        result[key] = value instanceof File ? `[File: ${value.name}]` : value;
      });
      return result;
    }
    if (body instanceof URLSearchParams) {
      const result: Record<string, string> = {};
      body.forEach((value, key) => {
        result[key] = value;
      });
      return result;
    }
    if (body instanceof ArrayBuffer || body instanceof Uint8Array) {
      return `[Binary Data: ${body.byteLength} bytes]`;
    }
    
    try {
      return JSON.parse(JSON.stringify(body));
    } catch {
      return String(body);
    }
  }

  private calculateSize(data: any): number {
    if (!data) return 0;
    if (typeof data === 'string') return new Blob([data]).size;
    if (data instanceof ArrayBuffer) return data.byteLength;
    if (data instanceof Uint8Array) return data.length;
    try {
      return new Blob([JSON.stringify(data)]).size;
    } catch {
      return 0;
    }
  }

  private getInitiator(): NetworkEntry['initiator'] {
    const stack = new Error().stack;
    if (!stack) return undefined;

    try {
      const lines = (stack || '').split('\n');
      // 找到第一个不是这个服务内部的调用
      for (let i = 3; i < lines.length; i++) {
        const line = lines[i];
        if (line && !line.includes('EnhancedNetworkService')) {
          const match = line.match(/at\s+(.+):(\d+):(\d+)/);
          if (match) {
            return {
              stack: lines.slice(i).join('\n'),
              url: match[1],
              line: parseInt(match[2], 10),
              column: parseInt(match[3], 10)
            };
          }
        }
      }
    } catch (error) {
      console.error('[EnhancedNetworkService] 解析调用栈失败:', error);
    }

    return undefined;
  }

  private addEntry(entry: NetworkEntry): void {
    this.entries.push(entry);
    
    // 限制条目数量
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }
    
    this.notifyListeners();
  }

  private updateEntry(id: string, updates: Partial<NetworkEntry>): void {
    const index = this.entries.findIndex(entry => entry.id === id);
    if (index !== -1) {
      this.entries[index] = { ...this.entries[index], ...updates };
      this.notifyListeners();
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener([...this.entries]);
      } catch (error) {
        console.error('Error in network listener:', error);
      }
    });
  }

  public getEntries(): NetworkEntry[] {
    return [...this.entries];
  }

  public getFilteredEntries(filter: NetworkFilter): NetworkEntry[] {
    return this.entries.filter(entry => {
      // 方法过滤
      if (!filter.methods.has(entry.method)) {
        return false;
      }
      
      // 状态过滤
      if (!filter.statuses.has(entry.status)) {
        return false;
      }
      
      // 只显示错误
      if (filter.onlyErrors && entry.status !== 'error') {
        return false;
      }
      
      // 隐藏 data URLs
      if (filter.hideDataUrls && entry.url.startsWith('data:')) {
        return false;
      }
      
      // 文本搜索
      if (filter.searchText) {
        const searchLower = filter.searchText.toLowerCase();
        if (!entry.url.toLowerCase().includes(searchLower) &&
            !entry.method.toLowerCase().includes(searchLower) &&
            !(entry.statusCode?.toString().includes(searchLower))) {
          return false;
        }
      }
      
      return true;
    });
  }

  public addListener(listener: (entries: NetworkEntry[]) => void): () => void {
    this.listeners.push(listener);
    
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  public clear(): void {
    this.entries = [];
    this.notifyListeners();
  }

  public getEntryById(id: string): NetworkEntry | undefined {
    return this.entries.find(entry => entry.id === id);
  }

  public formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  public formatDuration(ms: number): string {
    if (ms < 1000) {
      return Math.round(ms) + 'ms';
    }
    return (ms / 1000).toFixed(2) + 's';
  }

  public getStatusColor(status: NetworkStatus): string {
    switch (status) {
      case 'pending':
        return '#ffa726'; // orange
      case 'success':
        return '#66bb6a'; // green
      case 'error':
        return '#f44336'; // red
      case 'cancelled':
        return '#9e9e9e'; // grey
      default:
        return '#9e9e9e';
    }
  }

  public getMethodColor(method: NetworkMethod): string {
    switch (method) {
      case 'GET':
        return '#2196f3'; // blue
      case 'POST':
        return '#4caf50'; // green
      case 'PUT':
        return '#ff9800'; // orange
      case 'DELETE':
        return '#f44336'; // red
      case 'PATCH':
        return '#9c27b0'; // purple
      default:
        return '#607d8b'; // blue grey
    }
  }
}

export default EnhancedNetworkService;