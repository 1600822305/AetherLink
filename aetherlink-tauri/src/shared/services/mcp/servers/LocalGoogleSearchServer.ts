/**
 * 本地 Google 搜索 MCP 服务器
 * 提供类似最佳实例的本地搜索功能，适配移动端
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool
} from '@modelcontextprotocol/sdk/types.js';

// Google 搜索工具定义
const GOOGLE_SEARCH_TOOL: Tool = {
  name: 'googleSearch',
  description: '使用 Google 搜索引擎搜索信息',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: '搜索查询词'
      },
      maxResults: {
        type: 'number',
        description: '最大结果数量',
        default: 5
      },
      language: {
        type: 'string',
        description: '搜索语言',
        default: 'zh-CN'
      },
      region: {
        type: 'string',
        description: '搜索地区',
        default: 'CN'
      }
    },
    required: ['query']
  }
};

// Bing 搜索工具定义
const BING_SEARCH_TOOL: Tool = {
  name: 'bingSearch',
  description: '使用 Bing 搜索引擎搜索信息',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: '搜索查询词'
      },
      maxResults: {
        type: 'number',
        description: '最大结果数量',
        default: 5
      },
      language: {
        type: 'string',
        description: '搜索语言',
        default: 'zh-CN'
      },
      region: {
        type: 'string',
        description: '搜索地区',
        default: 'CN'
      }
    },
    required: ['query']
  }
};

/**
 * 执行 Google 搜索
 */
async function performGoogleSearch(
  query: string,
  maxResults: number = 5,
  language: string = 'zh-CN',
  region: string = 'CN'
): Promise<any> {
  try {
    console.log(`[LocalGoogleSearchServer] 执行 Google 搜索: ${query}`);

    // 使用代理路径避免 CORS 问题
    const response = await fetch('/api/google/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query,
        maxResults,
        language,
        region
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google 搜索失败: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    if (!data.results || data.results.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `Google 搜索 "${query}" 没有找到相关结果。`
          }
        ]
      };
    }

    // 格式化搜索结果
    const formattedResults = data.results.map((result: any, index: number) => {
      return `${index + 1}. **${result.title}**
   链接: ${result.url}
   摘要: ${result.snippet || '无摘要'}`;
    }).join('\n\n');

    return {
      content: [
        {
          type: 'text',
          text: `Google 搜索结果 "${query}":\n\n${formattedResults}`
        }
      ]
    };
  } catch (error: any) {
    console.error('[LocalGoogleSearchServer] Google 搜索失败:', error);
    return {
      content: [
        {
          type: 'text',
          text: `Google 搜索失败: ${error.message}`
        }
      ],
      isError: true
    };
  }
}

/**
 * 执行 Bing 搜索
 */
async function performBingSearch(
  query: string,
  maxResults: number = 5,
  language: string = 'zh-CN',
  region: string = 'CN'
): Promise<any> {
  try {
    console.log(`[LocalGoogleSearchServer] 执行 Bing 搜索: ${query}`);

    // 使用代理路径避免 CORS 问题
    const response = await fetch('/api/bing/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query,
        maxResults,
        language,
        region
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Bing 搜索失败: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    if (!data.results || data.results.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `Bing 搜索 "${query}" 没有找到相关结果。`
          }
        ]
      };
    }

    // 格式化搜索结果
    const formattedResults = data.results.map((result: any, index: number) => {
      return `${index + 1}. **${result.title}**
   链接: ${result.url}
   摘要: ${result.snippet || '无摘要'}`;
    }).join('\n\n');

    return {
      content: [
        {
          type: 'text',
          text: `Bing 搜索结果 "${query}":\n\n${formattedResults}`
        }
      ]
    };
  } catch (error: any) {
    console.error('[LocalGoogleSearchServer] Bing 搜索失败:', error);
    return {
      content: [
        {
          type: 'text',
          text: `Bing 搜索失败: ${error.message}`
        }
      ],
      isError: true
    };
  }
}

export class LocalGoogleSearchServer {
  public server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'local-google-search-server',
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
      tools: [GOOGLE_SEARCH_TOOL, BING_SEARCH_TOOL]
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params;

        if (!args) {
          throw new Error('未提供参数');
        }

        switch (name) {
          case 'googleSearch': {
            const { query, maxResults = 5, language = 'zh-CN', region = 'CN' } = args as {
              query: string;
              maxResults?: number;
              language?: string;
              region?: string;
            };

            if (!query) {
              throw new Error('搜索查询不能为空');
            }

            return await performGoogleSearch(query, maxResults, language, region);
          }

          case 'bingSearch': {
            const { query, maxResults = 5, language = 'zh-CN', region = 'CN' } = args as {
              query: string;
              maxResults?: number;
              language?: string;
              region?: string;
            };

            if (!query) {
              throw new Error('搜索查询不能为空');
            }

            return await performBingSearch(query, maxResults, language, region);
          }

          default:
            throw new Error(`未知工具: ${name}`);
        }
      } catch (error: any) {
        console.error('[LocalGoogleSearchServer] 工具调用失败:', error);
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
