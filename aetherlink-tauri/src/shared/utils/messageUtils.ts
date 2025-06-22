import { v4 as uuid } from 'uuid';
import type {
  Message,
  MessageBlock,
  MainTextMessageBlock,
  ThinkingMessageBlock,
  ImageMessageBlock,
  VideoMessageBlock,
  CodeMessageBlock,
  CitationMessageBlock,
  TranslationMessageBlock,
  // TableMessageBlock, // 已废弃，表格通过Markdown渲染
  MultiModelMessageBlock,
  ChartMessageBlock,
  MathMessageBlock,
  KnowledgeReferenceMessageBlock
} from '../types/newMessage.ts';
import {
  MessageBlockType,
  MessageBlockStatus,
  AssistantMessageStatus,
  UserMessageStatus
} from '../types/newMessage.ts';
import type { Model, FileType } from '../types';
import { FileTypes } from '../utils/fileUtils';
import store from '../store';
import { messageBlocksSelectors } from '../store/slices/messageBlocksSlice';

/**
 * 创建用户消息
 */
export function createUserMessage(options: {
  content: string;
  assistantId: string;
  topicId: string;
  modelId?: string;
  model?: Model;
  images?: Array<{ url: string }>;
  files?: FileType[];
}): { message: Message; blocks: MessageBlock[] } {
  const { content, assistantId, topicId, modelId, model, images, files } = options;
  const messageId = uuid();
  const now = new Date().toISOString();

  // 创建主文本块
  const mainTextBlock: MainTextMessageBlock = {
    id: uuid(),
    messageId,
    type: MessageBlockType.MAIN_TEXT,
    content,
    createdAt: now,
    status: MessageBlockStatus.SUCCESS
  };

  // 创建消息对象
  const message: Message = {
    id: messageId,
    role: 'user',
    assistantId,
    topicId,
    createdAt: now,
    status: UserMessageStatus.SUCCESS,
    modelId,
    model,
    blocks: [mainTextBlock.id]
  };

  const blocks: MessageBlock[] = [mainTextBlock];

  // 如果有图片，创建图片块
  if (images && Array.isArray(images) && images.length > 0) {
    for (const image of images) {
      if (image.url) {
        const imageBlock = createImageBlock(messageId, {
          url: image.url,
          mimeType: guessImageMimeType(image.url)
        });
        blocks.push(imageBlock);
        message.blocks.push(imageBlock.id);
      }
    }
  }

  // 处理文件
  if (files && Array.isArray(files) && files.length > 0) {
    for (const file of files) {
      if (file.type === FileTypes.IMAGE) {
        // 图片文件创建图片块
        const imageBlock = createImageBlock(messageId, {
          file,
          url: file.base64Data ? `data:${file.mimeType};base64,${file.base64Data}` : '',
          mimeType: file.mimeType || 'image/jpeg'
        });
        blocks.push(imageBlock);
        message.blocks.push(imageBlock.id);
      } else if (file.type === FileTypes.VIDEO) {
        // 视频文件创建视频块
        const videoBlock = createVideoBlock(messageId, {
          file,
          url: file.base64Data ? `data:${file.mimeType};base64,${file.base64Data}` : '',
          mimeType: file.mimeType || 'video/mp4'
        });
        blocks.push(videoBlock);
        message.blocks.push(videoBlock.id);
      } else {
        // 其他文件创建文件块
        const fileBlock = createFileBlock(messageId, file);
        blocks.push(fileBlock);
        message.blocks.push(fileBlock.id);
      }
    }
  }

  return { message, blocks };
}

/**
 * 创建助手消息
 */
export function createAssistantMessage(options: {
  assistantId: string;
  topicId: string;
  modelId?: string;
  model?: Model;
  askId?: string;
  initialContent?: string;
  status?: AssistantMessageStatus; // 添加状态参数
}): { message: Message; blocks: MessageBlock[] } {
  const { assistantId, topicId, modelId, model, askId, initialContent = '', status = AssistantMessageStatus.SUCCESS } = options;
  const messageId = uuid();
  const now = new Date().toISOString();

  // 根据消息状态确定块状态
  let blockStatus: MessageBlockStatus = MessageBlockStatus.SUCCESS;
  if (status === AssistantMessageStatus.PENDING || status === AssistantMessageStatus.PROCESSING) {
    blockStatus = MessageBlockStatus.PROCESSING as MessageBlockStatus;
  } else if (status === AssistantMessageStatus.STREAMING) {
    blockStatus = MessageBlockStatus.STREAMING as MessageBlockStatus;
  } else if (status === AssistantMessageStatus.ERROR) {
    blockStatus = MessageBlockStatus.ERROR as MessageBlockStatus;
  } else if (status === AssistantMessageStatus.SEARCHING) {
    blockStatus = MessageBlockStatus.PROCESSING as MessageBlockStatus;
  }

  // 创建主文本块，使用initialContent或空字符串
  const mainTextBlock: MainTextMessageBlock = {
    id: uuid(),
    messageId,
    type: MessageBlockType.MAIN_TEXT,
    content: initialContent, // 使用提供的内容，不再设置默认值
    createdAt: now,
    status: blockStatus // 使用根据消息状态确定的块状态
  };

  // 创建消息对象
  const message: Message = {
    id: messageId,
    role: 'assistant',
    assistantId,
    topicId,
    createdAt: now,
    status, // 使用传入的状态
    modelId,
    model,
    askId,
    blocks: [mainTextBlock.id]
  };

  return { message, blocks: [mainTextBlock] };
}

