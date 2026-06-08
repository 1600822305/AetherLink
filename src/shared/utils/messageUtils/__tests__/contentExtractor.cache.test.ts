import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AssistantMessageStatus, MessageBlockStatus, MessageBlockType } from '../../../types/newMessage';
import type { Message, MessageBlock } from '../../../types/newMessage';

const state = vi.hoisted(() => ({
  blocks: new Map<string, MessageBlock>()
}));

vi.mock('../../../store', () => ({
  default: {
    getState: () => ({
      messageBlocks: {
        ids: Array.from(state.blocks.keys()),
        entities: Object.fromEntries(state.blocks),
        loadingState: 'idle',
        error: null
      }
    })
  }
}));

import { getMainTextContent, clearGetMainTextContentCache } from '../contentExtractor';

function makeMessage(): Message {
  return {
    id: 'msg-1',
    role: 'assistant',
    assistantId: 'assistant-1',
    topicId: 'topic-1',
    createdAt: '2026-06-08T20:00:00.000Z',
    updatedAt: '2026-06-08T20:00:00.000Z',
    status: AssistantMessageStatus.STREAMING,
    blocks: ['block-1']
  };
}

function makeTextBlock(content: string, updatedAt: string): MessageBlock {
  return {
    id: 'block-1',
    messageId: 'msg-1',
    type: MessageBlockType.MAIN_TEXT,
    content,
    createdAt: '2026-06-08T20:00:00.000Z',
    updatedAt,
    status: MessageBlockStatus.STREAMING
  };
}

describe('contentExtractor cache key', () => {
  beforeEach(() => {
    clearGetMainTextContentCache();
    state.blocks.clear();
  });

  it('message.updatedAt 不变时，block.updatedAt/status 变化会命中新缓存键并返回最新内容', () => {
    const message = makeMessage();
    state.blocks.set('block-1', makeTextBlock('old content', '2026-06-08T20:00:01.000Z'));

    expect(getMainTextContent(message)).toBe('old content');

    state.blocks.set('block-1', {
      ...makeTextBlock('new content', '2026-06-08T20:00:02.000Z'),
      status: MessageBlockStatus.SUCCESS
    });

    expect(getMainTextContent(message)).toBe('new content');
  });
});
