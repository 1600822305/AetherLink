/**
 * 通用获取工具
 * 根据平台自动选择最适合的HTTP请求方式
 * - Web端：使用代理避免CORS问题
 * - 移动端：使用CorsBypass插件直接请求
 * - Tauri桌面端：使用Tauri HTTP插件绕过CORS
 */

import { Capacitor } from '@capacitor/core';
import { CorsBypass } from 'capacitor-cors-bypass-enhanced';
import { isTauri } from './platformDetection';
import { getStorageItem } from './storage';
import { createLogger } from '../services/infra/logger';
const logger = createLogger('UniversalFetch');

// ==================== CORS 代理 URL 配置 ====================

const DEFAULT_CORS_PROXY_URL = 'http://localhost:8888';
let _corsProxyBaseUrl = DEFAULT_CORS_PROXY_URL;

/**
 * 获取当前 CORS 代理基础 URL
 */
export function getCorsProxyUrl(): string {
  return _corsProxyBaseUrl;
}

/**
 * 设置 CORS 代理基础 URL
 * @param url 代理服务器地址，如 http://localhost:8888
 */
export function setCorsProxyUrl(url: string): void {
  _corsProxyBaseUrl = url.replace(/\/$/, ''); // 去除末尾斜杠
  logger.debug(`代理 URL 已更新: ${_corsProxyBaseUrl}`);
}

/**
 * 构建完整的 CORS 代理请求 URL
 */
export function buildCorsProxyRequestUrl(targetUrl: string): string {
  return `${_corsProxyBaseUrl}/proxy?url=${encodeURIComponent(targetUrl)}`;
}

// 代理配置接口（与 networkProxySlice 保持一致）
interface ProxyConfig {
  enabled: boolean;
  type: 'http' | 'https' | 'socks4' | 'socks5';
  host: string;
  port: number;
  username?: string;
  password?: string;
  bypass?: string[];
}

interface NetworkProxySettings {
  globalProxy: ProxyConfig;
}

/**
 * 获取当前代理配置
 */
async function getTauriProxyConfig(): Promise<{ url: string; basicAuth?: { username: string; password: string } } | undefined> {
  try {
    const settings = await getStorageItem<NetworkProxySettings>('network-proxy-settings');
    if (!settings?.globalProxy?.enabled) {
      return undefined;
    }

    const { type, host, port, username, password } = settings.globalProxy;
    
    // 构建代理 URL
    // Tauri HTTP 插件基于 reqwest，完全支持 http/https/socks4/socks5 代理
    let proxyUrl: string;
    
    // 根据代理类型构建正确的协议前缀
    // socks5h / socks4a: DNS 解析在代理服务器端进行，避免本地 DNS 污染或解析不一致导致连接失败
    if (type === 'socks5') {
      proxyUrl = `socks5h://${host}:${port}`;
    } else if (type === 'socks4') {
      proxyUrl = `socks4a://${host}:${port}`;
    } else if (type === 'https') {
      // HTTPS 代理使用 https:// 协议
      proxyUrl = `https://${host}:${port}`;
    } else {
      // HTTP 代理使用 http:// 协议
      proxyUrl = `http://${host}:${port}`;
    }

    const result: { url: string; basicAuth?: { username: string; password: string } } = { url: proxyUrl };
    
    // 添加认证信息（如果有）
    if (username && password) {
      result.basicAuth = { username, password };
    }

    logger.debug('Tauri 代理配置:', { url: proxyUrl, hasAuth: !!(username && password) });
    return result;
  } catch (error) {
    logger.error('获取 Tauri 代理配置失败:', error);
    return undefined;
  }
}

// 请求选项接口
export interface UniversalFetchOptions extends RequestInit {
  timeout?: number;
  responseType?: 'json' | 'text' | 'blob' | 'arraybuffer';
  useCorsPlugin?: boolean; // 是否使用 CORS 插件（仅移动端有效）
}

// 响应接口，兼容标准Response
export interface UniversalResponse extends Response {
  data?: any;
}

