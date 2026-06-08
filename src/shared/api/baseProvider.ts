/**
 * 基础提供者接口和抽象类
 * 定义了所有AI提供者必须实现的方法，并提供 MCP 工具调用的通用功能
 */
import type { Message, MCPTool, Model } from '../types';
import { buildSystemPrompt, type WorkspaceInfo } from '../utils/mcpPrompt';
import { workspaceService } from '../services/files/WorkspaceService';

/**
 * 基础提供者接口
 */
export interface BaseProvider {
  /**
   * 发送聊天消息
   * @param messages 消息数组
   * @param options 选项
   * @returns 响应内容
   */
sendChatMessage(
    messages: Message[],
    options?: {
      onChunk?: (chunk: import('../types/chunk').Chunk) => void;
      enableWebSearch?: boolean;
      enableThinking?: boolean;
      enableTools?: boolean;
      tools?: string[];
      mcpTools?: MCPTool[];
      systemPrompt?: string;
      abortSignal?: AbortSignal;
    }
  ): Promise<string | { content: string; reasoning?: string; reasoningTime?: number }>;

  /**
   * 测试API连接
   * @returns 是否连接成功
   */
  testConnection(): Promise<boolean>;
}

/**
 * 抽象基础提供者类
 * 提供 MCP 工具调用的通用功能和智能切换机制
 */
export abstract class AbstractBaseProvider implements BaseProvider {
  // 工具数量阈值：超过此数量将强制使用系统提示词模式
  private static readonly SYSTEM_PROMPT_THRESHOLD: number = 128;

  protected model: Model;
  protected useSystemPromptForTools: boolean = true;

  constructor(model: Model) {
    this.model = model;
  }

  /**
   * 抽象方法：发送聊天消息
   */
  abstract sendChatMessage(
    messages: Message[],
    options?: {
      onChunk?: (chunk: import('../types/chunk').Chunk) => void;
      enableWebSearch?: boolean;
      enableThinking?: boolean;
      enableTools?: boolean;
      tools?: string[];
      mcpTools?: MCPTool[];
      systemPrompt?: string;
      abortSignal?: AbortSignal;
    }
  ): Promise<string | { content: string; reasoning?: string; reasoningTime?: number }>;

  /**
   * 抽象方法：测试API连接
   */
  abstract testConnection(): Promise<boolean>;

  /**
   * 抽象方法：将 MCP 工具转换为提供者特定的工具格式
   */
  public abstract convertMcpTools<T>(mcpTools: MCPTool[]): T[];

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
