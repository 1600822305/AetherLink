/**
 * 移动端知识库服务
 * 基于DexieStorageService版本6实现，使用云端API进行嵌入计算
 */
import { v4 as uuid } from 'uuid';
import { dexieStorage } from '../storage/DexieStorageService';
import { EventEmitter, EVENT_NAMES } from '../infra/EventService';
import { MobileEmbeddingService } from './MobileEmbeddingService';
import { EnhancedRAGService } from './EnhancedRAGService';
import {
  DEFAULT_KNOWLEDGE_DOCUMENT_COUNT,
  DEFAULT_KNOWLEDGE_THRESHOLD,
  DEFAULT_CHUNK_SIZE,
  DEFAULT_CHUNK_OVERLAP
} from '../../constants/knowledge';
import { cosineSimilarity } from '../../utils/vectorUtils';
import { chunkText } from '../../utils/textChunker';
import type { KnowledgeBase, KnowledgeDocument, KnowledgeSearchResult } from '../../types/KnowledgeBase';
import { createLogger } from '../infra/logger';

const logger = createLogger('MobileKnowledgeService');

/**
 * 移动端知识库服务类
 */
export class MobileKnowledgeService {
  private static instance: MobileKnowledgeService;
  private enhancedRAGService: EnhancedRAGService;

  private constructor() {
    this.enhancedRAGService = EnhancedRAGService.getInstance();
  }

  /**
   * 获取服务实例
   */
  public static getInstance(): MobileKnowledgeService {
    if (!MobileKnowledgeService.instance) {
      MobileKnowledgeService.instance = new MobileKnowledgeService();
    }
    return MobileKnowledgeService.instance;
  }

  /**
   * 创建知识库
   */
  public async createKnowledgeBase(params: {
    name: string;
    description?: string;
    model: string;
    dimensions: number;
    documentCount?: number;
    chunkSize?: number;
    chunkOverlap?: number;
    chunkStrategy?: KnowledgeBase['chunkStrategy'];
    threshold?: number;
  }): Promise<KnowledgeBase> {
    const now = new Date().toISOString();

    const knowledgeBase: KnowledgeBase = {
      id: uuid(),
      name: params.name,
      description: params.description || '',
      model: params.model,
      dimensions: params.dimensions,
      documentCount: params.documentCount || DEFAULT_KNOWLEDGE_DOCUMENT_COUNT,
      chunkSize: params.chunkSize || DEFAULT_CHUNK_SIZE,
      chunkOverlap: params.chunkOverlap || DEFAULT_CHUNK_OVERLAP,
      chunkStrategy: params.chunkStrategy || 'fixed',
      threshold: params.threshold || DEFAULT_KNOWLEDGE_THRESHOLD,
      created_at: now,
      updated_at: now
    };

    try {
      // 保存到数据库
      await dexieStorage.knowledge_bases.put(knowledgeBase);

      logger.debug(`知识库创建成功: ${knowledgeBase.id}`);
      EventEmitter.emit(EVENT_NAMES.KNOWLEDGE_BASE_CREATED, knowledgeBase);

      return knowledgeBase;
    } catch (error) {
      logger.error('创建知识库失败:', error);
      throw error;
    }
  }

  /**
   * 获取知识库
   */
  public async getKnowledgeBase(id: string): Promise<KnowledgeBase | null> {
    try {
      return await dexieStorage.knowledge_bases.get(id);
    } catch (error) {
      logger.error(`获取知识库失败: ${id}`, error);
      return null;
    }
  }

  /**
   * 获取所有知识库
   */
  public async getAllKnowledgeBases(): Promise<KnowledgeBase[]> {
    try {
      return await dexieStorage.knowledge_bases.toArray();
    } catch (error) {
      logger.error('获取所有知识库失败:', error);
      return [];
    }
  }

