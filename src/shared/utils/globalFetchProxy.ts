/**
 * 全局 Fetch 代理模块
 *
 * 在 Tauri 桌面端和 Capacitor 移动端环境中，覆盖全局 fetch 函数以支持代理配置
 * 这样第三方 SDK（如 @google/genai）也能自动使用代理
 *
 * 注意：此模块应在应用启动时尽早导入
 */

import { Capacitor } from '@capacitor/core';
import { CorsBypass } from 'capacitor-cors-bypass-enhanced';
import { isTauri } from './platformDetection';
import { createLogger } from '../services/infra/logger';
const logger = createLogger('GlobalFetchProxy');

// 保存原始 fetch 引用
const originalFetch = globalThis.fetch;

// 标记是否已初始化
let isInitialized = false;

/**
 * 从各种格式的 headers 中提取普通对象
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
 * 序列化请求体
 */
function serializeRequestBody(body?: BodyInit | null): string | undefined {
  if (!body) return undefined;
  if (typeof body === 'string') return body;
  
  // 对于其他类型，尝试转换为字符串
  try {
    return String(body);
  } catch {
    return undefined;
  }
}

/**
 * 检查 URL 是否是 Gemini API 请求
 */
function isGeminiApiRequest(url: string): boolean {
  return url.includes('generativelanguage.googleapis.com') ||
         url.includes('aiplatform.googleapis.com');
}

/**
 * 检查请求是否是流式请求
 */
function isStreamingRequest(init?: RequestInit): boolean {
  if (!init?.body) return false;
  
  try {
    const bodyStr = typeof init.body === 'string' ? init.body : '';
    // 检查是否包含 stream: true 标志
    return bodyStr.includes('"stream":true') || bodyStr.includes('"stream": true');
  } catch {
    return false;
  }
}

/**
 * 创建支持代理的移动端 fetch 函数（使用 CorsBypass 插件）
 *
 * 注意：
 * - Gemini API 的流式请求直接使用原生 fetch（移动端原生应用不受 CORS 限制）
 * - 其他请求使用 CorsBypass 绕过 CORS
 */
async function createProxiedMobileFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  
  // 本地请求使用原始 fetch
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1') {
      logger.debug('移动端本地请求，使用原始 fetch:', url);
      return originalFetch(input, init);
    }
  } catch {
    // URL 解析失败，继续
  }

  // Gemini API 请求：直接使用原生 fetch
  // 移动端原生应用不受 CORS 限制，可以直接请求 Gemini API
  // 这样可以保持 Gemini SDK 的流式响应正常工作
  if (isGeminiApiRequest(url)) {
    logger.debug('移动端 Gemini API 请求，使用原始 fetch:', url.substring(0, 80) + (url.length > 80 ? '...' : ''));
    return originalFetch(input, init);
  }

  // 检查是否是流式请求（非 Gemini 的其他流式请求）
  const isStreaming = isStreamingRequest(init);
  
  // 流式请求使用原生 fetch（移动端不受 CORS 限制）
  if (isStreaming) {
    logger.debug('移动端流式请求，使用原始 fetch:', url.substring(0, 80) + (url.length > 80 ? '...' : ''));
    return originalFetch(input, init);
  }

  // 非流式请求使用 CorsBypass（提供更好的错误处理和超时控制）
  try {
    logger.debug('移动端非流式请求，使用 CorsBypass:', url.substring(0, 80) + (url.length > 80 ? '...' : ''));
    
    const response = await CorsBypass.request({
      url,
      method: (init?.method || 'GET') as any,
      headers: extractHeaders(init?.headers),
      data: serializeRequestBody(init?.body),
      timeout: 30000,
      responseType: 'text' as any
    });
    
    // 创建兼容的 Response 对象
    return new Response(
      typeof response.data === 'string' ? response.data : JSON.stringify(response.data),
      {
        status: response.status,
        statusText: response.statusText,
        headers: new Headers(response.headers)
      }
    );
    
  } catch (error) {
    logger.error('移动端非流式请求失败，回退到原始 fetch:', error);
    return originalFetch(input, init);
  }
}

/**
 * 初始化全局 fetch 代理
 *
 * 在 Tauri 桌面端环境中，覆盖 globalThis.fetch 以支持代理配置
 * 在 Capacitor 移动端环境中，覆盖 globalThis.fetch 以使用 CorsBypass 插件
 * 普通 Web 环境不做任何修改
 */
export function initGlobalFetchProxy(): void {
  if (isInitialized) {
    logger.debug('已初始化，跳过');
    return;
  }

  // Tauri 桌面端：不拦截，Tauri 本身没有 CORS 限制，直接使用原生 fetch
  if (isTauri()) {
    logger.debug('Tauri 桌面端，无需拦截（无 CORS 限制）');
    isInitialized = true;
    return;
  }

  // Capacitor 移动端
  if (Capacitor.isNativePlatform()) {
    logger.debug('初始化移动端全局 fetch 代理...');

    globalThis.fetch = async function proxiedFetch(
      input: RequestInfo | URL,
      init?: RequestInit
    ): Promise<Response> {
      return createProxiedMobileFetch(input, init);
    };

    isInitialized = true;
    logger.debug('移动端全局 fetch 代理初始化完成');
    return;
  }

  // 普通 Web 环境
  logger.debug('Web 环境，跳过初始化');
  isInitialized = true;
}

/**
 * 恢复原始 fetch（用于测试或特殊情况）
 */
export function restoreOriginalFetch(): void {
  globalThis.fetch = originalFetch;
  isInitialized = false;
  logger.debug('已恢复原始 fetch');
}

/**
 * 获取原始 fetch 引用（用于需要绕过代理的场景）
 */
export function getOriginalFetch(): typeof fetch {
  return originalFetch;
}

/**
 * 检查全局 fetch 代理是否已初始化
 */
export function isGlobalFetchProxyInitialized(): boolean {
  return isInitialized;
}