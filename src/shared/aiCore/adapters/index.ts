/**
 * Chunk 适配器模块
 * 统一 SDK 到 Chunk 的转换层
 * 
 * 参考 Cherry Studio AiSdkToChunkAdapter 设计
 * 采用单一适配器模式，依赖 AI SDK 的统一事件类型
 */

import { AiSdkToChunkAdapter } from './AiSdkToChunkAdapter';
import type { ChunkAdapterConfig } from './types';

// 导出所有类型
export * from './types';

// 导出统一适配器
export { AiSdkToChunkAdapter } from './AiSdkToChunkAdapter';

// 为了向后兼容，保留旧的适配器类（但都指向统一适配器）
// 在迁移完成后可以删除这些
export { OpenAIChunkAdapter } from './OpenAIChunkAdapter';
export { GeminiChunkAdapter } from './GeminiChunkAdapter';

/**
 * 创建统一的 Chunk 适配器
 * 
 * 设计理念（参考 Cherry Studio）：
 * - 使用 AI SDK 的统一事件类型
 * - 单一适配器处理所有 Provider
 * - 不再需要为每个 Provider 创建独立适配器
 * 
 * @param config 适配器配置
 * @returns 统一的 Chunk 适配器实例
 */
export function createChunkAdapter(config: ChunkAdapterConfig): AiSdkToChunkAdapter {
  return new AiSdkToChunkAdapter(config);
}

/**
 * @deprecated 使用 createChunkAdapter 代替
 * 保留用于向后兼容
 */
export function createChunkAdapterByProvider(
  _providerType: string,
  config: ChunkAdapterConfig
): AiSdkToChunkAdapter {
  console.warn('[ChunkAdapter] createChunkAdapterByProvider 已废弃，请使用 createChunkAdapter');
  return new AiSdkToChunkAdapter(config);
}
