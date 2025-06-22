// Brave Search MCP Server
// 移植自最佳实例的 Brave Search 服务器

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';

// 工具定义
const WEB_SEARCH_TOOL: Tool = {
  name: 'brave_web_search',
  description: '使用 Brave 搜索 API 进行网页搜索',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: '搜索查询'
      },
      count: {
        type: 'number',
        description: '返回结果数量（默认 10，最大 20）',
        default: 10
      }
    },
    required: ['query']
  }
};

const LOCAL_SEARCH_TOOL: Tool = {
  name: 'brave_local_search',
  description: '使用 Brave 搜索 API 进行本地搜索',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: '搜索查询'
      },
      count: {
        type: 'number',
        description: '返回结果数量（默认 5）',
        default: 5
      }
    },
    required: ['query']
  }
};

// 类型定义
interface BraveWebSearchArgs {
  query: string;
  count?: number;
}

interface BraveLocalSearchArgs {
  query: string;
  count?: number;
}

// 速率限制
let lastRequestTime = 0;
const RATE_LIMIT_MS = 1000; // 1秒限制

function checkRateLimit() {
  const now = Date.now();
  if (now - lastRequestTime < RATE_LIMIT_MS) {
    throw new Error('请求过于频繁，请稍后再试');
  }
  lastRequestTime = now;
}

// 网页搜索实现
async function performWebSearch(apiKey: string, query: string, count: number = 10) {
  checkRateLimit();

  const url = new URL('https://api.search.brave.com/res/v1/web/search');
  url.searchParams.set('q', query);
  url.searchParams.set('count', Math.min(count, 20).toString());

  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip',
      'X-Subscription-Token': apiKey
    }
  });

  if (!response.ok) {
    throw new Error(`Brave API 错误: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  if (!data.web?.results) {
    return '未找到搜索结果';
  }

  const results = data.web.results.slice(0, count).map((result: any, index: number) => {
    return `${index + 1}. **${result.title}**\n   ${result.description}\n   URL: ${result.url}\n`;
  }).join('\n');

  return `Brave 网页搜索结果 "${query}":\n\n${results}`;
}

// 本地搜索实现
async function performLocalSearch(apiKey: string, query: string, count: number = 5) {
  checkRateLimit();

  // 首先进行网页搜索获取位置信息
  const webUrl = new URL('https://api.search.brave.com/res/v1/web/search');
  webUrl.searchParams.set('q', query);
  webUrl.searchParams.set('count', '5');

  const webResponse = await fetch(webUrl, {
    headers: {
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip',
      'X-Subscription-Token': apiKey
    }
  });

  if (!webResponse.ok) {
    throw new Error(`Brave API 错误: ${webResponse.status} ${webResponse.statusText}`);
  }

  const webData = await webResponse.json();

  // 如果没有位置信息，回退到网页搜索
  if (!webData.locations?.results?.length) {
    return performWebSearch(apiKey, query, count);
  }

  // 格式化本地搜索结果
  const results = webData.locations.results.slice(0, count).map((result: any, index: number) => {
    return `${index + 1}. **${result.title || result.name}**\n   ${result.description || '无描述'}\n   地址: ${result.address || '无地址'}\n`;
  }).join('\n');

  return `Brave 本地搜索结果 "${query}":\n\n${results}`;
}

// 参数验证
function isBraveWebSearchArgs(args: any): args is BraveWebSearchArgs {
  return typeof args === 'object' && typeof args.query === 'string';
}

function isBraveLocalSearchArgs(args: any): args is BraveLocalSearchArgs {
  return typeof args === 'object' && typeof args.query === 'string';
}

export class BraveSearchServer {
  public server: Server;
  private apiKey: string;

  constructor(apiKey: string) {
    if (!apiKey || apiKey === 'YOUR_API_KEY') {
      throw new Error('BRAVE_API_KEY 是 Brave Search MCP 服务器的必需配置');
    }

    this.apiKey = apiKey;
    this.server = new Server(
      {
        name: 'brave-search-server',
        version: '0.1.0'
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
      tools: [WEB_SEARCH_TOOL, LOCAL_SEARCH_TOOL]
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params;

        if (!args) {
          throw new Error('未提供参数');
        }

        switch (name) {
          case 'brave_web_search': {
            if (!isBraveWebSearchArgs(args)) {
              throw new Error('brave_web_search 的参数无效');
            }
            const { query, count = 10 } = args;
            const results = await performWebSearch(this.apiKey, query, count);
            return {
              content: [{ type: 'text', text: results }],
              isError: false
            };
          }

          case 'brave_local_search': {
            if (!isBraveLocalSearchArgs(args)) {
              throw new Error('brave_local_search 的参数无效');
            }
            const { query, count = 5 } = args;
            const results = await performLocalSearch(this.apiKey, query, count);
            return {
              content: [{ type: 'text', text: results }],
              isError: false
            };
          }

          default:
            return {
              content: [{ type: 'text', text: `未知工具: ${name}` }],
              isError: true
            };
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text', text: `错误: ${errorMessage}` }],
          isError: true
        };
      }
    });
  }
}
