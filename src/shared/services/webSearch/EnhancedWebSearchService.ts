import { v4 as uuidv4 } from 'uuid';
import { tavily } from './TavilyMobileSDK';
import type { WebSearchResult, WebSearchProviderConfig, WebSearchProviderResponse } from '../../types';
import store from '../../store';
import { newMessagesActions } from '../../store/slices/newMessagesSlice';
import { AssistantMessageStatus } from '../../types/newMessage';
import { bingFreeSearchService } from './BingFreeSearchService';
import { Capacitor } from '@capacitor/core';
import { CorsBypass } from 'capacitor-cors-bypass-enhanced';
import { buildCorsProxyRequestUrl } from '../../utils/universalFetch';

/**
 * 增强版网络搜索服务
 * 支持最佳实例的所有搜索提供商，包括API提供商和本地搜索引擎
 */
// 需要 API 密钥才能工作的付费提供商
const API_KEY_REQUIRED_PROVIDERS = ['tavily', 'exa', 'bocha', 'firecrawl'];

class EnhancedWebSearchService {
  /**
   * 获取当前网络搜索状态
   */
  private getWebSearchState() {
    return store.getState().webSearch;
  }

  /**
   * 检查网络搜索功能是否启用
   */
  public isWebSearchEnabled(providerId?: string): boolean {
    const { providers } = this.getWebSearchState();
    const provider = providers.find((provider) => provider.id === providerId);

    if (!provider) {
      return false;
    }

    // 本地搜索提供商（Google、Bing）和免费WebSearch不需要API密钥
    if (provider.id === 'local-google' || provider.id === 'local-bing' || provider.id === 'bing' || provider.id === 'bing-free') {
      return true;
    }

    // Cloudflare AI Search 需要 API 密钥、Account ID 和 AutoRAG 名称
    if (provider.id === 'cloudflare-ai-search') {
      return !!(provider.apiKey && provider.accountId && provider.autoragName);
    }

    // 付费提供商必须配置 API 密钥，不能回退到预置的 apiHost
    if (API_KEY_REQUIRED_PROVIDERS.includes(provider.id)) {
      return !!provider.apiKey;
    }

    // 检查API密钥
    if (provider.apiKey) {
      return provider.apiKey !== '';
    }

    // 检查API主机（用于Searxng等自托管服务）
    if (provider.apiHost) {
      return provider.apiHost !== '';
    }

    // 检查基础认证（用于Searxng）
    if ('basicAuthUsername' in provider && 'basicAuthPassword' in provider) {
      return provider.basicAuthUsername !== '' && provider.basicAuthPassword !== '';
    }

    return false;
  }

  /**
   * 获取网络搜索提供商
   */
  public getWebSearchProvider(providerId?: string): WebSearchProviderConfig | undefined {
    const { providers } = this.getWebSearchState();
    const provider = providers.find((provider) => provider.id === providerId);
    return provider;
  }

  /**
   * 使用指定的提供商执行网络搜索
   */
  public async search(
    provider: WebSearchProviderConfig,
    query: string,
    _httpOptions?: RequestInit
  ): Promise<WebSearchProviderResponse> {
    const websearch = this.getWebSearchState();

    // bing-free 是 HTML 抓取引擎，时间前缀会污染字面查询词（其时效性由 freshness 参数控制）
    let formattedQuery = query;
    if (websearch.searchWithTime && provider.id !== 'bing-free') {
      const today = new Date().toISOString().split('T')[0];
      formattedQuery = `today is ${today} \r\n ${query}`;
    }

    switch (provider.id) {
      case 'bing-free':
        return await this.bingFreeSearch(provider, formattedQuery, websearch);
      case 'tavily':
        return await this.tavilySearch(provider, formattedQuery, websearch);
      case 'exa':
        return await this.exaSearch(provider, formattedQuery, websearch);
      case 'bocha':
        return await this.bochaSearch(provider, formattedQuery, websearch);
      case 'firecrawl':
        return await this.firecrawlSearch(provider, formattedQuery, websearch);
      case 'cloudflare-ai-search':
        return await this.cloudflareAiSearch(provider, formattedQuery, websearch);
      default:
        throw new Error(`不支持的搜索提供商: ${provider.id}`);
    }
  }

