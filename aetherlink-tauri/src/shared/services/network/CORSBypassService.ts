/**
 * CORS 绕过服务
 * 使用 capacitor-cors-bypass-enhanced 插件在移动端绕过 CORS 限制
 */

import { Capacitor } from '@capacitor/core';
import { CorsBypass } from 'capacitor-cors-bypass-enhanced';
import LoggerService from '../LoggerService';

// 请求配置接口
export interface CORSBypassRequestOptions {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  data?: any;
  timeout?: number;
  // 注意：虽然接口声明支持多种类型，但当前CorsBypass插件实际只支持 'json' 和 'text'
  // 'blob' 和 'arraybuffer' 类型会自动回退到 'text'
  responseType?: 'json' | 'text' | 'blob' | 'arraybuffer';
}

// 响应接口
export interface CORSBypassResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  url: string;
  success: boolean;
  duration?: number;
}



/**
 * CORS 绕过服务类
 */
export class CORSBypassService {
  private static instance: CORSBypassService;

  private constructor() {}

  public static getInstance(): CORSBypassService {
    if (!CORSBypassService.instance) {
      CORSBypassService.instance = new CORSBypassService();
    }
    return CORSBypassService.instance;
  }

  /**
   * 检查是否在移动端并且插件可用
   */
  public isAvailable(): boolean {
    if (!Capacitor.isNativePlatform()) {
      return false;
    }
    
    // 更严格的插件可用性检测
    try {
      return Capacitor.isPluginAvailable('CorsBypass') && 
             typeof CorsBypass?.request === 'function';
    } catch {
      return false;
    }
  }

  /**
   * 执行 HTTP 请求
   */
  public async request<T = any>(options: CORSBypassRequestOptions): Promise<CORSBypassResponse<T>> {
    const startTime = Date.now();
    const {
      url,
      method = 'GET',
      headers = {},
      data,
      timeout = 30000,
      responseType = 'json'
    } = options;

    LoggerService.log('DEBUG', `[CORS Bypass] 开始请求: ${method} ${url}`, {
      method,
      url,
      headers,
      timeout
    });

    if (!this.isAvailable()) {
      throw new Error('CORS Bypass 服务不可用，请检查插件安装');
    }

    try {
      // 序列化数据并检查是否为Base64编码
      const { serializedData, isBase64 } = this.serializeDataWithMetadata(data);
      
      // 构建请求配置
      const requestConfig = {
        url,
        method: method as any,
        headers: this.prepareHeaders(headers, isBase64),
        data: serializedData,
        timeout,
        responseType: this.validateResponseType(responseType)
      };

      // 执行请求
      const response = await CorsBypass.request(requestConfig);
      const duration = Date.now() - startTime;

      LoggerService.log('INFO', `[CORS Bypass] 请求成功: ${method} ${url} (${duration}ms)`, {
        status: response.status,
        duration
      });

      return {
        data: response.data,
        status: response.status,
        statusText: response.statusText || 'OK',
        headers: response.headers || {},
        url: response.url || url,
        success: true,
        duration
      };

    } catch (error: any) {
      const duration = Date.now() - startTime;

      LoggerService.log('ERROR', `[CORS Bypass] 请求失败: ${method} ${url} (${duration}ms)`, {
        error: error.message,
        duration
      });

      // 统一错误格式
      throw this.createError(error, url, duration);
    }
  }

  /**
   * GET 请求
   */
  public async get<T = any>(url: string, options: Omit<CORSBypassRequestOptions, 'url' | 'method'> = {}): Promise<CORSBypassResponse<T>> {
    return this.request<T>({ ...options, url, method: 'GET' });
  }

  /**
   * POST 请求
   */
  public async post<T = any>(url: string, data?: any, options: Omit<CORSBypassRequestOptions, 'url' | 'method' | 'data'> = {}): Promise<CORSBypassResponse<T>> {
    return this.request<T>({ ...options, url, method: 'POST', data });
  }

  /**
   * PUT 请求
   */
  public async put<T = any>(url: string, data?: any, options: Omit<CORSBypassRequestOptions, 'url' | 'method' | 'data'> = {}): Promise<CORSBypassResponse<T>> {
    return this.request<T>({ ...options, url, method: 'PUT', data });
  }

