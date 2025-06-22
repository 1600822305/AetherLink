/**
 * Web Scout MCP 服务器
 * 移植自 web-scout-mcp 项目，提供 DuckDuckGo 搜索和网页内容提取功能
 * 适配 AetherLink 项目架构，使用 universalFetch 进行网络请求
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool
} from '@modelcontextprotocol/sdk/types.js';
import * as cheerio from 'cheerio';
import { universalFetch } from '../../../utils/universalFetch';

// 浏览器兼容的 UUID 生成函数 (暂时未使用)
// function generateUUID(): string {
//   if (typeof crypto !== 'undefined' && crypto.randomUUID) {
//     return crypto.randomUUID();
//   }
//   // 回退方案
//   return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
//     const r = Math.random() * 16 | 0;
//     const v = c === 'x' ? r : (r & 0x3 | 0x8);
//     return v.toString(16);
//   });
// }

// 工具定义
const DUCKDUCKGO_SEARCH_TOOL: Tool = {
  name: 'duckduckgo_search',
  description: '使用 DuckDuckGo 搜索引擎进行网页搜索，返回格式化的搜索结果列表',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: '搜索查询词'
      },
      maxResults: {
        type: 'number',
        description: '最大结果数量（默认：10）',
        default: 10
      }
    },
    required: ['query']
  }
};

const URL_CONTENT_EXTRACTOR_TOOL: Tool = {
  name: 'extract_url_content',
  description: '从指定的网页 URL 提取内容，支持单个 URL 或多个 URL 批量处理',
  inputSchema: {
    type: 'object',
    properties: {
      url: {
        oneOf: [
          {
            type: 'string',
            description: '要提取内容的网页 URL'
          },
          {
            type: 'array',
            items: { type: 'string' },
            description: '要提取内容的网页 URL 列表'
          }
        ]
      }
    },
    required: ['url']
  }
};

// 数据结构接口
interface SearchResult {
  title: string;
  link: string;
  snippet: string;
  position: number;
}

interface MemoryStats {
  totalMemory: number;
  freeMemory: number;
  usedMemory: number;
  usagePercentage: number;
}

/**
 * 频率限制器类
 */
class RateLimiter {
  private requestsPerMinute: number;
  private requests: Date[];

  constructor(requestsPerMinute: number = 30) {
    this.requestsPerMinute = requestsPerMinute;
    this.requests = [];
  }

  async acquire(): Promise<void> {
    const now = new Date();
    
    // 移除超过1分钟的请求记录
    this.requests = this.requests.filter(
      req => now.getTime() - req.getTime() < 60 * 1000
    );

    if (this.requests.length >= this.requestsPerMinute) {
      // 等待直到可以发起下一个请求
      const oldestRequest = this.requests[0];
      const waitTime = 60 - (now.getTime() - oldestRequest.getTime()) / 1000;
      
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
      }
    }

    this.requests.push(now);
  }
}

/**
 * DuckDuckGo 搜索器
 */
class DuckDuckGoSearcher {
  private static readonly BASE_URL = 'https://html.duckduckgo.com/html';
  private static readonly HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  };
  
  private rateLimiter: RateLimiter;

  constructor() {
    this.rateLimiter = new RateLimiter();
  }

  /**
   * 格式化搜索结果为 LLM 友好的格式
   */
  formatResultsForLLM(results: SearchResult[]): string {
    if (!results.length) {
      return '没有找到相关搜索结果。请尝试重新表述您的搜索词或稍后再试。';
    }

    const output: string[] = [];
    output.push(`找到 ${results.length} 个搜索结果：\n`);

    for (const result of results) {
      output.push(`${result.position}. **${result.title}**`);
      output.push(`   链接: ${result.link}`);
      output.push(`   摘要: ${result.snippet}`);
      output.push(''); // 结果之间的空行
    }

    return output.join('\n');
  }

  /**
   * 执行 DuckDuckGo 搜索
   */
  async search(query: string, maxResults: number = 10): Promise<SearchResult[]> {
    try {
      // 应用频率限制
      await this.rateLimiter.acquire();

      console.log(`[WebScoutServer] 执行 DuckDuckGo 搜索: ${query}`);

      // 创建表单数据
      const formData = new URLSearchParams({
        q: query,
        b: '',
        kl: ''
      });

      const response = await universalFetch(DuckDuckGoSearcher.BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          ...DuckDuckGoSearcher.HEADERS
        },
        body: formData.toString(),
        timeout: 30000,
        responseType: 'text'  // DuckDuckGo 返回 HTML，不是 JSON
      });

      if (!response.ok) {
        throw new Error(`DuckDuckGo 搜索失败: ${response.status} ${response.statusText}`);
      }

      const html = await response.text();
      
      // 解析 HTML 响应
      const $ = cheerio.load(html);
      const results: SearchResult[] = [];

      $('.result').each((_, element) => {
        const titleElem = $(element).find('.result__title');
        if (!titleElem.length) return;

        const linkElem = titleElem.find('a');
        if (!linkElem.length) return;

        const title = linkElem.text().trim();
        let link = linkElem.attr('href') || '';

        // 跳过广告结果
        if (link.includes('y.js')) return;

        // 清理 DuckDuckGo 重定向 URL
        if (link.startsWith('//duckduckgo.com/l/?uddg=')) {
          link = decodeURIComponent(link.split('uddg=')[1].split('&')[0]);
        }

        const snippetElem = $(element).find('.result__snippet');
        const snippet = snippetElem.length ? snippetElem.text().trim() : '';

        results.push({
          title,
          link,
          snippet,
          position: results.length + 1
        });

        if (results.length >= maxResults) {
          return false; // 跳出循环
        }
      });

      return results;
    } catch (error) {
      console.error('[WebScoutServer] DuckDuckGo 搜索失败:', error);
      throw error;
    }
  }
}

