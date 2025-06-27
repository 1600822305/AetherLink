import type {
  Message,
  MessageBlock,
  MainTextMessageBlock,
  MultiModelMessageBlock,
  ChartMessageBlock,
  MathMessageBlock
} from '../../types/newMessage';
import { MessageBlockType } from '../../types/newMessage';
import store from '../../store';
import { messageBlocksSelectors } from '../../store/slices/messageBlocksSlice';
import { CACHE_TTL, DEFAULT_EMPTY_CONTENT } from './constants';

// 用于去重日志的缓存
const loggedWarnings = new Set<string>();

// 内容缓存，避免重复计算
const contentCache = new Map<string, { content: string; timestamp: number }>();

/**
 * 获取缓存的内容
 */
function getCachedContent(cacheKey: string): string | null {
  const cached = contentCache.get(cacheKey);
  const now = Date.now();

  if (cached && (now - cached.timestamp) < CACHE_TTL) {
    return cached.content;
  }

  return null;
}

/**
 * 设置缓存内容
 */
function setCachedContent(cacheKey: string, content: string): void {
  const now = Date.now();
  contentCache.set(cacheKey, { content, timestamp: now });
}

/**
 * 从旧版本消息中提取内容
 */
function extractContentFromLegacy(message: Message): string {
  // 优先检查是否有保存的content字段
  if (typeof (message as any).content === 'string' && (message as any).content.trim()) {
    return (message as any).content.trim();
  }

  // 尝试从版本的metadata中获取内容
  if (message.versions && message.versions.length > 0) {
    const activeVersion = message.versions.find(v => v.isActive);
    if (activeVersion && activeVersion.metadata && activeVersion.metadata.content) {
      return activeVersion.metadata.content;
    }
  }

  return '';
}

/**
 * 从对比分析块中提取选中内容
 */
function extractContentFromComparisonBlock(message: Message): string {
  const state = store.getState();

  for (const blockId of message.blocks) {
    try {
      const block = messageBlocksSelectors.selectById(state, blockId);
      if (block && block.type === MessageBlockType.MULTI_MODEL) {
        const comparisonBlock = block as any;
        if (comparisonBlock.subType === 'comparison' && comparisonBlock.selectedContent) {
          return comparisonBlock.selectedContent.trim();
        }
      }
    } catch (error) {
      const warningKey = `comparison-block-error-${blockId}`;
      if (!loggedWarnings.has(warningKey)) {
        console.error(`[extractContentFromComparisonBlock] 检查对比块 ${blockId} 失败:`, error);
        loggedWarnings.add(warningKey);
      }
    }
  }

  return '';
}

/**
 * 从普通文本块中提取内容
 */
function extractContentFromBlocks(message: Message): string {
  const state = store.getState();
  const textBlocks: MainTextMessageBlock[] = [];
  const missingBlocks: string[] = [];

  for (const blockId of message.blocks) {
    try {
      const block = messageBlocksSelectors.selectById(state, blockId);
      if (!block) {
        missingBlocks.push(blockId);
        continue;
      }

      // 兼容性处理：同时支持 MAIN_TEXT、UNKNOWN 和字符串类型的块类型
      const blockType = block && typeof block === 'object' ?
        (typeof (block as any).type === 'string' ? (block as any).type : MessageBlockType.UNKNOWN) :
        MessageBlockType.UNKNOWN;

      if (blockType === MessageBlockType.MAIN_TEXT ||
          blockType === MessageBlockType.UNKNOWN ||
          blockType === 'main_text' ||
          blockType === 'MAIN_TEXT') {
        textBlocks.push(block as MainTextMessageBlock);
      }
    } catch (error) {
      const warningKey = `block-error-${blockId}`;
      if (!loggedWarnings.has(warningKey)) {
        console.error(`[extractContentFromBlocks] 获取块 ${blockId} 失败:`, error);
        loggedWarnings.add(warningKey);
      }
    }
  }

  // 只在有缺失块时输出一次警告
  if (missingBlocks.length > 0) {
    const warningKey = `missing-blocks-${message.id}`;
    if (!loggedWarnings.has(warningKey)) {
      console.warn(`[extractContentFromBlocks] 消息 ${message.id} 缺失 ${missingBlocks.length} 个块:`, missingBlocks);
      loggedWarnings.add(warningKey);
    }
  }

  // 过滤掉空内容的块
  const nonEmptyBlocks = textBlocks.filter(block => {
    const content = block.content;
    return content && typeof content === 'string' && content.trim();
  });

  if (nonEmptyBlocks.length === 0) {
    return '';
  }

  // 连接所有文本块的内容
  return nonEmptyBlocks.map(block => block.content.trim()).join('\n\n');
}

/**
 * 获取消息的主要文本内容
 * 优化版本：减少重复日志输出，添加缓存提高性能
 */
