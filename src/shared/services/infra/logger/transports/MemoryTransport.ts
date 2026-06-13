/**
 * 内存环形缓冲通道：供应用内日志查看器（DevTools/ConsolePanel）读取。
 * 默认不注册（见 index.ts / 设计方案 §3.3 的 B 方案），阶段6 整合时启用。
 */
import type { LogEntry, Transport } from '../types';

export class MemoryTransport implements Transport {
  readonly name = 'memory';
  private buffer: LogEntry[] = [];
  private readonly capacity: number;

  constructor(capacity = 500) {
    this.capacity = Math.max(1, capacity);
  }

  write(entry: LogEntry): void {
    this.buffer.push(entry);
    const overflow = this.buffer.length - this.capacity;
    if (overflow > 0) this.buffer.splice(0, overflow);
  }

  getEntries(): readonly LogEntry[] {
    return this.buffer;
  }

  clear(): void {
    this.buffer = [];
  }
}
