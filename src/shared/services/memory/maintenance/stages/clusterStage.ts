/**
 * 维护阶段 S3：近重复聚类
 * 对同一隔离键内全部可比向量两两余弦，相似度 ≥ 阈值的记忆连边，
 * 用并查集求连通分量得到近重复簇（确定性算法，零 API 成本）
 */

import { dexieStorage } from '../../../storage/DexieStorageService';
import { memoryService } from '../../MemoryService';
import type { Memory } from '../../../../database/config';
import type { ClusterStageResult, DuplicateCluster, MaintenanceProgress } from '../types';

interface ComparableMemory {
  item: Memory;
  embedding: number[];
  norm: number;
}

/** 单批参与 O(N²) 比较的最大条数，避免超大记忆库阻塞主线程 */
const MAX_COMPARE_BATCH = 5000;

function computeNorm(embedding: number[]): number {
  let sum = 0;
  for (let i = 0; i < embedding.length; i++) {
    sum += embedding[i] * embedding[i];
  }
  return Math.sqrt(sum);
}

function dotProduct(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

/** 并查集 */
class UnionFind {
  private parent: number[];

  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, i) => i);
  }

  find(x: number): number {
    while (this.parent[x] !== x) {
      this.parent[x] = this.parent[this.parent[x]];
      x = this.parent[x];
    }
    return x;
  }

  union(a: number, b: number): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) {
      this.parent[rb] = ra;
    }
  }
}

/**
 * 加载可参与向量比较的活跃记忆（同一嵌入模型、有有效向量）
 */
async function loadComparableMemories(assistantId: string): Promise<ComparableMemory[]> {
  const currentModelId = memoryService.getConfig().embeddingModel?.id;
  const rows = await dexieStorage.memories.where('userId').equals(assistantId).toArray();
  const comparable: ComparableMemory[] = [];
  for (const item of rows) {
    if (item.isDeleted || item.type !== 'memory' || !item.memory) continue;
    if (!item.embedding || item.embedding.length === 0) continue;
    if (item.embeddingModelId && item.embeddingModelId !== currentModelId) continue;
    const norm = computeNorm(item.embedding);
    if (norm === 0) continue;
    comparable.push({ item, embedding: item.embedding, norm });
  }
  return comparable;
}

/**
 * 对一批记忆做两两余弦聚类，返回成员数 ≥ 2 的簇
 */
export function clusterMemories(
  memories: ComparableMemory[],
  threshold: number,
  signal?: AbortSignal,
  onProgress?: (percent: number) => void
): DuplicateCluster[] {
  const n = memories.length;
  if (n < 2) return [];

  const uf = new UnionFind(n);
  const edges: Array<{ i: number; similarity: number }> = [];

  for (let i = 0; i < n; i++) {
    if (signal?.aborted) break;
    for (let j = i + 1; j < n; j++) {
      const similarity =
        dotProduct(memories[i].embedding, memories[j].embedding) /
        (memories[i].norm * memories[j].norm);
      if (similarity >= threshold) {
        uf.union(i, j);
        edges.push({ i, similarity });
      }
    }
    onProgress?.(Math.round(((i + 1) / n) * 100));
  }

  const groups = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const root = uf.find(i);
    const group = groups.get(root);
    if (group) {
      group.push(i);
    } else {
      groups.set(root, [i]);
    }
  }

  // 每个簇（根节点）观测到的最高相似度
  const maxSimilarityByRoot = new Map<number, number>();
  for (const edge of edges) {
    const root = uf.find(edge.i);
    const current = maxSimilarityByRoot.get(root) ?? 0;
    if (edge.similarity > current) {
      maxSimilarityByRoot.set(root, edge.similarity);
    }
  }

  const clusters: DuplicateCluster[] = [];
  for (const [root, indices] of groups.entries()) {
    if (indices.length < 2) continue;
    clusters.push({
      maxSimilarity: maxSimilarityByRoot.get(root) ?? 0,
      members: indices.map(idx => ({
        id: memories[idx].item.id,
        memory: memories[idx].item.memory ?? '',
        createdAt: memories[idx].item.createdAt ?? '',
        source: memories[idx].item.metadata?.source,
      })),
    });
  }

  // 大簇在前，便于报告展示
  clusters.sort((a, b) => b.members.length - a.members.length);
  return clusters;
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
    .sort((a, b) => (b.item.createdAt ?? '').localeCompare(a.item.createdAt ?? ''))
    .slice(0, MAX_COMPARE_BATCH);

  const clusters = clusterMemories(batch, threshold, signal, percent =>
    onProgress?.({ stage: 'cluster', percent })
  );

  return {
    comparedCount: batch.length,
    clusters,
  };
}
