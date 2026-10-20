import { describe, it, expect } from 'vitest';
import {
  DEFAULT_OPENAI_BASE_URL,
  normalizeOpenAIBaseUrl,
  buildOpenAIModelsEndpoint,
} from '../baseUrl';

describe('normalizeOpenAIBaseUrl', () => {
  it('空值回退到 OpenAI 官方地址', () => {
    expect(normalizeOpenAIBaseUrl()).toBe(DEFAULT_OPENAI_BASE_URL);
    expect(normalizeOpenAIBaseUrl('   ')).toBe(DEFAULT_OPENAI_BASE_URL);
  });

  it('没有版本段时补 /v1', () => {
    expect(normalizeOpenAIBaseUrl('https://api.deepseek.com')).toBe('https://api.deepseek.com/v1');
    expect(normalizeOpenAIBaseUrl('https://api.deepseek.com/')).toBe('https://api.deepseek.com/v1');
  });

  it('已有 /v1 时不再重复追加', () => {
    expect(normalizeOpenAIBaseUrl('https://api.openai.com/v1')).toBe('https://api.openai.com/v1');
    expect(normalizeOpenAIBaseUrl('https://api.openai.com/v1/')).toBe('https://api.openai.com/v1');
    expect(normalizeOpenAIBaseUrl('https://proxy.example.com/v1/openai')).toBe(
      'https://proxy.example.com/v1/openai',
    );
  });

  it('其它版本段（回归：智谱 v4 / 火山 v3 / Gemini v1beta）', () => {
    expect(normalizeOpenAIBaseUrl('https://open.bigmodel.cn/api/paas/v4')).toBe(
      'https://open.bigmodel.cn/api/paas/v4',
    );
    expect(normalizeOpenAIBaseUrl('https://open.bigmodel.cn/api/paas/v4/')).toBe(
      'https://open.bigmodel.cn/api/paas/v4',
    );
    expect(normalizeOpenAIBaseUrl('https://ark.cn-beijing.volces.com/api/v3')).toBe(
      'https://ark.cn-beijing.volces.com/api/v3',
    );
    expect(normalizeOpenAIBaseUrl('https://generativelanguage.googleapis.com/v1beta')).toBe(
      'https://generativelanguage.googleapis.com/v1beta',
    );
  });

  it('appendVersion: false 时只去掉末尾斜杠', () => {
    expect(normalizeOpenAIBaseUrl('https://proxy.example.com/custom/', { appendVersion: false })).toBe(
      'https://proxy.example.com/custom',
    );
    expect(normalizeOpenAIBaseUrl('https://proxy.example.com', { appendVersion: false })).toBe(
      'https://proxy.example.com',
    );
  });
});

describe('buildOpenAIModelsEndpoint', () => {
  it('版本段保持并追加 /models', () => {
    expect(buildOpenAIModelsEndpoint('https://api.openai.com/v1')).toBe(
      'https://api.openai.com/v1/models',
    );
    expect(buildOpenAIModelsEndpoint('https://open.bigmodel.cn/api/paas/v4')).toBe(
      'https://open.bigmodel.cn/api/paas/v4/models',
    );
  });

  it('普通主机名补 /v1 后追加 /models', () => {
    expect(buildOpenAIModelsEndpoint('https://api.deepseek.com')).toBe(
      'https://api.deepseek.com/v1/models',
    );
  });
});
