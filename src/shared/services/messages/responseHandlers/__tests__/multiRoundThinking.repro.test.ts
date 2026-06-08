import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createResponseChunkProcessor } from '../ResponseChunkProcessor';
import { StreamIncrementTracker } from '../StreamIncrementTracker';
import { ToolUseExtractionProcessor } from '../ToolUseExtractionProcessor';
import { ChunkType } from '../../../../types/chunk';
import { MessageBlockStatus, MessageBlockType } from '../../../../types/newMessage';
import type { Chunk } from '../../../../types/chunk';

// 多轮思考「第一段思考块内容被吞」回归测试。
//
// 端到端地驱动【真实】链路：
//   - 真实 createResponseChunkProcessor + StreamIncrementTracker + ToolUseExtractionProcessor
//   - 忠实复刻 ResponseHandler 的 handleThinkingChunk / handleTextWithToolExtraction
//     （含 #116 的 finalize+reset 调用点）
//   - 流式结束后调用【真实】ResponseCompletionHandler.complete 收尾
//
// 三者共享同一份内存块表（既是 redux store，也是 messageBlockRepository/dexie 落库目标），
// 因此断言真正依赖被测源码：若 updateBlocksInDatabase 仍用末轮/累积 reasoning 覆盖
// 初始块，则「思考1」会被吞空 → 测试失败；修复后保留内容 → 通过。
//
// chunk 序列按 unifiedStreamProcessor 的真实发射规则构造：
//   - THINKING_DELTA.text = 累积全文（无 delta 字段）
//   - 首个正文到达时(isFirstContent)发 THINKING_COMPLETE，text = 累积思考全文
//   - TEXT_DELTA.text = 累积全文

const MESSAGE_ID = 'm1';
const TOPIC_ID = 't1';
const PLACEHOLDER_ID = 'placeholder-1';

// ---- 共享内存态（被 vi.mock 工厂与测试体共同引用）----
const shared = vi.hoisted(() => {
  const storeState: any = {
    messageBlocks: { entities: {} as Record<string, any> },
    messages: { entities: {} as Record<string, any> }
  };
  const order: string[] = [];

  function ensureMessage() {
    if (!storeState.messages.entities[MESSAGE_ID]) {
      storeState.messages.entities[MESSAGE_ID] = { id: MESSAGE_ID, blocks: [] };
    }
  }
  function pushRef(id: string) {
    ensureMessage();
    if (!order.includes(id)) order.push(id);
    storeState.messages.entities[MESSAGE_ID].blocks = [...order];
  }
  function applyBlock(id: string, changes: any) {
    const prev = storeState.messageBlocks.entities[id] ?? { id };
    storeState.messageBlocks.entities[id] = { ...prev, ...changes };
  }
  function addBlock(b: any) {
    pushRef(b.id);
    applyBlock(b.id, b);
  }

  const store = {
    getState: () => storeState,
    dispatch: (action: any) => {
      if (!action || !action.type) return;
      switch (action.type) {
        case 'addOneBlock':
          addBlock(action.payload);
          break;
        case 'updateOneBlock':
          applyBlock(action.payload.id, action.payload.changes);
          break;
        case 'upsertBlockReference':
          pushRef(action.payload.blockId);
          break;
        default:
          break; // message/topic 状态动作忽略
      }
    }
  };

  function reset() {
    storeState.messageBlocks.entities = {};
    storeState.messages.entities = {};
    order.length = 0;
    ensureMessage();
  }

  return { store, storeState, order, applyBlock, addBlock, pushRef, reset };
});

