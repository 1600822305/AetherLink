/**
 * 控制台输出通道：带级别/命名空间前缀。
 */
import { LogLevel, type LogEntry, type Transport } from '../types';
import { LEVEL_LABEL } from '../config';

export class ConsoleTransport implements Transport {
  readonly name = 'console';

  write(entry: LogEntry): void {
    const label = LEVEL_LABEL[entry.level] ?? 'LOG';
    const prefix = entry.context
      ? `[${label}] [${entry.context}]`
      : `[${label}]`;
    this.method(entry.level)(prefix, entry.message, ...entry.args);
  }

  private method(level: LogLevel): (...args: unknown[]) => void {
    switch (level) {
      case LogLevel.ERROR:
        return console.error.bind(console);
      case LogLevel.WARN:
        return console.warn.bind(console);
      case LogLevel.INFO:
        return console.info.bind(console);
      default:
        return (console.debug ?? console.log).bind(console);
    }
  }
}
