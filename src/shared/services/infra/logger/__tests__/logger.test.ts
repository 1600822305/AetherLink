import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logger, type LoggerCore } from '../Logger';
import { LogLevel, type LogEntry, type Transport } from '../types';
import { MemoryTransport } from '../transports/MemoryTransport';
import { defaultRedact } from '../redact';

class CaptureTransport implements Transport {
  readonly name = 'capture';
  level?: LogLevel;
  entries: LogEntry[] = [];
  write(entry: LogEntry): void {
    this.entries.push(entry);
  }
}

function makeLogger(level: LogLevel, transports: Transport[], redact = defaultRedact) {
  const core: LoggerCore = { level, transports, redact, platform: 'web' };
  return new Logger(core);
}

describe('Logger 级别阈值短路', () => {
  it('低于阈值的日志不写入任何 Transport', () => {
    const cap = new CaptureTransport();
    const logger = makeLogger(LogLevel.WARN, [cap]);

    logger.debug('debug');
    logger.info('info');
    logger.warn('warn');
    logger.error('error');

    expect(cap.entries.map((e) => e.level)).toEqual([LogLevel.WARN, LogLevel.ERROR]);
  });

  it('SILENT 关闭所有输出（含 error）', () => {
    const cap = new CaptureTransport();
    const logger = makeLogger(LogLevel.SILENT, [cap]);
    logger.error('boom');
    expect(cap.entries).toHaveLength(0);
  });

  it('setLevel 运行时调整阈值', () => {
    const cap = new CaptureTransport();
    const logger = makeLogger(LogLevel.WARN, [cap]);
    logger.debug('x');
    expect(cap.entries).toHaveLength(0);
    logger.setLevel(LogLevel.DEBUG);
    logger.debug('y');
    expect(cap.entries).toHaveLength(1);
  });
});

describe('惰性求值', () => {
  it('未达阈值时不调用惰性消息函数', () => {
    const cap = new CaptureTransport();
    const logger = makeLogger(LogLevel.WARN, [cap]);
    const fn = vi.fn(() => 'expensive');
    logger.debug(fn);
    expect(fn).not.toHaveBeenCalled();
  });

  it('达到阈值时求值并写入消息', () => {
    const cap = new CaptureTransport();
    const logger = makeLogger(LogLevel.DEBUG, [cap]);
    const fn = vi.fn(() => 'computed');
    logger.debug(fn);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(cap.entries[0].message).toBe('computed');
  });
});

describe('命名空间', () => {
  it('withContext 携带 context 且共享父级配置', () => {
    const cap = new CaptureTransport();
    const logger = makeLogger(LogLevel.DEBUG, [cap]);
    const scoped = logger.withContext('MCP');
    scoped.info('hi');
    expect(cap.entries[0].context).toBe('MCP');

    // 父级 setLevel 影响子实例（共享 core）
    logger.setLevel(LogLevel.ERROR);
    scoped.info('suppressed');
    expect(cap.entries).toHaveLength(1);
  });
});

describe('脱敏 Processor', () => {
  it('打码 args 中的敏感字段，且不修改调用方原对象', () => {
    const cap = new CaptureTransport();
    const logger = makeLogger(LogLevel.DEBUG, [cap]);
    const payload = { apiKey: 'sk-secret', nested: { token: 'abc', keep: 1 } };

    logger.info('req', payload);

    const logged = cap.entries[0].args[0] as Record<string, unknown>;
    expect(logged.apiKey).toBe('***');
    expect((logged.nested as Record<string, unknown>).token).toBe('***');
    expect((logged.nested as Record<string, unknown>).keep).toBe(1);
    // 原对象不被改动
    expect(payload.apiKey).toBe('sk-secret');
  });

  it('处理循环引用不抛异常', () => {
    const cap = new CaptureTransport();
    const logger = makeLogger(LogLevel.DEBUG, [cap]);
    const cyclic: Record<string, unknown> = { a: 1 };
    cyclic.self = cyclic;
    expect(() => logger.info('cyclic', cyclic)).not.toThrow();
  });

  it('保留 Error 实例，不丢失 message/stack（回归：脱敏曾把 Error 重建成 {}）', () => {
    const cap = new CaptureTransport();
    const logger = makeLogger(LogLevel.DEBUG, [cap]);
    const err = new Error('boom');

    logger.error('登录失败', err);

    const logged = cap.entries[0].args[0];
    expect(logged).toBeInstanceOf(Error);
    expect((logged as Error).message).toBe('boom');
    expect((logged as Error).stack).toBeTruthy();
  });

  it('Error 经 MemoryTransport 序列化后仍带堆栈，供查看器展示', () => {
    const mem = new MemoryTransport(10);
    const logger = makeLogger(LogLevel.DEBUG, [mem]);

    logger.error('请求失败', new Error('network down'));

    const stored = mem.getEntries()[0].args[0] as {
      __type?: string;
      message?: string;
      stack?: string;
    };
    expect(stored.__type).toBe('Error');
    expect(stored.message).toBe('network down');
    expect(stored.stack).toBeTruthy();
  });
});

