/**
 * 记忆处理器
 * 负责从对话中提取事实并更新记忆
 * 
 * @description 基于 Cherry Studio 设计，使用 LLM 进行事实提取和记忆更新决策
 */

import { memoryService } from './MemoryService';
import { universalFetch } from '../../utils/universalFetch';
import {
  updateMemorySystemPrompt,
  getFactRetrievalMessages,
  getUpdateMemoryMessages,
  parseJsonSafe,
  FactRetrievalSchema,
  type FactRetrievalResult,
  type MemoryUpdateResult,
} from './prompts';
import type { MemoryConfig } from '../../types/memory';
import type { Model } from '../../types';

// ========================================================================
// 类型定义
// ========================================================================

export interface MemoryProcessorConfig {
  memoryConfig: MemoryConfig;
  assistantId?: string;
  userId: string;
  topicId?: string;
  lastMessageId?: string;
  /** 写入记忆的来源标记（默认 'auto'，回顾提取为 'dream'） */
  source?: 'auto' | 'dream';
}

export interface ProcessedMemoryResult {
  extractedFacts: string[];
  addedCount: number;
  updatedCount: number;
  deletedCount: number;
  errors: string[];
}

// ========================================================================
// MemoryProcessor 类
// ========================================================================

/**
 * 记忆处理器
 * 从对话中提取事实并更新记忆
 */
export class MemoryProcessor {
  private config: MemoryProcessorConfig;

  constructor(config: MemoryProcessorConfig) {
    this.config = config;
  }

  private buildMetadata() {
    return {
      source: this.config.source ?? ('auto' as const),
      topicId: this.config.topicId,
    };
  }

  /**
   * 处理对话，提取事实并更新记忆
   * @param messages 对话消息数组 [用户消息, 助手消息, ...]
   */
  public async processConversation(
    messages: string[]
  ): Promise<ProcessedMemoryResult> {
    const result: ProcessedMemoryResult = {
      extractedFacts: [],
      addedCount: 0,
      updatedCount: 0,
      deletedCount: 0,
      errors: [],
    };

    try {
      // 1. 提取事实
      const facts = await this.extractFacts(messages);
      if (!facts || facts.length === 0) {
        console.log('[MemoryProcessor] 未提取到任何事实');
        return result;
      }

      result.extractedFacts = facts;
      console.log('[MemoryProcessor] 提取到事实:', facts);

      // 2. 更新记忆
      const updateResult = await this.updateMemories(facts);
      result.addedCount = updateResult.addedCount;
      result.updatedCount = updateResult.updatedCount;
      result.deletedCount = updateResult.deletedCount;
      result.errors = updateResult.errors;

      return result;
    } catch (error) {
      console.error('[MemoryProcessor] 处理对话失败:', error);
      result.errors.push(String(error));
      return result;
    }
  }

  /**
   * 从对话中提取事实
   */
  public async extractFacts(messages: string[]): Promise<string[]> {
    const llmModel = this.config.memoryConfig.llmModel;
    if (!llmModel) {
      console.warn('[MemoryProcessor] 未配置 LLM 模型，跳过事实提取');
      return [];
    }

    try {
      // 构建提示词（支持自定义提示词）
      const parsedMessages = messages.join('\n');
      const customPrompt = this.config.memoryConfig.customFactExtractionPrompt;
      const [systemPrompt, userPrompt] = getFactRetrievalMessages(parsedMessages, customPrompt);

      // 调用 LLM
      const response = await this.callLLM(llmModel, systemPrompt, userPrompt);
      if (!response) {
        console.warn('[MemoryProcessor] LLM 未返回响应');
        return [];
      }

      // 解析响应
      const parsed = parseJsonSafe<FactRetrievalResult>(response);
      if (!parsed || !Array.isArray(parsed.facts)) {
        console.warn('[MemoryProcessor] 无法解析事实提取结果');
        return [];
      }

      // 验证
      const validated = FactRetrievalSchema.safeParse(parsed);
      if (!validated.success) {
        console.warn('[MemoryProcessor] 事实提取结果验证失败:', validated.error);
        return parsed.facts || [];
      }

      return validated.data.facts;
    } catch (error) {
      console.error('[MemoryProcessor] 事实提取失败:', error);
      return [];
    }
  }

