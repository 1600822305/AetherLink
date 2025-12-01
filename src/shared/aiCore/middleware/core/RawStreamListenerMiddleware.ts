/**
 * 原始流监听中间件
 * 对标 Cherry Studio RawStreamListenerMiddleware
 * 
 * 监听和记录原始 SDK 流数据，用于调试和分析
 */
import type { CompletionsMiddleware } from '../types';
import type { CompletionsResult } from '../schemas';
import { ChunkType, type Chunk } from '../../types/chunk';

export const MIDDLEWARE_NAME = 'RawStreamListenerMiddleware';

/**
 * 流监听配置
 */
export interface StreamListenerConfig {
  /** 是否启用监听 */
  enabled: boolean;
  /** 是否记录详细日志 */
  verbose: boolean;
  /** 自定义监听器 */
  onRawChunk?: (chunk: unknown, index: number) => void;
  /** 流开始回调 */
  onStreamStart?: () => void;
  /** 流结束回调 */
  onStreamEnd?: (stats: StreamStats) => void;
}

/**
 * 流统计信息
 */
export interface StreamStats {
  /** 总 chunk 数量 */
  totalChunks: number;
  /** 流持续时间 (ms) */
  duration: number;
  /** 首个 chunk 延迟 (ms) */
  timeToFirstChunk: number;
  /** 总字符数 */
  totalCharacters: number;
  /** 错误数量 */
  errorCount: number;
}

/** 默认配置 */
const DEFAULT_CONFIG: StreamListenerConfig = {
  enabled: process.env.NODE_ENV === 'development',
  verbose: false,
};

/** 全局配置 */
let globalConfig: StreamListenerConfig = { ...DEFAULT_CONFIG };

/**
 * 设置全局监听配置
 */
export function setStreamListenerConfig(config: Partial<StreamListenerConfig>): void {
  globalConfig = { ...globalConfig, ...config };
}

/**
 * 获取当前配置
 */
export function getStreamListenerConfig(): StreamListenerConfig {
  return { ...globalConfig };
}

/**
 * 原始流监听中间件
 * 监听原始流数据，收集统计信息
 */
export const RawStreamListenerMiddleware: CompletionsMiddleware = (_api) => (next) =>
  async (context, params): Promise<CompletionsResult> => {
    const config = globalConfig;
    
    // 如果未启用，直接跳过
    if (!config.enabled) {
      return next(context, params);
    }

    const { onChunk } = params;
    const startTime = Date.now();
    let firstChunkTime: number | null = null;
    let chunkIndex = 0;
    let totalCharacters = 0;
    let errorCount = 0;

    // 通知流开始
    config.onStreamStart?.();

    if (config.verbose) {
      console.log('[RawStreamListener] 流开始', {
        model: params.assistant?.model,
        timestamp: new Date().toISOString(),
      });
    }

    // 包装 onChunk 以监听原始数据
    const wrappedOnChunk = onChunk
      ? async (chunk: Chunk) => {
          // 记录首个 chunk 时间
          if (firstChunkTime === null) {
            firstChunkTime = Date.now();
            if (config.verbose) {
              console.log('[RawStreamListener] 首个 chunk', {
                delay: firstChunkTime - startTime,
                type: chunk.type,
              });
            }
          }

          // 调用自定义监听器
          config.onRawChunk?.(chunk, chunkIndex);

          // 统计字符数
          if (chunk.type === ChunkType.TEXT_DELTA && 'text' in chunk) {
            totalCharacters += (chunk.text as string)?.length || 0;
          }

          // 记录错误
          if (chunk.type === ChunkType.ERROR) {
            errorCount++;
            if (config.verbose) {
              console.error('[RawStreamListener] 错误 chunk', chunk);
            }
          }

          // 详细日志
          if (config.verbose) {
            console.log(`[RawStreamListener] Chunk #${chunkIndex}`, {
              type: chunk.type,
              hasText: 'text' in chunk,
            });
          }

          chunkIndex++;

          // 转发给原始回调
          await onChunk(chunk);
        }
      : undefined;

    try {
      // 执行下游中间件
      const result = await next(context, { ...params, onChunk: wrappedOnChunk });

      // 收集统计信息
      const endTime = Date.now();
      const stats: StreamStats = {
        totalChunks: chunkIndex,
        duration: endTime - startTime,
        timeToFirstChunk: firstChunkTime ? firstChunkTime - startTime : 0,
        totalCharacters,
        errorCount,
      };

      // 通知流结束
      config.onStreamEnd?.(stats);

      if (config.verbose) {
        console.log('[RawStreamListener] 流结束', stats);
      }

      // 将统计信息附加到结果
      return {
        ...result,
        _streamStats: stats,
      } as CompletionsResult & { _streamStats: StreamStats };
    } catch (error) {
      errorCount++;
      
      const endTime = Date.now();
      const stats: StreamStats = {
        totalChunks: chunkIndex,
        duration: endTime - startTime,
        timeToFirstChunk: firstChunkTime ? firstChunkTime - startTime : 0,
        totalCharacters,
        errorCount,
      };

      config.onStreamEnd?.(stats);

      if (config.verbose) {
        console.error('[RawStreamListener] 流异常结束', { error, stats });
      }

      throw error;
    }
  };

/**
 * 创建带自定义配置的监听中间件
 */
export function createRawStreamListenerMiddleware(
  config: Partial<StreamListenerConfig>
): CompletionsMiddleware {
  const mergedConfig = { ...globalConfig, ...config };
  
  return (_api) => (next) => async (context, params) => {
    // 临时应用配置
    const originalConfig = globalConfig;
    globalConfig = mergedConfig;
    
    try {
      return await RawStreamListenerMiddleware(_api)(next)(context, params);
    } finally {
      globalConfig = originalConfig;
    }
  };
}
