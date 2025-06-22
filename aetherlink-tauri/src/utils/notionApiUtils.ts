/**
 * Notion API 工具函数
 * 统一处理API调用和错误处理
 */
import { toastManager } from '../components/EnhancedToast';
import { Toast } from '@capacitor/toast';
import { Capacitor } from '@capacitor/core';
import { CorsBypass } from 'capacitor-cors-bypass-enhanced';

// Notion API 配置
export const getNotionApiUrl = (endpoint: string): string => {
  // 移动端直接使用原始API URL，通过 CorsBypass 插件处理 CORS
  if (Capacitor.isNativePlatform()) {
    return `https://api.notion.com${endpoint}`;
  }
  
  // Web 端使用代理
  const isDevelopment = process.env.NODE_ENV === 'development' || 
                       window.location.hostname === 'localhost' ||
                       window.location.hostname === '127.0.0.1';
  
  const baseUrl = isDevelopment ? '/api/notion' : 'https://api.notion.com';
  return `${baseUrl}${endpoint}`;
};

/**
 * 智能序列化数据，确保不破坏不同类型的数据
 */
const serializeRequestData = (data: any): string | undefined => {
  if (data === null || data === undefined) {
    return undefined;
  }

  // 如果已经是字符串，直接返回
  if (typeof data === 'string') {
    return data;
  }

  // 对于普通对象，使用JSON序列化
  if (typeof data === 'object' && data.constructor === Object) {
    try {
      return JSON.stringify(data);
    } catch (error) {
      console.warn('[Notion API] JSON序列化失败:', error);
      throw new Error(`Failed to serialize request data: ${error}`);
    }
  }

  // 对于数组，也使用JSON序列化  
  if (Array.isArray(data)) {
    try {
      return JSON.stringify(data);
    } catch (error) {
      console.warn('[Notion API] JSON序列化失败:', error);
      throw new Error(`Failed to serialize request data: ${error}`);
    }
  }

  // 其他类型尝试转换为字符串
  try {
    return String(data);
  } catch (error) {
    console.warn('[Notion API] 数据序列化失败:', error);
    throw new Error(`Unable to serialize request data`);
  }
};

// 通用的Notion API请求函数
export const notionApiRequest = async (
  endpoint: string,
  options: {
    method: 'GET' | 'POST';
    apiKey: string;
    body?: any;
  }
): Promise<any> => {
  const url = getNotionApiUrl(endpoint);
  
  const headers = {
    'Authorization': `Bearer ${options.apiKey}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json'
  };

  // 移动端使用 CorsBypass 插件
  if (Capacitor.isNativePlatform()) {
    console.log('[Notion API] 移动端使用 CorsBypass 插件:', url);
    
    try {
      const response = await CorsBypass.request({
        url,
        method: options.method,
        headers,
        data: serializeRequestData(options.body),
        timeout: 30000,
        responseType: 'json'
      });

      if (response.status < 200 || response.status >= 300) {
        const errorData = typeof response.data === 'object' ? response.data : {};
        throw new NotionApiError(
          errorData.message || `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          errorData.code
        );
      }

      return response.data;
    } catch (error: any) {
      console.error('[Notion API] CorsBypass 请求失败:', error);
      
      // 如果是网络错误，转换为合适的 NotionApiError
      if (error?.message?.includes('timeout') || error?.message?.includes('network')) {
        throw new NotionApiError('网络连接超时，请检查网络设置', 0, 'NETWORK_ERROR');
      }
      
      throw error;
    }
  }

  // Web 端使用标准 fetch
  const response = await fetch(url, {
    method: options.method,
    headers,
    body: serializeRequestData(options.body)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new NotionApiError(
      errorData.message || `HTTP ${response.status}: ${response.statusText}`,
      response.status,
      errorData.code
    );
  }

  return response.json();
};

// 自定义错误类
export class NotionApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message);
    this.name = 'NotionApiError';
  }

  // 获取用户友好的错误信息
  getUserFriendlyMessage(): string {
    switch (this.status) {
      case 0:
        return '网络连接失败，请检查网络设置';
      case 401:
        return 'API密钥无效，请检查配置';
      case 404:
        return '数据库不存在，请检查数据库ID';
      case 403:
        return '权限不足，请确保集成已连接到数据库';
      case 429:
        return '请求过于频繁，请稍后重试';
      case 500:
        return 'Notion服务器错误，请稍后重试';
      default:
        return this.message || '未知错误';
    }
  }
}

// 显示成功消息的工具函数
export const showSuccessMessage = async (message: string, _url?: string) => {
  if (Capacitor.isNativePlatform()) {
    await Toast.show({
      text: message,
      duration: 'long',
      position: 'bottom'
    });
  } else {
    // Web端使用toastManager
    if (toastManager) {
      toastManager.success(message);
    }
  }
};

// 显示错误消息的工具函数
export const showErrorMessage = async (error: Error) => {
  const message = error instanceof NotionApiError 
    ? error.getUserFriendlyMessage() 
    : error.message;

  if (Capacitor.isNativePlatform()) {
    await Toast.show({
      text: `导出失败: ${message}`,
      duration: 'long',
      position: 'bottom'
    });
  } else {
    // Web端使用toastManager
    if (toastManager) {
      toastManager.error(`导出失败: ${message}`);
    }
  }
};
