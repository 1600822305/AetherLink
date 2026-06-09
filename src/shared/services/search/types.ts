/**
 * 聊天搜索类型定义
 * 搜索逻辑与 UI 解耦,这里是两者之间的契约。
 */

export type SearchMode = 'and' | 'or';

export interface SearchFilters {
  /** 仅搜索指定助手下的话题/消息 */
  assistantId?: string;
  /** 仅搜索指定角色的消息(话题标题命中不受此过滤影响) */
  role?: 'user' | 'assistant';
}

/** 解析后的查询:引号短语 + 普通关键词 */
export interface ParsedQuery {
  raw: string;
  keywords: string[];
  phrases: string[];
}

/** 高亮区间(相对于 snippet 字符串) */
export interface MatchRange {
  start: number;
  end: number;
}

export interface SearchHit {
  /** 列表唯一 key */
  id: string;
  kind: 'topic' | 'message';
  topicId: string;
  topicName: string;
  messageId?: string;
  role?: 'user' | 'assistant' | 'system';
  /** 用于展示的片段(话题命中时为话题名) */
  snippet: string;
  /** snippet 内需要高亮的区间,供安全渲染使用(不返回 HTML 字符串) */
  matchRanges: MatchRange[];
  /** epoch 毫秒,用于排序与按日期分组 */
  createdAt: number;
  /** 相关性分数,越大越靠前 */
  score: number;
}

export interface SearchOptions {
  /** 多关键词组合方式,默认 'and' */
  mode?: SearchMode;
  filters?: SearchFilters;
  /** 展示上限(对全量打分排序后截断),默认 300 */
  maxResults?: number;
  /** 可取消在途搜索 */
  signal?: AbortSignal;
}

export interface SearchResultSet {
  hits: SearchHit[];
  /** 截断前命中的总数 */
  total: number;
  /** 耗时(毫秒) */
  tookMs: number;
  /** 是否因 maxResults 被截断 */
  truncated: boolean;
}
