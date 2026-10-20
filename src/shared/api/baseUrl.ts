/**
 * OpenAI 兼容接口的基础 URL 规范化
 *
 * 各 OpenAI 兼容服务的 API 版本段并不都是 `/v1`：
 * - 智谱：`https://open.bigmodel.cn/api/paas/v4`
 * - 火山方舟：`https://ark.cn-beijing.volces.com/api/v3`
 * - Gemini 兼容层：`https://generativelanguage.googleapis.com/v1beta`
 *
 * 旧实现只判断 URL 是否包含 `/v1`，遇到上面这些路径会再拼一个 `/v1`，
 * 得到 `/v4/v1/chat/completions` 这类不存在的端点。这里统一判断版本段。
 */

export const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1';

/**
 * 匹配结尾的版本段，如 /v1、/v1beta、/v4、/v3、/v1-preview。
 * 只匹配路径最后一段，避免把 `/v1/foo` 之类的自定义代理路径误判为版本段。
 */
const VERSION_SUFFIX_REGEX = /\/v\d+[a-z0-9._-]*$/i;

export interface NormalizeOpenAIBaseUrlOptions {
  /**
   * 是否在缺少版本段时补 `/v1`，默认 true。
   * 传入 false 时只去掉末尾斜杠（保留旧代码对“以 / 结尾表示保持原路径”的兼容）。
   */
  appendVersion?: boolean;
}

/**
 * 规范化 OpenAI 兼容接口的 baseURL。
 *
 * - 空值回退到 OpenAI 官方地址；
 * - 去掉末尾多余的斜杠；
 * - 已有版本段（/v1、/v4、/v1beta、/api/v3 等）时保持原样；
 * - 仅当路径中完全不包含 `/v1` 且结尾不是版本段时补 `/v1`。
 */
export function normalizeOpenAIBaseUrl(
  baseUrl?: string | null,
  options: NormalizeOpenAIBaseUrlOptions = {},
): string {
  const { appendVersion = true } = options;
  const raw = (baseUrl || '').trim();
  if (!raw) {
    return appendVersion ? DEFAULT_OPENAI_BASE_URL : '';
  }

  const withoutTrailingSlash = raw.replace(/\/+$/, '');
  if (!withoutTrailingSlash) {
    return appendVersion ? DEFAULT_OPENAI_BASE_URL : '';
  }

  if (!appendVersion) {
    return withoutTrailingSlash;
  }

  // 兼容旧行为：任何位置出现 /v1 都视为已带版本段；
  // 同时识别 /v4、/v1beta、/api/v3 等其它版本段。
  if (withoutTrailingSlash.includes('/v1') || VERSION_SUFFIX_REGEX.test(withoutTrailingSlash)) {
    return withoutTrailingSlash;
  }

  return `${withoutTrailingSlash}/v1`;
}

/**
 * 构造 OpenAI 兼容的 `/models` 端点。
 * 用于“获取模型列表”，与聊天请求使用同一套 baseURL 规范化规则。
 */
export function buildOpenAIModelsEndpoint(baseUrl?: string | null): string {
  return `${normalizeOpenAIBaseUrl(baseUrl)}/models`;
}
