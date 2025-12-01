/**
 * MCP 工具解析器
 * 完全参考 Cherry Studio mcp-tools.ts 和 McpToolChunkMiddleware.ts 实现
 */

import type { MCPTool, MCPToolResponse, MCPCallToolResponse } from '../types';
import type { MCPToolPendingChunk, MCPToolInProgressChunk, MCPToolCompleteChunk } from '../types/chunk';
import { ChunkType } from '../types/chunk';
import { mcpService } from '../services/mcp';
import { nanoid } from './index';

// ==================== 核心函数：upsertMCPToolResponse ====================

/**
 * 更新或插入 MCP 工具响应状态
 * 完全参考 Cherry Studio mcp-tools.ts 的 upsertMCPToolResponse 实现
 * 
 * 这是工具调用状态管理的核心函数，负责：
 * 1. 维护 allToolResponses 数组（用于状态追踪）
 * 2. 根据状态发送对应的 Chunk 事件
 */
export function upsertMCPToolResponse(
  allToolResponses: MCPToolResponse[],
  resp: MCPToolResponse,
  onChunk: (chunk: MCPToolPendingChunk | MCPToolInProgressChunk | MCPToolCompleteChunk) => void
): void {
  const index = allToolResponses.findIndex((ret) => ret.id === resp.id);
  let result = resp;
  
  if (index !== -1) {
    // 更新已存在的工具响应
    const cur = {
      ...allToolResponses[index],
      response: resp.response,
      arguments: resp.arguments,
      status: resp.status
    };
    allToolResponses[index] = cur;
    result = cur;
  } else {
    // 插入新的工具响应
    allToolResponses.push(resp);
  }

  // 根据状态发送对应的 Chunk
  switch (resp.status) {
    case 'pending':
      onChunk({
        type: ChunkType.MCP_TOOL_PENDING,
        responses: [result]
      } as MCPToolPendingChunk);
      break;
    case 'invoking':
      onChunk({
        type: ChunkType.MCP_TOOL_IN_PROGRESS,
        responses: [result]
      } as MCPToolInProgressChunk);
      break;
    case 'done':
    case 'error':
      onChunk({
        type: ChunkType.MCP_TOOL_COMPLETE,
        responses: [result]
      } as MCPToolCompleteChunk);
      break;
    default:
      break;
  }
}

// ==================== 辅助函数 ====================

/**
 * 根据名称查找 MCP 工具（支持转换后的名称）
 */
