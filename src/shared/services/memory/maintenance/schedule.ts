/**
 * 自动维护到期判断（纯函数，便于单元测试）
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 判断是否到达维护时间
 * 从未维护过或时间无法解析（lastMaintenanceAt 为空/非法）视为到期
 */
export function isMaintenanceDue(
  lastMaintenanceAt: string | undefined,
  intervalDays: number,
  now: number = Date.now()
): boolean {
  if (!lastMaintenanceAt) return true;
  const last = Date.parse(lastMaintenanceAt);
  if (!Number.isFinite(last)) return true;
  return now - last >= intervalDays * DAY_MS;
}
