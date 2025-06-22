/**
 * 请求拦截服务
 * 用于捕获和记录所有网络请求，并在开发者工具中显示
 */

import axios from 'axios';
import LoggerService from '../LoggerService';

// 请求记录类型
export interface RequestRecord {
  id: string;
  method: string;
  url: string;
  requestData?: any;
  requestHeaders?: Record<string, string>;
  status?: number;
  responseData?: any;
  responseHeaders?: Record<string, string>;
  startTime: number;
  endTime?: number;
  duration?: number;
  error?: any;
}

// 单例存储所有请求记录
class RequestStore {
  private static instance: RequestStore;
  private requests: Map<string, RequestRecord> = new Map();
  private maxRecords: number = 100;

  private constructor() {}

  public static getInstance(): RequestStore {
    if (!RequestStore.instance) {
      RequestStore.instance = new RequestStore();
    }
    return RequestStore.instance;
  }

  public addRequest(record: RequestRecord): void {
    this.requests.set(record.id, record);

    // 限制记录数量，防止内存泄漏
    if (this.requests.size > this.maxRecords) {
      const oldestKey = this.requests.keys().next().value;
      if (oldestKey !== undefined) {
        this.requests.delete(oldestKey);
      }
    }
  }

  public updateRequest(id: string, updates: Partial<RequestRecord>): void {
    const record = this.requests.get(id);
    if (record) {
      this.requests.set(id, { ...record, ...updates });
    }
  }

  public getRequest(id: string): RequestRecord | undefined {
    return this.requests.get(id);
  }

  public getAllRequests(): RequestRecord[] {
    return Array.from(this.requests.values());
  }

  public clearAll(): void {
    this.requests.clear();
  }
}

// 创建请求拦截器
const setupRequestInterceptors = (): void => {
  // 拦截Axios请求
  axios.interceptors.request.use(
    (config) => {
      const requestId = Date.now().toString() + Math.random().toString(36).substring(2, 9);

      // 记录请求信息
      const requestRecord: RequestRecord = {
        id: requestId,
        method: config.method?.toUpperCase() || 'GET',
        url: config.url || 'unknown',
        requestData: config.data,
        requestHeaders: config.headers as Record<string, string>,
        startTime: Date.now()
      };

      RequestStore.getInstance().addRequest(requestRecord);

      // 将请求ID附加到配置中，以便在响应拦截器中识别
      (config as any).requestId = requestId;

      LoggerService.log('DEBUG', `[网络] ${requestRecord.method} 请求开始: ${requestRecord.url}`, {
        method: requestRecord.method,
        url: requestRecord.url,
        headers: requestRecord.requestHeaders,
        data: requestRecord.requestData
      });

      return config;
    },
    (error) => {
      LoggerService.log('ERROR', `[网络] 请求错误: ${error.message}`, error);
      return Promise.reject(error);
    }
  );

  // 拦截Axios响应
  axios.interceptors.response.use(
    (response) => {
      const requestId = (response.config as any).requestId;

      if (requestId) {
        const endTime = Date.now();
        const requestRecord = RequestStore.getInstance().getRequest(requestId);

        if (requestRecord) {
          const duration = endTime - requestRecord.startTime;

          RequestStore.getInstance().updateRequest(requestId, {
            status: response.status,
            responseData: response.data,
            responseHeaders: response.headers as Record<string, string>,
            endTime,
            duration
          });

          LoggerService.log('INFO', `[网络] ${requestRecord.method} 请求完成: ${requestRecord.url} (${duration}ms)`, {
            status: response.status,
            headers: response.headers,
            data: response.data,
            duration
          });
        }
      }

      return response;
    },
    (error) => {
      const requestId = error.config ? (error.config as any).requestId : null;

      if (requestId) {
        const endTime = Date.now();
        const requestRecord = RequestStore.getInstance().getRequest(requestId);

        if (requestRecord) {
          const duration = endTime - requestRecord.startTime;
          const status = error.response ? error.response.status : 0;

          RequestStore.getInstance().updateRequest(requestId, {
            status,
            responseData: error.response ? error.response.data : null,
            responseHeaders: error.response ? (error.response.headers as Record<string, string>) : {},
            endTime,
            duration,
            error: {
              message: error.message,
              code: error.code,
              stack: error.stack
            }
          });

          LoggerService.log('ERROR', `[网络] ${requestRecord.method} 请求失败: ${requestRecord.url} (${duration}ms)`, {
            status,
            error: error.message,
            response: error.response?.data,
            duration
          });
        }
      }

      return Promise.reject(error);
    }
  );

  // 重写Fetch API
  const originalFetch = window.fetch;
  window.fetch = async function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const requestId = Date.now().toString() + Math.random().toString(36).substring(2, 10);
    const url = typeof input === 'string' ? input :
               input instanceof URL ? input.toString() :
               (input as Request).url;
    const method = init?.method ||
                  (input instanceof Request ? input.method : 'GET');

    const requestRecord: RequestRecord = {
      id: requestId,
      method: method?.toUpperCase() || 'GET',
      url,
      requestData: init?.body,
      requestHeaders: init?.headers ? Object.fromEntries(new Headers(init.headers)) : {},
      startTime: Date.now()
    };

    RequestStore.getInstance().addRequest(requestRecord);

    LoggerService.log('DEBUG', `[网络] ${requestRecord.method} Fetch请求开始: ${requestRecord.url}`, {
      method: requestRecord.method,
      url: requestRecord.url,
      headers: requestRecord.requestHeaders,
      data: typeof requestRecord.requestData === 'string' ? requestRecord.requestData : '[Binary Data]'
    });

    try {
      const response = await originalFetch(input, init);
      const endTime = Date.now();
      const duration = endTime - requestRecord.startTime;

      // 克隆响应以读取内容
      const clonedResponse = response.clone();
      let responseData;

      try {
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          responseData = await clonedResponse.json();
        } else if (contentType.includes('text/')) {
          responseData = await clonedResponse.text();
        } else {
          responseData = '[Binary Data]';
        }
      } catch (e) {
        responseData = '[无法解析响应数据]';
      }

      RequestStore.getInstance().updateRequest(requestId, {
        status: response.status,
        responseData,
        responseHeaders: Object.fromEntries(response.headers),
        endTime,
        duration
      });

      LoggerService.log('INFO', `[网络] ${requestRecord.method} Fetch请求完成: ${requestRecord.url} (${duration}ms)`, {
        status: response.status,
        headers: Object.fromEntries(response.headers),
        data: responseData,
        duration
      });

      return response;
    } catch (error: any) {
      const endTime = Date.now();
      const duration = endTime - requestRecord.startTime;

      RequestStore.getInstance().updateRequest(requestId, {
        endTime,
        duration,
        error: {
          message: error.message,
          stack: error.stack
        }
      });

      LoggerService.log('ERROR', `[网络] ${requestRecord.method} Fetch请求失败: ${requestRecord.url} (${duration}ms)`, {
        error: error.message,
        duration
      });

      throw error;
    }
  };
};

// 获取所有请求记录
const getAllRequests = (): RequestRecord[] => {
  return RequestStore.getInstance().getAllRequests();
};

// 清除所有请求记录
const clearAllRequests = (): void => {
  RequestStore.getInstance().clearAll();
  LoggerService.log('INFO', '[网络] 已清除所有请求记录');
};

// 导出 RequestStore 类
export { RequestStore };

export default {
  setupRequestInterceptors,
  getAllRequests,
  clearAllRequests
};