export function getMainTextContent(message: Message): string {
  // 安全检查
  if (!message) {
    const warningKey = 'empty-message';
    if (!loggedWarnings.has(warningKey)) {
      console.warn('[getMainTextContent] 消息对象为空');
      loggedWarnings.add(warningKey);
    }
    return '';
  }

  // 检查缓存
  const cacheKey = `${message.id}-${message.updatedAt || message.createdAt}`;
  const cachedContent = getCachedContent(cacheKey);
  if (cachedContent !== null) {
    return cachedContent;
  }

  try {
    // 优先检查是否有保存的content字段
    const legacyContent = extractContentFromLegacy(message);
    if (legacyContent) {
      setCachedContent(cacheKey, legacyContent);
      return legacyContent;
    }

    // 检查是否有blocks
    if (!message.blocks || message.blocks.length === 0) {
      const warningKey = `no-blocks-${message.id}`;
      if (!loggedWarnings.has(warningKey)) {
        console.warn(`[getMainTextContent] 消息 ${message.id} 没有blocks`);
        loggedWarnings.add(warningKey);
      }

      // 缓存空结果，但返回默认内容防止API错误
      setCachedContent(cacheKey, DEFAULT_EMPTY_CONTENT);
      return DEFAULT_EMPTY_CONTENT;
    }

    // 获取Redux状态
    const state = store.getState();
    if (!state) {
      const warningKey = 'redux-unavailable';
      if (!loggedWarnings.has(warningKey)) {
        console.error('[getMainTextContent] Redux状态不可用');
        loggedWarnings.add(warningKey);
      }
      return '';
    }

    // 首先检查是否有模型对比块，并且有选中的内容
    const comparisonContent = extractContentFromComparisonBlock(message);
    if (comparisonContent) {
      setCachedContent(cacheKey, comparisonContent);
      return comparisonContent;
    }

    // 如果没有对比块选中内容，继续查找普通文本块
    const blocksContent = extractContentFromBlocks(message);
    if (blocksContent) {
      setCachedContent(cacheKey, blocksContent);
      return blocksContent;
    }

    // 没有有效内容
    const warningKey = `no-content-${message.id}`;
    if (!loggedWarnings.has(warningKey)) {
      console.warn(`[getMainTextContent] 消息 ${message.id} 没有有效的文本内容`);
      loggedWarnings.add(warningKey);
    }

    // 返回默认内容防止API错误
    setCachedContent(cacheKey, DEFAULT_EMPTY_CONTENT);
    return DEFAULT_EMPTY_CONTENT;

  } catch (error) {
    const warningKey = `general-error-${message.id}`;
    if (!loggedWarnings.has(warningKey)) {
      console.error('[getMainTextContent] 获取消息内容失败:', error);
      loggedWarnings.add(warningKey);
    }

    // 最后的兜底方案：尝试直接从消息对象获取任何可能的文本内容
    try {
      const fallbackContent = extractContentFromLegacy(message);
      if (fallbackContent) {
        return fallbackContent;
      }
    } catch (fallbackError) {
      const fallbackWarningKey = `fallback-error-${message.id}`;
      if (!loggedWarnings.has(fallbackWarningKey)) {
        console.error('[getMainTextContent] 兜底方案也失败:', fallbackError);
        loggedWarnings.add(fallbackWarningKey);
      }
    }

    return '';
  }
}

/**
 * 获取消息的所有文本内容（包括各类块）
 */
export function getAllTextContent(message: Message): string {
  if (!message || !message.blocks || message.blocks.length === 0) {
    return '';
  }

  const state = store.getState();
  const textParts: string[] = [];

  for (const blockId of message.blocks) {
    const block = messageBlocksSelectors.selectById(state, blockId);
    if (!block) continue;

    switch (block.type) {
      case MessageBlockType.MAIN_TEXT:
      case MessageBlockType.THINKING:
      case MessageBlockType.CODE:
      case MessageBlockType.CITATION:
      case MessageBlockType.TRANSLATION:
        textParts.push((block as any).content);
        break;
      case MessageBlockType.ERROR:
        textParts.push(`Error: ${(block as any).content}`);
        break;
      case MessageBlockType.IMAGE:
        textParts.push('[Image]');
        break;
      case MessageBlockType.FILE:
        textParts.push(`[File: ${(block as any).name}]`);
        break;
      case MessageBlockType.TOOL:
        textParts.push(`[Tool: ${(block as any).name}]`);
        break;
      case MessageBlockType.MULTI_MODEL:
        const multiModel = block as MultiModelMessageBlock;
        textParts.push(`[多模型响应: ${multiModel.responses.length}个模型]`);
        break;
      case MessageBlockType.CHART:
        const chart = block as ChartMessageBlock;
        textParts.push(`[图表: ${chart.chartType}]`);
        break;
      case MessageBlockType.MATH:
        textParts.push(`[公式: ${(block as MathMessageBlock).content}]`);
        break;
      default:
        break;
    }
  }

  return textParts.join('\n\n');
}

/**
 * 清理缓存的函数
 */
export function clearGetMainTextContentCache() {
  loggedWarnings.clear();
  contentCache.clear();
}

/**
 * 清理过期缓存
 */
export function cleanupExpiredCache() {
  const now = Date.now();
  for (const [key, value] of contentCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      contentCache.delete(key);
    }
  }
}
