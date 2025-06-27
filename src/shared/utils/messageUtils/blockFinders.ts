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
  MultiModelMessageBlock,
  ChartMessageBlock,
  MathMessageBlock
} from '../../types/newMessage';
import { MessageBlockType, MessageBlockStatus } from '../../types/newMessage';
import store from '../../store';
import { messageBlocksSelectors } from '../../store/slices/messageBlocksSlice';
import { DEFAULT_HELLO_CONTENT, BLOCK_ID_PREFIXES } from './constants';

/**
 * 通用块查找函数
 */
function findBlocksByType<T extends MessageBlock>(
  message: Message,
  blockType: MessageBlockType
): T[] {
  if (!message || !message.blocks || message.blocks.length === 0) {
    return [];
  }

  const state = store.getState();
  const blocks: T[] = [];

  for (const blockId of message.blocks) {
    try {
      const block = messageBlocksSelectors.selectById(state, blockId);
      if (block && block.type === blockType) {
        blocks.push(block as T);
      }
    } catch (error) {
      console.error(`[findBlocksByType] 获取块 ${blockId} 失败:`, error);
    }
  }

  return blocks;
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

      // 创建一个默认的主文本块
      const defaultBlock: MainTextMessageBlock = {
        id: BLOCK_ID_PREFIXES.DEFAULT + Date.now(),
        messageId: message.id,
        type: MessageBlockType.MAIN_TEXT,
        content: content || '',
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
      id: BLOCK_ID_PREFIXES.ERROR + Date.now(),
      messageId: message.id,
      type: MessageBlockType.MAIN_TEXT,
      content: DEFAULT_HELLO_CONTENT,
      createdAt: new Date().toISOString(),
      status: MessageBlockStatus.SUCCESS
    }];
  }
}

/**
 * 查找消息的所有思考块
 */
export function findThinkingBlocks(message: Message): ThinkingMessageBlock[] {
  return findBlocksByType<ThinkingMessageBlock>(message, MessageBlockType.THINKING);
}

/**
 * 查找消息的所有图片块
 */
export function findImageBlocks(message: Message): ImageMessageBlock[] {
  return findBlocksByType<ImageMessageBlock>(message, MessageBlockType.IMAGE);
}

/**
 * 查找消息的所有视频块
 */
export function findVideoBlocks(message: Message): VideoMessageBlock[] {
  return findBlocksByType<VideoMessageBlock>(message, MessageBlockType.VIDEO);
}

/**
 * 查找消息的所有代码块
 */
export function findCodeBlocks(message: Message): CodeMessageBlock[] {
  return findBlocksByType<CodeMessageBlock>(message, MessageBlockType.CODE);
}

/**
 * 查找消息的所有引用块
 */
export function findCitationBlocks(message: Message): CitationMessageBlock[] {
  return findBlocksByType<CitationMessageBlock>(message, MessageBlockType.CITATION);
}

/**
 * 查找消息的所有翻译块
 */
export function findTranslationBlocks(message: Message): TranslationMessageBlock[] {
  return findBlocksByType<TranslationMessageBlock>(message, MessageBlockType.TRANSLATION);
}

/**
 * 查找消息的所有多模型响应块
 */
export function findMultiModelBlocks(message: Message): MultiModelMessageBlock[] {
  return findBlocksByType<MultiModelMessageBlock>(message, MessageBlockType.MULTI_MODEL);
}

/**
 * 查找消息的所有图表块
 */
export function findChartBlocks(message: Message): ChartMessageBlock[] {
  return findBlocksByType<ChartMessageBlock>(message, MessageBlockType.CHART);
}

/**
 * 查找消息的所有数学公式块
 */
export function findMathBlocks(message: Message): MathMessageBlock[] {
  return findBlocksByType<MathMessageBlock>(message, MessageBlockType.MATH);
}
