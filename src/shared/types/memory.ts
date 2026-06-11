/**
 * 记忆系统类型定义
 * 基于 Cherry Studio 设计，预留扩展接口
 * 
 * @description 支持从对话中自动提取用户偏好和事实，并进行语义检索
 */

import type { Model } from './index';

// ========================================================================
// 核心记忆类型
// ========================================================================

/**
 * 记忆项 - 存储单条记忆
 */
export interface MemoryItem {
  /** 唯一标识符 */
  id: string;
  /** 记忆内容 */
  memory: string;
  /** 内容哈希（用于去重） */
  hash?: string;
  /** 向量嵌入（用于语义检索） */
  embedding?: number[];
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt?: string;
  /** 相似度分数（仅在搜索结果中） */
  score?: number;
  /** 元数据 */
  metadata?: MemoryMetadata;
  /** 用户ID（多用户隔离） */
  userId?: string;
  /** 助手ID（可选，用于助手级别的记忆） */
  assistantId?: string;
  /** 是否已删除（软删除） */
  isDeleted?: boolean;
}

/**
 * 记忆元数据
 */
export interface MemoryMetadata {
  /** 来源类型 */
  source?: 'auto' | 'manual';
  /** 记忆类别 */
  category?: MemoryCategory;
  /** 置信度（0-1） */
  confidence?: number;
  /** 关联的话题ID */
  topicId?: string;
  /** 关联的消息ID */
  messageId?: string;
  /** 自定义标签 */
  tags?: string[];
  /** 其他自定义数据 */
  [key: string]: any;
}

/**
 * 记忆类别 - 用于分类不同类型的记忆
 * 预留扩展，方便后续添加新类别
 */
export type MemoryCategory = 
  | 'preference'      // 用户偏好
  | 'personal'        // 个人信息
  | 'plan'            // 计划/意图
  | 'activity'        // 活动偏好
  | 'health'          // 健康信息
  | 'professional'    // 职业信息
  | 'misc'            // 其他
  | string;           // 允许自定义类别

// ========================================================================
// 记忆历史类型
// ========================================================================

/**
 * 记忆历史项 - 追踪记忆的变更
 */
export interface MemoryHistoryItem {
  id: number;
  memoryId: string;
  previousValue?: string;
  newValue?: string;
  action: MemoryAction;
  createdAt: string;
  updatedAt?: string;
  isDeleted?: boolean;
}

/**
 * 记忆操作类型
 */
export type MemoryAction = 'ADD' | 'UPDATE' | 'DELETE' | 'NONE';

// ========================================================================
// 记忆配置类型
// ========================================================================

/**
 * 记忆系统配置
 */
export interface MemoryConfig {
  /** 嵌入向量维度 */
  embeddingDimensions?: number;
  /** 嵌入模型 */
  embeddingModel?: Model;
  /** LLM 模型（用于事实提取和更新决策） */
  llmModel?: Model;
  /** 自定义事实提取提示词 */
  customFactExtractionPrompt?: string;
  /** 自定义记忆更新提示词 */
  customUpdateMemoryPrompt?: string;
  /** 是否自动检测维度 */
  isAutoDimensions?: boolean;
  /** 相似度阈值（用于去重，默认 0.85） */
  similarityThreshold?: number;
  /** 默认检索数量 */
  defaultSearchLimit?: number;
  
  // ========== 记忆方式控制 ==========
  /** 
   * 启用自动分析记忆（每次对话后 LLM 分析提取事实）
   * 优点：自动提取，无需 AI 主动调用
   * 缺点：每次对话都会额外调用 LLM，增加成本
   */
  autoAnalyzeEnabled?: boolean;
  /**
   * 启用记忆工具（AI 通过工具调用自己决定何时记忆）
   * 优点：AI 自主判断，只在需要时记忆，节省成本
   * 缺点：需要模型支持工具调用
   */
  memoryToolEnabled?: boolean;

  // ========== 记忆维护（Dream 自维护） ==========
  /** 软删除保留天数，超过后由维护任务物理清除（默认 30） */
  maintenanceRetentionDays?: number;
  /** 上次维护完成时间（ISO 字符串） */
  lastMaintenanceAt?: string;
  /** 是否开启自动维护（应用启动后空闲触发） */
  autoMaintenanceEnabled?: boolean;
  /** 自动维护间隔天数（默认 7） */
  maintenanceIntervalDays?: number;
}

