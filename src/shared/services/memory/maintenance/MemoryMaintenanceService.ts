/**
 * 记忆维护服务
 * 参考 MiMo-Code /dream 设计的记忆自维护编排器：
 * 按阶段管线执行（物理清除 → 近重复聚类），各阶段独立容错、幂等，
 * 支持 dryRun 预览、进度回调与取消
 */

import { runPurgeStage } from './stages/purgeStage';
import { runClusterStage } from './stages/clusterStage';
import {
  DEFAULT_CLUSTER_THRESHOLD,
  DEFAULT_RETENTION_DAYS,
  type MemoryMaintenanceOptions,
  type MemoryMaintenanceReport,
} from './types';

class MemoryMaintenanceService {
  private static instance: MemoryMaintenanceService;
  private running = false;

  private constructor() {}

  public static getInstance(): MemoryMaintenanceService {
    if (!MemoryMaintenanceService.instance) {
      MemoryMaintenanceService.instance = new MemoryMaintenanceService();
    }
    return MemoryMaintenanceService.instance;
  }

  public get isRunning(): boolean {
    return this.running;
  }

  /**
   * 执行一次记忆维护，返回完整报告。
   * 同一时间只允许一个维护任务，避免与正在进行的维护互相干扰。
   */
  public async run(options: MemoryMaintenanceOptions): Promise<MemoryMaintenanceReport> {
    if (this.running) {
      throw new Error('记忆维护已在进行中');
    }
    this.running = true;

    const {
      assistantId,
      dryRun = false,
      retentionDays = DEFAULT_RETENTION_DAYS,
      clusterThreshold = DEFAULT_CLUSTER_THRESHOLD,
      signal,
      onProgress,
    } = options;

    const report: MemoryMaintenanceReport = {
      assistantId,
      dryRun,
      startedAt: new Date().toISOString(),
      finishedAt: '',
      purge: { purgedCount: 0, candidates: [] },
      cluster: { comparedCount: 0, clusters: [] },
      errors: [],
      aborted: false,
    };

    try {
      // S1 物理清除
      try {
        onProgress?.({ stage: 'purge', percent: 0 });
        report.purge = await runPurgeStage(assistantId, retentionDays, dryRun);
        onProgress?.({ stage: 'purge', percent: 100 });
      } catch (error) {
        console.error('[MemoryMaintenance] 物理清除阶段失败:', error);
        report.errors.push(`purge: ${error}`);
      }

      if (signal?.aborted) {
        report.aborted = true;
        return report;
      }

      // S3 近重复聚类（报告近重复簇，整合处理由后续 LLM 阶段完成）
      try {
        report.cluster = await runClusterStage(assistantId, clusterThreshold, signal, onProgress);
      } catch (error) {
        console.error('[MemoryMaintenance] 聚类阶段失败:', error);
        report.errors.push(`cluster: ${error}`);
      }

      report.aborted = signal?.aborted ?? false;
      return report;
    } finally {
      report.finishedAt = new Date().toISOString();
      this.running = false;
    }
  }
}

export const memoryMaintenanceService = MemoryMaintenanceService.getInstance();
export default memoryMaintenanceService;
