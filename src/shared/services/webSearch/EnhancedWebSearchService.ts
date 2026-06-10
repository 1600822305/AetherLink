import { v4 as uuidv4 } from 'uuid';
import { tavily } from './TavilyMobileSDK';
import type { WebSearchResult, WebSearchProviderConfig, WebSearchProviderResponse } from '../../types';
import store from '../../store';
import { newMessagesActions } from '../../store/slices/newMessagesSlice';
import { AssistantMessageStatus } from '../../types/newMessage';
import { bingFreeSearchService } from './BingFreeSearchService';
import { searchHttpRequest } from './httpClient';
import { customProviderToConfig, isCustomProviderConfigured, executeProtocolSearch } from './customProtocols';

/**
 * 增强版网络搜索服务
 * 支持最佳实例的所有搜索提供商，包括API提供商和本地搜索引擎
 */
// 需要 API 密钥才能工作的付费提供商
const API_KEY_REQUIRED_PROVIDERS = ['tavily', 'exa', 'bocha', 'firecrawl', 'zhipu', 'jina', 'querit'];

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
    const { providers, customProviders } = this.getWebSearchState();
    const provider = providers.find((provider) => provider.id === providerId);

    if (!provider) {
      // 自定义提供商：由对应协议适配器判断配置是否完整
      const customProvider = (customProviders || []).find((p) => p.id === providerId);
      if (customProvider) {
        return customProvider.enabled && isCustomProviderConfigured(customProvider);
      }
      return false;
    }

    // 本地搜索提供商（Google、Bing）和免费WebSearch不需要API密钥
    if (provider.id === 'local-google' || provider.id === 'local-bing' || provider.id === 'bing' || provider.id === 'bing-free' || provider.id === 'exa-mcp') {
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
    const { providers, customProviders } = this.getWebSearchState();
    const provider = providers.find((provider) => provider.id === providerId);
    if (provider) {
      return provider;
    }
    // 自定义提供商映射为统一配置，走与内置提供商相同的执行管线
    const customProvider = (customProviders || []).find((p) => p.id === providerId);
    return customProvider ? customProviderToConfig(customProvider) : undefined;
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
      case 'zhipu':
        return await this.zhipuSearch(provider, formattedQuery, websearch);
      case 'jina':
        return await this.jinaSearch(provider, formattedQuery, websearch);
      case 'querit':
        return await this.queritSearch(provider, formattedQuery, websearch);
      case 'exa-mcp':
        return await this.exaMcpSearch(provider, formattedQuery, websearch);
      default: {
        // 自定义提供商：通过协议适配器执行（searxng / tavily-compatible / custom-json）
        const results = await executeProtocolSearch(provider, formattedQuery, websearch.maxResults || 10);
        return { results };
      }
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

      const { data } = await searchHttpRequest({
        url: 'https://api.exa.ai/search',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': provider.apiKey
        },
        body: requestBody
      });

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

      const { data } = await searchHttpRequest({
        url: 'https://api.bochaai.com/v1/web-search',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${provider.apiKey}`
        },
        body: requestBody
      });

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

      const { data } = await searchHttpRequest({
        url: 'https://api.firecrawl.dev/v1/search',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${provider.apiKey}`
        },
        body: requestBody
      });

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

      const apiUrl = `https://api.cloudflare.com/client/v4/accounts/${provider.accountId}/autorag/rags/${provider.autoragName}/search`;

      const { data } = await searchHttpRequest({
        url: apiUrl,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${provider.apiKey}`
        },
        body: requestBody
      });

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
    } catch (error: any) {
      console.error('[EnhancedWebSearchService] Cloudflare AI Search搜索失败:', error);
      throw new Error(`Cloudflare AI Search搜索失败: ${error.message}`);
    }
  }

  /**
   * Zhipu 智谱搜索实现
   */
  private async zhipuSearch(
    provider: WebSearchProviderConfig,
    query: string,
    websearch: any
  ): Promise<WebSearchProviderResponse> {
    try {
      if (!provider.apiKey) {
        throw new Error('Zhipu API密钥未配置');
      }

      console.log(`[EnhancedWebSearchService] 开始Zhipu搜索: ${query}`);

      const { data } = await searchHttpRequest({
        url: provider.apiHost || 'https://open.bigmodel.cn/api/paas/v4/web_search',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${provider.apiKey}`
        },
        body: {
          search_query: query,
          search_engine: 'search_std',
          search_intent: false
        }
      });

      const maxResults = websearch.maxResults || 10;
      const results: WebSearchResult[] = (data.search_result || []).slice(0, maxResults).map((result: any) => ({
        id: uuidv4(),
        title: (result.title || '').trim(),
        url: result.link || '',
        snippet: (result.content || '').trim(),
        timestamp: new Date().toISOString(),
        provider: 'zhipu'
      }));

      console.log(`[EnhancedWebSearchService] Zhipu搜索完成，找到 ${results.length} 个结果`);
      return { results };
    } catch (error: any) {
      console.error('[EnhancedWebSearchService] Zhipu搜索失败:', error);
      throw new Error(`Zhipu搜索失败: ${error.message}`, { cause: error });
    }
  }

  /**
   * Jina 搜索实现（s.jina.ai）
   */
  private async jinaSearch(
    provider: WebSearchProviderConfig,
    query: string,
    websearch: any
  ): Promise<WebSearchProviderResponse> {
    try {
      if (!provider.apiKey) {
        throw new Error('Jina API密钥未配置');
      }

      console.log(`[EnhancedWebSearchService] 开始Jina搜索: ${query}`);

      const baseUrl = (provider.apiHost || 'https://s.jina.ai').replace(/\/+$/, '');
      const { data } = await searchHttpRequest({
        url: `${baseUrl}/${encodeURIComponent(query.trim())}`,
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${provider.apiKey}`
        }
      });

      const maxResults = websearch.maxResults || 10;
      const items = data.data || data.results || [];
      const results: WebSearchResult[] = items.slice(0, maxResults).map((result: any) => ({
        id: uuidv4(),
        title: (result.title || '').trim(),
        url: result.url || '',
        snippet: (result.content || result.description || '').trim(),
        timestamp: new Date().toISOString(),
        provider: 'jina'
      }));

      console.log(`[EnhancedWebSearchService] Jina搜索完成，找到 ${results.length} 个结果`);
      return { results };
    } catch (error: any) {
      console.error('[EnhancedWebSearchService] Jina搜索失败:', error);
      throw new Error(`Jina搜索失败: ${error.message}`, { cause: error });
    }
  }

  /**
   * Querit 搜索实现
   */
  private async queritSearch(
    provider: WebSearchProviderConfig,
    query: string,
    websearch: any
  ): Promise<WebSearchProviderResponse> {
    try {
      if (!provider.apiKey) {
        throw new Error('Querit API密钥未配置');
      }

      console.log(`[EnhancedWebSearchService] 开始Querit搜索: ${query}`);

      const requestBody: any = {
        query,
        count: websearch.maxResults || 10
      };
      if (websearch.excludeDomains?.length) {
        requestBody.filters = { sites: { exclude: websearch.excludeDomains } };
      }

      const baseUrl = (provider.apiHost || 'https://api.querit.ai').replace(/\/+$/, '');
      const { data } = await searchHttpRequest({
        url: `${baseUrl}/v1/search`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${provider.apiKey}`
        },
        body: requestBody
      });

      if (data.error_code !== undefined && data.error_code !== 200) {
        throw new Error(data.error_msg || `错误码 ${data.error_code}`);
      }

      const items = data.results?.result || [];
      const results: WebSearchResult[] = items.map((result: any) => ({
        id: uuidv4(),
        title: result.title || '',
        url: result.url || '',
        snippet: result.snippet || '',
        timestamp: new Date().toISOString(),
        provider: 'querit'
      }));

      console.log(`[EnhancedWebSearchService] Querit搜索完成，找到 ${results.length} 个结果`);
      return { results };
    } catch (error: any) {
      console.error('[EnhancedWebSearchService] Querit搜索失败:', error);
      throw new Error(`Querit搜索失败: ${error.message}`, { cause: error });
    }
  }

  /**
   * Exa MCP 搜索实现（免密钥，JSON-RPC over HTTP，响应可能为 SSE 文本）
   */
  private async exaMcpSearch(
    provider: WebSearchProviderConfig,
    query: string,
    websearch: any
  ): Promise<WebSearchProviderResponse> {
    try {
      console.log(`[EnhancedWebSearchService] 开始Exa MCP搜索: ${query}`);

      const maxResults = websearch.maxResults || 10;
      const { data } = await searchHttpRequest({
        url: provider.apiHost || 'https://mcp.exa.ai/mcp',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream'
        },
        body: {
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: {
            name: 'web_search_exa',
            arguments: {
              query,
              type: 'auto',
              numResults: maxResults,
              livecrawl: 'fallback'
            }
          }
        },
        timeout: 25000,
        responseType: 'text'
      });

      const responseText = typeof data === 'string' ? data : JSON.stringify(data);
      const items = this.parseExaMcpResponse(responseText);
      const results: WebSearchResult[] = items.slice(0, maxResults).map((item) => ({
        id: uuidv4(),
        title: item.title,
        url: item.url,
        snippet: item.text,
        timestamp: new Date().toISOString(),
        provider: 'exa-mcp'
      }));

      console.log(`[EnhancedWebSearchService] Exa MCP搜索完成，找到 ${results.length} 个结果`);
      return { results };
    } catch (error: any) {
      console.error('[EnhancedWebSearchService] Exa MCP搜索失败:', error);
      throw new Error(`Exa MCP搜索失败: ${error.message}`, { cause: error });
    }
  }

  /** 从 JSON-RPC 响应（JSON 或 SSE 流）中提取 MCP 工具返回的文本 */
  private extractExaMcpContentText(payload: string): string | null {
    try {
      const parsed = JSON.parse(payload);
      const content = parsed?.result?.content;
      if (!Array.isArray(content)) return null;
      const text = content
        .map((item: any) => (typeof item?.text === 'string' ? item.text.trim() : ''))
        .filter(Boolean)
        .join('\n\n');
      return text || null;
    } catch {
      return null;
    }
  }

  /** 解析 Exa MCP 返回的 "Title:/URL:/Text:" 块状文本 */
  private parseExaMcpResponse(responseText: string): Array<{ title: string; url: string; text: string }> {
    const payloadTexts: string[] = [];

    for (const line of responseText.split('\n')) {
      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6).trim();
      if (!payload || payload === '[DONE]') continue;
      const text = this.extractExaMcpContentText(payload);
      if (text) payloadTexts.push(text);
    }

    if (payloadTexts.length === 0) {
      const directText = this.extractExaMcpContentText(responseText);
      if (directText) payloadTexts.push(directText);
    }

    if (payloadTexts.length === 0 && responseText.includes('Title:')) {
      payloadTexts.push(responseText);
    }

    const items: Array<{ title: string; url: string; text: string }> = [];
    for (const chunk of payloadTexts.join('\n\n').split('\n\n')) {
      const lines = chunk.split('\n');
      let title = '';
      let url = '';
      let text = '';
      let textStartIndex = -1;

      lines.forEach((line, index) => {
        if (line.startsWith('Title:')) {
          title = line.replace(/^Title:\s*/, '');
        } else if (line.startsWith('URL:')) {
          url = line.replace(/^URL:\s*/, '');
        } else if (line.startsWith('Text:') && textStartIndex === -1) {
          textStartIndex = index;
          text = line.replace(/^Text:\s*/, '');
        }
      });

      if (textStartIndex !== -1) {
        const rest = lines.slice(textStartIndex + 1).join('\n');
        if (rest.trim().length > 0) {
          text = text ? `${text}\n${rest}` : rest;
        }
      }

      if (title || url || text) {
        items.push({ title, url, text });
      }
    }

    return items;
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