describe('Transport 隔离', () => {
  let errSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    errSpy.mockRestore();
  });

  it('单个 Transport 抛错不影响其他 Transport', () => {
    const bad: Transport = {
      name: 'bad',
      write() {
        throw new Error('fail');
      },
    };
    const cap = new CaptureTransport();
    const logger = makeLogger(LogLevel.DEBUG, [bad, cap]);
    expect(() => logger.info('ok')).not.toThrow();
    expect(cap.entries).toHaveLength(1);
  });

  it('Transport 自身 level 高于消息级别时跳过', () => {
    const cap = new CaptureTransport();
    cap.level = LogLevel.ERROR;
    const logger = makeLogger(LogLevel.DEBUG, [cap]);
    logger.info('skip');
    logger.error('keep');
    expect(cap.entries.map((e) => e.level)).toEqual([LogLevel.ERROR]);
  });
});

describe('MemoryTransport 环形缓冲', () => {
  it('超出容量丢弃最旧条目', () => {
    const mem = new MemoryTransport(3);
    const logger = makeLogger(LogLevel.DEBUG, [mem]);
    for (let i = 0; i < 5; i++) logger.info(`m${i}`);
    const msgs = mem.getEntries().map((e) => e.message);
    expect(msgs).toEqual(['m2', 'm3', 'm4']);
  });

  it('clear 清空缓冲', () => {
    const mem = new MemoryTransport(10);
    const logger = makeLogger(LogLevel.DEBUG, [mem]);
    logger.info('a');
    mem.clear();
    expect(mem.getEntries()).toHaveLength(0);
  });
});

describe('error/warn 自动捕获调用堆栈', () => {
  it('error/warn 未带 Error 时自动附带调用堆栈', () => {
    const mem = new MemoryTransport(10);
    const logger = makeLogger(LogLevel.DEBUG, [mem]);

    logger.error('纯文本错误');
    logger.warn('纯文本警告');

    const [err, warn] = mem.getEntries();
    expect(err.stack).toBeTruthy();
    expect(warn.stack).toBeTruthy();
  });

  it('info/debug 不自动附带堆栈', () => {
    const mem = new MemoryTransport(10);
    const logger = makeLogger(LogLevel.DEBUG, [mem]);

    logger.info('普通信息');
    logger.debug('调试');

    expect(mem.getEntries().every((e) => e.stack === undefined)).toBe(true);
  });

  it('error 已带 Error 时不重复捕获（沿用 Error 自身堆栈）', () => {
    const mem = new MemoryTransport(10);
    const logger = makeLogger(LogLevel.DEBUG, [mem]);

    logger.error('请求失败', new Error('boom'));

    expect(mem.getEntries()[0].stack).toBeUndefined();
  });
});

describe('getRecentLogs 返回拷贝', () => {
  it('返回值不随后续写入变化（不暴露内部缓冲引用）', () => {
    const mem = new MemoryTransport(10);
    const logger = makeLogger(LogLevel.DEBUG, [mem]);

    logger.info('a');
    const snapshot = logger.getRecentLogs();
    expect(snapshot).toHaveLength(1);

    logger.info('b');
    expect(snapshot).toHaveLength(1);
    expect(logger.getRecentLogs()).toHaveLength(2);
  });
});

describe('logApiResponse 级别映射', () => {
  it('状态码 >= 400 记为 ERROR，否则 INFO', () => {
    const cap = new CaptureTransport();
    const logger = makeLogger(LogLevel.DEBUG, [cap]);
    logger.logApiResponse('/a', 200, {});
    logger.logApiResponse('/b', 500, {});
    expect(cap.entries.map((e) => e.level)).toEqual([LogLevel.INFO, LogLevel.ERROR]);
  });
});
