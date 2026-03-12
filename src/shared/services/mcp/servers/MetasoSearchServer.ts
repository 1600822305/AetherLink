/**
 * Metaso AI Search MCP Server
 * 提供秘塔AI搜索功能，支持全网搜索和学术搜索
 * 使用秘塔AI官方开放平台API
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { universalFetch } from '../../../utils/universalFetch';

// 工具定义
const METASO_SEARCH_TOOL: Tool = {
  name: 'metaso_search',
  description: '秘塔AI搜索。通过 scope 选择范围：webpage/document/scholar/image/video/podcast',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: '搜索关键词'
      },
      scope: {
        type: 'string',
        enum: ['webpage', 'document', 'scholar', 'image', 'video', 'podcast'],
        description: '搜索范围',
        default: 'webpage'
      },
      size: {
        type: 'number',
        description: '返回结果数量',
        default: 10
      },
      includeRawContent: {
        type: 'boolean',
        description: '是否抓取来源原文（响应较慢）',
        default: false
      }
    },
    required: ['query']
  }
};

const METASO_READER_TOOL: Tool = {
  name: 'metaso_reader',
  description: '提取网页正文，返回纯文本',
  inputSchema: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        format: 'uri',
        description: '目标 URL'
      }
    },
    required: ['url']
  }
};

const METASO_CHAT_TOOL: Tool = {
  name: 'metaso_chat',
  description: '秘塔AI对话，基于实时搜索提供带引用的回答',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: '问题或查询内容'
      },
      scope: {
        type: 'string',
        enum: ['webpage', 'document', 'scholar', 'video', 'podcast'],
        description: '知识范围',
        default: 'webpage'
      },
      model: {
        type: 'string',
        enum: ['fast', 'fast_thinking', 'ds-r1'],
        description: '模型选择',
        default: 'fast'
      },
      stream: {
        type: 'boolean',
        description: '是否流式响应',
        default: false
      }
    },
    required: ['query']
  }
};

/**
 * Metaso Search Server 类
 */
export class MetasoSearchServer {
  public server: Server;
  private apiKey: string;
  private searchEndpoint: string;
  private readerEndpoint: string;
  private chatEndpoint: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || '';
    this.searchEndpoint = 'https://metaso.cn/api/v1/search';
    this.readerEndpoint = 'https://metaso.cn/api/v1/reader';
    this.chatEndpoint = 'https://metaso.cn/api/v1/chat/completions';

    this.server = new Server(
      {
        name: '@aether/metaso-search',
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
   * 设置 API Key
   */
  public setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  private setupHandlers(): void {
    // 列出可用工具
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [METASO_SEARCH_TOOL, METASO_READER_TOOL, METASO_CHAT_TOOL]
      };
    });

    // 执行工具调用
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      if (name === 'metaso_search') {
        return this.search(args as { 
          query: string;
          scope?: string;
          size?: number; 
          includeRawContent?: boolean;
        });
      } else if (name === 'metaso_reader') {
        return this.reader(args as { url: string });
      } else if (name === 'metaso_chat') {
        return this.chat(args as {
          query: string;
          scope?: string;
          model?: string;
          stream?: boolean;
        });
      }

