/**
 * AI 供应商调用链 —— 强类型契约（Phase 3b 立契约）
 *
 * 本文件刻画的是「现状实际被调用的最小公共面」，把工厂 `getProviderApi` 的
 * `any` 返回与各 provider 之间的隐式约定显式化，**零行为改动**。
 *
 * 与 README §4.1 的关系：§4.1 描述的归一化目标契约（`chat(params): ChatResult`）
 * 是更后续阶段的迁移终态。这里先用「现状面契约」把当前真实接口钉死，作为合并基类
 * （Phase 3c）与收紧工厂返回类型（Phase 3d）的承载，后续再向 §4.1 演进，互不冲突。
 */
import type { Message, MCPTool, Model } from '../../types';
import type { Chunk } from '../../types/chunk';

/**
 * `sendChatMessage` / `sendChatRequest` 的可选项
 * 字段与现有各 provider 实现保持一致。
 */
export interface ChatOptions {
  onChunk?: (chunk: Chunk) => void;
  enableWebSearch?: boolean;
  enableThinking?: boolean;
  enableTools?: boolean;
  tools?: string[];
  mcpTools?: MCPTool[];
  systemPrompt?: string;
  abortSignal?: AbortSignal;
}

/**
 * 聊天返回（现状 union 形态）
 * Phase 3b 仅如实刻画，归一为 README §4.1 的 `ChatResult` 留待后续阶段。
 */
export type ChatMessageResult =
  | string
  | { content: string; reasoning?: string; reasoningTime?: number };

/**
 * AI Provider 类实例契约
 *
 * 由 `AbstractBaseProvider`（api/baseProvider.ts）及其所有子类实现：
 * openai / openai-aisdk / anthropic-aisdk / gemini-aisdk / dashscope。
 */
export interface AIProvider {
  /** 发送聊天消息（支持流式 onChunk 回调） */
  sendChatMessage(messages: Message[], options?: ChatOptions): Promise<ChatMessageResult>;
  /** 测试 API 连接 */
  testConnection(): Promise<boolean>;
  /** 将 MCP 工具转换为供应商特定的工具格式 */
  convertMcpTools<T>(mcpTools: MCPTool[]): T[];
}

/**
 * 工厂 `getProviderApi(model)` 的返回契约
 *
 * 刻画现状两种返回形状（内联适配对象 / `openaiApi` 命名空间）共同满足的最小面。
 * Phase 3d 会把 `getProviderApi` 的返回类型从 `any` 收紧为本接口，逼出隐藏耦合。
 */
export interface ProviderApi {
  /** 发送聊天请求 */
  sendChatRequest(messages: any[], model: Model, options?: ChatOptions): Promise<ChatMessageResult>;
  /** 测试 API 连接 */
  testConnection(model: Model): Promise<boolean>;
  /** 拉取模型列表（部分供应商提供） */
  fetchModels?: (...args: any[]) => Promise<any>;
}
