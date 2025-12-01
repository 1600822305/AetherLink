/**
 * 基础提供者接口和抽象类
 * 定义了所有AI提供者必须实现的方法，并提供 MCP 工具调用的通用功能
 */
import type { Message, MCPTool, Model } from '../../../types';
import { buildSystemPrompt } from '../../../utils/mcpPrompt';
import { isFunctionCallingModel } from '../../../config/models';

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
   * 发送聊天消息 - 抽象方法，子类必须实现
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
   * 测试API连接 - 抽象方法，子类必须实现
   */
  abstract testConnection(): Promise<boolean>;

  /**
   * 智能决定MCP工具调用模式
   * @param mcpTools MCP工具列表
   * @returns 使用的模式和处理后的工具列表
   */
  protected decideMcpToolMode(mcpTools?: MCPTool[]): {
    mode: 'system_prompt' | 'function_calling' | 'none';
    tools: MCPTool[];
    systemPromptAddition?: string;
  } {
    if (!mcpTools || mcpTools.length === 0) {
      return { mode: 'none', tools: [] };
    }

    // 检查模型是否支持函数调用
    const supportsFunctionCalling = isFunctionCallingModel(this.model);

    // 智能切换逻辑
    if (mcpTools.length > AbstractBaseProvider.SYSTEM_PROMPT_THRESHOLD || !supportsFunctionCalling) {
      // 工具太多或模型不支持函数调用，使用系统提示词模式
      const systemPromptAddition = buildSystemPrompt('', mcpTools);
      return {
        mode: 'system_prompt',
        tools: mcpTools,
        systemPromptAddition
      };
    }

    // 使用原生函数调用模式
    return {
      mode: 'function_calling',
      tools: mcpTools
    };
  }

  /**
   * 将MCP工具转换为OpenAI函数调用格式
   * @param mcpTools MCP工具列表
   * @returns OpenAI格式的工具定义
   */
  protected convertMcpToolsToOpenAIFormat(mcpTools: MCPTool[]): any[] {
    return mcpTools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name || tool.id,
        description: tool.description || '',
        parameters: tool.inputSchema || { type: 'object', properties: {} }
      }
    }));
  }
}
