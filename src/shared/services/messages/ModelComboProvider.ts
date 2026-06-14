/**
 * 模型组合提供商
 * 负责处理模型组合的聊天请求
 */
import type { Message, Model, MCPTool } from '../../types';
import type { Chunk } from '../../types/chunk';
import { ChunkType } from '../../types/chunk';
import { getMainTextContent, createMessage } from '../../utils/messageUtils';
import { ApiProviderRegistry } from './ApiProvider';
import store from '../../store';
import { modelMatchesIdentity, parseModelIdentityKey } from '../../utils/modelUtils';
import { createLogger } from '../infra/logger';
const logger = createLogger('ModelComboProvider');

export class ModelComboProvider {
  private model: Model;

  constructor(model: Model) {
    this.model = model;
    logger.debug(`初始化模型组合提供商: ${model.id}`);
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
    try {
      logger.debug(`开始处理模型组合请求: ${this.model.id}`);

      // 从模型配置中获取组合配置
      const comboConfig = (this.model as any).comboConfig;
      if (!comboConfig) {
        throw new Error(`模型组合 ${this.model.id} 的配置信息不存在`);
      }

      logger.debug(`传递完整消息历史，消息数量: ${messages.length}`);
      logger.debug(`组合策略: ${comboConfig.strategy}`);

      // 根据策略选择执行方法
      if (comboConfig.strategy === 'comparison') {
        return await this.executeComparisonStrategy(comboConfig, messages, options);
      } else {
        // 默认使用顺序策略
        return await this.executeComboWithStreaming(comboConfig, messages, options);
      }
    } catch (error) {
      logger.error('模型组合请求失败:', error);
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
      onChunk?: (chunk: Chunk) => void;
      abortSignal?: AbortSignal;
    }
  ): Promise<{ content: string; reasoning?: string; reasoningTime?: number; comboResult?: any }> {
    const startTime = Date.now();
    logger.debug(`执行对比策略，模型数量: ${comboConfig.models.length}`);

    // 并行调用所有模型
    const promises = comboConfig.models.map(async (modelConfig: any) => {
      try {
        logger.debug(`调用模型: ${modelConfig.modelId}`);

        const model = await this.getModelById(modelConfig.modelId);
        if (!model) {
          throw new Error(`找不到模型: ${modelConfig.modelId}`);
        }

        const provider = ApiProviderRegistry.get(model);

        const response = await provider.sendChatMessage(messages, {
          abortSignal: options?.abortSignal
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
        logger.error(`模型 ${modelConfig.modelId} 调用失败:`, error);
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

    logger.debug(`对比策略完成，成功模型: ${successResults.length}/${results.length}`);

    // 通过 onChunk 发送对比结果
    if (options?.onChunk) {
      options.onChunk({
        type: ChunkType.TEXT_COMPLETE,
        text: '__COMPARISON_RESULT__',
        // 将对比结果放在 metadata 中
        metadata: { comboResult }
      } as Chunk);
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
      onChunk?: (chunk: Chunk) => void;
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
      logger.debug(`第一阶段：调用推理模型 ${thinkingModel.modelId}`);

      const thinkingMessages: Message[] = messages;

      const thinkingModelConfig = await this.getModelById(thinkingModel.modelId);
      if (!thinkingModelConfig) {
        throw new Error(`找不到推理模型: ${thinkingModel.modelId}`);
      }

      const thinkingProvider = ApiProviderRegistry.get(thinkingModelConfig);

      // 用于收集推理内容
      const reasoningContent: string[] = [];
      let reasoningComplete = false;

      // 创建 Promise 来等待推理完成
      let hasResolved = false;
      const reasoningPromise = new Promise<string>((resolve, reject) => {
        const doResolve = (source: string) => {
          if (hasResolved) return;
          hasResolved = true;
          const fullReasoning = reasoningContent.join('');
          logger.debug(`推理完成 (来源: ${source})，总长度: ${fullReasoning.length}`);
          resolve(fullReasoning);
        };

        thinkingProvider.sendChatMessage(thinkingMessages, {
          abortSignal: options?.abortSignal,
          onChunk: (chunk: Chunk) => {
            // 处理推理内容
            if (chunk.type === ChunkType.THINKING_DELTA && chunk.text) {
              reasoningContent.push(chunk.text);

              // 实时转发推理内容
              if (options?.onChunk) {
                options.onChunk(chunk);
              }
            }

            // 处理推理完成 - 立即 resolve
            if (chunk.type === ChunkType.THINKING_COMPLETE) {
              reasoningComplete = true;
              logger.debug(`收到 THINKING_COMPLETE`);
              // 转发推理完成事件
              if (options?.onChunk) {
                options.onChunk(chunk);
              }
              doResolve('THINKING_COMPLETE');
            }

            // 处理文本内容（推理阶段结束信号）- 作为备用触发
            if (chunk.type === ChunkType.TEXT_DELTA || chunk.type === ChunkType.TEXT_COMPLETE) {
              if (!reasoningComplete && !hasResolved) {
                doResolve('TEXT_DELTA/COMPLETE');
              }
            }
          }
        }).then(() => {
          // 兜底：如果还没有 resolve，在 API 调用完成时 resolve
          doResolve('API_COMPLETE');
        }).catch(reject);
      });

      // 等待推理完成
      const thinkingResponse = await reasoningPromise;
      accumulatedReasoning = thinkingResponse;

      logger.debug(`推理阶段完成，推理内容长度: ${accumulatedReasoning.length}`);

      // 第二阶段：调用生成模型，基于推理结果生成答案
      logger.debug(`第二阶段：调用生成模型 ${generatingModel.modelId}`);

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
          logger.debug(`找到最后一个用户消息，原始内容: ${originalContent.substring(0, 50)}...`);

          const fixedContent = `这是我的原始输入：
${originalContent}

${combinedContent}`;

          logger.debug(`修改后的内容长度: ${fixedContent.length}`);
          logger.debug(`修改后的内容预览: ${fixedContent.substring(0, 200)}...`);

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
          logger.debug(`已替换索引 ${i} 的用户消息`);
          break;
        }
      }

      if (!lastUserMessageFound) {
        logger.error(`警告：没有找到用户消息进行修改`);
      }

      logger.debug(`最终消息数组长度: ${generatingMessages.length}`);
      logger.debug(`最后一个消息角色: ${generatingMessages[generatingMessages.length - 1]?.role}`);
      logger.debug(`最后一个消息内容预览: ${getMainTextContent(generatingMessages[generatingMessages.length - 1] || {} as any).substring(0, 100)}...`);

      // 获取生成模型配置并调用
      const generatingModelConfig = await this.getModelById(generatingModel.modelId);
      if (!generatingModelConfig) {
        throw new Error(`找不到生成模型: ${generatingModel.modelId}`);
      }

      const generatingProvider = ApiProviderRegistry.get(generatingModelConfig);

      // 调试：打印即将传递给生成模型的消息
      logger.debug(`即将传递给生成模型的消息数量: ${generatingMessages.length}`);
      generatingMessages.forEach((msg, index) => {
        const content = getMainTextContent(msg);
        logger.debug(`消息 ${index}: 角色=${msg.role}, 内容长度=${content.length}, 内容预览=${content.substring(0, 100)}...`);
      });

      // 调用生成模型，通过 onChunk 实时显示生成内容
      const generatingResponse = await generatingProvider.sendChatMessage(generatingMessages, {
        abortSignal: options?.abortSignal,
        onChunk: (chunk: Chunk) => {
          // 处理文本增量
          if (chunk.type === ChunkType.TEXT_DELTA && chunk.text) {
            finalContent += chunk.text;
            
            // 转发给上层
            if (options?.onChunk) {
              options.onChunk(chunk);
            }
          }
          
          // 处理文本完成 - 只有当 text 有内容时才覆盖
          if (chunk.type === ChunkType.TEXT_COMPLETE) {
            if (chunk.text) {
              finalContent = chunk.text;
            }
            if (options?.onChunk) {
              options.onChunk(chunk);
            }
          }
        }
      });

      // Provider API 直接返回内容，不需要检查 success 字段
      logger.debug(`生成模型调用完成，响应类型:`, typeof generatingResponse);

      // 如果没有通过流式获取到最终内容，使用响应内容
      if (!finalContent && typeof generatingResponse === 'object' && generatingResponse.content) {
        finalContent = generatingResponse.content;
      }

      // 如果响应是字符串，直接使用
      if (!finalContent && typeof generatingResponse === 'string') {
        finalContent = generatingResponse;
      }

      logger.debug(`生成阶段完成，最终内容长度: ${finalContent.length}`);

      // 返回完整结果
      return {
        content: finalContent || '模型组合执行完成，但没有生成最终内容',
        reasoning: accumulatedReasoning || undefined,
        reasoningTime: Date.now() - startTime
      };

    } catch (error) {
      logger.error('流式执行失败:', error);
      throw error;
    }
  }

  /**
   * 测试API连接
   * @returns 是否连接成功
   */
  async testConnection(): Promise<boolean> {
    try {
      logger.debug(`测试模型组合连接: ${this.model.id}`);

      // 对于模型组合，我们检查组合配置是否存在
      const comboConfig = (this.model as any).comboConfig;
      if (!comboConfig) {
        logger.error(`模型组合配置不存在: ${this.model.id}`);
        return false;
      }

      // 检查组合中是否有模型
      if (!comboConfig.models || comboConfig.models.length === 0) {
        logger.error(`模型组合中没有配置任何模型: ${this.model.id}`);
        return false;
      }

      logger.debug(`模型组合连接测试通过: ${this.model.id}`);
      return true;
    } catch (error) {
      logger.error(`模型组合连接测试失败:`, error);
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
      const identity = parseModelIdentityKey(modelId);

      if (!identity) {
        logger.warn(`无法解析模型标识: ${modelId}`);
        return null;
      }

      // 从所有供应商中查找模型
      for (const provider of state.settings.providers) {
        if (identity.provider && provider.id !== identity.provider) {
          continue;
        }
        const model = provider.models.find((m: any) => modelMatchesIdentity(m, identity, provider.id));
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

      logger.warn(`未找到模型: ${modelId}`);
      return null;
    } catch (error) {
      logger.error('获取模型失败:', error);
      return null;
    }
  }
}
