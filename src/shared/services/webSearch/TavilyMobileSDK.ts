/**
 * 移动端兼容的 Tavily SDK
 * 基于官方 API 文档实现，避免 Node.js 依赖
 */

import { createLogger } from '../infra/logger';

const logger = createLogger('TavilyMobileSDK');

export interface TavilySearchOptions {
  searchDepth?: 'basic' | 'advanced';
  topic?: 'general' | 'news';
  days?: number;
  timeRange?: 'day' | 'week' | 'month' | 'year' | 'd' | 'w' | 'm' | 'y';
  maxResults?: number;
  chunksPerSource?: number;
  includeImages?: boolean;
  includeImageDescriptions?: boolean;
  includeAnswer?: boolean | 'basic' | 'advanced';
  includeRawContent?: boolean;
  includeDomains?: string[];
  excludeDomains?: string[];
  // 🚀 新增：结果后处理选项
  minScore?: number; // 最小相关性分数阈值
  enableQueryValidation?: boolean; // 启用查询验证
  enablePostProcessing?: boolean; // 启用结果后处理
}

export interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score?: number;
  publishedDate?: string;
}

export interface TavilySearchResponse {
  query: string;
  followUpQuestions?: string[];
  answer?: string;
  images?: Array<{
    url: string;
    description?: string;
  }>;
  results: TavilySearchResult[];
  responseTime: number;
}

export interface TavilyClientOptions {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
}

/**
 * 移动端兼容的 Tavily 客户端
 */
export class TavilyMobileClient {
  private apiKey: string;
  private baseUrl: string;
  private timeout: number;

  constructor(options: TavilyClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl || 'https://api.tavily.com';
    this.timeout = options.timeout || 30000;
  }

  /**
   * 🚀 查询验证 - 根据Tavily最佳实践
   */
  private validateQuery(query: string): void {
    if (!query || query.trim().length === 0) {
      throw new Error('查询不能为空');
    }

    // Tavily最佳实践：查询长度不超过400字符
    if (query.length > 400) {
      throw new Error('查询过长。根据Tavily最佳实践，查询长度应不超过400字符。请考虑将复杂查询分解为多个较小的子查询。');
    }
  }

  /**
   * 🚀 结果后处理 - 根据Tavily最佳实践
   */
  private postProcessResults(results: TavilySearchResult[], options: TavilySearchOptions): TavilySearchResult[] {
    let processedResults = [...results];

    // 基于分数过滤
    if (options.minScore && options.minScore > 0) {
      processedResults = processedResults.filter(result =>
        result.score !== undefined && result.score >= options.minScore!
      );
      logger.debug(`基于分数过滤：${results.length} -> ${processedResults.length} 个结果`);
    }

    // 按分数排序（如果有分数）
    processedResults.sort((a, b) => {
      if (a.score !== undefined && b.score !== undefined) {
        return b.score - a.score; // 降序排列
      }
      return 0;
    });

    return processedResults;
  }

  /**
   * 🚀 查询分解建议
   */
  suggestQueryBreakdown(query: string): string[] {
    const suggestions: string[] = [];

    // 添加安全检查
    if (!query || typeof query !== 'string') {
      return suggestions;
    }

    // 检测复杂查询的常见模式
    if (query.includes(' and ') || query.includes(' & ')) {
      const parts = query.split(/\s+(?:and|&)\s+/i);
      suggestions.push(...parts.map(part => part.trim()));
    }

    if (query.includes(',')) {
      const parts = query.split(',');
      suggestions.push(...parts.map(part => part.trim()));
    }

    // 如果查询很长，建议分解
    if (query.length > 200 && suggestions.length === 0) {
      suggestions.push('建议将此长查询分解为多个更具体的子查询以获得更好的结果');
    }

    return suggestions.filter(s => s.length > 0);
  }

