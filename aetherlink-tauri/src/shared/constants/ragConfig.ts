/**
 * RAG搜索配置常量
 */

// 默认RAG配置
export const DEFAULT_RAG_CONFIG = {
  // 查询扩展
  enableQueryExpansion: true,
  maxExpandedQueries: 5,
  synonymsLimit: 3,
  relatedTermsLimit: 3,

  // 混合搜索
  enableHybridSearch: true,
  vectorWeight: 0.6,
  keywordWeight: 0.3,
  semanticWeight: 0.1,

  // 重排序
  enableRerank: true,
  rerankThreshold: 0.5,
  maxRerankCandidates: 20,

  // 多样性控制
  enableDiversityControl: true,
  diversityThreshold: 0.8,
  maxSimilarResults: 2,

  // 性能优化
  maxCandidates: 50,
  cacheSize: 100,
  searchTimeout: 30000, // 30秒

  // 质量控制
  minRelevanceScore: 0.3,
  maxResultsPerSource: 3,
  enableContentFiltering: true
};

// RAG搜索模式
export enum RAGSearchMode {
  SIMPLE = 'simple',           // 简单向量搜索
  ENHANCED = 'enhanced',       // 增强RAG搜索
  HYBRID = 'hybrid',          // 混合搜索
  SEMANTIC = 'semantic'       // 语义搜索
}

// 搜索策略权重
export const SEARCH_STRATEGY_WEIGHTS = {
  vector: 0.6,
  keyword: 0.3,
  semantic: 0.1,
  recency: 0.05,
  diversity: 0.05
};

// 查询类型检测模式
export const QUERY_PATTERNS = {
  question: /^(什么|如何|怎么|为什么|哪里|谁|何时)/,
  definition: /^(定义|含义|意思|概念)/,
  comparison: /^(比较|对比|区别|差异)/,
  procedure: /^(步骤|流程|过程|方法)/,
  troubleshooting: /^(问题|错误|故障|解决)/
};

// 文档类型权重
export const DOCUMENT_TYPE_WEIGHTS = {
  'text/plain': 1.0,
  'text/markdown': 1.1,
  'application/pdf': 0.9,
  'text/html': 0.8,
  'application/json': 0.7
};
