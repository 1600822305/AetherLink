/**
 * SearXNG MCP Server
 * 基于自部署的 SearXNG 元搜索引擎，提供搜索、网页内容抓取和自动补全功能
 * 
 * 功能：
 * - searxng_search: 聚合搜索（Google、Bing、DuckDuckGo 等 70+ 引擎），支持翻页、安全搜索，返回建议/直接答案/信息卡片
 * - searxng_read_url: 抓取任意网页内容并提取正文
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { universalFetch } from '../../../utils/universalFetch';

// ==================== 工具定义 ====================

const SEARXNG_SEARCH_TOOL: Tool = {
  name: 'searxng_search',
  description: '聚合多引擎互联网搜索。通过 categories 参数选择搜索类别：general(通用), news(新闻), science(学术), it(技术), videos, images, repos, packages, social media, translate, weather, map, music, books, movies, q&a, dictionaries, currency, files。',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: '搜索关键词'
      },
      engines: {
        type: 'string',
        description: '指定引擎（逗号分隔），如 google,bing,duckduckgo。留空使用类别默认引擎',
      },
      language: {
        type: 'string',
        description: '语言代码，如 zh-CN, en, ja',
        default: 'zh-CN'
      },
      categories: {
        type: 'string',
        description: '搜索类别（逗号分隔）',
        default: 'general'
      },
      maxResults: {
        type: 'number',
        description: '最大结果数',
        default: 10
      },
      timeRange: {
        type: 'string',
        enum: ['day', 'week', 'month', 'year', ''],
        description: '时间范围过滤',
      },
      pageno: {
        type: 'number',
        description: '页码',
        default: 1
      },
      safesearch: {
        type: 'number',
        enum: [0, 1, 2],
        description: '安全搜索：0=关闭, 1=中等, 2=严格',
        default: 0
      }
    },
    required: ['query']
  }
};

const SEARXNG_READ_URL_TOOL: Tool = {
  name: 'searxng_read_url',
  description: '抓取网页内容并提取正文，支持 HTML/JSON/纯文本',
  inputSchema: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        format: 'uri',
        description: '目标 URL'
      },
      maxLength: {
        type: 'number',
        description: '最大返回字符数',
        default: 5000
      }
    },
    required: ['url']
  }
};

// ==================== 服务器实现 ====================

/**
 * SearXNG MCP Server 类
 */
export class SearXNGServer {
  public server: Server;
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || 'http://154.37.208.52:39281';

