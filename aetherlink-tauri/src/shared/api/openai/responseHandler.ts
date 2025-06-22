/**
 * OpenAI响应处理模块 - 类似最佳实例OpenAIResponseProvider
 * 负责处理特殊的API响应格式和错误处理
 */
import type { Model } from '../../types';

/**
 * 响应处理配置
 */
interface ResponseHandlerConfig {
  enableSpecialHandling?: boolean;
  enableErrorRetry?: boolean;
  maxRetries?: number;
  retryDelay?: number;
}

/**
 * 特殊响应处理器
 */
export class ResponseHandler {
  private config: ResponseHandlerConfig;

  constructor(config: ResponseHandlerConfig = {}) {
    this.config = {
      enableSpecialHandling: true,
      enableErrorRetry: true,
      maxRetries: 3,
      retryDelay: 1000,
      ...config
    };
  }

  /**
   * 处理流式响应 - 特殊格式处理
   * @param response 原始响应
   * @param model 模型配置
   * @param onUpdate 更新回调
   * @returns 处理后的响应
   */
  async handleStreamResponse(
    response: any,
    model: Model,
    onUpdate?: (content: string, reasoning?: string) => void
  ): Promise<string | { content: string; reasoning?: string; reasoningTime?: number }> {
    try {
      let content = '';
      let reasoning = '';
      let reasoningTime = 0;
      const startTime = Date.now();

      // 检查是否需要特殊处理
      if (this.needsSpecialHandling(model)) {
        console.log(`[ResponseHandler] 启用特殊响应处理 - 模型: ${model.id}`);
      }

      // 处理流式数据 - 支持 Responses API 和 Chat Completions API
      for await (const chunk of response) {
        // 处理 Responses API 格式
        if (chunk.type) {
          switch (chunk.type) {
            case 'response.output_text.delta':
              if (chunk.delta) {
                content += chunk.delta;
                onUpdate?.(content, reasoning);
              }
              break;

            case 'response.output_text.done':
              if (chunk.text) {
                content = chunk.text;
                onUpdate?.(content, reasoning);
              }
              break;

            case 'response.reasoning.delta':
              if (chunk.delta) {
                reasoning += chunk.delta;
                onUpdate?.(content, reasoning);
              }
              break;

            case 'response.reasoning.done':
              if (chunk.reasoning) {
                reasoning = chunk.reasoning;
                onUpdate?.(content, reasoning);
              }
              break;
          }
          continue;
        }

        // 处理 Chat Completions API 格式（向后兼容）
        const delta = chunk.choices?.[0]?.delta;
        if (!delta) continue;

        // 处理普通内容
        if (delta.content) {
          content += delta.content;
          onUpdate?.(content, reasoning);
        }

        // 处理推理内容（如果存在）
        if (delta.reasoning) {
          reasoning += delta.reasoning;
          onUpdate?.(content, reasoning);
        }

        // 处理特殊格式的响应
        if (this.config.enableSpecialHandling) {
          const specialContent = this.extractSpecialContent(delta, model);
          if (specialContent) {
            content += specialContent;
            onUpdate?.(content, reasoning);
          }
        }
      }

      // 计算推理时间
      if (reasoning) {
        reasoningTime = Date.now() - startTime;
      }

      // 返回结果
      if (reasoning) {
        return { content, reasoning, reasoningTime };
      }
      return content;

    } catch (error) {
      console.error('[ResponseHandler] 流式响应处理失败:', error);
      
      // 错误重试机制
      if (this.config.enableErrorRetry) {
        return this.handleErrorWithRetry(error, model);
      }
      
      throw error;
    }
  }

  /**
   * 处理非流式响应
   * @param response 原始响应
   * @param model 模型配置
   * @returns 处理后的响应
   */
  handleNonStreamResponse(response: any, model: Model): string | { content: string; reasoning?: string } {
    try {
      let content = '';
      let reasoning = '';

      // 处理 Responses API 格式
      if (response.output_text) {
        content = response.output_text;
      } else if (response.output && Array.isArray(response.output)) {
        // 处理 output 数组格式
        for (const output of response.output) {
          if (output.type === 'message' && output.content) {
            for (const contentItem of output.content) {
              if (contentItem.type === 'output_text') {
                content += contentItem.text || '';
              }
            }
          } else if (output.type === 'reasoning') {
            reasoning += output.content || '';
          }
        }
      }

      // 处理推理内容
      if (response.reasoning) {
        reasoning = response.reasoning;
      }

      // 向后兼容 Chat Completions API 格式
      if (!content && !reasoning) {
        const choice = response.choices?.[0];
        if (!choice) {
          throw new Error('响应中没有找到有效的选择项');
        }

        const message = choice.message;
        content = message.content || '';
        reasoning = message.reasoning || '';

        // 特殊格式处理
        if (this.config.enableSpecialHandling) {
          const specialContent = this.extractSpecialContent(message, model);
          if (specialContent) {
            content += specialContent;
          }
        }
      }

      // 返回结果
      if (reasoning) {
        return { content, reasoning };
      }
      return content;

    } catch (error) {
      console.error('[ResponseHandler] 非流式响应处理失败:', error);
      throw error;
    }
  }

  /**
   * 检查是否需要特殊处理
   * @param model 模型配置
   * @returns 是否需要特殊处理
   */
  private needsSpecialHandling(model: Model): boolean {
    const modelId = model.id.toLowerCase();
    
    // Azure OpenAI可能需要特殊处理
    if (model.provider === 'azure-openai') {
      return true;
    }

    // 推理模型需要特殊处理
    if (modelId.includes('o1') || modelId.includes('reasoning')) {
      return true;
    }

    // 某些特定供应商可能需要特殊处理
    if (model.provider === 'custom' && model.baseUrl) {
      return true;
    }

    return false;
  }

  /**
   * 提取特殊内容
   * @param delta 响应增量
   * @param model 模型配置
   * @returns 特殊内容
   */
  private extractSpecialContent(delta: any, model: Model): string | null {
    // Azure OpenAI特殊格式处理
    if (model.provider === 'azure-openai') {
      if (delta.azure_content) {
        return delta.azure_content;
      }
    }

    // 自定义供应商特殊格式处理
    if (model.provider === 'custom') {
      if (delta.custom_content || delta.text) {
        return delta.custom_content || delta.text;
      }
    }

    return null;
  }

  /**
   * 错误重试处理
   * @param error 错误对象
   * @param model 模型配置
   * @returns 重试结果
   */
  private async handleErrorWithRetry(error: any, model: Model): Promise<string> {
    console.log(`[ResponseHandler] 开始错误重试 - 模型: ${model.id}`);
    
    // 这里可以实现重试逻辑
    // 目前简单返回错误信息
    return `响应处理出现错误: ${error.message}`;
  }
}

/**
 * 创建响应处理器实例
 * @param model 模型配置
 * @returns 响应处理器实例
 */
export function createResponseHandler(model: Model): ResponseHandler {
  const config: ResponseHandlerConfig = {
    enableSpecialHandling: true,
    enableErrorRetry: true,
    maxRetries: 3,
    retryDelay: 1000
  };

  // 根据模型类型调整配置
  if (model.provider === 'azure-openai') {
    config.enableSpecialHandling = true;
  }

  return new ResponseHandler(config);
}

/**
 * 默认响应处理器实例
 */
export const defaultResponseHandler = new ResponseHandler();
