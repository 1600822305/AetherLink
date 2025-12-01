/**
 * SDK 通用类型定义
 * 抽象各供应商SDK的共同接口
 */

// ==================== Message Types ====================

/**
 * 消息角色类型
 */
export type MessageRole = 'system' | 'user' | 'assistant' | 'developer' | 'tool';

/**
 * 消息内容类型 - 文本或多模态
 */
export interface SdkTextContent {
  type: 'text';
  text: string;
}

export interface SdkImageUrlContent {
  type: 'image_url';
  image_url: {
    url: string;
    detail?: 'auto' | 'low' | 'high';
  };
}

export interface SdkImageContent {
  type: 'image';
  source: {
    type: 'base64';
    media_type: string;
    data: string;
  };
}

export type SdkMessageContent = SdkTextContent | SdkImageUrlContent | SdkImageContent;

/**
 * SDK消息参数
 */
export interface SdkMessageParam {
  role: MessageRole;
  content: string | SdkMessageContent[];
  name?: string;
  tool_call_id?: string;
  tool_calls?: SdkToolCall[];
}

// ==================== Tool Types ====================

/**
 * SDK函数定义
 */
export interface SdkFunctionDefinition {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
}

/**
 * SDK工具定义
 */
export interface SdkTool {
  type: 'function';
  function: SdkFunctionDefinition;
}

/**
 * SDK工具调用
 */
export interface SdkToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * 工具选择类型
 */
export type SdkToolChoice = 
  | 'auto' 
  | 'none' 
  | 'required' 
  | { type: 'function'; function: { name: string } };

// ==================== Request Types ====================

/**
 * SDK请求参数基础接口
 */
export interface SdkRequestParams {
  /** 模型ID */
  model: string;
  /** 消息列表 */
  messages: SdkMessageParam[];
  /** 是否流式输出 */
  stream?: boolean;
  /** 温度参数 (0-2) */
  temperature?: number;
  /** Top P 参数 (0-1) */
  top_p?: number;
  /** 最大输出token数 */
  max_tokens?: number;
  /** 停止词 */
  stop?: string | string[];
  /** 工具列表 */
  tools?: SdkTool[];
  /** 工具选择 */
  tool_choice?: SdkToolChoice;
  /** 频率惩罚 (-2 to 2) */
  frequency_penalty?: number;
  /** 存在惩罚 (-2 to 2) */
  presence_penalty?: number;
  /** 用户标识 */
  user?: string;
  /** 响应格式 */
  response_format?: { type: 'text' | 'json_object' };
  /** 种子（用于可复现输出） */
  seed?: number;
  /** 是否返回使用统计 */
  stream_options?: { include_usage?: boolean };
}

// ==================== Response Types ====================

/**
 * SDK使用统计
 */
export interface SdkUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  /** 思考token数（某些模型支持）*/
  thoughts_tokens?: number;
}

/**
 * SDK响应选择
 */
export interface SdkChoice {
  index: number;
  message?: {
    role: MessageRole;
    content: string | null;
    tool_calls?: SdkToolCall[];
    /** 推理内容（某些模型支持）*/
    reasoning_content?: string;
  };
  delta?: {
    role?: MessageRole;
    content?: string;
    tool_calls?: Partial<SdkToolCall>[];
    reasoning_content?: string;
  };
  finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
}

/**
 * SDK完整响应（非流式）
 */
export interface SdkResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: SdkChoice[];
  usage?: SdkUsage;
  system_fingerprint?: string;
}

/**
 * SDK流式响应块
 */
export interface SdkStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: MessageRole;
      content?: string;
      tool_calls?: Array<{
        index: number;
        id?: string;
        type?: 'function';
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
      reasoning_content?: string;
    };
    finish_reason: string | null;
  }>;
  usage?: SdkUsage;
}

// ==================== Model Types ====================

/**
 * SDK模型信息
 */
export interface SdkModel {
  id: string;
  object?: string;
  created?: number;
  owned_by?: string;
}

/**
 * 模型列表响应
 */
export interface SdkModelsResponse {
  object: 'list';
  data: SdkModel[];
}

// ==================== Request Options ====================

/**
 * 请求选项
 */
export interface RequestOptions {
  /** 请求超时（毫秒）*/
  timeout?: number;
  /** 中断信号 */
  signal?: AbortSignal;
  /** 额外请求头 */
  headers?: Record<string, string>;
  /** 重试次数 */
  retries?: number;
}

// ==================== Error Types ====================

/**
 * SDK错误类型
 */
export interface SdkError {
  message: string;
  type?: string;
  param?: string;
  code?: string;
  status?: number;
}

/**
 * API错误响应
 */
export interface SdkErrorResponse {
  error: SdkError;
}

// ==================== Embedding Types ====================

/**
 * 嵌入请求参数
 */
export interface SdkEmbeddingRequest {
  model: string;
  input: string | string[];
  encoding_format?: 'float' | 'base64';
  dimensions?: number;
  user?: string;
}

/**
 * 嵌入数据
 */
export interface SdkEmbeddingData {
  object: 'embedding';
  index: number;
  embedding: number[];
}

/**
 * 嵌入响应
 */
export interface SdkEmbeddingResponse {
  object: 'list';
  data: SdkEmbeddingData[];
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

// ==================== Image Generation Types ====================

/**
 * 图像生成请求参数
 */
export interface SdkImageGenerationRequest {
  model?: string;
  prompt: string;
  n?: number;
  size?: '256x256' | '512x512' | '1024x1024' | '1792x1024' | '1024x1792';
  quality?: 'standard' | 'hd';
  style?: 'natural' | 'vivid';
  response_format?: 'url' | 'b64_json';
  user?: string;
}

/**
 * 生成的图像数据
 */
export interface SdkImageData {
  url?: string;
  b64_json?: string;
  revised_prompt?: string;
}

/**
 * 图像生成响应
 */
export interface SdkImageGenerationResponse {
  created: number;
  data: SdkImageData[];
}

// ==================== Type Guards ====================

/**
 * 检查是否为流式响应块
 */
export function isSdkStreamChunk(response: unknown): response is SdkStreamChunk {
  return (
    typeof response === 'object' &&
    response !== null &&
    'choices' in response &&
    Array.isArray((response as SdkStreamChunk).choices) &&
    (response as SdkStreamChunk).choices.length > 0 &&
    'delta' in (response as SdkStreamChunk).choices[0]
  );
}

/**
 * 检查是否为完整响应
 */
export function isSdkResponse(response: unknown): response is SdkResponse {
  return (
    typeof response === 'object' &&
    response !== null &&
    'choices' in response &&
    Array.isArray((response as SdkResponse).choices) &&
    (response as SdkResponse).choices.length > 0 &&
    'message' in (response as SdkResponse).choices[0]
  );
}

/**
 * 检查是否为错误响应
 */
export function isSdkErrorResponse(response: unknown): response is SdkErrorResponse {
  return (
    typeof response === 'object' &&
    response !== null &&
    'error' in response &&
    typeof (response as SdkErrorResponse).error === 'object'
  );
}

// ==================== Utility Types ====================

/**
 * SDK实例类型（泛型占位符）
 */
export type SdkInstance = unknown;

/**
 * SDK原始输出类型（泛型占位符）
 */
export type SdkRawOutput = SdkResponse | AsyncIterable<SdkStreamChunk>;

/**
 * SDK原始块类型（泛型占位符）
 */
export type SdkRawChunk = SdkStreamChunk;
