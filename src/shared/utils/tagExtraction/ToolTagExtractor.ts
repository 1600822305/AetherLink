/**
 * 工具标签提取器
 * 支持双格式：<tool_use> 和 <tool_name> 直接格式
 * 
 * 基于 StreamTagExtractor 扩展，实现多格式支持
 */
import { StreamTagExtractor } from './StreamTagExtractor';
import { getPotentialStartIndex } from './getPotentialIndex';
import type { TagConfig, TagExtractionResult } from './types';
import { TOOL_USE_TAG_CONFIG } from './types';
import { createLogger } from '../../services/infra/logger';
const logger = createLogger('ToolTagExtractor');

/**
 * 工具标签检测结果
 */
export interface ToolTagDetectionResult {
  /** 检测到的格式类型 */
  format: 'tool_use' | 'direct' | null;
  /** 工具名称（仅 direct 格式有值） */
  toolName?: string;
  /** 标签配置 */
  tagConfig?: TagConfig;
  /** 在文本中的起始位置 */
  startIndex: number | null;
}

/**
 * 工具标签提取结果
 */
export interface ToolTagExtractionResult extends TagExtractionResult {
  /** 格式类型 */
  format?: 'tool_use' | 'direct';
  /** 工具名称（仅 direct 格式） */
  toolName?: string;
}

/**
 * 工具标签提取器
 * 支持双格式流式提取
 */
export class ToolTagExtractor {
  private toolUseExtractor: StreamTagExtractor;
  private directExtractors: Map<string, StreamTagExtractor> = new Map();
  private toolNames: string[];
  private textBuffer: string = '';
  private activeFormat: 'tool_use' | 'direct' | null = null;
  private activeToolName: string | null = null;

  /**
   * @param toolNames - 可用的工具名称列表（用于 direct 格式检测）
   */
  constructor(toolNames: string[] = []) {
    this.toolNames = toolNames;
    this.toolUseExtractor = new StreamTagExtractor(TOOL_USE_TAG_CONFIG);
    
    // 为每个工具名称创建提取器
    for (const toolName of toolNames) {
      const config: TagConfig = {
        openingTag: `<${toolName}>`,
        closingTag: `</${toolName}>`,
        separator: '\n'
      };
      this.directExtractors.set(toolName, new StreamTagExtractor(config));
    }
  }

  /**
   * 检测文本中最近的工具标签
   */
  private detectNextTag(text: string): ToolTagDetectionResult {
    let bestResult: ToolTagDetectionResult = {
      format: null,
      startIndex: null
    };

    // 1. 检测 <tool_use> 格式
    const toolUseIndex = getPotentialStartIndex(text, TOOL_USE_TAG_CONFIG.openingTag);
    if (toolUseIndex !== null) {
      bestResult = {
        format: 'tool_use',
        tagConfig: TOOL_USE_TAG_CONFIG,
        startIndex: toolUseIndex
      };
    }

    // 2. 检测 <tool_name> 直接格式
    for (const toolName of this.toolNames) {
      const openingTag = `<${toolName}>`;
      const index = getPotentialStartIndex(text, openingTag);
      
      if (index !== null) {
        // 选择最早出现的标签
        if (bestResult.startIndex === null || index < bestResult.startIndex) {
          bestResult = {
            format: 'direct',
            toolName,
            tagConfig: {
              openingTag,
              closingTag: `</${toolName}>`,
              separator: '\n'
            },
            startIndex: index
          };
        }
      }
    }

    return bestResult;
  }

