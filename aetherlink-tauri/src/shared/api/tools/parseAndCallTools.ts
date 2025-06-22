/**
 * 工具调用处理函数
 * 负责解析和调用工具
 */
import { logApiRequest } from '../../services/LoggerService';
import type { Tool, ToolCallResponse, ToolResponse } from '../../types/tools';
import type { Model } from '../../types';

/**
 * 解析工具使用
 * @param content 内容
 * @param tools 可用工具列表
 * @returns 工具使用响应数组
 */
export function parseToolUse(content: string, tools: Tool[]): ToolResponse[] {
  if (!content || !tools || tools.length === 0) {
    return [];
  }

  // 工具使用模式：<tool_use><name>工具名</name><arguments>参数</arguments></tool_use>
  const toolUsePattern = /<tool_use>([\s\S]*?)<name>([\s\S]*?)<\/name>([\s\S]*?)<arguments>([\s\S]*?)<\/arguments>([\s\S]*?)<\/tool_use>/g;
  const toolResponses: ToolResponse[] = [];
  let match;
  let idx = 0;

  // 查找所有工具使用块
  while ((match = toolUsePattern.exec(content)) !== null) {
    const toolName = match[2].trim();
    const toolArgs = match[4].trim();

    // 尝试解析参数为JSON
    let parsedArgs;
    try {
      parsedArgs = JSON.parse(toolArgs);
    } catch (error) {
      // 如果解析失败，使用原始字符串
      parsedArgs = toolArgs;
    }

    const tool = tools.find((t) => t.id === toolName || t.name === toolName);
    if (!tool) {
      console.error(`工具 "${toolName}" 未在工具列表中找到`);
      continue;
    }

    // 添加到工具数组
    toolResponses.push({
      id: `${toolName}-${idx++}`, // 为每个工具使用生成唯一ID
      toolUseId: tool.id,
      tool: tool,
      arguments: parsedArgs,
      status: 'pending'
    });
  }

  return toolResponses;
}

/**
 * 调用工具
 * @param toolResponse 工具响应
 * @returns 工具调用响应
 */
export async function callTool(toolResponse: ToolResponse): Promise<ToolCallResponse> {
  console.log(`[工具调用] 调用工具: ${toolResponse.tool.name}`, toolResponse.arguments);

  try {
    // 记录API请求
    logApiRequest('Tool Call', 'INFO', {
      method: 'POST',
      tool: toolResponse.tool.name,
      arguments: toolResponse.arguments
    });

    // 这里应该实现实际的工具调用逻辑
    // 目前只实现思考工具，其他工具返回模拟响应
    if (toolResponse.tool.name === 'thinking') {
      // 思考工具直接返回参数
      return {
        content: [
          {
            type: 'text',
            text: typeof toolResponse.arguments === 'object' && 'thinking' in toolResponse.arguments
              ? toolResponse.arguments.thinking as string
              : JSON.stringify(toolResponse.arguments)
          }
        ],
        isError: false
      };
    }

    // 其他工具返回模拟响应
    return {
      content: [
        {
          type: 'text',
          text: `工具 ${toolResponse.tool.name} 的响应: ${JSON.stringify(toolResponse.arguments)}`
        }
      ],
      isError: false
    };
  } catch (error) {
    console.error(`[工具调用] 调用工具 ${toolResponse.tool.name} 失败:`, error);

    // 返回错误响应
    return {
      content: [
        {
          type: 'text',
          text: `调用工具 ${toolResponse.tool.name} 失败: ${error instanceof Error ? error.message : String(error)}`
        }
      ],
      isError: true
    };
  }
}

/**
 * 将工具响应转换为消息
 * @param toolResponse 工具响应
 * @param resp 工具调用响应
 * @param model 模型
 * @returns 转换后的消息
 */
export function toolResponseToMessage(
  toolResponse: ToolResponse,
  resp: ToolCallResponse,
  _model: Model
): any {
  // 根据工具响应类型构建不同的消息
  if ('toolUseId' in toolResponse && toolResponse.toolUseId) {
    // 工具使用响应
    return {
      role: 'tool',
      content: resp.content.map(c => c.text).join('\n')
    };
  } else if ('toolCallId' in toolResponse && toolResponse.toolCallId) {
    // 工具调用响应
    return {
      role: 'tool',
      tool_call_id: toolResponse.toolCallId,
      content: resp.content.map(c => c.text).join('\n')
    };
  }

  // 默认返回undefined
  return undefined;
}

/**
 * 解析和调用工具
 * @param content 内容或工具响应数组
 * @param allToolResponses 所有工具响应
 * @param onUpdate 更新回调
 * @param convertToMessage 转换为消息的函数
 * @param model 模型
 * @param tools 可用工具列表
 * @returns 转换后的消息数组
 */
export async function parseAndCallTools<R>(
  content: string | ToolResponse[],
  allToolResponses: ToolResponse[],
  onUpdate?: (content: string, reasoning?: string) => void,
  convertToMessage: (toolResponse: ToolResponse, resp: ToolCallResponse, model: Model) => R | undefined = toolResponseToMessage,
  _model?: Model,
  tools: Tool[] = []
): Promise<R[]> {
  const toolResults: R[] = [];
  let currentToolResponses: ToolResponse[] = [];

  // 处理输入
  if (Array.isArray(content)) {
    currentToolResponses = content;
  } else {
    // 处理工具使用
    currentToolResponses = parseToolUse(content, tools);
  }

  // 如果没有工具响应，直接返回
  if (!currentToolResponses || currentToolResponses.length === 0) {
    return toolResults;
  }

  // 处理每个工具响应
  for (const toolResponse of currentToolResponses) {
    try {
      // 更新状态
      toolResponse.status = 'running';

      // 调用工具
      const resp = await callTool(toolResponse);

      // 更新状态和响应
      toolResponse.status = resp.isError ? 'error' : 'completed';
      toolResponse.response = resp;

      // 添加到所有工具响应
      allToolResponses.push(toolResponse);

      // 转换为消息
      if (_model) {
        const message = convertToMessage(toolResponse, resp, _model);
        if (message) {
          toolResults.push(message);
        }
      }

      // 更新UI
      if (onUpdate && resp.content && resp.content.length > 0) {
        const textContent = resp.content
          .filter(c => c.type === 'text' && c.text)
          .map(c => c.text)
          .join('\n');

        if (textContent) {
          onUpdate(textContent);
        }
      }
    } catch (error) {
      console.error(`[工具调用] 处理工具响应失败:`, error);

      // 更新状态
      toolResponse.status = 'error';
      toolResponse.response = {
        content: [
          {
            type: 'text',
            text: `处理工具响应失败: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      };

      // 添加到所有工具响应
      allToolResponses.push(toolResponse);
    }
  }

  return toolResults;
}
