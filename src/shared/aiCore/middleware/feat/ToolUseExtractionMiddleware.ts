/**
 * 工具使用提取中间件
 * 对标 Cherry Studio ToolUseExtractionMiddleware
 * 
 * 从文本中提取 <tool_use> 标签（提示词注入模式）
 */
import type { CompletionsMiddleware } from '../types';
import type { CompletionsResult, MCPTool } from '../schemas';
import { ChunkType, type Chunk } from '../../types/chunk';

export const MIDDLEWARE_NAME = 'ToolUseExtractionMiddleware';

/**
 * 工具调用数据
 */
interface ToolUseData {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/**
 * 工具使用提取中间件
 * 从文本流中提取 <tool_use> 标签并转换为 MCP_TOOL_* 事件
 */
export const ToolUseExtractionMiddleware: CompletionsMiddleware = (_api) => (next) =>
  async (context, params): Promise<CompletionsResult> => {
    const { mcpTools, mcpMode, onChunk } = params;

    // 只在提示词注入模式下启用
    if (mcpMode !== 'prompt' || !mcpTools?.length || !onChunk) {
      return next(context, params);
    }

    console.log('[ToolUseExtractionMiddleware] Enabled for prompt injection mode');

    // 状态
    let buffer = '';
    const extractedTools: ToolUseData[] = [];

    // 包装 onChunk 提取工具调用
    const wrappedOnChunk = async (chunk: Chunk) => {
      if (chunk.type !== ChunkType.TEXT_DELTA || !('text' in chunk)) {
        await onChunk(chunk);
        return;
      }

      buffer += chunk.text;

      // 尝试解析工具调用
      const { tools, remainingText, cleanedText } = parseToolUseTags(buffer, mcpTools);

      // 发送工具调用事件
      for (const tool of tools) {
        if (!extractedTools.some(t => t.id === tool.id)) {
          extractedTools.push(tool);
          
          await onChunk({
            type: ChunkType.MCP_TOOL_IN_PROGRESS,
            responses: [{
              id: tool.id,
              name: tool.name,
              arguments: tool.arguments,
              status: 'pending',
            }],
          } as any);
        }
      }

      // 更新缓冲区
      buffer = remainingText;

      // 发送清理后的文本（不含工具标签）
      if (cleanedText) {
        await onChunk({
          type: ChunkType.TEXT_DELTA,
          text: cleanedText,
        });
      }
    };

    // 执行下游中间件
    const result = await next(context, { ...params, onChunk: wrappedOnChunk });

    // 处理剩余缓冲区
    if (buffer && onChunk) {
      const { tools, cleanedText } = parseToolUseTags(buffer, mcpTools);
      
      for (const tool of tools) {
        if (!extractedTools.some(t => t.id === tool.id)) {
          extractedTools.push(tool);
          
          await onChunk({
            type: ChunkType.MCP_TOOL_IN_PROGRESS,
            responses: [{
              id: tool.id,
              name: tool.name,
              arguments: tool.arguments,
              status: 'pending',
            }],
          } as any);
        }
      }

      if (cleanedText) {
        await onChunk({
          type: ChunkType.TEXT_DELTA,
          text: cleanedText,
        });
      }
    }

    // 发送工具调用完成事件
    if (extractedTools.length > 0 && onChunk) {
      await onChunk({
        type: ChunkType.MCP_TOOL_COMPLETE,
        responses: extractedTools.map(t => ({
          id: t.id,
          name: t.name,
          arguments: t.arguments,
        })),
      } as any);
    }

    return result;
  };

/**
 * 解析 <tool_use> 标签
 */
function parseToolUseTags(
  text: string,
  mcpTools: MCPTool[]
): { tools: ToolUseData[]; remainingText: string; cleanedText: string } {
  const tools: ToolUseData[] = [];
  let cleanedText = text;
  let remainingText = '';

  // 正则匹配多种格式
  const patterns = [
    // 格式1: <tool_use><name>...</name><arguments>...</arguments></tool_use>
    /<tool_use>\s*<name>(.*?)<\/name>\s*<arguments>([\s\S]*?)<\/arguments>\s*<\/tool_use>/g,
    // 格式2: <tool_name>...</tool_name><tool_input>...</tool_input>
    /<tool_name>(.*?)<\/tool_name>\s*<tool_input>([\s\S]*?)<\/tool_input>/g,
    // 格式3: <function_call name="...">...</function_call>
    /<function_call\s+name="([^"]+)">([\s\S]*?)<\/function_call>/g,
  ];

  for (const regex of patterns) {
    let match;
    while ((match = regex.exec(text)) !== null) {
      const [fullMatch, name, argsStr] = match;
      const trimmedName = name.trim();

      // 查找对应的 MCP 工具
      const tool = mcpTools.find(t => 
        t.name === trimmedName || t.id === trimmedName
      );

      if (tool) {
        try {
          const args = parseArguments(argsStr.trim());
          tools.push({
            id: `tool_${Date.now()}_${tools.length}`,
            name: trimmedName,
            arguments: args,
          });
          
          // 从清理文本中移除匹配内容
          cleanedText = cleanedText.replace(fullMatch, '');
        } catch (e) {
          console.warn(`[ToolUseExtraction] Failed to parse arguments for tool: ${trimmedName}`);
        }
      }
    }
  }

  // 检查是否有未闭合的标签
  const openTags = ['<tool_use>', '<tool_name>', '<function_call'];
  for (const tag of openTags) {
    const lastIndex = text.lastIndexOf(tag);
    if (lastIndex !== -1) {
      const afterTag = text.substring(lastIndex);
      // 检查是否有对应的闭合标签
      const closeTag = tag === '<tool_use>' ? '</tool_use>' :
                       tag === '<tool_name>' ? '</tool_input>' :
                       '</function_call>';
      if (!afterTag.includes(closeTag)) {
        // 未闭合，保留在缓冲区
        remainingText = afterTag;
        cleanedText = cleanedText.substring(0, lastIndex);
        break;
      }
    }
  }

  return { tools, remainingText, cleanedText: cleanedText.trim() };
}

/**
 * 解析参数字符串
 */
function parseArguments(argsStr: string): Record<string, unknown> {
  // 尝试 JSON 解析
  try {
    return JSON.parse(argsStr);
  } catch {
    // 尝试解析简单的 key=value 格式
    const args: Record<string, unknown> = {};
    const lines = argsStr.split('\n');
    
    for (const line of lines) {
      const match = line.match(/^(\w+)\s*[:=]\s*(.+)$/);
      if (match) {
        const [, key, value] = match;
        try {
          args[key] = JSON.parse(value);
        } catch {
          args[key] = value.trim();
        }
      }
    }
    
    return Object.keys(args).length > 0 ? args : { raw: argsStr };
  }
}