/**
 * 通用fetch函数
 * @param url 请求URL
 * @param options 请求选项
 * @returns Promise<Response>
 */
export async function universalFetch(url: string, options: UniversalFetchOptions = {}): Promise<UniversalResponse> {
  // 移动端默认启用 CORS 插件（因为标准 fetch 也有 CORS 限制）
  const defaultUseCorsPlugin = Capacitor.isNativePlatform();
  const { timeout = 30000, responseType = 'json', useCorsPlugin = defaultUseCorsPlugin, ...fetchOptions } = options;

  // Tauri 桌面端使用 Tauri HTTP 插件绕过CORS
  if (isTauri()) {
    logger.debug('Tauri 桌面端使用 HTTP 插件:', url);
    try {
      return await tauriFetch(url, { ...fetchOptions, timeout });
    } catch (error) {
      logger.error('Tauri HTTP 请求失败:', error);
      throw error;
    }
  }

  // 移动端：根据配置决定是否使用 CorsBypass 插件
  // 插件现已支持流式响应！
  if (Capacitor.isNativePlatform()) {
    // 检查是否是 MCP 请求
    const isMcpRequest = url.includes('/mcp') || 
                        (fetchOptions.body && typeof fetchOptions.body === 'string' &&
                         fetchOptions.body.includes('"jsonrpc"'));
    
    // MCP 请求：直接连接（插件 v1.1.2+ 已彻底修复 OkHttp charset 问题）
    if (isMcpRequest) {
      logger.debug(`移动端 MCP 请求直连: ${url}`);
      
      // 提取并修复 headers
      const headers = extractHeaders(fetchOptions.headers);
      headers['user-agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
      
      // 使用 CorsBypass 直接访问 MCP 服务器（v1.1.2+ 已完全移除 charset）
      const requestOptions = {
        url,
        method: (fetchOptions.method || 'GET') as any,
        headers,
        data: serializeRequestBody(fetchOptions.body),
        timeout,
        responseType: 'text' as any
      };
      
      logger.debug('MCP 请求详情:', JSON.stringify(requestOptions, null, 2));
      
      const response = await CorsBypass.request(requestOptions);
      return createCompatibleResponse(response, url);
    }
    
    // 使用从 options 中提取的 useCorsPlugin 参数
    if (useCorsPlugin) {
      try {
        // 检查 body 中是否明确指定了 stream:true 或 stream:false
        const bodyStr = fetchOptions.body && typeof fetchOptions.body === 'string' ? fetchOptions.body : '';
        const isExplicitlyNonStream = bodyStr.includes('"stream":false') || bodyStr.includes('"stream": false');
        const isExplicitlyStream = bodyStr.includes('"stream":true') || bodyStr.includes('"stream": true');
        
        // 检测流式 API 请求
        // 1. OpenAI 兼容格式：/chat/completions + "stream":true
        // 2. Gemini SSE 格式：streamGenerateContent?alt=sse
        const isChatApiUrl = url.includes('/chat/completions') || url.includes('/v1/completions');
        const isGeminiSseUrl = url.includes('streamGenerateContent') && url.includes('alt=sse');
        const isChatStreamRequest = (isChatApiUrl && isExplicitlyStream && !isExplicitlyNonStream) || isGeminiSseUrl;
        const isMcpRequest = url.includes('/mcp') || bodyStr.includes('"jsonrpc"');
        
        if (isChatStreamRequest && !isMcpRequest) {
          // 使用流式 API
          return await corsPluginStreamFetch(url, fetchOptions, timeout);
        } else {
          // 使用普通请求
          // MCP 请求使用 text 响应类型，避免自动 JSON 解析
          const finalResponseType = isMcpRequest ? 'text' : validateResponseType(responseType);
          
          // 提取 headers
          let headers = extractHeaders(fetchOptions.headers);
          
          // MCP 请求：移除 origin 和 referer（模仿代理服务器行为）
          if (isMcpRequest) {
            const filteredHeaders: Record<string, string> = {};
            for (const [key, value] of Object.entries(headers)) {
              const lowerKey = key.toLowerCase();
              if (lowerKey !== 'origin' && lowerKey !== 'referer') {
                filteredHeaders[key] = value;
              }
            }
            headers = filteredHeaders;
            logger.debug('MCP 请求已移除 origin/referer headers');
          }
          
          const requestOptions = {
            url,
            method: (fetchOptions.method || 'GET') as any,
            headers,
            data: serializeRequestBody(fetchOptions.body),
            timeout,
            responseType: finalResponseType
          };
          
          if (isMcpRequest) {
            logger.debug('MCP 请求详情:', JSON.stringify(requestOptions, null, 2));
          }
          
          const response = await CorsBypass.request(requestOptions);

          // 创建兼容的Response对象
          const compatibleResponse = createCompatibleResponse(response, url);
          return compatibleResponse;
        }
      } catch (error) {
        logger.error('CorsBypass 请求失败，回退到标准 fetch:', error);
        // 如果 CorsBypass 失败，回退到标准 fetch
        return standardFetch(url, { ...fetchOptions, timeout });
      }
    } else {
      // 默认使用标准 fetch，保持流式输出功能
      logger.debug('移动端使用标准 fetch（保持流式输出）:', url);
      return standardFetch(url, { ...fetchOptions, timeout });
    }
  }

  // Web端使用标准fetch（可能通过代理）
  const finalUrl = getPlatformUrl(url);
  logger.debug('Web端请求:', url, '->', finalUrl);
  return standardFetch(finalUrl, { ...fetchOptions, timeout });
}

/**
 * 从各种格式的headers中提取普通对象
 */
function extractHeaders(headers?: HeadersInit): Record<string, string> {
  if (!headers) return {};

  if (headers instanceof Headers) {
    const result: Record<string, string> = {};
    headers.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  if (Array.isArray(headers)) {
    const result: Record<string, string> = {};
    headers.forEach(([key, value]) => {
      result[key] = value;
    });
    return result;
  }

  return headers as Record<string, string>;
}

/**
 * 创建兼容标准Response的对象
 */
function createCompatibleResponse(corsBypassResponse: any, _originalUrl: string): UniversalResponse {
  const { data, status, statusText, headers } = corsBypassResponse;

  // HTTP 规范：204, 205, 304 是 null-body status，不允许携带 body
  // StreamableHTTP MCP 协议中服务器会返回 204 No Content（如通知、session 初始化）
  const isNullBodyStatus = status === 204 || status === 205 || status === 304;

  // 创建一个兼容的Response对象
  const response = new Response(
    isNullBodyStatus ? null : (typeof data === 'string' ? data : JSON.stringify(data)),
    {
      status,
      statusText,
      headers: new Headers(headers)
    }
  );

  // 添加额外的数据属性
  (response as UniversalResponse).data = data;

  return response as UniversalResponse;
}

/**
 * Tauri fetch 函数，使用 Tauri HTTP 插件绕过 CORS
 * 支持网络代理配置
 */
async function tauriFetch(url: string, options: RequestInit & { timeout?: number }): Promise<UniversalResponse> {
  try {
    // 动态导入 Tauri HTTP 插件
    const { fetch: tauriHttpFetch } = await import('@tauri-apps/plugin-http');
    
    // 检查是否是本地地址（localhost/127.0.0.1/局域网地址）
    const isLocalAddress = (targetUrl: string): boolean => {
      try {
        const urlObj = new URL(targetUrl);
        const hostname = urlObj.hostname;
        return hostname === 'localhost' || 
               hostname === '127.0.0.1' || 
               hostname.startsWith('192.168.') ||
               hostname.startsWith('10.') ||
               hostname.startsWith('172.16.') ||
               hostname.startsWith('172.17.') ||
               hostname.startsWith('172.18.') ||
               hostname.startsWith('172.19.') ||
               hostname.startsWith('172.20.') ||
               hostname.startsWith('172.21.') ||
               hostname.startsWith('172.22.') ||
               hostname.startsWith('172.23.') ||
               hostname.startsWith('172.24.') ||
               hostname.startsWith('172.25.') ||
               hostname.startsWith('172.26.') ||
               hostname.startsWith('172.27.') ||
               hostname.startsWith('172.28.') ||
               hostname.startsWith('172.29.') ||
               hostname.startsWith('172.30.') ||
               hostname.startsWith('172.31.');
      } catch {
        return false;
      }
    };
    
    // 获取代理配置（本地地址不使用代理）
    const shouldUseProxy = !isLocalAddress(url);
    const proxyConfig = shouldUseProxy ? await getTauriProxyConfig() : undefined;
    
    // 构建请求选项
    const headers = options.headers as Record<string, string> || {};
    // 某些本地 LLM 服务器需要 User-Agent
    if (!headers['User-Agent'] && !headers['user-agent']) {
      headers['User-Agent'] = 'AetherLink/1.0';
    }
    
    const fetchOptions: any = {
      method: options.method as any,
      headers: headers,
      body: options.body as any,
      connectTimeout: options.timeout || 30000,
    };
    
    // 处理代理配置
    if (!shouldUseProxy) {
      // 本地地址：不设置 proxy 字段，直接连接
      // 注意：不能设置空 URL，会导致 builder error
      logger.debug('Tauri HTTP 直连（本地地址）:', url);
    } else if (proxyConfig) {
      // 非本地地址 + 有代理配置：使用配置的代理
      fetchOptions.proxy = {
        all: proxyConfig,
      };
      logger.debug('Tauri HTTP 使用代理:', {
        url: proxyConfig.url,
        hasAuth: !!proxyConfig.basicAuth,
        targetUrl: url
      });
    } else {
      // 非本地地址 + 无代理配置：不设置 proxy，让 reqwest 使用系统代理
      logger.debug('Tauri HTTP 直连（无代理配置，可能使用系统代理）:', url);
    }
    
    // Tauri 的 fetch 函数与标准 fetch 兼容
    const response = await tauriHttpFetch(url, fetchOptions);
    
    logger.debug('Tauri HTTP 请求成功:', response.status, response.statusText);
    return response as UniversalResponse;
  } catch (error) {
    logger.error('Tauri HTTP 请求失败:', error);
    throw error;
  }
}

/**
 * 标准fetch函数，带超时控制
 */
async function standardFetch(url: string, options: RequestInit & { timeout?: number }): Promise<UniversalResponse> {
  const { timeout = 30000, ...fetchOptions } = options;

  const controller = new AbortController();
  fetchOptions.signal = controller.signal;

  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, fetchOptions);
    clearTimeout(timeoutId);
    return response as UniversalResponse;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * 检查是否需要使用代理
 */
export function needsCORSProxy(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const currentOrigin = window.location.origin;

    // 本地地址不需要代理
    const hostname = urlObj.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.')) {
      logger.debug(`本地地址，不需要代理: ${url}`);
      return false;
    }

    // Tauri 桌面端：使用 HTTP 插件，不需要代理
    if (isTauri()) {
      logger.debug(`Tauri 桌面端，不使用代理: ${url}`);
      return false;
    }

    // 移动端：直接请求，不使用代理（使用CorsBypass插件）
    if (Capacitor.isNativePlatform()) {
      logger.debug(`移动端，不使用代理: ${url}`);
      return false;
    }

    // Web端：跨域请求需要代理
    const needsProxy = urlObj.origin !== currentOrigin;
    logger.debug(`Web端CORS检查: ${url} -> 当前域: ${currentOrigin} -> 需要代理: ${needsProxy}`);
    return needsProxy;
  } catch {
    logger.debug(`URL解析失败，不使用代理: ${url}`);
    return false;
  }
}

