/**
 * 统一日志系统 — 脱敏处理器（核心步骤，非可选）
 * logApiRequest/Response 等会携带 API Key/token，写出前统一打码。
 */
import type { Redactor } from './types';

const SENSITIVE_KEYS = new Set(
  [
    'apikey',
    'api_key',
    'authorization',
    'token',
    'accesstoken',
    'access_token',
    'refreshtoken',
    'refresh_token',
    'password',
    'secret',
    'cookie',
    'sessiontoken',
    'session_token',
  ].map((k) => k.toLowerCase()),
);

const MASK = '***';

function redactValue(value: unknown, seen: WeakSet<object>): unknown {
  if (value === null || typeof value !== 'object') return value;
  // Error 的 name/message/stack 多为不可枚举属性，按普通对象重建会丢成 {}，
  // 导致控制台与查看器都看不到错误详情/堆栈，故原样保留交由各通道处理。
  if (value instanceof Error) return value;
  if (seen.has(value)) return value;
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, seen));
  }

  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SENSITIVE_KEYS.has(key.toLowerCase())
      ? MASK
      : redactValue(val, seen);
  }
  return out;
}

/** 默认脱敏：只处理 args 中的对象字段，返回新对象，不修改调用方数据 */
export const defaultRedact: Redactor = (entry) => {
  if (entry.args.length === 0) return entry;
  return {
    ...entry,
    args: entry.args.map((arg) => redactValue(arg, new WeakSet<object>())),
  };
};
