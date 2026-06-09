import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MessageBlockType } from '../../../types/newMessage';
import type { Message, MessageBlock } from '../../../types/newMessage';
import type { ChatTopic } from '../../../types';

const state = vi.hoisted(() => ({
  topics: new Map<string, ChatTopic>(),
  messages: new Map<string, Message>(),
  blocks: new Map<string, MessageBlock>(),
  dispatched: [] as { type: string; payload?: unknown }[],
  assistants: [] as { id: string; topics?: ChatTopic[] }[],
}));

vi.mock('../../storage/DexieStorageService', () => ({
  dexieStorage: {
    getTopic: async (id: string) => state.topics.get(id) ?? null,
    getAllTopics: async () => [...state.topics.values()],
    saveTopic: async (topic: ChatTopic) => {
      state.topics.set(topic.id, topic);
    },
    bulkUpdateTopics: async (topics: ChatTopic[]) => {
      for (const topic of topics) {
        state.topics.set(topic.id, topic);
      }
    },
    messages: {
      get: async (id: string) => state.messages.get(id),
    },
    getMessageBlock: async (id: string) => state.blocks.get(id) ?? null,
  },
}));

vi.mock('../../../store', () => ({
  default: {
    dispatch: (action: { type: string; payload?: unknown }) => {
      state.dispatched.push(action);
    },
    getState: () => ({ assistants: { assistants: state.assistants } }),
  },
}));

import { buildPreviewText, refreshTopicPreview, migrateTopicPreviews, formatPreviewText } from '../TopicPreviewService';

function makeTopic(partial: Partial<ChatTopic>): ChatTopic {
  return {
    id: 't1',
    assistantId: 'a1',
    name: '话题',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    isNameManuallyEdited: false,
    messageIds: [],
    ...partial,
  };
}

function makeMessage(id: string, blockIds: string[], extra: Partial<Message> = {}): Message {
  return {
    id,
    role: 'assistant',
    topicId: 't1',
    assistantId: 'a1',
    createdAt: '2024-01-02T00:00:00.000Z',
    updatedAt: '2024-01-02T00:00:00.000Z',
    status: 'success',
    blocks: blockIds,
    ...extra,
  } as Message;
}

function makeTextBlock(id: string, content: string): MessageBlock {
  return {
    id,
    messageId: 'm1',
    type: MessageBlockType.MAIN_TEXT,
    content,
    createdAt: '2024-01-02T00:00:00.000Z',
    status: 'success',
  } as unknown as MessageBlock;
}