// ---- 模块替身：让真实 ResponseCompletionHandler 读写共享 store ----
vi.mock('../../../../store', () => ({ default: shared.store }));
vi.mock('../../../../store/slices/messageBlocksSlice', () => ({
  updateOneBlock: (payload: any) => ({ type: 'updateOneBlock', payload })
}));
vi.mock('../../../../store/slices/newMessagesSlice', () => ({
  newMessagesActions: {
    updateMessage: (payload: any) => ({ type: 'newMessages/updateMessage', payload }),
    setTopicStreaming: (payload: any) => ({ type: 'newMessages/setTopicStreaming', payload }),
    setTopicLoading: (payload: any) => ({ type: 'newMessages/setTopicLoading', payload })
  }
}));
vi.mock('../../MessageBlockRepository', () => ({
  messageBlockRepository: {
    // 真实实现会同时写 redux + dexie；这里直接落到共享 store（含 redux entities）。
    updateBlock: vi.fn(async (id: string, changes: any) => {
      shared.applyBlock(id, changes);
      return true;
    })
  }
}));
vi.mock('../../../storage/DexieStorageService', () => ({
  dexieStorage: {
    updateMessage: vi.fn(async () => {}),
    updateMessageBlock: vi.fn(async () => {}),
    topics: { get: vi.fn(async () => null) }
  }
}));
vi.mock('../../../infra/EventService', () => ({
  EventEmitter: { emit: vi.fn() },
  EVENT_NAMES: {}
}));
vi.mock('../../../topics/TopicNamingService', () => ({
  TopicNamingService: { shouldNameTopic: () => false, generateTopicName: vi.fn(async () => null) }
}));
vi.mock('../../../../utils/toolExecutionSync', () => ({
  globalToolTracker: { waitForAllToolsComplete: vi.fn(async () => {}), cleanup: vi.fn() }
}));
vi.mock('../blockFinalization', () => ({ finalizeNonTerminalBlocks: vi.fn(async () => {}) }));

// 在 mock 之后再导入被测真实模块
import { ResponseCompletionHandler } from '../ResponseCompletionHandler';

function makeHarness() {
  shared.reset();

  const actions = {
    addOneBlock: (payload: any) => ({ type: 'addOneBlock', payload }),
    updateOneBlock: (payload: any) => ({ type: 'updateOneBlock', payload }),
    upsertBlockReference: (payload: any) => ({ type: 'upsertBlockReference', payload })
  };
  const storage = {
    updateMessageBlock: async () => {},
    saveMessageBlock: async () => {}
  };

  const processor = createResponseChunkProcessor(
    MESSAGE_ID,
    PLACEHOLDER_ID,
    shared.store,
    storage,
    actions,
    0 // 节流间隔 0，但仍走 throttle+RAF 路径
  );

  // 预建占位块（模拟 assistantResponse 的 createPlaceholderBlock）
  shared.addBlock({
    id: PLACEHOLDER_ID,
    messageId: MESSAGE_ID,
    type: MessageBlockType.UNKNOWN ?? 'unknown',
    content: '',
    status: MessageBlockStatus.PROCESSING
  });

  return { processor };
}

function getBlock(id: string): any {
  return shared.storeState.messageBlocks.entities[id];
}
function thinkingBlocks(): any[] {
  return Object.values(shared.storeState.messageBlocks.entities).filter(
    (b: any) => b.type === MessageBlockType.THINKING
  );
}

