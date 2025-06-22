/**
 * 各种搜索引擎的实现
 */

import type { BingSearchResult, SearchEngineOptions } from './types';
import { fetchSearchPage } from './utils';
import {
  parseBingResults,
  parseGoogleResults,
  parseBaiduResults,
  parseSogouResults,
  parseYandexResults
} from './parsers';

/**
 * 构建Bing搜索URL
 */
export function buildBingSearchUrl(query: string, options: SearchEngineOptions): string {
  const params = new URLSearchParams();
  params.set('q', query);
  params.set('count', options.count.toString());

  if (options.language) {
    params.set('setlang', options.language);
  }
  if (options.region) {
    params.set('cc', options.region);
  }
  if (options.safeSearch) {
    const safeSearchMap: Record<string, string> = {
      'strict': 'strict',
      'moderate': 'moderate',
      'off': 'off'
    };
    params.set('safesearch', safeSearchMap[options.safeSearch] || 'moderate');
  }
  if (options.freshness) {
    const freshnessMap: Record<string, string> = {
      'day': 'd',
      'week': 'w',
      'month': 'm'
    };
    params.set('qft', `+filterui:age-lt${freshnessMap[options.freshness]}`);
  }

  return `https://www.bing.com/search?${params.toString()}`;
}

/**
 * 构建Google搜索URL
 */
export function buildGoogleSearchUrl(query: string, options: SearchEngineOptions): string {
  const params = new URLSearchParams();
  params.set('q', query);
  params.set('num', Math.min(options.count, 20).toString());

  if (options.language) {
    params.set('hl', options.language);
  }
  if (options.region) {
    params.set('gl', options.region.toLowerCase());
  }
  if (options.safeSearch) {
    const safeSearchMap: Record<string, string> = {
      'strict': 'active',
      'moderate': 'active',
      'off': 'off'
    };
    params.set('safe', safeSearchMap[options.safeSearch] || 'active');
  }
  if (options.freshness) {
    const freshnessMap: Record<string, string> = {
      'day': 'd',
      'week': 'w',
      'month': 'm'
    };
    params.set('tbs', `qdr:${freshnessMap[options.freshness]}`);
  }

  return `https://www.google.com/search?${params.toString()}`;
}

/**
 * 构建百度搜索URL
 */
export function buildBaiduSearchUrl(query: string, options: SearchEngineOptions): string {
  const params = new URLSearchParams();
  params.set('wd', query);
  params.set('rn', Math.min(options.count, 50).toString());

  return `https://www.baidu.com/s?${params.toString()}`;
}

/**
 * 构建搜狗搜索URL
 */
export function buildSogouSearchUrl(query: string, options: SearchEngineOptions): string {
  const params = new URLSearchParams();
  params.set('query', query);
  params.set('num', Math.min(options.count, 20).toString());

  return `https://www.sogou.com/web?${params.toString()}`;
}

/**
 * 构建Yandex搜索URL
 */
export function buildYandexSearchUrl(query: string, _options: SearchEngineOptions): string {
  const params = new URLSearchParams();
  params.set('tmpl_version', 'releases');
  params.set('text', query);
  params.set('web', '1');
  params.set('frame', '1');
  params.set('searchid', '3131712');

  return `https://yandex.com/search/site/?${params.toString()}`;
}

/**
 * Bing搜索实现
 */
export async function searchBing(query: string, options: SearchEngineOptions, timeout: number): Promise<BingSearchResult[]> {
  const searchUrl = buildBingSearchUrl(query, options);
  console.log(`[SearchEngines] Bing搜索URL: ${searchUrl}`);

  const response = await fetchSearchPage(searchUrl, timeout);
  return parseBingResults(response.data, options.count);
}

/**
 * Google搜索实现
 */
export async function searchGoogle(query: string, options: SearchEngineOptions, timeout: number): Promise<BingSearchResult[]> {
  const searchUrl = buildGoogleSearchUrl(query, options);
  console.log(`[SearchEngines] Google搜索URL: ${searchUrl}`);

  const response = await fetchSearchPage(searchUrl, timeout);
  return parseGoogleResults(response.data, options.count);
}

/**
 * 百度搜索实现
 */
export async function searchBaidu(query: string, options: SearchEngineOptions, timeout: number): Promise<BingSearchResult[]> {
  const searchUrl = buildBaiduSearchUrl(query, options);
  console.log(`[SearchEngines] 百度搜索URL: ${searchUrl}`);

  const response = await fetchSearchPage(searchUrl, timeout);
  return parseBaiduResults(response.data, options.count);
}

/**
 * 搜狗搜索实现
 */
export async function searchSogou(query: string, options: SearchEngineOptions, timeout: number): Promise<BingSearchResult[]> {
  const searchUrl = buildSogouSearchUrl(query, options);
  console.log(`[SearchEngines] 搜狗搜索URL: ${searchUrl}`);

  const response = await fetchSearchPage(searchUrl, timeout);
  return parseSogouResults(response.data, options.count);
}

/**
 * Yandex搜索实现
 */
export async function searchYandex(query: string, options: SearchEngineOptions, timeout: number): Promise<BingSearchResult[]> {
  const searchUrl = buildYandexSearchUrl(query, options);
  console.log(`[SearchEngines] Yandex搜索URL: ${searchUrl}`);

  // 注意：Yandex搜索可能需要特殊的headers和cookies才能正常工作
  // 目前使用通用的fetchSearchPage，如果需要可以后续优化
  const response = await fetchSearchPage(searchUrl, timeout);
  return parseYandexResults(response.data, options.count);
}