  /**
   * 更新记忆
   */
  public async updateMemories(
    facts: string[]
  ): Promise<{ addedCount: number; updatedCount: number; deletedCount: number; errors: string[] }> {
    const result = { addedCount: 0, updatedCount: 0, deletedCount: 0, errors: [] as string[] };

    const llmModel = this.config.memoryConfig.llmModel;
    if (!llmModel) {
      // 如果没有 LLM，直接添加所有事实
      for (const fact of facts) {
        const memory = await memoryService.add(fact, {
          userId: this.config.userId,
          assistantId: this.config.assistantId,
          metadata: this.buildMetadata(),
        });
        if (memory) {
          result.addedCount++;
        }
      }
      return result;
    }

    try {
      // 获取现有记忆
      const existingMemories = await memoryService.list({
        userId: this.config.userId,
        limit: 100,
      });

      const oldMemory = existingMemories.memories.map((m) => ({
        id: m.id,
        text: m.memory,
      }));

      // 构建更新决策提示词
      const userPrompt = getUpdateMemoryMessages(oldMemory, facts);

      // 调用 LLM 获取更新决策
      const response = await this.callLLM(llmModel, updateMemorySystemPrompt, userPrompt);
      if (!response) {
        console.warn('[MemoryProcessor] LLM 未返回更新决策');
        // 降级：直接添加新事实
        for (const fact of facts) {
          const memory = await memoryService.add(fact, {
            userId: this.config.userId,
            assistantId: this.config.assistantId,
            metadata: this.buildMetadata(),
          });
          if (memory) result.addedCount++;
        }
        return result;
      }

      // 解析更新决策，失败时降级为直接添加新事实，避免静默丢数据
      const parsed = parseJsonSafe<MemoryUpdateResult>(response);
      if (!parsed || !Array.isArray(parsed)) {
        console.warn('[MemoryProcessor] 无法解析更新决策，降级为直接添加事实');
        for (const fact of facts) {
          const memory = await memoryService.add(fact, {
            userId: this.config.userId,
            assistantId: this.config.assistantId,
            metadata: this.buildMetadata(),
          });
          if (memory) result.addedCount++;
        }
        return result;
      }

      // 执行更新操作
      for (const operation of parsed) {
        try {
          switch (operation.event) {
            case 'ADD':
              const added = await memoryService.add(operation.text, {
                userId: this.config.userId,
                assistantId: this.config.assistantId,
                metadata: this.buildMetadata(),
              });
              if (added) result.addedCount++;
              break;

            case 'UPDATE':
              const updated = await memoryService.update(operation.id, operation.text);
              if (updated) result.updatedCount++;
              break;

            case 'DELETE':
              const deleted = await memoryService.delete(operation.id);
              if (deleted) result.deletedCount++;
              break;

            case 'NONE':
              // 无操作
              break;
          }
        } catch (opError) {
          console.error('[MemoryProcessor] 执行操作失败:', operation, opError);
          result.errors.push(`操作 ${operation.event} 失败: ${opError}`);
        }
      }

      return result;
    } catch (error) {
      console.error('[MemoryProcessor] 更新记忆失败:', error);
      result.errors.push(String(error));
      return result;
    }
  }

  /**
   * 搜索相关记忆
   */
  public async searchRelevantMemories(
    query: string,
    limit: number = 10
  ): Promise<string[]> {
    try {
      const result = await memoryService.search(query, {
        userId: this.config.userId,
        limit,
        threshold: 0.5,
      });

      return result.memories.map(m => m.memory);
    } catch (error) {
      console.error('[MemoryProcessor] 搜索记忆失败:', error);
      return [];
    }
  }

  /**
   * 调用 LLM
   */
  private async callLLM(
    model: Model,
    systemPrompt: string,
    userPrompt: string
  ): Promise<string | null> {
    try {
      const baseUrl = model.baseUrl || 'https://api.openai.com/v1';
      const url = `${baseUrl}/chat/completions`;

      const response = await universalFetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${model.apiKey}`,
        },
        body: JSON.stringify({
          model: model.id,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.3,
          max_tokens: 4096,
        }),
      });

      if (!response.ok) {
        throw new Error(`LLM API error: ${response.status}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || null;
    } catch (error) {
      console.error('[MemoryProcessor] LLM 调用失败:', error);
      return null;
    }
  }
}

// ========================================================================
// 工厂函数
// ========================================================================

/**
 * 创建记忆处理器
 */
export function createMemoryProcessor(config: MemoryProcessorConfig): MemoryProcessor {
  return new MemoryProcessor(config);
}

export default MemoryProcessor;