/**
 * 创建系统消息
 */
export function createSystemMessage(options: {
  content: string;
  assistantId: string;
  topicId: string;
}): { message: Message; blocks: MessageBlock[] } {
  const { content, assistantId, topicId } = options;
  const messageId = uuid();
  const now = new Date().toISOString();

  // 创建主文本块
  const mainTextBlock: MainTextMessageBlock = {
    id: uuid(),
    messageId,
    type: MessageBlockType.MAIN_TEXT,
    content,
    createdAt: now,
    status: MessageBlockStatus.SUCCESS
  };

  // 创建消息对象
  const message: Message = {
    id: messageId,
    role: 'system',
    assistantId,
    topicId,
    createdAt: now,
    status: AssistantMessageStatus.SUCCESS,
    blocks: [mainTextBlock.id]
  };

  return { message, blocks: [mainTextBlock] };
}

/**
 * 创建思考块
 */
export function createThinkingBlock(messageId: string, content: string = ''): MessageBlock {
  return {
    id: uuid(),
    messageId,
    type: MessageBlockType.THINKING,
    content,
    createdAt: new Date().toISOString(),
    status: MessageBlockStatus.PENDING
  };
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
}): MessageBlock {
  return {
    id: uuid(),
    messageId,
    type: MessageBlockType.IMAGE,
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
    } : undefined,
    createdAt: new Date().toISOString(),
    status: MessageBlockStatus.SUCCESS
  };
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
}): MessageBlock {
  return {
    id: uuid(),
    messageId,
    type: MessageBlockType.VIDEO,
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
    } : undefined,
    createdAt: new Date().toISOString(),
    status: MessageBlockStatus.SUCCESS
  };
}

/**
 * 创建文件块
 */
export function createFileBlock(messageId: string, file: FileType): MessageBlock {
  return {
    id: uuid(),
    messageId,
    type: MessageBlockType.FILE,
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
    },
    createdAt: new Date().toISOString(),
    status: MessageBlockStatus.SUCCESS
  };
}

/**
 * 创建代码块
 */
export function createCodeBlock(messageId: string, content: string, language?: string): MessageBlock {
  return {
    id: uuid(),
    messageId,
    type: MessageBlockType.CODE,
    content,
    language,
    createdAt: new Date().toISOString(),
    status: MessageBlockStatus.SUCCESS
  };
}

/**
 * 创建工具块
 * 统一使用最佳实例的工具块结构
 */
export function createToolBlock(messageId: string, toolId: string, overrides: {
  toolName?: string;
  arguments?: Record<string, any>;
  content?: string | object;
  status?: MessageBlockStatus;
  metadata?: any;
  error?: any;
} = {}): MessageBlock {
  const now = new Date().toISOString();

  // 确定初始状态
  let initialStatus: MessageBlockStatus;
  if (overrides.content !== undefined || overrides.error !== undefined) {
    initialStatus = overrides.error ? MessageBlockStatus.ERROR : MessageBlockStatus.SUCCESS;
  } else if (overrides.toolName || overrides.arguments) {
    initialStatus = MessageBlockStatus.PROCESSING;
  } else {
    initialStatus = MessageBlockStatus.PROCESSING;
  }

  return {
    id: uuid(),
    messageId,
    type: MessageBlockType.TOOL,
    toolId, // 必需字段
    toolName: overrides.toolName,
    arguments: overrides.arguments,
    content: overrides.content,
    createdAt: now,
    status: overrides.status || initialStatus,
    metadata: overrides.metadata,
    error: overrides.error
  };
}

/**
 * 查找消息的所有主文本块
 */
