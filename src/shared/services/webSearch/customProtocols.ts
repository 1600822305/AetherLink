import { v4 as uuidv4 } from 'uuid';
import type {
  WebSearchResult,
  WebSearchProviderConfig,
  WebSearchCustomProvider,
  CustomSearchProtocol,
  CustomJsonTemplate
} from '../../types';
import { searchHttpRequest, type SearchHttpRequest } from './httpClient';
import { fetchPageContent } from './BingSearchModules/contentFetcher';
import { createLogger } from '../infra/logger';

const logger = createLogger('customProtocols');

const SNIPPET_LIMIT = 1000;
const FETCHED_CONTENT_LIMIT = 1500;
const CONTENT_FETCH_TIMEOUT = 15000;
const CONTENT_FETCH_BATCH_SIZE = 3;
const ENGINE_CACHE_TTL = 10 * 60 * 1000;

/**
 * 搜索协议适配器：buildRequest/parseResponse 均为纯函数，
 * 由统一 HTTP 层执行请求，内置与自定义提供商共用一条管线。
 */
export interface SearchProtocolAdapter {
  id: CustomSearchProtocol;
  /** 判断给定配置是否已填齐该协议所需字段 */
  isConfigured: (provider: WebSearchProviderConfig) => boolean;
  buildRequest: (provider: WebSearchProviderConfig, query: string, maxResults: number) => SearchHttpRequest | Promise<SearchHttpRequest>;
  parseResponse: (data: any, provider: WebSearchProviderConfig, maxResults: number) => WebSearchResult[];
  /** 可选的结果增强步骤（如抓取网页全文），失败时必须保留原始结果 */
  enrichResults?: (results: WebSearchResult[], provider: WebSearchProviderConfig) => Promise<WebSearchResult[]>;
}

const trimSnippet = (text: string): string =>
  text.length > SNIPPET_LIMIT ? `${text.substring(0, SNIPPET_LIMIT)}...` : text;

const normalizeBaseUrl = (url: string): string => url.trim().replace(/\/+$/, '');

const buildBasicAuthHeaders = (provider: WebSearchProviderConfig): Record<string, string> => {
  const headers: Record<string, string> = {};
  if (provider.basicAuthUsername && provider.basicAuthPassword) {
    headers['Authorization'] = `Basic ${btoa(`${provider.basicAuthUsername}:${provider.basicAuthPassword}`)}`;
  }
  return headers;
};

// SearXNG 引擎自动发现：调用 /config 获取实例启用的 general/web 引擎，按实例缓存
const searxngEngineCache = new Map<string, { engines: string[]; timestamp: number }>();

async function discoverSearxngEngines(baseUrl: string, headers: Record<string, string>): Promise<string[]> {
  const cached = searxngEngineCache.get(baseUrl);
  if (cached && Date.now() - cached.timestamp < ENGINE_CACHE_TTL) {
    return cached.engines;
  }
  try {
    const { data } = await searchHttpRequest({
      url: `${baseUrl}/config`,
      method: 'GET',
      headers,
      timeout: 10000
    });
    const engines: string[] = (Array.isArray(data?.engines) ? data.engines : [])
      .filter((engine: any) =>
        engine?.enabled &&
        Array.isArray(engine?.categories) &&
        engine.categories.includes('general') &&
        engine.categories.includes('web')
      )
      .map((engine: any) => String(engine.name));
    searxngEngineCache.set(baseUrl, { engines, timestamp: Date.now() });
    return engines;
  } catch (error) {
    logger.warn('SearXNG 引擎自动发现失败，使用实例默认引擎:', error);
    return [];
  }
}

