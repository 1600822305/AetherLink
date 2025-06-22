/**
 * 增强的RAG搜索服务
 * 实现复杂的检索增强生成架构，替代简单的向量搜索
 */
import { dexieStorage } from '../storage/DexieStorageService';
import { MobileEmbeddingService } from './MobileEmbeddingService';
import type { KnowledgeBase, KnowledgeDocument, KnowledgeSearchResult } from '../../types/KnowledgeBase';

// RAG搜索配置
interface RAGSearchConfig {
  enableQueryExpansion: boolean;
  enableHybridSearch: boolean;
  enableRerank: boolean;
  enableContextAware: boolean;
  maxCandidates: number;
  diversityThreshold: number;
}

// 查询扩展结果
interface QueryExpansion {
  originalQuery: string;
  expandedQueries: string[];
  synonyms: string[];
  relatedTerms: string[];
}

// 检索结果
interface RetrievalResult {
  documents: KnowledgeDocument[];
  scores: number[];
  strategy: 'vector' | 'keyword' | 'hybrid';
}

// 融合权重配置
interface FusionWeights {
  vectorWeight: number;
  keywordWeight: number;
  recencyWeight: number;
  diversityWeight: number;
}

export class EnhancedRAGService {
  private static instance: EnhancedRAGService;
  private embeddingService: MobileEmbeddingService;
  private queryCache: Map<string, QueryExpansion> = new Map();


  private constructor() {
    this.embeddingService = MobileEmbeddingService.getInstance();
  }

  public static getInstance(): EnhancedRAGService {
    if (!EnhancedRAGService.instance) {
      EnhancedRAGService.instance = new EnhancedRAGService();
    }
    return EnhancedRAGService.instance;
  }

  /**
   * 增强的RAG搜索主入口
   */
  public async enhancedSearch(params: {
    knowledgeBaseId: string;
    query: string;
    threshold?: number;
    limit?: number;
    config?: Partial<RAGSearchConfig>;
  }): Promise<KnowledgeSearchResult[]> {
    const startTime = Date.now();
    
    try {
      // 获取知识库信息
      const knowledgeBase = await dexieStorage.knowledge_bases.get(params.knowledgeBaseId);
      if (!knowledgeBase) {
        throw new Error(`知识库不存在: ${params.knowledgeBaseId}`);
      }

      // 合并配置 - 优化性能
      const config: RAGSearchConfig = {
        enableQueryExpansion: true,
        enableHybridSearch: true,
        enableRerank: false, // 暂时禁用重排序以提高速度
        enableContextAware: true,
        maxCandidates: 20, // 减少候选数量
        diversityThreshold: 0.8,
        ...params.config
      };

      console.log(`[EnhancedRAGService] 开始增强RAG搜索: "${params.query}"`);

      // 第一阶段：查询理解和扩展
      const queryExpansion = await this.expandQuery(params.query, knowledgeBase, config);

      // 第二阶段：多策略检索
      const retrievalResults = await this.multiStrategyRetrieval({
        knowledgeBaseId: params.knowledgeBaseId,
        queryExpansion,
        knowledgeBase,
        config
      });

      // 第三阶段：结果融合
      const fusedResults = await this.fuseRetrievalResults(
        retrievalResults,
        params.query,
        config
      );

      // 第四阶段：重排序
      let finalResults = fusedResults;
      if (config.enableRerank && fusedResults.length > 1) {
        finalResults = await this.rerankResults(params.query, fusedResults, knowledgeBase);
      }

      // 第五阶段：后处理和过滤
      const processedResults = this.postProcessResults(
        finalResults,
        params.threshold || knowledgeBase.threshold || 0.3, // 降低默认阈值
        params.limit || knowledgeBase.documentCount || 5 // 使用知识库配置的文档数量
      );

      const duration = Date.now() - startTime;
      console.log(`[EnhancedRAGService] RAG搜索完成，耗时: ${duration}ms，结果: ${processedResults.length}条`);

      // 调试信息：如果没有结果，输出详细信息
      if (processedResults.length === 0) {
        console.log(`[EnhancedRAGService] 调试信息 - 无结果原因分析:`);
        console.log(`- 查询扩展结果:`, queryExpansion);
        console.log(`- 检索策略数量: ${retrievalResults.length}`);
        console.log(`- 融合结果数量: ${fusedResults.length}`);
        console.log(`- 重排序结果数量: ${finalResults.length}`);
        console.log(`- 阈值: ${params.threshold || 0.7}`);
        console.log(`- 限制数量: ${params.limit || knowledgeBase.documentCount || 5}`);
      }

      return processedResults;

    } catch (error) {
      console.error('[EnhancedRAGService] 增强RAG搜索失败:', error);
      // 回退到简单搜索
      return this.fallbackSimpleSearch(params);
    }
  }

