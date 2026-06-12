/**
 * 维护阶段 S0：回顾提取
 * 回扫自上次维护以来有新消息的话题，复用 MemoryProcessor 批量补提事实，
 * 兜底实时提取的遗漏（自动分析关闭、提取失败、超出实时上下文窗口的消息）。
 * 按话题维护增量游标：仅提取游标之后的新消息，提取成功才推进游标，
 * 超预算/失败的话题游标不动，下次维护自动续传
 */

import { dexieStorage } from '../../../storage/DexieStorageService';
import { memoryService } from '../../MemoryService';
import { MemoryProcessor } from '../../MemoryProcessor';
import { harvestFactExtractionPrompt } from '../prompts';
import {
  chunkLines,
  harvestCursorKey,
  selectHarvestCandidates,
  type HarvestCandidate,
  type HarvestCursors,
} from '../harvest';
import { HARVEST_CHUNK_SIZE, type HarvestStageResult, type MaintenanceProgress } from '../types';
import type { Message } from '../../../../types/newMessage';

async function loadCursors(assistantId: string): Promise<HarvestCursors> {
  const stored = await dexieStorage.getMetadata(harvestCursorKey(assistantId));
  return stored && typeof stored === 'object' ? (stored as HarvestCursors) : {};
}

async function saveCursors(assistantId: string, cursors: HarvestCursors): Promise<void> {
  await dexieStorage.saveMetadata(harvestCursorKey(assistantId), cursors);
}

/**
 * 提取消息文本（不依赖 Redux，维护任务处理的话题通常未加载到内存）：
 * 优先从 message_blocks 表取 main_text 块，回退旧版 content 字段
 */
async function extractMessageText(message: Message): Promise<string> {
  try {
    if (message.blocks && message.blocks.length > 0) {
      const blocks = await dexieStorage.getMessageBlocksByMessageId(message.id);
      const texts = blocks
        .filter(block => block.type === 'main_text' && 'content' in block)
        .map(block => (block as { content: string }).content)
        .filter(content => typeof content === 'string' && content.trim());
      if (texts.length > 0) return texts.join('\n').trim();
    }
  } catch {
    // 块读取失败时回退旧版字段
  }
  const legacy = (message as { content?: unknown }).content;
  return typeof legacy === 'string' ? legacy.trim() : '';
}

/** 加载话题中游标之后的用户/助手消息文本行（"用户: xxx" / "AI: xxx"） */
async function loadPendingLines(topicId: string, cursor: number): Promise<string[]> {
  const messages = await dexieStorage.getTopicMessages(topicId);
  const lines: string[] = [];
  for (const message of messages) {
    if (message.role !== 'user' && message.role !== 'assistant') continue;
    const createdAt = Date.parse(message.createdAt ?? '');
    if (!Number.isFinite(createdAt) || createdAt <= cursor) continue;
    const text = await extractMessageText(message);
    if (!text) continue;
    lines.push(`${message.role === 'user' ? '用户' : 'AI'}: ${text}`);
  }
  return lines;
}

/**
 * 执行回顾提取阶段
 * dryRun 时只统计候选话题与待提取消息数，零 API 成本
 */
export async function runHarvestStage(
  assistantId: string,
  maxTopics: number,
  maxLlmCalls: number,
  dryRun: boolean,
  signal?: AbortSignal,
  onProgress?: (progress: MaintenanceProgress) => void
): Promise<HarvestStageResult> {
  const result: HarvestStageResult = {
    scannedTopics: 0,
    processedTopics: 0,
    deferredTopics: 0,
    llmCallsUsed: 0,
    extractedFacts: [],
    addedCount: 0,
    updatedCount: 0,
    candidates: [],
  };

  const memoryConfig = memoryService.getConfig();
  if (!dryRun && !memoryConfig.llmModel) {
    return result;
  }

  const cursors = await loadCursors(assistantId);
  const allTopics = await dexieStorage.getAllTopics();
  const candidates = selectHarvestCandidates(allTopics, assistantId, cursors);
  result.scannedTopics = candidates.length;
  if (candidates.length === 0) return result;

  const batch = candidates.slice(0, maxTopics);
  result.deferredTopics = candidates.length - batch.length;

  if (dryRun) {
    for (const candidate of batch) {
      const lines = await loadPendingLines(candidate.topicId, cursors[candidate.topicId] ?? 0);
      if (lines.length > 0) {
        result.candidates.push({
          topicId: candidate.topicId,
          topicName: candidate.topicName,
          pendingMessages: lines.length,
        });
      }
    }
    return result;
  }

  let cursorsChanged = false;
  try {
    for (let i = 0; i < batch.length; i++) {
      if (signal?.aborted || result.llmCallsUsed >= maxLlmCalls) {
        result.deferredTopics += batch.length - i;
        break;
      }
      const candidate = batch[i];
      const completed = await harvestTopic(candidate, cursors, maxLlmCalls, assistantId, memoryConfig, result, signal);
      if (completed) {
        cursors[candidate.topicId] = candidate.lastMessageAt;
        cursorsChanged = true;
        result.processedTopics++;
      } else {
        result.deferredTopics++;
      }
      onProgress?.({ stage: 'harvest', percent: Math.round(((i + 1) / batch.length) * 100) });
    }
  } finally {
    if (cursorsChanged) {
      await saveCursors(assistantId, cursors);
    }
  }

  return result;
}

/**
 * 提取单个话题游标后的消息，全部分块处理成功才返回 true（允许推进游标）
 */
async function harvestTopic(
  candidate: HarvestCandidate,
  cursors: HarvestCursors,
  maxLlmCalls: number,
  assistantId: string,
  memoryConfig: ReturnType<typeof memoryService.getConfig>,
  result: HarvestStageResult,
  signal?: AbortSignal
): Promise<boolean> {
  const lines = await loadPendingLines(candidate.topicId, cursors[candidate.topicId] ?? 0);
  if (lines.length === 0) {
    // 没有可提取的文本，直接推进游标避免反复扫描
    return true;
  }

  const processor = new MemoryProcessor({
    memoryConfig: {
      ...memoryConfig,
      customFactExtractionPrompt: harvestFactExtractionPrompt,
    },
    userId: assistantId,
    assistantId,
    topicId: candidate.topicId,
    source: 'dream',
  });

  for (const chunk of chunkLines(lines, HARVEST_CHUNK_SIZE)) {
    if (signal?.aborted || result.llmCallsUsed >= maxLlmCalls) {
      return false;
    }
    const processed = await processor.processConversation(chunk);
    // 事实提取 1 次调用；提取到事实后的更新决策再计 1 次
    result.llmCallsUsed += processed.extractedFacts.length > 0 ? 2 : 1;
    result.extractedFacts.push(...processed.extractedFacts);
    result.addedCount += processed.addedCount;
    result.updatedCount += processed.updatedCount;
    if (processed.errors.length > 0) {
      // 本块写入失败，不推进游标，下次维护重试
      return false;
    }
  }
  return true;
}
