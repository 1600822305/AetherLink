/**
 * 聊天搜索服务(纯逻辑层,不依赖 React)。
 *
 * 关键修复:直接查询 Dexie(messages + message_blocks),覆盖**全部**话题与消息,
 * 而不是只读 Redux 缓存(Redux 只含本次会话打开过的话题,导致历史话题搜不到)。
 *
 * 特性:大小写不敏感、AND/OR、引号短语、相关性打分(先对全量打分再截断)、
 * 安全的高亮区间(返回区间而非 HTML)、可取消(AbortSignal)、分块让出主线程。
 */
import { dexieStorage } from '../storage/DexieStorageService';
import { MessageBlockType } from '../../types/newMessage';
import type { SearchHit, SearchOptions, SearchResultSet } from './types';
import {
  buildSnippet,
  countOccurrences,
  isEmptyQuery,
  isMatch,
  parseQuery,
} from './queryUtils';

const DEFAULT_MAX_RESULTS = 300;
const SNIPPET_LENGTH = 150;
const SCAN_CHUNK = 500; // 每处理这么多块让出一次主线程并检查取消

// 打分权重
const SCORE_TOPIC_BASE = 1000;
const SCORE_MESSAGE_BASE = 500;
const SCORE_PER_OCCURRENCE = 10;
const SCORE_OCCURRENCE_CAP = 100;

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException('搜索已取消', 'AbortError');
  }
}

function toEpoch(value: string | number | undefined): number {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? 0 : t;
}

const yieldToMain = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

export class ChatSearchService {
  /**
   * 执行一次全量搜索。返回按相关性(分数→时间)排序、并截断到 maxResults 的结果。
   */
  static async search(rawQuery: string, options: SearchOptions = {}): Promise<SearchResultSet> {
    const {
      mode = 'and',
      filters,
      maxResults = DEFAULT_MAX_RESULTS,
      signal,
    } = options;

    const startTime = performance.now();
    const parsed = parseQuery(rawQuery);

    if (isEmptyQuery(parsed)) {
      return { hits: [], total: 0, tookMs: 0, truncated: false };
    }

    throwIfAborted(signal);

    // 1. 话题元数据(名称、时间、所属助手)
    const topics = await dexieStorage.topics.toArray();
    throwIfAborted(signal);
    const topicMeta = new Map<string, { name: string; createdAt: number; assistantId?: string }>();
    for (const topic of topics) {
      if (filters?.assistantId && topic.assistantId !== filters.assistantId) continue;
      topicMeta.set(topic.id, {
        name: topic.name || topic.title || '未命名话题',
        createdAt: toEpoch(topic.createdAt),
        assistantId: topic.assistantId,
      });
    }

    const hits: SearchHit[] = [];

    // 2. 话题标题命中
    for (const [topicId, meta] of topicMeta) {
      if (isMatch(meta.name, parsed, mode)) {
        const { snippet, ranges } = buildSnippet(meta.name, parsed, SNIPPET_LENGTH);
        const occ = Math.min(countOccurrences(meta.name, parsed) * SCORE_PER_OCCURRENCE, SCORE_OCCURRENCE_CAP);
        hits.push({
          id: `topic-${topicId}`,
          kind: 'topic',
          topicId,
          topicName: meta.name,
          snippet,
          matchRanges: ranges,
          createdAt: meta.createdAt,
          score: SCORE_TOPIC_BASE + occ,
        });
      }
    }
    throwIfAborted(signal);

    // 3. 消息元数据(角色、时间、所属话题),用于把命中的块还原成消息
    const messages = await dexieStorage.messages.toArray();
    throwIfAborted(signal);
    const messageMeta = new Map<string, { topicId: string; role: SearchHit['role']; createdAt: number }>();
    for (const msg of messages) {
      if (!topicMeta.has(msg.topicId)) continue; // 受助手过滤约束
      if (filters?.role && msg.role !== filters.role) continue;
      messageMeta.set(msg.id, {
        topicId: msg.topicId,
        role: msg.role,
        createdAt: toEpoch(msg.createdAt),
      });
    }

    // 4. 扫描消息正文块(main_text),分块让出主线程并支持取消
    const blocks = await dexieStorage.message_blocks.toArray();
    throwIfAborted(signal);

    const seenMessageIds = new Set<string>();
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      if (block.type === MessageBlockType.MAIN_TEXT) {
        const content = (block as { content?: string }).content;
        const meta = messageMeta.get(block.messageId);
        if (content && meta && !seenMessageIds.has(block.messageId) && isMatch(content, parsed, mode)) {
          seenMessageIds.add(block.messageId);
          const { snippet, ranges } = buildSnippet(content, parsed, SNIPPET_LENGTH);
          const occ = Math.min(countOccurrences(content, parsed) * SCORE_PER_OCCURRENCE, SCORE_OCCURRENCE_CAP);
          hits.push({
            id: `message-${block.messageId}`,
            kind: 'message',
            topicId: meta.topicId,
            topicName: topicMeta.get(meta.topicId)?.name || '未命名话题',
            messageId: block.messageId,
            role: meta.role,
            snippet,
            matchRanges: ranges,
            createdAt: meta.createdAt,
            score: SCORE_MESSAGE_BASE + occ,
          });
        }
      }

      if (i > 0 && i % SCAN_CHUNK === 0) {
        await yieldToMain();
        throwIfAborted(signal);
      }
    }

    // 5. 先对全量打分排序(分数→时间),再截断 —— 避免"截断后才排序"漏掉最相关结果
    hits.sort((a, b) => b.score - a.score || b.createdAt - a.createdAt);

    const total = hits.length;
    const truncated = total > maxResults;
    const limited = truncated ? hits.slice(0, maxResults) : hits;

    return {
      hits: limited,
      total,
      tookMs: performance.now() - startTime,
      truncated,
    };
  }
}
