/**
 * API客户端类型定义
 * 定义所有供应商客户端必须实现的接口和通用类型
 */
import type { Provider } from '../../types/provider';
import type { Chunk } from '../../types/chunk';
import type {
  SdkRequestParams,
  SdkMessageParam,
  SdkModel,
  SdkUsage,
  RequestOptions,
} from '../../types/sdk';

// ==================== MCP Types (从 shared/types 导入) ====================

/**
 * MCP工具定义
 */
export interface MCPTool {
  id?: string;
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  serverName: string;
  serverId: string;
}

/**
 * MCP工具响应
 */
export interface MCPToolResponse {
  id: string;
  tool: MCPTool;
  arguments: Record<string, unknown>;
  status: 'pending' | 'invoking' | 'done' | 'error';
  response?: MCPCallToolResponse;
  toolCallId?: string;
  toolUseId?: string;
}

/**
 * MCP工具调用响应
 */
export interface MCPCallToolResponse {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

// ==================== Model Type ====================

/**
 * 模型类型（简化版，用于客户端）
 */
export interface Model {
  id: string;
  name: string;
  provider: string;
  providerType?: string;
  apiKey?: string;
  baseUrl?: string;
  maxTokens?: number;
  temperature?: number;
  enabled?: boolean;
  capabilities?: {
    multimodal?: boolean;
    functionCalling?: boolean;
    streaming?: boolean;
  };
}

// ==================== Completions Types ====================

/**
 * Completions上下文
 * 在整个请求生命周期中传递的共享状态
 */
export interface CompletionsContext {
  /** 模型信息 */
  model: Model;
  /** 助手配置 */
  assistant: AssistantConfig;
  /** MCP工具列表 */
  mcpTools?: MCPTool[];
  /** 中断控制器 */
  abortController?: AbortController;
  /** Chunk回调 */
  onChunk?: (chunk: Chunk) => void | Promise<void>;
  /** 清理函数 */
  cleanup?: () => void;
}

/**
 * 助手配置
 */
export interface AssistantConfig {
  id?: string;
  name?: string;
  prompt?: string;
  model?: Model;
  settings?: {
    temperature?: number;
    topP?: number;
    maxTokens?: number;
    contextCount?: number;
    streamOutput?: boolean;
    enableThinking?: boolean;
    thinkingBudget?: number;
    /** 推理努力程度（对标 Cherry Studio）*/
    reasoning_effort?: 'low' | 'medium' | 'high' | 'auto';
    /** 自定义参数 */
    customParameters?: Array<{
      name: string;
      type: 'string' | 'number' | 'boolean' | 'json';
      value: unknown;
    }>;
  };
  enableWebSearch?: boolean;
  enableToolUse?: boolean;
}

/**
 * Completions参数
 */
export interface CompletionsParams {
  /** 消息列表 */
  messages: Message[];
  /** 助手配置 */
  assistant: AssistantConfig;
  /** MCP工具列表 */
  mcpTools?: MCPTool[];
  /** MCP调用模式 */
  mcpMode?: 'prompt' | 'function';
  /** 是否启用网络搜索 */
  enableWebSearch?: boolean;
  /** 是否启用工具使用 */
  enableToolUse?: boolean;
  /** 主题ID */
  topicId?: string;
  /** 调用类型 */
  callType?: 'chat' | 'translate' | 'summary' | 'test' | 'check';
  /** Chunk回调 */
  onChunk?: (chunk: Chunk) => void | Promise<void>;
  /** 消息过滤回调 */
  onFilterMessages?: (messages: Message[]) => void;
}

/**
 * 消息类型
 */
export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
  images?: Array<{
    url: string;
    base64Data?: string;
  }>;
  blocks?: string[];
  isPreset?: boolean;
}

/**
 * Completions结果
 */
export interface CompletionsResult {
  /** 响应内容 */
  content: string;
  /** 推理内容 */
  reasoning?: string;
  /** 推理时间（毫秒）*/
  reasoningTime?: number;
  /** 使用统计 */
  usage?: SdkUsage;
  /** 工具调用 */
  toolCalls?: MCPToolResponse[];
}

// ==================== Transformer Types ====================

/**
 * 请求转换器接口
 * 将内部请求格式转换为SDK特定格式
 */
export interface RequestTransformer<
  TSdkParams = SdkRequestParams,
  TMessageParam = SdkMessageParam
> {
  /**
   * 转换完整请求
   */
  transform(params: CompletionsParams): TSdkParams;

  /**
   * 转换单条消息
   */
  transformMessage(message: Message): TMessageParam;
}

