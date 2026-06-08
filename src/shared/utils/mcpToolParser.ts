import type { MCPTool, MCPToolResponse, MCPCallToolResponse } from '../types';
import { ChunkType } from '../types/chunk';
import { mcpService } from '../services/mcp';
import { nanoid } from './index';
// 🚀 导入网络搜索工具
import { executeWebSearch, formatSearchResultsForAI } from '../services/webSearch';
// 🔌 导入 MCP 桥梁工具
import { MCP_BRIDGE_TOOL_NAME, executeBridgeToolCall } from '../services/mcp/McpBridgeTool';
// 📖 导入 read_skill 虚拟工具
import { READ_SKILL_TOOL_NAME, executeReadSkill } from '../services/skills/SkillReadTool';

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
 * 🚀 支持内置工具（如 builtin_web_search）和 MCP 工具
 */
export async function callMCPTool(toolResponse: MCPToolResponse): Promise<MCPCallToolResponse> {
  const toolName = toolResponse.tool.name || toolResponse.tool.id;
  console.log(`[MCP] 调用工具: ${toolResponse.tool.serverName || 'builtin'}.${toolName}`, toolResponse.arguments);

  try {
    // 🔌 检查是否为 MCP 桥梁工具
    if (toolName === MCP_BRIDGE_TOOL_NAME) {
      console.log(`[McpBridge] 桥梁工具调用:`, toolResponse.arguments);
      return await executeBridgeToolCall(toolResponse.arguments as Record<string, any>);
    }

    // 📖 检查是否为 read_skill 虚拟工具
    if (toolName === READ_SKILL_TOOL_NAME) {
      console.log(`[ReadSkill] 读取技能:`, toolResponse.arguments);
      return await executeReadSkill(toolResponse.arguments as Record<string, any>);
    }

    // 🚀 检查是否为内置网络搜索工具
    if (toolName === 'builtin_web_search') {
      console.log(`[WebSearch] AI 自主调用网络搜索工具`);
      
      // 从工具元数据中获取搜索配置
      const webSearchConfig = (toolResponse.tool as any).webSearchConfig;
      const providerId = webSearchConfig?.providerId;
      const extractedKeywords = webSearchConfig?.extractedKeywords;
      
      if (!providerId) {
        throw new Error('网络搜索提供商未配置');
      }
      
      // 执行网络搜索
      const searchResult = await executeWebSearch(
        toolResponse.arguments as any,
        providerId,
        extractedKeywords
      );
      
      // 格式化结果返回给 AI
      const formattedResult = formatSearchResultsForAI(searchResult);
      
      console.log(`[WebSearch] 搜索完成，找到 ${searchResult.results?.length || 0} 个结果`);
      
      // 🚀 返回结果时同时包含原始搜索结果和格式化文本
      return {
        isError: false,
        content: [
          {
            type: 'text',
            text: formattedResult
          }
        ],
        // 保存原始搜索结果供 UI 显示
        webSearchResult: searchResult
      };
    }

    // 获取工具对应的服务器（MCP 工具）
    // 🔧 修复：使用异步方法确保数据完整加载，避免竞态条件
    const server = await mcpService.getServerByIdAsync(toolResponse.tool.serverId);

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
    console.error(`[MCP] 工具调用失败: ${toolResponse.tool.serverName || 'builtin'}.${toolName}`, error);
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `工具调用失败 ${toolName}: ${error instanceof Error ? error.message : '未知错误'}`
        }
      ]
    };
  }
}

/**
 * 解析和调用工具
 * 支持批量处理多个工具调用
 */
export async function parseAndCallTools(
  content: string | MCPToolResponse[],
  mcpTools: MCPTool[] = [],
  onChunk?: (chunk: import('../types/chunk').Chunk) => void | Promise<void>
): Promise<MCPCallToolResponse[]> {
  const toolResults: MCPCallToolResponse[] = [];
  let currentToolResponses: MCPToolResponse[] = [];

  // 处理输入
  if (Array.isArray(content)) {
    currentToolResponses = content;
  } else {
    // 解析工具使用
    currentToolResponses = parseToolUse(content, mcpTools);
  }

  if (!currentToolResponses || currentToolResponses.length === 0) {
    return toolResults;
  }

  console.log(`[MCP] 开始调用 ${currentToolResponses.length} 个工具`);

  // ⭐ 串行调用工具（参考 Cherry Studio）
  // 确保每个工具的 UI 块创建完成后再处理下一个，避免快速模型导致块顺序混乱
  for (const toolResponse of currentToolResponses) {
    try {
      // 1. 发送单个工具的 IN_PROGRESS 事件，等待 UI 块创建
      const mutableToolResponse = { ...toolResponse, status: 'invoking' as const };
      
      if (onChunk) {
        await onChunk({
          type: ChunkType.MCP_TOOL_IN_PROGRESS,
          responses: [mutableToolResponse]
        });
      }

      console.log(`[MCP] 调用工具: ${toolResponse.tool.name}`);

      // 2. 调用工具
      const result = await callMCPTool(mutableToolResponse);

      // 3. 发送 COMPLETE 事件
      const finalToolResponse = {
        ...mutableToolResponse,
        status: result.isError ? 'error' as const : 'done' as const,
        response: result
      };

      if (onChunk) {
        await onChunk({
          type: ChunkType.MCP_TOOL_COMPLETE,
          responses: [finalToolResponse]
        });
      }

      toolResults.push(result);
    } catch (error) {
      console.error(`[MCP] 工具调用异常:`, error);

      const errorResult: MCPCallToolResponse = {
        isError: true,
        content: [
          {
            type: 'text',
            text: `工具调用异常: ${error instanceof Error ? error.message : '未知错误'}`
          }
        ]
      };

      const errorToolResponse = {
        ...toolResponse,
        status: 'error' as const,
        response: errorResult
      };

      if (onChunk) {
        await onChunk({
          type: ChunkType.MCP_TOOL_COMPLETE,
          responses: [errorToolResponse]
        });
      }

      toolResults.push(errorResult);
    }
  }

  console.log(`[MCP] 所有工具调用完成，结果数量: ${toolResults.length}`);

  // 注意：不再发送汇总的 MCP_TOOL_COMPLETE 事件
  // 参考项目设计：每个工具完成时已经发送了单独的完成事件（第 210-215 行）
  // 这样避免 UI 层收到重复的完成事件

  return toolResults;
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
 * 🛡️ 移除模型幻觉的 <tool_use_result> 标签
 * 当模型在 prompt 模式下自行编造工具返回结果时，需要将这些内容剥离
 * 防止幻觉内容污染对话历史
 */
export function stripToolUseResultTags(content: string): string {
  if (!content) return content;
  // 移除所有 <tool_use_result>...</tool_use_result> 块
  return content.replace(/<tool_use_result>([\s\S]*?)<\/tool_use_result>/g, '').trim();
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