export function findMainTextBlocks(message: Message): MainTextMessageBlock[] {
  if (!message || !message.blocks || message.blocks.length === 0) {
    return [];
  }

  try {
    const state = store.getState();
    const textBlocks: MainTextMessageBlock[] = [];

    for (const blockId of message.blocks) {
      try {
        const block = messageBlocksSelectors.selectById(state, blockId);
        if (block && block.type === MessageBlockType.MAIN_TEXT) {
          textBlocks.push(block as MainTextMessageBlock);
        }
      } catch (error) {
        console.error(`[findMainTextBlocks] 获取块 ${blockId} 失败:`, error);
      }
    }

    // 如果没有找到任何主文本块，检查是否应该创建默认块
    if (textBlocks.length === 0) {
      // 检查消息状态，如果是流式输出状态，不创建默认块
      if (message.status === 'streaming' || message.status === 'processing') {
        console.log(`[findMainTextBlocks] 消息 ${message.id} 正在流式输出中，跳过创建默认块`);
        return [];
      }

      // 检查是否是助手消息且刚创建（可能还没有块）
      if (message.role === 'assistant') {
        const messageAge = Date.now() - new Date(message.createdAt).getTime();
        if (messageAge < 5000) { // 5秒内的新消息
          console.log(`[findMainTextBlocks] 消息 ${message.id} 是新创建的助手消息，跳过创建默认块`);
          return [];
        }
      }

      console.warn(`[findMainTextBlocks] 消息 ${message.id} 没有主文本块，创建默认块`);

      // 尝试从旧版本的content属性获取内容
      let content = '';
      if (typeof (message as any).content === 'string') {
        content = (message as any).content;
      }

      // 尝试从版本的metadata中获取内容
      if (!content && message.versions && message.versions.length > 0) {
        const activeVersion = message.versions.find(v => v.isActive);
        if (activeVersion && activeVersion.metadata && activeVersion.metadata.content) {
          content = activeVersion.metadata.content;
          console.log(`[findMainTextBlocks] 从版本metadata中获取内容`);
        }
      }

      // 创建一个默认的主文本块，但不显示"你好"这样的默认内容
      const defaultBlock: MainTextMessageBlock = {
        id: 'default-block-' + Date.now(),
        messageId: message.id,
        type: MessageBlockType.MAIN_TEXT,
        content: content || '', // 使用空字符串而不是默认内容
        createdAt: new Date().toISOString(),
        status: MessageBlockStatus.SUCCESS
      };

      textBlocks.push(defaultBlock);
    }

    return textBlocks;
  } catch (error) {
    console.error('[findMainTextBlocks] 查找主文本块失败:', error);

    // 返回一个默认的主文本块
    return [{
      id: 'error-block-' + Date.now(),
      messageId: message.id,
      type: MessageBlockType.MAIN_TEXT,
      content: '你好', // 使用默认内容
      createdAt: new Date().toISOString(),
      status: MessageBlockStatus.SUCCESS
    }];
  }
}

/**
 * 查找消息的所有思考块
 */
export function findThinkingBlocks(message: Message): ThinkingMessageBlock[] {
  if (!message || !message.blocks || message.blocks.length === 0) {
    return [];
  }

  const state = store.getState();
  const thinkingBlocks: ThinkingMessageBlock[] = [];

  for (const blockId of message.blocks) {
    const block = messageBlocksSelectors.selectById(state, blockId);
    if (block && block.type === MessageBlockType.THINKING) {
      thinkingBlocks.push(block as ThinkingMessageBlock);
    }
  }

  return thinkingBlocks;
}

/**
 * 查找消息的所有图片块
 */
export function findImageBlocks(message: Message): ImageMessageBlock[] {
  if (!message || !message.blocks || message.blocks.length === 0) {
    return [];
  }

  const state = store.getState();
  const imageBlocks: ImageMessageBlock[] = [];

  for (const blockId of message.blocks) {
    const block = messageBlocksSelectors.selectById(state, blockId);
    if (block && block.type === MessageBlockType.IMAGE) {
      imageBlocks.push(block as ImageMessageBlock);
    }
  }

  return imageBlocks;
}

/**
 * 查找消息的所有视频块
 */
export function findVideoBlocks(message: Message): VideoMessageBlock[] {
  if (!message || !message.blocks || message.blocks.length === 0) {
    return [];
  }

  const state = store.getState();
  const videoBlocks: VideoMessageBlock[] = [];

  for (const blockId of message.blocks) {
    const block = messageBlocksSelectors.selectById(state, blockId);
    if (block && block.type === MessageBlockType.VIDEO) {
      videoBlocks.push(block as VideoMessageBlock);
    }
  }

  return videoBlocks;
}

/**
 * 查找消息的所有代码块
 */