  /**
   * 免费Bing搜索实现 - 使用 capacitor-cors-bypass-enhanced 插件
   */
  private async bingFreeSearch(
    _provider: WebSearchProviderConfig,
    query: string,
    websearch: any
  ): Promise<WebSearchProviderResponse> {
    try {
      // 🚀 获取选择的搜索引擎
      const selectedSearchEngine = websearch.selectedSearchEngine || 'bing';
      console.log(`[EnhancedWebSearchService] 开始免费搜索: ${query}，使用搜索引擎: ${selectedSearchEngine}`);

      // 使用免费搜索服务（支持多种搜索引擎）
      const response = await bingFreeSearchService.search({
        query,
        maxResults: websearch.maxResults || 10,
        language: 'zh-CN',
        region: 'CN',
        safeSearch: websearch.filterSafeSearch ? 'moderate' : 'off',
        freshness: websearch.searchWithTime ? 'week' : undefined,
        timeout: 30000,
        fetchContent: true, // 启用内容抓取，提供更丰富的搜索结果
        maxContentLength: 1500, // 限制每个页面内容长度
        searchEngine: selectedSearchEngine // 🚀 新增：传递搜索引擎参数
      });

      // 转换结果格式，包含抓取的内容
      const results: WebSearchResult[] = response.results.map((result) => {
        // 将抓取的内容合并到snippet中，提供更丰富的上下文
        let enhancedSnippet = result.snippet;
        if (result.content && result.content !== '跳过此类型的链接' && result.content !== '内容解析失败') {
          enhancedSnippet = `${result.snippet}\n\n页面内容摘要:\n${result.content}`;
        }

        return {
          id: result.id,
          title: result.title,
          url: result.url,
          snippet: enhancedSnippet,
          timestamp: result.timestamp,
          provider: 'bing-free', // 🚀 保持原有的provider名称，避免匹配问题
          score: result.score
        };
      });

      console.log(`[EnhancedWebSearchService] 免费${selectedSearchEngine}搜索完成，找到 ${results.length} 个结果`);
      return { results };
    } catch (error: any) {
      console.error('[EnhancedWebSearchService] 免费Bing搜索失败:', error);
      throw new Error(`免费搜索失败: ${error.message}`);
    }
  }

  /**
   * Tavily搜索实现 - 使用移动端兼容的SDK
   */
  private async tavilySearch(
    provider: WebSearchProviderConfig,
    query: string,
    websearch: any
  ): Promise<WebSearchProviderResponse> {
    try {
      if (!provider.apiKey) {
        throw new Error('Tavily API密钥未配置');
      }

      console.log(`[EnhancedWebSearchService] 开始Tavily移动端SDK搜索: ${query}`);

      // 创建移动端兼容的Tavily客户端
      const tvly = tavily({ apiKey: provider.apiKey });

      // 使用移动端SDK进行搜索，参数来自用户设置
      const searchDepth = websearch.searchDepth || 'basic';
      const response = await tvly.search(query, {
        searchDepth,
        includeAnswer: websearch.includeAnswer ?? false,
        includeImages: false,
        includeRawContent: websearch.includeRawContent ?? false,
        maxResults: Math.min(websearch.maxResults || 5, 10), // 限制在10以内，提高相关性
        // chunksPerSource 仅在 advanced 深度下生效
        ...(searchDepth === 'advanced' ? { chunksPerSource: websearch.chunksPerSource || 3 } : {}),
        excludeDomains: websearch.excludeDomains || []
      });

      // 转换结果格式 - 优化内容处理和编码
      const results: WebSearchResult[] = response.results?.map((result: any) => {
        // 🚀 优先使用原始内容，如果没有则使用摘要内容
        let content = result.raw_content || result.content || '';

        // 🚀 清理和规范化内容，移除可能的乱码
        content = content
          // eslint-disable-next-line no-control-regex
          .replace(/[\x00-\x1F\x7F-\x9F]/g, '') // 移除控制字符
          .replace(/\s+/g, ' ') // 规范化空白字符
          .trim();

        // 🚀 如果内容过长，智能截取（保持完整句子）
        if (content.length > 500) {
          const sentences = content.split(/[.!?。！？]/);
          let truncated = '';
          for (const sentence of sentences) {
            if ((truncated + sentence).length > 450) break;
            truncated += sentence + '。';
          }
          content = truncated || content.substring(0, 500) + '...';
        }

        // 🚀 清理标题，移除可能的HTML标签和特殊字符
        const title = (result.title || '')
          .replace(/<[^>]*>/g, '') // 移除HTML标签
          // eslint-disable-next-line no-control-regex
          .replace(/[\x00-\x1F\x7F-\x9F]/g, '') // 移除控制字符
          .trim();

        return {
          id: uuidv4(),
          title: title || '无标题',
          url: result.url || '',
          snippet: content,
          timestamp: new Date().toISOString(),
          provider: 'tavily',
          score: result.score || 0 // 🚀 保留相关性评分
        };
      }) || [];

      console.log(`[EnhancedWebSearchService] Tavily移动端SDK搜索完成，找到 ${results.length} 个结果`);
      return { results };
    } catch (error: any) {
      console.error('[EnhancedWebSearchService] Tavily移动端SDK搜索失败:', error);
      throw new Error(`Tavily搜索失败: ${error.message}`);
    }
  }



