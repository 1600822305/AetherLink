/**
 * 嵌入模型配置
 * 参考的嵌入模型配置
 */

export interface EmbeddingModelConfig {
  id: string;
  name: string;
  dimensions: number;
  maxContext: number;
  provider?: string;
}

// 常用嵌入模型配置
export const EMBEDDING_MODELS: EmbeddingModelConfig[] = [
  // OpenAI 模型
  {
    id: 'text-embedding-3-small',
    name: 'Text Embedding 3 Small',
    dimensions: 1536,
    maxContext: 8191,
    provider: 'openai'
  },
  {
    id: 'text-embedding-3-large',
    name: 'Text Embedding 3 Large',
    dimensions: 3072,
    maxContext: 8191,
    provider: 'openai'
  },
  {
    id: 'text-embedding-ada-002',
    name: 'Text Embedding Ada 002',
    dimensions: 1536,
    maxContext: 8191,
    provider: 'openai'
  },
  
  // 豆包模型
  {
    id: 'Doubao-embedding',
    name: 'Doubao Embedding',
    dimensions: 1024,
    maxContext: 4095,
    provider: 'doubao'
  },
  {
    id: 'Doubao-embedding-large',
    name: 'Doubao Embedding Large',
    dimensions: 1536,
    maxContext: 4095,
    provider: 'doubao'
  },
  
  // BGE 模型
  {
    id: 'BAAI/bge-large-zh-v1.5',
    name: 'BGE Large Chinese v1.5',
    dimensions: 1024,
    maxContext: 512,
    provider: 'huggingface'
  },
  {
    id: 'BAAI/bge-large-en-v1.5',
    name: 'BGE Large English v1.5',
    dimensions: 1024,
    maxContext: 512,
    provider: 'huggingface'
  },
  {
    id: 'BAAI/bge-m3',
    name: 'BGE M3 Multilingual',
    dimensions: 1024,
    maxContext: 8191,
    provider: 'huggingface'
  },
  
  // Jina 模型
  {
    id: 'jina-embeddings-v2-base-zh',
    name: 'Jina Embeddings v2 Chinese',
    dimensions: 768,
    maxContext: 8191,
    provider: 'jina'
  },
  {
    id: 'jina-embeddings-v2-base-en',
    name: 'Jina Embeddings v2 English',
    dimensions: 768,
    maxContext: 8191,
    provider: 'jina'
  },
  {
    id: 'jina-embeddings-v3',
    name: 'Jina Embeddings v3',
    dimensions: 1024,
    maxContext: 8191,
    provider: 'jina'
  },
  
  // 其他常用模型
  {
    id: 'text-embedding-v2',
    name: 'Text Embedding v2',
    dimensions: 1024,
    maxContext: 2048,
    provider: 'generic'
  },
  {
    id: 'embedding-2',
    name: 'Embedding 2',
    dimensions: 1536,
    maxContext: 1024,
    provider: 'generic'
  },
  {
    id: 'hunyuan-embedding',
    name: 'Hunyuan Embedding',
    dimensions: 1024,
    maxContext: 1024,
    provider: 'tencent'
  }
];

/**
 * 根据模型ID获取嵌入模型配置
 */
export function getEmbeddingModelConfig(modelId: string): EmbeddingModelConfig | undefined {
  return EMBEDDING_MODELS.find(model => model.id === modelId);
}

/**
 * 获取模型的维度
 */
export function getEmbeddingDimensions(modelId: string): number {
  const config = getEmbeddingModelConfig(modelId);
  return config?.dimensions || 1536; // 默认维度
}

/**
 * 获取模型的最大上下文长度
 */
export function getEmbeddingMaxContext(modelId: string): number {
  const config = getEmbeddingModelConfig(modelId);
  return config?.maxContext || 8191; // 默认上下文长度
}

/**
 * 检查是否为已知的嵌入模型
 */
export function isKnownEmbeddingModel(modelId: string): boolean {
  return EMBEDDING_MODELS.some(model => model.id === modelId);
}

/**
 * 嵌入模型识别正则表达式
 */
export const EMBEDDING_REGEX = /(?:^text-|embed|bge-|e5-|LLM2Vec|retrieval|uae-|gte-|jina-clip|jina-embeddings|voyage-|Doubao-embedding)/i;

/**
 * 检查模型ID是否可能是嵌入模型
 */
export function isLikelyEmbeddingModel(modelId: string): boolean {
  return EMBEDDING_REGEX.test(modelId) || isKnownEmbeddingModel(modelId);
}
