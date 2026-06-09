import { describe, it, expect } from 'vitest';
import {
  detectProviderFromModel,
  getReasoningEffortOptions
} from '../parameterMetadata';

describe('detectProviderFromModel', () => {
  it('detects known providers from model id', () => {
    expect(detectProviderFromModel('claude-3-7-sonnet')).toBe('anthropic');
    expect(detectProviderFromModel('gemini-2.5-pro')).toBe('gemini');
    expect(detectProviderFromModel('gpt-4o')).toBe('openai');
    expect(detectProviderFromModel('deepseek-v4-pro')).toBe('openai-compatible');
  });

  it('falls back to a neutral provider when model id is missing', () => {
    // 回归保护：缺失 modelId 不应崩溃，也不应「假装是 gpt-4 → openai」。
    expect(detectProviderFromModel(undefined)).toBe('openai-compatible');
    expect(detectProviderFromModel('')).toBe('openai-compatible');
  });
});

describe('getReasoningEffortOptions', () => {
  it('exposes 关闭/高/最高 for DeepSeek V4 hybrid models', () => {
    const values = getReasoningEffortOptions('deepseek-v4-pro').map(o => o.value);
    expect(values).toEqual(['none', 'high', 'xhigh']);
  });

  it('does not leak DeepSeek V4 tiers onto unrelated models (root-cause guard)', () => {
    // 此前 modelId 退化为 'gpt-4'，导致下拉永远是通用档位。
    const values = getReasoningEffortOptions('gpt-4').map(o => o.value);
    expect(values).toContain('default');
    expect(values).not.toContain('xhigh');
  });

  it('returns the static default options when no model id is provided', () => {
    const values = getReasoningEffortOptions(undefined).map(o => o.value);
    expect(values).toEqual(['off', 'low', 'medium', 'high']);
  });
});
