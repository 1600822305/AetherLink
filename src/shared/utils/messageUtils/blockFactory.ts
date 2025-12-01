import { v4 as uuid } from 'uuid';
import type {
  MessageBlock,
  BaseMessageBlock,
  MainTextMessageBlock,
  ThinkingMessageBlock,
  ImageMessageBlock,
  VideoMessageBlock,
  CodeMessageBlock,
  TranslationMessageBlock,
  MultiModelMessageBlock,
  ChartMessageBlock,
  MathMessageBlock,
  KnowledgeReferenceMessageBlock,
  ErrorMessageBlock,
  CitationMessageBlock,
  PlaceholderMessageBlock
} from '../../types/newMessage';
import {
  MessageBlockType,
  MessageBlockStatus
} from '../../types/newMessage';
import type { FileType } from '../../types';

type MessageBlockTypeValue = typeof MessageBlockType[keyof typeof MessageBlockType];

/**
 * 泛型基础块创建函数
 * 参考 Cherry Studio 的 createBaseMessageBlock 设计
 * 
 * @param messageId 消息 ID
 * @param type 块类型
 * @param overrides 可选的覆盖属性（包含特定块类型的额外字段）
 * @returns 基础消息块
 */
export function createBaseMessageBlock<T extends MessageBlockTypeValue>(
  messageId: string,
  type: T,
  overrides: Record<string, any> = {}
): BaseMessageBlock & { type: T } & Record<string, any> {
  const now = new Date().toISOString();
  return {
    id: uuid(),
    messageId,
    type,
    createdAt: now,
    status: MessageBlockStatus.PROCESSING,
    error: undefined,
    ...overrides
  };
}

/**
 * 创建主文本块
 */
export function createMainTextBlock(
  messageId: string,
  content: string,
  overrides: Partial<Omit<MainTextMessageBlock, 'id' | 'messageId' | 'type' | 'content'>> = {}
): MainTextMessageBlock {
  const baseBlock = createBaseMessageBlock(messageId, MessageBlockType.MAIN_TEXT, overrides);
  return {
    ...baseBlock,
    content,
    knowledgeBaseIds: overrides.knowledgeBaseIds
  };
}

/**
 * 创建占位符块
 */
export function createPlaceholderBlock(
  messageId: string,
  overrides: Partial<Omit<PlaceholderMessageBlock, 'id' | 'messageId' | 'type'>> = {}
): PlaceholderMessageBlock {
  const baseBlock = createBaseMessageBlock(messageId, MessageBlockType.UNKNOWN, {
    status: MessageBlockStatus.PENDING,
    ...overrides
  });
  return {
    ...baseBlock,
    content: overrides.content || ''
  };
}

/**
 * 创建错误块
 */
export function createErrorBlock(
  messageId: string,
  errorData: { message?: string; details?: string; code?: string },
  overrides: Partial<Omit<ErrorMessageBlock, 'id' | 'messageId' | 'type' | 'error'>> = {}
): ErrorMessageBlock {
  const baseBlock = createBaseMessageBlock(messageId, MessageBlockType.ERROR, {
    status: MessageBlockStatus.ERROR,
    error: errorData as Record<string, any>,
    ...overrides
  });
  return {
    ...baseBlock,
    content: errorData.message || 'Unknown error',
    message: errorData.message,
    details: errorData.details,
    code: errorData.code
  };
}

/**
 * 创建引用块
 */
export function createCitationBlock(
  messageId: string,
  citationData: Omit<CitationMessageBlock, keyof BaseMessageBlock | 'type'>,
  overrides: Partial<Omit<CitationMessageBlock, 'id' | 'messageId' | 'type'>> = {}
): CitationMessageBlock {
  const baseBlock = createBaseMessageBlock(messageId, MessageBlockType.CITATION, {
    status: MessageBlockStatus.SUCCESS,
    ...overrides
  });
  return {
    ...baseBlock,
    content: citationData.content || '',
    response: citationData.response,
    knowledge: citationData.knowledge,
    sources: citationData.sources
  };
}

/**
 * 创建思考块
 */
export function createThinkingBlock(messageId: string, content: string = ''): ThinkingMessageBlock {
  return createBaseMessageBlock(messageId, MessageBlockType.THINKING, {
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
  return createBaseMessageBlock(messageId, MessageBlockType.IMAGE, {
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
  return createBaseMessageBlock(messageId, MessageBlockType.VIDEO, {
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
  return createBaseMessageBlock(messageId, MessageBlockType.FILE, {
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
  }) as MessageBlock;
}

/**
 * 创建代码块
 */
export function createCodeBlock(messageId: string, content: string, language?: string): CodeMessageBlock {
  return createBaseMessageBlock(messageId, MessageBlockType.CODE, {
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

  return createBaseMessageBlock(messageId, MessageBlockType.TOOL, {
    toolId,
    toolName: overrides.toolName,
    arguments: overrides.arguments,
    content: overrides.content,
    status: overrides.status || initialStatus,
    metadata: overrides.metadata,
    error: overrides.error
  }) as MessageBlock;
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
  return createBaseMessageBlock(messageId, MessageBlockType.TRANSLATION, {
    content,
    sourceContent,
    sourceLanguage,
    targetLanguage,
    sourceBlockId
  }) as TranslationMessageBlock;
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
  return createBaseMessageBlock(messageId, MessageBlockType.MULTI_MODEL, {
    responses,
    displayStyle
  }) as MultiModelMessageBlock;
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
  return createBaseMessageBlock(messageId, MessageBlockType.CHART, {
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
  return createBaseMessageBlock(messageId, MessageBlockType.MATH, {
    content,
    displayMode
  }) as MathMessageBlock;
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
  return createBaseMessageBlock(messageId, MessageBlockType.KNOWLEDGE_REFERENCE, {
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
  }) as KnowledgeReferenceMessageBlock;
}
