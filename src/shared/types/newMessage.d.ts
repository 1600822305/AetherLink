// 类型声明文件，重新导出newMessage.ts中的类型
export * from './newMessage'; 

// 直接声明类型而不是仅仅重新导出
import type { Model } from './index';

// 消息块类型枚举
export const MessageBlockType: {
  readonly UNKNOWN: "unknown";
  readonly MAIN_TEXT: "main_text";
  readonly THINKING: "thinking";
  readonly IMAGE: "image";
  readonly VIDEO: "video";
  readonly CODE: "code";
  readonly TOOL: "tool";
  readonly FILE: "file";
  readonly ERROR: "error";
  readonly CITATION: "citation";
  readonly TRANSLATION: "translation";
  readonly TABLE: "table";
  readonly MULTI_MODEL: "multi_model";
  readonly CHART: "chart";
  readonly MATH: "math";
};

export type MessageBlockType = typeof MessageBlockType[keyof typeof MessageBlockType];

// 消息块状态枚举
export const MessageBlockStatus: {
  readonly PENDING: "pending";
  readonly PROCESSING: "processing";
  readonly STREAMING: "streaming";
  readonly SUCCESS: "success";
  readonly ERROR: "error";
  readonly PAUSED: "paused";
};

export type MessageBlockStatus = typeof MessageBlockStatus[keyof typeof MessageBlockStatus];

// 基础消息块接口
export interface BaseMessageBlock {
  id: string;
  messageId: string;
  type: MessageBlockType;
  createdAt: string;
  updatedAt?: string;
  status: MessageBlockStatus;
  model?: Model;
  metadata?: Record<string, any>;
  error?: Record<string, any>;
}

// 主文本消息块
export interface MainTextMessageBlock extends BaseMessageBlock {
  type: typeof MessageBlockType.MAIN_TEXT;
  content: string;
}

// 思考过程消息块
export interface ThinkingMessageBlock extends BaseMessageBlock {
  type: typeof MessageBlockType.THINKING;
  content: string;
  thinking_millsec?: number;
}

// 图片消息块
export interface ImageMessageBlock extends BaseMessageBlock {
  type: typeof MessageBlockType.IMAGE;
  url: string;
  base64Data?: string;
  mimeType: string;
  width?: number;
  height?: number;
  size?: number;
}

// 视频消息块
export interface VideoMessageBlock extends BaseMessageBlock {
  type: typeof MessageBlockType.VIDEO;
  url: string;
  base64Data?: string;
  mimeType: string;
  width?: number;
  height?: number;
  size?: number;
  duration?: number;
  poster?: string;
}

// 代码消息块
export interface CodeMessageBlock extends BaseMessageBlock {
  type: typeof MessageBlockType.CODE;
  content: string;
  language?: string;
}

// 工具消息块
export interface ToolMessageBlock extends BaseMessageBlock {
  type: typeof MessageBlockType.TOOL;
  name: string;
  input: Record<string, any>;
  output?: Record<string, any>;
}

// 文件消息块
export interface FileMessageBlock extends BaseMessageBlock {
  type: typeof MessageBlockType.FILE;
  name: string;
  url: string;
  mimeType: string;
  size?: number;
}

// 错误消息块
export interface ErrorMessageBlock extends BaseMessageBlock {
  type: typeof MessageBlockType.ERROR;
  content: string;
}

// 引用消息块
export interface CitationMessageBlock extends BaseMessageBlock {
  type: typeof MessageBlockType.CITATION;
  content: string;
  source: string;
  url?: string;
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

// 表格块 - 已废弃，表格通过Markdown渲染
// export interface TableMessageBlock extends BaseMessageBlock {
//   type: typeof MessageBlockType.TABLE;
//   headers: string[];
//   rows: string[][];
//   caption?: string;
// }

// 多模型响应块
export interface MultiModelMessageBlock extends BaseMessageBlock {
  type: typeof MessageBlockType.MULTI_MODEL;
  responses: {
    modelId: string;
    modelName: string;
    content: string;
    status: MessageBlockStatus;
  }[];
  displayStyle?: 'horizontal' | 'vertical' | 'fold' | 'grid';
}

// 图表块
export interface ChartMessageBlock extends BaseMessageBlock {
  type: typeof MessageBlockType.CHART;
  chartType: 'bar' | 'line' | 'pie' | 'scatter';
  data: any;
  options?: any;
}

// 数学公式块
export interface MathMessageBlock extends BaseMessageBlock {
  type: typeof MessageBlockType.MATH;
  content: string;
  displayMode: boolean;
}

// 消息块联合类型
export type MessageBlock =
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
  | MultiModelMessageBlock
  | ChartMessageBlock
  | MathMessageBlock;

// 助手消息状态枚举
export const AssistantMessageStatus: {
  readonly PENDING: "pending";
  readonly STREAMING: "streaming";
  readonly SUCCESS: "success";
  readonly ERROR: "error";
  readonly PAUSED: "paused";
};

export type AssistantMessageStatus = typeof AssistantMessageStatus[keyof typeof AssistantMessageStatus];

// 用户消息状态枚举
export const UserMessageStatus: {
  readonly SENDING: "sending";
  readonly SUCCESS: "success";
  readonly ERROR: "error";
};

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

// 消息版本类型
export interface MessageVersion {
  id: string;
  messageId: string;
  blocks: MessageBlock['id'][];
  createdAt: string;
  modelId?: string;
  model?: Model;
  isActive?: boolean;
}

// 新消息类型
export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  assistantId: string;
  topicId: string;
  createdAt: string;
  updatedAt?: string;
  status: UserMessageStatus | AssistantMessageStatus;
  modelId?: string;
  model?: Model;
  type?: 'clear';
  isPreset?: boolean;
  useful?: boolean;
  askId?: string;
  mentions?: Model[];
  usage?: Usage;
  metrics?: Metrics;
  blocks: string[];
  versions?: MessageVersion[];
} 