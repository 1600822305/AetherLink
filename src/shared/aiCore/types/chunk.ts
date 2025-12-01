/**
 * Chunk 类型定义
 * 增强版 - 基于现有 shared/types/chunk.ts
 * 
 * 直接重新导出现有的 Chunk 类型，并添加一些辅助函数
 */

// 重新导出现有的所有 Chunk 类型
export {
  ChunkType,
  type Chunk,
  type LLMResponseCreatedChunk,
  type LLMResponseInProgressChunk,
  type TextDeltaChunk,
  type TextCompleteChunk,
  type AudioDeltaChunk,
  type AudioCompleteChunk,
  type ImageCreatedChunk,
  type ImageDeltaChunk,
  type ImageCompleteChunk,
  type ThinkingDeltaChunk,
  type ThinkingCompleteChunk,
  type WebSearchInProgressChunk,
  type WebSearchCompleteChunk,
  type LLMWebSearchInProgressChunk,
  type LLMWebSearchCompleteChunk,
  type ExternalToolInProgressChunk,
  type ExternalToolCompleteChunk,
  type LLMResponseCompleteChunk,
  type ErrorChunk,
  type BlockCreatedChunk,
  type BlockInProgressChunk,
  type BlockCompleteChunk,
  type MCPToolCreatedChunk,
  type MCPToolInProgressChunk,
  type MCPToolCompleteChunk,
  type MCPToolResponse,
} from '../../types/chunk';

import { ChunkType, type Chunk } from '../../types/chunk';

// ==================== Type Guards ====================

/**
 * 检查是否为文本增量 Chunk
 */
export function isTextDeltaChunk(chunk: Chunk): chunk is import('../../types/chunk').TextDeltaChunk {
  return chunk.type === ChunkType.TEXT_DELTA;
}

/**
 * 检查是否为文本完成 Chunk
 */
export function isTextCompleteChunk(chunk: Chunk): chunk is import('../../types/chunk').TextCompleteChunk {
  return chunk.type === ChunkType.TEXT_COMPLETE;
}

/**
 * 检查是否为思考增量 Chunk
 */
export function isThinkingDeltaChunk(chunk: Chunk): chunk is import('../../types/chunk').ThinkingDeltaChunk {
  return chunk.type === ChunkType.THINKING_DELTA;
}

/**
 * 检查是否为思考完成 Chunk
 */
export function isThinkingCompleteChunk(chunk: Chunk): chunk is import('../../types/chunk').ThinkingCompleteChunk {
  return chunk.type === ChunkType.THINKING_COMPLETE;
}

/**
 * 检查是否为块完成 Chunk
 */
export function isBlockCompleteChunk(chunk: Chunk): chunk is import('../../types/chunk').BlockCompleteChunk {
  return chunk.type === ChunkType.BLOCK_COMPLETE;
}

/**
 * 检查是否为错误 Chunk
 */
export function isErrorChunk(chunk: Chunk): chunk is import('../../types/chunk').ErrorChunk {
  return chunk.type === ChunkType.ERROR;
}

/**
 * 检查是否为 MCP 工具相关 Chunk
 */
export function isMcpToolChunk(chunk: Chunk): boolean {
  return [
    ChunkType.MCP_TOOL_CREATED,
    ChunkType.MCP_TOOL_IN_PROGRESS,
    ChunkType.MCP_TOOL_COMPLETE,
  ].includes(chunk.type);
}

/**
 * 检查是否为网络搜索相关 Chunk
 */
export function isWebSearchChunk(chunk: Chunk): boolean {
  return [
    ChunkType.WEB_SEARCH_IN_PROGRESS,
    ChunkType.WEB_SEARCH_COMPLETE,
    ChunkType.LLM_WEB_SEARCH_IN_PROGRESS,
    ChunkType.LLM_WEB_SEARCH_COMPLETE,
  ].includes(chunk.type);
}

/**
 * 检查是否为 LLM 响应相关 Chunk
 */
export function isLLMResponseChunk(chunk: Chunk): boolean {
  return [
    ChunkType.LLM_RESPONSE_CREATED,
    ChunkType.LLM_RESPONSE_IN_PROGRESS,
    ChunkType.LLM_RESPONSE_COMPLETE,
  ].includes(chunk.type);
}

// ==================== Chunk Factories ====================

/**
 * 创建文本增量 Chunk
 */
export function createTextDeltaChunk(text: string, options?: {
  chunk_id?: number;
  isFirstChunk?: boolean;
  messageId?: string;
  blockId?: string;
  topicId?: string;
}): import('../../types/chunk').TextDeltaChunk {
  return {
    type: ChunkType.TEXT_DELTA,
    text,
    ...options,
  };
}

/**
 * 创建文本完成 Chunk
 */
export function createTextCompleteChunk(text: string, chunk_id?: number): import('../../types/chunk').TextCompleteChunk {
  return {
    type: ChunkType.TEXT_COMPLETE,
    text,
    chunk_id,
  };
}

/**
 * 创建思考增量 Chunk
 */
export function createThinkingDeltaChunk(text: string, thinking_millsec?: number): import('../../types/chunk').ThinkingDeltaChunk {
  return {
    type: ChunkType.THINKING_DELTA,
    text,
    thinking_millsec,
  };
}

