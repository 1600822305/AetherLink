/**
 * OpenAI工具调用模块
 * 负责处理函数调用和工具使用
 */
import type OpenAI from 'openai';
import {
  ToolType as ToolTypeEnum,
  type ToolTypeValue,
  THINKING_TOOL,
  WEB_SEARCH_TOOL,
  CODE_TOOL
} from '../../types/tools';
import { isReasoningModel } from '../../../config/models';
import type { MCPTool, MCPToolResponse, MCPCallToolResponse, Model } from '../../types';
import { splitMcpToolContent, toImageDataUrl } from '../../utils/mcpToolResultContent';
import { createLogger } from '../../services/infra/logger';

const logger = createLogger('OpenAI Tools');


// 重新导出工具类型和工具定义，保持向后兼容
export const ToolType = ToolTypeEnum;
export type ToolType = ToolTypeValue;
export { THINKING_TOOL, WEB_SEARCH_TOOL, CODE_TOOL };

/**
 * 创建思考工具参数
 * @param modelId 模型ID
 * @returns 包含思考工具的参数对象
 */
export function createThinkingToolParams(modelId: string): any {
  // 使用导入的模型检测函数判断是否支持推理
  if (isReasoningModel({ id: modelId, name: modelId, provider: 'openai' } as any)) {
    return {
      tools: [THINKING_TOOL],
      tool_choice: "auto"
    };
  }

  return {};
}

/**
 * 解析思考工具调用
 * @param toolCall 工具调用对象
 * @returns 思考内容
 */
export function parseThinkingToolCall(toolCall: any): string | null {
  if (!toolCall || !toolCall.function || toolCall.function.name !== 'thinking') {
    return null;
  }

  try {
    if (toolCall.function?.arguments) {
      const argumentsPart = toolCall.function.arguments;
      try {
        const parsedArgs = JSON.parse(argumentsPart);
        if (parsedArgs.thinking) {
          return parsedArgs.thinking;
        }
      } catch (e) {
        // 如果JSON解析失败，直接返回参数
        return argumentsPart;
      }
    }
  } catch (e) {
    logger.error('解析思考工具调用失败', e);
  }

  return null;
}

/**
 * 检查消息中是否包含思考提示
 * @param messages 消息数组
 * @returns 是否包含思考提示
 */
export function hasThinkingPrompt(messages: OpenAI.Chat.ChatCompletionMessageParam[]): boolean {
  return messages.some(msg =>
    msg.role === 'system' &&
    typeof msg.content === 'string' &&
    (msg.content.includes('thinking') ||
     msg.content.includes('reasoning') ||
     msg.content.includes('思考过程'))
  );
}

/**
 * 解析通用工具调用
 * @param toolCall 工具调用对象
 * @returns 解析结果 {toolName, args}
 */
export function parseToolCall(toolCall: any): { toolName: string; args: any } | null {
  if (!toolCall || !toolCall.function || !toolCall.function.name) {
    return null;
  }

  try {
    const toolName = toolCall.function.name;
    let args = {};

    if (toolCall.function?.arguments) {
      try {
        args = JSON.parse(toolCall.function.arguments);
      } catch (e) {
        logger.error(`解析工具参数失败: ${toolName}`, e);
        args = { raw: toolCall.function.arguments };
      }
    }

    return { toolName, args };
  } catch (e) {
    logger.error('解析工具调用失败', e);
    return null;
  }
}

/**
 * 创建工具参数
 * @param toolTypes 工具类型列表
 * @returns 包含工具的参数对象
 */
export function createToolsParams(toolTypes: ToolType[]): any {
  const tools = [];

  if (toolTypes.includes(ToolType.THINKING)) {
    tools.push(THINKING_TOOL);
  }

  if (toolTypes.includes(ToolType.WEB_SEARCH)) {
    tools.push(WEB_SEARCH_TOOL);
  }

  if (toolTypes.includes(ToolType.CODE)) {
    tools.push(CODE_TOOL);
  }

  if (tools.length === 0) {
    return {};
  }

  return {
    tools,
    tool_choice: "auto"
  };
}

/**
 * 将OpenAI工具转换为通用工具
 * @param tools 工具列表
 * @param toolCall 工具调用
 * @returns 通用工具
 */
export function openAIToolToTool(tools: any[], toolCall: any): any {
  // 如果没有工具或工具调用，返回undefined
  if (!tools || !toolCall) {
    return undefined;
  }

  // 查找匹配的工具
  const tool = tools.find((t) => {
    if ('name' in toolCall) {
      return t.function?.name === toolCall.name;
    } else if (toolCall.function) {
      return t.function?.name === toolCall.function.name;
    }
    return false;
  });

  // 如果找不到工具，返回undefined
  if (!tool) {
    logger.warn('未找到匹配的工具:', toolCall);
    return undefined;
  }

  // 转换为通用工具
  return {
    id: tool.function.name,
    name: tool.function.name,
    description: tool.function.description,
    inputSchema: tool.function.parameters
  };
}

/**
 * 将 MCP 工具转换为 OpenAI 工具格式
 * @param mcpTools MCP工具列表
 * @returns OpenAI格式的工具列表
 */