/**
 * 获取适合当前平台的 URL
 */
export function getPlatformUrl(originalUrl: string): string {
  // 统一处理：根据是否跨域决定是否使用代理
  if (needsCORSProxy(originalUrl)) {
    // 使用通用 CORS 代理服务器
    return buildCorsProxyRequestUrl(originalUrl);
  } else {
    // 不需要代理：返回原始 URL
    return originalUrl;
  }
}

/**
 * 获取完整的代理URL（用于需要完整URL的场景，如SSE）
 */
export function getFullProxyUrl(originalUrl: string): string {
  // 统一处理：根据是否跨域决定是否使用代理
  if (needsCORSProxy(originalUrl)) {
    return buildCorsProxyRequestUrl(originalUrl);
  } else {
    // 不需要代理：返回原始 URL
    return originalUrl;
  }
}

/**
 * 日志记录函数
 */
export function logFetchUsage(originalUrl: string, finalUrl: string, method: string = 'GET') {
  logger.debug(`${method} ${originalUrl} -> ${finalUrl}`);
}

// ==================== 统一 fetch 层（供各 Provider client.ts 使用） ====================

/**
 * 创建 Web 端 CORS 代理 fetch
 * 将跨域请求通过可配置的 CORS 代理服务器转发
 */
export function createProxyFetch(): typeof fetch {
  return async (url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : (url as any).url;

    if (needsCORSProxy(urlStr)) {
      const proxyUrl = buildCorsProxyRequestUrl(urlStr);
      logger.debug(`使用代理: ${urlStr.substring(0, 50)}...`);

      try {
        return await fetch(proxyUrl, init);
      } catch (error) {
        logger.error(`代理请求失败:`, error);
        throw error;
      }
    }

    return fetch(urlStr, init);
  };
}