function findMcpToolByName(mcpTools: MCPTool[], toolName: string): MCPTool | undefined {
  return mcpTools.find(tool => {
    // 检查原始名称
    if (tool.id === toolName || tool.name === toolName) {
      return true;
    }

    // 检查转换后的名称（参考 OpenAI 提供者的转换规则）
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
 * 解析 XML 格式的工具调用（批量解析）
 * 支持两种格式：
 * 1. <tool_use><name>工具名</name><arguments>参数</arguments></tool_use>
 * 2. <tool_name>参数</tool_name> (提示词注入模式)
 * 
 * @deprecated 推荐使用 ToolUseExtractionProcessor 进行流式解析，
 * 它能实现实时检测和幻觉防护。此函数仅保留用于批量解析场景。
 * @see src/shared/services/messages/responseHandlers/ToolUseExtractionProcessor.ts
 */
export function parseToolUse(content: string, mcpTools: MCPTool[]): MCPToolResponse[] {
  if (!content || typeof content !== 'string' || !mcpTools || mcpTools.length === 0) {
    return [];
  }

  // 工具使用模式：<tool_use><name>工具名</name><arguments>参数</arguments></tool_use>
  const toolUsePattern = /<tool_use>([\s\S]*?)<name>([\s\S]*?)<\/name>([\s\S]*?)<arguments>([\s\S]*?)<\/arguments>([\s\S]*?)<\/tool_use>/g;
  const tools: MCPToolResponse[] = [];
  let match;

  // 查找所有工具使用块
  while ((match = toolUsePattern.exec(content)) !== null) {
    const toolName = match[2].trim();
    const toolArgs = match[4].trim();

    // 尝试解析参数为 JSON
    let parsedArgs;
    try {
      parsedArgs = JSON.parse(toolArgs);
    } catch (error) {
      // 如果解析失败，使用原始字符串
      parsedArgs = toolArgs;
    }

    // 查找对应的 MCP 工具（支持转换后的名称）
    const mcpTool = findMcpToolByName(mcpTools, toolName);
    if (!mcpTool) {
      console.error(`[MCP] 工具 "${toolName}" 未在 MCP 工具列表中找到`);
      continue;
    }

    //  修复：使用全局唯一ID，参考 Cline 的做法
    const uniqueId = `${toolName}-${nanoid()}`;

    // 添加到工具数组
    tools.push({
      id: uniqueId,
      tool: mcpTool,
      arguments: parsedArgs,
      status: 'pending'
    });
  }

  // 格式2：<tool_name>参数</tool_name> - 支持提示词注入模式
  mcpTools.forEach((mcpTool) => {
    const toolName = mcpTool.id || mcpTool.name;
    // 转义特殊字符以避免正则表达式错误
    const escapedToolName = toolName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const directPattern = new RegExp(`<${escapedToolName}>([\\s\\S]*?)</${escapedToolName}>`, 'g');
    let directMatch;

    while ((directMatch = directPattern.exec(content)) !== null) {
      const toolArgs = directMatch[1].trim();

      // 尝试解析参数为 JSON
      let parsedArgs;
      try {
        parsedArgs = JSON.parse(toolArgs);
      } catch (error) {
        // 如果不是 JSON，尝试作为简单字符串参数
        parsedArgs = { input: toolArgs };
      }

      //  修复：使用全局唯一ID，参考 Cline 的做法
      const uniqueId = `${toolName}-${nanoid()}`;

      tools.push({
        id: uniqueId,
        tool: mcpTool,
        arguments: parsedArgs,
        status: 'pending'
      });
    }
  });

  return tools;
}

/**
 * 调用 MCP 工具并返回结果
 */
export async function callMCPTool(toolResponse: MCPToolResponse): Promise<MCPCallToolResponse> {
  console.log(`[MCP] 调用工具: ${toolResponse.tool.serverName}.${toolResponse.tool.name}`, toolResponse.arguments);

  try {
    // 获取工具对应的服务器
    const server = mcpService.getServerById(toolResponse.tool.serverId);

    if (!server) {
      throw new Error(`服务器未找到: ${toolResponse.tool.serverName}`);
    }

    // 调用工具
    const response = await mcpService.callTool(
      server,
      toolResponse.tool.name,
      toolResponse.arguments
    );

    console.log(`[MCP] 工具调用成功: ${toolResponse.tool.serverName}.${toolResponse.tool.name}`, response);
    return response;
  } catch (error) {
    console.error(`[MCP] 工具调用失败: ${toolResponse.tool.serverName}.${toolResponse.tool.name}`, error);
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `工具调用失败 ${toolResponse.tool.name}: ${error instanceof Error ? error.message : '未知错误'}`
        }
      ]
    };
  }
}

/**
 * 解析和调用工具
 * 完全参考 Cherry Studio McpToolChunkMiddleware.ts 的 parseAndCallTools 实现
 * 
 * 核心设计：
 * 1. 使用 upsertMCPToolResponse 统一管理工具状态
 * 2. 状态流转：pending → invoking → done/error
 * 3. 每次状态变化都通过 onChunk 通知 UI 层
 */
