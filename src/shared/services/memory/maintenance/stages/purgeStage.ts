/**
 * 维护阶段 S1：物理清除
 * 软删除超过保留期的记忆从 IndexedDB 物理删除，收敛存储体积与搜索扫描量
 */

import { dexieStorage } from '../../../storage/DexieStorageService';
import { memoryService } from '../../MemoryService';
import type { Memory } from '../../../../database/config';
import type { PurgeStageResult } from '../types';

/**
 * 找出指定隔离键下软删除超过保留期的记忆
 */
export async function findPurgeCandidates(
  assistantId: string,
  retentionDays: number
): Promise<Memory[]> {
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const rows = await dexieStorage.memories.where('userId').equals(assistantId).toArray();
  return rows.filter(m => {
    if (!m.isDeleted) return false;
    const deletedAt = Date.parse(m.updatedAt ?? m.createdAt ?? '');
    return Number.isFinite(deletedAt) && deletedAt < cutoff;
  });
}

/**
 * 执行物理清除（dryRun 时只返回候选列表）
 */
export async function runPurgeStage(
  assistantId: string,
  retentionDays: number,
  dryRun: boolean
): Promise<PurgeStageResult> {
  const candidates = await findPurgeCandidates(assistantId, retentionDays);
  const result: PurgeStageResult = {
    purgedCount: 0,
    candidates: candidates.map(m => ({
      id: m.id,
      memory: m.memory ?? '',
      deletedAt: m.updatedAt ?? m.createdAt ?? '',
    })),
  };

  if (dryRun || candidates.length === 0) {
    return result;
  }

  await dexieStorage.memories.bulkDelete(candidates.map(m => m.id));
  // 绕过 MemoryService 直接写库，需失效其记忆缓存
  memoryService.invalidateMemoryCache(assistantId);
  result.purgedCount = candidates.length;
  return result;
}
