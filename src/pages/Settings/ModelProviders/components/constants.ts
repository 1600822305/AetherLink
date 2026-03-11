import { useState, useEffect } from 'react';

// ============================================================================
// 常量定义
// ============================================================================

export const CONSTANTS = {
  MESSAGE_LENGTH_THRESHOLD: 80,
  DEBOUNCE_DELAY: 300,
  SPECIAL_ENDPOINTS: {
    VOLCES: 'volces.com/api/v3',
    OPENAI_RESPONSE: 'openai-response'
  }
} as const;

// ============================================================================
// 样式常量
// ============================================================================

export const STYLES = {
  primaryButton: {
    bgcolor: (theme: any) => theme.palette.primary.main + '1a', // alpha 0.1
    color: 'primary.main',
    '&:hover': {
      bgcolor: (theme: any) => theme.palette.primary.main + '33', // alpha 0.2
    },
    borderRadius: 2,
  },
  errorButton: {
    bgcolor: (theme: any) => theme.palette.error.main + '1a', // alpha 0.1
    color: 'error.main',
    '&:hover': {
      bgcolor: (theme: any) => theme.palette.error.main + '33', // alpha 0.2
    },
    borderRadius: 2,
  }
} as const;

// ============================================================================
// 供应商类型选项
// ============================================================================

// 注意：openai-response 已合并到 openai 和 openai-aisdk，通过 useResponsesAPI 开关控制
// 注意：gemini 已统一使用 AI SDK 实现，支持流式优化和思考预算
export const providerTypeOptions = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'openai-aisdk', label: 'OpenAI (AI SDK) - 流式优化' },
  { value: 'azure-openai', label: 'Azure OpenAI' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'grok', label: 'xAI (Grok)' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'zhipu', label: '智谱AI' },
  { value: 'siliconflow', label: '硅基流动 (SiliconFlow)' },
  { value: 'volcengine', label: '火山引擎' },
  { value: 'minimax', label: 'MiniMax' },
  { value: 'dashscope', label: '阿里云百炼 (DashScope)' },
  { value: 'google', label: 'Google (通用)' },
  { value: 'custom', label: '自定义' }
];

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 格式化API主机地址 - 简化逻辑，更明确的处理方式
 * @param host 输入的基础URL
 * @param providerType 提供商类型
 * @returns 格式化后的URL
 */
export const formatApiHost = (host: string, providerType?: string): string => {
  if (!host.trim()) return '';

  const normalizedUrl = host.trim().replace(/\/$/, '');

  // 特殊处理：如果URL以特定路径结尾，保持原样
  if (normalizedUrl.endsWith(CONSTANTS.SPECIAL_ENDPOINTS.VOLCES)) {
    return normalizedUrl;
  }

  // OpenAI Response API 特殊处理
  if (providerType === CONSTANTS.SPECIAL_ENDPOINTS.OPENAI_RESPONSE) {
    return normalizedUrl;
  }

  // 默认添加 /v1
  return `${normalizedUrl}/v1`;
};

/**
 * 生成预览URL
 * @param baseUrl 基础URL
 * @param providerType 提供商类型
 * @param useResponsesAPI 是否使用 Responses API（开关）
 */
export const getPreviewUrl = (baseUrl: string, providerType?: string, useResponsesAPI?: boolean): string => {
  if (!baseUrl.trim()) return '';

  const formattedHost = formatApiHost(baseUrl, providerType);

  // 如果启用了 Responses API 开关，或者是 openai-response 类型
  if (useResponsesAPI || providerType === CONSTANTS.SPECIAL_ENDPOINTS.OPENAI_RESPONSE) {
    return `${formattedHost}/responses`;
  }

  return `${formattedHost}/chat/completions`;
};

/**
 * 判断是否为OpenAI类型的提供商（参考逻辑）
 * @param providerType 供应商类型
 * @returns 是否为OpenAI类型
 */
export const isOpenAIProvider = (providerType?: string): boolean => {
  return !['anthropic', 'gemini'].includes(providerType || '');
};

/**
 * 显示用的URL补全函数 - 仅用于显示完整的API端点
 * @param baseUrl 基础URL
 * @param providerType 提供商类型
 * @param useResponsesAPI 是否使用 Responses API（开关）
 * @returns 显示用的完整API端点
 */
export const getCompleteApiUrl = (baseUrl: string, providerType?: string, useResponsesAPI?: boolean): string => {
  if (!baseUrl.trim()) return '';
  return getPreviewUrl(baseUrl, providerType, useResponsesAPI);
};

// ============================================================================
// 自定义 Hooks
// ============================================================================

/**
 * 防抖Hook
 */
export const useDebounce = <T,>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