  /**
   * Exa搜索实现 - 支持移动端和Web端
   */
  private async exaSearch(
    provider: WebSearchProviderConfig,
    query: string,
    websearch: any
  ): Promise<WebSearchProviderResponse> {
    try {
      if (!provider.apiKey) {
        throw new Error('Exa API密钥未配置');
      }

      console.log(`[EnhancedWebSearchService] 开始Exa搜索: ${query}`);

      const requestBody = {
        query,
        numResults: websearch.maxResults || 10,
        type: 'neural',
        useAutoprompt: true,
        contents: {
          text: true
        }
      };

      let response: any;

      if (Capacitor.isNativePlatform()) {
        // 移动端使用 CorsBypass 插件直接请求 Exa API
        console.log('[EnhancedWebSearchService] 移动端使用 CorsBypass 插件请求 Exa API');

        response = await CorsBypass.request({
          url: 'https://api.exa.ai/search',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': provider.apiKey
          },
          data: requestBody,
          timeout: 30000,
          responseType: 'json'
        });

        if (response.status >= 400) {
          throw new Error(`Exa API error: ${response.status}`);
        }

        // CorsBypass 返回的数据结构
        const data = response.data;
        const results: WebSearchResult[] = data.results?.map((result: any) => ({
          id: uuidv4(),
          title: result.title || '',
          url: result.url || '',
          snippet: result.text || '',
          timestamp: new Date().toISOString(),
          provider: 'exa'
        })) || [];

        console.log(`[EnhancedWebSearchService] Exa搜索完成，找到 ${results.length} 个结果`);
        return { results };
      } else {
        // Web端使用通用 CORS 代理
        console.log('[EnhancedWebSearchService] Web端使用 CORS 代理请求 Exa API');
        
        const exaApiUrl = 'https://api.exa.ai/search';
        const proxyUrl = buildCorsProxyRequestUrl(exaApiUrl);

        response = await fetch(proxyUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': provider.apiKey
          },
          body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
          throw new Error(`Exa API error: ${response.status}`);
        }

        const data = await response.json();
        const results: WebSearchResult[] = data.results?.map((result: any) => ({
          id: uuidv4(),
          title: result.title || '',
          url: result.url || '',
          snippet: result.text || '',
          timestamp: new Date().toISOString(),
          provider: 'exa'
        })) || [];

        console.log(`[EnhancedWebSearchService] Exa搜索完成，找到 ${results.length} 个结果`);
        return { results };
      }
    } catch (error: any) {
      console.error('[EnhancedWebSearchService] Exa搜索失败:', error);
      throw new Error(`Exa搜索失败: ${error.message}`);
    }
  }

  /**
   * Bocha搜索实现 - 支持移动端和Web端
   */
  private async bochaSearch(
    provider: WebSearchProviderConfig,
    query: string,
    websearch: any
  ): Promise<WebSearchProviderResponse> {
    try {
      if (!provider.apiKey) {
        throw new Error('Bocha API密钥未配置');
      }

      console.log(`[EnhancedWebSearchService] 开始Bocha搜索: ${query}`);

      const requestBody = {
        query,
        count: websearch.maxResults || 10,
        exclude: websearch.excludeDomains?.join(',') || '',
        freshness: websearch.searchWithTime ? 'oneDay' : 'noLimit',
        summary: false
      };

      let response: any;

      if (Capacitor.isNativePlatform()) {
        // 移动端使用 CorsBypass 插件直接请求 Bocha API
        console.log('[EnhancedWebSearchService] 移动端使用 CorsBypass 插件请求 Bocha API');

        response = await CorsBypass.request({
          url: 'https://api.bochaai.com/v1/web-search',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${provider.apiKey}`
          },
          data: requestBody,
          timeout: 30000,
          responseType: 'json'
        });

        if (response.status >= 400) {
          throw new Error(`Bocha API error: ${response.status}`);
        }

        // CorsBypass 返回的数据结构
        const data = response.data;
        // 博查API返回的数据结构：data.data.webPages.value
        const webPages = data.data?.webPages?.value || [];
        const results: WebSearchResult[] = webPages.map((result: any) => ({
          id: uuidv4(),
          title: result.name || '',
          url: result.url || '',
          snippet: result.snippet || '',
          timestamp: new Date().toISOString(),
          provider: 'bocha'
        }));

        console.log(`[EnhancedWebSearchService] Bocha搜索完成，找到 ${results.length} 个结果`);
        return { results };
      } else {
        // Web端使用通用 CORS 代理
        console.log('[EnhancedWebSearchService] Web端使用 CORS 代理请求 Bocha API');
        
        const bochaApiUrl = 'https://api.bochaai.com/v1/web-search';
        const proxyUrl = buildCorsProxyRequestUrl(bochaApiUrl);

        response = await fetch(proxyUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${provider.apiKey}`
          },
          body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
          throw new Error(`Bocha API error: ${response.status}`);
        }

        const data = await response.json();
        // 博查API返回的数据结构：data.data.webPages.value
        const webPages = data.data?.webPages?.value || [];
        const results: WebSearchResult[] = webPages.map((result: any) => ({
          id: uuidv4(),
          title: result.name || '',
          url: result.url || '',
          snippet: result.snippet || '',
          timestamp: new Date().toISOString(),
          provider: 'bocha'
        }));

        console.log(`[EnhancedWebSearchService] Bocha搜索完成，找到 ${results.length} 个结果`);
        return { results };
      }
    } catch (error: any) {
      console.error('[EnhancedWebSearchService] Bocha搜索失败:', error);
      throw new Error(`Bocha搜索失败: ${error.message}`);
    }
  }

  /**
   * Firecrawl搜索实现 - 支持移动端和Web端
   */
  private async firecrawlSearch(
    provider: WebSearchProviderConfig,
    query: string,
    websearch: any
  ): Promise<WebSearchProviderResponse> {
    try {
      if (!provider.apiKey) {
        throw new Error('Firecrawl API密钥未配置');
      }

      console.log(`[EnhancedWebSearchService] 开始Firecrawl搜索: ${query}`);

      const requestBody = {
        query,
        limit: websearch.maxResults || 10
      };

      let response: any;

      if (Capacitor.isNativePlatform()) {
        // 移动端使用 CorsBypass 插件直接请求 Firecrawl API
        console.log('[EnhancedWebSearchService] 移动端使用 CorsBypass 插件请求 Firecrawl API');

        response = await CorsBypass.request({
          url: 'https://api.firecrawl.dev/v1/search',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${provider.apiKey}`
          },
          data: requestBody,
          timeout: 30000,
          responseType: 'json'
        });

        if (response.status >= 400) {
          throw new Error(`Firecrawl API error: ${response.status}`);
        }

        // CorsBypass 返回的数据结构
        const data = response.data;
        const results: WebSearchResult[] = data.data?.map((result: any) => ({
          id: uuidv4(),
          title: result.metadata?.title || result.url || '',
          url: result.url || '',
          snippet: result.markdown?.substring(0, 200) || '',
          timestamp: new Date().toISOString(),
          provider: 'firecrawl',
          content: result.markdown
        })) || [];

        console.log(`[EnhancedWebSearchService] Firecrawl搜索完成，找到 ${results.length} 个结果`);
        return { results };
      } else {
        // Web端使用通用 CORS 代理
        console.log('[EnhancedWebSearchService] Web端使用 CORS 代理请求 Firecrawl API');
        
        const firecrawlApiUrl = 'https://api.firecrawl.dev/v1/search';
        const proxyUrl = buildCorsProxyRequestUrl(firecrawlApiUrl);

        response = await fetch(proxyUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${provider.apiKey}`
          },
          body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
          throw new Error(`Firecrawl API error: ${response.status}`);
        }

        const data = await response.json();
        const results: WebSearchResult[] = data.data?.map((result: any) => ({
          id: uuidv4(),
          title: result.metadata?.title || result.url || '',
          url: result.url || '',
          snippet: result.markdown?.substring(0, 200) || '',
          timestamp: new Date().toISOString(),
          provider: 'firecrawl',
          content: result.markdown
        })) || [];

        console.log(`[EnhancedWebSearchService] Firecrawl搜索完成，找到 ${results.length} 个结果`);
        return { results };
      }
    } catch (error: any) {
      console.error('[EnhancedWebSearchService] Firecrawl搜索失败:', error);
      throw new Error(`Firecrawl搜索失败: ${error.message}`);
    }
  }

  /**
   * Cloudflare AI Search 搜索实现 - 支持移动端和Web端
   */
  private async cloudflareAiSearch(
    provider: WebSearchProviderConfig,
    query: string,
    websearch: any
  ): Promise<WebSearchProviderResponse> {
    try {
      if (!provider.apiKey) {
        throw new Error('Cloudflare AI Search API密钥未配置');
      }

      if (!provider.accountId) {
        throw new Error('Cloudflare Account ID 未配置');
      }

      if (!provider.autoragName) {
        throw new Error('Cloudflare AutoRAG 名称未配置');
      }

      console.log(`[EnhancedWebSearchService] 开始Cloudflare AI Search搜索: ${query}`);

      const requestBody = {
        query,
        max_num_results: Math.min(websearch.maxResults || 10, 50),
        rewrite_query: true, // 启用查询重写以提高检索准确性
        ranking_options: {
          score_threshold: websearch.minScore || 0.3
        },
        reranking: {
          enabled: true,
          model: '@cf/baai/bge-reranker-base'
        }
      };

      let response: any;
      const apiUrl = `https://api.cloudflare.com/client/v4/accounts/${provider.accountId}/autorag/rags/${provider.autoragName}/search`;

      if (Capacitor.isNativePlatform()) {
        // 移动端使用 CorsBypass 插件直接请求 Cloudflare API
        console.log('[EnhancedWebSearchService] 移动端使用 CorsBypass 插件请求 Cloudflare AI Search API');

        response = await CorsBypass.request({
          url: apiUrl,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${provider.apiKey}`
          },
          data: requestBody,
          timeout: 30000,
          responseType: 'json'
        });

        if (response.status >= 400) {
          throw new Error(`Cloudflare AI Search API error: ${response.status}`);
        }

        // CorsBypass 返回的数据结构
        const data = response.data;

        // 处理 Cloudflare AI Search 响应
        if (!data.success) {
          throw new Error('Cloudflare AI Search API 返回失败状态');
        }

        const searchResults = data.result?.data || [];
        const results: WebSearchResult[] = searchResults.map((result: any) => {
          // 提取内容
          const contentParts = result.content?.map((c: any) => c.text).filter(Boolean) || [];
          const snippet = contentParts.join(' ').substring(0, 500);

          // 使用 modified_date 作为时间戳（如果存在）
          let timestamp = new Date().toISOString();
          if (result.attributes?.modified_date) {
            timestamp = new Date(result.attributes.modified_date).toISOString();
          }

          // 构建标题：优先使用文件名，包含文件夹信息
          let title = result.filename || '无标题';
          if (result.attributes?.folder) {
            title = `${result.attributes.folder}${result.filename || ''}`;
          }

          return {
            id: result.file_id || uuidv4(), // 使用官方提供的 file_id
            title: title,
            url: result.filename || '', // Cloudflare 返回文件名而非URL
            snippet: snippet || '无内容',
            timestamp: timestamp,
            provider: 'cloudflare-ai-search',
            score: result.score || 0,
            content: contentParts.join('\n\n')
          };
        });

        console.log(`[EnhancedWebSearchService] Cloudflare AI Search搜索完成，找到 ${results.length} 个结果`);
        return { results };
      } else {
        // Web端使用通用 CORS 代理
        console.log('[EnhancedWebSearchService] Web端使用 CORS 代理请求 Cloudflare AI Search API');
        
        const proxyUrl = buildCorsProxyRequestUrl(apiUrl);

        response = await fetch(proxyUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${provider.apiKey}`
          },
          body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
          throw new Error(`Cloudflare AI Search API error: ${response.status}`);
        }

        const data = await response.json();

        // 处理 Cloudflare AI Search 响应
        if (!data.success) {
          throw new Error('Cloudflare AI Search API 返回失败状态');
        }

        const searchResults = data.result?.data || [];
        const results: WebSearchResult[] = searchResults.map((result: any) => {
          // 提取内容
          const contentParts = result.content?.map((c: any) => c.text).filter(Boolean) || [];
          const snippet = contentParts.join(' ').substring(0, 500);

          // 使用 modified_date 作为时间戳（如果存在）
          let timestamp = new Date().toISOString();
          if (result.attributes?.modified_date) {
            timestamp = new Date(result.attributes.modified_date).toISOString();
          }

          // 构建标题：优先使用文件名，包含文件夹信息
          let title = result.filename || '无标题';
          if (result.attributes?.folder) {
            title = `${result.attributes.folder}${result.filename || ''}`;
          }

          return {
            id: result.file_id || uuidv4(), // 使用官方提供的 file_id
            title: title,
            url: result.filename || '', // Cloudflare 返回文件名而非URL
            snippet: snippet || '无内容',
            timestamp: timestamp,
            provider: 'cloudflare-ai-search',
            score: result.score || 0,
            content: contentParts.join('\n\n')
          };
        });

        console.log(`[EnhancedWebSearchService] Cloudflare AI Search搜索完成，找到 ${results.length} 个结果`);
        return { results };
      }
    } catch (error: any) {
      console.error('[EnhancedWebSearchService] Cloudflare AI Search搜索失败:', error);
      throw new Error(`Cloudflare AI Search搜索失败: ${error.message}`);
    }
  }

  /**
   * 使用SEARCHING状态执行搜索
   */
  public async searchWithStatus(query: string, topicId: string, messageId: string): Promise<WebSearchResult[]> {
    const updateStatus = (status: AssistantMessageStatus) => {
      store.dispatch(newMessagesActions.updateMessageStatus({ topicId, messageId, status }));
    };

    try {
      updateStatus(AssistantMessageStatus.SEARCHING);

      // 获取当前选择的提供商
      const websearch = this.getWebSearchState();
      const provider = this.getWebSearchProvider(websearch.provider);

      if (!provider) {
        throw new Error('未找到搜索提供商');
      }

      // 执行搜索
      const response = await this.search(provider, query);
      updateStatus(AssistantMessageStatus.SUCCESS);
      return response.results;
    } catch (error) {
      updateStatus(AssistantMessageStatus.ERROR);
      throw error;
    }
  }

  /**
   * 检查搜索提供商是否正常工作
   */
  public async checkSearch(provider: WebSearchProviderConfig): Promise<{ valid: boolean; error?: any }> {
    try {
      const response = await this.search(provider, 'test query');
      return { valid: response.results !== undefined, error: undefined };
    } catch (error) {
      return { valid: false, error };
    }
  }
}

// 导出单例实例
export default new EnhancedWebSearchService();
