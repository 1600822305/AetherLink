/**
 * 回顾提取（harvest）纯函数：候选话题选取与消息分块，便于单元测试
 */

/** 话题 harvest 游标：topicId → 已提取到的消息时间戳（毫秒） */
export type HarvestCursors = Record<string, number>;

/** 游标在 metadata 表中的存储键 */
export function harvestCursorKey(assistantId: string): string {
  return `memory-harvest-cursors:${assistantId}`;
}

export interface HarvestTopicLike {
  id: string;
  assistantId?: string;
  lastMessageTime?: string;
  updatedAt?: string;
  name?: string;
}

export interface HarvestCandidate {
  topicId: string;
  topicName: string;
  /** 该话题最后一条消息时间（毫秒），提取完成后游标推进到此值 */
  lastMessageAt: number;
}

/** 解析话题的最后消息时间，无法解析返回 0 */
export function topicLastMessageAt(topic: HarvestTopicLike): number {
  const parsed = Date.parse(topic.lastMessageTime ?? topic.updatedAt ?? '');
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * 选取自上次提取以来有新消息的话题，按最近活跃降序。
 * 返回全部候选；调用方按 maxTopics 截断，截断掉的计为顺延
 */
export function selectHarvestCandidates(
  topics: HarvestTopicLike[],
  assistantId: string,
  cursors: HarvestCursors
): HarvestCandidate[] {
  return topics
    .filter(t => t.assistantId === assistantId)
    .map(t => ({
      topicId: t.id,
      topicName: t.name ?? '',
      lastMessageAt: topicLastMessageAt(t),
    }))
    .filter(c => c.lastMessageAt > (cursors[c.topicId] ?? 0))
    .sort((a, b) => b.lastMessageAt - a.lastMessageAt);
}

/** 将消息文本行按固定大小分块，供分批送入 LLM 提取 */
export function chunkLines(lines: string[], size: number): string[][] {
  if (size <= 0) return lines.length > 0 ? [lines] : [];
  const chunks: string[][] = [];
  for (let i = 0; i < lines.length; i += size) {
    chunks.push(lines.slice(i, i + size));
  }
  return chunks;
}
