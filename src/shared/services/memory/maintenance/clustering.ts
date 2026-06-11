/**
 * 近重复聚类的纯函数实现（无外部依赖，便于单元测试）
 * 两两余弦相似度 ≥ 阈值连边，并查集求连通分量
 */

export interface ComparableVector<T> {
  payload: T;
  embedding: number[];
  norm: number;
}

export interface VectorCluster<T> {
  members: T[];
  /** 簇内观测到的最高相似度 */
  maxSimilarity: number;
}

export function computeNorm(embedding: number[]): number {
  let sum = 0;
  for (let i = 0; i < embedding.length; i++) {
    sum += embedding[i] * embedding[i];
  }
  return Math.sqrt(sum);
}

export function dotProduct(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

/** 并查集 */
export class UnionFind {
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
 * 对一批向量做两两余弦聚类，返回成员数 ≥ 2 的簇（大簇在前）
 */
export function clusterVectors<T>(
  vectors: ComparableVector<T>[],
  threshold: number,
  signal?: AbortSignal,
  onProgress?: (percent: number) => void
): VectorCluster<T>[] {
  const n = vectors.length;
  if (n < 2) return [];

  const uf = new UnionFind(n);
  const edges: Array<{ i: number; similarity: number }> = [];

  for (let i = 0; i < n; i++) {
    if (signal?.aborted) break;
    for (let j = i + 1; j < n; j++) {
      const similarity =
        dotProduct(vectors[i].embedding, vectors[j].embedding) /
        (vectors[i].norm * vectors[j].norm);
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

  const clusters: VectorCluster<T>[] = [];
  for (const [root, indices] of groups.entries()) {
    if (indices.length < 2) continue;
    clusters.push({
      maxSimilarity: maxSimilarityByRoot.get(root) ?? 0,
      members: indices.map(idx => vectors[idx].payload),
    });
  }

  clusters.sort((a, b) => b.members.length - a.members.length);
  return clusters;
}
