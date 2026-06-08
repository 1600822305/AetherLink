import { AssistantMessageStatus, MessageBlockStatus, MessageBlockType } from '../../shared/types/newMessage';
import type { MainTextMessageBlock, Message, MessageBlock } from '../../shared/types/newMessage';

export const isEmptyMainTextBlock = (block: MessageBlock, message: Message): boolean => {
  if (block.type !== MessageBlockType.MAIN_TEXT) return false;
  if (block.status !== MessageBlockStatus.SUCCESS) return false;
  if (message.status === AssistantMessageStatus.ERROR) return false;

  if (['streaming', 'processing', 'success'].includes(message.status)) return false;

  if (message.versions && message.versions.length > 0) return false;

  if ('content' in block) {
    const content = (block as MainTextMessageBlock).content;
    return !content || content.trim() === '';
  }
  return true;
};

export const shouldShowEmptyContentMessage = (blocks: MessageBlock[], message: Message): boolean => {
  if (blocks.length === 0) return false;
  if (blocks.some(block => block.type === MessageBlockType.ERROR)) return false;
  return blocks.some(block => isEmptyMainTextBlock(block, message));
};
