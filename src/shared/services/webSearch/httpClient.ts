import { Capacitor } from '@capacitor/core';
import { CorsBypass } from 'capacitor-cors-bypass-enhanced';
import { buildCorsProxyRequestUrl } from '../../utils/universalFetch';

export interface SearchHttpRequest {
  url: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  /** 请求体（对象会被 JSON 序列化） */
  body?: any;
  timeout?: number;
  /** 响应解析方式，默认 json；text 用于 SSE/纯文本响应 */
  responseType?: 'json' | 'text';
}

export interface SearchHttpResponse {
  status: number;
  data: any;
}

/**
 * 统一 HTTP 层：移动端走 CorsBypass 原生请求，Web/桌面端走 CORS 代理 fetch。
 * 所有搜索提供商/协议适配器共用，避免双端实现复制粘贴。
 */
export async function searchHttpRequest(request: SearchHttpRequest): Promise<SearchHttpResponse> {
  const { url, method = 'GET', headers = {}, body, timeout = 30000, responseType = 'json' } = request;

  if (Capacitor.isNativePlatform()) {
    const response = await CorsBypass.request({
      url,
      method,
      headers,
      data: body,
      timeout,
      responseType
    });

    if (response.status >= 400) {
      throw new Error(`HTTP ${response.status}: 请求失败 (${url})`);
    }
    return { status: response.status, data: response.data };
  }

  const fetchHeaders: Record<string, string> = { ...headers };
  let fetchBody: string | undefined;
  if (body !== undefined && method !== 'GET') {
    fetchBody = typeof body === 'string' ? body : JSON.stringify(body);
    if (!fetchHeaders['Content-Type']) {
      fetchHeaders['Content-Type'] = 'application/json';
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(buildCorsProxyRequestUrl(url), {
      method,
      headers: fetchHeaders,
      body: fetchBody,
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: 请求失败 (${url})`);
    }
    const data = responseType === 'text' ? await response.text() : await response.json();
    return { status: response.status, data };
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw new Error(`请求超时 (${timeout}ms): ${url}`, { cause: error });
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