  /**
   * DELETE 请求
   */
  public async delete<T = any>(url: string, options: Omit<CORSBypassRequestOptions, 'url' | 'method'> = {}): Promise<CORSBypassResponse<T>> {
    return this.request<T>({ ...options, url, method: 'DELETE' });
  }



  /**
   * 序列化数据，保护非JSON数据不被破坏，并返回元数据
   */
  private serializeDataWithMetadata(data: any): { serializedData: string | undefined; isBase64: boolean } {
    if (data === null || data === undefined) {
      return { serializedData: undefined, isBase64: false };
    }

    // 如果已经是字符串，直接返回
    if (typeof data === 'string') {
      return { serializedData: data, isBase64: false };
    }

    // 处理二进制数据 - 使用Base64编码防止数据损坏
    if (data instanceof ArrayBuffer) {
      console.warn('[CORS Bypass] ArrayBuffer detected, using Base64 encoding');
      const uint8Array = new Uint8Array(data);
      const base64 = btoa(String.fromCharCode(...uint8Array));
      return { serializedData: base64, isBase64: true };
    }

    if (data instanceof Uint8Array) {
      console.warn('[CORS Bypass] Uint8Array detected, using Base64 encoding');
      const base64 = btoa(String.fromCharCode(...data));
      return { serializedData: base64, isBase64: true };
    }

    // 如果是FormData，不能直接序列化，抛出错误提示
    if (data instanceof FormData) {
      throw new Error('FormData is not supported by CORS bypass plugin. Please convert to JSON object.');
    }

    // 如果是Blob，不能直接序列化，抛出错误提示  
    if (data instanceof Blob) {
      throw new Error('Blob is not supported by CORS bypass plugin. Please convert to appropriate format.');
    }

    // 对于普通对象，使用JSON序列化
    try {
      return { serializedData: JSON.stringify(data), isBase64: false };
    } catch (error) {
      throw new Error(`Failed to serialize data: ${error}`);
    }
  }

  /**
   * 准备请求头，根据数据类型添加适当的编码信息
   */
  private prepareHeaders(headers: Record<string, string>, isBase64: boolean = false): Record<string, string> {
    const defaultHeaders: Record<string, string> = {
      'Accept': 'application/json, text/plain, */*',
      'Content-Type': 'application/json',
      'User-Agent': 'AetherLink-Mobile/1.0'
    };

    const finalHeaders: Record<string, string> = {
      ...defaultHeaders,
      ...headers
    };

    // 如果数据是Base64编码的，添加相应的头部信息
    if (isBase64) {
      finalHeaders['Content-Encoding'] = 'base64';
      finalHeaders['X-Data-Encoding'] = 'base64';
    }

    return finalHeaders;
  }

  /**
   * 创建统一的错误对象
   */
  private createError(originalError: any, url: string, duration: number): Error {
    const error = new Error();
    error.name = 'CORSBypassError';

    // 根据错误类型提供友好的错误信息
    if (originalError.message?.includes('timeout')) {
      error.message = `请求超时: ${url}`;
    } else if (originalError.message?.includes('network')) {
      error.message = `网络连接失败: ${url}`;
    } else if (originalError.message?.includes('404')) {
      error.message = `资源未找到: ${url}`;
    } else if (originalError.message?.includes('401')) {
      error.message = `身份验证失败: ${url}`;
    } else if (originalError.message?.includes('403')) {
      error.message = `访问被拒绝: ${url}`;
    } else {
      error.message = originalError.message || `请求失败: ${url}`;
    }

    // 添加额外信息
    (error as any).originalError = originalError;
    (error as any).url = url;
    (error as any).duration = duration;

    return error;
  }

  /**
   * 验证并返回有效的响应类型（根据插件实际支持的类型）
   */
  private validateResponseType(responseType: 'json' | 'text' | 'blob' | 'arraybuffer'): 'json' | 'text' {
    // CorsBypass 插件目前实际只支持 json 和 text
    // 如果请求了不支持的类型，记录警告并回退到合适的类型
    if (responseType === 'blob' || responseType === 'arraybuffer') {
      LoggerService.log('WARN', `[CORS Bypass] 响应类型 '${responseType}' 暂不支持，回退到 'text'`);
      return 'text';
    }
    
    return responseType === 'json' ? 'json' : 'text';
  }

}

// 导出单例实例
export const corsService = CORSBypassService.getInstance(); 