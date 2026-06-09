/**
 * 数据库配置
 * 从 DatabaseSchema.ts 迁移过来，统一管理数据库配置
 */

import type { DBSchema } from 'idb';
import type { Assistant } from '../types/Assistant';
import type { ChatTopic } from '../types';
import type { Message, MessageBlock } from '../types/newMessage';

// Memory 类型定义 - 支持知识图谱和长期记忆两种模式
export interface Memory {
  id: string;
  
  // ========== 长期记忆系统字段（基于 Cherry Studio） ==========
  /** 记忆内容 */
  memory?: string;
  /** 内容哈希（用于去重） */
  hash?: string;
  /** 向量嵌入（用于语义检索） */
  embedding?: number[];
  /** 生成该向量的嵌入模型 ID（跨模型向量不可比，检索时按模型隔离） */
  embeddingModelId?: string;
  /** 用户ID（多用户隔离） */
  userId?: string;
  /** 助手ID（可选） */
  assistantId?: string;
  /** 是否已删除（软删除） */
  isDeleted?: boolean;
  /** 相似度分数（仅在搜索结果中） */
  score?: number;
  
  // ========== 知识图谱字段（保持向后兼容） ==========
  /** 类型：entity=实体, relation=关系, memory=长期记忆 */
  type?: 'entity' | 'relation' | 'memory';
  data?: {
    // 实体数据
    name?: string;
    entityType?: string;
    observations?: string[];
    // 关系数据
    from?: string;
    to?: string;
    relationType?: string;
  };
  
  // ========== 通用字段 ==========
  createdAt: string;
  updatedAt?: string;
  metadata?: Record<string, any>;
}

// 统一的数据库配置
export const DB_CONFIG = {
  NAME: 'aetherlink-db-new',
  VERSION: 9, // 当前数据库版本
  STORES: {
    TOPICS: 'topics' as const,
    ASSISTANTS: 'assistants' as const,
    SETTINGS: 'settings' as const,
    IMAGES: 'images' as const,
    IMAGE_METADATA: 'imageMetadata' as const,
    METADATA: 'metadata' as const,
    MESSAGE_BLOCKS: 'message_blocks' as const,
    MESSAGES: 'messages' as const,
    MEMORIES: 'memories' as const,
    FILES: 'files' as const,
    KNOWLEDGE_BASES: 'knowledge_bases' as const,
    KNOWLEDGE_DOCUMENTS: 'knowledge_documents' as const,
    QUICK_PHRASES: 'quick_phrases' as const,
    SKILLS: 'skills' as const
  }
};

