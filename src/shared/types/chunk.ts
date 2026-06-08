// 临时类型定义，用于解决类型错误
interface ExternalToolResult {
  id: string;
  name: string;
  result: any;
}

interface WebSearchResponse {
  results: any[];
}

interface Response {
  id: string;
  content: string;
}

interface ResponseError {
  message: string;
  details?: string;
  type?: string;
}

// 统一的数据块类型枚举
export enum ChunkType {
  BLOCK_CREATED = 'block_created',
  BLOCK_IN_PROGRESS = 'block_in_progress',
  EXTERNEL_TOOL_IN_PROGRESS = 'externel_tool_in_progress',
  WEB_SEARCH_IN_PROGRESS = 'web_search_in_progress',
  WEB_SEARCH_COMPLETE = 'web_search_complete',
  KNOWLEDGE_SEARCH_IN_PROGRESS = 'knowledge_search_in_progress',
  KNOWLEDGE_SEARCH_COMPLETE = 'knowledge_search_complete',
  MCP_TOOL_CREATED = 'mcp_tool_created',
  MCP_TOOL_IN_PROGRESS = 'mcp_tool_in_progress',
  MCP_TOOL_COMPLETE = 'mcp_tool_complete',
  EXTERNEL_TOOL_COMPLETE = 'externel_tool_complete',
  LLM_RESPONSE_CREATED = 'llm_response_created',
  LLM_RESPONSE_IN_PROGRESS = 'llm_response_in_progress',
  TEXT_DELTA = 'text.delta',
  TEXT_COMPLETE = 'text.complete',
  AUDIO_DELTA = 'audio.delta',
  AUDIO_COMPLETE = 'audio.complete',
  IMAGE_CREATED = 'image.created',
  IMAGE_DELTA = 'image.delta',
  IMAGE_COMPLETE = 'image.complete',
  THINKING_DELTA = 'thinking.delta',
  THINKING_COMPLETE = 'thinking.complete',
  LLM_WEB_SEARCH_IN_PROGRESS = 'llm_websearch_in_progress',
  LLM_WEB_SEARCH_COMPLETE = 'llm_websearch_complete',
  LLM_RESPONSE_COMPLETE = 'llm_response_complete',
  BLOCK_COMPLETE = 'block_complete',
  ERROR = 'error',
  SEARCH_IN_PROGRESS_UNION = 'search_in_progress_union',
  SEARCH_COMPLETE_UNION = 'search_complete_union',
  UNKNOWN = 'unknown'
}

export interface LLMResponseCreatedChunk {
  /**
   * 响应对象
   */
  response?: Response

  /**
   * 数据块类型
   */
  type: ChunkType.LLM_RESPONSE_CREATED
}

export interface LLMResponseInProgressChunk {
  /**
   * 数据块类型
   */
  response?: Response
  type: ChunkType.LLM_RESPONSE_IN_PROGRESS
}

export interface TextDeltaChunk {
  /**
   * 文本内容。
   *
   * ⚠️ 语义约定（归一化边界）：
   * - 若同时提供 `delta`，则 `delta` 为权威的「增量」语义，`text` 仅作兼容/调试用途。
   * - 若未提供 `delta`，则 `text` 为「累积全文」语义（旧供应商默认行为）。
   * 下游统一由 StreamIncrementTracker 归一成增量，块层不再自行猜测累积/增量。
   */
  text: string

  /**
   * 增量文本（本次新增的片段）。
   * 提供时表示供应商按「增量」语义发送（如 Vercel AI SDK 的 text-delta）。
   */
  delta?: string

  /**
   * 数据块ID
   */
  chunk_id?: number

  /**
   * 是否是第一个文本块。
   * 增量语义下用作「新一轮响应开始」的显式信号（替代靠累积长度变短的猜测）。
   */
  isFirstChunk?: boolean

  /**
   * 消息ID
   */
  messageId?: string

  /**
   * 块ID
   */
  blockId?: string

  /**
   * 主题ID
   */
  topicId?: string

  /**
   * 数据块类型
   */
  type: ChunkType.TEXT_DELTA
}

export interface TextCompleteChunk {
  /**
   * 文本内容
   */
  text: string

  /**
   * 数据块ID
   */
  chunk_id?: number

  /**
   * 数据块类型
   */
  type: ChunkType.TEXT_COMPLETE
}

export interface AudioDeltaChunk {
  /**
   * Base64编码的音频数据块
   */
  audio: string

  /**
   * 数据块类型
   */
  type: ChunkType.AUDIO_DELTA
}

export interface AudioCompleteChunk {
  /**
   * 数据块类型
   */
  type: ChunkType.AUDIO_COMPLETE
}

export interface ImageCreatedChunk {
  /**
   * 数据块类型
   */
  type: ChunkType.IMAGE_CREATED
}

export interface ImageDeltaChunk {
  /**
   * Base64编码的图片数据块
   */
  image: string

  /**
   * 数据块类型
   */
  type: ChunkType.IMAGE_DELTA
}

export interface ImageCompleteChunk {
  /**
   * 数据块类型
   */
  type: ChunkType.IMAGE_COMPLETE

  /**
   * 图片内容
   */
  image: { type: 'base64'; images: string[] }
}

