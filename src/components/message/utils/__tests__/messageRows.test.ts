import { describe, it, expect } from 'vitest';
import { buildMessageRows, collectBlockIdsForRows } from '../messageRows';
import { MessageGroupingType } from '../../../../shared/utils/messageGrouping';
import type { Message } from '../../../../shared/types/newMessage';

/** 构造最小可用消息 */
function msg(partial: Partial<Message> & { id: string; role: Message['role'] }): Message {
  return {
    createdAt: '2024-01-01T10:00:00.000Z',
    blocks: [],
    ...partial,
  } as Message;
}

describe('buildMessageRows', () => {
  it('空消息返回空行', () => {
    expect(buildMessageRows([], MessageGroupingType.BY_DATE)).toEqual([]);
  });

  it('byDate：同一天产生 1 个日期头 + 每条一个 unit 行', () => {
    const messages = [
      msg({ id: 'u1', role: 'user' }),
      msg({ id: 'a1', role: 'assistant', askId: 'u1' }),
    ];
    const rows = buildMessageRows(messages, MessageGroupingType.BY_DATE);
    expect(rows.map((r) => r.kind)).toEqual(['date-header', 'unit', 'unit']);
    const units = rows.filter((r) => r.kind === 'unit');
    // messageIndex 应是全局索引
    expect(units.map((r) => (r.kind === 'unit' ? r.messageIndex : null))).toEqual([0, 1]);
  });

  it('disabled：不产生日期头，仅 unit 行', () => {
    const messages = [
      msg({ id: 'u1', role: 'user' }),
      msg({ id: 'a1', role: 'assistant', askId: 'u1' }),
    ];
    const rows = buildMessageRows(messages, MessageGroupingType.DISABLED);
    expect(rows.every((r) => r.kind === 'unit')).toBe(true);
    expect(rows).toHaveLength(2);
  });

  it('跨天：每天各一个日期头，全局索引连续累加', () => {
    const messages = [
      msg({ id: 'a', role: 'user', createdAt: '2024-01-01T10:00:00.000Z' }),
      msg({ id: 'b', role: 'assistant', createdAt: '2024-01-01T10:01:00.000Z' }),
      msg({ id: 'c', role: 'user', createdAt: '2024-01-02T10:00:00.000Z' }),
    ];
    const rows = buildMessageRows(messages, MessageGroupingType.BY_DATE);
    expect(rows.map((r) => r.kind)).toEqual([
      'date-header', 'unit', 'unit', 'date-header', 'unit',
    ]);
    // 第二天那条的全局索引应为 2
    const lastUnit = rows[rows.length - 1];
    expect(lastUnit.kind === 'unit' && lastUnit.messageIndex).toBe(2);
  });

  it('多模型：user+多条同 askId 助手回复合并为单个 multi 行', () => {
    const messages = [
      msg({ id: 'u1', role: 'user', mentions: [{ id: 'm1' }, { id: 'm2' }] as any }),
      msg({ id: 'a1', role: 'assistant', askId: 'u1' }),
      msg({ id: 'a2', role: 'assistant', askId: 'u1' }),
    ];
    const rows = buildMessageRows(messages, MessageGroupingType.BY_DATE);
    const units = rows.filter((r) => r.kind === 'unit');
    expect(units).toHaveLength(1);
    expect(units[0].key).toBe('multi-u1');
    expect(units[0].kind === 'unit' && units[0].messageIndex).toBe(-1);
    expect(units[0].kind === 'unit' && units[0].showDivider).toBe(false);
  });

  it('分割线：assistant 后跟 user（新轮次）时该 assistant 行 showDivider=true', () => {
    const messages = [
      msg({ id: 'u1', role: 'user' }),
      msg({ id: 'a1', role: 'assistant', askId: 'u1' }),
      msg({ id: 'u2', role: 'user' }),
      msg({ id: 'a2', role: 'assistant', askId: 'u2' }),
    ];
    const rows = buildMessageRows(messages, MessageGroupingType.BY_DATE);
    const a1 = rows.find((r) => r.kind === 'unit' && r.key === 'a1');
    const a2 = rows.find((r) => r.kind === 'unit' && r.key === 'a2');
    expect(a1?.kind === 'unit' && a1.showDivider).toBe(true); // a1 后是 u2
    expect(a2?.kind === 'unit' && a2.showDivider).toBe(false); // a2 是最后一条
  });
});

describe('collectBlockIdsForRows', () => {
  it('收集单条与多模型行内全部 block id', () => {
    const messages = [
      msg({ id: 'u1', role: 'user', mentions: [{ id: 'm1' }, { id: 'm2' }] as any, blocks: ['ub'] }),
      msg({ id: 'a1', role: 'assistant', askId: 'u1', blocks: ['ab1', 'ab2'] }),
      msg({ id: 'a2', role: 'assistant', askId: 'u1', blocks: ['ab3'] }),
    ];
    const rows = buildMessageRows(messages, MessageGroupingType.BY_DATE);
    const ids = collectBlockIdsForRows(rows);
    expect(ids.sort()).toEqual(['ab1', 'ab2', 'ab3', 'ub']);
  });
});
