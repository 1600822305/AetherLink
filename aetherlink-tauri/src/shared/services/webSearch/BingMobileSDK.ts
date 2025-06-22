/**
 * 免费Bing搜索SDK - 移动端兼容
 * 通过直接调用Bing搜索接口，避免CORS限制
 * 无需API密钥，完全免费使用
 */

export interface BingSearchOptions {
  maxResults?: number;
  language?: string;
  region?: string;
  safeSearch?: 'off' | 'moderate' | 'strict';
  timeRange?: 'day' | 'week' | 'month' | 'year';
  freshness?: 'day' | 'week' | 'month';
  enableSpellCheck?: boolean;
  enableAutoCorrect?: boolean;
}

export interface BingSearchResult {
  title: string;
  url: string;
  content: string;
  snippet: string;
  displayUrl: string;
  datePublished?: string;
  provider: string;
  score?: number;
}

export interface BingSearchResponse {
  query: string;
  results: BingSearchResult[];
  totalResults?: number;
  responseTime: number;
  suggestions?: string[];
  relatedSearches?: string[];
}

export interface BingClientOptions {
  timeout?: number;
  userAgent?: string;
  enableCache?: boolean;
}

/**
 * 免费Bing搜索客户端
 * 通过解析Bing搜索页面获取结果，完全免费且无需API密钥
 */
export class BingMobileClient {
  private timeout: number;
  private userAgent: string;
  private enableCache: boolean;
  private cache: Map<string, { data: BingSearchResponse; timestamp: number }>;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存

  constructor(options: BingClientOptions = {}) {
    this.timeout = options.timeout || 30000;
    this.userAgent = options.userAgent || 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
    this.enableCache = options.enableCache !== false;
    this.cache = new Map();
  }