// 抓取结果页面全文，失败或内容为空时回退使用原始摘要（不丢弃结果）
async function enrichResultsWithPageContent(results: WebSearchResult[]): Promise<WebSearchResult[]> {
  const enriched = [...results];
  const tasks = enriched.map((result, index) => async () => {
    if (!/^https?:\/\//i.test(result.url)) return;
    try {
      const content = await fetchPageContent(result.url, FETCHED_CONTENT_LIMIT, CONTENT_FETCH_TIMEOUT);
      if (content && content.trim().length > 0 && content !== '跳过此类型的链接') {
        enriched[index] = {
          ...result,
          snippet: result.snippet ? `${result.snippet}\n\n页面内容摘要:\n${content}` : content
        };
      }
    } catch (error) {
      logger.warn(`页面内容抓取失败，回退使用搜索摘要: ${result.url}`, error);
    }
  });
  for (let i = 0; i < tasks.length; i += CONTENT_FETCH_BATCH_SIZE) {
    await Promise.all(tasks.slice(i, i + CONTENT_FETCH_BATCH_SIZE).map((task) => task()));
  }
  return enriched;
}

/**
 * SearXNG 协议：GET {baseUrl}/search?q=...&format=json
 * 需要实例在 settings.yml 中启用 json 格式输出
 */
const searxngAdapter: SearchProtocolAdapter = {
  id: 'searxng',
  isConfigured: (provider) => !!provider.apiHost?.trim(),
  buildRequest: async (provider, query, maxResults) => {
    const baseUrl = normalizeBaseUrl(provider.apiHost || '');
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      pageno: '1'
    });
    const headers = buildBasicAuthHeaders(provider);

    const engines = provider.engines?.length
      ? provider.engines
      : await discoverSearxngEngines(baseUrl, headers);
    if (engines.length) {
      params.set('engines', engines.join(','));
    }
    void maxResults; // SearXNG 不支持每页数量参数，结果在 parseResponse 截断

    return { url: `${baseUrl}/search?${params.toString()}`, method: 'GET', headers };
  },
  parseResponse: (data, provider, maxResults) => {
    const items: any[] = Array.isArray(data?.results) ? data.results : [];
    return items.slice(0, maxResults).map((item) => ({
      id: uuidv4(),
      title: String(item.title || '无标题'),
      url: String(item.url || ''),
      snippet: trimSnippet(String(item.content || '')),
      timestamp: new Date().toISOString(),
      provider: provider.id,
      score: typeof item.score === 'number' ? item.score : undefined
    }));
  },
  enrichResults: (results, provider) =>
    provider.fetchContent ? enrichResultsWithPageContent(results) : Promise.resolve(results)
};

/**
 * tavily-compatible 协议：POST {baseUrl}/search，请求/响应遵循 Tavily API 格式。
 * 覆盖自建或第三方提供的 Tavily 兼容服务。
 */
