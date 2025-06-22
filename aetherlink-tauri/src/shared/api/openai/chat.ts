/**
 * OpenAI 统一聊天模块
 * 负责处理所有OpenAI聊天相关的业务逻辑
 * 提供统一的聊天接口，消除重复代码
 */
import type { Message, Model, MCPTool } from '../../types';
import type { Chunk } from '../../types/chunk';
import { logApiRequest } from '../../services/LoggerService';
import { OpenAIProvider } from './provider';

/**
 * 聊天选项接口
 */
export interface ChatOptions {
  onUpdate?: (content: string, reasoning?: string) => void;
  onChunk?: (chunk: Chunk) => void;
  enableWebSearch?: boolean;
  systemPrompt?: string;
  enableTools?: boolean;
  mcpTools?: MCPTool[];
  mcpMode?: 'prompt' | 'function';
  abortSignal?: AbortSignal;
  assistant?: any;
}

/**
 * 聊天响应接口
 */
export interface ChatResponse {
  content: string;
  reasoning?: string;
  reasoningTime?: number;
}

/**
 * 标准化后的聊天选项接口
 */
interface NormalizedChatOptions {
  onUpdate?: (content: string, reasoning?: string) => void;
  onChunk?: (chunk: Chunk) => void;
  enableWebSearch: boolean;
  systemPrompt: string;
  enableTools: boolean;
  mcpTools: MCPTool[];
  mcpMode: 'prompt' | 'function';
  abortSignal?: AbortSignal;
  assistant?: any;
}

/**
 * 标准化聊天选项
 */
function normalizeChatOptions(options?: ChatOptions): NormalizedChatOptions {
  return {
    onUpdate: options?.onUpdate,
    onChunk: options?.onChunk,
    enableWebSearch: options?.enableWebSearch ?? true,
    systemPrompt: options?.systemPrompt ?? '',
    enableTools: options?.enableTools ?? true,
    mcpTools: options?.mcpTools ?? [],
    mcpMode: options?.mcpMode ?? 'function',
    abortSignal: options?.abortSignal,
    assistant: options?.assistant
  };
}

/**
 * 验证和标准化消息数组
 */
function validateAndNormalizeMessages(messages: Message[]): Message[] {
  // 检查消息数组是否有效
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    console.warn('[OpenAI Chat] 消息数组为空或无效，创建默认消息');

    // 创建默认消息
    const defaultMessage: Message = {
      id: 'default-' + Date.now(),
      role: 'user',
      assistantId: '',
      topicId: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'success',
      blocks: [],
      content: '您好，请问有什么可以帮助您的？'
    } as any;

    return [defaultMessage];
  }

  return messages;
}

/**
 * 记录聊天请求日志
 */
function logChatRequest(messages: Message[], model: Model, options: NormalizedChatOptions): void {
  console.log(`[OpenAI Chat] 发送聊天请求 - 模型: ${model.id}, 消息数量: ${messages.length}`);
  console.log(`[OpenAI Chat] 配置 - 网页搜索: ${options.enableWebSearch}, 工具: ${options.enableTools}, 系统提示: ${options.systemPrompt ? '有' : '无'}`);

  // 记录API请求到日志服务
  logApiRequest('OpenAI Chat', 'INFO', {
    method: 'POST',
    model: model.id,
    provider: model.provider,
    messagesCount: messages.length,
    enableWebSearch: options.enableWebSearch,
    enableTools: options.enableTools,
    mcpToolsCount: options.mcpTools?.length || 0,
    hasSystemPrompt: Boolean(options.systemPrompt),
    timestamp: Date.now(),
    messages: messages.map(msg => ({
      id: msg.id,
      role: msg.role,
      blocks: msg.blocks
    }))
  });
}

/**
 * 处理聊天错误
 */
function handleChatError(error: any, model: Model): never {
  console.error('[OpenAI Chat] 聊天请求失败:', error);
  console.error('[OpenAI Chat] 错误详情:', {
    message: error instanceof Error ? error.message : '未知错误',
    model: model.id,
    provider: model.provider,
    stack: error instanceof Error ? error.stack : undefined
  });

  // 检查是否为中断错误
  if (error?.name === 'AbortError' || error?.message?.includes('aborted')) {
    throw new DOMException('Operation aborted', 'AbortError');
  }

  // 重新抛出原始错误
  throw error;
}

/**
 * 统一的聊天消息发送接口
 * 这是OpenAI聊天功能的统一入口点
 *
 * @param messages 消息数组
 * @param model 模型配置
 * @param options 聊天选项
 * @returns 聊天响应
 */
export async function sendChatMessage(
  messages: Message[],
  model: Model,
  options?: ChatOptions
): Promise<string | ChatResponse> {
  try {
    // 检查是否已被中断
    if (options?.abortSignal?.aborted) {
      throw new DOMException('Operation aborted', 'AbortError');
    }

    // 标准化选项
    const normalizedOptions = normalizeChatOptions(options);

    // 验证和标准化消息
    const validatedMessages = validateAndNormalizeMessages(messages);

    // 记录请求日志
    logChatRequest(validatedMessages, model, normalizedOptions);

    // 创建Provider实例
    const provider = new OpenAIProvider(model);

    // 记录工具状态
    if (normalizedOptions.enableTools) {
      if (normalizedOptions.enableWebSearch && model.capabilities?.webSearch) {
        console.log(`[OpenAI Chat] 启用网页搜索功能`);
      }
      if (normalizedOptions.mcpTools && normalizedOptions.mcpTools.length > 0) {
        console.log(`[OpenAI Chat] 启用 ${normalizedOptions.mcpTools.length} 个MCP工具`);
      }
    } else {
      console.log(`[OpenAI Chat] 工具功能已禁用`);
    }

    // 调用Provider发送消息
    const result = await provider.sendChatMessage(validatedMessages, {
      onUpdate: normalizedOptions.onUpdate,
      onChunk: normalizedOptions.onChunk,
      enableWebSearch: normalizedOptions.enableWebSearch,
      systemPrompt: normalizedOptions.systemPrompt,
      enableTools: normalizedOptions.enableTools,
      mcpTools: normalizedOptions.mcpTools,
      mcpMode: normalizedOptions.mcpMode,
      abortSignal: normalizedOptions.abortSignal,
      assistant: normalizedOptions.assistant
    });

    console.log(`[OpenAI Chat] 聊天请求成功完成`);
    return result;

  } catch (error) {
    handleChatError(error, model);
  }
}

/**
 * 兼容性函数：保持旧的API接口
 * @deprecated 请使用 sendChatMessage 替代
 */
export async function sendChatRequest(
  messages: Message[],
  model: Model,
  onUpdate?: (content: string, reasoning?: string) => void,
  abortSignal?: AbortSignal
): Promise<string | ChatResponse> {
  console.warn('[OpenAI Chat] sendChatRequest 已废弃，请使用 sendChatMessage');

  return sendChatMessage(messages, model, {
    onUpdate,
    abortSignal
  });
}