export async function parseAndCallTools(
  content: string | MCPToolResponse[],
  mcpTools: MCPTool[] = [],
  onChunk?: (chunk: import('../types/chunk').Chunk) => void
): Promise<MCPCallToolResponse[]> {
  const toolResults: MCPCallToolResponse[] = [];
  
  // 状态追踪数组（参考 Cherry Studio 的 allToolResponses）
  const allToolResponses: MCPToolResponse[] = [];
  
  let curToolResponses: MCPToolResponse[] = [];

  // 处理输入
  if (Array.isArray(content)) {
    curToolResponses = content;
  } else {
    // 解析工具使用
    curToolResponses = parseToolUse(content, mcpTools);
  }

  if (!curToolResponses || curToolResponses.length === 0) {
    return toolResults;
  }

  console.log(`[MCP] 开始调用 ${curToolResponses.length} 个工具`);

  // ==================== 阶段1：发送 PENDING 状态 ====================
  // 参考 Cherry Studio：先遍历所有工具，发送 pending 状态
  // 这会触发 UI 层创建工具块
  for (const toolResponse of curToolResponses) {
    if (onChunk) {
      upsertMCPToolResponse(
        allToolResponses,
        {
          ...toolResponse,
          status: 'pending'
        },
        onChunk
      );
    }
  }

  // ==================== 阶段2：并行执行工具调用 ====================
  const pendingPromises: Promise<void>[] = [];

  curToolResponses.forEach((toolResponse) => {
    const processingPromise = (async () => {
      try {
        // 2.1 更新为 invoking 状态
        if (onChunk) {
          upsertMCPToolResponse(
            allToolResponses,
            {
              ...toolResponse,
              status: 'invoking'
            },
            onChunk
          );
        }

        console.log(`[MCP] 调用工具: ${toolResponse.tool.name}`);

        // 2.2 执行工具调用
        const toolCallResponse = await callMCPTool(toolResponse);

        // 2.3 更新为 done 状态
        if (onChunk) {
          upsertMCPToolResponse(
            allToolResponses,
            {
              ...toolResponse,
              status: 'done',
              response: toolCallResponse
            },
            onChunk
          );
        }

        // 2.4 处理图片结果（参考 Cherry Studio）
        if (toolCallResponse && !toolCallResponse.isError) {
          const images: string[] = [];
          for (const item of toolCallResponse.content) {
            if (item.type === 'image' && item.data) {
              images.push(`data:${item.mimeType};base64,${item.data}`);
            }
          }

          if (images.length && onChunk) {
            onChunk({
              type: ChunkType.IMAGE_CREATED
            });
            onChunk({
              type: ChunkType.IMAGE_COMPLETE,
              image: {
                type: 'base64',
                images: images
              }
            } as any);
          }
        }

        toolResults.push(toolCallResponse);
      } catch (error) {
        console.error(`[MCP] 工具调用异常: ${toolResponse.id}`, error);
        
        // 更新为 error 状态
        const errorResponse: MCPCallToolResponse = {
          isError: true,
          content: [
            {
              type: 'text',
              text: `工具调用异常: ${error instanceof Error ? error.message : '未知错误'}`
            }
          ]
        };

        if (onChunk) {
          upsertMCPToolResponse(
            allToolResponses,
            {
              ...toolResponse,
              status: 'error',
              response: errorResponse
            },
            onChunk
          );
        }

        toolResults.push(errorResponse);
      }
    })();

    pendingPromises.push(processingPromise);
  });

  // ==================== 阶段3：等待所有工具完成 ====================
  await Promise.all(pendingPromises);

  console.log(`[MCP] 所有工具调用完成，结果数量: ${toolResults.length}`);

  return toolResults;
}

/**
 * 将 MCP 工具转换为 Anthropic 兼容的工具格式
 */
export function mcpToolsToAnthropicTools(mcpTools: MCPTool[]): any[] {
  return mcpTools.map((tool) => ({
    name: tool.id || tool.name,
    description: tool.description,
    input_schema: tool.inputSchema
  }));
}

/**
 * 将 MCP 工具转换为 OpenAI 兼容的工具格式
 */
export function mcpToolsToOpenAITools(mcpTools: MCPTool[]): any[] {
  return mcpTools.map((tool) => ({
    type: 'function',
    function: {
      name: tool.id || tool.name,
      description: tool.description,
      parameters: tool.inputSchema
    }
  }));
}

/**
 * 将 MCP 工具转换为 Gemini 兼容的工具格式
 */
export function mcpToolsToGeminiTools(mcpTools: MCPTool[]): any[] {
  return mcpTools.map((tool) => ({
    functionDeclarations: [{
      name: tool.id || tool.name,
      description: tool.description,
      parameters: tool.inputSchema
    }]
  }));
}

/**
 * 将 MCP 工具调用响应转换为消息格式
 */