/**
 * 创建平台适配的 fetch 函数（核心统一函数）
 * 所有 Provider 的 client.ts 都应使用此函数，而非各自实现平台检测逻辑
 *
 * @param model 模型配置，需包含 useCorsPlugin 字段（可选）
 * @returns 平台适配的 fetch 函数，或 undefined（使用 SDK 默认 fetch）
 */
export function createPlatformFetch(model: { useCorsPlugin?: boolean }): typeof fetch | undefined {
  const isTauriEnv = isTauri();
  const isCapacitorNative = Capacitor.isNativePlatform && Capacitor.isNativePlatform();
  const isWeb = !isTauriEnv && !isCapacitorNative;

  if (isTauriEnv) {
    logger.debug(`Tauri 平台：使用 universalFetch`);
    return async (url: RequestInfo | URL, init?: RequestInit) => {
      return universalFetch(url.toString(), init);
    };
  }

  if (isCapacitorNative) {
    const fetchMode = model.useCorsPlugin ? 'CorsBypass Plugin' : 'Standard Fetch';
    logger.debug(`Capacitor Native 平台：使用 ${fetchMode}`);
    return async (url: RequestInfo | URL, init?: RequestInit) => {
      const fetchOptions = { ...init, useCorsPlugin: model.useCorsPlugin };
      return universalFetch(url.toString(), fetchOptions);
    };
  }

  if (isWeb) {
    logger.debug(`Web 端：使用 CORS 代理服务器`);
    return createProxyFetch();
  }

  return undefined;
}

