/**
 * AI SDK 工具调用模块
 * 将 MCP 工具转换为 AI SDK 格式（使用 OpenAI Function Calling 兼容格式）
 */
import type { MCPTool, MCPToolResponse, MCPCallToolResponse, Model } from '../../types';

// 复用 openai/tools.ts 中的类型定义
export { WEB_SEARCH_TOOL } from '../openai/tools';

/**
 * 将 MCP 工具转换为 AI SDK 工具格式
 * 返回 OpenAI Function Calling 兼容格式
 */
export function convertMcpToolsToAISDK(mcpTools: MCPTool[]): any[] {
  return mcpTools.map(mcpTool => {
    const toolName = mcpTool.name || '';
    if (!toolName) return null;

    return {
      type: 'function' as const,
      function: {
        name: toolName,
        description: mcpTool.description || '',
        parameters: mcpTool.inputSchema || { type: 'object', properties: {} }
      }
    };
  }).filter(Boolean);
}

/**
 * 将 MCP 工具转换为 OpenAI 格式
 */
export function convertMcpToolsToOpenAI<T = any>(mcpTools: MCPTool[]): T[] {
  return mcpTools.map(mcpTool => ({
    type: 'function',
    function: {
      name: mcpTool.name || '',
      description: mcpTool.description || '',
      parameters: mcpTool.inputSchema || { type: 'object', properties: {} }
    }
  })) as T[];
}

/**
 * 将 AI SDK 工具调用转换为 MCP 工具响应格式
 */
export function convertToolCallsToMcpResponses(
  toolCalls: any[],
  mcpTools: MCPTool[]
): MCPToolResponse[] {
  return toolCalls.map(toolCall => {
    const toolName = toolCall.function?.name || toolCall.toolName || '';
    const toolId = toolCall.id || toolCall.toolCallId || '';
    
    // 解析参数
    let args: Record<string, unknown> = {};
    try {
      if (typeof toolCall.function?.arguments === 'string') {
        args = JSON.parse(toolCall.function.arguments);
      } else if (toolCall.args) {
        args = toolCall.args;
      } else if (toolCall.input) {
        args = toolCall.input;
      }
    } catch (e) {
      console.warn(`[AI SDK Tools] 解析工具参数失败: ${e}`);
      args = toolCall.function?.arguments || toolCall.args || {};
    }

    // 查找对应的 MCP 工具
    const mcpTool = mcpTools.find(t => t.name === toolName);

    return {
      id: toolId,
      tool: mcpTool || { name: toolName, serverName: '', serverId: '' },
      arguments: args,
      status: 'pending' as const,
      toolCallId: toolId
    };
  });
}

/**
 * 将 MCP 工具调用响应转换为消息格式
 * 支持两种模式：
 * - AI SDK 格式：{ role: 'tool', content: [{ type: 'tool-result', ... }] }
 * - XML 提示词格式：{ role: 'user', content: '<tool_use_result>...</tool_use_result>' }
 */
export function mcpToolCallResponseToOpenAIMessage(
  mcpToolResponse: MCPToolResponse,
  resp: MCPCallToolResponse,
  _model: Model,
  useXmlFormat: boolean = false  // 默认使用 AI SDK 格式
): any {
  const toolCallId = mcpToolResponse.id || mcpToolResponse.toolCallId;
  const toolName = mcpToolResponse.tool?.name || '';
  
  // 处理响应内容
  let content = '';
  if (resp.content && Array.isArray(resp.content)) {
    content = resp.content
      .filter((c) => c.type === 'text')
      .map((c) => c.text || '')
      .join('\n');
  }

  // 如果有错误，添加错误信息
  if (resp.isError) {
    content = `Error: ${content || 'Unknown error'}`;
  }

  // XML 提示词模式：返回 user 角色的消息
  if (useXmlFormat) {
    const xmlResult = `<tool_use_result>
  <name>${toolName}</name>
  <result>${content}</result>
</tool_use_result>`;
    return {
      role: 'user',
      content: xmlResult
    };
  }

  // AI SDK 格式：返回 ToolModelMessage 格式
  // 参考：https://sdk.vercel.ai/docs/reference/ai-sdk-core/generate-text#toolmodelmessage
  return {
    role: 'tool',
    content: [{
      type: 'tool-result',
      toolCallId: toolCallId,
      toolName: toolName,
      result: content,
      isError: resp.isError || false
    }]
  };
}
