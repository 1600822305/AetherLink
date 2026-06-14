/**
 * 日志查看器适配层：把新日志系统 MemoryTransport 的结构化条目，
 * 映射为 DevTools/ConsolePanel 渲染所需的视图模型，并提供过滤/导出/REPL。
 * 取代旧 EnhancedConsoleService 作为查看器数据源（阶段6）。
 */
import { LogLevel } from './types';
import type { LogLevelName, StoredLogEntry } from './types';
import { LEVEL_LABEL } from './config';
import { memoryTransport, createLogger } from './index';
import { formatArg, extractStack } from './logFormat';

export type { LogLevelName };

export interface LogViewerEntry {
  id: string;
  timestamp: number;
  /** 显示标签：ERROR / WARN / INFO / DEBUG / TRACE */
  level: LogLevelName;
  /** 数值级别，便于上色/比较 */
  levelValue: LogLevel;
  context?: string;
  message: string;
  args: unknown[];
  stack?: string;
}

export interface LogViewerFilter {
  /** 选中的级别标签集合 */
  levels: Set<LogLevelName>;
  /** 选中的模块(context)；null 表示全部模块 */
  context: string | null;
  searchText: string;
  showTimestamps: boolean;
}

function toViewerEntry(e: StoredLogEntry): LogViewerEntry {
  return {
    id: e.id,
    timestamp: e.timestamp,
    level: LEVEL_LABEL[e.level] ?? 'INFO',
    levelValue: e.level,
    context: e.context,
    message: e.message,
    args: e.args,
    // 优先用参数里 Error 的堆栈；无 Error 的 error/warn 用写入时自动捕获的调用栈
    stack: extractStack(e.args) ?? e.stack,
  };
}

const replLogger = createLogger('Console');

class LogViewerService {
  getEntries(): LogViewerEntry[] {
    return memoryTransport.getEntries().map(toViewerEntry);
  }

  /** 当前缓冲中出现过的全部模块(context)，已排序 */
  getContexts(): string[] {
    const set = new Set<string>();
    for (const e of memoryTransport.getEntries()) {
      if (e.context) set.add(e.context);
    }
    return [...set].sort();
  }

  getFilteredEntries(filter: LogViewerFilter): LogViewerEntry[] {
    const search = filter.searchText.trim().toLowerCase();
    return this.getEntries().filter((entry) => {
      if (!filter.levels.has(entry.level)) return false;
      if (filter.context && entry.context !== filter.context) return false;
      if (search) {
        const haystack = [
          entry.message,
          entry.context ?? '',
          ...entry.args.map((a) => formatArg(a)),
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });
  }

  /** 订阅缓冲变化（查看器据此刷新）；返回取消订阅函数 */
  addListener(listener: () => void): () => void {
    return memoryTransport.addListener(() => listener());
  }

  clear(): void {
    memoryTransport.clear();
  }

  formatArg(arg: unknown): string {
    return formatArg(arg);
  }

  /** 控制台 REPL：在全局作用域执行表达式，结果经 'Console' 模块记入日志（从而出现在查看器中） */
  executeCommand(command: string): void {
    const trimmed = command.trim();
    if (!trimmed) return;
    // REPL 是用户主动触发的交互输出，必须出现在查看器中，不应被默认级别（生产为 WARN）挡掉：
    // 成功结果用「不低于当前阈值的可见级别」记录，错误用 error（除 SILENT 外恒可见）。
    const visibleLevel = replLogger.isLevelEnabled(LogLevel.INFO)
      ? LogLevel.INFO
      : replLogger.getLevel();
    try {
      const result = window.eval(trimmed);
      replLogger.logAt(visibleLevel, `> ${trimmed}`, result);
    } catch (error) {
      replLogger.error(`> ${trimmed}`, error);
    }
  }
}

export const logViewerService = new LogViewerService();