  /**
   * 第一阶段：查询扩展和理解
   */
  private async expandQuery(
    query: string,
    knowledgeBase: KnowledgeBase,
    config: RAGSearchConfig
  ): Promise<QueryExpansion> {
    // 检查缓存
    const cacheKey = `${query}-${knowledgeBase.id}`;
    if (this.queryCache.has(cacheKey)) {
      return this.queryCache.get(cacheKey)!;
    }

    const expansion: QueryExpansion = {
      originalQuery: query,
      expandedQueries: [query],
      synonyms: [],
      relatedTerms: []
    };

    if (!config.enableQueryExpansion) {
      return expansion;
    }

    try {
      // 1. 查询分解
      const decomposedQueries = this.decomposeQuery(query);
      expansion.expandedQueries.push(...decomposedQueries);

      // 2. 同义词扩展
      const synonyms = await this.generateSynonyms(query);
      expansion.synonyms = synonyms;

      // 3. 相关术语提取
      const relatedTerms = await this.extractRelatedTerms(query, knowledgeBase);
      expansion.relatedTerms = relatedTerms;

      // 4. 生成扩展查询
      const additionalQueries = this.generateExpandedQueries(query, synonyms, relatedTerms);
      expansion.expandedQueries.push(...additionalQueries);

      // 缓存结果
      this.queryCache.set(cacheKey, expansion);
      
      console.log(`[EnhancedRAGService] 查询扩展完成: ${expansion.expandedQueries.length}个查询`);

    } catch (error) {
      console.warn('[EnhancedRAGService] 查询扩展失败，使用原始查询:', error);
    }

    return expansion;
  }

  /**
   * 第二阶段：多策略检索
   */
  private async multiStrategyRetrieval(params: {
    knowledgeBaseId: string;
    queryExpansion: QueryExpansion;
    knowledgeBase: KnowledgeBase;
    config: RAGSearchConfig;
  }): Promise<RetrievalResult[]> {
    const { knowledgeBaseId, queryExpansion, knowledgeBase, config } = params;
    const results: RetrievalResult[] = [];

    // 获取所有文档
    const allDocuments = await dexieStorage.knowledge_documents
      .where('knowledgeBaseId')
      .equals(knowledgeBaseId)
      .toArray();

    if (allDocuments.length === 0) {
      return results;
    }

    // 策略1：向量搜索
    const vectorResults = await this.vectorRetrieval(
      queryExpansion,
      allDocuments,
      knowledgeBase,
      config.maxCandidates
    );
    results.push(vectorResults);

    // 策略2：关键词搜索（如果启用混合搜索）
    if (config.enableHybridSearch) {
      const keywordResults = await this.keywordRetrieval(
        queryExpansion,
        allDocuments,
        config.maxCandidates
      );
      results.push(keywordResults);
    }

    // 策略3：语义搜索（基于内容理解）
    const semanticResults = await this.semanticRetrieval(
      queryExpansion,
      allDocuments,
      knowledgeBase,
      config.maxCandidates
    );
    results.push(semanticResults);

    console.log(`[EnhancedRAGService] 多策略检索完成: ${results.length}个策略`);

    return results;
  }

