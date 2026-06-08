/**
 * AI SDK 工具调用模块
 * 将 MCP 工具转换为 AI SDK 的 ToolSet（Record<string, Tool>，供 streamText 使用）。
 */
import { tool, jsonSchema } from 'ai';
import type { MCPTool, MCPToolResponse, MCPCallToolResponse, Model } from '../../types';

// 复用 openai/tools.ts 中的类型定义
export { WEB_SEARCH_TOOL } from '../openai/tools';

/**
 * 规范化工具的 JSON Schema：AI SDK 要求函数参数 schema 顶层为 `type: "object"`。
 * MCP 工具可能给出缺失/为 null 的 type，这里兜底，避免被 AI SDK 校验拒绝。
 */
function normalizeToolSchema(inputSchema: unknown): Record<string, any> {
  if (!inputSchema || typeof inputSchema !== 'object') {
    return { type: 'object', properties: {} };
  }
  const schema: Record<string, any> = { ...(inputSchema as Record<string, any>) };
  if (schema.type == null) {
    schema.type = 'object';
  }
  if (schema.type === 'object' && schema.properties == null) {
    schema.properties = {};
  }
  return schema;
}

/**
 * 将 MCP 工具转换为 AI SDK 工具集（ToolSet）。
 * AI SDK 的 `streamText({ tools })` 需要 `Record<string, Tool>`（按工具名做 key，
 * 每个用 `tool()` 包装、参数用 `jsonSchema()` 描述），而非 OpenAI 的函数数组。
 */
export function convertMcpToolsToAISDK(mcpTools: MCPTool[]): Record<string, any> {
  const toolSet: Record<string, any> = {};
  for (const mcpTool of mcpTools) {
    const toolName = mcpTool.name || '';
    if (!toolName) continue;

    toolSet[toolName] = tool({
      description: mcpTool.description || '',
      inputSchema: jsonSchema(normalizeToolSchema(mcpTool.inputSchema))
    });
  }
  return toolSet;
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
