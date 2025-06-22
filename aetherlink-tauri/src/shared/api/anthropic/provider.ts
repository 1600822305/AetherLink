/**
 * Anthropic Provider模块
 * 提供类似最佳实例的Provider类实现
 */
import Anthropic from '@anthropic-ai/sdk';
import type { Message, Model, MCPTool } from '../../types';
import { logApiRequest, logApiResponse } from '../../services/LoggerService';
import { createClient } from './client';
import { getMainTextContent } from '../../utils/messageUtils';
import { AbstractBaseProvider } from '../baseProvider';
import { getAppSettings } from '../../utils/settingsUtils';

/**
 * 基础Provider抽象类
 */
export abstract class BaseProvider extends AbstractBaseProvider {
  protected client: Anthropic;

  constructor(model: Model) {
    super(model);
    this.client = createClient(model);
  }

  /**
   * 将 MCP 工具转换为 Anthropic 工具格式
   */
  public convertMcpTools<T>(mcpTools: MCPTool[]): T[] {
    // 临时同步实现，避免 require 错误
    return mcpTools.map((tool) => {
      // 清理工具名称，确保符合 Anthropic 的要求
      let toolName = tool.id || tool.name;

      // 如果名称以数字开头，添加前缀
      if (/^\d/.test(toolName)) {
        toolName = `mcp_${toolName}`;
      }

      // 移除不允许的字符，只保留字母、数字、下划线
      toolName = toolName.replace(/[^a-zA-Z0-9_]/g, '_');

      // 确保名称不超过64个字符
      if (toolName.length > 64) {
        toolName = toolName.substring(0, 64);
      }

      // 确保名称以字母或下划线开头
      if (!/^[a-zA-Z_]/.test(toolName)) {
        toolName = `tool_${toolName}`;
      }

      console.log(`[Anthropic] 转换工具名称: ${tool.id || tool.name} -> ${toolName}`);

      return {
        name: toolName,
        description: tool.description,
        input_schema: tool.inputSchema
      };
    }) as T[];
  }

  /**
   * 发送聊天消息
   */
  abstract sendChatMessage(
    messages: Message[],
    options?: {
      onUpdate?: (content: string, reasoning?: string) => void;
      enableWebSearch?: boolean;
      enableThinking?: boolean;
      enableTools?: boolean;
      mcpTools?: import('../../types').MCPTool[];
      mcpMode?: 'prompt' | 'function'; // 添加 MCP 模式参数
      systemPrompt?: string;
      abortSignal?: AbortSignal;
    }
  ): Promise<string | { content: string; reasoning?: string; reasoningTime?: number }>;

  /**
   * 测试API连接
   */
  abstract testConnection(): Promise<boolean>;

  /**
   * 获取模型列表
   */
  abstract getModels(): Promise<any[]>;
}

/**
 * Anthropic Provider实现
 */
export class AnthropicProvider extends BaseProvider {
  constructor(model: Model) {
    super(model);
  }

  /**
   * 获取温度参数
   * @param assistant 助手配置（可选）
   */
  private getTemperature(assistant?: any): number {
    // 优先使用助手设置，然后是模型设置，最后是默认值
    const temperature = assistant?.settings?.temperature ?? assistant?.temperature ?? this.model.temperature ?? 0.7;

    console.log(`[AnthropicProvider] temperature参数 - 助手设置: ${assistant?.settings?.temperature}, 助手直接设置: ${assistant?.temperature}, 模型设置: ${this.model.temperature}, 最终值: ${temperature}`);

    return temperature;
  }

  /**
   * 获取最大令牌数
   * @param assistant 助手配置（可选）
   */
  private getMaxTokens(assistant?: any): number {
    // 优先使用助手设置，然后是模型设置，最后是默认值
    const maxTokens = assistant?.settings?.maxTokens ?? assistant?.maxTokens ?? this.model.maxTokens ?? 4096;

    // 确保值在合理范围内（最小1）
    const finalTokens = Math.max(maxTokens, 1);

    console.log(`[AnthropicProvider] maxTokens参数 - 助手设置: ${assistant?.settings?.maxTokens}, 助手直接设置: ${assistant?.maxTokens}, 模型设置: ${this.model.maxTokens}, 最终值: ${finalTokens}`);

    return finalTokens;
  }

  /**
   * 获取消息内容 - 最佳实例风格的消息内容提取
   * @param message 消息对象
   * @returns 消息内容
   */
  private getMessageContent(message: Message): string {
    try {
      // 尝试从块中获取内容
      if (message.blocks && Array.isArray(message.blocks) && message.blocks.length > 0) {
        // 使用getMainTextContent函数获取文本内容
        return getMainTextContent(message);
      }

      // 兼容旧版本 - 直接使用content属性
      if (typeof (message as any).content === 'string') {
        return (message as any).content;
      } else if (typeof (message as any).content === 'object' && (message as any).content) {
        if ('text' in (message as any).content) {
          return (message as any).content.text || '';
        }
      }

      // 默认返回空字符串
      return '';
    } catch (error) {
      console.error('[AnthropicProvider.getMessageContent] 获取消息内容失败:', error);
      return '';
    }
  }

