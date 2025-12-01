# Phase 1: 类型系统重构

> 预计工时：2-3天
> 前置依赖：无
> 参考文件：`cherry-studio-main/src/renderer/src/types/provider.ts`

## 🎯 目标

1. 建立完整的Provider类型系统
2. 引入Zod进行运行时类型验证
3. 定义统一的SDK类型接口
4. 创建Chunk类型体系

## 📁 需要创建的文件

```
src/shared/aiCore/
└── types/
    ├── provider.ts      # Provider核心类型
    ├── chunk.ts         # Chunk类型（响应流）
    ├── sdk.ts           # SDK通用类型
    ├── schemas.ts       # Zod Schema定义
    └── index.ts         # 统一导出
```

## 📝 详细实现

### 1.1 安装依赖

```bash
npm install zod
```

### 1.2 Provider类型定义 (`types/provider.ts`)

```typescript
import * as z from 'zod';

// ==================== Provider Type Schema ====================

/**
 * 供应商类型枚举
 * 每种类型对应不同的API调用方式
 */
export const ProviderTypeSchema = z.enum([
  'openai',           // OpenAI Chat Completions API
  'openai-response',  // OpenAI Responses API (新版)
  'anthropic',        // Anthropic Claude API
  'gemini',           // Google Gemini API
  'azure-openai',     // Azure OpenAI Service
  'vertexai',         // Google Vertex AI
  'aws-bedrock',      // AWS Bedrock
  'deepseek',         // DeepSeek (OpenAI兼容)
  'zhipu',            // 智谱AI (OpenAI兼容)
  'siliconflow',      // 硅基流动 (OpenAI兼容)
  'volcengine',       // 火山引擎 (OpenAI兼容)
  'grok',             // xAI Grok (OpenAI兼容)
  'custom'            // 自定义OpenAI兼容
]);

export type ProviderType = z.infer<typeof ProviderTypeSchema>;

// ==================== Provider API Options ====================

/**
 * Provider API能力标志
 * undefined 视为支持，用于控制特定功能的开关
 */
export interface ProviderApiOptions {
  /** 是否不支持 message content 为数组类型 */
  isNotSupportArrayContent?: boolean;
  /** 是否不支持 stream_options 参数 */
  isNotSupportStreamOptions?: boolean;
  /** 是否支持 developer role */
  isSupportDeveloperRole?: boolean;
  /** 是否支持 service_tier 参数 */
  isSupportServiceTier?: boolean;
  /** 是否不支持 enable_thinking 参数 */
  isNotSupportEnableThinking?: boolean;
  /** 是否支持原生 function calling */
  isSupportFunctionCalling?: boolean;
  /** 是否支持流式输出 */
  isSupportStreaming?: boolean;
  /** 是否支持多模态（图像输入） */
  isSupportMultimodal?: boolean;
}

// ==================== Service Tier ====================

export const ServiceTierSchema = z.enum([
  'auto',
  'default', 
  'flex',
  'priority'
]).nullable();

export type ServiceTier = z.infer<typeof ServiceTierSchema>;

// ==================== Provider Interface ====================

/**
 * Provider 核心接口
 * 描述一个AI服务供应商的完整配置
 */
export interface Provider {
  /** 唯一标识符 */
  id: string;
  /** Provider类型，决定使用哪种API客户端 */
  type: ProviderType;
  /** 显示名称 */
  name: string;
  /** API密钥，支持逗号分隔多个密钥轮询 */
  apiKey: string;
  /** API基础URL */
  apiHost: string;
  /** 关联的模型列表 */
  models: ProviderModel[];
  /** 是否启用 */
  enabled?: boolean;
  /** 是否为系统内置供应商 */
  isSystem?: boolean;
  /** API能力选项 */
  apiOptions?: ProviderApiOptions;
  /** Service Tier配置 */
  serviceTier?: ServiceTier;
  /** 额外请求头 */
  extraHeaders?: Record<string, string>;
  /** 额外请求体参数 */
  extraBody?: Record<string, any>;
  /** 备注信息 */
  notes?: string;

  // ===== 特定供应商字段 =====
  /** Anthropic API Host (用于AiHubMix等中转) */
  anthropicApiHost?: string;
  /** API版本 (Azure OpenAI) */
  apiVersion?: string;
  /** 是否为Vertex AI模式 */
  isVertex?: boolean;
  /** 认证类型 */
  authType?: 'apiKey' | 'oauth';
  /** 自定义模型获取端点 */
  customModelEndpoint?: string;
}

/**
 * Provider关联的模型信息
 * 简化版Model，只包含Provider层面需要的信息
 */
export interface ProviderModel {
  id: string;
  name: string;
  description?: string;
  group?: string;
  enabled?: boolean;
}

// ==================== System Provider ====================

/**
 * 系统内置供应商ID枚举
 */
export const SystemProviderIdSchema = z.enum([
  'openai',
  'anthropic', 
  'gemini',
  'azure-openai',
  'deepseek',
  'zhipu',
  'siliconflow',
  'volcengine',
  'grok',
  'moonshot',
  'ollama',
  'lmstudio'
]);

export type SystemProviderId = z.infer<typeof SystemProviderIdSchema>;

/**
 * 判断是否为系统内置供应商
 */
export const isSystemProviderId = (id: string): id is SystemProviderId => {
  return SystemProviderIdSchema.safeParse(id).success;
};

/**
 * 系统供应商类型
 */
export interface SystemProvider extends Provider {
  id: SystemProviderId;
  isSystem: true;
}

/**
 * 判断是否为系统供应商
 */
export const isSystemProvider = (provider: Provider): provider is SystemProvider => {
  return isSystemProviderId(provider.id) && provider.isSystem === true;
};

// ==================== Azure OpenAI Provider ====================

export interface AzureOpenAIProvider extends Provider {
  type: 'azure-openai';
  apiVersion: string;
}

export const isAzureOpenAIProvider = (provider: Provider): provider is AzureOpenAIProvider => {
  return provider.type === 'azure-openai';
};

// ==================== Vertex AI Provider ====================

export interface VertexAIProvider extends Provider {
  type: 'vertexai';
  googleCredentials: {
    privateKey: string;
    clientEmail: string;
  };
  project: string;
  location: string;
}

// ==================== Provider Validation ====================

/**
 * Provider Schema 用于运行时验证
 */
export const ProviderSchema = z.object({
  id: z.string().min(1),
  type: ProviderTypeSchema,
  name: z.string().min(1),
  apiKey: z.string(),
  apiHost: z.string().url().or(z.string().startsWith('http://localhost')),
  models: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    group: z.string().optional(),
    enabled: z.boolean().optional()
  })),
  enabled: z.boolean().optional(),
  isSystem: z.boolean().optional(),
  apiOptions: z.object({
    isNotSupportArrayContent: z.boolean().optional(),
    isNotSupportStreamOptions: z.boolean().optional(),
    isSupportDeveloperRole: z.boolean().optional(),
    isSupportServiceTier: z.boolean().optional(),
    isNotSupportEnableThinking: z.boolean().optional(),
    isSupportFunctionCalling: z.boolean().optional(),
    isSupportStreaming: z.boolean().optional(),
    isSupportMultimodal: z.boolean().optional()
  }).optional(),
  serviceTier: ServiceTierSchema.optional(),
  extraHeaders: z.record(z.string()).optional(),
  extraBody: z.record(z.any()).optional(),
  notes: z.string().optional(),
  anthropicApiHost: z.string().optional(),
  apiVersion: z.string().optional(),
  isVertex: z.boolean().optional(),
  authType: z.enum(['apiKey', 'oauth']).optional(),
  customModelEndpoint: z.string().optional()
});

/**
 * 验证Provider配置
 */
export function validateProvider(provider: unknown): Provider {
  return ProviderSchema.parse(provider);
}

/**
 * 安全验证Provider配置（不抛出异常）
 */
export function safeValidateProvider(provider: unknown): { success: true; data: Provider } | { success: false; error: z.ZodError } {
  const result = ProviderSchema.safeParse(provider);
  if (result.success) {
    return { success: true, data: result.data as Provider };
  }
  return { success: false, error: result.error };
}
```

