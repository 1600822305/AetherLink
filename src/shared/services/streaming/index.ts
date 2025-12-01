/**
 * 流处理服务模块
 * 统一导出流处理相关的所有组件
 * 
 * 参考 Cherry Studio 架构设计
 */

// 导出 StreamProcessor
export { createStreamProcessor, createMinimalStreamProcessor } from './StreamProcessor';

// 导出 BlockManager
export { StreamingBlockManager, createStreamingBlockManager } from './BlockManager';
export type { StreamingBlockManagerConfig } from './BlockManager';

// 导出回调系统
export * from './callbacks';
export { 
  createCallbacks, 
  createMinimalCallbacks, 
  createThinkingCallbacksSet 
} from './callbacks';

// 类型导出
export type { 
  StreamProcessorCallbacks,
  CallbackDependencies,
  IBlockManager,
  MCPTool,
  Assistant,
  KnowledgeReference,
  Citation,
  VideoSearchResult,
  ImageSearchResult
} from './callbacks/types';
