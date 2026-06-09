/**
 * 记忆存储服务
 * 基于 Cherry Studio 设计，使用 Dexie.js (IndexedDB) 存储
 * 
 * @description 提供记忆的 CRUD 操作和向量搜索功能
 */

import { v4 as uuid } from 'uuid';
import { dexieStorage } from '../storage/DexieStorageService';
import type {
  MemorySearchResult,
  AddMemoryOptions,
  MemorySearchOptions,
  MemoryListOptions,
  MemoryConfig,
  MemoryMetadata,
} from '../../types/memory';
import type { Memory } from '../../database/config';
import { createHash } from '../../utils/hash.ts';

// 使用数据库的 Memory 类型作为 MemoryItem
type MemoryItem = Memory & { memory: string };

// ========================================================================
// 常量配置
// ========================================================================

/** 相似度阈值（用于去重） */
const SIMILARITY_THRESHOLD = 0.85;

/** 统一向量维度 */
const UNIFIED_DIMENSION = 1536;

// ========================================================================
// MemoryService 类
// ========================================================================

/**
 * 记忆存储服务
 * 单例模式，提供记忆的增删改查和向量搜索
 */
class MemoryService {
  private static instance: MemoryService;
  private config: MemoryConfig = {};
  private embeddingCache: Map<string, number[]> = new Map();
  private isInitialized = false;

  private constructor() {}

  /**
   * 获取单例实例
   */
  public static getInstance(): MemoryService {
    if (!MemoryService.instance) {
      MemoryService.instance = new MemoryService();
    }
    return MemoryService.instance;
  }

  /**
   * 初始化服务
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    console.log('[MemoryService] 初始化记忆服务...');
    this.isInitialized = true;
    console.log('[MemoryService] 记忆服务初始化完成');
  }

  /**
   * 更新配置
   */
  public setConfig(config: MemoryConfig): void {
    this.config = { ...this.config, ...config };
    console.log('[MemoryService] 配置已更新:', config);
  }

  /**
   * 获取当前配置
   */
  public getConfig(): MemoryConfig {
    return this.config;
  }

  // ========================================================================
  // CRUD 操作
  // ========================================================================

  /**
   * 添加记忆
   */
  public async add(
    memory: string,
    options: AddMemoryOptions = {}
  ): Promise<MemoryItem | null> {
    try {
      const { assistantId, metadata } = options;
      // 统一存储键：assistantId 优先，与 list/search 的过滤键保持一致
      const userId = options.assistantId || options.userId || 'default';

      // 计算哈希值用于去重
      const hash = await createHash(memory);

      // 检查是否存在相同哈希的记忆
      const existing = await this.findByHash(hash, userId);
      if (existing) {
        console.log('[MemoryService] 记忆已存在（相同哈希），跳过添加');
        return existing;
      }

      // 生成向量嵌入（如果配置了嵌入模型）
      let embedding: number[] | undefined;
      if (this.config.embeddingModel) {
        embedding = await this.getEmbedding(memory);
        
        // 检查向量相似度去重
        if (embedding) {
          const similar = await this.findSimilar(embedding, userId, SIMILARITY_THRESHOLD);
          if (similar) {
            console.log('[MemoryService] 发现高度相似的记忆，跳过添加');
            return similar;
          }
        }
      }

      // 创建记忆项
      const now = new Date().toISOString();
      const memoryItem: Memory = {
        id: uuid(),
        memory,
        hash,
        embedding,
        type: 'memory',
        createdAt: now,
        updatedAt: now,
        userId,
        assistantId,
        metadata: {
          ...metadata,
          source: metadata?.source || 'manual',
        },
        isDeleted: false,
      };

      // 保存到数据库
      await dexieStorage.memories.put(memoryItem);
      
      console.log('[MemoryService] 记忆已添加:', memoryItem.id);
      return memoryItem as MemoryItem;
    } catch (error) {
      console.error('[MemoryService] 添加记忆失败:', error);
      return null;
    }
  }

  /**
   * 批量添加记忆
   */
  public async addBatch(
    memories: string[],
    options: AddMemoryOptions = {}
  ): Promise<MemoryItem[]> {
    const results: MemoryItem[] = [];
    for (const memory of memories) {
      const item = await this.add(memory, options);
      if (item) {
        results.push(item);
      }
    }
    return results;
  }

  /**
   * 更新记忆
   */
  public async update(
    id: string,
    memory: string,
    metadata?: MemoryMetadata
  ): Promise<MemoryItem | null> {
    try {
      const existing = await dexieStorage.memories.get(id);
      if (!existing) {
        console.warn('[MemoryService] 找不到要更新的记忆:', id);
        return null;
      }

      const hash = await createHash(memory);
      // 重新生成失败时保留旧向量，避免记忆从向量搜索中消失
      let embedding: number[] | undefined = existing.embedding;
      
      if (this.config.embeddingModel) {
        const newEmbedding = await this.getEmbedding(memory);
        if (newEmbedding) {
          embedding = newEmbedding;
        }
      }

      const updated: Memory = {
        ...existing,
        memory,
        hash,
        embedding,
        type: 'memory',
        updatedAt: new Date().toISOString(),
        metadata: metadata ? { ...existing.metadata, ...metadata } : existing.metadata,
      };

      await dexieStorage.memories.put(updated);
      
      console.log('[MemoryService] 记忆已更新:', id);
      return updated as MemoryItem;
    } catch (error) {
      console.error('[MemoryService] 更新记忆失败:', error);
      return null;
    }
  }

