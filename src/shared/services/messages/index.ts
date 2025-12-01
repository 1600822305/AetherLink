/**
 * 消息服务模块
 * 重构后的精简导出
 */

// 核心消息服务
export * from './messageService';

// 消息上下文
export { default as MessageContext } from './MessageContext';

// API Provider
export { default as ApiProviderRegistry } from './ApiProvider';

// 新架构组件从 streaming 模块导出
// import { StreamingBlockManager, createStreamProcessor, createCallbacks } from '../streaming';