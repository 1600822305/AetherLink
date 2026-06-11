export { memoryMaintenanceService } from './MemoryMaintenanceService';
export {
  DEFAULT_RETENTION_DAYS,
  DEFAULT_CLUSTER_THRESHOLD,
  DEFAULT_MAINTENANCE_INTERVAL_DAYS,
  DEFAULT_MAX_EMBEDDING_CALLS,
  DEFAULT_MAX_LLM_CALLS,
} from './types';
export type {
  MemoryMaintenanceOptions,
  MemoryMaintenanceReport,
  MaintenanceProgress,
  MaintenanceStage,
  PurgeStageResult,
  ClusterStageResult,
  ReembedStageResult,
  ConsolidateStageResult,
  DuplicateCluster,
} from './types';
