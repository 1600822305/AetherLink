import { MessageBlockType, type CodeMessageBlock, type MessageBlock } from '../../shared/types/newMessage';

/**
 * 检查消息块是否为代码块
 * 作为TypeScript类型守卫
 * @param block 要检查的消息块
 * @returns 如果是代码块则返回true，否则返回false
 */
export function isCodeBlock(block: MessageBlock): block is CodeMessageBlock {
  return block.type === MessageBlockType.CODE;
}

/**
 * 检查消息块是否为主文本块
 * 作为TypeScript类型守卫
 * @param block 要检查的消息块
 * @returns 如果是主文本块则返回true，否则返回false
 */
export function isMainTextBlock(block: MessageBlock): block is any {
  return block.type === MessageBlockType.MAIN_TEXT;
}

/**
 * 检查消息块是否为图像块
 * 作为TypeScript类型守卫
 * @param block 要检查的消息块
 * @returns 如果是图像块则返回true，否则返回false
 */
export function isImageBlock(block: MessageBlock): block is any {
  return block.type === MessageBlockType.IMAGE;
}

/**
 * 检查消息块是否为思考块
 * 作为TypeScript类型守卫
 * @param block 要检查的消息块
 * @returns 如果是思考块则返回true，否则返回false
 */
export function isThinkingBlock(block: MessageBlock): block is any {
  return block.type === MessageBlockType.THINKING;
}

/**
 * 检查消息块是否为文件块
 * 作为TypeScript类型守卫
 * @param block 要检查的消息块
 * @returns 如果是文件块则返回true，否则返回false
 */
export function isFileBlock(block: MessageBlock): block is any {
  return block.type === MessageBlockType.FILE;
}

/**
 * 检查消息块是否为文本类型块
 * 包括主文本、思考、代码、错误等包含文本内容的块
 * @param block 要检查的消息块
 * @returns 如果是文本类型块则返回true，否则返回false
 */
export function isTextLikeBlock(block: MessageBlock): boolean {
  return [
    MessageBlockType.MAIN_TEXT,
    MessageBlockType.THINKING,
    MessageBlockType.CODE,
    MessageBlockType.ERROR,
    MessageBlockType.TRANSLATION
  ].includes(block.type as any);
} 