/**
 * 网页内容获取器，浏览器兼容版本
 */
class WebContentFetcher {
  private rateLimiter: RateLimiter;
  private readonly MAX_CONTENT_SIZE = 8000; // 最大内容长度

  constructor() {
    this.rateLimiter = new RateLimiter(20);
  }

  /**
   * 获取浏览器内存信息（简化版）
   */
  private getMemoryStats(): MemoryStats {
    // 浏览器环境中的简化内存统计
    const performance = (globalThis as any).performance;
    if (performance && performance.memory) {
      const memory = performance.memory;
      return {
        totalMemory: memory.jsHeapSizeLimit || 2147483648, // 默认 2GB
        freeMemory: memory.jsHeapSizeLimit - memory.usedJSHeapSize || 1073741824, // 默认 1GB
        usedMemory: memory.usedJSHeapSize || 1073741824,
        usagePercentage: ((memory.usedJSHeapSize || 1073741824) / (memory.jsHeapSizeLimit || 2147483648)) * 100
      };
    }

    // 回退到默认值
    return {
      totalMemory: 2147483648, // 2GB
      freeMemory: 1073741824,  // 1GB
      usedMemory: 1073741824,  // 1GB
      usagePercentage: 50
    };
  }

  /**
   * 处理 HTML 内容，提取纯文本
   */
  private processHtml(html: string): string {
    try {
      // 使用 cheerio 解析 HTML
      const $ = cheerio.load(html);

      // 移除脚本、样式和导航元素
      $('script, style, nav, header, footer, .nav, .navigation, .menu, .sidebar').remove();

      // 获取主要内容区域
      let text = '';
      const mainSelectors = ['main', 'article', '.content', '.post', '.entry', 'body'];

      for (const selector of mainSelectors) {
        const element = $(selector);
        if (element.length > 0) {
          text = element.text();
          break;
        }
      }

      // 如果没有找到主要内容区域，使用整个 body
      if (!text) {
        text = $('body').text() || $.text();
      }

      // 清理文本
      text = text
        .replace(/\s+/g, ' ')  // 合并多个空白字符
        .replace(/\n\s*\n/g, '\n')  // 合并多个换行
        .trim();

      // 如果内容太长则截断
      if (text.length > this.MAX_CONTENT_SIZE) {
        text = text.substring(0, this.MAX_CONTENT_SIZE) + '... [内容已截断，原文更长]';
      }

      return text;
    } catch (error) {
      console.error('[WebContentFetcher] HTML 处理失败:', error);
      return '错误: 无法解析网页内容';
    }
  }

  /**
   * 获取并解析单个 URL 的内容
   */
  async fetchAndParse(urlStr: string): Promise<string> {
    try {
      await this.rateLimiter.acquire();

      console.log(`[WebScoutServer] 获取 URL 内容: ${urlStr}`);

      // 使用更完整的浏览器请求头来避免反爬虫检测
      const response = await universalFetch(urlStr, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Cache-Control': 'max-age=0'
        },
        timeout: 30000,
        responseType: 'text'  // 网页内容是 HTML/文本，不是 JSON
      });

