/**
 * 搜索服务相关类型定义
 */

export interface BingSearchOptions {
  query: string;
  maxResults?: number;
  language?: string;
  region?: string;
  safeSearch?: 'strict' | 'moderate' | 'off';
  freshness?: 'day' | 'week' | 'month';
  timeout?: number;
  fetchContent?: boolean; // 是否抓取链接内容
  maxContentLength?: number; // 最大内容长度
  searchEngine?: 'bing' | 'google' | 'baidu' | 'sogou' | 'yandex'; // 搜索引擎选择
}

export interface BingSearchResult {
  id: string;
  title: string;
  url: string;
  snippet: string;
  timestamp: string;
  provider: string;
  score?: number;
  content?: string; // 抓取的页面内容
  contentLength?: number; // 内容长度
}

export interface BingSearchResponse {
  results: BingSearchResult[];
  query: string;
  totalResults?: number;
}

export interface SearchEngineOptions {
  language?: string;
  region?: string;
  safeSearch?: 'strict' | 'moderate' | 'off';
  freshness?: 'day' | 'week' | 'month';
  count: number;
}