// 数据库版本配置
export const VERSION_CONFIGS = {
  4: {
    stores: {
      [DB_CONFIG.STORES.ASSISTANTS]: 'id',
      [DB_CONFIG.STORES.TOPICS]: 'id, _lastMessageTimeNum',
      [DB_CONFIG.STORES.SETTINGS]: 'id',
      [DB_CONFIG.STORES.IMAGES]: 'id',
      [DB_CONFIG.STORES.IMAGE_METADATA]: 'id, topicId, created',
      [DB_CONFIG.STORES.METADATA]: 'id',
      [DB_CONFIG.STORES.MESSAGE_BLOCKS]: 'id, messageId',
      [DB_CONFIG.STORES.MESSAGES]: 'id, topicId, assistantId',
    },
    description: '规范化消息存储：将消息从topics.messages数组移动到独立的messages表'
  },
  5: {
    stores: {
      [DB_CONFIG.STORES.ASSISTANTS]: 'id',
      [DB_CONFIG.STORES.TOPICS]: 'id, _lastMessageTimeNum, messages',
      [DB_CONFIG.STORES.SETTINGS]: 'id',
      [DB_CONFIG.STORES.IMAGES]: 'id',
      [DB_CONFIG.STORES.IMAGE_METADATA]: 'id, topicId, created',
      [DB_CONFIG.STORES.METADATA]: 'id',
      [DB_CONFIG.STORES.MESSAGE_BLOCKS]: 'id, messageId',
      [DB_CONFIG.STORES.MESSAGES]: 'id, topicId, assistantId',
    },
    description: '将消息直接存储在topics表中：从独立的messages表回到topics.messages数组'
  },
  6: {
    stores: {
      [DB_CONFIG.STORES.ASSISTANTS]: 'id',
      [DB_CONFIG.STORES.TOPICS]: 'id, _lastMessageTimeNum, messages',
      [DB_CONFIG.STORES.SETTINGS]: 'id',
      [DB_CONFIG.STORES.IMAGES]: 'id',
      [DB_CONFIG.STORES.IMAGE_METADATA]: 'id, topicId, created',
      [DB_CONFIG.STORES.METADATA]: 'id',
      [DB_CONFIG.STORES.MESSAGE_BLOCKS]: 'id, messageId',
      [DB_CONFIG.STORES.MESSAGES]: 'id, topicId, assistantId',
      [DB_CONFIG.STORES.FILES]: 'id, name, origin_name, size, ext, type, created_at, count, hash',
      [DB_CONFIG.STORES.KNOWLEDGE_BASES]: 'id, name, model, dimensions, created_at, updated_at',
      [DB_CONFIG.STORES.KNOWLEDGE_DOCUMENTS]: 'id, knowledgeBaseId, content, metadata.source, metadata.timestamp',
      [DB_CONFIG.STORES.QUICK_PHRASES]: 'id, title, content, createdAt, updatedAt, order',
    },
    description: '添加文件存储表、知识库相关表和快捷短语表'
  },
  7: {
    stores: {
      [DB_CONFIG.STORES.ASSISTANTS]: 'id',
      [DB_CONFIG.STORES.TOPICS]: 'id, _lastMessageTimeNum, messages',
      [DB_CONFIG.STORES.SETTINGS]: 'id',
      [DB_CONFIG.STORES.IMAGES]: 'id',
      [DB_CONFIG.STORES.IMAGE_METADATA]: 'id, topicId, created',
      [DB_CONFIG.STORES.METADATA]: 'id',
      [DB_CONFIG.STORES.MESSAGE_BLOCKS]: 'id, messageId',
      [DB_CONFIG.STORES.MESSAGES]: 'id, topicId, assistantId',
      [DB_CONFIG.STORES.FILES]: 'id, name, origin_name, size, ext, type, created_at, count, hash',
      [DB_CONFIG.STORES.KNOWLEDGE_BASES]: 'id, name, model, dimensions, created_at, updated_at',
      [DB_CONFIG.STORES.KNOWLEDGE_DOCUMENTS]: 'id, knowledgeBaseId, content, metadata.source, metadata.timestamp',
      [DB_CONFIG.STORES.QUICK_PHRASES]: 'id, title, content, createdAt, updatedAt, order',
      [DB_CONFIG.STORES.MEMORIES]: 'id, type, createdAt, updatedAt',
    },
    description: '添加memories表用于存储知识图谱数据'
  },
  8: {
    stores: {
      [DB_CONFIG.STORES.ASSISTANTS]: 'id',
      [DB_CONFIG.STORES.TOPICS]: 'id, _lastMessageTimeNum, messages',
      [DB_CONFIG.STORES.SETTINGS]: 'id',
      [DB_CONFIG.STORES.IMAGES]: 'id',
      [DB_CONFIG.STORES.IMAGE_METADATA]: 'id, topicId, created',
      [DB_CONFIG.STORES.METADATA]: 'id',
      [DB_CONFIG.STORES.MESSAGE_BLOCKS]: 'id, messageId',
      [DB_CONFIG.STORES.MESSAGES]: 'id, topicId, assistantId',
      [DB_CONFIG.STORES.FILES]: 'id, name, origin_name, size, ext, type, created_at, count, hash',
      [DB_CONFIG.STORES.KNOWLEDGE_BASES]: 'id, name, model, dimensions, created_at, updated_at',
      [DB_CONFIG.STORES.KNOWLEDGE_DOCUMENTS]: 'id, knowledgeBaseId, content, metadata.source, metadata.timestamp',
      [DB_CONFIG.STORES.QUICK_PHRASES]: 'id, title, content, createdAt, updatedAt, order',
      [DB_CONFIG.STORES.MEMORIES]: 'id, type, userId, hash, createdAt, updatedAt, isDeleted',
    },
    description: '扩展memories表支持长期记忆系统（Cherry Studio风格）'
  },
  9: {
    stores: {
      [DB_CONFIG.STORES.ASSISTANTS]: 'id',
      [DB_CONFIG.STORES.TOPICS]: 'id, _lastMessageTimeNum, messages',
      [DB_CONFIG.STORES.SETTINGS]: 'id',
      [DB_CONFIG.STORES.IMAGES]: 'id',
      [DB_CONFIG.STORES.IMAGE_METADATA]: 'id, topicId, created',
      [DB_CONFIG.STORES.METADATA]: 'id',
      [DB_CONFIG.STORES.MESSAGE_BLOCKS]: 'id, messageId',
      [DB_CONFIG.STORES.MESSAGES]: 'id, topicId, assistantId',
      [DB_CONFIG.STORES.FILES]: 'id, name, origin_name, size, ext, type, created_at, count, hash',
      [DB_CONFIG.STORES.KNOWLEDGE_BASES]: 'id, name, model, dimensions, created_at, updated_at',
      [DB_CONFIG.STORES.KNOWLEDGE_DOCUMENTS]: 'id, knowledgeBaseId, content, metadata.source, metadata.timestamp',
      [DB_CONFIG.STORES.QUICK_PHRASES]: 'id, title, content, createdAt, updatedAt, order',
      [DB_CONFIG.STORES.MEMORIES]: 'id, type, userId, hash, createdAt, updatedAt, isDeleted',
      [DB_CONFIG.STORES.SKILLS]: 'id, name, source, enabled, updatedAt',
    },
    description: '添加skills表用于存储技能系统数据'
  }
};

