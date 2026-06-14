/**
 * 内存环形缓冲通道：供应用内日志查看器（DevTools/ConsolePanel）读取。
 * 阶段6 起在 index.ts 注册进 logger，取代旧 EnhancedConsoleService 的环形缓冲。
 * - 写入时对参数做一次序列化快照，避免持有可变对象引用或循环引用导致渲染异常
 * - 附带稳定 id，便于查看器列表渲染与多选
 * - 支持监听器订阅，查看器打开时实时刷新
 */
import type { LogEntry, StoredLogEntry, Transport } from '../types';
import { serializeArgs } from '../logFormat';

type Listener = (entries: readonly StoredLogEntry[]) => void;

export class MemoryTransport implements Transport {
  readonly name = 'memory';
  private buffer: StoredLogEntry[] = [];
  private readonly capacity: number;
  private listeners: Listener[] = [];
  private seq = 0;

  constructor(capacity = 500) {
    this.capacity = Math.max(1, capacity);
  }

  write(entry: LogEntry): void {
    const stored: StoredLogEntry = {
      ...entry,
      id: `${entry.timestamp.toString(36)}-${(this.seq++).toString(36)}`,
      args: serializeArgs(entry.args),
    };
    this.buffer.push(stored);
    const overflow = this.buffer.length - this.capacity;
    if (overflow > 0) this.buffer.splice(0, overflow);
    this.notify();
  }

  getEntries(): readonly StoredLogEntry[] {
    return this.buffer;
  }

  clear(): void {
    this.buffer = [];
    this.notify();
  }

  /** 订阅缓冲变化，返回取消订阅函数 */
  addListener(listener: Listener): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) this.listeners.splice(index, 1);
    };
  }

  private notify(): void {
    if (this.listeners.length === 0) return;
    const snapshot = [...this.buffer];
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch {
        /* 单个监听器异常不应影响日志写入或其他监听器 */
      }
    }
  }
}
