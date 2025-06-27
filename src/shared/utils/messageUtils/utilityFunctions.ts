import { v4 as uuid } from 'uuid';
import type {
  Message,
  MessageBlock,
  MainTextMessageBlock,
  CodeMessageBlock,
  CitationMessageBlock,
  ImageMessageBlock
} from '../../types/newMessage';
import { MessageBlockType, MessageBlockStatus } from '../../types/newMessage';
import store from '../../store';
import { messageBlocksSelectors } from '../../store/slices/messageBlocksSlice';
import { CODE_BLOCK_REGEX, IMAGE_REGEX, IMAGE_MIME_TYPES, DEFAULT_IMAGE_MIME_TYPE } from './constants';

/**
 * 将文本内容智能分割成多个块
 */
export function splitContentIntoBlocks(messageId: string, content: string): MessageBlock[] {
  // 添加安全检查
  if (!content || typeof content !== 'string') {
    return [];
  }

  const blocks: MessageBlock[] = [];
  const now = new Date().toISOString();

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
  const codeBlockRegex = new RegExp(CODE_BLOCK_REGEX.source, CODE_BLOCK_REGEX.flags);
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
  const imageRegex = new RegExp(IMAGE_REGEX.source, IMAGE_REGEX.flags);
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
export function guessImageMimeType(url: string): string {
  if (!url || typeof url !== 'string') {
    return DEFAULT_IMAGE_MIME_TYPE;
  }

  if (url.startsWith('data:')) {
    const mimeMatch = url.match(/^data:([^;]+);/);
    return mimeMatch ? mimeMatch[1] : DEFAULT_IMAGE_MIME_TYPE;
  }

  const extension = url.split('.').pop()?.toLowerCase();
  return IMAGE_MIME_TYPES[extension as keyof typeof IMAGE_MIME_TYPES] || DEFAULT_IMAGE_MIME_TYPE;
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