/**
 * 创建思考完成 Chunk
 */
export function createThinkingCompleteChunk(text: string, thinking_millsec?: number): import('../../types/chunk').ThinkingCompleteChunk {
  return {
    type: ChunkType.THINKING_COMPLETE,
    text,
    thinking_millsec,
  };
}

/**
 * 创建错误 Chunk
 */
export function createErrorChunk(message: string, options?: {
  details?: string;
  type?: string;
}): import('../../types/chunk').ErrorChunk {
  return {
    type: ChunkType.ERROR,
    error: {
      message,
      details: options?.details,
      type: options?.type,
    },
  };
}

/**
 * 创建 LLM 响应创建 Chunk
 */
export function createLLMResponseCreatedChunk(): import('../../types/chunk').LLMResponseCreatedChunk {
  return {
    type: ChunkType.LLM_RESPONSE_CREATED,
  };
}

/**
 * 创建块完成 Chunk
 */
export function createBlockCompleteChunk(response?: {
  id?: string;
  content?: string;
  text?: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    thoughts_tokens?: number;
  };
  metrics?: {
    completion_tokens: number;
    time_completion_millsec: number;
    time_first_token_millsec: number;
  };
}): import('../../types/chunk').BlockCompleteChunk {
  return {
    type: ChunkType.BLOCK_COMPLETE,
    response: response as any,
  };
}

// ==================== Chunk Processing Utilities ====================

/**
 * 从 Chunk 流中提取文本内容
 */
export function extractTextFromChunks(chunks: Chunk[]): string {
  return chunks
    .filter((c): c is import('../../types/chunk').TextDeltaChunk | import('../../types/chunk').TextCompleteChunk => 
      c.type === ChunkType.TEXT_DELTA || c.type === ChunkType.TEXT_COMPLETE
    )
    .map(c => c.text)
    .join('');
}

/**
 * 从 Chunk 流中提取思考内容
 */
export function extractThinkingFromChunks(chunks: Chunk[]): string {
  return chunks
    .filter((c): c is import('../../types/chunk').ThinkingDeltaChunk | import('../../types/chunk').ThinkingCompleteChunk => 
      c.type === ChunkType.THINKING_DELTA || c.type === ChunkType.THINKING_COMPLETE
    )
    .map(c => c.text)
    .join('');
}

/**
 * 获取 Chunk 类型的友好名称
 */
export function getChunkTypeName(type: ChunkType): string {
  const names: Record<ChunkType, string> = {
    [ChunkType.BLOCK_CREATED]: '块创建',
    [ChunkType.BLOCK_IN_PROGRESS]: '块处理中',
    [ChunkType.EXTERNEL_TOOL_IN_PROGRESS]: '外部工具处理中',
    [ChunkType.WEB_SEARCH_IN_PROGRESS]: '网络搜索中',
    [ChunkType.WEB_SEARCH_COMPLETE]: '网络搜索完成',
    [ChunkType.KNOWLEDGE_SEARCH_IN_PROGRESS]: '知识库搜索中',
    [ChunkType.KNOWLEDGE_SEARCH_COMPLETE]: '知识库搜索完成',
    [ChunkType.MCP_TOOL_CREATED]: 'MCP工具创建',
    [ChunkType.MCP_TOOL_IN_PROGRESS]: 'MCP工具处理中',
    [ChunkType.MCP_TOOL_COMPLETE]: 'MCP工具完成',
    [ChunkType.EXTERNEL_TOOL_COMPLETE]: '外部工具完成',
    [ChunkType.LLM_RESPONSE_CREATED]: 'LLM响应创建',
    [ChunkType.LLM_RESPONSE_IN_PROGRESS]: 'LLM响应处理中',
    [ChunkType.TEXT_DELTA]: '文本增量',
    [ChunkType.TEXT_COMPLETE]: '文本完成',
    [ChunkType.AUDIO_DELTA]: '音频增量',
    [ChunkType.AUDIO_COMPLETE]: '音频完成',
    [ChunkType.IMAGE_CREATED]: '图像创建',
    [ChunkType.IMAGE_DELTA]: '图像增量',
    [ChunkType.IMAGE_COMPLETE]: '图像完成',
    [ChunkType.THINKING_START]: '思考开始',
    [ChunkType.THINKING_DELTA]: '思考增量',
    [ChunkType.THINKING_COMPLETE]: '思考完成',
    [ChunkType.LLM_WEB_SEARCH_IN_PROGRESS]: 'LLM网络搜索中',
    [ChunkType.LLM_WEB_SEARCH_COMPLETE]: 'LLM网络搜索完成',
    [ChunkType.LLM_RESPONSE_COMPLETE]: 'LLM响应完成',
    [ChunkType.BLOCK_COMPLETE]: '块完成',
    [ChunkType.ERROR]: '错误',
    [ChunkType.SEARCH_IN_PROGRESS_UNION]: '搜索中',
    [ChunkType.SEARCH_COMPLETE_UNION]: '搜索完成',
    [ChunkType.UNKNOWN]: '未知',
  };
  return names[type] || '未知类型';
}
