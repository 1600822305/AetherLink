export { memoryMaintenanceService } from './MemoryMaintenanceService';
export {
  DEFAULT_RETENTION_DAYS,
  DEFAULT_CLUSTER_THRESHOLD,
  DEFAULT_MAINTENANCE_INTERVAL_DAYS,
} from './types';
export type {
  MemoryMaintenanceOptions,
  MemoryMaintenanceReport,
  MaintenanceProgress,
  MaintenanceStage,
  PurgeStageResult,
  ClusterStageResult,
  DuplicateCluster,
} from './types';