export function findCodeBlocks(message: Message): CodeMessageBlock[] {
  if (!message || !message.blocks || message.blocks.length === 0) {
    return [];
  }

  const state = store.getState();
  const codeBlocks: CodeMessageBlock[] = [];

  for (const blockId of message.blocks) {
    const block = messageBlocksSelectors.selectById(state, blockId);
    if (block && block.type === MessageBlockType.CODE) {
      codeBlocks.push(block as CodeMessageBlock);
    }
  }

  return codeBlocks;
}

/**
 * 查找消息的所有引用块
 */
export function findCitationBlocks(message: Message): CitationMessageBlock[] {
  if (!message || !message.blocks || message.blocks.length === 0) {
    return [];
  }

  const state = store.getState();
  const citationBlocks: CitationMessageBlock[] = [];

  for (const blockId of message.blocks) {
    const block = messageBlocksSelectors.selectById(state, blockId);
    if (block && block.type === MessageBlockType.CITATION) {
      citationBlocks.push(block as CitationMessageBlock);
    }
  }

  return citationBlocks;
}

// 用于去重日志的缓存
const loggedWarnings = new Set<string>();

// 内容缓存，避免重复计算
const contentCache = new Map<string, { content: string; timestamp: number }>();
const CACHE_TTL = 5000; // 缓存5秒

/**
 * 获取消息的主要文本内容
 * 优化版本：减少重复日志输出，添加缓存提高性能
 */
export function getMainTextContent(message: Message): string {
  // 安全检查
  if (!message) {
    const warningKey = 'empty-message';
    if (!loggedWarnings.has(warningKey)) {
      console.warn('[getMainTextContent] 消息对象为空');
      loggedWarnings.add(warningKey);
    }
    return '';
  }

  // 检查缓存
  const cacheKey = `${message.id}-${message.updatedAt || message.createdAt}`;
  const cached = contentCache.get(cacheKey);
  const now = Date.now();

  if (cached && (now - cached.timestamp) < CACHE_TTL) {
    return cached.content;
  }

  try {
    //  优先检查是否有保存的content字段（多模型对比选择后的内容或编辑后的内容）
    if (typeof (message as any).content === 'string' && (message as any).content.trim()) {
      const content = (message as any).content.trim();
      // 缓存结果
      contentCache.set(cacheKey, { content, timestamp: now });
      return content;
    }

    // 检查是否有blocks
    if (!message.blocks || message.blocks.length === 0) {
      const warningKey = `no-blocks-${message.id}`;
      if (!loggedWarnings.has(warningKey)) {
        console.warn(`[getMainTextContent] 消息 ${message.id} 没有blocks`);
        loggedWarnings.add(warningKey);
      }

      // 尝试从旧版本的content属性获取内容（兼容性处理）
      if (typeof (message as any).content === 'string') {
        const legacyContent = (message as any).content.trim();
        if (legacyContent) {
          // 缓存结果
          contentCache.set(cacheKey, { content: legacyContent, timestamp: now });
          return legacyContent;
        }
      }

      // 缓存空结果
      contentCache.set(cacheKey, { content: '', timestamp: now });
      return '';
    }

    // 获取Redux状态
    const state = store.getState();
    if (!state) {
      const warningKey = 'redux-unavailable';
      if (!loggedWarnings.has(warningKey)) {
        console.error('[getMainTextContent] Redux状态不可用');
        loggedWarnings.add(warningKey);
      }
      return '';
    }

    //  首先检查是否有模型对比块，并且有选中的内容
    for (const blockId of message.blocks) {
      try {
        const block = messageBlocksSelectors.selectById(state, blockId);
        if (block && block.type === MessageBlockType.MULTI_MODEL) {
          // 检查是否是对比块且有选中内容
          const comparisonBlock = block as any;
          if (comparisonBlock.subType === 'comparison' && comparisonBlock.selectedContent) {
            const selectedContent = comparisonBlock.selectedContent.trim();
            return selectedContent;
          }
        }
      } catch (error) {
        const warningKey = `comparison-block-error-${blockId}`;
        if (!loggedWarnings.has(warningKey)) {
          console.error(`[getMainTextContent] 检查对比块 ${blockId} 失败:`, error);
          loggedWarnings.add(warningKey);
        }
      }
    }

    // 如果没有对比块选中内容，继续查找普通文本块
    const textBlocks: MainTextMessageBlock[] = [];
    const missingBlocks: string[] = [];

    for (const blockId of message.blocks) {
      try {
        const block = messageBlocksSelectors.selectById(state, blockId);
        if (!block) {
          missingBlocks.push(blockId);
          continue;
        }

        // 兼容性处理：同时支持 MAIN_TEXT、UNKNOWN 和字符串类型的块类型
        const blockType = block && typeof block === 'object' ?
          (typeof (block as any).type === 'string' ? (block as any).type : MessageBlockType.UNKNOWN) :
          MessageBlockType.UNKNOWN;

        if (blockType === MessageBlockType.MAIN_TEXT ||
            blockType === MessageBlockType.UNKNOWN ||
            blockType === 'main_text' ||
            blockType === 'MAIN_TEXT') {
          // 对于各种类型的主文本块，都当作主文本块处理
          textBlocks.push(block as MainTextMessageBlock);
        }
      } catch (error) {
        const warningKey = `block-error-${blockId}`;
        if (!loggedWarnings.has(warningKey)) {
          console.error(`[getMainTextContent] 获取块 ${blockId} 失败:`, error);
          loggedWarnings.add(warningKey);
        }
      }
    }

    // 只在有缺失块时输出一次警告
    if (missingBlocks.length > 0) {
      const warningKey = `missing-blocks-${message.id}`;
      if (!loggedWarnings.has(warningKey)) {
        console.warn(`[getMainTextContent] 消息 ${message.id} 缺失 ${missingBlocks.length} 个块:`, missingBlocks);
        loggedWarnings.add(warningKey);
      }
    }

    // 过滤掉空内容的块
    const nonEmptyBlocks = textBlocks.filter(block => {
      const content = block.content;
      return content && typeof content === 'string' && content.trim();
    });

    if (nonEmptyBlocks.length === 0) {
      const warningKey = `no-content-${message.id}`;
      if (!loggedWarnings.has(warningKey)) {
        console.warn(`[getMainTextContent] 消息 ${message.id} 没有有效的文本内容`);
        loggedWarnings.add(warningKey);
      }
      return '';
    }

    // 连接所有文本块的内容
    const result = nonEmptyBlocks.map(block => block.content.trim()).join('\n\n');

    // 缓存结果
    contentCache.set(cacheKey, { content: result, timestamp: now });

    return result;
  } catch (error) {
    const warningKey = `general-error-${message.id}`;
    if (!loggedWarnings.has(warningKey)) {
      console.error('[getMainTextContent] 获取消息内容失败:', error);
      loggedWarnings.add(warningKey);
    }

    // 最后的兜底方案：尝试直接从消息对象获取任何可能的文本内容
    try {
      if (typeof (message as any).content === 'string') {
        const fallbackContent = (message as any).content.trim();
        if (fallbackContent) {
          return fallbackContent;
        }
      }
    } catch (fallbackError) {
      const fallbackWarningKey = `fallback-error-${message.id}`;
      if (!loggedWarnings.has(fallbackWarningKey)) {
        console.error('[getMainTextContent] 兜底方案也失败:', fallbackError);
        loggedWarnings.add(fallbackWarningKey);
      }
    }

    return '';
  }
}

