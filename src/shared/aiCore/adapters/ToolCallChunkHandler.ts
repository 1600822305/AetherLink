/**
 * 工具调用 Chunk 处理模块
 * 完全参考 Cherry Studio handleToolCallChunk.ts 实现
 * 提供工具调用相关的处理API，每个交互使用一个新的实例
 */

import type { Chunk } from '../../types/chunk';
import { ChunkType } from '../../types/chunk';

/**
 * 基础工具类型
 */
export interface BaseTool {
  id: string;
  name: string;
  description?: string;
  type?: 'builtin' | 'provider' | 'mcp';
  serverId?: string;
  inputSchema?: unknown;
}

/**
 * MCP 工具类型
 */
export interface MCPTool extends BaseTool {
  serverId?: string;
}

/**
 * MCP 工具响应类型
 */
export interface MCPToolResponse {
  id: string;
  tool: BaseTool;
  arguments: Record<string, any>;
  status: 'pending' | 'running' | 'done' | 'error';
  response?: unknown;
  toolCallId: string;
}

/**
 * 普通工具响应类型
 */
export interface NormalToolResponse {
  id: string;
  tool: BaseTool;
  arguments: Record<string, any>;
  status: 'pending' | 'running' | 'done' | 'error';
  response?: unknown;
  toolCallId: string;
}

/**
 * MCP 调用工具响应
 */
export interface MCPCallToolResponse {
  content: MCPToolResultContent[];
  isError?: boolean;
}

/**
 * MCP 工具结果内容
 */
export interface MCPToolResultContent {
  type: 'text' | 'image' | 'resource';
  text?: string;
  data?: string;
  mimeType?: string;
}

/**
 * 工具调用映射类型
 */
export type ToolcallsMap = {
  toolCallId: string;
  toolName: string;
  args: any;
  tool: BaseTool;
};

/**
 * AI SDK 工具调用类型
 */
export interface TypedToolCall {
  type: 'tool-call';
  toolCallId: string;
  toolName: string;
  input?: any;
  args?: any;
  providerExecuted?: boolean;
}

/**
 * AI SDK 工具结果类型
 */
export interface TypedToolResult {
  type: 'tool-result';
  toolCallId: string;
  output: unknown;
  input?: any;
}

/**
 * AI SDK 工具错误类型
 */
export interface TypedToolError {
  type: 'tool-error';
  toolCallId: string;
  error: unknown;
  input?: any;
}

/**
 * 工具调用处理器类
 */
export class ToolCallChunkHandler {
  private static globalActiveToolCalls = new Map<string, ToolcallsMap>();

  private activeToolCalls = ToolCallChunkHandler.globalActiveToolCalls;

  constructor(
    private onChunk: (chunk: Chunk) => void,
    private mcpTools: MCPTool[]
  ) {}

  /**
   * 内部静态方法：添加活跃工具调用的核心逻辑
   */
  private static addActiveToolCallImpl(toolCallId: string, map: ToolcallsMap): boolean {
    if (!ToolCallChunkHandler.globalActiveToolCalls.has(toolCallId)) {
      ToolCallChunkHandler.globalActiveToolCalls.set(toolCallId, map);
      return true;
    }
    return false;
  }

  /**
   * 实例方法：添加活跃工具调用
   */
  private addActiveToolCall(toolCallId: string, map: ToolcallsMap): boolean {
    return ToolCallChunkHandler.addActiveToolCallImpl(toolCallId, map);
  }

  /**
   * 获取全局活跃的工具调用
   */
  public static getActiveToolCalls() {
    return ToolCallChunkHandler.globalActiveToolCalls;
  }

  /**
   * 静态方法：添加活跃工具调用（外部访问）
   */
  public static addActiveToolCall(toolCallId: string, map: ToolcallsMap): boolean {
    return ToolCallChunkHandler.addActiveToolCallImpl(toolCallId, map);
  }