/**
 * 响应块转换器接口
 * 将SDK响应块转换为统一的Chunk格式
 */
export interface ResponseChunkTransformer<TRawChunk = unknown> {
  /**
   * 转换响应块为Chunk数组
   */
  transform(rawChunk: TRawChunk): Chunk[];
}

// ==================== Image Generation Types ====================

/**
 * 图像生成参数
 * 对标 Cherry Studio GenerateImageParams
 */
export interface GenerateImageParams {
  /** 提示词 */
  prompt: string;
  /** 模型ID */
  model: string;
  /** 生成数量 */
  n?: number;
  /** 批次大小（Gemini用）*/
  batchSize?: number;
  /** 图像尺寸（OpenAI格式）*/
  size?: string;
  /** 图像尺寸（Gemini格式：宽高比）*/
  imageSize?: string;
  /** 图像质量 */
  quality?: 'standard' | 'hd';
  /** 图像风格 */
  style?: 'natural' | 'vivid';
  /** 负面提示词 */
  negativePrompt?: string;
  /** 种子 */
  seed?: string;
  /** 推理步数 */
  numInferenceSteps?: number;
  /** 引导尺度 */
  guidanceScale?: number;
  /** 中断信号 */
  signal?: AbortSignal;
  /** 提示词增强 */
  promptEnhancement?: boolean;
}

// ==================== API Client Interface ====================

/**
 * API客户端接口
 * 定义所有供应商客户端必须实现的方法
 */
export interface ApiClient<
  TSdkInstance = unknown,
  TSdkParams = unknown,
  TRawOutput = unknown,
  TRawChunk = unknown,
  TMessageParam = unknown,
  TToolCall = unknown,
  TSdkTool = unknown
> {
  /** Provider配置 */
  provider: Provider;

  // ==================== 核心API ====================

  /**
   * 创建对话完成请求
   */
  createCompletions(payload: TSdkParams, options?: RequestOptions): Promise<TRawOutput>;

  /**
   * 获取SDK实例
   */
  getSdkInstance(): Promise<TSdkInstance> | TSdkInstance;

  /**
   * 获取模型列表
   */
  listModels(): Promise<SdkModel[]>;

  /**
   * 获取嵌入维度
   */
  getEmbeddingDimensions(model?: Model): Promise<number>;

  /**
   * 生成图像
   */
  generateImage(params: GenerateImageParams): Promise<string[]>;

  // ==================== 转换器 ====================

  /**
   * 获取请求转换器
   */
  getRequestTransformer(): RequestTransformer<TSdkParams, TMessageParam>;

  /**
   * 获取响应块转换器
   */
  getResponseChunkTransformer(ctx: CompletionsContext): ResponseChunkTransformer<TRawChunk>;

  // ==================== 工具相关 ====================

  /**
   * 将MCP工具转换为SDK工具格式
   */
  convertMcpToolsToSdkTools(mcpTools: MCPTool[]): TSdkTool[];

  /**
   * 将SDK工具调用转换为MCP格式
   */
  convertSdkToolCallToMcp(toolCall: TToolCall, mcpTools: MCPTool[]): MCPTool | undefined;

  /**
   * 将SDK工具调用转换为MCP工具响应
   */
  convertSdkToolCallToMcpToolResponse(toolCall: TToolCall, mcpTool: MCPTool): MCPToolResponse;

  /**
   * 将MCP工具响应转换为SDK消息参数
   */
  convertMcpToolResponseToSdkMessageParam(
    mcpToolResponse: MCPToolResponse,
    resp: MCPCallToolResponse,
    model: Model
  ): TMessageParam | undefined;

  // ==================== 消息处理 ====================

  /**
   * 构建SDK消息（包含工具结果）
   */
  buildSdkMessages(
    currentReqMessages: TMessageParam[],
    output: TRawOutput | string | undefined,
    toolResults: TMessageParam[],
    toolCalls?: TToolCall[]
  ): TMessageParam[];

  /**
   * 从SDK载荷中提取消息数组
   */
  extractMessagesFromSdkPayload(sdkPayload: TSdkParams): TMessageParam[];

  /**
   * 估算消息token数量
   */
  estimateMessageTokens(message: TMessageParam): number;

  // ==================== 通用方法 ====================

  /**
   * 获取基础URL
   */
  getBaseURL(): string;

  /**
   * 获取API密钥（支持轮询）
   */
  getApiKey(): string;

  /**
   * 获取客户端兼容性类型
   */
  getClientCompatibilityType(model?: Model): string[];

  /**
   * 创建AbortController
   */
  createAbortController(messageId?: string): {
    abortController: AbortController;
    cleanup: () => void;
  };
}
