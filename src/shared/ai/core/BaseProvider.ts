/**
 * AI 供应商基类 —— 统一承载（Phase 3c）
 *
 * 本文件是「单一基类家族」的唯一定义处，合并了原 `api/baseProvider.ts` 的
 * `AbstractBaseProvider`（sendChatMessage 系，5 个主 provider）与原
 * `providers/BaseAIProvider.ts` 的 `BaseAIProvider` / `BaseOpenAIResponseProvider`
 * （completions 系，OpenAI Responses 路径）。
 *
 * 设计原则（企业级 / SOLID）：
 * - 两条调用面（`sendChatMessage` 返回结果 vs `completions` 返回 void + onChunk 流式）
 *   是本质不同的能力，按 ISP/LSP **不强行塞进一个具体基类**；
 * - 仅把两者**真正共有的根**（`model` + 构造器 + `convertMcpTools<T>`）抽到
 *   `AbstractProviderCore`，消除原先两个基类重复声明 `convertMcpTools<T>` 的问题；
 * - 共享约定由 `ai/core/types.ts` 的 `AIProvider` 契约表达。
 *
 * 旧路径 `api/baseProvider.ts` 与 `providers/BaseAIProvider.ts` 保留为 re-export
 * 兼容垫片，下游 import 不变，**零行为改动**。
 */
import type {
  Message,
  MCPTool,
  Model,
  MCPToolResponse,
  MCPCallToolResponse,
  Usage,
  Metrics
} from '../../types';
import type { Chunk } from '../../types/chunk';
import type { AIProvider, ChatOptions, ChatMessageResult } from './types';
import { buildSystemPrompt, type WorkspaceInfo } from '../../utils/mcpPrompt';
import { workspaceService } from '../../services/files/WorkspaceService';

/**
 * 基础提供者接口（历史命名，保留兼容）
 * 是 `AIProvider` 契约的子集，描述聊天 + 连接测试两件事。
 */
export interface BaseProvider {
  /**
   * 发送聊天消息
   * @param messages 消息数组
   * @param options 选项
   * @returns 响应内容
   */
  sendChatMessage(messages: Message[], options?: ChatOptions): Promise<ChatMessageResult>;

  /**
   * 测试API连接
   * @returns 是否连接成功
   */
  testConnection(): Promise<boolean>;
}

/**
 * 所有 AI 供应商基类的共享根
 * 持有 model 与构造器，并约定 `convertMcpTools<T>`，
 * 供 `AbstractBaseProvider`（sendChatMessage 系）与 `BaseAIProvider`（completions 系）共用。
 */
export abstract class AbstractProviderCore {
  protected model: Model;

  constructor(model: Model) {
    this.model = model;
  }

  /**
   * 将 MCP 工具转换为提供者特定的工具格式
   */
  public abstract convertMcpTools<T>(mcpTools: MCPTool[]): T[];
}

/**
 * 抽象基础提供者类
 * 提供 MCP 工具调用的通用功能和智能切换机制
 */
export abstract class AbstractBaseProvider extends AbstractProviderCore implements BaseProvider, AIProvider {
  // 工具数量阈值：超过此数量将强制使用系统提示词模式
  private static readonly SYSTEM_PROMPT_THRESHOLD: number = 128;

  protected useSystemPromptForTools: boolean = true;

  /**
   * 抽象方法：发送聊天消息
   */
  abstract sendChatMessage(
    messages: Message[],
    options?: ChatOptions
  ): Promise<ChatMessageResult>;

  /**
   * 抽象方法：测试API连接
   */
  abstract testConnection(): Promise<boolean>;

  /**
   * 智能工具配置设置
   * 根据工具数量、模型能力和用户设置自动选择最佳模式
   */
  protected setupToolsConfig<T>(params: {
    mcpTools?: MCPTool[];
    model: Model;
    enableToolUse?: boolean;
    mcpMode?: 'prompt' | 'function'
  }): { tools: T[] } {
    const { mcpTools, model: _model, enableToolUse, mcpMode = 'function' } = params;
    let tools: T[] = [];

    // 如果没有工具，返回空数组
    if (!mcpTools?.length) {
      return { tools };
    }

    console.log(`[MCP] 用户选择的工具模式: ${mcpMode}, 工具数量: ${mcpTools.length}, 启用工具: ${enableToolUse}`);

    // 如果用户明确选择提示词模式，强制使用系统提示词模式
    if (mcpMode === 'prompt') {
      console.log(`[MCP] 用户选择提示词注入模式，使用系统提示词模式`);
      this.useSystemPromptForTools = true;
      console.log(`[MCP] 设置 useSystemPromptForTools = true`);
      return { tools };
    }

    // 如果工具数量超过阈值，强制使用系统提示词模式
    if (mcpTools.length > AbstractBaseProvider.SYSTEM_PROMPT_THRESHOLD) {
      console.log(`[MCP] 工具数量 ${mcpTools.length} 超过阈值 ${AbstractBaseProvider.SYSTEM_PROMPT_THRESHOLD}，使用系统提示词模式`);
      this.useSystemPromptForTools = true;
      return { tools };
    }

    // 用户选择函数调用模式，直接使用函数调用模式（不再检测模型能力）
    if (mcpMode === 'function' && enableToolUse) {
      console.log(`[MCP] 用户选择函数调用模式，使用函数调用模式`);
      tools = this.convertMcpTools<T>(mcpTools);
      this.useSystemPromptForTools = false;
    } else {
      console.log(`[MCP] 使用系统提示词模式`);
      this.useSystemPromptForTools = true;
    }

    return { tools };
  }

