/**
 * 记忆整合提示词
 * 对一组近重复记忆做 LLM 整合决策：合并 / 过期 / 冲突解决 / 保持不变
 */

import { z } from 'zod';

// ========================================================================
// 决策 Schema
// ========================================================================

export const ConsolidationDecisionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('MERGE'),
    /** 保留并改写为合并文本的记忆 ID */
    keepId: z.string(),
    /** 合并后的完整记忆文本 */
    mergedText: z.string().min(1),
    /** 被合并（软删除）的记忆 ID */
    removeIds: z.array(z.string()).min(1),
  }),
  z.object({
    action: z.literal('EXPIRE'),
    /** 已过时、应标记过期的记忆 ID */
    ids: z.array(z.string()).min(1),
    reason: z.string().optional(),
  }),
  z.object({
    action: z.literal('CONFLICT'),
    /** 互相矛盾时保留的记忆 ID（通常为最新） */
    winnerId: z.string(),
    /** 被淘汰的记忆 ID */
    loserIds: z.array(z.string()).min(1),
  }),
  z.object({
    action: z.literal('KEEP'),
  }),
]);

export type ConsolidationDecision = z.infer<typeof ConsolidationDecisionSchema>;

// ========================================================================
// 提示词
// ========================================================================

export const consolidationSystemPrompt = `你是一个记忆库整理专家。用户会给你一组高度相似的"关于用户的记忆"，每条带有 ID 和创建时间。你需要判断这组记忆应如何整理，并只输出一个 JSON 对象（不要输出任何其他内容）。

可选的四种决策：

1. 合并：这些记忆表达相同或互补的信息，应合并为一条更完整的记忆。
   {"action": "MERGE", "keepId": "<保留的ID>", "mergedText": "<合并后的完整记忆文本>", "removeIds": ["<被合并的ID>", ...]}
   - mergedText 必须保留所有不重复的信息，不得丢失细节
   - keepId 通常选最新的一条

2. 过期：记忆带有明确时效且已过去（如"计划下周去东京"而创建时间远早于现在）。
   {"action": "EXPIRE", "ids": ["<过期的ID>", ...], "reason": "<简短原因>"}

3. 冲突：记忆互相矛盾（如"喜欢咖啡"与"不喝咖啡"），应保留更新的一条。
   {"action": "CONFLICT", "winnerId": "<保留的ID>", "loserIds": ["<淘汰的ID>", ...]}

4. 保持：信息各自独立有价值，或你无法确定如何处理。
   {"action": "KEEP"}

规则：
- 今天的日期会在输入中给出，判断时效以此为准
- 不确定时一律输出 {"action": "KEEP"}，宁可保留也不要误删信息
- 只输出 JSON，不要解释`;

/**
 * 构建单个近重复簇的整合用户提示词
 */
export function buildConsolidationUserPrompt(
  members: Array<{ id: string; memory: string; createdAt: string }>
): string {
  const today = new Date().toISOString().slice(0, 10);
  const list = members
    .map(m => `- id: ${m.id}\n  创建时间: ${m.createdAt.slice(0, 10) || '未知'}\n  内容: ${m.memory}`)
    .join('\n');
  return `今天的日期：${today}\n\n以下是一组高度相似的记忆，请给出整理决策：\n\n${list}`;
}