export function mcpToolCallResponseToMessage(
  toolResponse: MCPToolResponse,
  result: MCPCallToolResponse
): any {
  const message: any = {
    role: 'user',
    content: '工具调用完成' // 默认内容，防止空内容
  };

  if (result.isError) {
    // 错误情况下，确保有内容
    const errorText = result.content && result.content.length > 0
      ? result.content.map(c => c.text || '').join('\n')
      : '工具调用失败';
    message.content = errorText || '工具调用失败';
  } else {
    const content: any[] = [
      {
        type: 'text',
        text: `以下是 MCP 工具 \`${toolResponse.tool.name}\` 的调用结果:`
      }
    ];

    // 处理不同类型的内容
    if (result.content && result.content.length > 0) {
      for (const item of result.content) {
        switch (item.type) {
          case 'text':
            content.push({
              type: 'text',
              text: item.text || '无内容'
            });
            break;
          case 'image':
            if (item.data) {
              content.push({
                type: 'image',
                image_url: `data:${item.mimeType || 'image/png'};base64,${item.data}`
              });
            }
            break;
          default:
            content.push({
              type: 'text',
              text: `不支持的内容类型: ${item.type}`
            });
            break;
        }
      }
    } else {
      // 如果没有内容，添加默认文本
      content.push({
        type: 'text',
        text: '工具执行完成，但没有返回内容'
      });
    }

    message.content = content;
  }

  return message;
}

/**
 * 从内容中移除工具使用标签
 * 支持两种格式的移除
 */
export function removeToolUseTags(content: string): string {
  // 移除格式1：<tool_use>...</tool_use>
  let result = content.replace(/<tool_use>([\s\S]*?)<\/tool_use>/g, '');

  // 移除格式2：<tool_name>...</tool_name> (简单移除所有XML标签)
  result = result.replace(/<[a-zA-Z0-9_-]+>([\s\S]*?)<\/[a-zA-Z0-9_-]+>/g, '');

  return result.trim();
}

/**
 * 检查内容是否包含工具使用标签
 * 支持两种格式的检测
 */
export function hasToolUseTags(content: string, mcpTools: MCPTool[] = []): boolean {
  // 格式1：<tool_use>...</tool_use>
  const toolUsePattern = /<tool_use>([\s\S]*?)<name>([\s\S]*?)<\/name>([\s\S]*?)<arguments>([\s\S]*?)<\/arguments>([\s\S]*?)<\/tool_use>/;
  if (toolUsePattern.test(content)) {
    return true;
  }

  // 格式2：检查是否包含具体的工具名称标签
  if (mcpTools && mcpTools.length > 0) {
    for (const tool of mcpTools) {
      const toolName = tool.id || tool.name;
      const escapedToolName = toolName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const directPattern = new RegExp(`<${escapedToolName}>([\\s\\S]*?)</${escapedToolName}>`, 'g');
      if (directPattern.test(content)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * 获取 MCP 工具的系统提示词
 * 用于提示词注入模式
 */
export function getMCPSystemPrompt(mcpTools: MCPTool[]): string {
  if (!mcpTools || mcpTools.length === 0) {
    return '';
  }

  let systemPrompt = '\n\n# MCP 工具\n\n';
  systemPrompt += '你可以使用以下工具来帮助用户。使用工具时，请使用以下 XML 格式：\n\n';
  systemPrompt += '<tool_use>\n  <name>工具名称</name>\n  <arguments>{"参数": "值"}</arguments>\n</tool_use>\n\n';

  //  添加严格的格式要求，防止标签分割
  systemPrompt += '⚠️ **重要格式要求**：\n';
  systemPrompt += '- 工具标签必须完整，不能在标签中间换行或添加空格\n';
  systemPrompt += '- 错误示例：`<tool\\n_use>` 或 `<tool _use>`\n';
  systemPrompt += '- 正确示例：`<tool_use>`\n';
  systemPrompt += '- 标签格式错误会导致工具调用失败！\n\n';
  systemPrompt += '## 可用工具\n\n';

  mcpTools.forEach(tool => {
    systemPrompt += `### ${tool.name}\n`;
    if (tool.description) {
      systemPrompt += `${tool.description}\n`;
    }
    if (tool.inputSchema) {
      systemPrompt += `参数格式: ${JSON.stringify(tool.inputSchema, null, 2)}\n`;
    }
    systemPrompt += `服务器: ${tool.serverName}\n\n`;
  });

  systemPrompt += '请根据用户的需求选择合适的工具来协助完成任务。\n';

  return systemPrompt;
}