/**
 * 包装 fetch 以过滤指定的请求头
 * 用于处理 providerExtraHeaders 中标记为 'REMOVE' 的头部
 *
 * @param baseFetch 原始 fetch 函数
 * @param headersToRemove 需要删除的头部名称列表（小写）
 * @param customFilter 可选的自定义过滤回调（如 anthropic 特有的模糊匹配逻辑）
 * @returns 包装后的 fetch 函数
 */
export function createHeaderFilterFetch(
  baseFetch: typeof fetch,
  headersToRemove: string[],
  customFilter?: (headers: Headers) => void
): typeof fetch {
  return async (url: RequestInfo | URL, init?: RequestInit) => {
    if (init?.headers && headersToRemove.length > 0) {
      const headers = new Headers(init.headers);

      headersToRemove.forEach(headerName => {
        headers.delete(headerName);
      });

      // 执行自定义过滤逻辑（如 stainless/anthropic 头部模糊匹配）
      if (customFilter) {
        customFilter(headers);
      }

      init.headers = headers;
    }
    return baseFetch(url.toString(), init);
  };
}

/**
 * 序列化请求体，确保兼容 CorsBypass 插件
 */
function serializeRequestBody(body?: BodyInit | null): string | undefined {
  if (!body) {
    return undefined;
  }

  // 如果已经是字符串，直接返回
  if (typeof body === 'string') {
    return body;
  }

  // 处理 FormData
  if (body instanceof FormData) {
    // FormData 需要转换为 JSON 对象或者回退到标准 fetch
    logger.warn('FormData detected, falling back to standard fetch for this request');
    throw new Error('FormData not supported by CorsBypass, will fallback to standard fetch');
  }

  // 处理 Blob
  if (body instanceof Blob) {
    logger.warn('Blob detected, falling back to standard fetch for this request');
    throw new Error('Blob not supported by CorsBypass, will fallback to standard fetch');
  }

  // 处理 ArrayBuffer - 使用Base64编码防止数据损坏
  if (body instanceof ArrayBuffer) {
    logger.warn('ArrayBuffer detected, using Base64 encoding');
    const uint8Array = new Uint8Array(body);
    return btoa(String.fromCharCode(...uint8Array));
  }

  // 处理 Uint8Array - 使用Base64编码防止数据损坏
  if (body instanceof Uint8Array) {
    logger.warn('Uint8Array detected, using Base64 encoding');
    return btoa(String.fromCharCode(...body));
  }

  // 处理 URLSearchParams
  if (body instanceof URLSearchParams) {
    return body.toString();
  }

  // 其他情况尝试转换为字符串
  try {
    return String(body);
  } catch (error) {
    logger.warn('Failed to serialize body:', error);
    throw new Error('Unable to serialize request body for CorsBypass');
  }
}

