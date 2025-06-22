/**
 * 模型组合提供商
 * 负责处理模型组合的聊天请求
 */
import type { Message, Model, MCPTool } from '../../types';
import { getMainTextContent, createMessage } from '../../utils/messageUtils';
import { ApiProviderRegistry } from './ApiProvider';
import store from '../../store';

export class ModelComboProvider {
  private model: Model;

  constructor(model: Model) {
    this.model = model;
    console.log(`[ModelComboProvider] 初始化模型组合提供商: ${model.id}`);
  }

  /**
   * 发送聊天消息
   * @param messages 消息数组
   * @param options 选项
   * @returns 响应内容
   */
  async sendChatMessage(
    messages: Message[],
    options?: {
      onUpdate?: (content: string, reasoning?: string) => void;
      onChunk?: (chunk: any) => void;
      enableWebSearch?: boolean;
      enableThinking?: boolean;
      enableTools?: boolean;
      tools?: string[];
      mcpTools?: MCPTool[];
      systemPrompt?: string;
      abortSignal?: AbortSignal;
    }
  ): Promise<string | { content: string; reasoning?: string; reasoningTime?: number }> {
    try {
      console.log(`[ModelComboProvider] 开始处理模型组合请求: ${this.model.id}`);

      // 从模型配置中获取组合配置
      const comboConfig = (this.model as any).comboConfig;
      if (!comboConfig) {
        throw new Error(`模型组合 ${this.model.id} 的配置信息不存在`);
      }

      console.log(`[ModelComboProvider] 传递完整消息历史，消息数量: ${messages.length}`);
      console.log(`[ModelComboProvider] 组合策略: ${comboConfig.strategy}`);

      // 根据策略选择执行方法
      if (comboConfig.strategy === 'comparison') {
        return await this.executeComparisonStrategy(comboConfig, messages, options);
      } else {
        // 默认使用顺序策略
        return await this.executeComboWithStreaming(comboConfig, messages, options);
      }
    } catch (error) {
      console.error('[ModelComboProvider] 模型组合请求失败:', error);
      throw new Error(`模型组合执行失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 执行对比策略 - 并行调用多个模型，返回所有结果供用户选择
   */
  private async executeComparisonStrategy(
    comboConfig: any,
    messages: Message[],
    options?: {
      onUpdate?: (content: string, reasoning?: string) => void;
      onChunk?: (chunk: any) => void;
      abortSignal?: AbortSignal;
    }
  ): Promise<{ content: string; reasoning?: string; reasoningTime?: number; comboResult?: any }> {
    const startTime = Date.now();
    console.log(`[ModelComboProvider] 执行对比策略，模型数量: ${comboConfig.models.length}`);

    // 使用静态导入的 ApiProviderRegistry
    const modelResults: any[] = [];

    // 并行调用所有模型
    const promises = comboConfig.models.map(async (modelConfig: any) => {
      try {
        console.log(`[ModelComboProvider] 调用模型: ${modelConfig.modelId}`);

        const model = await this.getModelById(modelConfig.modelId);
        if (!model) {
          throw new Error(`找不到模型: ${modelConfig.modelId}`);
        }

        const provider = ApiProviderRegistry.get(model);

        // 调用模型
        const response = await provider.sendChatMessage(messages, {
          onUpdate: (content: string, reasoning?: string) => {
            // 对比策略中，我们不实时显示单个模型的输出
            // 而是等所有模型完成后一起显示
            console.log(`[ModelComboProvider] 模型 ${modelConfig.modelId} 更新: ${content.length} 字符${reasoning ? ', 推理: ' + reasoning.length + ' 字符' : ''}`);
          }
        });

        let content = '';
        let reasoning = '';

        if (typeof response === 'string') {
          content = response;
        } else if (response && typeof response === 'object') {
          content = response.content || '';
          reasoning = response.reasoning || '';
        }

        return {
          modelId: modelConfig.modelId,
          role: modelConfig.role || 'assistant',
          content,
          reasoning,
          confidence: 0.8,
          cost: 0,
          latency: Date.now() - startTime,
          status: 'success' as const
        };
      } catch (error) {
        console.error(`[ModelComboProvider] 模型 ${modelConfig.modelId} 调用失败:`, error);
        return {
          modelId: modelConfig.modelId,
          role: modelConfig.role || 'assistant',
          content: `模型调用失败: ${error instanceof Error ? error.message : '未知错误'}`,
          cost: 0,
          latency: Date.now() - startTime,
          status: 'error' as const,
          error: error instanceof Error ? error.message : '未知错误'
        };
      }
    });

    const results = await Promise.all(promises);
    modelResults.push(...results);

    const totalLatency = Date.now() - startTime;
    const successResults = results.filter(r => r.status === 'success');

    // 构造对比结果
    const comboResult = {
      comboId: this.model.id,
      strategy: 'comparison' as const,
      modelResults: results,
      finalResult: {
        content: '', // 对比策略没有最终结果，由用户选择
        confidence: 0,
        explanation: '请从多个模型的回答中选择最佳答案'
      },
      stats: {
        totalCost: results.reduce((sum, r) => sum + (r.cost || 0), 0),
        totalLatency,
        modelsUsed: successResults.length,
        strategy: 'comparison'
      },
      timestamp: new Date().toISOString(),
      comparisonData: {
        allResults: results,
        selectedResult: null,
        userSelection: false
      }
    };

    console.log(`[ModelComboProvider] 对比策略完成，成功模型: ${successResults.length}/${results.length}`);

    // 通过特殊的更新回调通知前端创建对比块
    if (options?.onUpdate) {
      // 发送特殊标记，告诉前端这是对比结果
      options.onUpdate('__COMPARISON_RESULT__', JSON.stringify(comboResult));
    }

    // 返回特殊格式，包含对比结果
    return {
      content: '__COMPARISON_RESULT__', // 特殊标记
      reasoning: JSON.stringify(comboResult), // 将对比结果放在 reasoning 字段中
      reasoningTime: totalLatency,
      comboResult
    };
  }

  /**
   * 流式执行模型组合（参考 DeepClaude 逻辑）
   */
  private async executeComboWithStreaming(
    comboConfig: any,
    messages: Message[],
    options?: {
      onUpdate?: (content: string, reasoning?: string) => void;
      onChunk?: (chunk: any) => void;
      abortSignal?: AbortSignal;
    }
  ): Promise<{ content: string; reasoning?: string; reasoningTime?: number }> {
    const startTime = Date.now();

    // 按优先级排序模型
    const sortedModels = [...comboConfig.models].sort((a: any, b: any) => (a.priority || 0) - (b.priority || 0));

    if (sortedModels.length < 2) {
      throw new Error('顺序策略需要至少2个模型');
    }

    const thinkingModel = sortedModels[0]; // 推理模型
    const generatingModel = sortedModels[1]; // 生成模型

    let accumulatedReasoning = '';
    let finalContent = '';

    try {
      // 第一阶段：调用推理模型，实时显示推理过程
      console.log(`[ModelComboProvider] 第一阶段：调用推理模型 ${thinkingModel.modelId}`);

      // 直接使用传入的消息历史
      const thinkingMessages: Message[] = messages;

      // 调用推理模型，获取推理过程
      // 注意：我们需要直接使用 Provider 实例而不是 API 模块，因为需要访问 onUpdate 回调
      const thinkingModelConfig = await this.getModelById(thinkingModel.modelId);
      if (!thinkingModelConfig) {
        throw new Error(`找不到推理模型: ${thinkingModel.modelId}`);
      }

      const thinkingProvider = ApiProviderRegistry.get(thinkingModelConfig);

      // 用于收集推理内容的数组（按照参考项目的逻辑）
      const reasoningContent: string[] = [];

      // 创建 Promise 来等待推理完成
      const reasoningPromise = new Promise<string>((resolve, reject) => {
        thinkingProvider.sendChatMessage(thinkingMessages, {
          onUpdate: (content: string, reasoning?: string) => {
            if (reasoning) {
              // 收集推理内容片段（按照参考项目逻辑）
              reasoningContent.push(reasoning);
              console.log(`[ModelComboProvider] 收到推理片段，长度: ${reasoning.length}`);

              // 实时显示推理内容
              if (options?.onUpdate) {
                options.onUpdate('', reasoning);
              }
            }

            // 当收到普通内容时，表示推理阶段结束
            if (content && !reasoning) {
              console.log(`[ModelComboProvider] 推理阶段结束，收到内容: ${content.length} 字符`);
              // 返回完整的推理内容
              const fullReasoning = reasoningContent.join('');
              console.log(`[ModelComboProvider] 推理完成，总长度: ${fullReasoning.length}`);
              resolve(fullReasoning);
            }
          }
        }).catch(reject);
      });

      // 等待推理完成
      const thinkingResponse = await reasoningPromise;
      accumulatedReasoning = thinkingResponse;

      console.log(`[ModelComboProvider] 推理阶段完成，推理内容长度: ${accumulatedReasoning.length}`);

      // 第二阶段：调用生成模型，基于推理结果生成答案
      console.log(`[ModelComboProvider] 第二阶段：调用生成模型 ${generatingModel.modelId}`);

      // 按照参考项目逻辑：直接复制完整消息历史并修改最后一个用户消息
      const generatingMessages: Message[] = JSON.parse(JSON.stringify(messages)); // 深拷贝

      // 构造组合内容（按照参考项目的格式）
      const combinedContent = `
******以上是用户信息*****
以下是另一个模型的推理过程：****
${accumulatedReasoning}

****
基于以上推理过程，结合你的知识，当推理过程与你的知识冲突时，你可以采用自己的知识，这是完全可以接受的。请直接为用户提供完整的答案。你不需要重复请求或进行自己的推理。请务必完整回复：`;

      // 找到最后一个用户消息并修改其内容（按照参考项目逻辑）
      let lastUserMessageFound = false;
      for (let i = generatingMessages.length - 1; i >= 0; i--) {
        if (generatingMessages[i].role === 'user') {
          const originalContent = getMainTextContent(generatingMessages[i]);
          console.log(`[ModelComboProvider] 找到最后一个用户消息，原始内容: ${originalContent.substring(0, 50)}...`);

          const fixedContent = `这是我的原始输入：
${originalContent}

${combinedContent}`;

          console.log(`[ModelComboProvider] 修改后的内容长度: ${fixedContent.length}`);
          console.log(`[ModelComboProvider] 修改后的内容预览: ${fixedContent.substring(0, 200)}...`);

          // 创建新的消息来替换最后一个用户消息
          const { message: modifiedMessage } = createMessage({
            role: 'user',
            content: fixedContent,
            topicId: generatingMessages[i].topicId,
            assistantId: generatingMessages[i].assistantId
          });

          // 为了确保 getMainTextContent 能获取到内容，添加临时的 content 属性
          (modifiedMessage as any).content = fixedContent;

          // 替换最后一个用户消息
          generatingMessages[i] = modifiedMessage;
          lastUserMessageFound = true;
          console.log(`[ModelComboProvider] 已替换索引 ${i} 的用户消息`);
          break;
        }
      }

      if (!lastUserMessageFound) {
        console.error(`[ModelComboProvider] 警告：没有找到用户消息进行修改`);
      }

      console.log(`[ModelComboProvider] 最终消息数组长度: ${generatingMessages.length}`);
      console.log(`[ModelComboProvider] 最后一个消息角色: ${generatingMessages[generatingMessages.length - 1]?.role}`);
      console.log(`[ModelComboProvider] 最后一个消息内容预览: ${getMainTextContent(generatingMessages[generatingMessages.length - 1] || {} as any).substring(0, 100)}...`);

      // 获取生成模型配置并调用
      const generatingModelConfig = await this.getModelById(generatingModel.modelId);
      if (!generatingModelConfig) {
        throw new Error(`找不到生成模型: ${generatingModel.modelId}`);
      }

      const generatingProvider = ApiProviderRegistry.get(generatingModelConfig);

      // 调试：打印即将传递给生成模型的消息
      console.log(`[ModelComboProvider] 即将传递给生成模型的消息数量: ${generatingMessages.length}`);
      generatingMessages.forEach((msg, index) => {
        const content = getMainTextContent(msg);
        console.log(`[ModelComboProvider] 消息 ${index}: 角色=${msg.role}, 内容长度=${content.length}, 内容预览=${content.substring(0, 100)}...`);
      });

      // 调用生成模型，实时显示生成内容
      const generatingResponse = await generatingProvider.sendChatMessage(generatingMessages, {
        onUpdate: (content: string) => {
          // 实时显示生成内容
          finalContent = content;
          console.log(`[ModelComboProvider] 生成更新，长度: ${content.length}`);
          // 只发送生成的内容，不重复发送推理内容
          if (options?.onUpdate) {
            options.onUpdate(content);
          }
        }
      });

      // Provider API 直接返回内容，不需要检查 success 字段
      console.log(`[ModelComboProvider] 生成模型调用完成，响应类型:`, typeof generatingResponse);

      // 如果没有通过流式获取到最终内容，使用响应内容
      if (!finalContent && typeof generatingResponse === 'object' && generatingResponse.content) {
        finalContent = generatingResponse.content;
      }

      // 如果响应是字符串，直接使用
      if (!finalContent && typeof generatingResponse === 'string') {
        finalContent = generatingResponse;
      }

      console.log(`[ModelComboProvider] 生成阶段完成，最终内容长度: ${finalContent.length}`);

      // 返回完整结果
      return {
        content: finalContent || '模型组合执行完成，但没有生成最终内容',
        reasoning: accumulatedReasoning || undefined,
        reasoningTime: Date.now() - startTime
      };

    } catch (error) {
      console.error('[ModelComboProvider] 流式执行失败:', error);
      throw error;
    }
  }

  /**
   * 测试API连接
   * @returns 是否连接成功
   */
  async testConnection(): Promise<boolean> {
    try {
      console.log(`[ModelComboProvider] 测试模型组合连接: ${this.model.id}`);

      // 对于模型组合，我们检查组合配置是否存在
      const comboConfig = (this.model as any).comboConfig;
      if (!comboConfig) {
        console.error(`[ModelComboProvider] 模型组合配置不存在: ${this.model.id}`);
        return false;
      }

      // 检查组合中是否有模型
      if (!comboConfig.models || comboConfig.models.length === 0) {
        console.error(`[ModelComboProvider] 模型组合中没有配置任何模型: ${this.model.id}`);
        return false;
      }

      console.log(`[ModelComboProvider] 模型组合连接测试通过: ${this.model.id}`);
      return true;
    } catch (error) {
      console.error(`[ModelComboProvider] 模型组合连接测试失败:`, error);
      return false;
    }
  }

  /**
   * 获取模型列表（对于模型组合，返回空数组）
   * @returns 模型列表
   */
  async getModels(): Promise<any[]> {
    return [];
  }

  /**
   * 根据模型ID获取模型配置
   * @param modelId 模型ID
   * @returns 模型配置
   */
  private async getModelById(modelId: string): Promise<Model | null> {
    try {
      // 使用静态导入的store来获取当前的模型配置
      const state = store.getState();

      // 从所有供应商中查找模型
      for (const provider of state.settings.providers) {
        const model = provider.models.find((m: any) => m.id === modelId);
        if (model) {
          // 确保模型有完整的API配置
          return {
            ...model,
            apiKey: model.apiKey || provider.apiKey,
            baseUrl: model.baseUrl || provider.baseUrl,
            providerType: model.providerType || provider.providerType || provider.id
          };
        }
      }

      console.warn(`[ModelComboProvider] 未找到模型: ${modelId}`);
      return null;
    } catch (error) {
      console.error('[ModelComboProvider] 获取模型失败:', error);
      return null;
    }
  }
}
