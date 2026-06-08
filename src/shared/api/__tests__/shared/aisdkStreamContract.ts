import { describe, it, expect } from 'vitest';
import { ChunkType, type Chunk } from '../../../types/chunk';

// ---------------------------------------------------------------------------
// 共享的 AI SDK 流式 Chunk 契约用例（openai-aisdk / anthropic-aisdk / gemini-aisdk
// 三家 streamCompletion 结构同构，公共断言抽到这里避免重复）。
// 见 plans/ai-provider-refactor/README.md §2.5。
//
// 调用方（各 provider 的 *.test.ts）负责 vi.mock('ai', ...) 并把以下钩子传入：
//   - setStream(parts): 让被 mock 的 streamText 返回这些 fullStream parts
//   - setGenerate(result): 让被 mock 的 generateText resolve 这个结果
// ---------------------------------------------------------------------------

type StreamFn = (
  client: any,
  modelId: string,
  messages: any[],
  temperature?: number,
  maxTokens?: number,
  additionalParams?: any,
  onChunk?: (chunk: Chunk) => void,
) => Promise<any>;

type NonStreamFn = (client: any, modelId: string, messages: any[]) => Promise<any>;

export interface AisdkContractOptions {
  label: string;
  modelId: string;
  streamCompletion: StreamFn;
  nonStreamCompletion: NonStreamFn;
  setStream: (parts: unknown[]) => void;
  setGenerate: (result: Record<string, unknown>) => void;
}

const typesOf = (chunks: Chunk[]) => chunks.map((c) => c.type);
// 兼容两种使用方式：anthropic/gemini 把 client 当函数调用 client(modelId)；
// openai-aisdk 用 client.chat()/.responses()。故构造一个可调用且带方法的对象。
const fakeClient = Object.assign((_id: string) => ({}), {
  chat: () => ({}),
  responses: () => ({}),
}) as any;

interface MockFn {
  mockReturnValue: (v: unknown) => void;
  mockResolvedValue: (v: unknown) => void;
}

// 由各 provider 测试创建的 streamText/generateText mock 生成统一的测试钩子，
// 避免在每个 *.test.ts 里重复 setStream/setGenerate/runStream 样板。
export function makeAisdkHarness(streamTextMock: MockFn, generateTextMock: MockFn, modelId: string) {
  const setStream = (parts: unknown[]) => {
    async function* gen() {
      for (const p of parts) yield p;
    }
    streamTextMock.mockReturnValue({ fullStream: gen() });
  };
  const setGenerate = (r: Record<string, unknown>) => generateTextMock.mockResolvedValue(r);

  const runStream = async (
    streamCompletion: StreamFn,
    parts: unknown[],
    extra?: Record<string, unknown>,
  ) => {
    setStream(parts);
    const chunks: Chunk[] = [];
    await streamCompletion(
      fakeClient,
      modelId,
      [{ role: 'user', content: 'hi' }],
      undefined,
      undefined,
      extra as any,
      (c) => chunks.push(c),
    );
    return { chunks, types: typesOf(chunks) };
  };

  return { setStream, setGenerate, runStream };
}

export function runAisdkStreamContractSuite(opts: AisdkContractOptions): void {
  const { label, modelId, streamCompletion, nonStreamCompletion, setStream, setGenerate } = opts;

  async function runStream(parts: unknown[], extra?: Record<string, unknown>) {
    setStream(parts);
    const chunks: Chunk[] = [];
    const result = await streamCompletion(
      fakeClient,
      modelId,
      [{ role: 'user', content: 'hi' }],
      undefined,
      undefined,
      extra as any,
      (c) => chunks.push(c),
    );
    return { chunks, result };
  }

  async function runNonStream(genResult: Record<string, unknown>) {
    setGenerate(genResult);
    return nonStreamCompletion(fakeClient, modelId, [{ role: 'user', content: 'hi' }]);
  }

  describe(`${label} streamCompletion — Chunk 契约（共享）`, () => {
    it('text-delta 累积发送，结尾恰好一个 TEXT_COMPLETE 携带完整内容，无 THINKING', async () => {
      const { chunks, result } = await runStream([
        { type: 'text-delta', text: 'Hel' },
        { type: 'text-delta', text: 'lo' },
        { type: 'finish' },
      ]);

      const t = typesOf(chunks);
      expect(t).toContain(ChunkType.TEXT_DELTA);
      expect(t.filter((x) => x === ChunkType.TEXT_COMPLETE)).toHaveLength(1);
      expect(t[t.length - 1]).toBe(ChunkType.TEXT_COMPLETE);
      expect(t).not.toContain(ChunkType.THINKING_DELTA);
      expect(t).not.toContain(ChunkType.THINKING_COMPLETE);

      const textDeltas = chunks.filter((c) => c.type === ChunkType.TEXT_DELTA) as any[];
      expect(textDeltas[textDeltas.length - 1].text).toBe('Hello');
      const complete = chunks.find((c) => c.type === ChunkType.TEXT_COMPLETE) as any;
      expect(complete.text).toBe('Hello');

      expect(result.content).toBe('Hello');
      expect(result.hasToolCalls).toBe(false);
    });

    it('空响应（仅 finish）不产生任何 chunk', async () => {
      const { chunks } = await runStream([{ type: 'finish' }]);
      expect(chunks).toHaveLength(0);
    });

    it('tool-call → MCP_TOOL_CREATED，且检测到工具后【不】发 TEXT_COMPLETE', async () => {
      const { chunks, result } = await runStream([
        { type: 'text-delta', text: 'let me search' },
        { type: 'tool-call', toolCallId: 'call_1', toolName: 'search', input: { q: 'x' } },
        { type: 'finish' },
      ]);

      const t = typesOf(chunks);
      expect(t).toContain(ChunkType.MCP_TOOL_CREATED);
      expect(t).not.toContain(ChunkType.TEXT_COMPLETE);

      const toolChunk = chunks.find((c) => c.type === ChunkType.MCP_TOOL_CREATED) as any;
      expect(toolChunk.responses[0]).toMatchObject({
        id: 'call_1',
        name: 'search',
        arguments: { q: 'x' },
        status: 'pending',
      });
      expect(result.hasToolCalls).toBe(true);
    });
  });

  describe(`${label} nonStreamCompletion — StreamResult 契约（共享）`, () => {
    it('纯文本：content = result.text，无工具', async () => {
      const r = await runNonStream({ text: 'Hello', toolCalls: [] });
      expect(r.content).toBe('Hello');
      expect(r.hasToolCalls).toBe(false);
    });

    it('带工具调用：hasToolCalls=true', async () => {
      const r = await runNonStream({
        text: '',
        toolCalls: [{ toolCallId: 'c1', toolName: 'search', input: { q: 'x' } }],
      });
      expect(r.hasToolCalls).toBe(true);
    });
  });

  return;
}

// 供各 provider 测试复用的工具
export { typesOf, fakeClient };