/**
 * 验证响应类型（根据CorsBypass插件实际支持的类型）
 */
function validateResponseType(responseType: string): 'json' | 'text' | 'arraybuffer' | 'blob' {
  // CorsBypass 插件 v2.1.2+ 支持 json, text, arraybuffer, blob
  const supportedTypes = ['json', 'text', 'arraybuffer', 'blob'];
  if (!supportedTypes.includes(responseType)) {
    logger.warn(`响应类型 '${responseType}' 暂不支持，回退到 'text'`);
    return 'text';
  }
  
  return responseType as 'json' | 'text' | 'arraybuffer' | 'blob';
}

/**
 * Tauri 专用代理测试函数
 * 直接使用 Tauri HTTP 插件测试代理连接
 */
export async function testTauriProxyConnection(
  proxyConfig: {
    enabled: boolean;
    type: 'http' | 'https' | 'socks4' | 'socks5';
    host: string;
    port: number;
    username?: string;
    password?: string;
  },
  testUrl: string = 'https://www.google.com'
): Promise<{
  success: boolean;
  responseTime?: number;
  error?: string;
  statusCode?: number;
  externalIp?: string;
}> {
  if (!isTauri()) {
    return { success: false, error: '此函数仅适用于 Tauri 桌面端' };
  }

  const startTime = Date.now();

  try {
    // 动态导入 Tauri HTTP 插件
    const { fetch: tauriHttpFetch } = await import('@tauri-apps/plugin-http');

    // 构建代理 URL
    let proxyUrl: string;
    if (proxyConfig.type === 'socks5') {
      proxyUrl = `socks5h://${proxyConfig.host}:${proxyConfig.port}`;
    } else if (proxyConfig.type === 'socks4') {
      proxyUrl = `socks4a://${proxyConfig.host}:${proxyConfig.port}`;
    } else if (proxyConfig.type === 'https') {
      proxyUrl = `https://${proxyConfig.host}:${proxyConfig.port}`;
    } else {
      proxyUrl = `http://${proxyConfig.host}:${proxyConfig.port}`;
    }

    logger.debug(`测试代理: ${proxyUrl} -> ${testUrl}`);

    // 构建请求选项
    const fetchOptions: any = {
      method: 'GET',
      connectTimeout: 15000, // 15秒超时
      proxy: {
        all: {
          url: proxyUrl,
          ...(proxyConfig.username && proxyConfig.password ? {
            basicAuth: {
              username: proxyConfig.username,
              password: proxyConfig.password,
            }
          } : {})
        }
      }
    };

    // 发送测试请求
    const response = await tauriHttpFetch(testUrl, fetchOptions);
    const responseTime = Date.now() - startTime;

    logger.debug(`响应状态: ${response.status}, 耗时: ${responseTime}ms`);

    if (response.ok || response.status === 200) {
      // 尝试获取外部 IP（如果测试 URL 返回 IP 信息）
      let externalIp: string | undefined;
      try {
        if (testUrl.includes('ip') || testUrl.includes('httpbin')) {
          const text = await response.text();
          // 尝试从响应中提取 IP
          const ipMatch = text.match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/);
          if (ipMatch) {
            externalIp = ipMatch[0];
          }
        }
      } catch {
        // 忽略 IP 提取错误
      }

      return {
        success: true,
        responseTime,
        statusCode: response.status,
        externalIp,
      };
    } else {
      return {
        success: false,
        responseTime,
        statusCode: response.status,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    logger.error('测试失败:', error);

    // 解析错误信息
    let errorMessage = error?.message || '未知错误';
    
    if (errorMessage.includes('signal is aborted')) {
      errorMessage = '代理连接超时或被中止，请检查代理服务器是否可达';
    } else if (errorMessage.includes('connection refused')) {
      errorMessage = '代理服务器拒绝连接，请检查代理地址和端口';
    } else if (errorMessage.includes('timeout')) {
      errorMessage = '代理连接超时，请检查代理服务器是否正常运行';
    } else if (errorMessage.includes('SOCKS')) {
      errorMessage = 'SOCKS 代理连接失败，请检查代理类型是否正确';
    }

    return {
      success: false,
      responseTime,
      error: errorMessage,
    };
  }
}

/**
 * 使用 CorsBypass 插件的流式请求
 */
async function corsPluginStreamFetch(
  url: string,
  options: RequestInit,
  timeout: number
): Promise<UniversalResponse> {
  logger.debug('使用 CorsBypass 流式 API:', url);

  // 创建一个 ReadableStream 来模拟标准的流式响应
  let streamId: string;
  let responseHeaders: Record<string, string> = {};
  let statusCode = 200;
  let statusText = 'OK';

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {

      try {
        // 设置事件监听器
        const chunkListener = await CorsBypass.addListener('streamChunk', (event: any) => {
          if (event.streamId === streamId) {
            if (event.data) {
              // 将数据转换为 Uint8Array 并推送到流中
              const encoder = new TextEncoder();
              const chunk = encoder.encode(event.data);
              controller.enqueue(chunk);
            }

            if (event.done) {
              logger.debug('流式响应完成');
              controller.close();
              chunkListener.remove();
            }
          }
        });

        const statusListener = await CorsBypass.addListener('streamStatus', (event: any) => {
          if (event.streamId === streamId) {
            logger.debug('流状态变化:', event.status);
            
            if (event.status === 'error') {
              const error = new Error(event.error || 'Stream error');
              controller.error(error);
              statusListener.remove();
              chunkListener.remove();
            }
          }
        });

        // 发起流式请求
        const result = await CorsBypass.streamRequest({
          url,
          method: (options.method || 'POST') as any,
          headers: extractHeaders(options.headers),
          data: serializeRequestBody(options.body),
          timeout
        });

        streamId = result.streamId;
        logger.debug('流式请求已启动，streamId:', streamId);

      } catch (error) {
        logger.error('流式请求启动失败:', error);
        controller.error(error);
      }
    },

    cancel() {
      // 取消流时，取消插件的流式请求
      if (streamId) {
        logger.debug('取消流式请求:', streamId);
        CorsBypass.cancelStream({ streamId }).catch((err: any) => {
          logger.error('取消流失败:', err);
        });
      }
    }
  });

  // 创建兼容的 Response 对象
  const response = new Response(stream, {
    status: statusCode,
    statusText: statusText,
    headers: new Headers(responseHeaders)
  });

  return response as UniversalResponse;
}
