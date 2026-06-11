/**
 * 维护阶段 S4：LLM 整合
 * 对近重复簇逐簇调用 LLM 决策（合并/过期/冲突/保持），先算后写：
 * 合并先写保留项成功后才软删除来源项；任何解析/校验失败一律保持不变（KEEP），绝不误删。
 * 所有删除均为软删除并写入审计元数据（mergedInto/expiredAt 等），保留期内可恢复
 */

import { dexieStorage } from '../../../storage/DexieStorageService';
import { memoryService } from '../../MemoryService';
import { universalFetch } from '../../../../utils/universalFetch';
import { parseJsonSafe } from '../../prompts';
import type { Model } from '../../../../types';
import {
  ConsolidationDecisionSchema,
  buildConsolidationUserPrompt,
  consolidationSystemPrompt,
  type ConsolidationDecision,
} from '../prompts';
import type {
  ConsolidateStageResult,
  DuplicateCluster,
  MaintenanceProgress,
} from '../types';

/**
 * 调用 LLM 获取单个簇的整合决策（解析或校验失败返回 null → 调用方按 KEEP 处理）
 */
async function requestDecision(
  model: Model,
  cluster: DuplicateCluster
): Promise<ConsolidationDecision | null> {
  try {
    const baseUrl = model.baseUrl || 'https://api.openai.com/v1';
    const response = await universalFetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${model.apiKey}`,
      },
      body: JSON.stringify({
        model: model.id,
        messages: [
          { role: 'system', content: consolidationSystemPrompt },
          { role: 'user', content: buildConsolidationUserPrompt(cluster.members) },
        ],
        temperature: 0.1,
        max_tokens: 1024,
      }),
    });
    if (!response.ok) {
      throw new Error(`LLM API error: ${response.status}`);
    }
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = parseJsonSafe<unknown>(content);
    if (!parsed) return null;
    const validated = ConsolidationDecisionSchema.safeParse(parsed);
    return validated.success ? validated.data : null;
  } catch (error) {
    console.error('[MemoryMaintenance] 整合决策调用失败:', error);
    return null;
  }
}

/**
 * 带审计元数据的软删除（绕过 MemoryService 直接写库，调用方负责失效缓存）
 */
async function softDeleteWithAudit(
  id: string,
  audit: Record<string, string>
): Promise<boolean> {
  const existing = await dexieStorage.memories.get(id);
  if (!existing) return false;
  await dexieStorage.memories.update(id, {
    isDeleted: true,
    updatedAt: new Date().toISOString(),
    metadata: { ...existing.metadata, ...audit },
  });
  return true;
}

/** 决策中的 ID 必须全部来自簇成员，防止 LLM 幻觉误删无关记忆 */
function idsBelongToCluster(cluster: DuplicateCluster, ids: string[]): boolean {
  const memberIds = new Set(cluster.members.map(m => m.id));
  return ids.every(id => memberIds.has(id));
}

/** 手动添加的记忆默认不允许被维护任务删除 */
function containsManualMemory(cluster: DuplicateCluster, ids: string[]): boolean {
  return cluster.members.some(m => ids.includes(m.id) && m.source === 'manual');
}

/**
 * 应用单个簇的整合决策，返回是否实际产生了变更
 */
async function applyDecision(
  cluster: DuplicateCluster,
  decision: ConsolidationDecision,
  result: ConsolidateStageResult
): Promise<boolean> {
  const now = new Date().toISOString();

  switch (decision.action) {
    case 'MERGE': {
      const ids = [decision.keepId, ...decision.removeIds];
      if (
        !idsBelongToCluster(cluster, ids) ||
        decision.removeIds.includes(decision.keepId) ||
        containsManualMemory(cluster, decision.removeIds)
      ) {
        return false;
      }
      // 先写合并文本，成功后才软删除来源项，失败则整簇保持不变
      const updated = await memoryService.update(decision.keepId, decision.mergedText, {
        maintainedAt: now,
        mergedFrom: decision.removeIds,
      });
      if (!updated) return false;
      for (const removeId of decision.removeIds) {
        await softDeleteWithAudit(removeId, { mergedInto: decision.keepId, maintainedAt: now });
      }
      result.merged.push({
        keptId: decision.keepId,
        mergedText: decision.mergedText,
        removedIds: decision.removeIds,
      });
      return true;
    }

    case 'EXPIRE': {
      if (!idsBelongToCluster(cluster, decision.ids) || containsManualMemory(cluster, decision.ids)) {
        return false;
      }
      for (const id of decision.ids) {
        const deleted = await softDeleteWithAudit(id, {
          expiredAt: now,
          expireReason: decision.reason ?? '',
          maintainedAt: now,
        });
        if (deleted) {
          const member = cluster.members.find(m => m.id === id);
          result.expired.push({ id, memory: member?.memory ?? '', reason: decision.reason });
        }
      }
      return true;
    }

    case 'CONFLICT': {
      const ids = [decision.winnerId, ...decision.loserIds];
      if (
        !idsBelongToCluster(cluster, ids) ||
        decision.loserIds.includes(decision.winnerId) ||
        containsManualMemory(cluster, decision.loserIds)
      ) {
        return false;
      }
      for (const loserId of decision.loserIds) {
        await softDeleteWithAudit(loserId, {
          conflictWinner: decision.winnerId,
          maintainedAt: now,
        });
      }
      result.conflicts.push({ winnerId: decision.winnerId, loserIds: decision.loserIds });
      return true;
    }

    case 'KEEP':
      return false;
  }
}

/**
 * 执行 LLM 整合阶段
 * 簇已按成员数降序，优先整合收益最大的簇；超出 LLM 预算的簇顺延到下次维护
 */
export async function runConsolidateStage(
  assistantId: string,
  clusters: DuplicateCluster[],
  maxLlmCalls: number,
  signal?: AbortSignal,
  onProgress?: (progress: MaintenanceProgress) => void
): Promise<ConsolidateStageResult> {
  const result: ConsolidateStageResult = {
    llmCallsUsed: 0,
    merged: [],
    expired: [],
    conflicts: [],
    skippedClusters: 0,
  };

  const llmModel = memoryService.getConfig().llmModel;
  if (!llmModel || clusters.length === 0) {
    result.skippedClusters = clusters.length;
    return result;
  }

  let changed = false;
  const batch = clusters.slice(0, maxLlmCalls);
  result.skippedClusters = clusters.length - batch.length;

  try {
    for (let i = 0; i < batch.length; i++) {
      if (signal?.aborted) {
        result.skippedClusters += batch.length - i;
        break;
      }
      const cluster = batch[i];
      result.llmCallsUsed++;
      const decision = await requestDecision(llmModel, cluster);
      if (!decision || !(await applyDecision(cluster, decision, result))) {
        result.skippedClusters++;
      } else {
        changed = true;
      }
      onProgress?.({ stage: 'consolidate', percent: Math.round(((i + 1) / batch.length) * 100) });
    }
  } finally {
    if (changed) {
      // softDeleteWithAudit 绕过了 MemoryService，统一失效一次缓存
      memoryService.invalidateMemoryCache(assistantId);
    }
  }

  return result;
}