    this.server = new Server(
      {
        name: '@aether/searxng',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    this.setupHandlers();
  }

  /**
   * 设置 SearXNG 服务器地址
   */
  public setBaseUrl(baseUrl: string): void {
    this.baseUrl = baseUrl;
  }

  private setupHandlers(): void {
    // 列出可用工具
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [SEARXNG_SEARCH_TOOL, SEARXNG_READ_URL_TOOL]
      };
    });

    // 执行工具调用
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      if (name === 'searxng_search') {
        return this.search(args as {
          query: string;
          engines?: string;
          language?: string;
          categories?: string;
          maxResults?: number;
          timeRange?: string;
          pageno?: number;
          safesearch?: number;
        });
      } else if (name === 'searxng_read_url') {
        return this.readUrl(args as {
          url: string;
          maxLength?: number;
        });
      }

      throw new Error(`未知的工具: ${name}`);
    });
  }

  // ==================== 搜索功能 ====================

  /**
   * 执行 SearXNG 搜索
   */
  private async search(
    params: {
      query: string;
      engines?: string;
      language?: string;
      categories?: string;
      maxResults?: number;
      timeRange?: string;
      pageno?: number;
      safesearch?: number;
    }
  ): Promise<{
    content: Array<{ type: string; text: string }>;
    isError?: boolean;
  }> {
    try {
      const {
        query,
        engines,
        language = 'zh-CN',
        categories = 'general',
        maxResults = 10,
        timeRange,
        pageno = 1,
        safesearch = 0
      } = params;

      // 构建搜索 URL 参数
      const searchParams = new URLSearchParams({
        q: query,
        format: 'json',
        language: language,
        categories: categories,
        pageno: String(pageno),
        safesearch: String(safesearch),
      });

      if (engines) {
        searchParams.set('engines', engines);
      }

      if (timeRange) {
        searchParams.set('time_range', timeRange);
      }

      const searchUrl = `${this.baseUrl}/search?${searchParams.toString()}`;

      console.log('[SearXNG] 开始搜索:', { query, engines, language, categories, timeRange, pageno, safesearch });

      // 发送搜索请求
      const response = await universalFetch(searchUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`SearXNG 搜索请求失败 (${response.status}): ${errorText}`);
      }

      const data = await response.json();

      // 提取搜索结果
      const results = (data.results || []).slice(0, maxResults);
      const totalResults = data.number_of_results || results.length;
      const suggestions: string[] = data.suggestions || [];
      const answers: string[] = data.answers || [];
      const corrections: string[] = data.corrections || [];
      const infoboxes: any[] = data.infoboxes || [];

      console.log(`[SearXNG] 搜索完成，找到 ${results.length} 个结果，${suggestions.length} 条建议，${answers.length} 个直接答案，${infoboxes.length} 个信息卡片`);

      // 格式化输出
      let resultText = `## SearXNG 搜索结果\n\n`;
      resultText += `**查询**: ${query}\n`;
      resultText += `**结果数**: ${results.length} / ${totalResults}\n`;
      resultText += `**页码**: ${pageno}\n`;
      if (engines) resultText += `**引擎**: ${engines}\n`;
      if (timeRange) resultText += `**时间范围**: ${timeRange}\n`;
      resultText += `\n---\n\n`;

      // 直接答案（如计算结果、翻译等）
      if (answers.length > 0) {
        resultText += `## 直接答案\n\n`;
        answers.forEach((answer: string) => {
          resultText += `> ${answer}\n\n`;
        });
        resultText += `---\n\n`;
      }

      // 拼写纠正
      if (corrections.length > 0) {
        resultText += `**拼写建议**: ${corrections.join(', ')}\n\n`;
      }

      // 信息卡片（维基百科等）
      if (infoboxes.length > 0) {
        infoboxes.forEach((box: any) => {
          resultText += `## 📋 ${box.infobox || '信息卡片'}\n\n`;
          if (box.content) {
            resultText += `${box.content}\n\n`;
          }
          if (box.urls && box.urls.length > 0) {
            resultText += `**相关链接**:\n`;
            box.urls.forEach((u: any) => {
              resultText += `- [${u.title || u.url}](${u.url})\n`;
            });
            resultText += `\n`;
          }
          if (box.attributes && box.attributes.length > 0) {
            box.attributes.forEach((attr: any) => {
              resultText += `- **${attr.label}**: ${attr.value}\n`;
            });
            resultText += `\n`;
          }
          resultText += `---\n\n`;
        });
      }

      // 搜索结果列表
      if (results.length > 0) {
        results.forEach((item: any, index: number) => {
          resultText += `### ${index + 1}. ${item.title || '无标题'}\n\n`;

          if (item.url) {
            resultText += `**链接**: ${item.url}\n\n`;
          }

          if (item.content) {
            resultText += `**摘要**: ${item.content}\n\n`;
          }

          if (item.engine) {
            resultText += `**来源引擎**: ${item.engine}\n`;
          }

          if (item.score) {
            resultText += `**相关度**: ${(item.score * 100).toFixed(1)}%\n`;
          }

          if (item.publishedDate) {
            resultText += `**发布时间**: ${item.publishedDate}\n`;
          }

          resultText += `\n---\n\n`;
        });
      } else {
        resultText += '未找到相关结果\n\n';
      }

      // 搜索建议
      if (suggestions.length > 0) {
        resultText += `## 相关搜索建议\n\n`;
        suggestions.forEach((s: string) => {
          resultText += `- ${s}\n`;
        });
        resultText += `\n`;
      }

      resultText += `*数据来源: SearXNG 元搜索引擎*`;

      return {
        content: [
          {
            type: 'text',
            text: resultText
          }
        ]
      };
    } catch (error) {
      console.error('[SearXNG] 搜索失败:', error);
      return {
        content: [
          {
            type: 'text',
            text: `SearXNG 搜索失败: ${error instanceof Error ? error.message : '未知错误'}\n\n请检查 SearXNG 服务是否正常运行。`
          }
        ],
        isError: true
      };
    }
  }

  // ==================== 网页抓取功能 ====================

  /**
   * 抓取网页内容并提取正文
   */
  private async readUrl(
    params: {
      url: string;
      maxLength?: number;
    }
  ): Promise<{
    content: Array<{ type: string; text: string }>;
    isError?: boolean;
  }> {
    try {
      const { url, maxLength = 5000 } = params;

      console.log('[SearXNG] 开始抓取网页:', url);

      // 直接抓取网页内容
      const response = await universalFetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'User-Agent': 'Mozilla/5.0 (compatible; AetherLink/1.0; +https://aetherlink.app)',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP 请求失败 (${response.status}): ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || '';
      const rawText = await response.text();

      let extractedContent: string;
      let title = '';

      if (contentType.includes('application/json')) {
        // JSON 内容直接格式化返回
        try {
          const json = JSON.parse(rawText);
          extractedContent = JSON.stringify(json, null, 2);
        } catch {
          extractedContent = rawText;
        }
      } else if (contentType.includes('text/html')) {
        // HTML 内容提取正文
        const extracted = this.extractContent(rawText);
        title = extracted.title;
        extractedContent = extracted.content;
      } else {
        // 其他文本内容直接返回
        extractedContent = rawText;
      }

      // 截断超长内容
      if (extractedContent.length > maxLength) {
        extractedContent = extractedContent.substring(0, maxLength) + '\n\n...(内容已截断)';
      }

      // 格式化输出
      let resultText = `## 网页内容\n\n`;
      resultText += `**URL**: ${url}\n`;
      if (title) resultText += `**标题**: ${title}\n`;
      resultText += `**内容长度**: ${extractedContent.length} 字符\n`;
      resultText += `\n---\n\n`;
      resultText += extractedContent;

      console.log(`[SearXNG] 网页抓取完成，提取 ${extractedContent.length} 字符`);

      return {
        content: [
          {
            type: 'text',
            text: resultText
          }
        ]
      };
    } catch (error) {
      console.error('[SearXNG] 网页抓取失败:', error);
      return {
        content: [
          {
            type: 'text',
            text: `网页抓取失败: ${error instanceof Error ? error.message : '未知错误'}\n\nURL: ${params.url}`
          }
        ],
        isError: true
      };
    }
  }

  // ==================== HTML 内容提取 ====================

  /**
   * 从 HTML 中提取正文内容
   * 轻量级实现，不依赖 node-html-parser
   */
  private extractContent(html: string): { title: string; content: string } {
    // 提取 title
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? this.decodeHtmlEntities(titleMatch[1].trim()) : '';

    // 移除不需要的标签
    let content = html;

    // 移除 script, style, nav, header, footer, aside, iframe, noscript
    content = content.replace(/<(script|style|nav|header|footer|aside|iframe|noscript|svg)[^>]*>[\s\S]*?<\/\1>/gi, '');

    // 移除 HTML 注释
    content = content.replace(/<!--[\s\S]*?-->/g, '');

    // 移除所有 HTML 标签，保留文本
    content = content.replace(/<[^>]+>/g, '\n');

    // 解码 HTML 实体
    content = this.decodeHtmlEntities(content);

    // 清理空白
    content = content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      // 过滤掉太短的行（通常是菜单项、按钮文本等）
      .filter(line => line.length > 10 || /[。！？.!?]$/.test(line))
      .join('\n');

    // 合并多个连续空行
    content = content.replace(/\n{3,}/g, '\n\n');

    return { title, content: content.trim() };
  }

  /**
   * 解码 HTML 实体
   */
  private decodeHtmlEntities(text: string): string {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num)))
      .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  }
}