// 清理缓存的函数（可选，用于长时间运行的应用）
export function clearGetMainTextContentCache() {
  loggedWarnings.clear();
  contentCache.clear();
}

// 清理过期缓存
export function cleanupExpiredCache() {
  const now = Date.now();
  for (const [key, value] of contentCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      contentCache.delete(key);
    }
  }
}

/**
 * 获取消息的所有文本内容（包括各类块）
 */
export function getAllTextContent(message: Message): string {
  if (!message || !message.blocks || message.blocks.length === 0) {
    return '';
  }

  const state = store.getState();
  const textParts: string[] = [];

  for (const blockId of message.blocks) {
    const block = messageBlocksSelectors.selectById(state, blockId);
    if (!block) continue;

    switch (block.type) {
      case MessageBlockType.MAIN_TEXT:
      case MessageBlockType.THINKING:
      case MessageBlockType.CODE:
      case MessageBlockType.CITATION:
      case MessageBlockType.TRANSLATION:
        textParts.push((block as any).content);
        break;
      case MessageBlockType.ERROR:
        textParts.push(`Error: ${(block as any).content}`);
        break;
      case MessageBlockType.IMAGE:
        textParts.push('[Image]');
        break;
      case MessageBlockType.FILE:
        textParts.push(`[File: ${(block as any).name}]`);
        break;
      case MessageBlockType.TOOL:
        textParts.push(`[Tool: ${(block as any).name}]`);
        break;
      // case MessageBlockType.TABLE: // 已废弃，表格通过Markdown渲染
      //   textParts.push('[Table]');
      //   break;
      case MessageBlockType.MULTI_MODEL:
        const multiModel = block as MultiModelMessageBlock;
        textParts.push(`[多模型响应: ${multiModel.responses.length}个模型]`);
        break;
      case MessageBlockType.CHART:
        const chart = block as ChartMessageBlock;
        textParts.push(`[图表: ${chart.chartType}]`);
        break;
      case MessageBlockType.MATH:
        textParts.push(`[公式: ${(block as MathMessageBlock).content}]`);
        break;
      default:
        break;
    }
  }

  return textParts.join('\n\n');
}