export interface ThinkingDeltaChunk {
  /**
   * 思考文本内容。
   * 语义约定同 {@link TextDeltaChunk.text}：提供 `delta` 时为增量，否则为累积全文。
   */
  text: string

  /**
   * 增量思考文本（本次新增的片段）。
   * 提供时表示供应商按「增量」语义发送（如 Vercel AI SDK 的 reasoning-delta）。
   */
  delta?: string

  /**
   * 是否是第一个思考块（增量语义下用作「新一轮」的显式信号）。
   */
  isFirstChunk?: boolean

  /**
   * 思考时间（毫秒）
   */
  thinking_millsec?: number

  /**
   * 数据块类型
   */
  type: ChunkType.THINKING_DELTA
}

export interface ThinkingCompleteChunk {
  /**
   * 思考文本内容
   */
  text: string

  /**
   * 思考时间（毫秒）
   */
  thinking_millsec?: number

  /**
   * 数据块类型
   */
  type: ChunkType.THINKING_COMPLETE
}

export interface WebSearchInProgressChunk {
  /**
   * 数据块类型
   */
  type: ChunkType.WEB_SEARCH_IN_PROGRESS
}

export interface WebSearchCompleteChunk {
  /**
   * 网络搜索响应
   */
  web_search: WebSearchResponse

  /**
   * 数据块ID
   */
  chunk_id?: number

  /**
   * 数据块类型
   */
  type: ChunkType.WEB_SEARCH_COMPLETE
}

export interface LLMWebSearchInProgressChunk {
  /**
   * 数据块类型
   */
  type: ChunkType.LLM_WEB_SEARCH_IN_PROGRESS
}

export interface LLMWebSearchCompleteChunk {
  /**
   * LLM网络搜索响应
   */
  llm_web_search: WebSearchResponse

  /**
   * 数据块类型
   */
  type: ChunkType.LLM_WEB_SEARCH_COMPLETE
}

export interface ExternalToolInProgressChunk {
  /**
   * 数据块类型
   */
  type: ChunkType.EXTERNEL_TOOL_IN_PROGRESS
}

export interface ExternalToolCompleteChunk {
  /**
   * 外部工具结果
   */
  external_tool: ExternalToolResult
  /**
   * 数据块类型
   */
  type: ChunkType.EXTERNEL_TOOL_COMPLETE
}

export interface LLMResponseCompleteChunk {
  /**
   * 响应对象
   */
  response?: Response

  /**
   * 数据块类型
   */
  type: ChunkType.LLM_RESPONSE_COMPLETE
}

export interface ErrorChunk {
  error: ResponseError

  type: ChunkType.ERROR
}

export interface BlockCreatedChunk {
  /**
   * 数据块类型
   */
  type: ChunkType.BLOCK_CREATED
}

export interface BlockInProgressChunk {
  /**
   * 数据块类型
   */
  type: ChunkType.BLOCK_IN_PROGRESS

  /**
   * 响应对象
   */
  response?: Response
}

export interface BlockCompleteChunk {
  /**
   * 完整响应
   */
  response?: Response

  /**
   * 数据块类型
   */
  type: ChunkType.BLOCK_COMPLETE

  /**
   * 错误信息
   */
  error?: ResponseError
}

/**
 * MCP 工具创建事件 - 从 XML 解析出的工具调用
 * 用于流式解析检测到 <tool_use> 或 <tool_name> 标签时
 */
export interface MCPToolCreatedChunk {
  /**
   * 数据块类型
   */
  type: ChunkType.MCP_TOOL_CREATED

  /**
   * 工具响应列表
   */
  responses: MCPToolResponse[]

  /**
   * 检测到的格式类型
   */
  format?: 'tool_use' | 'direct'
}

/**
 * MCP 工具响应类型
 */
export interface MCPToolResponse {
  id: string;
  name: string;
  arguments: Record<string, any>;
  status?: 'pending' | 'running' | 'done' | 'error';
  toolCallId?: string;
}

export interface MCPToolInProgressChunk {
  /**
   * 数据块类型
   */
  type: ChunkType.MCP_TOOL_IN_PROGRESS

  /**
   * 工具响应列表
   */
  responses: any[]
}

export interface MCPToolCompleteChunk {
  /**
   * 数据块类型
   */
  type: ChunkType.MCP_TOOL_COMPLETE

  /**
   * 工具响应列表
   */
  responses: any[]
}

export type Chunk =
  | BlockCreatedChunk
  | BlockInProgressChunk
  | ExternalToolInProgressChunk
  | WebSearchInProgressChunk
  | WebSearchCompleteChunk
  | ExternalToolCompleteChunk
  | LLMResponseCreatedChunk
  | LLMResponseInProgressChunk
  | TextDeltaChunk
  | TextCompleteChunk
  | AudioDeltaChunk
  | AudioCompleteChunk
  | ImageCreatedChunk
  | ImageDeltaChunk
  | ImageCompleteChunk
  | ThinkingDeltaChunk
  | ThinkingCompleteChunk
  | LLMWebSearchInProgressChunk
  | LLMWebSearchCompleteChunk
  | LLMResponseCompleteChunk
  | BlockCompleteChunk
  | MCPToolCreatedChunk
  | MCPToolInProgressChunk
  | MCPToolCompleteChunk
  | ErrorChunk
