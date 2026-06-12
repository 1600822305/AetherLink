import { describe, it, expect } from 'vitest';
import {
  chunkLines,
  harvestCursorKey,
  selectHarvestCandidates,
  topicLastMessageAt,
} from '../harvest';

const t = (id: string, assistantId: string, lastMessageTime?: string, name?: string) => ({
  id,
  assistantId,
  lastMessageTime,
  name,
});

describe('topicLastMessageAt', () => {
  it('parses lastMessageTime', () => {
    expect(topicLastMessageAt({ id: 'a', lastMessageTime: '2026-06-01T00:00:00.000Z' })).toBe(
      Date.parse('2026-06-01T00:00:00.000Z')
    );
  });

  it('falls back to updatedAt', () => {
    expect(topicLastMessageAt({ id: 'a', updatedAt: '2026-06-02T00:00:00.000Z' })).toBe(
      Date.parse('2026-06-02T00:00:00.000Z')
    );
  });

  it('returns 0 when unparseable or missing', () => {
    expect(topicLastMessageAt({ id: 'a' })).toBe(0);
    expect(topicLastMessageAt({ id: 'a', lastMessageTime: 'not-a-date' })).toBe(0);
  });
});

describe('selectHarvestCandidates', () => {
  it('selects only topics of the assistant with messages newer than cursor', () => {
    const topics = [
      t('t1', 'a1', '2026-06-10T00:00:00.000Z'),
      t('t2', 'a1', '2026-06-01T00:00:00.000Z'),
      t('t3', 'a2', '2026-06-10T00:00:00.000Z'),
    ];
    const cursors = { t2: Date.parse('2026-06-05T00:00:00.000Z') };
    const candidates = selectHarvestCandidates(topics, 'a1', cursors);
    expect(candidates.map(c => c.topicId)).toEqual(['t1']);
  });

  it('sorts candidates by most recent activity first', () => {
    const topics = [
      t('old', 'a1', '2026-06-01T00:00:00.000Z'),
      t('new', 'a1', '2026-06-10T00:00:00.000Z'),
      t('mid', 'a1', '2026-06-05T00:00:00.000Z'),
    ];
    const candidates = selectHarvestCandidates(topics, 'a1', {});
    expect(candidates.map(c => c.topicId)).toEqual(['new', 'mid', 'old']);
  });

  it('includes topics again when new messages arrive after cursor', () => {
    const cursor = Date.parse('2026-06-05T00:00:00.000Z');
    const topics = [t('t1', 'a1', '2026-06-06T00:00:00.000Z')];
    expect(selectHarvestCandidates(topics, 'a1', { t1: cursor })).toHaveLength(1);
    expect(
      selectHarvestCandidates(topics, 'a1', { t1: Date.parse('2026-06-06T00:00:00.000Z') })
    ).toHaveLength(0);
  });

  it('skips topics without parseable time', () => {
    expect(selectHarvestCandidates([t('t1', 'a1')], 'a1', {})).toHaveLength(0);
  });
});

describe('chunkLines', () => {
  it('chunks lines into fixed-size groups', () => {
    const lines = ['a', 'b', 'c', 'd', 'e'];
    expect(chunkLines(lines, 2)).toEqual([['a', 'b'], ['c', 'd'], ['e']]);
  });

  it('returns empty for no lines', () => {
    expect(chunkLines([], 20)).toEqual([]);
  });

  it('returns a single chunk for invalid size', () => {
    expect(chunkLines(['a'], 0)).toEqual([['a']]);
  });
});

describe('harvestCursorKey', () => {
  it('is namespaced per assistant', () => {
    expect(harvestCursorKey('a1')).toBe('memory-harvest-cursors:a1');
    expect(harvestCursorKey('a2')).not.toBe(harvestCursorKey('a1'));
  });
});
