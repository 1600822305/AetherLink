/**
 * 消息工具模块统一导出
 * 
 * 该模块提供了完整的消息和消息块管理功能，包括：
 * - 消息创建和管理
 * - 各种类型的消息块创建
 * - 消息块查找和过滤
 * - 内容提取和处理
 * - 实用工具函数
 */

// 常量
export * from './constants';

// 消息工厂函数
export {
  createUserMessage,
  createAssistantMessage,
  createSystemMessage,
  createMessage,
  resetAssistantMessage
} from './messageFactory';

// 块工厂函数
export {
  createThinkingBlock,
  createImageBlock,
  createVideoBlock,
  createFileBlock,
  createCodeBlock,
  createToolBlock,
  createTranslationBlock,
  createMultiModelBlock,
  createChartBlock,
  createMathBlock,
  createKnowledgeReferenceBlock
} from './blockFactory';

// 块查找函数
export {
  findMainTextBlocks,
  findThinkingBlocks,
  findImageBlocks,
  findVideoBlocks,
  findCodeBlocks,
  findCitationBlocks,
  findTranslationBlocks,
  findMultiModelBlocks,
  findChartBlocks,
  findMathBlocks
} from './blockFinders';

// 内容提取函数
export {
  getMainTextContent,
  getAllTextContent,
  clearGetMainTextContentCache,
  cleanupExpiredCache
} from './contentExtractor';

// 工具函数
export {
  splitContentIntoBlocks,
  guessImageMimeType,
  addBlockToMessage,
  removeBlockFromMessage,
  exportMessageAsText
} from './utilityFunctions';
