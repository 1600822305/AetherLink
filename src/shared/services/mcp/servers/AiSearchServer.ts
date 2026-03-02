/**
 * AI Search MCP Server
 * 通用 AI 搜索工具，支持任何兼容 OpenAI API 格式的 AI 模型进行联网搜索
 * 基于 https://github.com/lianwusuoai/ai-search-mcp 的 TypeScript 移植
 *
 * 功能：
 * - web_search: 使用 AI 模型进行网络搜索，支持多维度搜索（自动拆分复杂查询为多个子问题并行搜索）
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { universalFetch } from '../../../utils/universalFetch';

// ─── 默认系统提示词（与原项目一致）───
const DEFAULT_SYSTEM_PROMPT = `你是一个专业的搜索助手,擅长联网搜索并提供准确、详细的答案。

当前时间: {current_time}

搜索策略:
1. 优先使用最新、权威的信息源
2. 对于时间敏感的查询,明确标注信息的时间
3. 提供多个来源的信息进行交叉验证
4. 对于技术问题,优先参考官方文档和最新版本

输出要求:
- 直接回答用户问题
- 时间相关信息必须基于上述当前时间判断`;

// ─── 配置接口 ───
interface AiSearchConfig {
  apiUrl: string;
  apiKey: string;
  modelId: string;
  analysisModelId?: string;
  systemPrompt: string;
  timeout: number;
  stream: boolean;
  filterThinking: boolean;
  retryCount: number;
  maxQueryPlan: number;
}

// ─── OpenAI 兼容 API 请求/响应类型 ───
interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  stream: boolean;
}

interface ChatChoice {
  message?: { content: string };
  delta?: { content?: string };
}

interface ChatResponse {
  choices: ChatChoice[];
}

// ─── 过滤 AI 思考内容 ───
function filterThinkingContent(content: string): string {
  // 移除 <think>...</think> 标签及内容
  let result = content.replace(/<think>[\s\S]*?<\/think>/gi, '');
  // 移除 <thinking>...</thinking> 标签及内容
  result = result.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');
  // 压缩多余空行
  result = result.replace(/\n{3,}/g, '\n\n');
  return result.trim();
}

// ─── 工具定义（动态生成，根据 maxQueryPlan 调整描述）───
function buildSearchTool(config: AiSearchConfig): Tool {
  const description = config.maxQueryPlan === 1
    ? `使用 AI 模型 (${config.modelId}) 进行网络搜索。直接搜索用户查询，返回详细的搜索结果。`
    : `使用 AI 模型 (${config.modelId}) 进行网络搜索。\n\n多维度搜索模式：自动将查询拆分成 ${config.maxQueryPlan} 个子问题并行搜索，返回更全面的结果。`;

  return {
    name: 'web_search',
    description,
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '搜索查询内容'
        }
      },
      required: ['query']
    }
  };
}

/**
 * AI Search Server
 */
export class AiSearchServer {
  public server: Server;
  private config: AiSearchConfig;

  constructor(envs: Record<string, string> = {}) {
    this.config = this.parseConfig(envs);

    this.server = new Server(
      {
        name: '@aether/grok-search',
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
   * 从环境变量解析配置
   */
  private parseConfig(envs: Record<string, string>): AiSearchConfig {
    const apiUrl = envs.AI_API_URL || '';
    const apiKey = envs.AI_API_KEY || '';
    const modelId = envs.AI_MODEL_ID || '';
    const analysisModelId = envs.AI_ANALYSIS_MODEL_ID || undefined;
    const systemPrompt = envs.AI_SYSTEM_PROMPT || DEFAULT_SYSTEM_PROMPT;
    const timeout = parseInt(envs.AI_TIMEOUT || '60', 10);
    const stream = (envs.AI_STREAM || 'false').toLowerCase() === 'true';
    const filterThinking = (envs.AI_FILTER_THINKING || 'true').toLowerCase() === 'true';
    const retryCount = parseInt(envs.AI_RETRY_COUNT || '1', 10);
    const maxQueryPlan = parseInt(envs.AI_MAX_QUERY_PLAN || '1', 10);

    return {
      apiUrl,
      apiKey,
      modelId,
      analysisModelId,
      systemPrompt,
      timeout: Math.max(1, Math.min(300, timeout)),
      stream,
      filterThinking,
      retryCount: Math.max(0, retryCount),
      maxQueryPlan: Math.max(1, maxQueryPlan),
    };
  }

  private setupHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [buildSearchTool(this.config)]
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      if (name === 'web_search') {
        return this.handleWebSearch(args as { query: string });
      }

      throw new Error(`未知的工具: ${name}`);
    });
  }

