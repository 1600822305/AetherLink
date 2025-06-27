import { v4 as uuid } from 'uuid';
import type {
  MessageBlock,
  ThinkingMessageBlock,
  ImageMessageBlock,
  VideoMessageBlock,
  CodeMessageBlock,
  FileMessageBlock,
  ToolMessageBlock,
  TranslationMessageBlock,
  MultiModelMessageBlock,
  ChartMessageBlock,
  MathMessageBlock,
  KnowledgeReferenceMessageBlock
} from '../../types/newMessage';
import {
  MessageBlockType,
  MessageBlockStatus
} from '../../types/newMessage';
import type { FileType } from '../../types';

/**
 * 基础块创建函数
 */
function createBaseBlock<T extends MessageBlock>(
  messageId: string,
  type: T['type'],
  additionalProps: Partial<Omit<T, 'id' | 'messageId' | 'type' | 'createdAt'>> = {}
): T {
  return {
    id: uuid(),
    messageId,
    type,
    createdAt: new Date().toISOString(),
    status: MessageBlockStatus.SUCCESS,
    ...additionalProps
  } as T;
}

/**
 * 创建思考块
 */
export function createThinkingBlock(messageId: string, content: string = ''): ThinkingMessageBlock {
  return createBaseBlock<ThinkingMessageBlock>(messageId, MessageBlockType.THINKING, {
    content,
    status: MessageBlockStatus.PENDING
  });
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
  return createBaseBlock<ImageMessageBlock>(messageId, MessageBlockType.IMAGE, {
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
  });
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
  return createBaseBlock<VideoMessageBlock>(messageId, MessageBlockType.VIDEO, {
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
  });
}

/**
 * 创建文件块
 */
export function createFileBlock(messageId: string, file: FileType): FileMessageBlock {
  return createBaseBlock<FileMessageBlock>(messageId, MessageBlockType.FILE, {
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
  return createBaseBlock<CodeMessageBlock>(messageId, MessageBlockType.CODE, {
    content,
    language
  });
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
} = {}): ToolMessageBlock {
  // 确定初始状态
  let initialStatus: MessageBlockStatus;
  if (overrides.content !== undefined || overrides.error !== undefined) {
    initialStatus = overrides.error ? MessageBlockStatus.ERROR : MessageBlockStatus.SUCCESS;
  } else if (overrides.toolName || overrides.arguments) {
    initialStatus = MessageBlockStatus.PROCESSING;
  } else {
    initialStatus = MessageBlockStatus.PROCESSING;
  }

  return createBaseBlock<ToolMessageBlock>(messageId, MessageBlockType.TOOL, {
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
  return createBaseBlock<TranslationMessageBlock>(messageId, MessageBlockType.TRANSLATION, {
    content,
    sourceContent,
    sourceLanguage,
    targetLanguage,
    sourceBlockId
  });
}

/**
 * 创建多模型响应块
 */
export function createMultiModelBlock(
  messageId: string,
  responses: {
    modelId: string;
    modelName: string;
    content: string;
    status: MessageBlockStatus;
  }[],
  displayStyle: 'horizontal' | 'vertical' | 'fold' | 'grid' = 'vertical'
): MultiModelMessageBlock {
  return createBaseBlock<MultiModelMessageBlock>(messageId, MessageBlockType.MULTI_MODEL, {
    responses,
    displayStyle
  });
}

/**
 * 创建图表块
 */
export function createChartBlock(
  messageId: string,
  chartType: 'bar' | 'line' | 'pie' | 'scatter',
  data: any,
  options?: any
): ChartMessageBlock {
  return createBaseBlock<ChartMessageBlock>(messageId, MessageBlockType.CHART, {
    chartType,
    data,
    options
  });
}

/**
 * 创建数学公式块
 */
export function createMathBlock(
  messageId: string,
  content: string,
  displayMode: boolean = true
): MathMessageBlock {
  return createBaseBlock<MathMessageBlock>(messageId, MessageBlockType.MATH, {
    content,
    displayMode
  });
}

/**
 * 创建知识库引用块
 */
export function createKnowledgeReferenceBlock(
  messageId: string,
  content: string,
  knowledgeBaseId: string,
  options?: {
    source?: string;
    similarity?: number;
    fileName?: string;
    fileId?: string;
    knowledgeDocumentId?: string;
    searchQuery?: string;
    metadata?: KnowledgeReferenceMessageBlock['metadata'];
  }
): KnowledgeReferenceMessageBlock {
  return createBaseBlock<KnowledgeReferenceMessageBlock>(messageId, MessageBlockType.KNOWLEDGE_REFERENCE, {
    content,
    knowledgeBaseId,
    source: options?.source,
    similarity: options?.similarity,
    metadata: options?.metadata || {
      fileName: options?.fileName,
      fileId: options?.fileId,
      knowledgeDocumentId: options?.knowledgeDocumentId,
      searchQuery: options?.searchQuery
    }
  });
}