  /**
   * 向量检索策略
   */
  private async vectorRetrieval(
    queryExpansion: QueryExpansion,
    documents: KnowledgeDocument[],
    knowledgeBase: KnowledgeBase,
    maxCandidates: number
  ): Promise<RetrievalResult> {
    const allResults: Array<{ doc: KnowledgeDocument; score: number }> = [];

    console.log(`[EnhancedRAGService] 向量检索 - 查询数量: ${queryExpansion.expandedQueries.length}, 文档数量: ${documents.length}`);

    // 对每个扩展查询进行向量搜索
    for (const query of queryExpansion.expandedQueries) {
      try {
        // 获取查询向量
        const queryVector = await this.embeddingService.getEmbedding(query, knowledgeBase.model);

        // 计算相似度
        const queryResults = documents.map(doc => ({
          doc,
          score: this.cosineSimilarity(queryVector, doc.vector)
        }));

        // 输出最高分数
        const maxScore = Math.max(...queryResults.map(r => r.score));
        console.log(`[EnhancedRAGService] 向量检索 - 查询: "${query}", 最高相似度: ${maxScore.toFixed(4)}`);

        allResults.push(...queryResults);
      } catch (error) {
        console.warn(`[EnhancedRAGService] 向量检索失败: ${query}`, error);
      }
    }

    // 按文档ID去重并取最高分
    const deduplicatedResults = this.deduplicateByDocument(allResults);

    // 排序并限制数量
    const topResults = deduplicatedResults
      .sort((a, b) => b.score - a.score)
      .slice(0, maxCandidates);

    console.log(`[EnhancedRAGService] 向量检索完成 - 去重后结果: ${deduplicatedResults.length}, 前${maxCandidates}个结果`);
    if (topResults.length > 0) {
      console.log(`[EnhancedRAGService] 向量检索 - 最高分: ${topResults[0].score.toFixed(4)}, 最低分: ${topResults[topResults.length-1].score.toFixed(4)}`);
    }

    return {
      documents: topResults.map(r => r.doc),
      scores: topResults.map(r => r.score),
      strategy: 'vector'
    };
  }

  /**
   * 关键词检索策略
   */
  private async keywordRetrieval(
    queryExpansion: QueryExpansion,
    documents: KnowledgeDocument[],
    maxCandidates: number
  ): Promise<RetrievalResult> {
    const allKeywords = [
      ...queryExpansion.originalQuery.split(/\s+/),
      ...queryExpansion.synonyms,
      ...queryExpansion.relatedTerms
    ].filter(term => term.length > 1);

    console.log(`[EnhancedRAGService] 关键词检索 - 关键词:`, allKeywords);
    console.log(`[EnhancedRAGService] 关键词检索 - 文档数量: ${documents.length}`);

    const results = documents.map(doc => {
      const content = doc.content.toLowerCase();
      let score = 0;
      let matchDetails = [];

      // TF-IDF风格的关键词匹配
      for (const keyword of allKeywords) {
        const keywordLower = keyword.toLowerCase();
        const matches = (content.match(new RegExp(keywordLower, 'g')) || []).length;
        if (matches > 0) {
          // 简化的TF-IDF计算
          const tf = matches / content.split(/\s+/).length;
          const idf = Math.log(documents.length / (documents.filter(d =>
            d.content.toLowerCase().includes(keywordLower)
          ).length + 1));
          const keywordScore = tf * idf;
          score += keywordScore;
          matchDetails.push(`${keyword}:${matches}次`);
        }
      }

      // 调试：输出匹配详情
      if (score > 0) {
        console.log(`[EnhancedRAGService] 关键词匹配 - 文档ID: ${doc.id}, 分数: ${score.toFixed(4)}, 匹配: [${matchDetails.join(', ')}]`);
      }

      return { doc, score };
    });

    const topResults = results
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxCandidates);

    console.log(`[EnhancedRAGService] 关键词检索完成 - 有效结果: ${topResults.length}/${results.length}`);