  /**
   * 处理工具调用事件
   */
  public handleToolCall(chunk: { type: 'tool-call' } & TypedToolCall): void {
    const { toolCallId, toolName, input: args, providerExecuted } = chunk;

    if (!toolCallId || !toolName) {
      console.warn(`[ToolCallChunkHandler] Invalid tool call chunk: missing toolCallId or toolName`);
      return;
    }

    let tool: BaseTool;
    let mcpTool: MCPTool | undefined;

    // 根据 providerExecuted 标志区分处理逻辑
    if (providerExecuted) {
      // 如果是 Provider 执行的工具（如 web_search）
      console.log(`[ToolCallChunkHandler] Handling provider-executed tool: ${toolName}`);
      tool = {
        id: toolCallId,
        name: toolName,
        description: toolName,
        type: 'provider'
      } as BaseTool;
    } else if (toolName.startsWith('builtin_')) {
      // 如果是内置工具，沿用现有逻辑
      console.log(`[ToolCallChunkHandler] Handling builtin tool: ${toolName}`);
      tool = {
        id: toolCallId,
        name: toolName,
        description: toolName,
        type: 'builtin'
      } as BaseTool;
    } else if ((mcpTool = this.mcpTools.find((t) => t.name === toolName) as MCPTool)) {
      // 如果是客户端执行的 MCP 工具，沿用现有逻辑
      console.log(`[ToolCallChunkHandler] Handling client-side MCP tool: ${toolName}`);
      tool = mcpTool;
    } else {
      tool = {
        id: toolCallId,
        name: toolName,
        description: toolName,
        type: 'provider'
      };
    }

    this.addActiveToolCall(toolCallId, {
      toolCallId,
      toolName,
      args,
      tool
    });

    // 创建 MCPToolResponse 格式
    const toolResponse: MCPToolResponse | NormalToolResponse = {
      id: toolCallId,
      tool: tool,
      arguments: args,
      status: 'pending',
      toolCallId: toolCallId
    };

    // 调用 onChunk
    if (this.onChunk) {
      this.onChunk({
        type: ChunkType.MCP_TOOL_PENDING,
        responses: [toolResponse]
      } as any);
    }
  }

  /**
   * 处理工具调用结果事件
   */
  public handleToolResult(chunk: { type: 'tool-result' } & TypedToolResult): void {
    const { toolCallId, output, input } = chunk;

    if (!toolCallId) {
      console.warn(`[ToolCallChunkHandler] Invalid tool result chunk: missing toolCallId`);
      return;
    }

    // 查找对应的工具调用信息
    const toolCallInfo = this.activeToolCalls.get(toolCallId);
    if (!toolCallInfo) {
      console.warn(`[ToolCallChunkHandler] Tool call info not found for ID: ${toolCallId}`);
      return;
    }

    // 创建工具调用结果的 MCPToolResponse 格式
    const toolResponse: MCPToolResponse | NormalToolResponse = {
      id: toolCallInfo.toolCallId,
      tool: toolCallInfo.tool,
      arguments: input,
      status: 'done',
      response: output,
      toolCallId: toolCallId
    };

    // 从活跃调用中移除
    this.activeToolCalls.delete(toolCallId);

    // 调用 onChunk
    if (this.onChunk) {
      this.onChunk({
        type: ChunkType.MCP_TOOL_COMPLETE,
        responses: [toolResponse]
      } as any);

      // 提取图片
      const images = this.extractImagesFromToolOutput(toolResponse.response);

      if (images.length) {
        this.onChunk({
          type: ChunkType.IMAGE_CREATED
        });
        this.onChunk({
          type: ChunkType.IMAGE_COMPLETE,
          image: {
            type: 'base64',
            images: images
          }
        });
      }
    }
  }

  /**
   * 处理工具错误事件
   */
  public handleToolError(chunk: { type: 'tool-error' } & TypedToolError): void {
    const { toolCallId, error, input } = chunk;
    const toolCallInfo = this.activeToolCalls.get(toolCallId);
    if (!toolCallInfo) {
      console.warn(`[ToolCallChunkHandler] Tool call info not found for ID: ${toolCallId}`);
      return;
    }
    const toolResponse: MCPToolResponse | NormalToolResponse = {
      id: toolCallId,
      tool: toolCallInfo.tool,
      arguments: input,
      status: 'error',
      response: error,
      toolCallId: toolCallId
    };
    this.activeToolCalls.delete(toolCallId);
    if (this.onChunk) {
      this.onChunk({
        type: ChunkType.MCP_TOOL_COMPLETE,
        responses: [toolResponse]
      } as any);
    }
  }

  /**
   * 从工具输出中提取图片
   */
  private extractImagesFromToolOutput(output: unknown): string[] {
    if (!output) {
      return [];
    }

    const contents: unknown[] = [];

    if (this.isMcpCallToolResponse(output)) {
      contents.push(...output.content);
    } else if (Array.isArray(output)) {
      contents.push(...output);
    } else if (this.hasContentArray(output)) {
      contents.push(...output.content);
    }

    return contents
      .filter(this.isMcpImageContent)
      .map((content) => `data:${(content as any).mimeType ?? 'image/png'};base64,${(content as any).data}`);
  }

  private isMcpCallToolResponse(value: unknown): value is MCPCallToolResponse {
    return typeof value === 'object' && value !== null && Array.isArray((value as MCPCallToolResponse).content);
  }

  private hasContentArray(value: unknown): value is { content: unknown[] } {
    return typeof value === 'object' && value !== null && Array.isArray((value as { content?: unknown }).content);
  }

  private isMcpImageContent(content: unknown): content is MCPToolResultContent & { data: string } {
    if (typeof content !== 'object' || content === null) {
      return false;
    }

    const resultContent = content as MCPToolResultContent;

    return resultContent.type === 'image' && typeof resultContent.data === 'string';
  }
}

export const addActiveToolCall = ToolCallChunkHandler.addActiveToolCall.bind(ToolCallChunkHandler);