const tavilyCompatibleAdapter: SearchProtocolAdapter = {
  id: 'tavily-compatible',
  isConfigured: (provider) => !!provider.apiHost?.trim() && !!provider.apiKey?.trim(),
  buildRequest: (provider, query, maxResults) => {
    const baseUrl = normalizeBaseUrl(provider.apiHost || '');
    return {
      url: `${baseUrl}/search`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${provider.apiKey}`
      },
      body: {
        query,
        max_results: maxResults,
        search_depth: 'basic'
      }
    };
  },
  parseResponse: (data, provider, maxResults) => {
    const items: any[] = Array.isArray(data?.results) ? data.results : [];
    return items.slice(0, maxResults).map((item) => ({
      id: uuidv4(),
      title: String(item.title || '无标题'),
      url: String(item.url || ''),
      snippet: trimSnippet(String(item.content || item.snippet || '')),
      timestamp: new Date().toISOString(),
      provider: provider.id,
      score: typeof item.score === 'number' ? item.score : undefined
    }));
  }
};

// custom-json 模板仅允许以下占位符，不执行任何用户代码
const substitutePlaceholders = (
  template: string,
  values: Record<string, string>
): string =>
  template.replace(/\{\{(query|apiKey|maxResults)\}\}/g, (_match, key: string) => values[key] ?? '');

/** 点路径取值，如 resolvePath(obj, 'data.items') */
const resolvePath = (obj: any, path: string): any => {
  if (!path) return obj;
  return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
};

const substituteInValue = (value: any, values: Record<string, string>): any => {
  if (typeof value === 'string') return substitutePlaceholders(value, values);
  if (Array.isArray(value)) return value.map((v) => substituteInValue(v, values));
  if (value && typeof value === 'object') {
    const result: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = substituteInValue(v, values);
    }
    return result;
  }
  return value;
};

export const parseCustomJsonTemplate = (json?: string): CustomJsonTemplate | null => {
  if (!json?.trim()) return null;
  try {
    const parsed = JSON.parse(json);
    if (
      typeof parsed?.request?.url === 'string' &&
      typeof parsed?.response?.resultsPath === 'string' &&
      parsed?.response?.fields &&
      typeof parsed.response.fields.title === 'string' &&
      typeof parsed.response.fields.url === 'string' &&
      typeof parsed.response.fields.snippet === 'string'
    ) {
      return parsed as CustomJsonTemplate;
    }
    return null;
  } catch {
    return null;
  }
};

/**
 * custom-json 协议：用户提供请求模板（{{query}}/{{apiKey}}/{{maxResults}} 占位符）
 * 与响应字段点路径映射，可对接任意返回 JSON 的搜索 API。
 */
const customJsonAdapter: SearchProtocolAdapter = {
  id: 'custom-json',
  isConfigured: (provider) => !!provider.customTemplate,
  buildRequest: (provider, query, maxResults) => {
    const template = provider.customTemplate;
    if (!template) {
      throw new Error('custom-json 模板未配置或格式无效');
    }
    const values = {
      query,
      apiKey: provider.apiKey || '',
      maxResults: String(maxResults)
    };
    return {
      url: substitutePlaceholders(template.request.url, values),
      method: template.request.method || 'GET',
      headers: substituteInValue(template.request.headers || {}, values),
      body: template.request.body !== undefined ? substituteInValue(template.request.body, values) : undefined
    };
  },
  parseResponse: (data, provider, maxResults) => {
    const template = provider.customTemplate;
    if (!template) return [];
    const items = resolvePath(data, template.response.resultsPath);
    if (!Array.isArray(items)) {
      throw new Error(`custom-json 响应中 resultsPath "${template.response.resultsPath}" 不是数组`);
    }
    const { fields } = template.response;
    return items.slice(0, maxResults).map((item: any) => ({
      id: uuidv4(),
      title: String(resolvePath(item, fields.title) ?? '无标题'),
      url: String(resolvePath(item, fields.url) ?? ''),
      snippet: trimSnippet(String(resolvePath(item, fields.snippet) ?? '')),
      timestamp: new Date().toISOString(),
      provider: provider.id
    }));
  }
};

const protocolAdapters: Record<CustomSearchProtocol, SearchProtocolAdapter> = {
  'searxng': searxngAdapter,
  'tavily-compatible': tavilyCompatibleAdapter,
  'custom-json': customJsonAdapter
};

export const getProtocolAdapter = (protocol?: CustomSearchProtocol): SearchProtocolAdapter | undefined =>
  protocol ? protocolAdapters[protocol] : undefined;

/** 旧数据无 protocol 字段：有 apiKey 视为 tavily-compatible，否则 searxng */
export const getCustomProviderProtocol = (provider: WebSearchCustomProvider): CustomSearchProtocol =>
  provider.protocol || (provider.apiKey?.trim() ? 'tavily-compatible' : 'searxng');

/** 将自定义提供商映射为统一的 WebSearchProviderConfig，进入与内置提供商相同的执行管线 */
export const customProviderToConfig = (provider: WebSearchCustomProvider): WebSearchProviderConfig => {
  const protocol = getCustomProviderProtocol(provider);
  return {
    id: provider.id,
    name: provider.name,
    apiKey: provider.apiKey,
    apiHost: provider.baseUrl,
    basicAuthUsername: provider.basicAuthUsername,
    basicAuthPassword: provider.basicAuthPassword,
    fetchContent: provider.fetchContent,
    protocol,
    customTemplate: protocol === 'custom-json' ? parseCustomJsonTemplate(provider.customTemplateJson) || undefined : undefined
  };
};

export const isCustomProviderConfigured = (provider: WebSearchCustomProvider): boolean => {
  const config = customProviderToConfig(provider);
  const adapter = getProtocolAdapter(config.protocol);
  return !!adapter && adapter.isConfigured(config);
};

/** 通过协议适配器执行一次搜索 */
export async function executeProtocolSearch(
  provider: WebSearchProviderConfig,
  query: string,
  maxResults: number
): Promise<WebSearchResult[]> {
  const adapter = getProtocolAdapter(provider.protocol);
  if (!adapter) {
    throw new Error(`不支持的搜索提供商: ${provider.id}`);
  }
  if (!adapter.isConfigured(provider)) {
    throw new Error(`搜索提供商 ${provider.name} 配置不完整（协议: ${adapter.id}）`);
  }
  const request = await adapter.buildRequest(provider, query, maxResults);
  const response = await searchHttpRequest(request);
  const results = adapter.parseResponse(response.data, provider, maxResults);
  return adapter.enrichResults ? adapter.enrichResults(results, provider) : results;
}
