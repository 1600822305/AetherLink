/**
 * AI SDK 工具调用模块
 * 将 MCP 工具转换为 AI SDK 格式（使用 OpenAI Function Calling 兼容格式）
 */
import type { MCPTool, MCPToolResponse, MCPCallToolResponse, Model } from '../../types';
import { splitMcpToolContent, toImageDataUrl } from '../../utils/mcpToolResultContent';
import { createLogger } from '../../services/infra/logger';

const logger = createLogger('AI SDK Tools');


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
      logger.warn(`解析工具参数失败: ${e}`);
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

  // 拆分文本与图片，避免图片被丢弃
  const { text, images } = splitMcpToolContent(resp);
  const displayText = resp.isError ? `Error: ${text || 'Unknown error'}` : text;

  // XML 提示词模式：返回 user 角色的消息
  // user 角色所有 Provider 都允许带图，因此把图片作为多模态 part 附上（AI SDK 原生格式）
  if (useXmlFormat) {
    const xmlResult = `<tool_use_result>
  <name>${toolName}</name>
  <result>${displayText}</result>
</tool_use_result>`;
    if (images.length > 0) {
      return {
        role: 'user',
        content: [
          { type: 'text', text: xmlResult },
          ...images.map((img) => ({ type: 'image', image: toImageDataUrl(img) }))
        ]
      };
    }
    return {
      role: 'user',
      content: xmlResult
    };
  }

  // AI SDK 格式：返回 ToolModelMessage 格式（v6 使用 output: ToolResultOutput）
  // 参考：https://ai-sdk.dev/docs/reference/ai-sdk-core/model-message
  //
  // 注意：OpenAI Chat Completions 会把 tool 结果的 content 数组整体 JSON.stringify
  //（见 @ai-sdk/openai convertToOpenAIChatMessages），无法在 tool 角色里真正传图。
  // 因此 tool 消息只放文本，图片另起一条 user 消息（user 角色 chat/responses 都支持图片）。
  const toolMessage = {
    role: 'tool',
    content: [{
      type: 'tool-result',
      toolCallId: toolCallId,
      toolName: toolName,
      output: resp.isError
        ? { type: 'error-text', value: text || 'Unknown error' }
        : { type: 'text', value: text }
    }]
  };

  if (images.length > 0) {
    return [
      toolMessage,
      {
        role: 'user',
        content: images.map((img) => ({ type: 'image', image: toImageDataUrl(img) }))
      }
    ];
  }

  return toolMessage;
}