  /**
   * 执行Bing搜索
   */
  async search(query: string, options: BingSearchOptions = {}): Promise<BingSearchResponse> {
    const startTime = Date.now();
    
    try {
      console.log(`[BingMobileSDK] 开始搜索: ${query}`);

      // 检查缓存
      if (this.enableCache) {
        const cacheKey = this.getCacheKey(query, options);
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
          console.log(`[BingMobileSDK] 使用缓存结果`);
          return cached.data;
        }
      }

      // 构建搜索URL
      const searchUrl = this.buildSearchUrl(query, options);
      
      // 发起请求
      const response = await fetch(searchUrl, {
        method: 'GET',
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': options.language || 'zh-CN,zh;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
        signal: AbortSignal.timeout(this.timeout)
      });

      if (!response.ok) {
        throw new Error(`Bing搜索请求失败: ${response.status} - ${response.statusText}`);
      }

      const html = await response.text();
      const searchResults = this.parseSearchResults(html, query);
      
      const responseTime = Date.now() - startTime;
      
      const result: BingSearchResponse = {
        query,
        results: searchResults.slice(0, options.maxResults || 10),
        totalResults: searchResults.length,
        responseTime,
        suggestions: this.extractSuggestions(html),
        relatedSearches: this.extractRelatedSearches(html)
      };

      // 缓存结果
      if (this.enableCache) {
        const cacheKey = this.getCacheKey(query, options);
        this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
        
        // 清理过期缓存
        this.cleanExpiredCache();
      }

      console.log(`[BingMobileSDK] 搜索完成，找到 ${result.results.length} 个结果，耗时 ${responseTime}ms`);
      
      return result;

    } catch (error: any) {
      console.error('[BingMobileSDK] 搜索失败:', error);

      if (error.name === 'AbortError') {
        throw new Error('Bing搜索请求超时');
      }

      throw new Error(`Bing搜索失败: ${error.message}`);
    }
  }

  /**
   * 构建搜索URL
   */
  private buildSearchUrl(query: string, options: BingSearchOptions): string {
    const params = new URLSearchParams();
    
    // 基本搜索参数
    params.set('q', query);
    params.set('PC', 'MOZI'); // 移动端标识
    params.set('form', 'QBLH'); // Bing移动端表单
    
    // 安全搜索
    if (options.safeSearch) {
      const safeSearchMap = { 'off': 'Off', 'moderate': 'Moderate', 'strict': 'Strict' };
      params.set('safeSearch', safeSearchMap[options.safeSearch]);
    }
    
    // 时间范围
    if (options.timeRange || options.freshness) {
      const timeRange = options.timeRange || options.freshness;
      const timeMap: Record<string, string> = { 'day': 'd', 'week': 'w', 'month': 'm', 'year': 'y' };
      if (timeRange && timeMap[timeRange]) {
        params.set('qft', `+filterui:age-lt${timeMap[timeRange]}`);
      }
    }
    
    // 语言和地区
    if (options.language) {
      params.set('setlang', options.language);
    }
    if (options.region) {
      params.set('cc', options.region);
    }

    // 结果数量（通过分页控制）
    if (options.maxResults && options.maxResults > 10) {
      params.set('count', Math.min(options.maxResults, 50).toString());
    }

    return `https://www.bing.com/search?${params.toString()}`;
  }

  /**
   * 解析搜索结果
   */
  private parseSearchResults(html: string, query: string): BingSearchResult[] {
    const results: BingSearchResult[] = [];
    
    try {
      // 使用正则表达式解析HTML中的搜索结果
      // Bing搜索结果通常在 <li class="b_algo"> 标签中
      const resultPattern = /<li class="b_algo"[^>]*>(.*?)<\/li>/gs;
      const titlePattern = /<h2[^>]*><a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a><\/h2>/s;
      const snippetPattern = /<p class="b_lineclamp[^"]*"[^>]*>(.*?)<\/p>/s;
      const displayUrlPattern = /<cite[^>]*>([^<]*)<\/cite>/s;
      
      let match;
      let index = 0;
      
      while ((match = resultPattern.exec(html)) !== null && index < 50) {
        const resultHtml = match[1];
        
        // 提取标题和URL
        const titleMatch = titlePattern.exec(resultHtml);
        if (!titleMatch) continue;
        
        const url = this.cleanUrl(titleMatch[1]);
        const title = this.cleanText(titleMatch[2]);
        
        // 提取摘要
        const snippetMatch = snippetPattern.exec(resultHtml);
        const snippet = snippetMatch ? this.cleanText(snippetMatch[1]) : '';
        
        // 提取显示URL
        const displayUrlMatch = displayUrlPattern.exec(resultHtml);
        const displayUrl = displayUrlMatch ? this.cleanText(displayUrlMatch[1]) : url;
        
        // 跳过无效结果
        if (!title || !url || url.includes('javascript:') || url.startsWith('#')) {
          continue;
        }
        
        results.push({
          title,
          url,
          content: snippet,
          snippet,
          displayUrl,
          provider: 'bing',
          score: this.calculateRelevanceScore(title, snippet, query)
        });
        
        index++;
      }
      
    } catch (error) {
      console.error('[BingMobileSDK] 解析搜索结果失败:', error);
    }
    
    return results;
  }

  /**
   * 提取搜索建议
   */
  private extractSuggestions(html: string): string[] {
    const suggestions: string[] = [];
    
    try {
      // Bing的搜索建议通常在特定的JSON结构中
      const suggestionPattern = /"AS":\s*\{[^}]*"Results":\s*\[(.*?)\]/s;
      const match = suggestionPattern.exec(html);
      
      if (match) {
        const suggestionsJson = match[1];
        const suggestionItems = suggestionsJson.match(/"Txt":"([^"]*)"/g);
        
        if (suggestionItems) {
          suggestionItems.forEach(item => {
            const textMatch = /"Txt":"([^"]*)"/.exec(item);
            if (textMatch) {
              suggestions.push(this.cleanText(textMatch[1]));
            }
          });
        }
      }
    } catch (error) {
      console.error('[BingMobileSDK] 提取搜索建议失败:', error);
    }
    
    return suggestions.slice(0, 5);
  }

  /**
   * 提取相关搜索
   */
  private extractRelatedSearches(html: string): string[] {
    const relatedSearches: string[] = [];
    
    try {
      // Bing的相关搜索通常在页面底部
      const relatedPattern = /<div class="b_rs"[^>]*>.*?<ul[^>]*>(.*?)<\/ul>/s;
      const match = relatedPattern.exec(html);
      
      if (match) {
        const relatedHtml = match[1];
        const linkPattern = /<a[^>]*>([^<]*)<\/a>/g;
        let linkMatch;
        
        while ((linkMatch = linkPattern.exec(relatedHtml)) !== null) {
          const text = this.cleanText(linkMatch[1]);
          if (text && !relatedSearches.includes(text)) {
            relatedSearches.push(text);
          }
        }
      }
    } catch (error) {
      console.error('[BingMobileSDK] 提取相关搜索失败:', error);
    }
    
    return relatedSearches.slice(0, 8);
  }

  /**
   * 清理文本内容
   */
  private cleanText(text: string): string {
    return text
      .replace(/<[^>]*>/g, '') // 移除HTML标签
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * 清理URL
   */
  private cleanUrl(url: string): string {
    // 移除Bing的重定向包装
    if (url.includes('bing.com/ck/a?')) {
      const urlMatch = /&u=([^&]*)/.exec(url);
      if (urlMatch) {
        try {
          return decodeURIComponent(urlMatch[1]);
        } catch {
          return url;
        }
      }
    }
    
    return url;
  }

  /**
   * 计算相关性分数
   */
  private calculateRelevanceScore(title: string, snippet: string, query: string): number {
    const queryTerms = query.toLowerCase().split(/\s+/);
    const titleLower = title.toLowerCase();
    const snippetLower = snippet.toLowerCase();
    
    let score = 0;
    
    queryTerms.forEach(term => {
      if (titleLower.includes(term)) score += 0.3;
      if (snippetLower.includes(term)) score += 0.1;
    });
    
    return Math.min(score, 1.0);
  }

  /**
   * 生成缓存键
   */
  private getCacheKey(query: string, options: BingSearchOptions): string {
    return `${query}_${JSON.stringify(options)}`;
  }

  /**
   * 清理过期缓存
   */
  private cleanExpiredCache(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.CACHE_DURATION) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * 测试连接
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.search('test', { maxResults: 1 });
      return true;
    } catch (error) {
      console.error('[BingMobileSDK] 连接测试失败:', error);
      return false;
    }
  }

  /**
   * 清理缓存
   */
  clearCache(): void {
    this.cache.clear();
  }
}

/**
 * 创建Bing客户端的工厂函数
 */
export function createBingClient(options: BingClientOptions = {}): BingMobileClient {
  return new BingMobileClient(options);
}

/**
 * 简化的bing函数
 */
export function bing(options: BingClientOptions = {}): BingMobileClient {
  return new BingMobileClient(options);
}

// 默认导出
export default BingMobileClient;
