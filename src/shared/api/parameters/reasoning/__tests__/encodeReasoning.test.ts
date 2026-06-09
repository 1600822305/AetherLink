import { describe, it, expect } from 'vitest';
import type { Model } from '../../../../types';
import {
  encodeReasoningParams,
  normalizeReasoningEffort,
  isDisabledEffort,
  mapDeepSeekV4Effort
} from '../encodeReasoning';

const model = (id: string, extra: Partial<Model> = {}): Model =>
  ({ id, name: id, provider: 'test', ...extra } as Model);

const deepseekV4 = model('deepseek-v4-pro');
const deepseekLegacy = model('deepseek-reasoner');
const openaiO3 = model('o3');
const claude = model('claude-3-7-sonnet');
const qwen = model('qwen3-235b');
const grok = model('grok-3-mini');
const nonReasoning = model('gpt-4o');

describe('normalizeReasoningEffort', () => {
  it('maps off/disabled to none and lowercases', () => {
    expect(normalizeReasoningEffort('off')).toBe('none');
    expect(normalizeReasoningEffort('disabled')).toBe('none');
    expect(normalizeReasoningEffort('HIGH')).toBe('high');
    expect(normalizeReasoningEffort(undefined)).toBe('');
    expect(normalizeReasoningEffort(null)).toBe('');
  });
});

describe('isDisabledEffort', () => {
  it('treats off/disabled/none as disabled', () => {
    expect(isDisabledEffort('off')).toBe(true);
    expect(isDisabledEffort('none')).toBe(true);
    expect(isDisabledEffort('disabled')).toBe(true);
    expect(isDisabledEffort('high')).toBe(false);
  });
});

describe('mapDeepSeekV4Effort', () => {
  it('maps low/medium -> high, xhigh -> max, high/max passthrough', () => {
    expect(mapDeepSeekV4Effort('low')).toBe('high');
    expect(mapDeepSeekV4Effort('medium')).toBe('high');
    expect(mapDeepSeekV4Effort('high')).toBe('high');
    expect(mapDeepSeekV4Effort('xhigh')).toBe('max');
    expect(mapDeepSeekV4Effort('max')).toBe('max');
  });
});

describe('encodeReasoningParams - DeepSeek V4 (hybrid)', () => {
  it('enables thinking + maps effort on chat path', () => {
    expect(encodeReasoningParams(deepseekV4, 'high', { api: 'chat' })).toEqual({
      thinking: { type: 'enabled' },
      reasoning_effort: 'high'
    });
    expect(encodeReasoningParams(deepseekV4, 'xhigh', { api: 'chat' })).toEqual({
      thinking: { type: 'enabled' },
      reasoning_effort: 'max'
    });
    // low/medium 服务端映射到 high
    expect(encodeReasoningParams(deepseekV4, 'medium', { api: 'chat' })).toEqual({
      thinking: { type: 'enabled' },
      reasoning_effort: 'high'
    });
  });

  it('disables thinking when off/none on chat path', () => {
    expect(encodeReasoningParams(deepseekV4, 'off', { api: 'chat' })).toEqual({
      thinking: { type: 'disabled' }
    });
    expect(encodeReasoningParams(deepseekV4, 'none', { api: 'chat' })).toEqual({
      thinking: { type: 'disabled' }
    });
  });

  it('produces the same shape on responses path', () => {
    expect(encodeReasoningParams(deepseekV4, 'xhigh', { api: 'responses' })).toEqual({
      thinking: { type: 'enabled' },
      reasoning_effort: 'max'
    });
  });
});

describe('encodeReasoningParams - other reasoning families', () => {
  it('OpenAI: reasoning_effort on chat, reasoning.effort+summary on responses', () => {
    expect(encodeReasoningParams(openaiO3, 'high', { api: 'chat' })).toEqual({
      reasoning_effort: 'high'
    });
    expect(encodeReasoningParams(openaiO3, 'high', { api: 'responses' })).toEqual({
      reasoning: { effort: 'high', summary: 'auto' }
    });
  });

  it('DeepSeek legacy: only low/high (medium -> high)', () => {
    expect(encodeReasoningParams(deepseekLegacy, 'medium', { api: 'chat' })).toEqual({
      reasoning_effort: 'high'
    });
    expect(encodeReasoningParams(deepseekLegacy, 'low', { api: 'chat' })).toEqual({
      reasoning_effort: 'low'
    });
  });

  it('Qwen: enable_thinking + thinking_budget', () => {
    const result = encodeReasoningParams(qwen, 'high', { api: 'chat' });
    expect(result.enable_thinking).toBe(true);
    expect(typeof result.thinking_budget).toBe('number');
  });

  it('Claude: thinking enabled with budget on chat', () => {
    const result = encodeReasoningParams(claude, 'high', { api: 'chat', maxTokens: 8192 });
    expect(result.thinking.type).toBe('enabled');
    expect(result.thinking.budget_tokens).toBeGreaterThanOrEqual(1024);
  });

  it('Grok: passes effort through (no token limit)', () => {
    expect(encodeReasoningParams(grok, 'high', { api: 'chat' })).toEqual({
      reasoning_effort: 'high'
    });
  });
});

describe('encodeReasoningParams - disable / default / third-party', () => {
  it('OpenAI o-series cannot disable -> emits nothing on off', () => {
    expect(encodeReasoningParams(openaiO3, 'off', { api: 'chat' })).toEqual({});
  });

  it('default means no override -> empty', () => {
    expect(encodeReasoningParams(deepseekV4, 'default')).toEqual({});
    expect(encodeReasoningParams(openaiO3, 'default')).toEqual({});
  });

  it('empty effort -> empty', () => {
    expect(encodeReasoningParams(openaiO3, undefined)).toEqual({});
    expect(encodeReasoningParams(openaiO3, '')).toEqual({});
  });

  it('non-reasoning model: passthrough effort, drop when disabled', () => {
    expect(encodeReasoningParams(nonReasoning, 'high', { api: 'chat' })).toEqual({
      reasoning_effort: 'high'
    });
    expect(encodeReasoningParams(nonReasoning, 'off', { api: 'chat' })).toEqual({});
  });
});
