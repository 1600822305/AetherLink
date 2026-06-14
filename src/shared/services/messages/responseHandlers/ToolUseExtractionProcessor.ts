/**
 * 工具调用提取处理器
 * 参考 Cherry Studio 的 ToolUseExtractionMiddleware
 * 
 * 功能：
 * 1. 从流式文本中检测和提取工具调用标签
 * 2. 支持双格式：<tool_use> 和 <tool_name> 直接格式
 */

import { ToolTagExtractor } from '../../../utils/tagExtraction';
import type { ToolTagExtractionResult } from '../../../utils/tagExtraction';
import type { MCPToolResponse, TextDeltaChunk, Chunk } from '../../../types/chunk';
import { ChunkType } from '../../../types/chunk';
import { createLogger } from '../../infra/logger';
const logger = createLogger('ToolUseExtractionProcessor');

/**
 * 处理结果类型
 */
export interface ProcessedTextResult {
  /** 结果类型 */
  type: 'text' | 'tool_created';
  /** 文本内容（type=text 时有值） */
  content?: string;
  /** 工具响应列表（type=tool_created 时有值） */
  responses?: MCPToolResponse[];
  /** 格式类型（type=tool_created 时有值） */
  format?: 'tool_use' | 'direct';
  /** 工具名称（direct 格式时有值） */
  toolName?: string;
}

/**
 * 工具调用提取处理器
 */
export class ToolUseExtractionProcessor {
  private tagExtractor: ToolTagExtractor;
  private toolUseCount: number = 0;

  /**
   * @param toolNames - 可用的工具名称列表
   */
  constructor(toolNames: string[] = []) {
    this.tagExtractor = new ToolTagExtractor(toolNames);
    logger.debug(`初始化，工具数量: ${toolNames.length}`);
  }

  /**
   * 处理文本 chunk
   * 
   * @param text - 新接收的文本
   * @returns 处理结果数组
   */
  processText(text: string): ProcessedTextResult[] {
    const results: ProcessedTextResult[] = [];
    const extractionResults = this.tagExtractor.processText(text);

    for (const result of extractionResults) {
      const processed = this.processExtractionResult(result);
      if (processed) {
        results.push(processed);
      }
    }

    return results;
  }

  /**
   * 处理单个提取结果
   */
  private processExtractionResult(result: ToolTagExtractionResult): ProcessedTextResult | null {
    // 1. 如果是完整的标签内容，解析工具调用
    if (result.complete && result.tagContentExtracted) {
      const toolResponses = this.parseToolContent(
        result.tagContentExtracted,
        result.format,
        result.toolName
      );

      if (toolResponses.length > 0) {
        this.toolUseCount += toolResponses.length;

        logger.debug(`检测到工具调用，格式: ${result.format}, 数量: ${toolResponses.length}`);

        return {
          type: 'tool_created',
          responses: toolResponses,
          format: result.format,
          toolName: result.toolName
        };
      }
    }

    // 2. 如果是普通文本内容，直接返回
    if (!result.isTagContent && result.content) {
      return {
        type: 'text',
        content: result.content
      };
    }

    // 3. 标签内部的内容（正在累积），不返回
    return null;
  }

  /**
   * 解析标签内容为工具调用
   */
  private parseToolContent(
    content: string,
    format?: 'tool_use' | 'direct',
    toolName?: string
  ): MCPToolResponse[] {
    const responses: MCPToolResponse[] = [];

    try {
      if (format === 'direct' && toolName) {
        // 直接格式：<tool_name>...</tool_name>
        // 内容直接作为参数
        const response = this.parseDirectFormat(content, toolName);
        if (response) {
          responses.push(response);
        }
      } else {
        // tool_use 格式：<tool_use><name>...</name><arguments>...</arguments></tool_use>
        const response = this.parseToolUseFormat(content);
        if (response) {
          responses.push(response);
        }
      }
    } catch (error) {
      logger.error(`解析工具内容失败:`, error);
    }

    return responses;
  }

  /**
   * 解析 tool_use 格式
   */
  private parseToolUseFormat(content: string): MCPToolResponse | null {
    try {
      // 提取 <name> 标签内容
      const nameMatch = content.match(/<name>\s*([\s\S]*?)\s*<\/name>/);
      if (!nameMatch) {
        logger.warn(`tool_use 格式缺少 <name> 标签`);
        return null;
      }
      const name = nameMatch[1].trim();

      // 提取 <arguments> 标签内容
      let args: Record<string, any> = {};
      const argsMatch = content.match(/<arguments>\s*([\s\S]*?)\s*<\/arguments>/);
      if (argsMatch) {
        const argsContent = argsMatch[1].trim();
        if (argsContent) {
          try {
            args = JSON.parse(argsContent);
          } catch {
            // 如果不是 JSON，尝试作为单个字符串参数
            args = { input: argsContent };
          }
        }
      }

      // 生成唯一 ID
      const id = `tool_${Date.now()}_${this.toolUseCount}`;

      return {
        id,
        name,
        arguments: args,
        status: 'pending',
        toolCallId: id
      };
    } catch (error) {
      logger.error(`解析 tool_use 格式失败:`, error);
      return null;
    }
  }

  /**
   * 解析直接格式
   */
  private parseDirectFormat(content: string, toolName: string): MCPToolResponse | null {
    try {
      let args: Record<string, any> = {};

      // 尝试解析为 JSON
      const trimmedContent = content.trim();
      if (trimmedContent) {
        try {
          args = JSON.parse(trimmedContent);
        } catch {
          // 如果不是 JSON，作为单个输入参数
          args = { input: trimmedContent };
        }
      }

      // 生成唯一 ID
      const id = `tool_${Date.now()}_${this.toolUseCount}`;

      return {
        id,
        name: toolName,
        arguments: args,
        status: 'pending',
        toolCallId: id
      };
    } catch (error) {
      logger.error(`解析直接格式失败:`, error);
      return null;
    }
  }

  /**
   * 完成处理，返回任何剩余的工具调用
   */
  finalize(): ProcessedTextResult | null {
    const finalResult = this.tagExtractor.finalize();
    if (finalResult) {
      return this.processExtractionResult(finalResult);
    }
    return null;
  }

  /**
   * 重置状态
   */
  reset(): void {
    this.tagExtractor.reset();
    this.toolUseCount = 0;
  }

  /**
   * 更新工具名称列表
   */
  updateToolNames(toolNames: string[]): void {
    this.tagExtractor.updateToolNames(toolNames);
  }

  /**
   * 获取工具调用计数
   */
  getToolUseCount(): number {
    return this.toolUseCount;
  }

  /**
   * 将 ProcessedTextResult 转换为 Chunk
   * 方便集成到现有的 chunk 处理流程
   */
  static toChunk(result: ProcessedTextResult): Chunk | null {
    switch (result.type) {
      case 'text':
        return {
          type: ChunkType.TEXT_DELTA,
          text: result.content || ''
        } as TextDeltaChunk;

      case 'tool_created':
        return {
          type: ChunkType.MCP_TOOL_CREATED,
          responses: result.responses || [],
          format: result.format
        };

      default:
        return null;
    }
  }
}
