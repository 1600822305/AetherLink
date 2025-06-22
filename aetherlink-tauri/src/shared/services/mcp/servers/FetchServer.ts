// Fetch MCP Server
// 移植自最佳实例的 Fetch 服务器

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import DOMPurify from 'dompurify';
import { universalFetch } from '../../../utils/universalFetch';

// 工具定义
const FETCH_HTML_TOOL: Tool = {
  name: 'fetch_html',
  description: 'Fetch a website and return the content as HTML',
  inputSchema: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'URL of the website to fetch'
      },
      headers: {
        type: 'object',
        description: 'Optional headers to include in the request',
        additionalProperties: {
          type: 'string'
        }
      }
    },
    required: ['url']
  }
};

const FETCH_MARKDOWN_TOOL: Tool = {
  name: 'fetch_markdown',
  description: 'Fetch a website and return the content as Markdown',
  inputSchema: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'URL of the website to fetch'
      },
      headers: {
        type: 'object',
        description: 'Optional headers to include in the request',
        additionalProperties: {
          type: 'string'
        }
      }
    },
    required: ['url']
  }
};

const FETCH_TXT_TOOL: Tool = {
  name: 'fetch_txt',
  description: 'Fetch a website, return the content as plain text (HTML tags stripped)',
  inputSchema: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'URL of the website to fetch'
      },
      headers: {
        type: 'object',
        description: 'Optional headers to include in the request',
        additionalProperties: {
          type: 'string'
        }
      }
    },
    required: ['url']
  }
};

const FETCH_JSON_TOOL: Tool = {
  name: 'fetch_json',
  description: 'Fetch a JSON file from a URL',
  inputSchema: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'URL of the JSON file to fetch'
      },
      headers: {
        type: 'object',
        description: 'Optional headers to include in the request',
        additionalProperties: {
          type: 'string'
        }
      }
    },
    required: ['url']
  }
};

// 类型定义
interface FetchArgs {
  url: string;
  headers?: Record<string, string>;
}

// 简单的 HTML 到 Markdown 转换器
class SimpleHtmlToMarkdown {
  convert(html: string): string {
    // 清理 HTML
    const cleanHtml = DOMPurify.sanitize(html);

    // 创建临时 DOM 元素
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = cleanHtml;

    // 简单的转换规则
    let markdown = tempDiv.textContent || tempDiv.innerText || '';

    // 基本的 Markdown 转换
    markdown = markdown
      .replace(/\n\s*\n\s*\n/g, '\n\n') // 多个换行符合并为两个
      .replace(/^\s+|\s+$/g, '') // 去除首尾空白
      .trim();

    return markdown;
  }
}

// 参数验证
function isFetchArgs(args: any): args is FetchArgs {
  return typeof args === 'object' && typeof args.url === 'string';
}

// URL 验证
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// 基础获取方法
async function fetchResponse(url: string, headers?: Record<string, string>): Promise<Response> {
  if (!isValidUrl(url)) {
    throw new Error('无效的 URL 格式');
  }

  // 使用 universalFetch 自动选择最佳请求方式
  console.log(`[FetchServer] 请求 URL: ${url}`);

  const response = await universalFetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      ...headers
    },
    timeout: 30000 // 30秒超时
  });

  if (!response.ok) {
    throw new Error(`HTTP 错误: ${response.status} ${response.statusText}`);
  }

  return response;
}

// 获取 HTML 内容
async function fetchHtml(url: string, headers?: Record<string, string>): Promise<string> {
  const response = await fetchResponse(url, headers);
  const html = await response.text();
  return html;
}

// 获取 JSON 内容
async function fetchJson(url: string, headers?: Record<string, string>): Promise<string> {
  const response = await fetchResponse(url, headers);
  const json = await response.json();
  return JSON.stringify(json, null, 2);
}

// 获取纯文本内容
async function fetchTxt(url: string, headers?: Record<string, string>): Promise<string> {
  const response = await fetchResponse(url, headers);
  const html = await response.text();

  // 创建临时 DOM 元素来解析 HTML
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = DOMPurify.sanitize(html);

  // 移除脚本和样式标签
  const scripts = tempDiv.getElementsByTagName('script');
  const styles = tempDiv.getElementsByTagName('style');
  Array.from(scripts).forEach(script => script.remove());
  Array.from(styles).forEach(style => style.remove());

  // 获取纯文本内容
  const text = tempDiv.textContent || tempDiv.innerText || '';

  // 规范化文本（合并多个空白字符）
  const normalizedText = text.replace(/\s+/g, ' ').trim();

  return normalizedText;
}

// 获取 Markdown 内容
async function fetchMarkdown(url: string, headers?: Record<string, string>): Promise<string> {
  const response = await fetchResponse(url, headers);
  const html = await response.text();

  // 转换 HTML 到 Markdown
  const converter = new SimpleHtmlToMarkdown();
  const markdown = converter.convert(html);

  return markdown;
}

export class FetchServer {
  public server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'fetch-server',
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
      tools: [FETCH_HTML_TOOL, FETCH_MARKDOWN_TOOL, FETCH_TXT_TOOL, FETCH_JSON_TOOL]
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params;

        if (!args || !isFetchArgs(args)) {
          throw new Error('无效的参数：需要 url 字段');
        }

        const { url, headers } = args;

        console.log(`[Fetch] 调用工具: ${name}, URL: ${url}`);

        let content: string;

        switch (name) {
          case 'fetch_html':
            content = await fetchHtml(url, headers);
            break;
          case 'fetch_markdown':
            content = await fetchMarkdown(url, headers);
            break;
          case 'fetch_txt':
            content = await fetchTxt(url, headers);
            break;
          case 'fetch_json':
            content = await fetchJson(url, headers);
            break;
          default:
            return {
              content: [{ type: 'text', text: `未知工具: ${name}` }],
              isError: true
            };
        }

        return {
          content: [
            {
              type: 'text',
              text: content
            }
          ],
          isError: false
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[Fetch] 错误:`, error);

        return {
          content: [
            {
              type: 'text',
              text: `获取 URL 内容失败: ${errorMessage}`
            }
          ],
          isError: true
        };
      }
    });
  }
}
