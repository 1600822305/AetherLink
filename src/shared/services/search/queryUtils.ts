/**
 * 查询解析、匹配、片段提取、高亮区间计算 —— 纯函数,便于单测。
 * 全部基于大小写不敏感的子串匹配,对中文(无空格分词)同样适用:
 * 用户输入的整段中文会作为单个关键词做子串匹配。
 */
import type { MatchRange, ParsedQuery, SearchMode } from './types';

/** 解析查询:提取引号内短语,其余按空白切分为关键词 */
export function parseQuery(raw: string): ParsedQuery {
  const phrases: string[] = [];
  const phraseMatches = raw.match(/"([^"]+)"/g);
  if (phraseMatches) {
    for (const m of phraseMatches) {
      const phrase = m.slice(1, -1).trim().toLowerCase();
      if (phrase) phrases.push(phrase);
    }
  }

  const remaining = raw.replace(/"[^"]*"/g, ' ');
  const keywords: string[] = [];
  for (const word of remaining.split(/\s+/)) {
    const w = word.trim().toLowerCase();
    if (w && !phrases.includes(w)) keywords.push(w);
  }

  return { raw, keywords, phrases };
}

/** 查询是否为空(没有任何可用词) */
export function isEmptyQuery(parsed: ParsedQuery): boolean {
  return parsed.keywords.length === 0 && parsed.phrases.length === 0;
}

function allTerms(parsed: ParsedQuery): string[] {
  return [...parsed.phrases, ...parsed.keywords];
}

/** 文本是否命中查询(AND:全部词命中;OR:任意词命中) */
export function isMatch(text: string, parsed: ParsedQuery, mode: SearchMode): boolean {
  if (!text) return false;
  const terms = allTerms(parsed);
  if (terms.length === 0) return false;
  const lower = text.toLowerCase();
  if (mode === 'and') {
    return terms.every((t) => lower.includes(t));
  }
  return terms.some((t) => lower.includes(t));
}

/** 统计文本中所有词的出现次数之和(用于打分) */
export function countOccurrences(text: string, parsed: ParsedQuery): number {
  if (!text) return 0;
  const lower = text.toLowerCase();
  let count = 0;
  for (const term of allTerms(parsed)) {
    if (!term) continue;
    let idx = lower.indexOf(term);
    while (idx !== -1) {
      count += 1;
      idx = lower.indexOf(term, idx + term.length);
    }
  }
  return count;
}

/** 计算 text 中所有词的高亮区间,已按 start 排序并合并重叠区间 */
export function computeMatchRanges(text: string, parsed: ParsedQuery): MatchRange[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  const ranges: MatchRange[] = [];
  for (const term of allTerms(parsed)) {
    if (!term) continue;
    let idx = lower.indexOf(term);
    while (idx !== -1) {
      ranges.push({ start: idx, end: idx + term.length });
      idx = lower.indexOf(term, idx + term.length);
    }
  }
  if (ranges.length === 0) return [];
  ranges.sort((a, b) => a.start - b.start || a.end - b.end);
  // 合并重叠/相邻区间
  const merged: MatchRange[] = [ranges[0]];
  for (let i = 1; i < ranges.length; i++) {
    const last = merged[merged.length - 1];
    const cur = ranges[i];
    if (cur.start <= last.end) {
      last.end = Math.max(last.end, cur.end);
    } else {
      merged.push(cur);
    }
  }
  return merged;
}

/**
 * 以首个命中为中心提取片段,并返回片段内的高亮区间。
 * 不命中时返回开头片段。
 */
export function buildSnippet(
  text: string,
  parsed: ParsedQuery,
  maxLength = 150
): { snippet: string; ranges: MatchRange[] } {
  if (!text) return { snippet: '', ranges: [] };

  if (text.length <= maxLength) {
    return { snippet: text, ranges: computeMatchRanges(text, parsed) };
  }

  const lower = text.toLowerCase();
  let firstIdx = -1;
  let firstTermLen = 0;
  for (const term of allTerms(parsed)) {
    if (!term) continue;
    const idx = lower.indexOf(term);
    if (idx !== -1 && (firstIdx === -1 || idx < firstIdx)) {
      firstIdx = idx;
      firstTermLen = term.length;
    }
  }

  if (firstIdx === -1) {
    const head = text.slice(0, maxLength) + '…';
    return { snippet: head, ranges: [] };
  }

  const center = firstIdx + Math.floor(firstTermLen / 2);
  const half = Math.floor(maxLength / 2);
  let start = Math.max(0, center - half);
  let end = Math.min(text.length, start + maxLength);
  if (end - start < maxLength && start > 0) {
    start = Math.max(0, end - maxLength);
  }

  let snippet = text.slice(start, end);
  if (start > 0) snippet = '…' + snippet;
  if (end < text.length) snippet = snippet + '…';

  return { snippet, ranges: computeMatchRanges(snippet, parsed) };
}