  /**
   * 更新知识库
   */
  public async updateKnowledgeBase(
    id: string,
    updates: Partial<Omit<KnowledgeBase, 'id' | 'created_at'>>
  ): Promise<KnowledgeBase | null> {
    try {
      const knowledgeBase = await this.getKnowledgeBase(id);
      if (!knowledgeBase) {
        return null;
      }

      const updatedKnowledgeBase = {
        ...knowledgeBase,
        ...updates,
        updated_at: new Date().toISOString()
      };

      await dexieStorage.knowledge_bases.put(updatedKnowledgeBase);

      logger.debug(`知识库更新成功: ${id}`);
      EventEmitter.emit(EVENT_NAMES.KNOWLEDGE_BASE_UPDATED, updatedKnowledgeBase);

      return updatedKnowledgeBase;
    } catch (error) {
      logger.error(`更新知识库失败: ${id}`, error);
      return null;
    }
  }

  /**
   * 删除知识库
   */
  public async deleteKnowledgeBase(id: string): Promise<boolean> {
    try {
      // 获取关联的文档
      const documents = await dexieStorage.knowledge_documents
        .where('knowledgeBaseId')
        .equals(id)
        .toArray();

      // 删除所有关联的文档
      await dexieStorage.knowledge_documents
        .where('knowledgeBaseId')
        .equals(id)
        .delete();

      // 删除知识库
      await dexieStorage.knowledge_bases.delete(id);

      logger.debug(`知识库删除成功: ${id}`);
      EventEmitter.emit(EVENT_NAMES.KNOWLEDGE_BASE_DELETED, { id, documentCount: documents.length });

      return true;
    } catch (error) {
      logger.error(`删除知识库失败: ${id}`, error);
      return false;
    }
  }

