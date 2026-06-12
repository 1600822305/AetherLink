import store from '../store';
import { messageBlocksSelectors } from '../store/slices/messageBlocksSlice';
import type {
  MessageBlock,
  MainTextMessageBlock,
  ThinkingMessageBlock,
  ImageMessageBlock,
  CodeMessageBlock,
  FileMessageBlock,
  CitationMessageBlock,
  Message
} from '../types/newMessage.ts';
import { MessageBlockType } from '../types/newMessage.ts';

/**
 * 查找消息的所有主文本块
 */
export function findMainTextBlocks(message: Message): MainTextMessageBlock[] {
  if (!message || !message.blocks || message.blocks.length === 0) {
    return [];
  }

  const state = store.getState();
  const textBlocks: MainTextMessageBlock[] = [];

  for (const blockId of message.blocks) {
    const block = messageBlocksSelectors.selectById(state, blockId);
    if (block && block.type === MessageBlockType.MAIN_TEXT) {
      textBlocks.push(block as MainTextMessageBlock);
    }
  }

  return textBlocks;
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
      thinkingBlocks.push(block as unknown as ThinkingMessageBlock);
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
 * 查找消息的所有工具块
 */
export function findToolBlocks(message: Message): MessageBlock[] {
  if (!message || !message.blocks || message.blocks.length === 0) {
    return [];
  }

  const state = store.getState();
  const toolBlocks: MessageBlock[] = [];

  for (const blockId of message.blocks) {
    const block = messageBlocksSelectors.selectById(state, blockId);
    if (block && block.type === MessageBlockType.TOOL) {
      toolBlocks.push(block as MessageBlock);
    }
  }

  return toolBlocks;
}

/**
 * 查找消息的所有文件块
 */
export function findFileBlocks(message: Message): FileMessageBlock[] {
  if (!message || !message.blocks || message.blocks.length === 0) {
    return [];
  }

  const state = store.getState();
  const fileBlocks: FileMessageBlock[] = [];

  for (const blockId of message.blocks) {
    const block = messageBlocksSelectors.selectById(state, blockId);
    if (block && block.type === MessageBlockType.FILE) {
      fileBlocks.push(block as FileMessageBlock);
    }
  }

  return fileBlocks;
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

/**
 * 获取消息的主文本内容
 * @param message 消息对象
 * @returns 主文本内容
 */
export function getMainTextContent(message: Message): string {
  if (!message) {
    return '';
  }

  try {
    //  优先检查是否有保存的content字段（多模型对比选择后的内容）
    if (typeof (message as any).content === 'string' && (message as any).content.trim()) {
      return (message as any).content;
    }

    if (!message.blocks || message.blocks.length === 0) {
      return '';
    }

    // 从Redux状态获取所有块
    const state = store.getState();

    const blocks = message.blocks
      .map(blockId => messageBlocksSelectors.selectById(state, blockId))
      .filter(Boolean) as MessageBlock[];

    // 查找主文本块（兼容 UNKNOWN 和 CONTEXT_SUMMARY 类型）
    const textBlocks = blocks.filter(block =>
      block.type === MessageBlockType.MAIN_TEXT ||
      block.type === MessageBlockType.UNKNOWN ||
      block.type === MessageBlockType.CONTEXT_SUMMARY
    );

    // 优先返回第一个有内容的文本块（跳过空的占位块/中间块）
    const nonEmptyBlock = textBlocks.find(block =>
      'content' in block && typeof block.content === 'string' && block.content.trim()
    );
    if (nonEmptyBlock && 'content' in nonEmptyBlock) {
      return nonEmptyBlock.content;
    }

    return '';
  } catch (error) {
    console.error('[blockUtils.getMainTextContent] 获取消息内容失败:', error);
    return '';
  }
}

/**
 * 获取消息的所有文本内容（包括主文本和代码块）
 * @param message 消息对象
 * @returns 所有文本内容
 */
export function getAllTextContent(message: Message): string {
  if (!message || !message.blocks || message.blocks.length === 0) {
    return '';
  }

  // 从Redux状态获取所有块
  const state = store.getState();
  const blocks = message.blocks
    .map(blockId => messageBlocksSelectors.selectById(state, blockId))
    .filter(Boolean) as MessageBlock[];

  // 收集所有文本内容
  const textContents = blocks
    .filter(block => block.type === MessageBlockType.MAIN_TEXT || block.type === MessageBlockType.CODE)
    .map(block => 'content' in block ? block.content : '')
    .filter(Boolean);

  return textContents.join('\n\n');
}

/**
 * 获取消息中的所有图片块
 * @param message 消息对象
 * @returns 图片块数组
 */
export function getImageBlocks(message: Message): MessageBlock[] {
  if (!message || !message.blocks || message.blocks.length === 0) {
    return [];
  }

  // 从Redux状态获取所有块
  const state = store.getState();
  const blocks = message.blocks
    .map(blockId => messageBlocksSelectors.selectById(state, blockId))
    .filter(Boolean) as MessageBlock[];

  // 过滤出图片块
  return blocks.filter(block => block.type === MessageBlockType.IMAGE);
}

/**
 * 获取消息中的所有思考块
 * @param message 消息对象
 * @returns 思考块数组
 */
export function getThinkingBlocks(message: Message): MessageBlock[] {
  if (!message || !message.blocks || message.blocks.length === 0) {
    return [];
  }

  // 从Redux状态获取所有块
  const state = store.getState();
  const blocks = message.blocks
    .map(blockId => messageBlocksSelectors.selectById(state, blockId))
    .filter(Boolean) as MessageBlock[];

  // 过滤出思考块
  return blocks.filter(block => block.type === MessageBlockType.THINKING);
}

/**
 * 获取消息中的所有代码块
 * @param message 消息对象
 * @returns 代码块数组
 */
export function getCodeBlocks(message: Message): MessageBlock[] {
  if (!message || !message.blocks || message.blocks.length === 0) {
    return [];
  }

  // 从Redux状态获取所有块
  const state = store.getState();
  const blocks = message.blocks
    .map(blockId => messageBlocksSelectors.selectById(state, blockId))
    .filter(Boolean) as MessageBlock[];

  // 过滤出代码块
  return blocks.filter(block => block.type === MessageBlockType.CODE);
}


/**
 * 获取特定类型的块
 */
export function getBlocksByType<T extends MessageBlock>(message: Message, type: MessageBlockType): T[] {
  if (!message || !message.blocks || message.blocks.length === 0) {
    return [];
  }

  const state = store.getState();
  const blocks: T[] = [];

  for (const blockId of message.blocks) {
    const block = messageBlocksSelectors.selectById(state, blockId);
    if (block && block.type === type) {
      blocks.push(block as T);
    }
  }

  return blocks;
}