### 1.3 Chunk类型定义 (`types/chunk.ts`)

```typescript
/**
 * Chunk 类型枚举
 * 定义流式响应中所有可能的数据块类型
 */
export enum ChunkType {
  // ===== 基础文本 =====
  TEXT_DELTA = 'TEXT_DELTA',           // 文本增量
  TEXT_COMPLETE = 'TEXT_COMPLETE',     // 文本完成
  
  // ===== 思考过程 =====
  THINKING_DELTA = 'THINKING_DELTA',       // 思考增量
  THINKING_COMPLETE = 'THINKING_COMPLETE', // 思考完成
  
  // ===== 工具调用 =====
  MCP_TOOL_CALL_START = 'MCP_TOOL_CALL_START',     // 工具调用开始
  MCP_TOOL_CALL_ARGS = 'MCP_TOOL_CALL_ARGS',       // 工具调用参数
  MCP_TOOL_CALL_COMPLETE = 'MCP_TOOL_CALL_COMPLETE', // 工具调用完成
  MCP_TOOL_RESULT = 'MCP_TOOL_RESULT',             // 工具执行结果
  
  // ===== 网络搜索 =====
  WEB_SEARCH_START = 'WEB_SEARCH_START',
  WEB_SEARCH_COMPLETE = 'WEB_SEARCH_COMPLETE',
  LLM_WEB_SEARCH_COMPLETE = 'LLM_WEB_SEARCH_COMPLETE',
  
  // ===== 生命周期 =====
  LLM_RESPONSE_CREATED = 'LLM_RESPONSE_CREATED',
  BLOCK_COMPLETE = 'BLOCK_COMPLETE',
  ERROR = 'ERROR'
}

// ===== 基础Chunk接口 =====

export interface BaseChunk {
  type: ChunkType;
}

// ===== 文本相关Chunk =====

export interface TextDeltaChunk extends BaseChunk {
  type: ChunkType.TEXT_DELTA;
  text: string;
}

export interface TextCompleteChunk extends BaseChunk {
  type: ChunkType.TEXT_COMPLETE;
  text: string;
}

// ===== 思考相关Chunk =====

export interface ThinkingDeltaChunk extends BaseChunk {
  type: ChunkType.THINKING_DELTA;
  text: string;
}

export interface ThinkingCompleteChunk extends BaseChunk {
  type: ChunkType.THINKING_COMPLETE;
  text: string;
  thinking_millsec?: number;
}

// ===== 工具调用Chunk =====

export interface McpToolCallStartChunk extends BaseChunk {
  type: ChunkType.MCP_TOOL_CALL_START;
  toolCallId: string;
  toolName: string;
}

export interface McpToolCallArgsChunk extends BaseChunk {
  type: ChunkType.MCP_TOOL_CALL_ARGS;
  toolCallId: string;
  args: string; // JSON string delta
}

export interface McpToolCallCompleteChunk extends BaseChunk {
  type: ChunkType.MCP_TOOL_CALL_COMPLETE;
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
}

export interface McpToolResultChunk extends BaseChunk {
  type: ChunkType.MCP_TOOL_RESULT;
  toolCallId: string;
  result: string;
  isError?: boolean;
}

// ===== 网络搜索Chunk =====

export interface WebSearchStartChunk extends BaseChunk {
  type: ChunkType.WEB_SEARCH_START;
  query: string;
}

export interface WebSearchCompleteChunk extends BaseChunk {
  type: ChunkType.WEB_SEARCH_COMPLETE;
  results: Array<{
    title: string;
    url: string;
    snippet: string;
  }>;
}

export interface LlmWebSearchCompleteChunk extends BaseChunk {
  type: ChunkType.LLM_WEB_SEARCH_COMPLETE;
  llm_web_search: {
    results: any;
    source: string;
  };
}

// ===== 生命周期Chunk =====

export interface LlmResponseCreatedChunk extends BaseChunk {
  type: ChunkType.LLM_RESPONSE_CREATED;
}

export interface BlockCompleteChunk extends BaseChunk {
  type: ChunkType.BLOCK_COMPLETE;
  response?: {
    text?: string;
    usage?: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
      thoughts_tokens?: number;
    };
    metrics?: {
      completion_tokens: number;
      time_completion_millsec: number;
      time_first_token_millsec: number;
    };
    webSearch?: {
      results: any;
      source: string;
    };
  };
}

export interface ErrorChunk extends BaseChunk {
  type: ChunkType.ERROR;
  error: {
    message: string;
    code?: string;
    details?: any;
  };
}

// ===== Union Type =====

export type Chunk =
  | TextDeltaChunk
  | TextCompleteChunk
  | ThinkingDeltaChunk
  | ThinkingCompleteChunk
  | McpToolCallStartChunk
  | McpToolCallArgsChunk
  | McpToolCallCompleteChunk
  | McpToolResultChunk
  | WebSearchStartChunk
  | WebSearchCompleteChunk
  | LlmWebSearchCompleteChunk
  | LlmResponseCreatedChunk
  | BlockCompleteChunk
  | ErrorChunk;

// ===== Type Guards =====

export function isTextDeltaChunk(chunk: Chunk): chunk is TextDeltaChunk {
  return chunk.type === ChunkType.TEXT_DELTA;
}

export function isThinkingDeltaChunk(chunk: Chunk): chunk is ThinkingDeltaChunk {
  return chunk.type === ChunkType.THINKING_DELTA;
}

export function isBlockCompleteChunk(chunk: Chunk): chunk is BlockCompleteChunk {
  return chunk.type === ChunkType.BLOCK_COMPLETE;
}

export function isErrorChunk(chunk: Chunk): chunk is ErrorChunk {
  return chunk.type === ChunkType.ERROR;
}
```