  // ═══════════════════════════════════════════════════
  // 搜索入口
  // ═══════════════════════════════════════════════════

  private async handleWebSearch(
    params: { query: string }
  ): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
    try {
      if (!this.config.apiUrl || !this.config.apiKey || !this.config.modelId) {
        throw new Error(
          '未完整配置 AI Search。请在 MCP 服务器环境变量中配置：\n' +
          '  AI_API_URL — API 地址（如 https://api.openai.com/v1）\n' +
          '  AI_API_KEY — API 密钥\n' +
          '  AI_MODEL_ID — 搜索模型 ID'
        );
      }

      const query = params.query;
      console.log(`[AI Search] 搜索: ${query}`);

      let result: string;

      // 检查是否为子查询（带 [SUB_QUERY] 前缀）
      if (query.startsWith('[SUB_QUERY]')) {
        const actualQuery = query.replace(/^\[SUB_QUERY\]\s*/, '');
        result = await this.callApi(actualQuery);
      } else if (this.config.maxQueryPlan > 1) {
        // 多维度搜索
        result = await this.multiDimensionSearch(query);
      } else {
        // 直接搜索
        result = await this.callApi(query);
      }

      console.log(`[AI Search] 搜索完成，返回 ${result.length} 字符`);

      return {
        content: [{ type: 'text', text: result }]
      };
    } catch (error) {
      console.error('[AI Search] 搜索失败:', error);
      return {
        content: [{
          type: 'text',
          text: `AI 搜索失败: ${error instanceof Error ? error.message : '未知错误'}\n\n` +
            '配置提示：\n' +
            '在 MCP 服务器环境变量中配置以下参数：\n' +
            '  AI_API_URL — OpenAI 兼容 API 地址\n' +
            '  AI_API_KEY — API 密钥\n' +
            '  AI_MODEL_ID — 具有联网搜索能力的模型 ID\n' +
            '  AI_MAX_QUERY_PLAN — 多维度搜索子查询数量（默认 1）'
        }],
        isError: true
      };
    }
  }

  // ═══════════════════════════════════════════════════
  // 多维度搜索
  // ═══════════════════════════════════════════════════

  private async multiDimensionSearch(query: string): Promise<string> {
    console.log(`[AI Search] 多维度搜索: 拆分为 ${this.config.maxQueryPlan} 个子查询`);

    // 1. 用 AI 拆分查询
    const subQueries = await this.splitQuery(query);
    console.log(`[AI Search] 拆分完成: ${subQueries.length} 个子查询`);

    // 2. 并发执行所有子查询
    const startTime = Date.now();
    const results = await Promise.allSettled(
      subQueries.map(sq => this.callApi(sq.replace(/^\[SUB_QUERY\]\s*/, '')))
    );
    const elapsed = Date.now() - startTime;

    const successCount = results.filter(r => r.status === 'fulfilled').length;
    const failCount = results.filter(r => r.status === 'rejected').length;
    console.log(`[AI Search] 并发完成: 成功 ${successCount}, 失败 ${failCount}, 耗时 ${elapsed}ms`);

    // 3. 组装结果
    let output = '';
    results.forEach((result, i) => {
      const subQuestion = subQueries[i]?.replace(/^\[SUB_QUERY\]\s*/, '') || '未知';
      if (result.status === 'fulfilled') {
        output += `## 子查询 ${i + 1} 结果\n\n**子问题**: ${subQuestion}\n\n${result.value}\n\n`;
      } else {
        output += `## 子查询 ${i + 1} 失败\n\n**子问题**: ${subQuestion}\n\n**错误**: ${result.reason}\n\n`;
      }
    });

    if (!output.trim()) {
      throw new Error('所有子查询都失败了');
    }

    return output;
  }

  /**
   * 用 AI 将查询拆分为多个子问题
   */
  private async splitQuery(query: string): Promise<string[]> {
    const count = this.config.maxQueryPlan;
    const splitPrompt = `将查询拆分成 ${count} 个子问题，返回 JSON 数组。\n\n查询: ${query}\n\n只返回 JSON 数组，格式: ["子问题1", "子问题2", "子问题3"]`;
    const systemPrompt = '你是查询拆分助手。只返回 JSON 数组，不要任何解释、标记或其他文本。直接输出 JSON 数组。';

    const modelId = this.config.analysisModelId || this.config.modelId;
    console.log(`[AI Search] 使用模型 ${modelId} 拆分查询`);

    const response = await this.callApiWithModel(splitPrompt, systemPrompt, modelId);

    // 清理 markdown 代码块
    const cleaned = response
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    let subQueries: string[];
    try {
      subQueries = JSON.parse(cleaned);
    } catch {
      console.error('[AI Search] JSON 解析失败，原始响应:', response);
      throw new Error(`解析子查询失败，响应内容: ${cleaned}`);
    }

    if (!Array.isArray(subQueries) || subQueries.length === 0) {
      throw new Error('未能拆分出任何子查询');
    }

    // 为每个子查询添加 [SUB_QUERY] 前缀
    return subQueries.map(q => `[SUB_QUERY] ${q}`);
  }

  // ═══════════════════════════════════════════════════
  // API 调用
  // ═══════════════════════════════════════════════════

  /**
   * 使用默认系统提示词和默认模型调用 API
   */
  private async callApi(query: string): Promise<string> {
    const currentTime = new Date().toLocaleString('zh-CN', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      weekday: 'long'
    });
    const systemPrompt = this.config.systemPrompt.replace('{current_time}', currentTime);
    return this.callApiWithModel(query, systemPrompt, this.config.modelId);
  }

  /**
   * 使用指定模型和自定义系统提示词调用 API（含重试）
   */
  private async callApiWithModel(query: string, systemPrompt: string, modelId: string): Promise<string> {
    const retryableCodes = [408, 429, 500, 502, 503, 504];
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.retryCount; attempt++) {
      try {
        const result = await this.tryRequest(query, systemPrompt, modelId);
        return this.config.filterThinking ? filterThinkingContent(result) : result;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        // 检查是否可重试的 HTTP 状态码
        const codeMatch = lastError.message.match(/\((\d+)\)/);
        const statusCode = codeMatch ? parseInt(codeMatch[1], 10) : 0;

        if (attempt < this.config.retryCount && (retryableCodes.includes(statusCode) || statusCode === 0)) {
          console.warn(`[AI Search] 请求失败，重试 ${attempt + 1}/${this.config.retryCount}`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }

        throw lastError;
      }
    }

    throw lastError || new Error('未知错误');
  }

  /**
   * 单次 API 请求
   */
  private async tryRequest(query: string, systemPrompt: string, modelId: string): Promise<string> {
    const endpoint = this.buildEndpoint();
    const body: ChatRequest = {
      model: modelId,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: query }
      ],
      stream: this.config.stream,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout * 1000);

    try {
      const response = await universalFetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        const statusHint: Record<number, string> = {
          401: '认证失败，请检查 AI_API_KEY 是否正确',
          429: '请求过于频繁，建议稍后重试',
        };
        throw new Error(
          statusHint[response.status] ||
          `API 请求失败 (${response.status}): ${detail}`
        );
      }

      if (this.config.stream) {
        return await this.handleStreamingResponse(response);
      } else {
        return await this.handleJsonResponse(response);
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * 处理非流式 JSON 响应
   */
  private async handleJsonResponse(response: Response): Promise<string> {
    const data: ChatResponse = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('API 响应格式错误：未获取到回答内容');
    }
    return content;
  }

  /**
   * 处理流式 SSE 响应
   */
  private async handleStreamingResponse(response: Response): Promise<string> {
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('无法获取响应流');
    }

    const decoder = new TextDecoder();
    const chunks: string[] = [];
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        // 保留最后一行（可能不完整）
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;

          const data = trimmed.substring(5).trim();
          if (data === '[DONE]') continue;

          try {
            const parsed: ChatResponse = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              chunks.push(content);
            }
          } catch {
            // 忽略解析错误
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return chunks.join('');
  }

  /**
   * 构建 API endpoint
   */
  private buildEndpoint(): string {
    let url = this.config.apiUrl;
    if (!url.endsWith('/v1/chat/completions')) {
      if (url.endsWith('/')) {
        url += 'v1/chat/completions';
      } else {
        url += '/v1/chat/completions';
      }
    }
    return url;
  }
}
