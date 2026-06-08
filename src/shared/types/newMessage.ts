// 定义新的消息块系统类型

import type { Model } from './index';

// 消息块类型枚举
// 注意：MULTI_MODEL 已移除，多模型功能现在通过 askId 分组多个独立的助手消息实现
export const MessageBlockType = {
  UNKNOWN: 'unknown',
  MAIN_TEXT: 'main_text',
  THINKING: 'thinking',
  IMAGE: 'image',
  VIDEO: 'video',
  CODE: 'code',
  TOOL: 'tool',
  FILE: 'file',
  ERROR: 'error',
  CITATION: 'citation',
  TRANSLATION: 'translation',
  CHART: 'chart',
  MATH: 'math',
  KNOWLEDGE_REFERENCE: 'knowledge_reference',
  CONTEXT_SUMMARY: 'context_summary'  // 上下文压缩摘要块
} as const;

export type MessageBlockType = typeof MessageBlockType[keyof typeof MessageBlockType];

// 消息块状态枚举
export const MessageBlockStatus = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  STREAMING: 'streaming',
  SUCCESS: 'success',
  ERROR: 'error',
  PAUSED: 'paused'
} as const;

export type MessageBlockStatus = typeof MessageBlockStatus[keyof typeof MessageBlockStatus];

// 终态块状态：流结束后块必须落入其一（用于「收尾不变量」与计时冻结判断）
export const TERMINAL_BLOCK_STATUSES: ReadonlySet<MessageBlockStatus> = new Set([
  MessageBlockStatus.SUCCESS,
  MessageBlockStatus.ERROR,
  MessageBlockStatus.PAUSED
]);

/** 块是否处于终态（已结束，不应再被流式更新/计时） */
export function isTerminalBlockStatus(status: MessageBlockStatus): boolean {
  return TERMINAL_BLOCK_STATUSES.has(status);
}

// 基础消息块接口
export interface BaseMessageBlock {
  id: string
  messageId: string
  type: MessageBlockType
  createdAt: string
  updatedAt?: string
  status: MessageBlockStatus
  model?: Model
  metadata?: Record<string, any>
  error?: Record<string, any>
}

// 占位符消息块（参考最佳实例）
export interface PlaceholderMessageBlock extends BaseMessageBlock {
  type: typeof MessageBlockType.UNKNOWN
  content?: string
}

// 主文本消息块
export interface MainTextMessageBlock extends BaseMessageBlock {
  type: typeof MessageBlockType.MAIN_TEXT
  content: string
}

// 思考过程消息块
export interface ThinkingMessageBlock extends BaseMessageBlock {
  type: typeof MessageBlockType.THINKING
  content: string
  /** 思考耗时（毫秒）。收尾时由「结束时刻 − 起始时刻」算出并定格 */
  thinking_millsec?: number
  /** 思考起始时刻（epoch ms）。计时以时间戳派生，避免计数器累加漂移 */
  thinkingStartTime?: number
}

// 图片消息块
export interface ImageMessageBlock extends BaseMessageBlock {
  type: typeof MessageBlockType.IMAGE
  url: string
  base64Data?: string
  mimeType: string
  width?: number
  height?: number
  size?: number
  file?: {
    id: string
    name: string
    origin_name: string
    size: number
    mimeType: string
    base64Data?: string
    type?: string
  }
}

// 视频消息块
export interface VideoMessageBlock extends BaseMessageBlock {
  type: typeof MessageBlockType.VIDEO
  url: string
  base64Data?: string
  mimeType: string
  width?: number
  height?: number
  size?: number
  duration?: number
  poster?: string
  file?: {
    id: string
    name: string
    origin_name: string
    size: number
    mimeType: string
    base64Data?: string
    type?: string
  }
}

// 代码消息块
export interface CodeMessageBlock extends BaseMessageBlock {
  type: typeof MessageBlockType.CODE
  content: string
  language?: string
}

// 工具消息块 - 统一与最佳实例的数据结构
export interface ToolMessageBlock extends BaseMessageBlock {
  type: typeof MessageBlockType.TOOL
  toolId: string // 必需字段，与最佳实例保持一致
  toolName?: string
  arguments?: Record<string, any>
  content?: string | object
  metadata?: BaseMessageBlock['metadata'] & {
    rawMcpToolResponse?: import('../types').MCPToolResponse
  }
}

// 文件消息块
export interface FileMessageBlock extends BaseMessageBlock {
  type: typeof MessageBlockType.FILE
  name: string
  url: string
  mimeType: string
  size?: number
  file?: {
    id: string
    name: string
    origin_name: string
    size: number
    mimeType: string
    base64Data?: string
    type?: string
  }
}

// 错误消息块
export interface ErrorMessageBlock extends BaseMessageBlock {
  type: typeof MessageBlockType.ERROR
  content: string
  message?: string
  details?: string
  code?: string
}

// 知识库引用条目（统一引用系统）
export interface KnowledgeReferenceItem {
  index: number;
  content: string;
  similarity: number;
  documentId?: string;
  knowledgeBaseId?: string;
  knowledgeBaseName?: string;
  sourceUrl?: string;
}

// Web 搜索引用条目（统一引用系统）
export interface WebSearchReferenceItem {
  index: number;
  title: string;
  url: string;
  snippet?: string;
  content?: string;
  provider?: string;
}