  /** 缓存的工作区列表 */
  private cachedWorkspaces: WorkspaceInfo[] = [];
  private workspacesCacheTime: number = 0;
  private static readonly WORKSPACE_CACHE_TTL = 30000; // 30秒缓存

  /**
   * 获取工作区列表（带缓存）
   */
  protected async getWorkspaces(): Promise<WorkspaceInfo[]> {
    const now = Date.now();
    if (this.cachedWorkspaces.length > 0 && (now - this.workspacesCacheTime) < AbstractBaseProvider.WORKSPACE_CACHE_TTL) {
      return this.cachedWorkspaces;
    }

    try {
      const result = await workspaceService.getWorkspaces();
      this.cachedWorkspaces = result.workspaces.map((ws: { id: string; name: string; path: string }) => ({
        id: ws.id,
        name: ws.name,
        path: ws.path
      }));
      this.workspacesCacheTime = now;
      return this.cachedWorkspaces;
    } catch (error) {
      console.warn('[MCP] 获取工作区列表失败:', error);
      return this.cachedWorkspaces; // 返回缓存的数据
    }
  }

  /**
   * 构建包含 MCP 工具信息的系统提示词
   * 这是提供商层面的备用注入机制
   */
  protected buildSystemPromptWithTools(basePrompt: string, mcpTools?: MCPTool[], workspaces?: WorkspaceInfo[]): string {
    console.log(`[MCP] buildSystemPromptWithTools - 工具数量: ${mcpTools?.length || 0}, useSystemPromptForTools: ${this.useSystemPromptForTools}`);

    // 如果没有工具或不使用系统提示词模式，直接返回基础提示词
    if (!mcpTools || mcpTools.length === 0 || !this.useSystemPromptForTools) {
      console.log(`[MCP] 不注入工具提示词 - 原因: ${!mcpTools ? '无工具' : mcpTools.length === 0 ? '工具数量为0' : '不使用系统提示词模式'}`);
      return basePrompt || '';
    }

    console.log(`[MCP] 提供商层注入：将 ${mcpTools.length} 个工具注入到系统提示词中, 工作区数量: ${workspaces?.length || 0}`);
    const result = buildSystemPrompt(basePrompt || '', mcpTools, {
      workspaces: workspaces || []
    });
    console.log(`[MCP] 注入后的系统提示词长度: ${result.length}`);
    return result;
  }

  /**
   * 检查是否启用工具使用
   */
  protected isToolUseEnabled(mcpTools?: MCPTool[]): boolean {
    return mcpTools !== undefined && mcpTools.length > 0;
  }

  /**
   * 获取当前是否使用系统提示词模式
   */
  protected getUseSystemPromptForTools(): boolean {
    return this.useSystemPromptForTools;
  }
}

/**
 * AI 提供者基类（Responses 系）
 * 提供 MCP 工具调用响应转换的抽象约定
 */
export abstract class BaseAIProvider extends AbstractProviderCore {
  /**
   * 将 MCP 工具调用响应转换为消息格式
   */
  public abstract mcpToolCallResponseToMessage(
    mcpToolResponse: MCPToolResponse,
    resp: MCPCallToolResponse,
    model: Model
  ): any;

  /**
   * 将提供者特定的工具调用转换为 MCP 工具响应
   */
  protected abstract convertToolCallsToMcpResponses(
    toolCalls: any[],
    mcpTools: MCPTool[]
  ): MCPToolResponse[];
}

/**
 * OpenAI Responses API 基础提供者
 * 专门用于处理 OpenAI Responses API 的移动端适配
 */
export abstract class BaseOpenAIResponseProvider extends BaseAIProvider {
  protected abstract sdk: any; // OpenAI SDK 实例

  /**
   * 完成对话生成 - 使用 Responses API
   */
  public abstract completions(params: {
    messages: any[];
    assistant: any;
    mcpTools?: MCPTool[];
    onChunk?: (chunk: Chunk) => void;
    onFilterMessages?: (messages: any[]) => void;
  }): Promise<void>;

  /**
   * 获取消息参数 - 适配 Responses API 格式
   */
  protected abstract getResponseMessageParam(message: any, model: Model): Promise<any>;

  /**
   * 获取服务层级配置
   */
  protected getServiceTier(_model: Model): string | undefined {
    // 移动端默认使用 auto 层级
    return 'auto';
  }

  /**
   * 获取超时配置 - 移动端优化
   */
  protected getTimeout(_model: Model): number {
    // 移动端网络环境不稳定，适当延长超时时间
    return 3 * 60 * 1000; // 3分钟
  }

  /**
   * 获取推理努力配置
   */
  protected getResponseReasoningEffort(_assistant: any, _model: Model): any {
    // 移动端暂不支持推理努力配置
    return {};
  }

  /**
   * 处理流式响应
   */
  protected abstract processStream(
    stream: any,
    onChunk: (chunk: Chunk) => void,
    finalUsage: Usage,
    finalMetrics: Metrics,
    toolResponses: MCPToolResponse[]
  ): Promise<void>;

  /**
   * 处理工具调用 - Responses API 格式
   */
  protected abstract processToolCalls(
    mcpTools: MCPTool[],
    toolCalls: any[]
  ): Promise<any[]>;

  /**
   * 处理工具使用 - XML 格式
   */
  protected abstract processToolUses(content: string): Promise<any[]>;

  /**
   * 获取模型列表
   */
  public abstract getModels(): Promise<any[]>;

  /**
   * 测试 API 连接
   */
  public abstract testConnection(): Promise<boolean>;
}