### 1.4 SDK通用类型 (`types/sdk.ts`)

```typescript
/**
 * SDK 通用类型定义
 * 抽象各供应商SDK的共同接口
 */

// ===== 消息角色 =====

export type MessageRole = 'system' | 'user' | 'assistant' | 'developer' | 'tool';

// ===== SDK消息参数 =====

export interface SdkMessageParam {
  role: MessageRole;
  content: string | SdkMessageContent[];
  name?: string;
  tool_call_id?: string;
}

export interface SdkMessageContent {
  type: 'text' | 'image_url' | 'image';
  text?: string;
  image_url?: {
    url: string;
    detail?: 'auto' | 'low' | 'high';
  };
}

// ===== SDK请求参数 =====

export interface SdkRequestParams {
  model: string;
  messages: SdkMessageParam[];
  stream?: boolean;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stop?: string[];
  tools?: SdkTool[];
  tool_choice?: 'auto' | 'none' | 'required' | { type: 'function'; function: { name: string } };
}

// ===== SDK工具定义 =====

export interface SdkTool {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
}

// ===== SDK工具调用 =====

export interface SdkToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

// ===== SDK响应 =====

export interface SdkResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: SdkChoice[];
  usage?: SdkUsage;
}

export interface SdkChoice {
  index: number;
  message?: {
    role: MessageRole;
    content: string | null;
    tool_calls?: SdkToolCall[];
  };
  delta?: {
    role?: MessageRole;
    content?: string;
    tool_calls?: Partial<SdkToolCall>[];
  };
  finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
}

export interface SdkUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

// ===== SDK流式响应块 =====

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
    };
    finish_reason: string | null;
  }>;
  usage?: SdkUsage;
}

// ===== SDK模型信息 =====

export interface SdkModel {
  id: string;
  object?: string;
  created?: number;
  owned_by?: string;
}

// ===== 请求选项 =====

export interface RequestOptions {
  timeout?: number;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}
```