      if (!response.ok) {
        // 根据不同的 HTTP 状态码提供更具体的错误信息
        let errorMessage = '';
        switch (response.status) {
          case 403:
            errorMessage = `访问被拒绝 (403)：网站可能有反爬虫保护，请尝试其他网页或稍后再试`;
            break;
          case 404:
            errorMessage = `页面不存在 (404)：请检查 URL 是否正确`;
            break;
          case 429:
            errorMessage = `请求过于频繁 (429)：请稍后再试`;
            break;
          case 500:
            errorMessage = `服务器内部错误 (500)：网站服务器出现问题`;
            break;
          case 503:
            errorMessage = `服务不可用 (503)：网站暂时无法访问`;
            break;
          default:
            errorMessage = `HTTP 错误 (${response.status}): ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const html = await response.text();
      const text = this.processHtml(html);

      return text;
    } catch (error: any) {
      console.error(`[WebScoutServer] 获取 URL 内容失败: ${urlStr}`, error);

      if (error.name === 'AbortError') {
        return `错误: 请求 ${urlStr} 超时`;
      } else {
        return `错误: 无法访问网页 (${error.message})`;
      }
    }
  }

  /**
   * 批量获取多个 URL 的内容
   */
  async fetchMultipleUrls(urls: string[]): Promise<Record<string, string>> {
    const results: Record<string, string> = {};
    const memoryStats = this.getMemoryStats();

    // 根据可用内存确定批次大小
    let batchSize = 3; // 默认值
    if (memoryStats.usagePercentage > 70) {
      batchSize = 1; // 内存紧张时减少批次大小
    } else if (memoryStats.usagePercentage < 30) {
      batchSize = 5; // 内存充足时增加批次大小
    }

    // 分批处理 URL 以管理内存
    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize);

      // 并行处理批次
      const batchResults = await Promise.all(
        batch.map(async (url) => {
          try {
            const content = await this.fetchAndParse(url);
            return { url, content };
          } catch (error) {
            // 处理单个 URL 的错误
            return {
              url,
              content: `处理 URL 时出错: ${(error as Error).message}`
            };
          }
        })
      );

      // 将批次结果添加到总结果中
      for (const { url, content } of batchResults) {
        results[url] = content;
      }

      // 如果可用，强制垃圾回收（需要 --expose-gc 标志）
      if (global.gc) {
        global.gc();
      }

      // 批次之间的小延迟，让系统恢复
      if (i + batchSize < urls.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    return results;
  }
}

// 参数验证函数
function isSearchArgs(args: any): args is { query: string; maxResults?: number } {
  return typeof args === 'object' && typeof args.query === 'string';
}

function isExtractArgs(args: any): args is { url: string | string[] } {
  return typeof args === 'object' &&
         (typeof args.url === 'string' || Array.isArray(args.url));
}

/**
 * Web Scout MCP 服务器主类
 */
export class WebScoutServer {
  public server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'web-scout-server',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    this.initialize();
  }

  initialize() {
    // 工具处理器
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [DUCKDUCKGO_SEARCH_TOOL, URL_CONTENT_EXTRACTOR_TOOL]
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params;

        if (!args) {
          throw new Error('未提供参数');
        }

        switch (name) {
          case 'duckduckgo_search': {
            if (!isSearchArgs(args)) {
              throw new Error('无效的搜索参数：需要 query 字段');
            }

            const { query, maxResults = 10 } = args;
            console.log(`[WebScout] 执行搜索: ${query}`);

            const searcher = new DuckDuckGoSearcher();
            const searchResults = await searcher.search(query, maxResults);
            const formattedResults = searcher.formatResultsForLLM(searchResults);

            return {
              content: [
                {
                  type: 'text',
                  text: formattedResults
                }
              ],
              isError: false
            };
          }

          case 'extract_url_content': {
            if (!isExtractArgs(args)) {
              throw new Error('无效的 URL 参数：需要 url 字段');
            }

            const fetcher = new WebContentFetcher();

            if (typeof args.url === 'string') {
              // 单个 URL
              console.log(`[WebScout] 提取单个 URL 内容: ${args.url}`);
              const content = await fetcher.fetchAndParse(args.url);

              return {
                content: [
                  {
                    type: 'text',
                    text: content
                  }
                ],
                isError: false
              };
            } else if (Array.isArray(args.url)) {
              // 多个 URL
              console.log(`[WebScout] 提取多个 URL 内容: ${args.url.length} 个 URL`);
              const results = await fetcher.fetchMultipleUrls(args.url);

              return {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify(results, null, 2)
                  }
                ],
                isError: false
              };
            } else {
              throw new Error('无效的 URL 格式：期望字符串或字符串数组');
            }
          }

          default:
            return {
              content: [{ type: 'text', text: `未知工具: ${name}` }],
              isError: true
            };
        }
      } catch (error: any) {
        console.error('[WebScout] 工具调用失败:', error);
        return {
          content: [
            {
              type: 'text',
              text: `工具调用失败: ${error.message}`
            }
          ],
          isError: true
        };
      }
    });
  }
}
