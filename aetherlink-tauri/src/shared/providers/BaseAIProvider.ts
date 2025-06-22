import type { Model, MCPTool, MCPToolResponse, MCPCallToolResponse, Usage, Metrics } from '../types';
import { parseAndCallTools, parseToolUse, mcpToolsToAnthropicTools, mcpToolsToOpenAITools, getMCPSystemPrompt } from '../utils/mcpToolParser';
import type { Chunk } from '../types/chunk';

/**
 * AI 提供者基类
 * 提供 MCP 工具调用的通用功能
 */
export abstract class BaseAIProvider {
  protected model: Model;

  constructor(model: Model) {
    this.model = model;
  }

  /**
   * 将 MCP 工具转换为提供者特定的工具格式
   */
  public abstract convertMcpTools<T>(mcpTools: MCPTool[]): T[];

  /**
   * 将 MCP 工具调用响应转换为消息格式
   */
  public abstract mcpToolCallResponseToMessage(
    mcpToolResponse: MCPToolResponse,
    resp: MCPCallToolResponse,
    model: Model
  ): any;

  /**
   * 检查是否启用工具使用
   */
  protected isToolUseEnabled(mcpTools: MCPTool[]): boolean {
    return mcpTools && mcpTools.length > 0;
  }

  /**
   * 处理工具调用
   */
  protected async processToolCalls(
    toolCalls: any[],
    mcpTools: MCPTool[],
    onToolUpdate?: (toolResponse: MCPToolResponse, result: MCPCallToolResponse) => void
  ): Promise<any[]> {
    if (!toolCalls || toolCalls.length === 0) {
      return [];
    }

    const mcpToolResponses = this.convertToolCallsToMcpResponses(toolCalls, mcpTools);

    const results = await parseAndCallTools(
      mcpToolResponses,
      mcpTools,
      onToolUpdate
    );

    return results.map((result, index) =>
      this.mcpToolCallResponseToMessage(mcpToolResponses[index], result, this.model)
    ).filter(Boolean);
  }

  /**
   * 将提供者特定的工具调用转换为 MCP 工具响应
   */
  protected abstract convertToolCallsToMcpResponses(
    toolCalls: any[],
    mcpTools: MCPTool[]
  ): MCPToolResponse[];

  /**
   * 处理工具使用（XML 格式）
   */
  protected async processToolUses(
    content: string,
    mcpTools: MCPTool[],
    onToolUpdate?: (toolResponse: MCPToolResponse, result: MCPCallToolResponse) => void
  ): Promise<any[]> {
    if (!content || !mcpTools || mcpTools.length === 0) {
      return [];
    }

    const results = await parseAndCallTools(
      content,
      mcpTools,
      onToolUpdate
    );

    // 从内容中解析工具响应
    const toolResponses = parseToolUse(content, mcpTools);

    return results.map((result, index) => {
      if (index < toolResponses.length) {
        return this.mcpToolCallResponseToMessage(toolResponses[index], result, this.model);
      }
      return null;
    }).filter(Boolean);
  }

  /**
   * 获取系统提示词（包含 MCP 工具信息）
   */
  protected getSystemPromptWithTools(basePrompt: string, mcpTools: MCPTool[]): string {
    if (!mcpTools || mcpTools.length === 0) {
      return basePrompt;
    }

    const mcpPrompt = getMCPSystemPrompt(mcpTools);

    return basePrompt + mcpPrompt;
  }
}

/**
 * OpenAI 兼容提供者
 */
export class OpenAICompatibleProvider extends BaseAIProvider {
  public convertMcpTools<T>(mcpTools: MCPTool[]): T[] {
    return mcpToolsToOpenAITools(mcpTools) as T[];
  }

  public mcpToolCallResponseToMessage(
    mcpToolResponse: MCPToolResponse,
    resp: MCPCallToolResponse,
    _model: Model
  ): any {
    if ('toolCallId' in mcpToolResponse && mcpToolResponse.toolCallId) {
      return {
        role: 'tool',
        tool_call_id: mcpToolResponse.toolCallId,
        content: JSON.stringify(resp.content)
      };
    }

    return {
      role: 'user',
      content: `工具 ${mcpToolResponse.tool.name} 的执行结果: ${JSON.stringify(resp.content)}`
    };
  }