// 图片元数据类型
export interface ImageMetadata {
  id: string;
  topicId: string;
  created: number;
  size?: number;
  type?: string;
  name?: string;
}

// 定义数据库架构
export interface AetherLinkDB extends DBSchema {
  assistants: {
    key: string;
    value: Assistant;
    indexes: {
      'by-system': string;
    };
  };

  topics: {
    key: string;
    value: ChatTopic; // 统一架构：topics 只存储 messageIds 引用，消息存储在 messages 表
    indexes: {
      'by-assistant': string;
      'by-last-time': number;
    };
  };

  messages: {
    key: string;
    value: Message;
    indexes: {
      'by-topic': string;
      'by-assistant': string;
    };
  };

  message_blocks: {
    key: string;
    value: MessageBlock;
    indexes: {
      'by-message': string;
    };
  };

  images: {
    key: string;
    value: Blob;
  };

  imageMetadata: {
    key: string;
    value: ImageMetadata;
    indexes: {
      'by-topic': string;
      'by-time': number;
    };
  };

  settings: {
    key: string;
    value: any;
  };

  metadata: {
    key: string;
    value: any;
  };

  files: {
    key: string;
    value: any;
    indexes: {
      'by-type': string;
      'by-created': string;
    };
  };

  knowledge_bases: {
    key: string;
    value: any;
    indexes: {
      'by-created': string;
    };
  };

  knowledge_documents: {
    key: string;
    value: any;
    indexes: {
      'by-knowledge-base': string;
      'by-timestamp': number;
    };
  };

  quick_phrases: {
    key: string;
    value: any;
    indexes: {
      'by-order': number;
      'by-created': string;
    };
  };

  memories: {
    key: string;
    value: Memory;
    indexes: {
      'by-type': string;
      'by-created': string;
      'by-user': string;
      'by-hash': string;
    };
  };
}