  /**
   * 处理文本块
   * 支持增量模式和累积模式输入：
   * - 增量模式：每次传入新增的文本片段
   * - 累积模式：每次传入完整的累积文本（供应商层已累积）
   */
  processText(newText: string): ToolTagExtractionResult[] {
    // ⭐ 智能检测输入模式：
    // 如果新文本以当前缓冲区内容开头，说明是累积模式，直接替换
    // 否则是增量模式，追加
    if (newText.length > this.textBuffer.length && newText.startsWith(this.textBuffer)) {
      // 累积模式：新文本包含旧内容，直接替换
      this.textBuffer = newText;
    } else if (newText === this.textBuffer) {
      // 相同内容，跳过
      return [];
    } else {
      // 增量模式：追加
      this.textBuffer += newText;
    }
    const results: ToolTagExtractionResult[] = [];

    while (this.textBuffer.length > 0) {
      // 如果已经在某个格式中，继续使用对应的提取器
      if (this.activeFormat) {
        const extractor = this.activeFormat === 'tool_use'
          ? this.toolUseExtractor
          : this.directExtractors.get(this.activeToolName!);

        if (!extractor) {
          logger.error(`提取器未找到: ${this.activeToolName}`);
          this.activeFormat = null;
          this.activeToolName = null;
          continue;
        }

        const extractorResults = extractor.processText(this.textBuffer);
        this.textBuffer = '';

        for (const result of extractorResults) {
          const toolResult: ToolTagExtractionResult = {
            ...result,
            format: this.activeFormat || undefined,
            toolName: this.activeToolName || undefined
          };
          results.push(toolResult);

          // 如果标签完成，重置活动格式
          if (result.complete) {
            // 重置活动格式，继续处理剩余内容
            this.activeFormat = null;
            this.activeToolName = null;
            // 获取提取器中剩余的缓冲区内容
            const state = extractor.getState();
            if (state.textBuffer) {
              this.textBuffer = state.textBuffer;
              extractor.reset();
            }
          }
        }
        break;
      }

      // 检测下一个标签
      const detection = this.detectNextTag(this.textBuffer);

      if (detection.startIndex === null || detection.format === null) {
        // 没有检测到标签，输出所有内容作为普通文本
        if (this.textBuffer.length > 0) {
          results.push({
            content: this.textBuffer,
            isTagContent: false,
            complete: false
          });
          this.textBuffer = '';
        }
        break;
      }

      // 输出标签前的内容
      if (detection.startIndex > 0) {
        const contentBeforeTag = this.textBuffer.slice(0, detection.startIndex);
        results.push({
          content: contentBeforeTag,
          isTagContent: false,
          complete: false
        });
      }

      // 检查是否是完整的开始标签
      const openingTag = detection.tagConfig!.openingTag;
      const hasFullOpeningTag = detection.startIndex + openingTag.length <= this.textBuffer.length;

      if (hasFullOpeningTag) {
        // 设置活动格式并开始提取
        this.activeFormat = detection.format;
        this.activeToolName = detection.toolName || null;
        
        // 移除开始标签前的内容，保留标签及之后的内容
        this.textBuffer = this.textBuffer.slice(detection.startIndex);
        
        // 重置对应的提取器
        const extractor = detection.format === 'tool_use'
          ? this.toolUseExtractor
          : this.directExtractors.get(detection.toolName!);
        
        if (extractor) {
          extractor.reset();
        }
      } else {
        // 只找到部分标签，保留等待更多数据
        this.textBuffer = this.textBuffer.slice(detection.startIndex);
        break;
      }
    }

    return results;
  }

  /**
   * 完成处理
   */
  finalize(): ToolTagExtractionResult | null {
    // 如果有活动的提取器，完成它
    if (this.activeFormat) {
      const extractor = this.activeFormat === 'tool_use'
        ? this.toolUseExtractor
        : this.directExtractors.get(this.activeToolName!);

      if (extractor) {
        const result = extractor.finalize();
        if (result) {
          return {
            ...result,
            format: this.activeFormat,
            toolName: this.activeToolName || undefined
          };
        }
      }
    }

    // 返回缓冲区中剩余的内容
    if (this.textBuffer.length > 0) {
      const result: ToolTagExtractionResult = {
        content: this.textBuffer,
        isTagContent: false,
        complete: false
      };
      this.textBuffer = '';
      return result;
    }

    return null;
  }

  /**
   * 重置状态
   */
  reset(): void {
    this.textBuffer = '';
    this.activeFormat = null;
    this.activeToolName = null;
    this.toolUseExtractor.reset();
    for (const extractor of this.directExtractors.values()) {
      extractor.reset();
    }
  }

  /**
   * 更新工具名称列表
   */
  updateToolNames(toolNames: string[]): void {
    this.toolNames = toolNames;
    
    // 更新 direct 格式提取器
    this.directExtractors.clear();
    for (const toolName of toolNames) {
      const config: TagConfig = {
        openingTag: `<${toolName}>`,
        closingTag: `</${toolName}>`,
        separator: '\n'
      };
      this.directExtractors.set(toolName, new StreamTagExtractor(config));
    }
  }
}