  /**
   * 删除记忆（软删除）
   */
  public async delete(id: string): Promise<boolean> {
    try {
      const existing = await dexieStorage.memories.get(id);
      if (!existing) {
        console.warn('[MemoryService] 找不到要删除的记忆:', id);
        return false;
      }

      // 软删除
      await dexieStorage.memories.update(id, {
        isDeleted: true,
        updatedAt: new Date().toISOString(),
      });

      console.log('[MemoryService] 记忆已删除:', id);
      return true;
    } catch (error) {
      console.error('[MemoryService] 删除记忆失败:', error);
      return false;
    }
  }

  /**
   * 硬删除记忆
   */
  public async hardDelete(id: string): Promise<boolean> {
    try {
      await dexieStorage.memories.delete(id);
      console.log('[MemoryService] 记忆已永久删除:', id);
      return true;
    } catch (error) {
      console.error('[MemoryService] 永久删除记忆失败:', error);
      return false;
    }
  }

  /**
   * 获取单条记忆
   */
  public async get(id: string): Promise<MemoryItem | null> {
    try {
      const memory = await dexieStorage.memories.get(id);
      if (!memory || !memory.memory) return null;
      return memory as MemoryItem;
    } catch (error) {
      console.error('[MemoryService] 获取记忆失败:', error);
      return null;
    }
  }

  /**
   * 获取记忆列表
   */
  public async list(options: MemoryListOptions = {}): Promise<MemorySearchResult> {
    try {
      const { limit = 100, offset = 0 } = options;
      // 支持 assistantId 或后向兼容的 userId
      const filterKey = options.assistantId || options.userId || 'default';

      const allMemories = await dexieStorage.memories.toArray();
      const filtered = allMemories.filter(m => 
        m.userId === filterKey && 
        !m.isDeleted && 
        m.type === 'memory' &&
        m.memory
      );

      const count = filtered.length;
      const memories = filtered
        .slice(offset, offset + limit)
        .map(m => m as MemoryItem);

      return {
        memories,
        count,
      };
    } catch (error) {
      console.error('[MemoryService] 获取记忆列表失败:', error);
      return { memories: [], count: 0, error: String(error) };
    }
  }

  // ========================================================================
  // 搜索功能
  // ========================================================================

  /**
   * 向量相似度搜索
   */
  public async search(
    query: string,
    options: MemorySearchOptions = {}
  ): Promise<MemorySearchResult> {
    try {
      const { limit = 10, threshold = 0.5 } = options;
      // 支持 assistantId 或后向兼容的 userId
      const filterKey = options.assistantId || options.userId || 'default';

      // 获取查询向量
      const queryEmbedding = await this.getEmbedding(query);
      if (!queryEmbedding) {
        return this.textSearch(query, options);
      }

      // 获取助手的所有记忆
      const allMemories = await dexieStorage.memories.toArray();
      const validMemories = allMemories.filter(m => 
        m.userId === filterKey && 
        !m.isDeleted && 
        !!m.embedding &&
        m.type === 'memory' &&
        m.memory
      );

      // 计算相似度并排序
      const scoredMemories = validMemories
        .map(memory => ({
          ...memory,
          score: this.cosineSimilarity(queryEmbedding, memory.embedding!),
        }))
        .filter(m => m.score >= threshold)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(m => m as MemoryItem);

      return {
        memories: scoredMemories,
        count: scoredMemories.length,
      };
    } catch (error) {
      console.error('[MemoryService] 搜索记忆失败:', error);
      return { memories: [], count: 0, error: String(error) };
    }
  }

  /**
   * 文本搜索（降级方案）
   */
  public async textSearch(
    query: string,
    options: MemorySearchOptions = {}
  ): Promise<MemorySearchResult> {
    try {
      const { limit = 10 } = options;
      const filterKey = options.assistantId || options.userId || 'default';
      const lowerQuery = query.toLowerCase();

      const allMemories = await dexieStorage.memories.toArray();
      const filtered = allMemories.filter(m => 
        m.userId === filterKey && 
        !m.isDeleted && 
        m.type === 'memory' &&
        m.memory &&
        m.memory.toLowerCase().includes(lowerQuery)
      ).slice(0, limit);

      return {
        memories: filtered.map(m => ({ ...m, score: 1.0 } as MemoryItem)),
        count: filtered.length,
      };
    } catch (error) {
      console.error('[MemoryService] 文本搜索失败:', error);
      return { memories: [], count: 0, error: String(error) };
    }
  }

  // ========================================================================
  // 用户管理
  // ========================================================================

