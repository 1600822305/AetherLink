/**
 * DashScope (阿里云百炼) Provider
 * 聊天走 OpenAI 兼容模式，文生图走 DashScope 原生 API
 */
import type { Message, Model, MCPTool } from '../../types';
import type { Chunk } from '../../types/chunk';
import { AbstractBaseProvider } from '../baseProvider';
import { OpenAIProvider } from '../openai/provider';
import { getDashScopeCompatibleUrl } from './client';

/**
 * DashScope Provider
 * 继承 AbstractBaseProvider，内部委托 OpenAIProvider 处理聊天
 * 因为阿里云百炼的聊天 API 完全兼容 OpenAI 格式
 */
export class DashScopeProvider extends AbstractBaseProvider {
  private openaiProvider: OpenAIProvider;

  constructor(model: Model) {
    super(model);

    // 创建一个 OpenAI Provider，baseUrl 指向 DashScope 的兼容模式地址
    const compatibleModel = {
      ...model,
      baseUrl: getDashScopeCompatibleUrl(model)
    };
    this.openaiProvider = new OpenAIProvider(compatibleModel);
  }

  /**
   * 发送聊天消息 — 委托给 OpenAI Provider
   */
  async sendChatMessage(
    messages: Message[],
    options?: {
      onChunk?: (chunk: Chunk) => void;
      enableWebSearch?: boolean;
      enableThinking?: boolean;
      enableTools?: boolean;
      tools?: string[];
      mcpTools?: MCPTool[];
      systemPrompt?: string;
      abortSignal?: AbortSignal;
    }
  ): Promise<string | { content: string; reasoning?: string; reasoningTime?: number }> {
    console.log(`[DashScope] 通过 OpenAI 兼容模式发送聊天请求 - 模型: ${this.model.id}`);
    return this.openaiProvider.sendChatMessage(messages, options);
  }

  /**
   * 测试 API 连接 — 委托给 OpenAI Provider
   */
  async testConnection(): Promise<boolean> {
    console.log(`[DashScope] 测试连接 - 模型: ${this.model.id}`);
    return this.openaiProvider.testConnection();
  }

  /**
   * 将 MCP 工具转换为提供者特定的工具格式 — 委托给 OpenAI Provider
   */
  public convertMcpTools<T>(mcpTools: MCPTool[]): T[] {
    return this.openaiProvider.convertMcpTools<T>(mcpTools);
  }
}
