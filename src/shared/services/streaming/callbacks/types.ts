/**
 * 回调系统类型定义
 * 完全参考 Cherry Studio callbacks 设计
 */

import type { MessageBlock, AssistantMessageStatus, MessageBlockType } from '../../../types/newMessage';
import type { AppDispatch, RootState } from '../../../store';

/**
 * MCP 工具类型
 * 与 types/index.ts 中的 MCPTool 保持一致
 */
export interface MCPTool {
  id?: string;
  name: string;
  description?: string;
  inputSchema?: unknown;
  serverId?: string;
  serverName?: string;  // 服务器名称（必需以兼容主类型定义）
  type?: 'builtin' | 'provider' | 'mcp';
  isBuiltIn?: boolean;  // 是否为内置工具
}

/**
 * MCP 工具响应类型
 * 与 types/index.ts 中的 MCPToolResponse 保持一致
 */
export interface MCPToolResponse {
  id: string;
  tool: MCPTool;
  arguments: Record<string, any>;
  status: 'pending' | 'invoking' | 'done' | 'error' | 'cancelled';  // 添加 'invoking' 状态
  response?: any;
  toolCallId?: string;
  toolUseId?: string;  // Anthropic 兼容
}

/**
 * 助手配置
 */
export interface Assistant {
  id: string;
  name?: string;
  prompt?: string;
  model?: any;
  settings?: {
    temperature?: number;
    topP?: number;
    maxTokens?: number;
    streamOutput?: boolean;
  };
}

/**
 * 块管理器接口
 * 完全参考 Cherry Studio BlockManager 设计
 */
export interface IBlockManager {
  /** 当前活跃块信息 */
  activeBlockInfo: { id: string; type: MessageBlockType } | null;
  /** 最后的块类型 */
  lastBlockType: MessageBlockType | null;
  /** 初始占位符块 ID */
  initialPlaceholderBlockId: string | null;
  /** 是否有初始占位符 */
  hasInitialPlaceholder: boolean;
  /** 智能更新块 */
  smartBlockUpdate(
    blockId: string,
    changes: Partial<MessageBlock>,
    blockType: MessageBlockType,
    isComplete?: boolean
  ): void;
  /** 处理块转换（创建新块） */
  handleBlockTransition(newBlock: MessageBlock, newBlockType: MessageBlockType): Promise<void>;
}

/**
 * 回调依赖注入接口
 */
export interface CallbackDependencies {
  /** Redux dispatch */
  dispatch: AppDispatch;
  /** 获取 Redux 状态 */
  getState: () => RootState;
  /** 消息 ID */
  messageId: string;
  /** 主题 ID */
  topicId: string;
  /** 块管理器 */
  blockManager: IBlockManager;
  /** 助手配置 */
  assistant?: Assistant;
  /** MCP 工具列表 */
  mcpTools?: MCPTool[];
  /** 保存更新到数据库 */
  saveUpdatesToDB: (
    messageId: string,
    topicId: string,
    messageUpdates: any,
    blocksToUpdate: MessageBlock[]
  ) => Promise<void>;
}

/**
 * 流处理器回调接口
 * 定义所有可能的回调方法
 */
export interface StreamProcessorCallbacks {
  // ===== 生命周期回调 =====
  /** LLM 响应创建 */
  onLLMResponseCreated?: () => void | Promise<void>;
  /** LLM 响应完成 */
  onLLMResponseComplete?: (response?: any) => void | Promise<void>;
  /** 处理完成 */
  onComplete?: (status: AssistantMessageStatus | string, response?: any) => void | Promise<void>;
  /** 错误处理 */
  onError?: (error: any) => void | Promise<void>;

  // ===== 文本回调 =====
  /** 文本开始 */
  onTextStart?: () => void | Promise<void>;
  /** 文本增量 */
  onTextChunk?: (text: string) => void | Promise<void>;
  /** 文本完成 */
  onTextComplete?: (text: string) => void | Promise<void>;

  // ===== 思考链回调 =====
  /** 思考开始 */
  onThinkingStart?: () => void | Promise<void>;
  /** 思考增量 */
  onThinkingChunk?: (text: string, thinkingMillsec?: number) => void | Promise<void>;
  /** 思考完成 */
  onThinkingComplete?: (text: string, thinkingMillsec?: number) => void | Promise<void>;

  // ===== 工具回调 =====
  /** 工具调用等待 */
  onToolCallPending?: (toolResponse: any) => void | Promise<void>;
  /** 工具调用进行中 */
  onToolCallInProgress?: (toolResponse: any) => void | Promise<void>;
  /** 工具调用完成 */
  onToolCallComplete?: (toolResponse: any) => void | Promise<void>;

  // ===== 图像回调 =====
  /** 图像创建 */
  onImageCreated?: () => void | Promise<void>;
  /** 图像增量 */
  onImageDelta?: (imageData: any) => void | Promise<void>;
  /** 图像生成完成 */
  onImageComplete?: (imageData?: any) => void | Promise<void>;

  // ===== 知识库搜索回调 =====
  /** 知识库搜索进行中 */
  onKnowledgeSearchInProgress?: (query?: string) => void | Promise<void>;
  /** 知识库搜索完成 */
  onKnowledgeSearchComplete?: (references: KnowledgeReference[]) => void | Promise<void>;

  // ===== 引用回调 =====
  /** 引用增量 */
  onCitationDelta?: (citations: Citation[]) => void | Promise<void>;
  /** 引用完成 */
  onCitationComplete?: (citations: Citation[]) => void | Promise<void>;

  // ===== 搜索结果回调 =====
  /** 视频搜索结果 */
  onVideoSearched?: (videos: VideoSearchResult[]) => void | Promise<void>;
  /** 图像搜索结果 */
  onImageSearched?: (images: ImageSearchResult[]) => void | Promise<void>;

  // ===== 其他回调 =====
  /** 块创建 */
  onBlockCreated?: () => void | Promise<void>;
  /** 块完成 */
  onBlockComplete?: (response?: any) => void | Promise<void>;
  /** 原始数据 */
  onRawData?: (content: unknown, metadata?: Record<string, any>) => void | Promise<void>;
  
  // ===== 清理 =====
  /** 清理资源 */
  cleanup?: () => void;
}

/**
 * 知识库引用
 */
export interface KnowledgeReference {
  id: string;
  content: string;
  source: string;
  similarity: number;
  metadata?: Record<string, any>;
}

/**
 * 引用
 */
export interface Citation {
  index: number;
  url: string;
  title?: string;
  snippet?: string;
}

/**
 * 视频搜索结果
 */
export interface VideoSearchResult {
  id: string;
  title: string;
  url: string;
  thumbnail?: string;
  duration?: number;
}

/**
 * 图像搜索结果
 */
export interface ImageSearchResult {
  id: string;
  url: string;
  alt?: string;
  source?: string;
}
