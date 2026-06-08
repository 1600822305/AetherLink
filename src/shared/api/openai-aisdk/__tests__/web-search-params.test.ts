import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Phase 4e — 回归测试：openai-aisdk 路径的 web search 私有参数透传
//
// 背景（见 plans/ai-provider-refactor/phase4e-analysis.md 发现 B）：
// OpenAIAISDKProvider.sendChatMessage 曾算出 webSearchParams 却在
// handleStreamResponse 里被丢弃（签名声明、函数体未消费），导致 dashscope
// `enable_search` / openrouter `plugins` / openai `web_search_options` 等私有
// body 字段在 AI SDK 路径完全失效。修复后这些字段应并入 extraBody，由
// stream.ts 落到 providerOptions.openai 透传进请求体。
//
// 这里 mock `./stream` 捕获 streamCompletion / nonStreamCompletion 收到的
// additionalParams.extraBody，断言 web search 私有字段确实被透传。
// ---------------------------------------------------------------------------

const streamCompletionMock = vi.fn();
const nonStreamCompletionMock = vi.fn();

vi.mock('../stream', () => ({
  streamCompletion: (...a: unknown[]) => streamCompletionMock(...a),
  nonStreamCompletion: (...a: unknown[]) => nonStreamCompletionMock(...a),
}));
// provider.ts 经 baseProvider → ai/core/BaseProvider 间接依赖 store / 服务，
// mock 掉避免测试在模块加载期触网/触 IndexedDB。
vi.mock('../../../store', () => ({ default: { getState: () => ({ settings: { providers: [] } }) } }));
vi.mock('../../../services/files/WorkspaceService', () => ({ workspaceService: { getWorkspaces: () => [] } }));
vi.mock('../../../services/infra/LoggerService', () => ({ logApiRequest: vi.fn() }));

import { OpenAIAISDKProvider } from '../provider';
import type { Model } from '../../../types';

/**
 * 用 Object.create 跳过构造器（构造器只建真实 AI SDK 客户端 + 参数管理器，
 * 与本测试无关），手动注入 model 并覆写 sendChatMessage 依赖的协作方法，
 * 只保留待测的 webSearchParams → extraBody 合并逻辑。
 */
function makeProvider(model: Model, stream: boolean) {
  const p = Object.create(OpenAIAISDKProvider.prototype) as any;
  p.model = model;
  p.client = { chat: () => ({}), responses: () => ({}) };
  // 覆写协作方法（均非本次被测逻辑）
  p.setupToolsConfig = () => ({ tools: [] });
  p.prepareAPIMessages = async (m: unknown[]) => m;
  p.getApiParams = () => ({
    unified: { stream },
    apiParams: { temperature: 0.7, max_tokens: 100 },
  });
  p.getUseSystemPromptForTools = () => false;
  return p;
}

function extraBodyFromStream() {
  // streamCompletion(client, modelId, messages, temperature, maxTokens, additionalParams, onChunk)
  const call = streamCompletionMock.mock.calls[0];
  return call?.[5]?.extraBody as Record<string, any> | undefined;
}
function extraBodyFromNonStream() {
  const call = nonStreamCompletionMock.mock.calls[0];
  return call?.[5]?.extraBody as Record<string, any> | undefined;
}

beforeEach(() => {
  streamCompletionMock.mockReset();
  nonStreamCompletionMock.mockReset();
  // 默认无工具调用，sendChatMessage 一轮即返回
  streamCompletionMock.mockResolvedValue({ content: 'ok', hasToolCalls: false });
  nonStreamCompletionMock.mockResolvedValue({ content: 'ok', hasToolCalls: false });
});

const webSearchModel = (provider: string): Model =>
  ({ id: 'gpt-4o', provider, apiKey: 'sk-x', capabilities: { webSearch: true } } as unknown as Model);

describe('OpenAIAISDKProvider — web search 私有参数透传到 extraBody', () => {
  it('openrouter: enableWebSearch 时 plugins 进入 extraBody（流式）', async () => {
    const p = makeProvider(webSearchModel('openrouter'), true);
    await p.sendChatMessage([{ role: 'user', content: 'hi' }], { enableWebSearch: true });

    const extraBody = extraBodyFromStream();
    expect(extraBody).toBeDefined();
    expect(extraBody!.plugins).toEqual([{ id: 'web', search_prompts: ['Search the web for...'] }]);
    // apiParams 仍保留（合并而非覆盖）
    expect(extraBody!.temperature).toBe(0.7);
  });

  it('openai: enableWebSearch 时 web_search_options 进入 extraBody（流式）', async () => {
    const p = makeProvider(webSearchModel('openai'), true);
    await p.sendChatMessage([{ role: 'user', content: 'hi' }], { enableWebSearch: true });

    const extraBody = extraBodyFromStream();
    expect(extraBody!.web_search_options).toEqual({});
  });

  it('非流式路径同样透传 web search 私有参数', async () => {
    const p = makeProvider(webSearchModel('dashscope'), false);
    await p.sendChatMessage([{ role: 'user', content: 'hi' }], { enableWebSearch: true });

    const extraBody = extraBodyFromNonStream();
    expect(extraBody!.enable_search).toBe(true);
    expect(extraBody!.search_options).toEqual({ forced_search: true });
  });

  it('enableWebSearch=false 时不注入任何 web search 字段（extraBody 仅含 apiParams）', async () => {
    const p = makeProvider(webSearchModel('openrouter'), true);
    await p.sendChatMessage([{ role: 'user', content: 'hi' }], { enableWebSearch: false });

    const extraBody = extraBodyFromStream();
    expect(extraBody!.plugins).toBeUndefined();
    expect(extraBody!.web_search_options).toBeUndefined();
    expect(extraBody!.temperature).toBe(0.7);
  });

  it('模型不支持 web search 时即使 enableWebSearch=true 也不注入', async () => {
    const noSearch = { id: 'gpt-4o', provider: 'openrouter', apiKey: 'sk-x', capabilities: {} } as unknown as Model;
    const p = makeProvider(noSearch, true);
    await p.sendChatMessage([{ role: 'user', content: 'hi' }], { enableWebSearch: true });

    const extraBody = extraBodyFromStream();
    expect(extraBody!.plugins).toBeUndefined();
  });
});
