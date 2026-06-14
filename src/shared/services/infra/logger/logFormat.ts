/**
 * 日志参数序列化与格式化：供 MemoryTransport 写入快照、应用内查看器(ConsolePanel)渲染共用。
 * 序列化在写入时做一次快照，避免后续对象被改动或循环引用导致渲染异常。
 * 逻辑自旧 EnhancedConsoleService.serializeArgs/formatArg 迁移而来（阶段6）。
 */

interface SerializedError {
  __type: 'Error';
  name: string;
  message: string;
  stack?: string;
}

interface SerializedElement {
  __type: 'Element';
  tagName: string;
  id: string;
  className: string;
  outerHTML: string;
}

/** 写入时把单个参数转为可安全存储/序列化的快照 */
export function serializeArg(arg: unknown): unknown {
  if (arg === null || arg === undefined) return arg;
  const type = typeof arg;
  if (type === 'string' || type === 'number' || type === 'boolean') return arg;

  if (arg instanceof Error) {
    return {
      __type: 'Error',
      name: arg.name,
      message: arg.message,
      stack: arg.stack,
    } satisfies SerializedError;
  }

  if (typeof Element !== 'undefined' && arg instanceof Element) {
    const outer = arg.outerHTML;
    return {
      __type: 'Element',
      tagName: arg.tagName,
      id: arg.id,
      className: arg.className,
      outerHTML: outer.substring(0, 200) + (outer.length > 200 ? '...' : ''),
    } satisfies SerializedElement;
  }

  try {
    return JSON.parse(JSON.stringify(arg));
  } catch {
    return String(arg);
  }
}

export function serializeArgs(args: readonly unknown[]): unknown[] {
  return args.map(serializeArg);
}

function isSerializedError(arg: unknown): arg is SerializedError {
  return (
    typeof arg === 'object' &&
    arg !== null &&
    (arg as { __type?: unknown }).__type === 'Error'
  );
}

function isSerializedElement(arg: unknown): arg is SerializedElement {
  return (
    typeof arg === 'object' &&
    arg !== null &&
    (arg as { __type?: unknown }).__type === 'Element'
  );
}

/** 渲染时把序列化后的参数转为可读文本 */
export function formatArg(arg: unknown): string {
  if (arg === null) return 'null';
  if (arg === undefined) return 'undefined';
  if (typeof arg === 'string') return arg;
  if (typeof arg === 'number' || typeof arg === 'boolean') return String(arg);
  if (isSerializedError(arg)) return `${arg.name}: ${arg.message}`;
  if (isSerializedElement(arg)) {
    return `<${arg.tagName.toLowerCase()}${arg.id ? ` id="${arg.id}"` : ''}${
      arg.className ? ` class="${arg.className}"` : ''
    }>`;
  }
  try {
    return JSON.stringify(arg, null, 2);
  } catch {
    return String(arg);
  }
}

/** 从已序列化参数中提取首个错误堆栈，供查看器展示 */
export function extractStack(args: readonly unknown[]): string | undefined {
  for (const arg of args) {
    if (isSerializedError(arg) && arg.stack) return arg.stack;
  }
  return undefined;
}

// 日志系统自身的调用帧，捕获堆栈时从顶部剥离，只保留业务调用栈
const INTERNAL_STACK_FRAME =
  /\b(captureStack|MemoryTransport|Logger\.(emit|error|warn|info|debug|trace|logAt|logApiRequest|logApiResponse))\b/;

/**
 * 捕获当前调用栈，剥掉日志系统自身的帧，供 error/warn 在未携带 Error 时自动附带堆栈
 * （对齐旧 EnhancedConsoleService 行为，便于在查看器中定位来源）。
 * 生产构建函数名被混淆、无法精确剥离时，原样保留（去掉首行 Error 头）。
 */
export function captureStack(): string | undefined {
  const raw = new Error().stack;
  if (!raw) return undefined;
  // 首行通常是 "Error" 头，丢弃
  const frames = raw.split('\n').slice(1);
  let start = 0;
  while (start < frames.length && INTERNAL_STACK_FRAME.test(frames[start])) start++;
  const trimmed = frames.slice(start);
  return (trimmed.length ? trimmed : frames).join('\n');
}