### 1.5 统一导出 (`types/index.ts`)

```typescript
/**
 * AiCore 类型统一导出
 */

// Provider类型
export * from './provider';

// Chunk类型
export * from './chunk';

// SDK类型
export * from './sdk';

// 如果有schemas单独文件
// export * from './schemas';
```

## ✅ 完成标准

1. [ ] 所有类型文件创建完成
2. [ ] Zod依赖安装并配置
3. [ ] 类型导出正确，无循环依赖
4. [ ] 现有代码可以逐步迁移使用新类型
5. [ ] 编写基础单元测试验证Schema

## 🧪 测试用例

```typescript
// tests/types/provider.test.ts
import { validateProvider, ProviderTypeSchema } from '@/shared/aiCore/types';

describe('Provider Types', () => {
  test('should validate valid provider', () => {
    const provider = {
      id: 'openai',
      type: 'openai',
      name: 'OpenAI',
      apiKey: 'sk-xxx',
      apiHost: 'https://api.openai.com',
      models: []
    };
    expect(() => validateProvider(provider)).not.toThrow();
  });

  test('should reject invalid provider type', () => {
    expect(ProviderTypeSchema.safeParse('invalid').success).toBe(false);
  });
});
```

## 📌 注意事项

1. **向后兼容** - 新类型应该与现有 `Model` 类型兼容
2. **渐进迁移** - 不要一次性替换所有类型引用
3. **文档注释** - 每个类型都应有清晰的JSDoc注释

## ➡️ 下一步

完成Phase 1后，继续 [Phase 2: 抽象基类设计](./phase-2-base-client.md)