describe('TopicPreviewService', () => {
  beforeEach(() => {
    state.topics.clear();
    state.messages.clear();
    state.blocks.clear();
    state.dispatched = [];
    state.assistants = [];
  });

  describe('buildPreviewText', () => {
    it('优先使用消息上保存的 content 字段', async () => {
      const msg = makeMessage('m1', [], { content: '  你好世界  ' } as Partial<Message>);
      expect(await buildPreviewText(msg)).toBe('你好世界');
    });

    it('从主文本块读取内容', async () => {
      state.blocks.set('b1', makeTextBlock('b1', '来自块的内容'));
      const msg = makeMessage('m1', ['b1']);
      expect(await buildPreviewText(msg)).toBe('来自块的内容');
    });

    it('没有文本块时返回空字符串', async () => {
      const msg = makeMessage('m1', []);
      expect(await buildPreviewText(msg)).toBe('');
    });

    it('超长文本被截断并加省略号', async () => {
      const long = 'a'.repeat(100);
      state.blocks.set('b1', makeTextBlock('b1', long));
      const msg = makeMessage('m1', ['b1']);
      const result = await buildPreviewText(msg);
      expect(result.endsWith('…')).toBe(true);
      expect(result.length).toBeLessThan(long.length);
    });
  });

  describe('refreshTopicPreview', () => {
    it('有消息时计算预览并持久化 + 派发 updateTopic', async () => {
      state.blocks.set('b1', makeTextBlock('b1', '最后一条消息'));
      state.messages.set('m1', makeMessage('m1', ['b1']));
      state.topics.set('t1', makeTopic({ messageIds: ['m0', 'm1'] }));

      await refreshTopicPreview('t1');

      const saved = state.topics.get('t1')!;
      expect(saved.messageCount).toBe(2);
      expect(saved.lastMessagePreview).toBe('最后一条消息');

      const dispatched = state.dispatched.find(a => a.type === 'assistants/updateTopic');
      expect(dispatched).toBeDefined();
    });

    it('空话题预览为空字符串、条数为 0', async () => {
      state.topics.set('t1', makeTopic({ messageIds: [] }));

      await refreshTopicPreview('t1');

      const saved = state.topics.get('t1')!;
      expect(saved.messageCount).toBe(0);
      expect(saved.lastMessagePreview).toBe('');
    });

    it('结果无变化时跳过写库与派发（幂等）', async () => {
      state.topics.set('t1', makeTopic({
        messageIds: [],
        messageCount: 0,
        lastMessagePreview: '',
        lastMessageTime: '2024-01-01T00:00:00.000Z',
      }));

      await refreshTopicPreview('t1');

      expect(state.dispatched.length).toBe(0);
    });

    it('话题不存在时安全返回', async () => {
      await expect(refreshTopicPreview('missing')).resolves.toBeUndefined();
      expect(state.dispatched.length).toBe(0);
    });
  });

  describe('formatPreviewText', () => {
    it('折叠空白并裁剪首尾', () => {
      expect(formatPreviewText('  你 好\n世  界  ')).toBe('你 好 世 界');
    });

    it('超长文本截断并加省略号', () => {
      const long = 'a'.repeat(100);
      const result = formatPreviewText(long);
      expect(result.endsWith('…')).toBe(true);
      expect(result.length).toBeLessThan(long.length);
    });
  });

  describe('migrateTopicPreviews', () => {
    it('一次性回填未填预览的话题：写库 + 按助手批量替换 Redux', async () => {
      state.blocks.set('b1', makeTextBlock('b1', '历史最后一条'));
      state.messages.set('m1', makeMessage('m1', ['b1']));
      const topic = makeTopic({ id: 't1', assistantId: 'a1', messageIds: ['m0', 'm1'] });
      state.topics.set('t1', topic);
      state.assistants = [{ id: 'a1', topics: [topic] }];

      await migrateTopicPreviews();

      const saved = state.topics.get('t1')!;
      expect(saved.messageCount).toBe(2);
      expect(saved.lastMessagePreview).toBe('历史最后一条');

      const dispatched = state.dispatched.find(a => a.type === 'assistants/updateAssistantTopics');
      expect(dispatched).toBeDefined();
      const payload = dispatched!.payload as { assistantId: string; topics: ChatTopic[] };
      expect(payload.assistantId).toBe('a1');
      expect(payload.topics[0].lastMessagePreview).toBe('历史最后一条');
    });

    it('空话题回填为空预览、条数为 0', async () => {
      state.topics.set('t1', makeTopic({ id: 't1', assistantId: 'a1', messageIds: [] }));
      state.assistants = [{ id: 'a1', topics: [state.topics.get('t1')!] }];

      await migrateTopicPreviews();

      const saved = state.topics.get('t1')!;
      expect(saved.messageCount).toBe(0);
      expect(saved.lastMessagePreview).toBe('');
    });

    it('已回填过的话题跳过，不写库不派发（幂等且不重复）', async () => {
      state.topics.set('t1', makeTopic({
        id: 't1',
        assistantId: 'a1',
        messageIds: ['m0'],
        messageCount: 1,
        lastMessagePreview: '已有预览',
      }));
      state.assistants = [{ id: 'a1', topics: [state.topics.get('t1')!] }];

      await migrateTopicPreviews();

      expect(state.dispatched.length).toBe(0);
      expect(state.topics.get('t1')!.lastMessagePreview).toBe('已有预览');
    });
  });
});