    return {
      documents: topResults.map(r => r.doc),
      scores: topResults.map(r => r.score),
      strategy: 'keyword'
    };
  }

  /**
   * 语义检索策略
   */
  private async semanticRetrieval(
    queryExpansion: QueryExpansion,
    documents: KnowledgeDocument[],
    _knowledgeBase: KnowledgeBase,
    maxCandidates: number
  ): Promise<RetrievalResult> {
    // 基于文档元数据和上下文的语义匹配
    const results = documents.map(doc => {
      let score = 0;

      // 1. 源文件匹配
      if (doc.metadata.fileName) {
        const fileName = doc.metadata.fileName.toLowerCase();
        for (const query of queryExpansion.expandedQueries) {
          if (fileName.includes(query.toLowerCase())) {
            score += 0.3;
          }
        }
      }

      // 2. 时间相关性（较新的文档得分更高）
      const daysSinceCreation = (Date.now() - doc.metadata.timestamp) / (1000 * 60 * 60 * 24);
      const recencyScore = Math.exp(-daysSinceCreation / 30); // 30天衰减
      score += recencyScore * 0.2;

      // 3. 文档长度适中性（不太长不太短的文档得分更高）
      const idealLength = 500; // 理想文档长度
      const lengthScore = 1 - Math.abs(doc.content.length - idealLength) / idealLength;
      score += Math.max(0, lengthScore) * 0.1;

      return { doc, score };
    });

    const topResults = results
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxCandidates);

    return {
      documents: topResults.map(r => r.doc),
      scores: topResults.map(r => r.score),
      strategy: 'hybrid'
    };
  }

  /**
   * 第三阶段：结果融合
   */
  private async fuseRetrievalResults(
    retrievalResults: RetrievalResult[],
    _originalQuery: string,
    config: RAGSearchConfig
  ): Promise<KnowledgeSearchResult[]> {
    if (retrievalResults.length === 0) {
      return [];
    }

    // 融合权重配置
    const weights: FusionWeights = {
      vectorWeight: 0.6,
      keywordWeight: 0.3,
      recencyWeight: 0.05,
      diversityWeight: 0.05
    };

    // 收集所有候选文档
    const candidateMap = new Map<string, {
      document: KnowledgeDocument;
      scores: { [strategy: string]: number };
      finalScore: number;
    }>();

    // 合并不同策略的结果
    for (const result of retrievalResults) {
      for (let i = 0; i < result.documents.length; i++) {
        const doc = result.documents[i];
        const score = result.scores[i];
        const strategy = result.strategy;

        if (!candidateMap.has(doc.id)) {
          candidateMap.set(doc.id, {
            document: doc,
            scores: {},
            finalScore: 0
          });
        }

        const candidate = candidateMap.get(doc.id)!;
        candidate.scores[strategy] = score;
      }
    }

    // 计算融合分数
    const fusedResults: KnowledgeSearchResult[] = [];
    
    for (const candidate of candidateMap.values()) {
      let finalScore = 0;

      // 向量搜索分数
      if (candidate.scores.vector) {
        finalScore += candidate.scores.vector * weights.vectorWeight;
      }

      // 关键词搜索分数
      if (candidate.scores.keyword) {
        finalScore += candidate.scores.keyword * weights.keywordWeight;
      }

      // 混合搜索分数
      if (candidate.scores.hybrid) {
        finalScore += candidate.scores.hybrid * weights.recencyWeight;
      }

      // 多样性奖励（避免过于相似的结果）
      const diversityBonus = this.calculateDiversityBonus(
        candidate.document,
        fusedResults,
        config.diversityThreshold
      );
      finalScore += diversityBonus * weights.diversityWeight;

      fusedResults.push({
        documentId: candidate.document.id,
        content: candidate.document.content,
        similarity: finalScore,
        metadata: candidate.document.metadata
      });
    }

    // 按融合分数排序
    fusedResults.sort((a, b) => b.similarity - a.similarity);

    console.log(`[EnhancedRAGService] 结果融合完成: ${fusedResults.length}个候选结果`);

    // 调试：输出融合结果的分数分布
    if (fusedResults.length > 0) {
      console.log(`[EnhancedRAGService] 融合分数分布 - 最高: ${fusedResults[0].similarity.toFixed(4)}, 最低: ${fusedResults[fusedResults.length-1].similarity.toFixed(4)}`);
      // 输出前3个结果的详细信息
      fusedResults.slice(0, 3).forEach((result, index) => {
        console.log(`[EnhancedRAGService] 融合结果${index+1} - 分数: ${result.similarity.toFixed(4)}, 内容预览: "${result.content.substring(0, 50)}..."`);
      });
    }

    return fusedResults;
  }

  /**
   * 第四阶段：重排序
   */
  private async rerankResults(
    query: string,
    results: KnowledgeSearchResult[],
    knowledgeBase: KnowledgeBase
  ): Promise<KnowledgeSearchResult[]> {
    if (results.length <= 1) {
      return results;
    }

    try {
      // 简化的重排序算法（基于查询-文档相关性）
      const rerankedResults = await Promise.all(
        results.map(async (result, index) => {
          // 计算查询与文档内容的语义相关性
          const relevanceScore = await this.calculateRelevanceScore(query, result.content, knowledgeBase);
          
          // 结合原始相似度和相关性分数
          const combinedScore = (result.similarity * 0.7) + (relevanceScore * 0.3);
          
          return {
            ...result,
            similarity: combinedScore,
            originalRank: index
          };
        })
      );

      // 重新排序
      rerankedResults.sort((a, b) => b.similarity - a.similarity);

      console.log(`[EnhancedRAGService] 重排序完成`);

      return rerankedResults;

    } catch (error) {
      console.warn('[EnhancedRAGService] 重排序失败，使用原始排序:', error);
      return results;
    }
  }

  /**
   * 第五阶段：后处理
   */
  private postProcessResults(
    results: KnowledgeSearchResult[],
    threshold: number,
    limit: number
  ): KnowledgeSearchResult[] {
    console.log(`[EnhancedRAGService] 后处理前: ${results.length}个结果, 阈值: ${threshold}`);

    // 如果阈值过高导致没有结果，动态降低阈值
    let adjustedThreshold = threshold;
    let filteredResults = results.filter(result => result.similarity >= adjustedThreshold);

    if (filteredResults.length === 0 && results.length > 0) {
      // 找到最高分数的一半作为新阈值
      const maxScore = Math.max(...results.map(r => r.similarity));
      adjustedThreshold = Math.max(0.1, maxScore * 0.5);
      filteredResults = results.filter(result => result.similarity >= adjustedThreshold);
      console.log(`[EnhancedRAGService] 动态调整阈值: ${threshold} → ${adjustedThreshold}, 结果: ${filteredResults.length}个`);
    }

    const finalResults = filteredResults
      .slice(0, limit)
      .map(result => ({
        ...result,
        // 标准化相似度分数到0-1范围
        similarity: Math.min(1, Math.max(0, result.similarity))
      }));

    console.log(`[EnhancedRAGService] 后处理完成: ${finalResults.length}个结果`);
    return finalResults;
  }

  /**
   * 回退到简单搜索
   */
  private async fallbackSimpleSearch(params: {
    knowledgeBaseId: string;
    query: string;
    threshold?: number;
    limit?: number;
  }): Promise<KnowledgeSearchResult[]> {
    console.log('[EnhancedRAGService] 使用回退简单搜索');

    try {
      const knowledgeBase = await dexieStorage.knowledge_bases.get(params.knowledgeBaseId);
      if (!knowledgeBase) {
        console.log('[EnhancedRAGService] 回退搜索 - 知识库不存在');
        return [];
      }

      const documents = await dexieStorage.knowledge_documents
        .where('knowledgeBaseId')
        .equals(params.knowledgeBaseId)
        .toArray();

      console.log(`[EnhancedRAGService] 回退搜索 - 找到 ${documents.length} 个文档`);

      if (documents.length === 0) {
        return [];
      }

      // 先尝试简单的关键词匹配
      const keywordResults = documents.filter(doc =>
        doc.content.toLowerCase().includes(params.query.toLowerCase())
      );

      console.log(`[EnhancedRAGService] 回退搜索 - 关键词匹配: ${keywordResults.length} 个结果`);

      if (keywordResults.length > 0) {
        // 如果有关键词匹配，直接返回
        return keywordResults.slice(0, params.limit || knowledgeBase.documentCount || 5).map(doc => ({
          documentId: doc.id,
          content: doc.content,
          similarity: 1.0, // 关键词完全匹配给高分
          metadata: doc.metadata
        }));
      }

      // 如果关键词匹配失败，尝试向量搜索
      const queryVector = await this.embeddingService.getEmbedding(params.query, knowledgeBase.model);
      const threshold = params.threshold || 0.3; // 降低阈值
      const limit = params.limit || knowledgeBase.documentCount || 5; // 使用知识库配置的文档数量

      const vectorResults = documents
        .map(doc => ({
          documentId: doc.id,
          content: doc.content,
          similarity: this.cosineSimilarity(queryVector, doc.vector),
          metadata: doc.metadata
        }))
        .filter(result => result.similarity >= threshold)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);

      console.log(`[EnhancedRAGService] 回退搜索 - 向量搜索结果: ${vectorResults.length} 个`);

      return vectorResults;

    } catch (error) {
      console.error('[EnhancedRAGService] 回退搜索也失败:', error);
      return [];
    }
  }

  // 辅助方法
  private decomposeQuery(query: string): string[] {
    const decomposed: string[] = [];

    // 添加安全检查
    if (!query || typeof query !== 'string') {
      return decomposed;
    }

    // 按连接词分解
    if (query.includes(' and ') || query.includes(' 和 ')) {
      const parts = query.split(/\s+(?:and|和)\s+/i);
      decomposed.push(...parts.map(p => p.trim()));
    }

    // 按逗号分解
    if (query.includes(',') || query.includes('，')) {
      const parts = query.split(/[,，]/);
      decomposed.push(...parts.map(p => p.trim()));
    }

    return decomposed.filter(q => q.length > 0);
  }

  private async generateSynonyms(query: string): Promise<string[]> {
    // 简化的同义词生成（实际应用中可以使用词典或AI服务）
    const synonymMap: { [key: string]: string[] } = {
      '问题': ['疑问', '困惑', '难题'],
      '方法': ['方式', '途径', '手段'],
      '解决': ['处理', '解答', '应对'],
      '如何': ['怎样', '怎么', '如何才能'],
      '什么': ['啥', '什么是', '何为']
    };

    const synonyms: string[] = [];
    for (const [word, syns] of Object.entries(synonymMap)) {
      if (query.includes(word)) {
        synonyms.push(...syns);
      }
    }

    return synonyms;
  }

  private async extractRelatedTerms(query: string, knowledgeBase: KnowledgeBase): Promise<string[]> {
    // 从知识库中提取相关术语（简化实现）
    const relatedTerms: string[] = [];
    
    try {
      // 获取一些文档样本来提取相关术语
      const sampleDocs = await dexieStorage.knowledge_documents
        .where('knowledgeBaseId')
        .equals(knowledgeBase.id)
        .limit(10)
        .toArray();

      const queryWords = query.toLowerCase().split(/\s+/);
      
      for (const doc of sampleDocs) {
        const docWords = doc.content.toLowerCase().split(/\s+/);
        for (const word of docWords) {
          if (word.length > 3 && !queryWords.includes(word) && !relatedTerms.includes(word)) {
            // 简单的相关性检查
            if (queryWords.some(qw => word.includes(qw) || qw.includes(word))) {
              relatedTerms.push(word);
              if (relatedTerms.length >= 5) break;
            }
          }
        }
        if (relatedTerms.length >= 5) break;
      }
    } catch (error) {
      console.warn('[EnhancedRAGService] 提取相关术语失败:', error);
    }

    return relatedTerms;
  }

  private generateExpandedQueries(query: string, synonyms: string[], relatedTerms: string[]): string[] {
    const expanded: string[] = [];

    // 减少扩展查询数量以提高性能
    // 同义词替换 - 只取1个
    if (synonyms.length > 0) {
      expanded.push(query.replace(/\S+/, synonyms[0]));
    }

    // 添加相关术语 - 只取1个
    if (relatedTerms.length > 0) {
      expanded.push(`${query} ${relatedTerms[0]}`);
    }

    return expanded;
  }

  private deduplicateByDocument(results: Array<{ doc: KnowledgeDocument; score: number }>): Array<{ doc: KnowledgeDocument; score: number }> {
    const docMap = new Map<string, { doc: KnowledgeDocument; score: number }>();
    
    for (const result of results) {
      const existing = docMap.get(result.doc.id);
      if (!existing || result.score > existing.score) {
        docMap.set(result.doc.id, result);
      }
    }
    
    return Array.from(docMap.values());
  }

  private calculateDiversityBonus(
    document: KnowledgeDocument,
    existingResults: KnowledgeSearchResult[],
    threshold: number
  ): number {
    if (existingResults.length === 0) return 1;

    // 计算与已有结果的相似度
    let maxSimilarity = 0;
    for (const existing of existingResults) {
      const similarity = this.textSimilarity(document.content, existing.content);
      maxSimilarity = Math.max(maxSimilarity, similarity);
    }

    // 如果相似度低于阈值，给予多样性奖励
    return maxSimilarity < threshold ? 1 : 0;
  }

  private async calculateRelevanceScore(query: string, content: string, _knowledgeBase: KnowledgeBase): Promise<number> {
    try {
      // 简化的相关性计算
      const queryWords = query.toLowerCase().split(/\s+/);
      const contentWords = content.toLowerCase().split(/\s+/);
      
      let matches = 0;
      for (const qWord of queryWords) {
        if (contentWords.some(cWord => cWord.includes(qWord) || qWord.includes(cWord))) {
          matches++;
        }
      }
      
      return matches / queryWords.length;
    } catch (error) {
      console.warn('[EnhancedRAGService] 计算相关性分数失败:', error);
      return 0.5; // 默认中等相关性
    }
  }

  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) return 0;

    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      magnitudeA += vecA[i] * vecA[i];
      magnitudeB += vecB[i] * vecB[i];
    }

    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);

    if (magnitudeA === 0 || magnitudeB === 0) return 0;

    return dotProduct / (magnitudeA * magnitudeB);
  }

  private textSimilarity(text1: string, text2: string): number {
    // 简化的文本相似度计算（基于词汇重叠）
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }
}