      throw new Error(`未知的工具: ${name}`);
    });
  }

  /**
   * 执行搜索
   */
  private async search(
    params: { 
      query: string;
      scope?: string;
      size?: number;
      includeRawContent?: boolean;
    }
  ): Promise<{
    content: Array<{ type: string; text: string }>;
    isError?: boolean;
  }> {
    try {
      // 检查 API Key
      if (!this.apiKey) {
        throw new Error(
          '未配置秘塔AI搜索API Key。请访问秘塔AI开放平台 (https://metaso.cn/open-app) 申请 API Key'
        );
      }

      // 构建请求体（所有参数都可由AI控制）
      const requestBody = {
        q: params.query,
        scope: params.scope || 'webpage',
        includeSummary: false,
        size: String(params.size || 10),
        includeRawContent: params.includeRawContent === true,  // 默认关闭完整原文
        conciseSnippet: false
      };

      // 记录API调用参数（便于调试）
      console.log('[Metaso Search] API请求参数:', {
        query: params.query,
        scope: requestBody.scope,
        size: requestBody.size,
        includeRawContent: requestBody.includeRawContent
      });

      // 构建请求头
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      };

      // 发送请求
      const response = await universalFetch(this.searchEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`秘塔AI搜索请求失败 (${response.status}): ${errorText}`);
      }

      const data = await response.json();

      // 格式化搜索结果
      const webpages = data.webpages || [];
      const total = data.total || 0;
      
      // 构建头部信息
      let resultText = `## 秘塔AI搜索结果\n\n`;
      resultText += `**查询**: ${params.query}\n`;
      resultText += `**返回结果数**: ${webpages.length}\n`;
      resultText += `**总匹配数**: ${total}\n`;
      resultText += `**消耗积分**: ${data.credits || 0}\n`;
      
      // 显示启用的增强选项
      if (params.includeRawContent) {
        resultText += `**启用选项**: 完整原文\n`;
      }
      
      resultText += `\n---\n\n`;

      if (webpages && webpages.length > 0) {
        webpages.forEach((item: any, index: number) => {
          resultText += `### ${index + 1}. ${item.title || '无标题'}\n\n`;
          
          if (item.link) {
            resultText += `🔗 **链接**: ${item.link}\n\n`;
          }
          
          // 摘要信息
          if (item.snippet) {
            resultText += `📝 **摘要**: ${item.snippet}\n\n`;
          }
          
          // 完整原文内容
          if (item.rawContent && params.includeRawContent) {
            resultText += `📄 **完整原文**:\n\`\`\`\n${item.rawContent}\n\`\`\`\n\n`;
          }
          
          if (item.score) {
            resultText += `⭐ **相关度**: ${item.score}\n\n`;
          }
          if (item.date) {
            resultText += `📅 **日期**: ${item.date}\n\n`;
          }
          if (item.authors && item.authors.length > 0) {
            resultText += `👤 **作者**: ${item.authors.join(', ')}\n\n`;
          }
          
          resultText += `---\n\n`;
        });
      } else {
        resultText += '未找到相关结果\n\n';
      }

      resultText += `*数据来源: 秘塔AI搜索 (metaso.cn)*`;
      

      return {
        content: [
          {
            type: 'text',
            text: resultText
          }
        ]
      };
    } catch (error) {
      console.error('[Metaso Search] 搜索失败:', error);
      return {
        content: [
          {
            type: 'text',
            text: `秘塔AI搜索失败: ${error instanceof Error ? error.message : '未知错误'}\n\n配置提示：\n1. 访问秘塔AI开放平台：https://metaso.cn/open-app\n2. 登录并申请 API Key\n3. 在 MCP 服务器环境变量中配置：\n   {\n     "METASO_API_KEY": "你的API Key"\n   }\n\n注意：秘塔AI官方API需要申请开通，如需测试可以先使用其他AI搜索服务。`
          }
        ],
        isError: true
      };
    }
  }

  /**
   * 执行网页阅读
   */
  private async reader(
    params: { url: string }
  ): Promise<{
    content: Array<{ type: string; text: string }>;
    isError?: boolean;
  }> {
    try {
      // 检查 API Key
      if (!this.apiKey) {
        throw new Error(
          '未配置秘塔AI搜索API Key。请访问秘塔AI开放平台 (https://metaso.cn/open-app) 申请 API Key'
        );
      }

      // 构建请求体
      const requestBody = {
        url: params.url
      };

      // 构建请求头
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'text/plain',
        'Authorization': `Bearer ${this.apiKey}`
      };

      // 发送请求
      const response = await universalFetch(this.readerEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`秘塔AI阅读器请求失败 (${response.status}): ${errorText}`);
      }

      const content = await response.text();

      // 格式化返回结果
      const resultText = `## 秘塔AI阅读器结果

**源URL**: ${params.url}

---

${content}

---

*数据来源: 秘塔AI阅读器 (metaso.cn)*`;

      return {
        content: [
          {
            type: 'text',
            text: resultText
          }
        ]
      };
    } catch (error) {
      console.error('[Metaso Reader] 阅读失败:', error);
      return {
        content: [
          {
            type: 'text',
            text: `秘塔AI阅读器失败: ${error instanceof Error ? error.message : '未知错误'}`
          }
        ],
        isError: true
      };
    }
  }

  /**
   * AI智能对话（支持多种知识范围和模型）
   */
  private async chat(
    params: {
      query: string;
      scope?: string;
      model?: string;
      stream?: boolean;
    }
  ): Promise<{
    content: Array<{ type: string; text: string }>;
    isError?: boolean;
  }> {
    try {
      // 检查 API Key
      if (!this.apiKey) {
        throw new Error(
          '未配置秘塔AI搜索API Key。请访问秘塔AI开放平台 (https://metaso.cn/open-app) 申请 API Key'
        );
      }

      const model = params.model || 'fast';
      const scope = params.scope || 'webpage';
      const useStream = params.stream === true;

      // 构建请求体 - 必须包含scope参数，否则API会失败
      const requestBody = {
        model,
        scope,
        stream: useStream,
        messages: [
          {
            role: 'user',
            content: params.query
          }
        ]
      };

      // 记录API调用参数
      console.log('[Metaso Chat] API请求参数:', {
        query: params.query,
        model,
        scope,
        stream: useStream
      });

      // 构建请求头
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      };

      // 发送请求
      const response = await universalFetch(this.chatEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`秘塔AI对话请求失败 (${response.status}): ${errorText}`);
      }

      // MCP中使用非流式，直接获取完整响应
      if (!useStream) {
        const data = await response.json();
        const answer = data.choices?.[0]?.message?.content || '未获取到回答';
        const citations = data.choices?.[0]?.message?.citations || [];
        
        // 格式化结果
        let resultText = `## 秘塔AI智能回答\n\n`;
        resultText += `**问题**: ${params.query}\n`;
        resultText += `**模型**: ${model}\n`;
        resultText += `**知识范围**: ${scope}\n\n`;
        resultText += `---\n\n${answer}\n\n`;
        
        // 添加引用来源
        if (citations && citations.length > 0) {
          resultText += `## 📚 引用来源\n\n`;
          citations.forEach((cite: any, index: number) => {
            resultText += `${index + 1}. **${cite.title || '未知标题'}**\n`;
            if (cite.link) resultText += `   🔗 ${cite.link}\n`;
            if (cite.date) resultText += `   📅 ${cite.date}\n`;
            if (cite.authors && cite.authors.length > 0) {
              resultText += `   👤 ${cite.authors.join(', ')}\n`;
            }
            resultText += `\n`;
          });
        }
        
        resultText += `\n*数据来源: 秘塔AI (metaso.cn)*`;
        
        return {
          content: [
            {
              type: 'text',
              text: resultText
            }
          ]
        };
      } else {
        // 流式响应处理
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('无法获取响应流');
        }

        const decoder = new TextDecoder();
        let fullAnswer = '';
        let citations: any[] = [];
        let highlights: string[] = [];

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
              const trimmedLine = line.trim();
              if (trimmedLine.startsWith('data:')) {
                const jsonStr = trimmedLine.substring(5).trim();
                if (jsonStr === '[DONE]') {
                  break;
                }
                if (jsonStr) {
                  try {
                    const parsed = JSON.parse(jsonStr);
                    
                    // 提取内容
                    const delta = parsed.choices?.[0]?.delta;
                    if (delta?.content) {
                      fullAnswer += delta.content;
                    }
                    
                    // 提取引用
                    if (delta?.citations && delta.citations.length > 0) {
                      citations = delta.citations;
                    }
                    
                    // 提取高亮
                    if (delta?.highlights && delta.highlights.length > 0) {
                      highlights = delta.highlights;
                    }
                  } catch (e) {
                    // 忽略解析错误
                  }
                }
              }
            }
          }
        } finally {
          reader.releaseLock();
        }

        // 格式化流式结果
        let resultText = `## 秘塔AI智能回答（流式）\n\n`;
        resultText += `**问题**: ${params.query}\n`;
        resultText += `**模型**: ${model}\n`;
        resultText += `**知识范围**: ${scope}\n\n`;
        resultText += `---\n\n${fullAnswer}\n\n`;
        
        // 添加高亮摘要
        if (highlights.length > 0) {
          resultText += `## ✨ 关键要点\n\n`;
          highlights.forEach((highlight, index) => {
            resultText += `${index + 1}. ${highlight}\n`;
          });
          resultText += `\n`;
        }
        
        // 添加引用来源
        if (citations.length > 0) {
          resultText += `## 📚 引用来源\n\n`;
          citations.forEach((cite: any, index: number) => {
            resultText += `${index + 1}. **${cite.title || '未知标题'}**\n`;
            if (cite.link) resultText += `   🔗 ${cite.link}\n`;
            if (cite.date) resultText += `   📅 ${cite.date}\n`;
            if (cite.authors && cite.authors.length > 0) {
              resultText += `   👤 ${cite.authors.join(', ')}\n`;
            }
            resultText += `\n`;
          });
        }
        
        resultText += `\n*数据来源: 秘塔AI (metaso.cn)*`;
        
        return {
          content: [
            {
              type: 'text',
              text: resultText
            }
          ]
        };
      }
    } catch (error) {
      console.error('[Metaso Chat] 对话失败:', error);
      return {
        content: [
          {
            type: 'text',
            text: `秘塔AI对话失败: ${error instanceof Error ? error.message : '未知错误'}`
          }
        ],
        isError: true
      };
    }
  }
}
