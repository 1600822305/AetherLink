/**
 * 记忆维护自动调度器
 * 应用启动后延迟到空闲时检查是否到期（默认 7 天间隔），到期则后台执行一次维护。
 * Capacitor 无后台进程，因此采用「启动空闲触发 + 周期性复查」策略
 */

import { memoryMaintenanceService } from './MemoryMaintenanceService';
import { isMaintenanceDue } from './schedule';
import { createLogger } from '../../infra/logger';
import {
  DEFAULT_MAINTENANCE_INTERVAL_DAYS,
  type MemoryMaintenanceReport,
} from './types';

const logger = createLogger('MemoryMaintenance');

/** 启动后延迟，避开应用初始化高峰 */
const STARTUP_DELAY_MS = 60 * 1000;

/** 长驻应用的周期性复查间隔 */
const RECHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

export interface SchedulerContext {
  /** 自动维护是否开启 */
  enabled: boolean;
  assistantId: string;
  lastMaintenanceAt?: string;
  intervalDays?: number;
  retentionDays?: number;
  /** 是否执行回顾提取阶段（默认开启） */
  harvestEnabled?: boolean;
}

export interface SchedulerDeps {
  /** 读取当前调度上下文（返回 null 表示记忆功能不可用，跳过本轮） */
  getContext: () => SchedulerContext | null;
  /** 维护完成回调（用于持久化 lastMaintenanceAt 等） */
  onCompleted: (report: MemoryMaintenanceReport) => void;
}

async function checkAndRun(deps: SchedulerDeps): Promise<void> {
  const context = deps.getContext();
  if (!context || !context.enabled || !context.assistantId) return;
  if (memoryMaintenanceService.isRunning) return;

  const intervalDays = context.intervalDays ?? DEFAULT_MAINTENANCE_INTERVAL_DAYS;
  if (!isMaintenanceDue(context.lastMaintenanceAt, intervalDays)) return;

  try {
    logger.debug('自动维护到期，开始执行');
    const report = await memoryMaintenanceService.run({
      assistantId: context.assistantId,
      retentionDays: context.retentionDays,
      harvestEnabled: context.harvestEnabled,
    });
    deps.onCompleted(report);
  } catch (error) {
    logger.error('自动维护执行失败:', error);
  }
}

/** 在浏览器空闲时执行，不支持 requestIdleCallback 时退化为直接执行 */
function runWhenIdle(task: () => void): void {
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(() => task(), { timeout: 30_000 });
  } else {
    task();
  }
}

/**
 * 启动自动维护调度器，返回停止函数
 */
export function startMaintenanceScheduler(deps: SchedulerDeps): () => void {
  const startupTimer = setTimeout(() => {
    runWhenIdle(() => void checkAndRun(deps));
  }, STARTUP_DELAY_MS);

  const recheckTimer = setInterval(() => {
    runWhenIdle(() => void checkAndRun(deps));
  }, RECHECK_INTERVAL_MS);

  return () => {
    clearTimeout(startupTimer);
    clearInterval(recheckTimer);
  };
}