/**
 * 统一创建消息函数
 */
export function createMessage(options: {
  role: 'user' | 'assistant' | 'system';
  content?: string;
  topicId: string;
  assistantId: string;
  modelId?: string;
  model?: Model;
  askId?: string;
}): { message: Message; blocks: MessageBlock[] } {
  const {
    role,
    content = '',
    topicId,
    assistantId,
    modelId,
    model,
    askId
  } = options;

  if (role === 'user') {
    return createUserMessage({
      content,
      assistantId,
      topicId,
      modelId,
      model
    });
  } else if (role === 'assistant') {
    return createAssistantMessage({
      assistantId,
      topicId,
      modelId,
      model,
      askId,
      initialContent: content
    });
  } else {
    return createSystemMessage({
      content,
      assistantId,
      topicId
    });
  }
}

/**
 * 将文本内容智能分割成多个块
 * 用于处理复杂的文本内容，如包含代码块、图片链接等的内容
 */
export function splitContentIntoBlocks(messageId: string, content: string): MessageBlock[] {
  // 添加安全检查
  if (!content || typeof content !== 'string') {
    return [];
  }

  const blocks: MessageBlock[] = [];
  const now = new Date().toISOString();

  // 简单的代码块检测正则表达式：```language ... ```
  const codeBlockRegex = /```([a-zA-Z0-9]*)\n([\s\S]*?)```/g;

  // 简单的图片链接检测正则表达式：![alt](url)
  const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;

  // 记录上一个匹配结束的位置
  let lastIndex = 0;

  // 临时保存提取的代码块
  const extractedBlocks: {
    type: 'code' | 'image';
    start: number;
    end: number;
    content: string;
    language?: string;
    url?: string;
  }[] = [];

  // 提取代码块
  let match: RegExpExecArray | null;
  while ((match = codeBlockRegex.exec(content)) !== null) {
    extractedBlocks.push({
      type: 'code',
      start: match.index,
      end: match.index + match[0].length,
      content: match[2],
      language: match[1] || undefined
    });
  }

  // 提取图片链接
  while ((match = imageRegex.exec(content)) !== null) {
    extractedBlocks.push({
      type: 'image',
      start: match.index,
      end: match.index + match[0].length,
      content: match[1], // alt text
      url: match[2]
    });
  }

  // 排序提取的块，按照它们在原始文本中的位置
  extractedBlocks.sort((a, b) => a.start - b.start);

  // 处理文本和提取的块
  for (const block of extractedBlocks) {
    // 如果提取的块前面有文本，创建文本块
    if (block.start > lastIndex) {
      const textContent = content.slice(lastIndex, block.start);
      if (textContent.trim()) {
        blocks.push({
          id: uuid(),
          messageId,
          type: MessageBlockType.MAIN_TEXT,
          content: textContent,
          createdAt: now,
          status: MessageBlockStatus.SUCCESS
        });
      }
    }

    // 创建提取的块
    if (block.type === 'code') {
      blocks.push({
        id: uuid(),
        messageId,
        type: MessageBlockType.CODE,
        content: block.content,
        language: block.language,
        createdAt: now,
        status: MessageBlockStatus.SUCCESS
      });
    } else if (block.type === 'image' && block.url) {
      blocks.push({
        id: uuid(),
        messageId,
        type: MessageBlockType.IMAGE,
        url: block.url,
        mimeType: guessImageMimeType(block.url),
        createdAt: now,
        status: MessageBlockStatus.SUCCESS
      });
    }

    lastIndex = block.end;
  }

  // 处理剩余的文本
  if (lastIndex < content.length) {
    const textContent = content.slice(lastIndex);
    if (textContent.trim() || blocks.length === 0) {
      blocks.push({
        id: uuid(),
        messageId,
        type: MessageBlockType.MAIN_TEXT,
        content: textContent,
        createdAt: now,
        status: MessageBlockStatus.SUCCESS
      });
    }
  }

  return blocks;
}

/**
 * 尝试推测图片的MIME类型
 */
function guessImageMimeType(url: string): string {
  if (!url || typeof url !== 'string') {
    return 'image/jpeg';
  }

  if (url.startsWith('data:')) {
    const mimeMatch = url.match(/^data:([^;]+);/);
    return mimeMatch ? mimeMatch[1] : 'image/jpeg';
  }

  const extension = url.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    case 'svg':
      return 'image/svg+xml';
    default:
      return 'image/jpeg';
  }
}

