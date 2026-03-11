/**
 * DashScope (阿里云百炼) 客户端模块
 * 提供 DashScope 原生 API 和 OpenAI 兼容模式的客户端
 */
import type { Model } from '../../types';
import { createClient as createOpenAIClient } from '../openai/client';
import { universalFetch } from '../../utils/universalFetch';
import { log } from '../../services/infra/LoggerService';
import type OpenAI from 'openai';

// DashScope API 基础 URL
const DASHSCOPE_BASE_URL = 'https://dashscope.aliyuncs.com';
const DASHSCOPE_COMPATIBLE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
// 新加坡地域
const DASHSCOPE_INTL_BASE_URL = 'https://dashscope-intl.aliyuncs.com';
const DASHSCOPE_INTL_COMPATIBLE_URL = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';

/**
 * 判断是否为国际地域的 DashScope URL
 */
function isInternationalUrl(baseUrl?: string): boolean {
  if (!baseUrl) return false;
  return baseUrl.includes('dashscope-intl') || baseUrl.includes('dashscope-us');
}

/**
 * 获取 DashScope 原生 API 基础 URL
 * 根据用户配置的 baseUrl 判断地域
 */
export function getDashScopeBaseUrl(model: Model): string {
  const baseUrl = model.baseUrl || '';
  if (isInternationalUrl(baseUrl)) {
    return DASHSCOPE_INTL_BASE_URL;
  }
  return DASHSCOPE_BASE_URL;
}

/**
 * 获取 DashScope OpenAI 兼容模式的 URL
 */
export function getDashScopeCompatibleUrl(model: Model): string {
  const baseUrl = model.baseUrl || '';
  if (isInternationalUrl(baseUrl)) {
    return DASHSCOPE_INTL_COMPATIBLE_URL;
  }
  // 如果用户自定义了 baseUrl 且包含 compatible-mode，直接使用
  if (baseUrl.includes('compatible-mode')) {
    return baseUrl;
  }
  return DASHSCOPE_COMPATIBLE_URL;
}

/**
 * 创建 OpenAI 兼容模式的客户端（用于聊天）
 * DashScope 的聊天 API 兼容 OpenAI 格式
 */
export function createCompatibleClient(model: Model): OpenAI {
  const compatibleModel = {
    ...model,
    baseUrl: getDashScopeCompatibleUrl(model)
  };
  return createOpenAIClient(compatibleModel);
}

/**
 * DashScope 原生 API 请求接口
 */
export interface DashScopeRequestOptions {
  path: string;
  body: Record<string, any>;
  apiKey: string;
  baseUrl?: string;
  signal?: AbortSignal;
}

/**
 * 发送 DashScope 原生 API 请求
 * 用于文生图等非 OpenAI 兼容的 API
 */
export async function dashScopeRequest<T = any>(options: DashScopeRequestOptions): Promise<T> {
  const { path, body, apiKey, baseUrl, signal } = options;
  const url = `${baseUrl || DASHSCOPE_BASE_URL}${path}`;

  log('INFO', `[DashScope] 发送请求: ${url}`, {
    model: body.model,
    path
  });

  const response = await universalFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(body),
    signal
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `DashScope API 请求失败: ${response.status}`;
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.message || errorJson.error?.message || errorMessage;
    } catch {
      errorMessage = `${errorMessage} - ${errorText}`;
    }
    log('ERROR', `[DashScope] API 错误: ${errorMessage}`);
    throw new Error(errorMessage);
  }

  const data = await response.json();
  return data as T;
}

/**
 * 检查模型是否为 DashScope 提供商
 */
export function isDashScopeProvider(model: Model): boolean {
  return model.provider === 'dashscope' ||
    model.providerType === 'dashscope' ||
    Boolean(model.baseUrl?.includes('dashscope.aliyuncs.com'));
}