  /**
   * 执行搜索
   */
  async search(query: string, options: TavilySearchOptions = {}): Promise<TavilySearchResponse> {
    // 🚀 查询验证
    if (options.enableQueryValidation !== false) {
      this.validateQuery(query);
    }

    const requestBody = {
      api_key: this.apiKey,
      query,
      search_depth: options.searchDepth || 'basic',
      topic: options.topic || 'general',
      days: options.days,
      time_range: options.timeRange,
      max_results: options.maxResults || 5,
      chunks_per_source: options.chunksPerSource,
      include_images: options.includeImages || false,
      include_image_descriptions: options.includeImageDescriptions || false,
      include_answer: options.includeAnswer || false,
      include_raw_content: options.includeRawContent || false,
      include_domains: options.includeDomains,
      exclude_domains: options.excludeDomains
    };

    // 移除 undefined 值
    const cleanedBody = Object.fromEntries(
      Object.entries(requestBody).filter(([_, value]) => value !== undefined)
    );

    try {
      logger.debug(`开始搜索: ${query}`);

      const response = await fetch(`${this.baseUrl}/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8', // 🚀 明确指定UTF-8编码
          'Accept': 'application/json; charset=utf-8', // 🚀 请求UTF-8响应
          'User-Agent': 'TavilyMobileSDK/1.0.0'
        },
        body: JSON.stringify(cleanedBody),
        signal: AbortSignal.timeout(this.timeout)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Tavily API error: ${response.status} - ${errorText}`);
      }

      // 🚀 确保正确处理UTF-8编码的JSON响应
      const responseText = await response.text();
      const data = JSON.parse(responseText);

      logger.debug(`搜索完成，找到 ${data.results?.length || 0} 个结果`);

      // 🚀 结果后处理
      if (options.enablePostProcessing !== false && data.results) {
        data.results = this.postProcessResults(data.results, options);
        logger.debug(`后处理完成，最终结果数量: ${data.results.length}`);
      }

      // 🚀 调试：检查第一个结果的内容编码
      if (data.results && data.results.length > 0) {
        const firstResult = data.results[0];
        logger.debug(`第一个结果标题: "${firstResult.title}"`);
        logger.debug(`第一个结果内容预览: "${(firstResult.content || '').substring(0, 100)}..."`);
        if (firstResult.score !== undefined) {
          logger.debug(`第一个结果相关性分数: ${firstResult.score}`);
        }
      }

      return data as TavilySearchResponse;
    } catch (error: any) {
      logger.error('搜索失败:', error);

      if (error.name === 'AbortError') {
        throw new Error('搜索请求超时');
      }

      throw new Error(`搜索失败: ${error.message}`);
    }
  }

  /**
   * 🚀 批量搜索 - 根据Tavily最佳实践的异步并发处理
   */
  async batchSearch(
    queries: string[],
    options: TavilySearchOptions = {},
    concurrencyLimit: number = 3
  ): Promise<Array<TavilySearchResponse | Error>> {
    logger.debug(`开始批量搜索，查询数量: ${queries.length}，并发限制: ${concurrencyLimit}`);

    // 分批处理以避免超过速率限制
    const results: Array<TavilySearchResponse | Error> = [];

    for (let i = 0; i < queries.length; i += concurrencyLimit) {
      const batch = queries.slice(i, i + concurrencyLimit);

      // 并发执行当前批次
      const batchPromises = batch.map(async (query) => {
        try {
          return await this.search(query, options);
        } catch (error) {
          logger.error(`查询失败: "${query}"`, error);
          return error instanceof Error ? error : new Error(String(error));
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // 如果还有更多批次，添加延迟以避免速率限制
      if (i + concurrencyLimit < queries.length) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1秒延迟
      }
    }

    logger.debug(`批量搜索完成，成功: ${results.filter(r => !(r instanceof Error)).length}，失败: ${results.filter(r => r instanceof Error).length}`);
    return results;
  }

  /**
   * 🚀 智能搜索 - 自动应用最佳实践
   */
  async smartSearch(query: string, options: Partial<TavilySearchOptions> = {}): Promise<TavilySearchResponse> {
    // 应用Tavily最佳实践的默认设置
    const smartOptions: TavilySearchOptions = {
      searchDepth: 'advanced', // 使用高级搜索获得更好的相关性
      maxResults: 10, // 适中的结果数量
      includeRawContent: true, // 包含原始内容以便后处理
      chunksPerSource: 3, // 每个来源3个内容块
      enableQueryValidation: true, // 启用查询验证
      enablePostProcessing: true, // 启用结果后处理
      minScore: 0.3, // 设置最小相关性分数阈值
      ...options // 用户自定义选项覆盖默认值
    };

    return this.search(query, smartOptions);
  }

  /**
   * 测试 API 连接
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.search('test', { maxResults: 1 });
      return true;
    } catch (error) {
      logger.error('连接测试失败:', error);
      return false;
    }
  }
}

/**
 * 创建 Tavily 客户端的工厂函数
 */
export function createTavilyClient(options: TavilyClientOptions): TavilyMobileClient {
  return new TavilyMobileClient(options);
}

/**
 * 简化的 tavily 函数，模拟官方 SDK 接口
 */
export function tavily(options: TavilyClientOptions): TavilyMobileClient {
  return new TavilyMobileClient(options);
}

/**
 * 🚀 实用工具函数 - 根据Tavily最佳实践
 */

/**
 * 从搜索结果中提取特定模式的数据（正则表达式）
 */
export function extractDataFromResults(
  results: TavilySearchResult[],
  patterns: { [key: string]: RegExp }
): { [key: string]: string[] } {
  const extracted: { [key: string]: string[] } = {};

  Object.keys(patterns).forEach(key => {
    extracted[key] = [];
  });

  results.forEach(result => {
    const content = result.content + ' ' + result.title;

    Object.entries(patterns).forEach(([key, pattern]) => {
      const matches = content.match(pattern);
      if (matches) {
        extracted[key].push(...matches);
      }
    });
  });

  // 去重
  Object.keys(extracted).forEach(key => {
    extracted[key] = [...new Set(extracted[key])];
  });

  return extracted;
}

/**
 * 分析搜索结果的质量分布
 */
export function analyzeResultsQuality(results: TavilySearchResult[]): {
  averageScore: number;
  scoreDistribution: { [range: string]: number };
  totalResults: number;
  highQualityResults: number; // score > 0.7
  mediumQualityResults: number; // 0.3 < score <= 0.7
  lowQualityResults: number; // score <= 0.3
} {
  const scores = results.map(r => r.score).filter(s => s !== undefined) as number[];

  if (scores.length === 0) {
    return {
      averageScore: 0,
      scoreDistribution: {},
      totalResults: results.length,
      highQualityResults: 0,
      mediumQualityResults: 0,
      lowQualityResults: 0
    };
  }

  const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;

  const highQuality = scores.filter(s => s > 0.7).length;
  const mediumQuality = scores.filter(s => s > 0.3 && s <= 0.7).length;
  const lowQuality = scores.filter(s => s <= 0.3).length;

  const scoreDistribution: { [range: string]: number } = {
    '0.0-0.3': lowQuality,
    '0.3-0.7': mediumQuality,
    '0.7-1.0': highQuality
  };

  return {
    averageScore: Math.round(averageScore * 1000) / 1000,
    scoreDistribution,
    totalResults: results.length,
    highQualityResults: highQuality,
    mediumQualityResults: mediumQuality,
    lowQualityResults: lowQuality
  };
}

/**
 * 根据Tavily最佳实践优化搜索选项
 */
export function optimizeSearchOptions(
  query: string,
  baseOptions: Partial<TavilySearchOptions> = {}
): TavilySearchOptions {
  const optimized: TavilySearchOptions = {
    enableQueryValidation: true,
    enablePostProcessing: true,
    ...baseOptions
  };

  // 根据查询类型优化参数
  if (query.toLowerCase().includes('news') || query.toLowerCase().includes('latest')) {
    optimized.topic = 'news';
    optimized.days = 7; // 最近一周的新闻
    optimized.timeRange = 'week';
  }

  // 如果查询很具体，使用高级搜索
  if (query.length > 50 || query.includes('"')) {
    optimized.searchDepth = 'advanced';
    optimized.chunksPerSource = 3;
  }

  // 如果查询包含多个概念，增加结果数量
  if (query.split(' ').length > 5) {
    optimized.maxResults = Math.max(optimized.maxResults || 5, 10);
  }

  return optimized;
}

// 默认导出
export default TavilyMobileClient;