/**
 * 添加块到消息
 */
export function addBlockToMessage(message: Message, block: MessageBlock): Message {
  if (!message.blocks.includes(block.id)) {
    return {
      ...message,
      blocks: [...message.blocks, block.id],
      updatedAt: new Date().toISOString()
    };
  }
  return message;
}

/**
 * 移除块从消息
 */
export function removeBlockFromMessage(message: Message, blockId: string): Message {
  if (message.blocks.includes(blockId)) {
    return {
      ...message,
      blocks: message.blocks.filter((id: string) => id !== blockId),
      updatedAt: new Date().toISOString()
    };
  }
  return message;
}

/**
 * 将消息导出为简单文本格式
 */
export function exportMessageAsText(message: Message): string {
  const state = store.getState();
  let result = '';

  // 添加角色前缀
  if (message.role === 'user') {
    result += '🧑 用户: \n';
  } else if (message.role === 'assistant') {
    result += '🤖 助手: \n';
  } else {
    result += '💻 系统: \n';
  }

  // 处理每个块
  for (const blockId of message.blocks) {
    const block = messageBlocksSelectors.selectById(state, blockId);
    if (!block) continue;

    switch (block.type) {
      case MessageBlockType.MAIN_TEXT:
      case MessageBlockType.THINKING:
        result += (block as MainTextMessageBlock).content + '\n\n';
        break;

      case MessageBlockType.CODE:
        const codeBlock = block as CodeMessageBlock;
        result += '```' + (codeBlock.language || '') + '\n';
        result += codeBlock.content + '\n';
        result += '```\n\n';
        break;

      case MessageBlockType.CITATION:
        const citationBlock = block as CitationMessageBlock;
        result += `> ${citationBlock.content}\n`;
        if (citationBlock.source) {
          result += `> —— ${citationBlock.source}\n\n`;
        }
        break;

      case MessageBlockType.IMAGE:
        const imageBlock = block as ImageMessageBlock;
        result += `[图片: ${imageBlock.url}]\n\n`;
        break;

      default:
        // 其他类型块暂不处理
        break;
    }
  }

  return result.trim();
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
): MessageBlock {
  return {
    id: uuid(),
    messageId,
    type: MessageBlockType.TRANSLATION,
    content,
    sourceContent,
    sourceLanguage,
    targetLanguage,
    sourceBlockId,
    createdAt: new Date().toISOString(),
    status: MessageBlockStatus.SUCCESS
  };
}

/**
 * 创建表格块 - 已废弃，表格通过Markdown渲染
 */
// export function createTableBlock(
//   messageId: string,
//   headers: string[],
//   rows: string[][],
//   caption?: string
// ): MessageBlock {
//   return {
//     id: uuid(),
//     messageId,
//     type: MessageBlockType.TABLE,
//     headers,
//     rows,
//     caption,
//     createdAt: new Date().toISOString(),
//     status: MessageBlockStatus.SUCCESS
//   };
// }

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
): MessageBlock {
  return {
    id: uuid(),
    messageId,
    type: MessageBlockType.MULTI_MODEL,
    responses,
    displayStyle,
    createdAt: new Date().toISOString(),
    status: MessageBlockStatus.SUCCESS
  };
}

/**
 * 创建图表块
 */
export function createChartBlock(
  messageId: string,
  chartType: 'bar' | 'line' | 'pie' | 'scatter',
  data: any,
  options?: any
): MessageBlock {
  return {
    id: uuid(),
    messageId,
    type: MessageBlockType.CHART,
    chartType,
    data,
    options,
    createdAt: new Date().toISOString(),
    status: MessageBlockStatus.SUCCESS
  };
}

/**
 * 创建数学公式块
 */
export function createMathBlock(
  messageId: string,
  content: string,
  displayMode: boolean = true
): MessageBlock {
  return {
    id: uuid(),
    messageId,
    type: MessageBlockType.MATH,
    content,
    displayMode,
    createdAt: new Date().toISOString(),
    status: MessageBlockStatus.SUCCESS
  };
}

/**
 * 查找消息的所有翻译块
 */
export function findTranslationBlocks(message: Message): TranslationMessageBlock[] {
  if (!message || !message.blocks || message.blocks.length === 0) {
    return [];
  }

  const state = store.getState();
  const translationBlocks: TranslationMessageBlock[] = [];

  for (const blockId of message.blocks) {
    const block = messageBlocksSelectors.selectById(state, blockId);
    if (block && block.type === MessageBlockType.TRANSLATION) {
      translationBlocks.push(block as TranslationMessageBlock);
    }
  }

  return translationBlocks;
}