  /**
   * 添加文档到知识库
   * 文档会被分块处理和向量化
   */
  public async addDocument(params: {
    knowledgeBaseId: string;
    content: string;
    metadata: {
      source: string;
      fileName?: string;
      fileId?: string;
    };
  }): Promise<KnowledgeDocument[]> {
    try {
      const knowledgeBase = await this.getKnowledgeBase(params.knowledgeBaseId);
      if (!knowledgeBase) {
        throw new Error(`知识库不存在: ${params.knowledgeBaseId}`);
      }

      // 使用智能分块（支持多种策略）
      const chunks = chunkText(params.content, {
        chunkSize: knowledgeBase.chunkSize || DEFAULT_CHUNK_SIZE,
        chunkOverlap: knowledgeBase.chunkOverlap || DEFAULT_CHUNK_OVERLAP,
        preserveSentences: true,
        strategy: knowledgeBase.chunkStrategy || 'fixed',
      });

      logger.debug(`文档分块: ${chunks.length} 个块`);

      // 批量获取嵌入向量（一次 API 请求处理多个文本）
      const documents: KnowledgeDocument[] = [];
      const embeddingService = MobileEmbeddingService.getInstance();
      const BATCH_SIZE = 20;

      for (let batchStart = 0; batchStart < chunks.length; batchStart += BATCH_SIZE) {
        const batchChunks = chunks.slice(batchStart, batchStart + BATCH_SIZE);

        try {
          // 批量嵌入：一次请求最多 BATCH_SIZE 个文本
          const vectors = await embeddingService.getBatchEmbeddings(
            batchChunks,
            knowledgeBase.model,
            BATCH_SIZE
          );

          // 创建文档并保存
          for (let j = 0; j < batchChunks.length; j++) {
            const globalIndex = batchStart + j;
            const document: KnowledgeDocument = {
              id: uuid(),
              knowledgeBaseId: params.knowledgeBaseId,
              content: batchChunks[j],
              vector: vectors[j],
              metadata: {
                source: params.metadata.source,
                fileName: params.metadata.fileName,
                fileId: params.metadata.fileId,
                chunkIndex: globalIndex,
                timestamp: Date.now()
              }
            };

            await dexieStorage.knowledge_documents.put(document);
            documents.push(document);

            // 发出进度事件
            EventEmitter.emit(EVENT_NAMES.KNOWLEDGE_DOCUMENT_PROCESSED, {
              documentId: document.id,
              knowledgeBaseId: params.knowledgeBaseId,
              progress: {
                current: globalIndex + 1,
                total: chunks.length
              }
            });
          }

          logger.debug(`批量嵌入完成: ${batchStart + batchChunks.length}/${chunks.length}`);
        } catch (error) {
          logger.error(`批量嵌入失败 (${batchStart}-${batchStart + batchChunks.length}):`, error);
          throw new Error(`无法获取文本向量嵌入，请检查嵌入模型配置和网络连接。错误: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      logger.debug(`文档添加成功: ${documents.length} 个块`);
      EventEmitter.emit(EVENT_NAMES.KNOWLEDGE_DOCUMENTS_ADDED, {
        knowledgeBaseId: params.knowledgeBaseId,
        count: documents.length
      });

      return documents;
    } catch (error) {
      logger.error('添加文档失败:', error);
      throw error;
    }
  }

  /**
   * 获取知识库中的所有文档
   * @param knowledgeBaseId 知识库ID
   * @returns 知识库中的所有文档
   */
  public async getDocumentsByKnowledgeBaseId(knowledgeBaseId: string): Promise<KnowledgeDocument[]> {
    try {
      const documents = await dexieStorage.knowledge_documents
        .where('knowledgeBaseId')
        .equals(knowledgeBaseId)
        .toArray();

      logger.debug(`获取知识库文档成功: ${knowledgeBaseId}, 共 ${documents.length} 个文档`);
      return documents;
    } catch (error) {
      logger.error(`获取知识库文档失败: ${knowledgeBaseId}`, error);
      return [];
    }
  }

  /**
   * 删除指定ID的文档
   * @param documentId 文档ID
   * @returns 是否删除成功
   */
  public async deleteDocument(documentId: string): Promise<boolean> {
    try {
      // 获取文档信息，用于通知事件
      const document = await dexieStorage.knowledge_documents.get(documentId);
      if (!document) {
        logger.warn(`尝试删除不存在的文档: ${documentId}`);
        return false;
      }

      // 删除文档
      await dexieStorage.knowledge_documents.delete(documentId);

      logger.debug(`删除文档成功: ${documentId}, 知识库: ${document.knowledgeBaseId}`);

      // 发出文档删除事件
      EventEmitter.emit(EVENT_NAMES.KNOWLEDGE_DOCUMENT_DELETED, {
        documentId,
        knowledgeBaseId: document.knowledgeBaseId
      });

      return true;
    } catch (error) {
      logger.error(`删除文档失败: ${documentId}`, error);
      return false;
    }
  }

  /**
   * 搜索知识库（别名方法，兼容KnowledgeSelector调用）
   */
  public async searchKnowledge(
    knowledgeBaseId: string,
    query: string,
    limit?: number
  ): Promise<KnowledgeSearchResult[]> {
    return this.search({
      knowledgeBaseId,
      query,
      limit
    });
  }

  /**
   * 增强RAG搜索（新增）
   */
  public async enhancedSearch(params: {
    knowledgeBaseId: string;
    query: string;
    threshold?: number;
    limit?: number;
    enableRerank?: boolean;
    enableQueryExpansion?: boolean;
    enableHybridSearch?: boolean;
  }): Promise<KnowledgeSearchResult[]> {
    logger.debug(`使用增强RAG搜索: ${params.query}`);
    return this.enhancedRAGService.enhancedSearch(params);
  }

  /**
   * 搜索知识库 - 支持选择搜索模式
   */
  public async search(params: {
    knowledgeBaseId: string;
    query: string;
    threshold?: number;
    limit?: number;
    useEnhancedRAG?: boolean; // 新增：是否使用增强RAG
  }): Promise<KnowledgeSearchResult[]> {
    // 如果启用增强RAG，使用新的搜索算法
    if (params.useEnhancedRAG !== false) {
      logger.debug(`使用增强RAG搜索模式`);
      try {
        return await this.enhancedRAGService.enhancedSearch({
          knowledgeBaseId: params.knowledgeBaseId,
          query: params.query,
          threshold: params.threshold,
          limit: params.limit,
          config: {
            enableQueryExpansion: true,
            enableHybridSearch: true,
            enableRerank: true,
            enableContextAware: true,
            maxCandidates: 50,
            diversityThreshold: 0.8
          }
        });
      } catch (error) {
        logger.warn('增强RAG搜索失败，回退到简单搜索:', error);
        // 继续执行简单搜索作为回退
      }
    }

    // 简单搜索模式（原有逻辑）
    logger.debug(`使用简单搜索模式`);
    return this.simpleSearch(params);
  }

  /**
   * 简单搜索模式（原有逻辑重构）
   */
  private async simpleSearch(params: {
    knowledgeBaseId: string;
    query: string;
    threshold?: number;
    limit?: number;
  }): Promise<KnowledgeSearchResult[]> {
    try {
      const knowledgeBase = await this.getKnowledgeBase(params.knowledgeBaseId);
      if (!knowledgeBase) {
        throw new Error(`知识库不存在: ${params.knowledgeBaseId}`);
      }

      // 获取查询向量（使用知识库创建时的模型）
      let queryVector: number[];
      try {
        const embeddingService = MobileEmbeddingService.getInstance();
        queryVector = await embeddingService.getEmbedding(params.query, knowledgeBase.model);
        logger.debug(`查询向量获取成功，维度: ${queryVector.length}`);
      } catch (embeddingError) {
        // 不使用随机向量，直接抛出错误
        logger.error(`查询向量获取失败:`, embeddingError);
        throw new Error(`无法获取查询向量，请检查嵌入模型配置和网络连接。`);
      }

      // 获取所有文档向量
      const documents = await dexieStorage.knowledge_documents
        .where('knowledgeBaseId')
        .equals(params.knowledgeBaseId)
        .toArray();

      logger.debug(`搜索知识库: ${documents.length} 个文档`);

      // 检查文档向量维度
      if (documents.length > 0) {
        const firstDocVector = documents[0].vector;
        logger.debug(`文档向量维度: ${firstDocVector?.length || '未知'}`);
        logger.debug(`查询向量维度: ${queryVector.length}`);

        if (firstDocVector && firstDocVector.length !== queryVector.length) {
          throw new Error(`向量维度不匹配: 查询向量(${queryVector.length}) vs 知识库文档向量(${firstDocVector.length})。请使用相同的嵌入模型或重新创建知识库。`);
        }
      }

      // 计算余弦相似度并排序
      const threshold = params.threshold || knowledgeBase.threshold || DEFAULT_KNOWLEDGE_THRESHOLD;
      const limit = params.limit || knowledgeBase.documentCount || 5; // 使用知识库配置的文档数量

      // 使用简单的相似度计算
      const results = this.localVectorSearch(queryVector, documents, threshold, limit);

      logger.debug(`简单搜索结果: ${results.length} 条`);

      return results;
    } catch (error) {
      logger.error('简单搜索失败:', error);
      return [];
    }
  }

  /**
   * 本地向量搜索
   * 使用统一的cosineSimilarity工具函数
   */
  private localVectorSearch(
    queryVector: number[],
    documents: KnowledgeDocument[],
    threshold: number,
    limit: number
  ): KnowledgeSearchResult[] {
    return documents
      .filter(doc => doc.metadata.enabled !== false)
      .map(doc => {
        // 使用统一的余弦相似度计算
        const similarity = cosineSimilarity(queryVector, doc.vector);
        return {
          documentId: doc.id,
          content: doc.content,
          similarity,
          metadata: doc.metadata
        };
      })
      .filter(result => result.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }
}