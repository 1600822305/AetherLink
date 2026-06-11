/**
 * 维护阶段 S2：向量修复
 * 为嵌入缺失或由其他嵌入模型生成的记忆重算向量，使其重新参与向量搜索与去重。
 * 串行执行并受预算限制，超出部分顺延到下次维护（阶段幂等）
 */

import { dexieStorage } from '../../../storage/DexieStorageService';
import { memoryService } from '../../MemoryService';
import type { Memory } from '../../../../database/config';
import type { MaintenanceProgress, ReembedStageResult } from '../types';

/**
 * 找出需要重算嵌入的活跃记忆（缺失向量或跨模型向量）
 */
export async function findReembedCandidates(assistantId: string): Promise<Memory[]> {
  const currentModelId = memoryService.getConfig().embeddingModel?.id;
  if (!currentModelId) return [];

  const rows = await dexieStorage.memories.where('userId').equals(assistantId).toArray();
  return rows.filter(m => {
    if (m.isDeleted || m.type !== 'memory' || !m.memory) return false;
    if (!m.embedding || m.embedding.length === 0) return true;
    return !!m.embeddingModelId && m.embeddingModelId !== currentModelId;
  });
}

/**
 * 执行向量修复（dryRun 时只统计候选数量）
 */
export async function runReembedStage(
  assistantId: string,
  maxEmbeddingCalls: number,
  dryRun: boolean,
  signal?: AbortSignal,
  onProgress?: (progress: MaintenanceProgress) => void
): Promise<ReembedStageResult> {
  const currentModelId = memoryService.getConfig().embeddingModel?.id;
  const candidates = await findReembedCandidates(assistantId);
  const result: ReembedStageResult = {
    candidateCount: candidates.length,
    reembeddedCount: 0,
    deferredCount: candidates.length,
  };

  if (dryRun || !currentModelId || candidates.length === 0) {
    return result;
  }

  const batch = candidates.slice(0, maxEmbeddingCalls);
  for (let i = 0; i < batch.length; i++) {
    if (signal?.aborted) break;
    const item = batch[i];
    // update() 用当前嵌入模型重算向量；嵌入失败时保留旧向量，不丢数据
    const updated = await memoryService.update(item.id, item.memory!);
    if (updated?.embeddingModelId === currentModelId && updated.embedding) {
      result.reembeddedCount++;
    }
    onProgress?.({ stage: 'reembed', percent: Math.round(((i + 1) / batch.length) * 100) });
  }

  result.deferredCount = candidates.length - result.reembeddedCount;
  return result;
}