export function convertMcpToolsToOpenAI<T>(mcpTools: MCPTool[]): T[] {
  return mcpTools.map((tool) => {
    // 清理工具名称，确保符合各种模型的要求
    let toolName = tool.id || tool.name;

    // 如果名称以数字开头，添加前缀
    if (/^\d/.test(toolName)) {
      toolName = `mcp_${toolName}`;
    }

    // 移除不允许的字符，只保留字母、数字、下划线、点和短横线
    toolName = toolName.replace(/[^a-zA-Z0-9_.-]/g, '_');

    // 确保名称不超过64个字符
    if (toolName.length > 64) {
      toolName = toolName.substring(0, 64);
    }

    // 确保名称以字母或下划线开头
    if (!/^[a-zA-Z_]/.test(toolName)) {
      toolName = `tool_${toolName}`;
    }

    logger.debug(`转换工具名称: ${tool.id || tool.name} -> ${toolName}`);

    return {
      type: 'function',
      function: {
        name: toolName,
        description: tool.description,
        parameters: tool.inputSchema
      }
    };
  }) as T[];
}

/**
 * 将 MCP 工具调用响应转换为 OpenAI 消息格式
 *
 * 注意：OpenAI Chat Completions 中 `tool`/`system` 角色不允许带图片，
 * 仅 `user` 角色可以。因此当工具返回图片时：
 * - 函数调用模式：返回 [tool 文本消息, user 图片消息] 两条
 * - 提示词注入模式：返回单条 user 多模态消息（文本 XML + 图片）
 * 出处：https://community.openai.com/t/allowing-images-in-non-user-messages/804176
 *
 * @param mcpToolResponse MCP工具响应
 * @param resp MCP调用工具响应
 * @param model 模型对象
 * @returns OpenAI消息格式（单条对象或多条数组）
 */
export function mcpToolCallResponseToOpenAIMessage(
  mcpToolResponse: MCPToolResponse,
  resp: MCPCallToolResponse,
  _model: Model
): any {
  // 拆分文本与图片，避免图片被 JSON.stringify 成乱码文本
  const { text, images } = splitMcpToolContent(resp);
  const contentText = (text && text.trim())
    ? text
    : (images.length > 0 ? '（工具返回了图片，见下一条消息）' : '工具调用完成，但没有返回内容');

  // 获取工具名称
  const toolName = mcpToolResponse.tool.name || mcpToolResponse.tool.id || 'unknown';

  const imageParts = images.map((img) => ({
    type: 'image_url' as const,
    image_url: { url: toImageDataUrl(img) }
  }));

  // 函数调用模式：使用 OpenAI 原生 tool 角色（仅文本），图片另起一条 user 消息
  if ('toolCallId' in mcpToolResponse && mcpToolResponse.toolCallId) {
    const toolMessage = {
      role: 'tool',
      tool_call_id: mcpToolResponse.toolCallId,
      content: contentText
    };
    if (imageParts.length > 0) {
      return [
        toolMessage,
        { role: 'user', content: imageParts }
      ];
    }
    return toolMessage;
  }

  // 提示词注入模式：使用 XML 格式，与系统提示中的格式保持一致
  const xmlText = `<tool_use_result>\n  <name>${toolName}</name>\n  <result>${contentText}</result>\n</tool_use_result>`;
  if (imageParts.length > 0) {
    return {
      role: 'user',
      content: [
        { type: 'text' as const, text: xmlText },
        ...imageParts
      ]
    };
  }
  return {
    role: 'user',
    content: xmlText
  };
}

/**
 * 根据名称查找 MCP 工具
 * @param mcpTools MCP工具列表
 * @param toolName 工具名称
 * @returns 找到的MCP工具或undefined
 */
export function findMcpToolByName(mcpTools: MCPTool[], toolName: string): MCPTool | undefined {
  return mcpTools.find(tool => {
    // 检查原始名称
    if (tool.id === toolName || tool.name === toolName) {
      return true;
    }

    // 检查转换后的名称
    let convertedName = tool.id || tool.name;
    if (/^\d/.test(convertedName)) {
      convertedName = `mcp_${convertedName}`;
    }
    convertedName = convertedName.replace(/[^a-zA-Z0-9_.-]/g, '_');
    if (convertedName.length > 64) {
      convertedName = convertedName.substring(0, 64);
    }
    if (!/^[a-zA-Z_]/.test(convertedName)) {
      convertedName = `tool_${convertedName}`;
    }

    return convertedName === toolName;
  });
}

/**
 * 将工具调用转换为 MCP 工具响应
 * @param toolCalls 工具调用列表
 * @param mcpTools MCP工具列表
 * @returns MCP工具响应列表
 */
export function convertToolCallsToMcpResponses(
  toolCalls: any[],
  mcpTools: MCPTool[]
): MCPToolResponse[] {
  return toolCalls.map((toolCall) => {
    const toolName = toolCall.function?.name ?? '';
    const mcpTool = findMcpToolByName(mcpTools, toolName);

    const parsedArgs = (() => {
      try {
        return JSON.parse(toolCall.function.arguments);
      } catch {
        return toolCall.function.arguments;
      }
    })();

    // 未匹配到的工具也保留一个占位 tool，绝不丢弃：保证每个 tool_call_id
    // 都会得到一条 role:'tool' 结果消息。未知工具在执行阶段会返回 isError
    // 结果，从而让下一轮请求的 tool_calls 与 tool 结果数量始终一致，避免
    // OpenAI / 兼容端点因数量不匹配而 400。
    const tool: MCPTool = mcpTool ?? {
      name: toolName,
      serverName: '',
      serverId: ''
    };

    return {
      id: toolCall.id,
      toolCallId: toolCall.id,
      tool,
      arguments: parsedArgs,
      status: 'pending' as const
    } as MCPToolResponse;
  });
}