  /**
   * 发送聊天消息 - 最佳实例风格的消息处理
   */
  async sendChatMessage(
    messages: Message[],
    options?: {
      onUpdate?: (content: string, reasoning?: string) => void;
      enableWebSearch?: boolean;
      enableThinking?: boolean;
      enableTools?: boolean;
      mcpTools?: MCPTool[];
      mcpMode?: 'prompt' | 'function'; // 添加 MCP 模式参数
      systemPrompt?: string;
      abortSignal?: AbortSignal;
      assistant?: any; // 添加助手参数以获取设置
    }
  ): Promise<string | { content: string; reasoning?: string; reasoningTime?: number }> {
    try {
      console.log(`[AnthropicProvider.sendChatMessage] 开始处理聊天请求, 模型: ${this.model.id}, 消息数量: ${messages.length}`);

      const {
        onUpdate,
        enableWebSearch = false,
        enableThinking = false,
        enableTools = true,
        mcpTools = [],
        mcpMode = 'function', // 默认使用函数调用模式
        systemPrompt = '',
        abortSignal,
        assistant // 助手参数
      } = options || {};

      // 使用变量避免未使用警告
      void enableWebSearch;
      void enableThinking;
      void abortSignal;

      // 智能工具配置设置
      const { tools } = this.setupToolsConfig({
        mcpTools,
        model: this.model,
        enableToolUse: enableTools,
        mcpMode: mcpMode // 传递 MCP 模式
      });

      // 准备消息数组 - 最佳实例风格的消息处理
      const anthropicMessages = [];
      let systemMessage = null;

      // 处理所有消息
      for (const message of messages) {
        // 获取消息内容
        const content = this.getMessageContent(message);

        // 只处理有内容的消息
        if (content.trim()) {
          // 系统消息单独处理
          if (message.role === 'system') {
            systemMessage = { content };
            console.log(`[AnthropicProvider.sendChatMessage] 提取系统消息: ${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`);
          } else {
            // 用户和助手消息添加到消息数组
            // Anthropic只支持user和assistant角色
            const role = message.role === 'user' ? 'user' : 'assistant';

            anthropicMessages.push({
              role,
              content
            });

            console.log(`[AnthropicProvider.sendChatMessage] 添加消息: role=${role}, content=${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`);
          }
        }
      }

      // 确保至少有一条用户消息 - 最佳实例风格的安全检查
      if (anthropicMessages.length === 0 || !anthropicMessages.some(msg => msg.role === 'user')) {
        console.warn('[AnthropicProvider.sendChatMessage] 警告: 消息列表中没有用户消息，添加默认用户消息');

        // 添加一个默认的用户消息
        anthropicMessages.push({
          role: 'user',
          content: '你好'
        });

        console.log('[AnthropicProvider.sendChatMessage] 添加默认用户消息: 你好');
      }

      // 强制检查：确保anthropicMessages数组不为空
      if (anthropicMessages.length === 0) {
        console.error('[AnthropicProvider.sendChatMessage] 严重错误: 消息数组为空，添加默认消息');

        // 添加一个默认的用户消息
        anthropicMessages.push({
          role: 'user',
          content: '你好'
        });

        console.log('[AnthropicProvider.sendChatMessage] 添加默认用户消息: 你好');
      }

      // 记录最终消息数组
      console.log(`[AnthropicProvider.sendChatMessage] 最终消息数组:`, JSON.stringify(anthropicMessages));

      // 记录API请求
      logApiRequest('Anthropic API', 'INFO', {
        method: 'POST',
        model: this.model.id,
        messageCount: anthropicMessages.length,
        hasSystemPrompt: !!systemMessage
      });

      // 准备请求参数 - 从助手设置中获取参数
      const requestParams: any = {
        model: this.model.id,
        messages: anthropicMessages,
        temperature: this.getTemperature(assistant) // 传递助手参数
      };

      // 检查是否启用了最大输出Token参数
      const appSettings = getAppSettings();
      if (appSettings.enableMaxOutputTokens !== false) {
        requestParams.max_tokens = this.getMaxTokens(assistant);
      } else {
        console.log(`[AnthropicProvider] 最大输出Token已禁用，从API参数中移除max_tokens`);
      }

      // 添加调试日志显示使用的参数
      console.log(`[AnthropicProvider] API请求参数:`, {
        model: requestParams.model,
        temperature: requestParams.temperature,
        max_tokens: requestParams.max_tokens,
        assistantInfo: assistant ? {
          id: assistant.id,
          name: assistant.name,
          temperature: assistant.temperature,
          maxTokens: assistant.maxTokens
        } : '无助手信息'
      });

      // 构建系统提示词（包含智能工具注入）
      let finalSystemPrompt = systemPrompt;
      if (systemMessage && typeof systemMessage.content === 'string') {
        finalSystemPrompt = systemMessage.content;
      } else if (systemMessage && systemMessage.content && typeof systemMessage.content === 'object') {
        const content = systemMessage.content as any;
        finalSystemPrompt = content.text || '';
      }

      // 使用智能工具注入机制
      const systemPromptWithTools = this.buildSystemPromptWithTools(finalSystemPrompt, mcpTools);
      if (systemPromptWithTools.trim()) {
        requestParams.system = systemPromptWithTools;
      }

      // 添加 MCP 工具支持（仅在函数调用模式下）
      if (enableTools && !this.getUseSystemPromptForTools() && tools.length > 0) {
        requestParams.tools = tools;
        console.log(`[AnthropicProvider] 函数调用模式：添加 ${tools.length} 个 MCP 工具`);
      } else if (enableTools && this.getUseSystemPromptForTools() && mcpTools && mcpTools.length > 0) {
        console.log(`[AnthropicProvider] 系统提示词模式：${mcpTools.length} 个工具已注入到系统提示词中`);
      }

      // 如果有onUpdate回调，使用流式响应
      if (onUpdate) {
        requestParams.stream = true;

        // 创建流式响应
        const stream = await this.client.messages.create({
          ...requestParams
        });

        let fullResponse = '';

        // 处理流式响应
        for await (const chunk of stream as any) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            const chunkText = chunk.delta.text;
            fullResponse += chunkText;
            onUpdate(fullResponse);
          }
        }

        // 记录API响应
        logApiResponse('Anthropic API Stream', 200, {
          model: this.model.id,
          content: fullResponse.substring(0, 100) + (fullResponse.length > 100 ? '...' : '')
        });

        return fullResponse;
      } else {
        // 非流式响应
        const response = await this.client.messages.create({
          ...requestParams
        });

        // 提取响应文本
        let responseText = '';
        if (response.content && response.content.length > 0) {
          for (const block of response.content) {
            if (block.type === 'text') {
              responseText += block.text;
            }
          }
        }

        // 记录API响应
        logApiResponse('Anthropic API', 200, {
          model: this.model.id,
          content: responseText.substring(0, 100) + (responseText.length > 100 ? '...' : '')
        });

        return responseText;
      }
    } catch (error) {
      console.error('Anthropic API请求失败:', error);
      throw error;
    }
  }

  /**
   * 测试API连接
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.messages.create({
        model: this.model.id,
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 5,
      });

      return Boolean(response.content && response.content.length > 0);
    } catch (error) {
      console.error('Anthropic API连接测试失败:', error);
      return false;
    }
  }

  /**
   * 获取模型列表
   */
  async getModels(): Promise<any[]> {
    try {
      // 尝试获取模型列表
      const response = await fetch('https://api.anthropic.com/v1/models', {
        headers: {
          'x-api-key': this.model.apiKey || '',
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        } as HeadersInit
      });

      if (!response.ok) {
        throw new Error(`API请求失败: ${response.status}`);
      }

      const data = await response.json();

      if (data.data && Array.isArray(data.data)) {
        // 转换为标准格式
        return data.data.map((model: any) => ({
          id: model.id,
          name: model.name || model.id,
          description: model.description || '',
          object: 'model',
          created: Date.now(),
          owned_by: 'anthropic'
        }));
      }

      throw new Error('未找到模型数据');
    } catch (error) {
      console.error('获取Anthropic模型列表失败:', error);

      // 返回预设模型列表
      return [
        { id: 'claude-3-5-sonnet-20240620', name: 'Claude 3.5 Sonnet', description: 'Claude 3.5 Sonnet - 最新的Claude模型', owned_by: 'anthropic' },
        { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', description: 'Claude 3 Opus - 最强大的Claude模型', owned_by: 'anthropic' },
        { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet', description: 'Claude 3 Sonnet - 平衡性能和速度', owned_by: 'anthropic' },
        { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', description: 'Claude 3 Haiku - 最快的Claude模型', owned_by: 'anthropic' },
        { id: 'claude-2.1', name: 'Claude 2.1', description: 'Claude 2.1 - 旧版Claude模型', owned_by: 'anthropic' }
      ];
    }
  }
}

/**
 * 创建Provider实例
 */
export function createProvider(model: Model): AnthropicProvider {
  return new AnthropicProvider(model);
}