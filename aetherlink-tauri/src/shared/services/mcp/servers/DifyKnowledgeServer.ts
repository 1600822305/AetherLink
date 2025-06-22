// Dify Knowledge MCP Server
// 移植自最佳实例的 Dify Knowledge 服务器

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';

// 工具定义
const SEARCH_KNOWLEDGE_TOOL: Tool = {
  name: 'search_knowledge',
  description: '在 Dify 知识库中搜索相关信息',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: '搜索查询'
      },
      dataset_id: {
        type: 'string',
        description: '数据集 ID（可选，如果未提供则使用默认数据集）'
      },
      top_k: {
        type: 'number',
        description: '返回结果数量（默认 5）',
        default: 5,
        minimum: 1,
        maximum: 20
      },
      score_threshold: {
        type: 'number',
        description: '相似度阈值（默认 0.5）',
        default: 0.5,
        minimum: 0,
        maximum: 1
      }
    },
    required: ['query']
  }
};

// 类型定义
interface DifySearchArgs {
  query: string;
  dataset_id?: string;
  top_k?: number;
  score_threshold?: number;
}

interface DifySearchResult {
  id: string;
  content: string;
  score: number;
  metadata?: Record<string, any>;
}

interface DifySearchResponse {
  data: DifySearchResult[];
  total: number;
}

// 参数验证
function isDifySearchArgs(args: any): args is DifySearchArgs {
  return typeof args === 'object' && typeof args.query === 'string';
}

// 执行 Dify 知识库搜索
async function searchDifyKnowledge(
  apiKey: string,
  query: string,
  datasetIds: string[],
  topK: number = 5,
  scoreThreshold: number = 0.5
): Promise<DifySearchResponse> {
  if (!apiKey || apiKey === 'YOUR_DIFY_KEY') {
    throw new Error('DIFY_KEY 是 Dify Knowledge MCP 服务器的必需配置');
  }

  // 如果没有提供数据集 ID，使用默认的第一个
  const targetDatasetIds = datasetIds.length > 0 ? datasetIds : ['default'];

  const results: DifySearchResult[] = [];

  // 对每个数据集进行搜索
  for (const datasetId of targetDatasetIds) {
    try {
      console.log(`[Dify] 在数据集 ${datasetId} 中搜索: ${query}`);

      const response = await fetch('https://api.dify.ai/v1/datasets/documents/search', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query,
          dataset_id: datasetId,
          top_k: topK,
          score_threshold: scoreThreshold,
          retrieval_model: {
            search_method: 'semantic_search',
            reranking_enable: true,
            reranking_model: {
              reranking_provider_name: 'cohere',
              reranking_model_name: 'rerank-english-v2.0'
            },
            top_k: topK,
            score_threshold: scoreThreshold
          }
        })
      });

      if (!response.ok) {
        console.error(`[Dify] 搜索失败 (${datasetId}): ${response.status} ${response.statusText}`);
        continue;
      }

      const data = await response.json();

      if (data.data && Array.isArray(data.data)) {
        const datasetResults = data.data.map((item: any) => ({
          id: item.id || `${datasetId}-${Math.random()}`,
          content: item.content || item.text || '',
          score: item.score || 0,
          metadata: {
            dataset_id: datasetId,
            document_id: item.document_id,
            segment_id: item.segment_id,
            ...item.metadata
          }
        }));

        results.push(...datasetResults);
      }
    } catch (error) {
      console.error(`[Dify] 搜索数据集 ${datasetId} 时出错:`, error);
      continue;
    }
  }

  // 按分数排序并限制结果数量
  results.sort((a, b) => b.score - a.score);
  const limitedResults = results.slice(0, topK);

  return {
    data: limitedResults,
    total: limitedResults.length
  };
}

// 格式化搜索结果
function formatSearchResults(results: DifySearchResponse, query: string): string {
  if (results.total === 0) {
    return `在 Dify 知识库中未找到与 "${query}" 相关的内容。`;
  }

  let output = `Dify 知识库搜索结果 "${query}" (找到 ${results.total} 条结果):\n\n`;

  results.data.forEach((result, index) => {
    output += `${index + 1}. **相似度: ${(result.score * 100).toFixed(1)}%**\n`;
    output += `${result.content}\n`;

    if (result.metadata) {
      output += `*来源: 数据集 ${result.metadata.dataset_id}`;
      if (result.metadata.document_id) {
        output += `, 文档 ${result.metadata.document_id}`;
      }
      output += '*\n';
    }

    output += '\n---\n\n';
  });

  return output.trim();
}

export class DifyKnowledgeServer {
  public server: Server;
  private apiKey: string;
  private datasetIds: string[];

  constructor(apiKey: string, datasetIds: string[] = []) {
    if (!apiKey || apiKey === 'YOUR_DIFY_KEY') {
      throw new Error('DIFY_KEY 是 Dify Knowledge MCP 服务器的必需配置');
    }

    this.apiKey = apiKey;
    this.datasetIds = datasetIds;

    this.server = new Server(
      {
        name: 'dify-knowledge-server',
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
      tools: [SEARCH_KNOWLEDGE_TOOL]
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params;

        if (name !== 'search_knowledge') {
          return {
            content: [{ type: 'text', text: `未知工具: ${name}` }],
            isError: true
          };
        }

        if (!args || !isDifySearchArgs(args)) {
          throw new Error('无效的参数：需要 query 字段');
        }

        const {
          query,
          dataset_id,
          top_k = 5,
          score_threshold = 0.5
        } = args;

        // 确定要搜索的数据集
        const targetDatasetIds = dataset_id
          ? [dataset_id]
          : this.datasetIds;

        console.log(`[Dify] 搜索知识库: ${query}`);

        const results = await searchDifyKnowledge(
          this.apiKey,
          query,
          targetDatasetIds,
          top_k,
          score_threshold
        );

        const formattedResults = formatSearchResults(results, query);

        return {
          content: [
            {
              type: 'text',
              text: formattedResults
            }
          ],
          isError: false
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[Dify] 错误:`, error);

        return {
          content: [
            {
              type: 'text',
              text: `Dify 知识库搜索失败: ${errorMessage}`
            }
          ],
          isError: true
        };
      }
    });
  }
}
