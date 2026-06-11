/**
 * 维护阶段 S3：近重复聚类
 * 对同一隔离键内全部可比向量两两余弦，相似度 ≥ 阈值的记忆连边，
 * 用并查集求连通分量得到近重复簇（确定性算法，零 API 成本）
 */

import { dexieStorage } from '../../../storage/DexieStorageService';
import { memoryService } from '../../MemoryService';
import type { Memory } from '../../../../database/config';
import { clusterVectors, computeNorm, type ComparableVector } from '../clustering';
import type { ClusterStageResult, DuplicateCluster, MaintenanceProgress } from '../types';

/** 单批参与 O(N²) 比较的最大条数，避免超大记忆库阻塞主线程 */
const MAX_COMPARE_BATCH = 5000;

/**
 * 加载可参与向量比较的活跃记忆（同一嵌入模型、有有效向量）
 */
async function loadComparableMemories(assistantId: string): Promise<ComparableVector<Memory>[]> {
  const currentModelId = memoryService.getConfig().embeddingModel?.id;
  const rows = await dexieStorage.memories.where('userId').equals(assistantId).toArray();
  const comparable: ComparableVector<Memory>[] = [];
  for (const item of rows) {
    if (item.isDeleted || item.type !== 'memory' || !item.memory) continue;
    if (!item.embedding || item.embedding.length === 0) continue;
    if (item.embeddingModelId && item.embeddingModelId !== currentModelId) continue;
    const norm = computeNorm(item.embedding);
    if (norm === 0) continue;
    comparable.push({ payload: item, embedding: item.embedding, norm });
  }
  return comparable;
}

/**
 * 执行近重复聚类阶段
 */
export async function runClusterStage(
  assistantId: string,
  threshold: number,
  signal?: AbortSignal,
  onProgress?: (progress: MaintenanceProgress) => void
): Promise<ClusterStageResult> {
  const comparable = await loadComparableMemories(assistantId);
  // 超大记忆库按创建时间取最近一批，剩余留到后续运行（阶段幂等）
  const batch = comparable
    .sort((a, b) => (b.payload.createdAt ?? '').localeCompare(a.payload.createdAt ?? ''))
    .slice(0, MAX_COMPARE_BATCH);

  const rawClusters = clusterVectors(batch, threshold, signal, percent =>
    onProgress?.({ stage: 'cluster', percent })
  );

  const clusters: DuplicateCluster[] = rawClusters.map(cluster => ({
    maxSimilarity: cluster.maxSimilarity,
    members: cluster.members.map(item => ({
      id: item.id,
      memory: item.memory ?? '',
      createdAt: item.createdAt ?? '',
      source: item.metadata?.source,
    })),
  }));

  return {
    comparedCount: batch.length,
    clusters,
  };
}
