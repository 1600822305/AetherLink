import { describe, expect, it } from 'vitest';
import { AssistantMessageStatus, MessageBlockStatus, MessageBlockType } from '../../../shared/types/newMessage';
import type { MainTextMessageBlock, Message, ErrorMessageBlock } from '../../../shared/types/newMessage';
import { shouldShowEmptyContentMessage } from '../messageBlockRenderGuards';

const message: Message = {
  id: 'm1',
  role: 'assistant',
  assistantId: 'a1',
  topicId: 't1',
  status: AssistantMessageStatus.ERROR,
  blocks: ['text1', 'error1'],
  createdAt: '2026-06-08T00:00:00.000Z',
  updatedAt: '2026-06-08T00:00:01.000Z'
};

const emptyTextBlock: MainTextMessageBlock = {
  id: 'text1',
  messageId: 'm1',
  type: MessageBlockType.MAIN_TEXT,
  status: MessageBlockStatus.SUCCESS,
  content: '',
  createdAt: '2026-06-08T00:00:00.000Z'
};

const errorBlock: ErrorMessageBlock = {
  id: 'error1',
  messageId: 'm1',
  type: MessageBlockType.ERROR,
  status: MessageBlockStatus.ERROR,
  content: '当前模型不支持图片输入',
  createdAt: '2026-06-08T00:00:00.000Z'
};

describe('messageBlockRenderGuards', () => {
  it('does not replace error messages with the empty-content loading state', () => {
    expect(shouldShowEmptyContentMessage([emptyTextBlock, errorBlock], message)).toBe(false);
  });

  it('still shows the empty-content state for non-error empty successful text blocks', () => {
    expect(shouldShowEmptyContentMessage([emptyTextBlock], {
      ...message,
      status: AssistantMessageStatus.PAUSED,
      blocks: ['text1']
    })).toBe(true);
  });
});
