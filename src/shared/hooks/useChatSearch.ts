/**
 * 聊天搜索状态钩子:防抖、取消在途请求、错误处理、最近搜索持久化。
 * 搜索逻辑委托给 ChatSearchService(查 Dexie 全量数据)。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChatSearchService } from '../services/search/ChatSearchService';
import type { SearchMode, SearchResultSet } from '../services/search/types';
import { createLogger } from '../services/infra/logger';

const logger = createLogger('ChatSearch');

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 1;
const RECENT_KEY = 'chat-search-recent';
const RECENT_MAX = 8;

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export interface UseChatSearchResult {
  query: string;
  setQuery: (q: string) => void;
  mode: SearchMode;
  setMode: (m: SearchMode) => void;
  results: SearchResultSet | null;
  isSearching: boolean;
  error: boolean;
  recent: string[];
  removeRecent: (q: string) => void;
  clearRecent: () => void;
  reset: () => void;
}

export function useChatSearch(active: boolean): UseChatSearchResult {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<SearchMode>('and');
  const [results, setResults] = useState<SearchResultSet | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState(false);
  const [recent, setRecent] = useState<string[]>(loadRecent);

  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persistRecent = useCallback((next: string[]) => {
    setRecent(next);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      /* localStorage 不可用时忽略 */
    }
  }, []);

  const commitRecent = useCallback((q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setRecent((prev) => {
      const next = [trimmed, ...prev.filter((x) => x !== trimmed)].slice(0, RECENT_MAX);
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const removeRecent = useCallback((q: string) => {
    persistRecent(recent.filter((x) => x !== q));
  }, [persistRecent, recent]);

  const clearRecent = useCallback(() => {
    persistRecent([]);
  }, [persistRecent]);

  const reset = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    abortRef.current?.abort();
    setQuery('');
    setResults(null);
    setIsSearching(false);
    setError(false);
  }, []);

  // 防抖 + 取消地执行搜索(全部状态更新放进异步回调,避免在 effect 体内同步 setState)
  useEffect(() => {
    if (!active) return;
    const trimmed = query.trim();

    if (timerRef.current) clearTimeout(timerRef.current);
    abortRef.current?.abort();

    timerRef.current = setTimeout(() => {
      if (trimmed.length < MIN_QUERY_LENGTH) {
        setResults(null);
        setIsSearching(false);
        setError(false);
        return;
      }

      setIsSearching(true);
      setError(false);

      const controller = new AbortController();
      abortRef.current = controller;
      let committed = false;
      ChatSearchService.search(trimmed, { mode, signal: controller.signal })
        .then((res) => {
          if (controller.signal.aborted) return;
          setResults(res);
          setIsSearching(false);
          committed = true;
        })
        .catch((err) => {
          if (controller.signal.aborted || err?.name === 'AbortError') return;
          logger.error('搜索失败:', err);
          setError(true);
          setResults(null);
          setIsSearching(false);
        })
        .finally(() => {
          if (committed) commitRecent(trimmed);
        });
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, mode, active, commitRecent]);

  // 关闭时清理在途请求
  useEffect(() => {
    if (!active) {
      if (timerRef.current) clearTimeout(timerRef.current);
      abortRef.current?.abort();
    }
  }, [active]);

  return {
    query,
    setQuery,
    mode,
    setMode,
    results,
    isSearching,
    error,
    recent,
    removeRecent,
    clearRecent,
    reset,
  };
}
