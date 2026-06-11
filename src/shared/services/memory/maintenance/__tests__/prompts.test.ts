import { describe, it, expect } from 'vitest';
import { ConsolidationDecisionSchema, buildConsolidationUserPrompt } from '../prompts';

describe('ConsolidationDecisionSchema', () => {
  it('accepts a valid MERGE decision', () => {
    const result = ConsolidationDecisionSchema.safeParse({
      action: 'MERGE',
      keepId: 'id-1',
      mergedText: '用户喜欢咖啡和茶',
      removeIds: ['id-2'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects MERGE with empty mergedText or empty removeIds', () => {
    expect(
      ConsolidationDecisionSchema.safeParse({
        action: 'MERGE',
        keepId: 'id-1',
        mergedText: '',
        removeIds: ['id-2'],
      }).success
    ).toBe(false);
    expect(
      ConsolidationDecisionSchema.safeParse({
        action: 'MERGE',
        keepId: 'id-1',
        mergedText: 'x',
        removeIds: [],
      }).success
    ).toBe(false);
  });

  it('accepts EXPIRE with optional reason and CONFLICT', () => {
    expect(
      ConsolidationDecisionSchema.safeParse({ action: 'EXPIRE', ids: ['id-1'] }).success
    ).toBe(true);
    expect(
      ConsolidationDecisionSchema.safeParse({
        action: 'CONFLICT',
        winnerId: 'id-1',
        loserIds: ['id-2'],
      }).success
    ).toBe(true);
  });

  it('accepts KEEP and rejects unknown actions or missing fields', () => {
    expect(ConsolidationDecisionSchema.safeParse({ action: 'KEEP' }).success).toBe(true);
    expect(ConsolidationDecisionSchema.safeParse({ action: 'DELETE_ALL' }).success).toBe(false);
    expect(
      ConsolidationDecisionSchema.safeParse({ action: 'MERGE', keepId: 'id-1' }).success
    ).toBe(false);
  });
});

describe('buildConsolidationUserPrompt', () => {
  it('includes today, member ids, dates and contents', () => {
    const prompt = buildConsolidationUserPrompt([
      { id: 'id-1', memory: '喜欢咖啡', createdAt: '2026-01-02T10:00:00.000Z' },
      { id: 'id-2', memory: '爱喝咖啡', createdAt: '2026-02-03T10:00:00.000Z' },
    ]);
    expect(prompt).toContain(new Date().toISOString().slice(0, 10));
    expect(prompt).toContain('id-1');
    expect(prompt).toContain('2026-01-02');
    expect(prompt).toContain('喜欢咖啡');
    expect(prompt).toContain('爱喝咖啡');
  });
});