// 引用消息块 — 统一引用系统
// 同时承载知识库引用、Web 搜索引用等多种引用来源
export interface CitationMessageBlock extends BaseMessageBlock {
  type: typeof MessageBlockType.CITATION
  content: string
  source?: string
  url?: string
  // 旧字段：保持向后兼容
  sources?: Array<{
    title?: string
    url?: string
    content?: string
  }>
  response?: any
  // 统一引用数据
  knowledge?: KnowledgeReferenceItem[]
  webSearch?: WebSearchReferenceItem[]
  // 元数据
  citationMetadata?: {
    searchQuery?: string;
    knowledgeBaseIds?: string[];
    knowledgeBaseNames?: string[];
    webSearchProvider?: string;
  }
}

// 翻译块
export interface TranslationMessageBlock extends BaseMessageBlock {
  type: typeof MessageBlockType.TRANSLATION;
  content: string;
  sourceContent: string;
  sourceLanguage: string;
  targetLanguage: string;
  sourceBlockId?: string;
}

// 图表块
export interface ChartMessageBlock extends BaseMessageBlock {
  type: typeof MessageBlockType.CHART;
  chartType: 'bar' | 'line' | 'pie' | 'scatter';
  data: unknown;
  options?: Record<string, unknown>;
}

// 数学公式块
export interface MathMessageBlock extends BaseMessageBlock {
  type: typeof MessageBlockType.MATH;
  content: string;
  displayMode: boolean;
}

// 知识库引用块
export interface KnowledgeReferenceMessageBlock extends BaseMessageBlock {
  type: typeof MessageBlockType.KNOWLEDGE_REFERENCE;
  content: string;
  knowledgeBaseId: string;
  source?: string;
  similarity?: number;
  metadata?: {
    fileName?: string;
    fileId?: string;
    knowledgeDocumentId?: string;
    searchQuery?: string;
    // 综合引用块的额外字段
    isCombined?: boolean;
    resultCount?: number;
    results?: Array<{
      index: number;
      content: string;
      similarity: number;
      documentId?: string;
    }>;
  };
}

// 上下文压缩摘要块
export interface ContextSummaryMessageBlock extends BaseMessageBlock {
  type: typeof MessageBlockType.CONTEXT_SUMMARY;
  content: string;  // 压缩后的摘要内容
  originalMessageCount: number;  // 被压缩的消息数量
  originalTokens: number;  // 原始 Token 数量
  compressedTokens: number;  // 压缩后 Token 数量
  tokensSaved: number;  // 节省的 Token 数量
  cost?: number;  // 压缩成本
  compressedAt: string;  // 压缩时间
  modelId?: string;  // 使用的压缩模型
}

// 消息块联合类型
// 注意：MultiModelMessageBlock 和 ModelComparisonMessageBlock 已移除
// 多模型功能现在通过 askId 分组多个独立的助手消息实现
export type MessageBlock =
  | PlaceholderMessageBlock
  | MainTextMessageBlock
  | ThinkingMessageBlock
  | ImageMessageBlock
  | VideoMessageBlock
  | CodeMessageBlock
  | ToolMessageBlock
  | FileMessageBlock
  | ErrorMessageBlock
  | CitationMessageBlock
  | TranslationMessageBlock
  | ChartMessageBlock
  | MathMessageBlock
  | KnowledgeReferenceMessageBlock
  | ContextSummaryMessageBlock;

// 助手消息状态枚举
export const AssistantMessageStatus = {
  PENDING: 'pending',
  PROCESSING: 'processing', // 添加处理中状态
  SEARCHING: 'searching',   // 添加搜索中状态
  STREAMING: 'streaming',
  SUCCESS: 'success',
  ERROR: 'error',
  PAUSED: 'paused'
} as const;

export type AssistantMessageStatus = typeof AssistantMessageStatus[keyof typeof AssistantMessageStatus];

// 用户消息状态枚举
export const UserMessageStatus = {
  SENDING: 'sending',
  SUCCESS: 'success',
  ERROR: 'error'
} as const;

export type UserMessageStatus = typeof UserMessageStatus[keyof typeof UserMessageStatus];

// 使用量
export interface Usage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

// 指标
export interface Metrics {
  latency: number;
  firstTokenLatency?: number;
}

// 元数据类型，用于替代any
export interface MessageMetadata {
  [key: string]: unknown;
  interrupted?: boolean;
  interruptedAt?: string;
}

// 消息版本类型
export interface MessageVersion {
  id: string;
  messageId: string;
  blocks: MessageBlock['id'][];
  createdAt: string;
  modelId?: string;
  model?: Model;
  isActive?: boolean;
  metadata?: {
    content?: string;
    blockIds?: string[];
    isInitialVersion?: boolean;
    [key: string]: unknown;
  };
}

// 多模型消息展示样式
export type MultiModelMessageStyle = 'horizontal' | 'vertical' | 'fold' | 'grid';

// 新消息类型
export type Message = {
  id: string
  role: 'user' | 'assistant' | 'system'
  assistantId: string
  topicId: string
  createdAt: string
  updatedAt?: string
  status: UserMessageStatus | AssistantMessageStatus
  modelId?: string
  model?: Model
  type?: 'clear'
  isPreset?: boolean
  useful?: boolean
  askId?: string // 关联的问题消息ID，用于多模型响应分组
  mentions?: Model[] // 用户选择的多个模型（用于多模型发送）
  usage?: Usage
  metrics?: Metrics
  blocks: MessageBlock['id'][]
  versions?: MessageVersion[]
  currentVersionId?: string // 当前显示的版本ID
  metadata?: MessageMetadata // 使用具体的MessageMetadata类型
  // 多模型相关
  multiModelMessageStyle?: MultiModelMessageStyle // 多模型消息展示样式
  foldSelected?: boolean // fold模式下是否被选中显示
}