// ---- 忠实复刻 ResponseHandler 的思考/文本归一逻辑 ----
function makeHandler(processor: any) {
  const textTracker = new StreamIncrementTracker();
  const thinkingTracker = new StreamIncrementTracker();
  let thinkingCumulative = '';
  let accumulatedCleanText = '';
  let hasAnyToolUse = false;
  const toolExtractionProcessor = new ToolUseExtractionProcessor(['tavily_search']);

  async function handleThinkingChunk(chunk: any) {
    const hasDelta = typeof chunk.delta === 'string';
    if (chunk.type === ChunkType.THINKING_COMPLETE && !hasDelta) {
      thinkingCumulative = chunk.text ?? '';
      await processor.handleChunk(chunk);
      thinkingTracker.reset();
      thinkingCumulative = '';
      return;
    }
    const { increment, newRound } = thinkingTracker.next({
      text: chunk.text,
      delta: chunk.delta,
      isFirstChunk: chunk.isFirstChunk
    });
    if (newRound) {
      processor.completeCurrentThinkingBlock();
      processor.resetThinkingBlock();
      thinkingCumulative = '';
    }
    thinkingCumulative += increment;
    const normalized = { ...chunk, text: thinkingCumulative };
    delete normalized.delta;
    await processor.handleChunk(normalized);
    if (chunk.type === ChunkType.THINKING_COMPLETE) {
      thinkingTracker.reset();
      thinkingCumulative = '';
    }
  }

  async function handleTextWithToolExtraction(chunk: any) {
    const text = chunk.text;
    if (!text) return;
    const originalChunkType = chunk.type;
    const { increment: incrementalText, newRound } = textTracker.next({
      text,
      delta: chunk.delta,
      isFirstChunk: chunk.isFirstChunk
    });
    if (newRound) {
      processor.completeCurrentTextBlock();
      processor.completeCurrentThinkingBlock();
      processor.resetThinkingBlock();
      accumulatedCleanText = '';
      hasAnyToolUse = false;
      processor.resetTextBlock();
      toolExtractionProcessor.reset();
    }
    if (!incrementalText) return;
    const results = toolExtractionProcessor.processText(incrementalText);
    for (const result of results) {
      if (result.type === 'text') {
        if (result.content && !hasAnyToolUse) {
          accumulatedCleanText += result.content;
          const textChunk: Chunk = { type: originalChunkType, text: accumulatedCleanText } as Chunk;
          await processor.handleChunk(textChunk);
        }
      } else if (result.type === 'tool_created') {
        if (result.responses && result.responses.length > 0) {
          hasAnyToolUse = true;
          processor.completeCurrentTextBlock();
        }
      }
    }
  }

  async function handleChunk(chunk: any) {
    if (chunk.type === ChunkType.THINKING_DELTA || chunk.type === ChunkType.THINKING_COMPLETE) {
      await handleThinkingChunk(chunk);
    } else if (chunk.type === ChunkType.TEXT_DELTA || chunk.type === ChunkType.TEXT_COMPLETE) {
      await handleTextWithToolExtraction(chunk);
    }
  }

  return { handleChunk };
}

// 模拟 unifiedStreamProcessor 单轮发射：reasoning 累积 → 首正文发 THINKING_COMPLETE → 正文累积
async function emitRound(
  handleChunk: (c: any) => Promise<void>,
  opts: { reasoningPieces?: string[]; textPieces?: string[] }
) {
  const reasoningPieces = opts.reasoningPieces ?? [];
  const textPieces = opts.textPieces ?? [];
  let reasoning = '';
  let content = '';
  let thinkingCompleteSent = false;

  for (const piece of reasoningPieces) {
    reasoning += piece;
    await handleChunk({ type: ChunkType.THINKING_DELTA, text: reasoning });
  }
  for (const piece of textPieces) {
    // isFirstContent：首个正文到达且有 reasoning 时先发 THINKING_COMPLETE
    if (content === '' && reasoning !== '' && !thinkingCompleteSent) {
      thinkingCompleteSent = true;
      await handleChunk({ type: ChunkType.THINKING_COMPLETE, text: reasoning, thinking_millsec: 2100 });
    }
    content += piece;
    await handleChunk({ type: ChunkType.TEXT_DELTA, text: content });
  }
}

async function flush() {
  // 触发 RAF + 微任务
  await new Promise((r) => setTimeout(r, 5));
  await new Promise((r) => setTimeout(r, 5));
}

