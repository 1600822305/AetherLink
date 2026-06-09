/**
 * 记忆系统模块导出
 */

// 服务
export { memoryService, default as MemoryService } from './MemoryService';
export { MemoryProcessor, createMemoryProcessor } from './MemoryProcessor';

// 提示词
export {
  getFactExtractionPrompt,
  updateMemorySystemPrompt,
  updateMemoryUserPromptTemplate,
  getFactRetrievalMessages,
  getUpdateMemoryMessages,
  parseMessages,
  removeCodeBlocks,
  parseJsonSafe,
  FactRetrievalSchema,
  MemoryUpdateSchema,
} from './prompts';

// 类型
export type {
  MemoryProcessorConfig,
  ProcessedMemoryResult,
} from './MemoryProcessor';
