/**
 * 内容抓取模块 - 抓取搜索结果页面的实际内容
 */

import { CorsBypass } from 'capacitor-cors-bypass-enhanced';
import { Capacitor } from '@capacitor/core';
import type { BingSearchResult } from './types';
import { shouldSkipUrl, extractTextContent } from './utils';

/**
 * 抓取搜索结果的页面内容
 */
export async function fetchResultsContent(
  results: BingSearchResult[], 
  maxContentLength: number, 
  timeout: number
): Promise<void> {
  const fetchPromises = results.map(async (result, index) => {
    try {
      console.log(`[ContentFetcher] 抓取内容 ${index + 1}/${results.length}: ${result.url}`);

      const content = await fetchPageContent(result.url, maxContentLength, timeout);
      result.content = content;
      result.contentLength = content.length;

      console.log(`[ContentFetcher] 内容抓取成功 ${index + 1}: ${content.length} 字符`);
    } catch (error) {
      console.warn(`[ContentFetcher] 内容抓取失败 ${index + 1}:`, error);
      result.content = `内容抓取失败: ${error}`;
      result.contentLength = 0;
    }
  });

  // 并发抓取，但限制并发数量避免过载
  const batchSize = 3; // 同时最多抓取3个页面
  for (let i = 0; i < fetchPromises.length; i += batchSize) {
    const batch = fetchPromises.slice(i, i + batchSize);
    await Promise.all(batch);
  }
}

/**
 * 抓取单个页面内容
 */
export async function fetchPageContent(url: string, maxLength: number, timeout: number): Promise<string> {
  // 跳过一些不适合抓取的URL
  if (shouldSkipUrl(url)) {
    return '跳过此类型的链接';
  }

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  };

  if (Capacitor.isNativePlatform()) {
    // 移动端使用 CorsBypass 插件
    const response = await CorsBypass.request({
      url,
      method: 'GET',
      headers,
      timeout: Math.min(timeout, 15000), // 限制单个页面抓取时间
      responseType: 'text'
    });

    if (response.status >= 400) {
      throw new Error(`HTTP ${response.status}`);
    }

    return extractTextContent(response.data, maxLength);
  } else {
    // Web端使用标准fetch
    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(Math.min(timeout, 15000))
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    return extractTextContent(html, maxLength);
  }
}