  /**
   * 获取用户列表
   */
  public async getUsersList(): Promise<string[]> {
    try {
      const memories = await dexieStorage.memories.toArray();
      const userIds = new Set(memories.map(m => m.userId).filter(Boolean));
      return Array.from(userIds) as string[];
    } catch (error) {
      console.error('[MemoryService] 获取用户列表失败:', error);
      return [];
    }
  }

  /**
   * 删除用户的所有记忆
   */
  public async deleteAllMemoriesForUser(userId: string): Promise<boolean> {
    try {
      const memories = await dexieStorage.memories
        .filter(m => m.userId === userId)
        .toArray();

      for (const memory of memories) {
        await this.delete(memory.id);
      }

      console.log('[MemoryService] 已删除用户所有记忆:', userId);
      return true;
    } catch (error) {
      console.error('[MemoryService] 删除用户记忆失败:', error);
      return false;
    }
  }

  /**
   * 删除助手的所有记忆
   */
  public async deleteAllMemoriesForAssistant(assistantId: string): Promise<boolean> {
    try {
      const memories = await dexieStorage.memories
        .filter(m => m.userId === assistantId) // userId 字段存储 assistantId
        .toArray();

      for (const memory of memories) {
        await this.delete(memory.id);
      }

      console.log('[MemoryService] 已删除助手所有记忆:', assistantId);
      return true;
    } catch (error) {
      console.error('[MemoryService] 删除助手记忆失败:', error);
      return false;
    }
  }

  /**
   * 删除用户（包括所有记忆）
   */
  public async deleteUser(userId: string): Promise<boolean> {
    if (userId === 'default-user') {
      console.warn('[MemoryService] 无法删除默认用户');
      return false;
    }

    return this.deleteAllMemoriesForUser(userId);
  }

  // ========================================================================
  // 私有辅助方法
  // ========================================================================

  /**
   * 通过哈希查找记忆
   */
  private async findByHash(hash: string, userId: string): Promise<MemoryItem | null> {
    try {
      const allMemories = await dexieStorage.memories.toArray();
      const memory = allMemories.find(m => 
        m.hash === hash && 
        m.userId === userId && 
        !m.isDeleted &&
        m.memory
      );
      return memory ? (memory as MemoryItem) : null;
    } catch {
      return null;
    }
  }

  /**
   * 查找相似记忆
   */
  private async findSimilar(
    embedding: number[],
    userId: string,
    threshold: number
  ): Promise<MemoryItem | null> {
    try {
      const allMemories = await dexieStorage.memories.toArray();
      const memories = allMemories.filter(m => 
        m.userId === userId && 
        !m.isDeleted && 
        !!m.embedding &&
        m.memory
      );

      for (const memory of memories) {
        const similarity = this.cosineSimilarity(embedding, memory.embedding!);
        if (similarity >= threshold) {
          return { ...memory, score: similarity } as MemoryItem;
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * 获取文本的向量嵌入
   */
  private async getEmbedding(text: string): Promise<number[] | undefined> {
    // 检查缓存
    const cached = this.embeddingCache.get(text);
    if (cached) {
      return cached;
    }

    if (!this.config.embeddingModel) {
      console.warn('[MemoryService] 未配置嵌入模型');
      return undefined;
    }

    try {
      // 调用嵌入服务
      const embedding = await this.callEmbeddingAPI(text);
      
      if (embedding) {
        // 归一化到统一维度
        const normalized = this.normalizeEmbedding(embedding);
        
        // 缓存结果
        this.embeddingCache.set(text, normalized);
        
        return normalized;
      }
    } catch (error) {
      console.error('[MemoryService] 获取嵌入失败:', error);
    }

    return undefined;
  }

  /**
   * 调用嵌入 API
   */
  private async callEmbeddingAPI(text: string): Promise<number[] | undefined> {
    const model = this.config.embeddingModel;
    if (!model) return undefined;

    try {
      const baseUrl = model.baseUrl || 'https://api.openai.com/v1';
      const url = `${baseUrl}/embeddings`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${model.apiKey}`,
        },
        body: JSON.stringify({
          model: model.id,
          input: text,
        }),
      });

      if (!response.ok) {
        throw new Error(`Embedding API error: ${response.status}`);
      }

      const data = await response.json();
      return data.data?.[0]?.embedding;
    } catch (error) {
      console.error('[MemoryService] 嵌入 API 调用失败:', error);
      return undefined;
    }
  }

  /**
   * 归一化嵌入向量到统一维度
   */
  private normalizeEmbedding(embedding: number[]): number[] {
    const targetDim = this.config.embeddingDimensions || UNIFIED_DIMENSION;
    
    if (embedding.length === targetDim) {
      return embedding;
    }

    if (embedding.length > targetDim) {
      // 截断
      return embedding.slice(0, targetDim);
    }

    // 填充
    return [...embedding, ...new Array(targetDim - embedding.length).fill(0)];
  }

  /**
   * 计算余弦相似度
   */
  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (!vecA || !vecB || vecA.length !== vecB.length) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * 清除嵌入缓存
   */
  public clearEmbeddingCache(): void {
    this.embeddingCache.clear();
  }
}

// ========================================================================
// 导出
// ========================================================================

export const memoryService = MemoryService.getInstance();
export default memoryService;
