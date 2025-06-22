/**
 * 免费Bing搜索服务
 * 使用 capacitor-cors-bypass-enhanced 插件绕过CORS限制
 */

import type { 
  BingSearchOptions, 
  BingSearchResult, 
  BingSearchResponse
} from './BingSearchModules';

import {
  searchBing,
  searchGoogle,
  searchBaidu,
  searchSogou,
  searchYandex,
  fetchResultsContent
} from './BingSearchModules';

// 重新导出类型，保持向后兼容
export type { BingSearchOptions, BingSearchResult, BingSearchResponse };

/**
 * 免费Bing搜索服务类
 * 通过解析Bing搜索页面HTML来获取搜索结果
 */
export class BingFreeSearchService {
  private static instance: BingFreeSearchService;

  private constructor() {}

  public static getInstance(): BingFreeSearchService {
    if (!BingFreeSearchService.instance) {
      BingFreeSearchService.instance = new BingFreeSearchService();
    }
    return BingFreeSearchService.instance;
  }

  /**
   * 执行搜索（支持多种搜索引擎）
   */
  public async search(options: BingSearchOptions): Promise<BingSearchResponse> {
    const {
      query,
      maxResults = 10,
      language = 'zh-CN',
      region = 'CN',
      safeSearch = 'moderate',
      freshness,
      timeout = 30000,
      searchEngine = 'bing'
    } = options;

    if (!query.trim()) {
      throw new Error('搜索查询不能为空');
    }

    console.log(`[BingFreeSearchService] 开始搜索: ${query}，使用搜索引擎: ${searchEngine}`);

    try {
      // 根据搜索引擎使用不同的搜索策略
      let results: BingSearchResult[] = [];
      const searchOptions = { language, region, safeSearch, freshness, count: Math.min(maxResults, 50) };

      switch (searchEngine) {
        case 'bing':
          results = await searchBing(query, searchOptions, timeout);
          break;
        case 'google':
          results = await searchGoogle(query, { ...searchOptions, count: Math.min(maxResults, 20) }, timeout);
          break;
        case 'baidu':
          results = await searchBaidu(query, searchOptions, timeout);
          break;
        case 'sogou':
          results = await searchSogou(query, { ...searchOptions, count: Math.min(maxResults, 20) }, timeout);
          break;
        case 'yandex':
          results = await searchYandex(query, searchOptions, timeout);
          break;
        default:
          results = await searchBing(query, searchOptions, timeout);
      }

      console.log(`[BingFreeSearchService] 搜索完成，找到 ${results.length} 个结果`);

      // 如果需要抓取内容，则抓取每个链接的内容
      if (options.fetchContent && results.length > 0) {
        console.log('[BingFreeSearchService] 开始抓取链接内容...');
        await fetchResultsContent(results, options.maxContentLength || 2000, timeout);
      }

      return {
        results,
        query,
        totalResults: results.length
      };

    } catch (error: any) {
      console.error('[BingFreeSearchService] 搜索失败:', error);
      throw new Error(`Bing搜索失败: ${error.message}`);
    }
  }

  /**
   * 批量搜索
   */
  public async batchSearch(queries: string[], options: Omit<BingSearchOptions, 'query'> = {}): Promise<BingSearchResponse[]> {
    const promises = queries.map(query =>
      this.search({ ...options, query }).catch(error => {
        console.error(`[BingFreeSearchService] 批量搜索失败 - ${query}:`, error);
        return { results: [], query, totalResults: 0 };
      })
    );

    return Promise.all(promises);
  }
}

// 导出单例实例
export const bingFreeSearchService = BingFreeSearchService.getInstance();

// 默认导出
export default BingFreeSearchService;
