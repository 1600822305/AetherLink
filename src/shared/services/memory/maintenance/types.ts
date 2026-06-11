/**
 * 记忆维护类型定义
 * 参考 MiMo-Code /dream 设计：定期清理、聚类、整合记忆，防止记忆库随使用退化
 */

// ========================================================================
// 选项
// ========================================================================

export interface MemoryMaintenanceOptions {
  /** 隔离键（助手 ID） */
  assistantId: string;
  /** 只产出报告，不写库 */
  dryRun?: boolean;
  /** 软删除保留天数，超过后物理清除（默认 30） */
  retentionDays?: number;
  /** 近重复聚类相似度阈值（默认 0.9，比写入去重更严以避免误报） */
  clusterThreshold?: number;
  /** 取消信号 */
  signal?: AbortSignal;
  /** 进度回调 */
  onProgress?: (progress: MaintenanceProgress) => void;
}

export type MaintenanceStage = 'purge' | 'cluster';

export interface MaintenanceProgress {
  stage: MaintenanceStage;
  /** 0-100 */
  percent: number;
}

// ========================================================================
// 阶段结果
// ========================================================================

export interface PurgeStageResult {
  /** 物理清除的记忆条数 */
  purgedCount: number;
  /** dryRun 时为待清除条数 */
  candidates: Array<{ id: string; memory: string; deletedAt: string }>;
}

/** 近重复记忆簇（成员两两余弦相似度 ≥ 阈值的连通分量） */
export interface DuplicateCluster {
  members: Array<{
    id: string;
    memory: string;
    createdAt: string;
    source?: string;
  }>;
  /** 簇内最高相似度 */
  maxSimilarity: number;
}

export interface ClusterStageResult {
  /** 参与比较的记忆条数（有可比向量的活跃记忆） */
  comparedCount: number;
  clusters: DuplicateCluster[];
}

// ========================================================================
// 报告
// ========================================================================

export interface MemoryMaintenanceReport {
  assistantId: string;
  dryRun: boolean;
  startedAt: string;
  finishedAt: string;
  purge: PurgeStageResult;
  cluster: ClusterStageResult;
  errors: string[];
  aborted: boolean;
}

// ========================================================================
// 默认值
// ========================================================================

/** 软删除保留天数：保留窗口内备份/同步仍可带走软删标记，且用户可手动恢复 */
export const DEFAULT_RETENTION_DAYS = 30;

/** 近重复聚类阈值：高于写入去重（0.85），降低误判 */
export const DEFAULT_CLUSTER_THRESHOLD = 0.9;

/** 自动维护间隔天数 */
export const DEFAULT_MAINTENANCE_INTERVAL_DAYS = 7;
