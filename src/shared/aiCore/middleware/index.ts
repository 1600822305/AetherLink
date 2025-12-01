/**
 * 中间件系统统一导出
 * 
 * 使用方式:
 * import { MiddlewareBuilder, applyMiddlewares, ErrorHandlerMiddleware } from '@/shared/aiCore/middleware';
 */

// 导出类型
export type {
  Middleware,
  MiddlewareFunction,
  MiddlewareContext,
  MiddlewareOptions,
  MiddlewareBuilderOptions,
  AccumulatedData,
  CompletionsExecutionOptions,
  ExecutionResult,
  MiddlewareName,
} from './types';

// 导出常量和工具函数
export {
  MIDDLEWARE_NAMES,
  createInitialContext,
  createEmptyAccumulated,
} from './types';

// 导出注册表
export { MiddlewareRegistry } from './registry';

// 导出构建器
export { MiddlewareBuilder } from './builder';

// 导出组合器
export {
  compose,
  applyMiddlewares,
  createCompletionsExecutor,
  executeWithMiddlewares,
  createContextSnapshot,
} from './composer';

// 导出核心中间件
export {
  ErrorHandlerMiddleware,
  AbortHandlerMiddleware,
  FinalConsumerMiddleware,
  LoggerMiddleware,
  coreMiddlewares,
} from './core';

// ==================== 初始化函数 ====================

import { MiddlewareRegistry } from './registry';
import { coreMiddlewares } from './core';

/** 是否已初始化 */
let initialized = false;

/**
 * 初始化中间件系统
 * 注册所有核心中间件
 */
export function initializeMiddlewares(): void {
  if (initialized) {
    return;
  }

  console.log('[Middleware] 初始化中间件系统...');
  
  // 注册核心中间件
  MiddlewareRegistry.registerAll(coreMiddlewares);

  initialized = true;

  console.log('[Middleware] 已注册中间件:', MiddlewareRegistry.getNames());
  console.log('[Middleware] 统计:', MiddlewareRegistry.getStats());
}

/**
 * 重置中间件系统（用于测试）
 */
export function resetMiddlewares(): void {
  MiddlewareRegistry.clear();
  initialized = false;
}

/**
 * 检查是否已初始化
 */
export function isMiddlewaresInitialized(): boolean {
  return initialized;
}
