/**
 * MCP 工具调用中间件
 * 对标 Cherry Studio McpToolChunkMiddleware
 * 
 * 处理工具调用的收集、执行和递归
 */
import type { CompletionsMiddleware } from '../types';
import type { CompletionsResult, MCPTool, MCPToolResponse, MCPCallToolResponse } from '../schemas';
import { ChunkType, type Chunk } from '../../types/chunk';

export const MIDDLEWARE_NAME = 'McpToolChunkMiddleware';

/** 最大递归深度 */
const MAX_RECURSION_DEPTH = 10;

/**
 * 工具调用数据
 */
interface ToolCallData {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/**
 * MCP 工具调用中间件
 * 监听工具调用 Chunk，执行工具，构建结果消息，递归调用 LLM
 */
export const McpToolChunkMiddleware: CompletionsMiddleware = (_api) => (next) =>
  async (context, params): Promise<CompletionsResult> => {
    const { mcpTools, onChunk, mcpMode } = params;
    const { _internal } = context;

    // 如果没有工具或使用提示词模式，跳过
    if (!mcpTools?.length || mcpMode === 'prompt') {
      return next(context, params);
    }

    // 检查递归深度
    const { recursionDepth } = _internal.toolProcessingState;
    if (recursionDepth >= MAX_RECURSION_DEPTH) {
      console.warn(`[McpToolChunkMiddleware] Max recursion depth reached: ${recursionDepth}`);
      return next(context, params);
    }

    console.log(`[McpToolChunkMiddleware] Depth: ${recursionDepth}, Tools: ${mcpTools.length}`);

    // 收集工具调用
    const toolCalls: ToolCallData[] = [];
    let hasToolCalls = false;

    // 包装 onChunk 以拦截工具调用
    const wrappedOnChunk = async (chunk: Chunk) => {
      if (chunk.type === ChunkType.MCP_TOOL_IN_PROGRESS) {
        const toolChunk = chunk as any;
        if (toolChunk.tool) {
          toolCalls.push({
            id: toolChunk.tool.id || `tool_${Date.now()}_${toolCalls.length}`,
            name: toolChunk.tool.name,
            arguments: toolChunk.tool.arguments || {},
          });
        }
      } else if (chunk.type === ChunkType.MCP_TOOL_COMPLETE) {
        hasToolCalls = true;
        const completeChunk = chunk as any;
        if (completeChunk.responses) {
          for (const resp of completeChunk.responses) {
            toolCalls.push({
              id: resp.id || `tool_${Date.now()}_${toolCalls.length}`,
              name: resp.name,
              arguments: resp.arguments || {},
            });
          }
        }
      }

      // 转发给原始回调
      if (onChunk) {
        await onChunk(chunk);
      }
    };

    // 执行下游中间件
    const result = await next(context, { ...params, onChunk: wrappedOnChunk });

    // 如果有工具调用，执行并递归
    if ((hasToolCalls || toolCalls.length > 0) && toolCalls.length > 0) {
      return handleToolCalls(context, params, toolCalls, result, mcpTools);
    }

    return result;
  };

/**
 * 处理工具调用
 */
async function handleToolCalls(
  context: any,
  params: any,
  toolCalls: ToolCallData[],
  previousResult: CompletionsResult,
  mcpTools: MCPTool[]
): Promise<CompletionsResult> {
  const { apiClientInstance, _internal } = context;
  const { onChunk } = params;

  console.log(`[McpToolChunkMiddleware] Executing ${toolCalls.length} tool calls`);

  // 发送工具调用开始事件
  for (const toolCall of toolCalls) {
    if (onChunk) {
      await onChunk({
        type: ChunkType.MCP_TOOL_CALL_BEGIN as any,
        tool: toolCall,
      } as any);
    }
  }

  // 执行所有工具调用
  const toolResults: Array<{
    toolCall: ToolCallData;
    result: MCPCallToolResponse;
    mcpTool: MCPTool;
  }> = [];

  for (const toolCall of toolCalls) {
    const mcpTool = mcpTools.find(t => 
      t.name === toolCall.name || t.id === toolCall.name
    );

    if (!mcpTool) {
      console.warn(`[McpToolChunkMiddleware] Tool not found: ${toolCall.name}`);
      continue;
    }

    try {
      // 执行工具（这里需要调用 MCP 服务）
      const result = await executeMcpTool(mcpTool, toolCall.arguments);

      toolResults.push({ toolCall, result, mcpTool });

      // 发送工具结果事件
      if (onChunk) {
        await onChunk({
          type: ChunkType.MCP_TOOL_CALL_RESPONSE as any,
          tool: toolCall,
          result,
        } as any);
      }
    } catch (error) {
      console.error(`[McpToolChunkMiddleware] Tool execution failed:`, error);

      const errorResult: MCPCallToolResponse = {
        content: [{
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        }],
        isError: true,
      };

      toolResults.push({ toolCall, result: errorResult, mcpTool });

      if (onChunk) {
        await onChunk({
          type: ChunkType.MCP_TOOL_CALL_ERROR as any,
          tool: toolCall,
          error: error instanceof Error ? error.message : String(error),
        } as any);
      }
    }
  }

  // 如果没有成功的工具调用，返回当前结果
  if (toolResults.length === 0) {
    return previousResult;
  }

  // 构建新的消息列表（包含工具结果）
  const currentMessages = apiClientInstance.extractMessagesFromSdkPayload(
    _internal.sdkPayload
  );

  // 转换工具结果为消息
  const toolResultMessages = toolResults
    .map(({ toolCall, result, mcpTool }) => {
      const toolResponse: MCPToolResponse = {
        id: toolCall.id,
        toolCallId: toolCall.id,
        tool: mcpTool,
        arguments: toolCall.arguments,
        status: result.isError ? 'error' : 'done',
        response: result,
      };
      return apiClientInstance.convertMcpToolResponseToSdkMessageParam(
        toolResponse,
        result,
        params.assistant?.model
      );
    })
    .filter(Boolean);

  // 构建包含工具调用的助手消息
  const sdkToolCalls = toolCalls.map(tc => ({
    id: tc.id,
    type: 'function' as const,
    function: {
      name: tc.name,
      arguments: JSON.stringify(tc.arguments),
    },
  }));

  const newMessages = apiClientInstance.buildSdkMessages(
    currentMessages,
    previousResult.rawOutput,
    toolResultMessages,
    sdkToolCalls
  );

  // 更新递归状态
  _internal.toolProcessingState.recursionDepth += 1;
  _internal.toolProcessingState.isRecursiveCall = true;

  // 递归调用
  console.log(`[McpToolChunkMiddleware] Recursive call, depth: ${_internal.toolProcessingState.recursionDepth}`);

  // 使用 enhancedDispatch 进行递归
  if (_internal.enhancedDispatch) {
    // 更新 sdkPayload 中的 messages
    const updatedPayload = {
      ..._internal.sdkPayload,
      messages: newMessages,
    };
    _internal.sdkPayload = updatedPayload;

    return _internal.enhancedDispatch(context, {
      ...params,
      messages: newMessages as any,
    });
  }

  // Fallback：返回当前结果
  return previousResult;
}

/**
 * 执行 MCP 工具
 * TODO: 需要与 MCP 服务集成
 */
async function executeMcpTool(
  tool: MCPTool,
  args: Record<string, unknown>
): Promise<MCPCallToolResponse> {
  console.log(`[McpToolChunkMiddleware] Executing tool: ${tool.name}`, args);

  // 这里需要调用 MCP 服务
  // 目前返回模拟结果
  try {
    // 尝试通过 window.api 调用 MCP（如果可用）
    if (typeof window !== 'undefined' && (window as any).api?.mcp?.callTool) {
      const result = await (window as any).api.mcp.callTool(
        tool.serverId,
        tool.name,
        args
      );
      return result;
    }

    // 模拟结果
    return {
      content: [{
        type: 'text',
        text: `Tool "${tool.name}" executed with args: ${JSON.stringify(args)}`,
      }],
      isError: false,
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Error executing tool: ${error instanceof Error ? error.message : String(error)}`,
      }],
      isError: true,
    };
  }
}
