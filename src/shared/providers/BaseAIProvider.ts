import type { Model, MCPTool, MCPToolResponse, MCPCallToolResponse, Usage, Metrics } from '../types';
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
   * 将提供者特定的工具调用转换为 MCP 工具响应
   */
  protected abstract convertToolCallsToMcpResponses(
    toolCalls: any[],
    mcpTools: MCPTool[]
  ): MCPToolResponse[];
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
