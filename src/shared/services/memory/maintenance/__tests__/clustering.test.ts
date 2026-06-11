import { describe, it, expect } from 'vitest';
import {
  clusterVectors,
  computeNorm,
  dotProduct,
  UnionFind,
  type ComparableVector,
} from '../clustering';

function vec(payload: string, embedding: number[]): ComparableVector<string> {
  return { payload, embedding, norm: computeNorm(embedding) };
}

describe('computeNorm / dotProduct', () => {
  it('computes the Euclidean norm', () => {
    expect(computeNorm([3, 4])).toBe(5);
    expect(computeNorm([0, 0])).toBe(0);
  });

  it('computes the dot product', () => {
    expect(dotProduct([1, 2], [3, 4])).toBe(11);
  });

  it('returns 0 for mismatched dimensions', () => {
    expect(dotProduct([1, 2], [1, 2, 3])).toBe(0);
  });
});

describe('UnionFind', () => {
  it('merges connected components transitively', () => {
    const uf = new UnionFind(4);
    uf.union(0, 1);
    uf.union(1, 2);
    expect(uf.find(0)).toBe(uf.find(2));
    expect(uf.find(0)).not.toBe(uf.find(3));
  });
});

describe('clusterVectors', () => {
  it('returns no clusters for fewer than 2 vectors', () => {
    expect(clusterVectors([vec('a', [1, 0])], 0.9)).toEqual([]);
  });

  it('groups vectors above the similarity threshold', () => {
    const clusters = clusterVectors(
      [vec('a', [1, 0]), vec('b', [1, 0.01]), vec('c', [0, 1])],
      0.9
    );
    expect(clusters).toHaveLength(1);
    expect(clusters[0].members.sort()).toEqual(['a', 'b']);
    expect(clusters[0].maxSimilarity).toBeGreaterThan(0.99);
  });

  it('does not group vectors below the threshold', () => {
    const clusters = clusterVectors([vec('a', [1, 0]), vec('c', [0, 1])], 0.9);
    expect(clusters).toEqual([]);
  });

  it('merges transitive near-duplicates into one cluster', () => {
    // a~b 和 b~c 相似，a~c 通过连通分量归入同簇
    const clusters = clusterVectors(
      [vec('a', [1, 0]), vec('b', [0.98, 0.2]), vec('c', [0.92, 0.39])],
      0.95
    );
    expect(clusters).toHaveLength(1);
    expect(clusters[0].members).toHaveLength(3);
  });

  it('sorts clusters by member count descending', () => {
    const clusters = clusterVectors(
      [
        vec('a1', [1, 0, 0]),
        vec('a2', [1, 0.001, 0]),
        vec('a3', [1, 0, 0.001]),
        vec('b1', [0, 1, 0]),
        vec('b2', [0, 1, 0.001]),
      ],
      0.99
    );
    expect(clusters).toHaveLength(2);
    expect(clusters[0].members).toHaveLength(3);
    expect(clusters[1].members).toHaveLength(2);
  });

  it('stops early when the abort signal is set', () => {
    const controller = new AbortController();
    controller.abort();
    const clusters = clusterVectors(
      [vec('a', [1, 0]), vec('b', [1, 0.01])],
      0.9,
      controller.signal
    );
    expect(clusters).toEqual([]);
  });
});
