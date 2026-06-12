import { v4 as uuid } from 'uuid';
import type {
  MessageBlock,
  ThinkingMessageBlock,
  ImageMessageBlock,
  VideoMessageBlock,
  CodeMessageBlock,
  TranslationMessageBlock,
  ChartMessageBlock,
  MathMessageBlock,
  CitationMessageBlock,
  KnowledgeReferenceItem,
  WebSearchReferenceItem
} from '../../types/newMessage';
// 注意：MultiModelMessageBlock 已移除，多模型功能现在通过 askId 分组多个独立的助手消息实现
import {
  MessageBlockType,
  MessageBlockStatus
} from '../../types/newMessage';
import type { FileType } from '../../types';

/**
 * 基础块创建函数
 */
function createBaseBlock(
  messageId: string,
  type: MessageBlockType,
  additionalProps: any = {}
): MessageBlock {
  return {
    id: uuid(),
    messageId,
    type,
    createdAt: new Date().toISOString(),
    status: MessageBlockStatus.SUCCESS,
    ...additionalProps
  } as MessageBlock;
}

/**
 * 创建思考块
 */
export function createThinkingBlock(messageId: string, content: string = ''): ThinkingMessageBlock {
  return createBaseBlock(messageId, MessageBlockType.THINKING, {
    content,
    status: MessageBlockStatus.PENDING
  }) as ThinkingMessageBlock;
}

/**
 * 创建图片块
 */
export function createImageBlock(messageId: string, imageData: {
  url: string;
  base64Data?: string;
  mimeType: string;
  width?: number;
  height?: number;
  size?: number;
  file?: FileType;
}): ImageMessageBlock {
  return createBaseBlock(messageId, MessageBlockType.IMAGE, {
    url: imageData.url,
    base64Data: imageData.base64Data,
    mimeType: imageData.mimeType,
    width: imageData.width,
    height: imageData.height,
    size: imageData.size,
    file: imageData.file ? {
      id: imageData.file.id,
      name: imageData.file.name,
      origin_name: imageData.file.origin_name,
      size: imageData.file.size,
      mimeType: imageData.file.mimeType || imageData.mimeType,
      base64Data: imageData.file.base64Data,
      type: imageData.file.type
    } : undefined
  }) as ImageMessageBlock;
}

/**
 * 创建视频块
 */
export function createVideoBlock(messageId: string, videoData: {
  url: string;
  base64Data?: string;
  mimeType: string;
  width?: number;
  height?: number;
  size?: number;
  duration?: number;
  poster?: string;
  file?: FileType;
}): VideoMessageBlock {
  return createBaseBlock(messageId, MessageBlockType.VIDEO, {
    url: videoData.url,
    base64Data: videoData.base64Data,
    mimeType: videoData.mimeType,
    width: videoData.width,
    height: videoData.height,
    size: videoData.size,
    duration: videoData.duration,
    poster: videoData.poster,
    file: videoData.file ? {
      id: videoData.file.id,
      name: videoData.file.name,
      origin_name: videoData.file.origin_name,
      size: videoData.file.size,
      mimeType: videoData.file.mimeType || videoData.mimeType,
      base64Data: videoData.file.base64Data,
      type: videoData.file.type
    } : undefined
  }) as VideoMessageBlock;
}

/**
 * 创建文件块
 */
export function createFileBlock(messageId: string, file: FileType): MessageBlock {
  return createBaseBlock(messageId, MessageBlockType.FILE, {
    name: file.origin_name || file.name || '未知文件',
    url: file.path || '',
    mimeType: file.mimeType || 'application/octet-stream',
    size: file.size,
    file: {
      id: file.id,
      name: file.name,
      origin_name: file.origin_name,
      size: file.size,
      mimeType: file.mimeType || 'application/octet-stream',
      base64Data: file.base64Data,
      type: file.type
    }
  });
}

/**
 * 创建代码块
 */
export function createCodeBlock(messageId: string, content: string, language?: string): CodeMessageBlock {
  return createBaseBlock(messageId, MessageBlockType.CODE, {
    content,
    language
  }) as CodeMessageBlock;
}

/**
 * 创建工具块
 */
export function createToolBlock(messageId: string, toolId: string, overrides: {
  toolName?: string;
  arguments?: Record<string, any>;
  content?: string | object;
  status?: MessageBlockStatus;
  metadata?: any;
  error?: any;
} = {}): MessageBlock {
  // 确定初始状态
  let initialStatus: MessageBlockStatus;
  if (overrides.content !== undefined || overrides.error !== undefined) {
    initialStatus = overrides.error ? MessageBlockStatus.ERROR : MessageBlockStatus.SUCCESS;
  } else if (overrides.toolName || overrides.arguments) {
    initialStatus = MessageBlockStatus.PROCESSING;
  } else {
    initialStatus = MessageBlockStatus.PROCESSING;
  }

  return createBaseBlock(messageId, MessageBlockType.TOOL, {
    toolId,
    toolName: overrides.toolName,
    arguments: overrides.arguments,
    content: overrides.content,
    status: overrides.status || initialStatus,
    metadata: overrides.metadata,
    error: overrides.error
  });
}

/**
 * 创建翻译块
 */
export function createTranslationBlock(
  messageId: string,
  content: string,
  sourceContent: string,
  sourceLanguage: string,
  targetLanguage: string,
  sourceBlockId?: string
): TranslationMessageBlock {
  return createBaseBlock(messageId, MessageBlockType.TRANSLATION, {
    content,
    sourceContent,
    sourceLanguage,
    targetLanguage,
    sourceBlockId
  }) as TranslationMessageBlock;
}

// 注意：createMultiModelBlock 已移除
// 多模型功能现在通过 askId 分组多个独立的助手消息实现，不再使用 MultiModelMessageBlock

/**
 * 创建图表块
 */
export function createChartBlock(
  messageId: string,
  chartType: 'bar' | 'line' | 'pie' | 'scatter',
  data: any,
  options?: any
): ChartMessageBlock {
  return createBaseBlock(messageId, MessageBlockType.CHART, {
    chartType,
    data,
    options
  }) as ChartMessageBlock;
}

/**
 * 创建数学公式块
 */
export function createMathBlock(
  messageId: string,
  content: string,
  displayMode: boolean = true
): MathMessageBlock {
  return createBaseBlock(messageId, MessageBlockType.MATH, {
    content,
    displayMode
  }) as MathMessageBlock;
}

/**
 * 创建统一引用块（知识库 + Web搜索）
 */
export function createCitationBlock(
  messageId: string,
  options: {
    knowledge?: KnowledgeReferenceItem[];
    webSearch?: WebSearchReferenceItem[];
    searchQuery?: string;
    knowledgeBaseIds?: string[];
    knowledgeBaseNames?: string[];
    webSearchProvider?: string;
  }
): CitationMessageBlock {
  const parts: string[] = [];
  if (options.knowledge?.length) {
    parts.push(`知识库引用 (${options.knowledge.length} 条)`);
  }
  if (options.webSearch?.length) {
    parts.push(`网络搜索 (${options.webSearch.length} 条)`);
  }
  const content = parts.join(' + ') || '引用';

  return createBaseBlock(messageId, MessageBlockType.CITATION, {
    content,
    knowledge: options.knowledge,
    webSearch: options.webSearch,
    citationMetadata: {
      searchQuery: options.searchQuery,
      knowledgeBaseIds: options.knowledgeBaseIds,
      knowledgeBaseNames: options.knowledgeBaseNames,
      webSearchProvider: options.webSearchProvider,
    },
    status: MessageBlockStatus.SUCCESS,
  }) as CitationMessageBlock;
}

