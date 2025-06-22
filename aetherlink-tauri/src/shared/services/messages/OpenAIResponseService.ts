import { v4 as uuidv4 } from 'uuid';
import store from '../../store';
import { newMessagesActions } from '../../store/slices/newMessagesSlice';
import { OpenAIResponseProvider } from '../../providers/OpenAIResponseProvider';
import { OpenAIResponseHandler } from './OpenAIResponseHandler';
import type { Model, MCPTool } from '../../types';
import type { Message, AssistantMessageStatus } from '../../types/newMessage';
import { EventEmitter } from '../EventService';
import { getMainTextContent } from '../../utils/messageUtils';

/**
 * OpenAI Responses API 消息服务
 * 专门处理使用 OpenAI Responses API 的消息生成
 */
export class OpenAIResponseService {
  private provider: OpenAIResponseProvider;
  private model: Model;

  constructor(model: Model) {
    this.model = model;
    this.provider = new OpenAIResponseProvider(model);
  }

  /**
   * 发送聊天消息
   */
  public async sendChatMessage(
    messages: Message[],
    options: {
      assistant?: any;
      mcpTools?: MCPTool[];
      topicId: string;
      onProgress?: (content: string) => void;
      onComplete?: (content: string) => void;
      onError?: (error: Error) => void;
    }
  ): Promise<void> {
    const { assistant, mcpTools = [], topicId, onProgress, onComplete, onError } = options;

    try {
      // 创建助手消息
      const messageId = uuidv4();
      const blockId = uuidv4();

      // 创建消息实体
      const assistantMessage: Message = {
        id: messageId,
        topicId,
        role: 'assistant',
        assistantId: assistant?.id || 'default',
        blocks: [blockId],
        status: 'streaming' as AssistantMessageStatus,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        modelId: this.model.id,
        model: this.model
      };

      // 添加消息到 Redux store
      store.dispatch(newMessagesActions.addMessage({
        topicId,
        message: assistantMessage
      }));

      // 创建响应处理器
      const responseHandler = new OpenAIResponseHandler({
        messageId,
        blockId,
        topicId
      });

      // 设置进度回调
      let accumulatedContent = '';
      const handleChunk = (chunk: any) => {
        responseHandler.handleChunk(chunk);

        // 处理文本增量
        if (chunk.type === 'text.delta' && chunk.text) {
          accumulatedContent += chunk.text;
          if (onProgress) {
            onProgress(accumulatedContent);
          }
        }

        // 处理完成
        if (chunk.type === 'llm_response_complete') {
          if (onComplete) {
            onComplete(accumulatedContent);
          }
        }

        // 处理错误
        if (chunk.type === 'error') {
          const error = new Error(chunk.error?.message || '响应处理失败');
          if (onError) {
            onError(error);
          }
        }
      };

      // 调用 OpenAI Responses API
      await this.provider.completions({
        messages: this.convertMessagesToAPIFormat(messages),
        assistant: assistant || this.getDefaultAssistant(),
        mcpTools,
        onChunk: handleChunk,
        onFilterMessages: (filteredMessages) => {
          console.log(`[OpenAIResponseService] 过滤后的消息数量: ${filteredMessages.length}`);
        }
      });

    } catch (error) {
      console.error('[OpenAIResponseService] 发送聊天消息失败:', error);
      
      // 发送错误事件
      EventEmitter.emit('ASSISTANT_MESSAGE_ERROR', {
        topicId,
        error: error instanceof Error ? error : new Error('未知错误')
      });

      if (onError) {
        onError(error instanceof Error ? error : new Error('未知错误'));
      }

      throw error;
    }
  }

  /**
   * 转换消息为 Responses API input 格式
   */
  private convertMessagesToAPIFormat(messages: Message[]): any[] {
    return messages.map(message => {
      // 使用 getMainTextContent 从消息块中提取内容
      const textContent = getMainTextContent(message);

      // 根据 Responses API 格式构建消息
      if (message.role === 'assistant') {
        return {
          role: 'assistant',
          content: textContent
        };
      } else {
        // 用户和系统消息使用 input_text 格式
        return {
          role: message.role === 'system' ? 'user' : message.role,
          content: textContent ? [{ type: 'input_text', text: textContent }] : []
        };
      }
    });
  }

  /**
   * 获取默认助手配置
   */
  private getDefaultAssistant(): any {
    return {
      temperature: 0.7,
      maxTokens: 4096,
      topP: 1.0,
      frequencyPenalty: 0,
      presencePenalty: 0
    };
  }

  /**
   * 测试连接
   */
  public async testConnection(): Promise<boolean> {
    try {
      // 发送一个简单的测试消息
      const testMessages = [{
        role: 'user',
        content: 'Hello'
      }];

      await this.provider.completions({
        messages: testMessages,
        assistant: this.getDefaultAssistant(),
        mcpTools: [],
        onChunk: () => {}, // 空回调
        onFilterMessages: () => {}
      });

      return true;
    } catch (error) {
      console.error('[OpenAIResponseService] 连接测试失败:', error);
      return false;
    }
  }

  /**
   * 获取模型信息
   */
  public getModelInfo(): Model {
    return this.model;
  }

  /**
   * 检查是否支持流式输出
   */
  public supportsStreaming(): boolean {
    return true;
  }

  /**
   * 检查是否支持工具调用
   */
  public supportsTools(): boolean {
    return true;
  }

  /**
   * 检查是否支持多模态
   */
  public supportsMultimodal(): boolean {
    // 基于模型ID判断是否支持多模态
    const multimodalModels = [
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4-vision-preview',
      'gpt-4-turbo'
    ];

    return multimodalModels.some(modelId => 
      this.model.id.includes(modelId)
    );
  }

  /**
   * 获取支持的功能列表
   */
  public getSupportedFeatures(): string[] {
    const features = ['chat', 'streaming'];

    if (this.supportsTools()) {
      features.push('tools');
    }

    if (this.supportsMultimodal()) {
      features.push('vision', 'multimodal');
    }

    // 检查是否支持推理
    if (this.model.id.includes('o1')) {
      features.push('reasoning');
    }

    return features;
  }

  /**
   * 清理资源
   */
  public dispose(): void {
    // 清理任何需要清理的资源
    console.log('[OpenAIResponseService] 服务已清理');
  }
}

/**
 * 创建 OpenAI Response Service 实例
 */
export function createOpenAIResponseService(model: Model): OpenAIResponseService {
  return new OpenAIResponseService(model);
}

/**
 * 检查模型是否支持 OpenAI Responses API
 */
export function isOpenAIResponsesAPISupported(model: Model): boolean {
  const supportedModels = [
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4o-2024-11-20',
    'gpt-4o-2024-08-06',
    'gpt-4o-mini-2024-07-18',
    'o1-preview',
    'o1-mini'
  ];

  return supportedModels.includes(model.id) || 
         model.provider === 'openai' && (model as any).useResponsesAPI === true;
}

export default OpenAIResponseService;