/**
 * 查找消息的所有表格块 - 已废弃，表格通过Markdown渲染
 */
// export function findTableBlocks(message: Message): TableMessageBlock[] {
//   if (!message || !message.blocks || message.blocks.length === 0) {
//     return [];
//   }

//   const state = store.getState();
//   const tableBlocks: TableMessageBlock[] = [];

//   for (const blockId of message.blocks) {
//     const block = messageBlocksSelectors.selectById(state, blockId);
//     if (block && block.type === MessageBlockType.TABLE) {
//       tableBlocks.push(block as TableMessageBlock);
//     }
//   }

//   return tableBlocks;
// }

/**
 * 查找消息的所有多模型响应块
 */
export function findMultiModelBlocks(message: Message): MultiModelMessageBlock[] {
  if (!message || !message.blocks || message.blocks.length === 0) {
    return [];
  }

  const state = store.getState();
  const multiModelBlocks: MultiModelMessageBlock[] = [];

  for (const blockId of message.blocks) {
    const block = messageBlocksSelectors.selectById(state, blockId);
    if (block && block.type === MessageBlockType.MULTI_MODEL) {
      multiModelBlocks.push(block as MultiModelMessageBlock);
    }
  }

  return multiModelBlocks;
}

/**
 * 查找消息的所有图表块
 */
export function findChartBlocks(message: Message): ChartMessageBlock[] {
  if (!message || !message.blocks || message.blocks.length === 0) {
    return [];
  }

  const state = store.getState();
  const chartBlocks: ChartMessageBlock[] = [];

  for (const blockId of message.blocks) {
    const block = messageBlocksSelectors.selectById(state, blockId);
    if (block && block.type === MessageBlockType.CHART) {
      chartBlocks.push(block as ChartMessageBlock);
    }
  }

  return chartBlocks;
}

/**
 * 查找消息的所有数学公式块
 */
export function findMathBlocks(message: Message): MathMessageBlock[] {
  if (!message || !message.blocks || message.blocks.length === 0) {
    return [];
  }

  const state = store.getState();
  const mathBlocks: MathMessageBlock[] = [];

  for (const blockId of message.blocks) {
    const block = messageBlocksSelectors.selectById(state, blockId);
    if (block && block.type === MessageBlockType.MATH) {
      mathBlocks.push(block as MathMessageBlock);
    }
  }

  return mathBlocks;
}

/**
 * 重置助手消息，创建一个干净的消息对象，为重新生成做准备
 *
 * @param originalMessage 原始助手消息
 * @param updates 可选的更新内容，例如状态、模型等
 * @returns 重置后的消息对象
 */
export function resetAssistantMessage(
  originalMessage: Message,
  updates?: Partial<Pick<Message, 'status' | 'updatedAt' | 'model' | 'modelId'>>
): Message {
  // 确保只重置助手消息
  if (originalMessage.role !== 'assistant') {
    console.warn(
      `[resetAssistantMessage] 尝试重置非助手消息 (ID: ${originalMessage.id}, Role: ${originalMessage.role})。返回原始消息。`
    );
    return originalMessage;
  }

  // 创建重置后的消息
  return {
    // --- 保留核心标识符 ---
    id: originalMessage.id,  // 保持相同的消息ID
    topicId: originalMessage.topicId,
    askId: originalMessage.askId,  // 保持与原始用户查询的链接

    // --- 保留身份信息 ---
    role: 'assistant',
    assistantId: originalMessage.assistantId,
    model: originalMessage.model,  // 保持模型信息
    modelId: originalMessage.modelId,

    // --- 重置响应内容和状态 ---
    blocks: [],  // 清空块数组
    status: AssistantMessageStatus.PENDING,  // 默认设置为PENDING

    // --- 时间戳 ---
    createdAt: originalMessage.createdAt,  // 保留原始创建时间
    updatedAt: new Date().toISOString(),   // 更新时间设为当前

    // --- 应用传入的更新 ---
    ...updates  // 应用任何特定的更新
  };
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
    // 支持传递完整的metadata对象
    metadata?: KnowledgeReferenceMessageBlock['metadata'];
  }
): KnowledgeReferenceMessageBlock {
  return {
    id: uuid(),
    messageId,
    type: MessageBlockType.KNOWLEDGE_REFERENCE,
    content,
    knowledgeBaseId,
    source: options?.source,
    similarity: options?.similarity,
    createdAt: new Date().toISOString(),
    status: MessageBlockStatus.SUCCESS,
    metadata: options?.metadata || {
      fileName: options?.fileName,
      fileId: options?.fileId,
      knowledgeDocumentId: options?.knowledgeDocumentId,
      searchQuery: options?.searchQuery
    }
  };
}