/**
 * 记忆状态（Redux Store）
 */
export interface MemoryState {
  /** 当前记忆配置 */
  memoryConfig: MemoryConfig;
  /** 当前助手ID（记忆按助手隔离） */
  currentAssistantId: string;
  /** 全局记忆开关 */
  globalMemoryEnabled: boolean;
  /** 是否正在加载 */
  isLoading: boolean;
  /** 错误信息 */
  error?: string;
}

// ========================================================================
// 记忆操作选项类型
// ========================================================================

/**
 * 记忆实体信息
 */
export interface MemoryEntity {
  userId?: string;
  assistantId?: string;
  runId?: string;
}

/**
 * 添加记忆选项
 */
export interface AddMemoryOptions extends MemoryEntity {
  metadata?: MemoryMetadata;
  /** 过滤条件 */
  filters?: MemorySearchFilters;
  /** 是否使用LLM推理 */
  infer?: boolean;
}

/**
 * 搜索记忆选项
 */
export interface MemorySearchOptions extends MemoryEntity {
  /** 最大返回数量 */
  limit?: number;
  /** 相似度阈值 */
  threshold?: number;
  /** 过滤条件 */
  filters?: MemorySearchFilters;
}

/**
 * 列表记忆选项
 */
export interface MemoryListOptions extends MemoryEntity {
  limit?: number;
  offset?: number;
}

/**
 * 搜索过滤条件
 */
export interface MemorySearchFilters {
  userId?: string;
  assistantId?: string;
  runId?: string;
  category?: MemoryCategory;
  tags?: string[];
  startDate?: string;
  endDate?: string;
  [key: string]: any;
}

// ========================================================================
// 记忆搜索结果类型
// ========================================================================

/**
 * 记忆搜索结果
 */
export interface MemorySearchResult {
  /** 搜索到的记忆列表 */
  memories: MemoryItem[];
  /** 结果总数 */
  count: number;
  /** 错误信息 */
  error?: string;
}

// ========================================================================
// 事实提取类型（用于LLM处理）
// ========================================================================

/**
 * 提取的事实
 */
export interface ExtractedFact {
  /** 事实内容 */
  content: string;
  /** 置信度 */
  confidence?: number;
  /** 类别 */
  category?: MemoryCategory;
}

/**
 * 事实提取结果
 */
export interface FactExtractionResult {
  facts: string[];
}

/**
 * 记忆更新操作
 */
export interface MemoryUpdateOperation {
  id: string;
  text: string;
  event: MemoryAction;
  old_memory?: string;
}

// ========================================================================
// 扩展接口预留（用于后续 VCPToolBox 功能）
// ========================================================================

/**
 * 高级搜索选项（预留）
 * 用于后续支持 BM25 + 向量混合检索、时间感知等
 */
export interface AdvancedSearchOptions extends MemorySearchOptions {
  /** 搜索模式 */
  searchMode?: 'vector' | 'keyword' | 'hybrid';
  /** BM25 权重（hybrid 模式） */
  bm25Weight?: number;
  /** 向量权重（hybrid 模式） */
  vectorWeight?: number;
  /** 是否启用时间感知 */
  timeAware?: boolean;
  /** 时间表达式（如"上周"、"三个月前"） */
  timeExpression?: string;
  /** 是否启用 Rerank */
  enableRerank?: boolean;
  /** Rerank 模型 */
  rerankModel?: Model;
}

/**
 * 语义组配置（预留）
 * 用于后续支持词元组捕网系统
 */
export interface SemanticGroup {
  id: string;
  name: string;
  keywords: string[];
  vector?: number[];
  weight?: number;
}

// ========================================================================
// 默认值
// ========================================================================

export const DEFAULT_USER_ID = 'default-user';

export const DEFAULT_MEMORY_CONFIG: MemoryConfig = {
  embeddingDimensions: undefined,
  isAutoDimensions: true,
  similarityThreshold: 0.85,
  defaultSearchLimit: 10,
};

export const DEFAULT_MEMORY_STATE: MemoryState = {
  memoryConfig: DEFAULT_MEMORY_CONFIG,
  currentAssistantId: 'default',
  globalMemoryEnabled: false,
  isLoading: false,
};