  protected convertToolCallsToMcpResponses(
    toolCalls: any[],
    mcpTools: MCPTool[]
  ): MCPToolResponse[] {
    const results: MCPToolResponse[] = [];

    for (let index = 0; index < toolCalls.length; index++) {
      const toolCall = toolCalls[index];
      const mcpTool = mcpTools.find(tool =>
        tool.id === toolCall.function?.name || tool.name === toolCall.function?.name
      );

      if (!mcpTool) {
        console.warn(`未找到工具: ${toolCall.function?.name}`);
        continue;
      }

      let parsedArgs;
      try {
        parsedArgs = JSON.parse(toolCall.function.arguments);
      } catch {
        parsedArgs = toolCall.function.arguments;
      }

      results.push({
        id: toolCall.id || `tool-${index}`,
        toolCallId: toolCall.id,
        tool: mcpTool,
        arguments: parsedArgs,
        status: 'pending' as const
      });
    }

    return results;
  }
}

/**
 * Anthropic 兼容提供者
 */
export class AnthropicCompatibleProvider extends BaseAIProvider {
  public convertMcpTools<T>(mcpTools: MCPTool[]): T[] {
    return mcpToolsToAnthropicTools(mcpTools) as T[];
  }

  public mcpToolCallResponseToMessage(
    mcpToolResponse: MCPToolResponse,
    resp: MCPCallToolResponse,
    _model: Model
  ): any {
    if ('toolUseId' in mcpToolResponse && mcpToolResponse.toolUseId) {
      return {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: mcpToolResponse.toolUseId,
            content: resp.isError ?
              `Error: ${JSON.stringify(resp.content)}` :
              JSON.stringify(resp.content)
          }
        ]
      };
    }

    return {
      role: 'user',
      content: `工具 ${mcpToolResponse.tool.name} 的执行结果: ${JSON.stringify(resp.content)}`
    };
  }

  protected convertToolCallsToMcpResponses(
    toolCalls: any[],
    mcpTools: MCPTool[]
  ): MCPToolResponse[] {
    const results: MCPToolResponse[] = [];

    for (let index = 0; index < toolCalls.length; index++) {
      const toolCall = toolCalls[index];
      const mcpTool = mcpTools.find(tool =>
        tool.id === toolCall.name || tool.name === toolCall.name
      );

      if (!mcpTool) {
        console.warn(`未找到工具: ${toolCall.name}`);
        continue;
      }

      results.push({
        id: toolCall.id || `tool-${index}`,
        toolUseId: toolCall.id,
        tool: mcpTool,
        arguments: toolCall.input,
        status: 'pending' as const
      });
    }

    return results;
  }
}

/**
 * OpenAI Responses API 基础提供者
 * 专门用于处理 OpenAI Responses API 的移动端适配
 */
export abstract class BaseOpenAIResponseProvider extends BaseAIProvider {
  protected abstract sdk: any; // OpenAI SDK 实例

  /**
   * 完成对话生成 - 使用 Responses API
   */
  public abstract completions(params: {
    messages: any[];
    assistant: any;
    mcpTools?: MCPTool[];
    onChunk?: (chunk: Chunk) => void;
    onFilterMessages?: (messages: any[]) => void;
  }): Promise<void>;

  /**
   * 获取消息参数 - 适配 Responses API 格式
   */
  protected abstract getResponseMessageParam(message: any, model: Model): Promise<any>;

  /**
   * 获取服务层级配置
   */
  protected getServiceTier(_model: Model): string | undefined {
    // 移动端默认使用 auto 层级
    return 'auto';
  }

  /**
   * 获取超时配置 - 移动端优化
   */
  protected getTimeout(_model: Model): number {
    // 移动端网络环境不稳定，适当延长超时时间
    return 3 * 60 * 1000; // 3分钟
  }

  /**
   * 获取推理努力配置
   */
  protected getResponseReasoningEffort(_assistant: any, _model: Model): any {
    // 移动端暂不支持推理努力配置
    return {};
  }

  /**
   * 处理流式响应
   */
  protected abstract processStream(
    stream: any,
    onChunk: (chunk: Chunk) => void,
    finalUsage: Usage,
    finalMetrics: Metrics,
    toolResponses: MCPToolResponse[]
  ): Promise<void>;

  /**
   * 处理工具调用 - Responses API 格式
   */
  protected abstract processToolCalls(
    mcpTools: MCPTool[],
    toolCalls: any[]
  ): Promise<any[]>;

  /**
   * 处理工具使用 - XML 格式
   */
  protected abstract processToolUses(content: string): Promise<any[]>;

  /**
   * 获取模型列表
   */
  public abstract getModels(): Promise<any[]>;

  /**
   * 测试 API 连接
   */
  public abstract testConnection(): Promise<boolean>;
}

/**
 * 创建 AI 提供者实例
 */
export function createAIProvider(model: Model): BaseAIProvider {
  const modelId = model.id.toLowerCase();

  // 判断是否为 Anthropic 模型
  if (modelId.includes('claude') || modelId.includes('anthropic')) {
    return new AnthropicCompatibleProvider(model);
  }

  // 默认使用 OpenAI 兼容提供者
  return new OpenAICompatibleProvider(model);
}
