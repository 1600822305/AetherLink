/**
 * AI SDK Gemini 工具调用模块
 * 将 MCP 工具转换为 AI SDK 格式
 * 支持 Google Search 工具
 */
import type { MCPTool, MCPToolResponse, MCPCallToolResponse, Model } from '../../types';
import { splitMcpToolContent, buildAISDKToolOutput, toImageDataUrl } from '../../utils/mcpToolResultContent';
import { createLogger } from '../../services/infra/logger';

const logger = createLogger('Gemini AI SDK Tools');


/**
 * 将 MCP 工具转换为 AI SDK 工具格式
 * 返回 Function Calling 兼容格式
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
 * 将 MCP 工具转换为 Gemini 格式
 */
export function convertMcpToolsToGemini<T = any>(mcpTools: MCPTool[]): T[] {
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
    const toolName = toolCall.function?.name || toolCall.toolName || toolCall.name || '';
    const toolId = toolCall.id || toolCall.toolCallId || `tool_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    // 解析参数
    let args: Record<string, unknown> = {};
    try {
      if (typeof toolCall.function?.arguments === 'string') {
        args = JSON.parse(toolCall.function.arguments);
      } else if (toolCall.args) {
        args = toolCall.args;
      } else if (toolCall.input) {
        args = toolCall.input;
      } else if (toolCall.function?.arguments && typeof toolCall.function.arguments === 'object') {
        args = toolCall.function.arguments;
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
 * - Function Calling 模式：返回 { role: 'tool', ... }（由 AI SDK 内部处理）
 * - XML 提示词模式：返回 { role: 'user', content: '<tool_use_result>...</tool_use_result>' }
 */
export function mcpToolCallResponseToGeminiMessage(
  mcpToolResponse: MCPToolResponse,
  resp: MCPCallToolResponse,
  _model: Model,
  useXmlFormat: boolean = true  // 默认使用 XML 格式（因为主要用于 XML 模式）
): any {
  const toolName = mcpToolResponse.tool?.name || '';

  // 拆分文本与图片，避免图片被丢弃
  const { text, images } = splitMcpToolContent(resp);
  const displayText = resp.isError ? `Error: ${text || 'Unknown error'}` : text;

  // XML 提示词模式：返回 user 角色的消息，内容为 XML 格式的工具结果
  // AI SDK 只接受 user/assistant/system/tool 角色；user 角色允许带图
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

  // Function Calling 模式：返回 AI SDK 期望的 ToolModelMessage 格式（v6 使用 output）
  // 参考：https://ai-sdk.dev/docs/reference/ai-sdk-core/model-message
  // 多模态工具结果在 Gemini 3 系列支持
  const toolCallId = mcpToolResponse.id || mcpToolResponse.toolCallId;
  return {
    role: 'tool',
    content: [{
      type: 'tool-result',
      toolCallId: toolCallId,
      toolName: toolName,
      output: buildAISDKToolOutput(text, images, resp.isError || false)
    }]
  };
}

/**
 * 创建 Google Search 工具配置
 * 用于启用 Gemini 的 Google Search Grounding 功能
 */
export function createGoogleSearchTool(): any {
  // AI SDK @ai-sdk/google 中使用 google.tools.googleSearch()
  // 这里返回一个标记，在 stream.ts 中处理
  return {
    type: 'google_search',
    google_search: {}
  };
}

/**
 * 检查是否包含 Google Search 工具
 */
export function hasGoogleSearchTool(tools: any[]): boolean {
  return tools.some(tool => 
    tool.type === 'google_search' || 
    tool.name === 'google_search' ||
    tool.function?.name === 'google_search'
  );
}

/**
 * 过滤掉 Google Search 工具，返回普通 MCP 工具
 */
export function filterMcpTools(tools: any[]): any[] {
  return tools.filter(tool => 
    tool.type !== 'google_search' && 
    tool.name !== 'google_search' &&
    tool.function?.name !== 'google_search'
  );
}

/**
 * 解析 Gemini 的 grounding metadata
 */
export function parseGroundingMetadata(metadata: any): {
  searchQueries?: string[];
  webSearchResults?: any[];
  sources?: any[];
} {
  if (!metadata?.groundingMetadata) {
    return {};
  }

  const groundingMetadata = metadata.groundingMetadata;
  
  return {
    searchQueries: groundingMetadata.webSearchQueries || [],
    webSearchResults: groundingMetadata.groundingChunks || [],
    sources: groundingMetadata.groundingSupports || []
  };
}