describe('多轮思考：第一段思考块内容不应被吞', () => {
  beforeEach(() => {
    (globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) =>
      setTimeout(() => cb(Date.now()), 0) as unknown as number;
    (globalThis as any).cancelAnimationFrame = (id: any) => clearTimeout(id);
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('场景A（截图）：round1(思考+正文)→工具，round2(思考+正文)，收尾后思考1 仍保留内容', async () => {
    const { processor } = makeHarness();
    const { handleChunk } = makeHandler(processor);

    // round1: 思考1 + 正文(含工具调用)
    await emitRound(handleChunk, {
      reasoningPieces: ['我需要', '搜索今日新闻'],
      textPieces: [
        '好的，让我在思考中搜索今日新闻！',
        '好的，让我在思考中搜索今日新闻！<tool_use><name>tavily_search</name><arguments>{"q":"news"}</arguments></tool_use>'
      ]
    });
    await flush();

    // round2: 思考2 + 正文（新 processor，但同一 handler/chunkProcessor）
    await emitRound(handleChunk, {
      reasoningPieces: ['这些是', '2026年6月9日的主要新闻'],
      textPieces: ['根据搜索结果，', '根据搜索结果，今天的主要新闻如下…']
    });
    await flush();

    // 流式结束、收尾之前：思考1（= 初始块 placeholder-1）应已有正确内容
    expect(getBlock(PLACEHOLDER_ID).content, '流式结束时思考1应已有内容').not.toBe('');
    expect(getBlock(PLACEHOLDER_ID).type).toBe(MessageBlockType.THINKING);

    // 调用【真实】收尾。prompt/XML 工具模式下供应商结果不带 result.reasoning，
    // 故 finalReasoning 为 undefined（reasoning 在 <think> 标签里随 chunk 发）。
    const handler = new ResponseCompletionHandler(MESSAGE_ID, PLACEHOLDER_ID, TOPIC_ID);
    await handler.complete('根据搜索结果，今天的主要新闻如下…', processor as any, undefined);

    const tBlocks = thinkingBlocks();
    // 关键断言：收尾后第一段思考块不应被吞空、类型不变、计时仍在
    const first = getBlock(PLACEHOLDER_ID);
    expect(tBlocks.length, '应至少有两个思考块').toBeGreaterThanOrEqual(2);
    expect(first.type, '思考1 类型应仍为 THINKING').toBe(MessageBlockType.THINKING);
    expect(first.content, '思考1 内容收尾后不应被吞空').not.toBe('');
    expect(first.thinking_millsec, '思考1 应保留思考时长').toBeGreaterThan(0);
    for (const b of tBlocks) {
      expect(b.content, `思考块 ${b.id} 内容不应为空`).not.toBe('');
    }
  });

  it('场景B：round1(仅思考)→原生工具(无正文)，round2(思考+正文)，收尾后思考1 仍保留内容', async () => {
    const { processor } = makeHarness();
    const { handleChunk } = makeHandler(processor);

    // round1：只有思考，没有正文（原生 function calling，THINKING_COMPLETE 不发）
    await emitRound(handleChunk, {
      reasoningPieces: ['我需要调用搜索工具', '我需要调用搜索工具来获取今日新闻'],
      textPieces: []
    });
    await flush();

    // round2：思考2（更短开头）+ 正文
    await emitRound(handleChunk, {
      reasoningPieces: ['这些', '这些是今天的新闻'],
      textPieces: ['今天的新闻：……']
    });
    await flush();

    const handler = new ResponseCompletionHandler(MESSAGE_ID, PLACEHOLDER_ID, TOPIC_ID);
    await handler.complete('今天的新闻：……', processor as any, undefined);

    const tBlocks = thinkingBlocks();
    const first = getBlock(PLACEHOLDER_ID);
    expect(tBlocks.length).toBeGreaterThanOrEqual(2);
    expect(first.content, '思考1 内容收尾后不应被吞空').not.toBe('');
    for (const b of tBlocks) {
      expect(b.content, `思考块 ${b.id} 内容不应为空`).not.toBe('');
    }
  });
});
