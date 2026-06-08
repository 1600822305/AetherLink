import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MessageBlockStatus, MessageBlockType, AssistantMessageStatus } from '../../../types/newMessage';
import type { Message, MessageBlock } from '../../../types/newMessage';

const state = vi.hoisted(() => ({
  messages: new Map<string, Message>(),
  blocks: new Map<string, MessageBlock>(),
  dispatchedTypes: [] as string[]
}));

vi.mock('../../../store', () => ({
  default: {
    getState: () => ({
      messages: {
        entities: Object.fromEntries(state.messages)
      },
      messageBlocks: {
        entities: Object.fromEntries(state.blocks)
      }
    }),
    dispatch: (action: { type: string; payload?: unknown }) => {
      state.dispatchedTypes.push(action.type);

      if (action.type === 'messageBlocks/addOneBlock') {
        const block = action.payload as MessageBlock;
        state.blocks.set(block.id, block);
      }

      if (action.type === 'messageBlocks/updateOneBlock') {
        const update = action.payload as { id: string; changes: Partial<MessageBlock> };
        const block = state.blocks.get(update.id);
        if (block) {
          state.blocks.set(update.id, { ...block, ...update.changes });
        }
      }

      if (action.type === 'normalizedMessages/insertBlockReference') {
        const payload = action.payload as {
          messageId: string;
          blockId: string;
          position?: 'append' | 'prepend' | 'before' | 'after';
          anchorBlockId?: string;
        };
        const message = state.messages.get(payload.messageId);
        if (!message) return action;

        const withoutDuplicate = message.blocks.filter(id => id !== payload.blockId);
        let blocks: string[];

        if (payload.position === 'prepend') {
          blocks = [payload.blockId, ...withoutDuplicate];
        } else if ((payload.position === 'before' || payload.position === 'after') && payload.anchorBlockId) {
          const anchorIndex = withoutDuplicate.indexOf(payload.anchorBlockId);
          const insertIndex = anchorIndex === -1
            ? withoutDuplicate.length
            : payload.position === 'before'
              ? anchorIndex
              : anchorIndex + 1;
          blocks = [
            ...withoutDuplicate.slice(0, insertIndex),
            payload.blockId,
            ...withoutDuplicate.slice(insertIndex)
          ];
        } else {
          blocks = [...withoutDuplicate, payload.blockId];
        }

        state.messages.set(payload.messageId, { ...message, blocks });
      }

      return action;
    }
  }
}));

vi.mock('../../storage/DexieStorageService', () => ({
  dexieStorage: {
    message_blocks: {},
    messages: {},
    transaction: async (_mode: string, _tables: unknown[], callback: () => Promise<void>) => callback(),
    saveMessageBlock: async (block: MessageBlock) => {
      state.blocks.set(block.id, block);
    },
    getMessage: async (messageId: string) => state.messages.get(messageId) ?? null,
    updateMessage: async (messageId: string, changes: Partial<Message>) => {
      const message = state.messages.get(messageId);
      if (message) {
        state.messages.set(messageId, { ...message, ...changes });
      }
    },
    getMessageBlock: async (blockId: string) => state.blocks.get(blockId) ?? null,
    updateMessageBlock: async (blockId: string, changes: Partial<MessageBlock>) => {
      const block = state.blocks.get(blockId);
      if (block) {
        state.blocks.set(blockId, { ...block, ...changes });
      }
    }
  }
}));

import { messageBlockRepository } from '../MessageBlockRepository';

function makeMessage(blocks: string[]): Message {
  return {
    id: 'msg-1',
    role: 'assistant',
    assistantId: 'assistant-1',
    topicId: 'topic-1',
    createdAt: '2026-06-08T20:00:00.000Z',
    status: AssistantMessageStatus.PROCESSING,
    blocks
  };
}

function makeBlock(id: string, status = MessageBlockStatus.PROCESSING): MessageBlock {
  return {
    id,
    messageId: 'msg-1',
    type: MessageBlockType.MAIN_TEXT,
    content: id,
    createdAt: '2026-06-08T20:00:00.000Z',
    status
  };
}

describe('MessageBlockRepository', () => {
  beforeEach(() => {
    state.messages.clear();
    state.blocks.clear();
    state.dispatchedTypes.length = 0;
  });

  it('createBlockAndAttach 在 Dexie 和 Redux 中按最新顺序插入块', async () => {
    state.messages.set('msg-1', makeMessage(['text', 'tool']));
    const citationBlock = makeBlock('citation');

    await messageBlockRepository.createBlockAndAttach(citationBlock, {
      position: { type: 'after', anchorBlockId: 'tool' }
    });

    expect(state.messages.get('msg-1')!.blocks).toEqual(['text', 'tool', 'citation']);
    expect(state.blocks.get('citation')).toEqual(citationBlock);
    expect(state.dispatchedTypes).toContain('messageBlocks/addOneBlock');
    expect(state.dispatchedTypes).toContain('normalizedMessages/insertBlockReference');
  });

  it('updateBlock 拒绝把终态块回退到非终态，避免 Redux/Dexie 分叉', async () => {
    state.blocks.set('done', makeBlock('done', MessageBlockStatus.SUCCESS));

    const applied = await messageBlockRepository.updateBlock('done', {
      status: MessageBlockStatus.STREAMING,
      content: 'late streaming update'
    });

    expect(applied).toBe(false);
    expect(state.blocks.get('done')!.status).toBe(MessageBlockStatus.SUCCESS);
    expect(state.blocks.get('done')!.content).toBe('done');
  });

  it('finalizeMessageBlocks 统一推进非终态块并跳过调用方已处理的块', async () => {
    state.messages.set('msg-1', makeMessage(['skip', 'thinking', 'done']));
    state.blocks.set('skip', makeBlock('skip', MessageBlockStatus.STREAMING));
    state.blocks.set('thinking', {
      ...makeBlock('thinking', MessageBlockStatus.STREAMING),
      type: MessageBlockType.THINKING,
      thinkingStartTime: Date.parse('2026-06-08T20:00:00.000Z')
    });
    state.blocks.set('done', makeBlock('done', MessageBlockStatus.SUCCESS));

    const finalized = await messageBlockRepository.finalizeMessageBlocks('msg-1', {
      now: '2026-06-08T20:00:05.000Z',
      skipBlockIds: ['skip']
    });

    expect(finalized).toBe(1);
    expect(state.blocks.get('skip')!.status).toBe(MessageBlockStatus.STREAMING);
    expect(state.blocks.get('thinking')!.status).toBe(MessageBlockStatus.SUCCESS);
    expect(state.blocks.get('thinking')!.thinking_millsec).toBe(5000);
    expect(state.blocks.get('done')!.status).toBe(MessageBlockStatus.SUCCESS);
  });
});
