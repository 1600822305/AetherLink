import { describe, it, expect } from 'vitest';
import reducer, { newMessagesActions } from '../newMessagesSlice';
import { AssistantMessageStatus } from '../../../types/newMessage';
import type { Message } from '../../../types/newMessage';

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

function stateWithMessage(blocks: string[]) {
  const empty = reducer(undefined, { type: '@@INIT' });
  return reducer(empty, newMessagesActions.addMessage({
    topicId: 'topic-1',
    message: makeMessage(blocks)
  }));
}

describe('newMessagesSlice — block reference insertion', () => {
  it('append 基于当前 state 追加，并且不会重复插入同一个 blockId', () => {
    let state = stateWithMessage(['a']);

    state = reducer(state, newMessagesActions.insertBlockReference({
      messageId: 'msg-1',
      blockId: 'b'
    }));
    state = reducer(state, newMessagesActions.insertBlockReference({
      messageId: 'msg-1',
      blockId: 'b'
    }));

    expect(state.entities['msg-1']!.blocks).toEqual(['a', 'b']);
  });

  it('before/after 插入使用 reducer 内最新 blocks，不依赖调用方传入旧数组', () => {
    let state = stateWithMessage(['text']);

    state = reducer(state, newMessagesActions.insertBlockReference({
      messageId: 'msg-1',
      blockId: 'tool',
      position: 'append'
    }));
    state = reducer(state, newMessagesActions.insertBlockReference({
      messageId: 'msg-1',
      blockId: 'citation',
      position: 'after',
      anchorBlockId: 'tool'
    }));

    expect(state.entities['msg-1']!.blocks).toEqual(['text', 'tool', 'citation']);
  });

  it('prepend 可把引用块放在消息顶部', () => {
    const state = reducer(stateWithMessage(['main']), newMessagesActions.insertBlockReference({
      messageId: 'msg-1',
      blockId: 'knowledge-citation',
      position: 'prepend'
    }));

    expect(state.entities['msg-1']!.blocks).toEqual(['knowledge-citation', 'main']);
  });
});
