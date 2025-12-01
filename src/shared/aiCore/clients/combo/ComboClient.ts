/**
 * 模型组合客户端
 * 负责执行多模型组合策略
 */
import type { Provider } from '../../types/provider';
import type { Chunk } from '../../types/chunk';
import { ChunkType } from '../../types/chunk';
import { ApiClientFactory } from '../factory';
import type { BaseApiClient } from '../base';
import type { CompletionsParams } from '../base/types';

// ==================== Combo Types ====================

/**
 * 模型组合配置中的单个模型
 */
export interface ComboModelConfig {
  id: string;
  modelId: string;
  role: 'primary' | 'thinking' | 'generating' | 'validator' | 'fallback';
  priority: number;
  weight?: number;
  maxTokens?: number;
}

/**
 * 模型组合策略
 */
export type ComboStrategy = 'routing' | 'ensemble' | 'comparison' | 'cascade' | 'sequential';

/**
 * 模型组合配置
 */
export interface ModelComboConfig {
  id: string;
  name: string;
  description?: string;
  strategy: ComboStrategy;
  enabled: boolean;
  models: ComboModelConfig[];
  routingRules?: RoutingRule[];
  sequentialConfig?: {
    steps: Array<{
      modelId: string;
      role: string;
      maxTokens?: number;
    }>;
  };
  displayConfig?: {
    showThinking?: boolean;
    layout?: 'vertical' | 'horizontal';
  };
  createdAt: string;
  updatedAt: string;
}

/**
 * 路由规则
 */
export interface RoutingRule {
  id: string;
  name: string;
  targetModelId: string;
  conditions: RoutingCondition[];
}

/**
 * 路由条件
 */
export interface RoutingCondition {
  type: 'keyword' | 'length' | 'complexity' | 'category';
  operator: 'contains' | 'equals' | 'greater' | 'less';
  value: string | number;
}

/**
 * 单个模型的执行结果
 */
export interface ModelExecutionResult {
  modelId: string;
  role: string;
  content: string;
  reasoning?: string;
  confidence?: number;
  cost?: number;
  latency?: number;
  status: 'success' | 'error' | 'skipped';
  error?: string;
}

/**
 * 组合执行结果
 */
export interface ComboExecutionResult {
  comboId: string;
  strategy: ComboStrategy;
  modelResults: ModelExecutionResult[];
  finalResult: {
    content: string;
    reasoning?: string;
    confidence: number;
    explanation?: string;
  };
  stats: {
    totalCost: number;
    totalLatency: number;
    modelsUsed: number;
    strategy: ComboStrategy;
  };
  timestamp: string;
}

// ==================== Combo Executor ====================

/**
 * 模型组合执行器
 */
export class ComboExecutor {
  private clientCache: Map<string, BaseApiClient> = new Map();

  constructor(private providerResolver: (modelId: string) => Provider | undefined) {}

  /**
   * 执行模型组合
   */
  async execute(
    config: ModelComboConfig,
    prompt: string,
    onChunk?: (chunk: Chunk) => void | Promise<void>
  ): Promise<ComboExecutionResult> {
    console.log(`[ComboExecutor] 执行组合: ${config.name} (${config.strategy})`);

    switch (config.strategy) {
      case 'routing':
        return this.executeRouting(config, prompt, onChunk);
      case 'ensemble':
        return this.executeEnsemble(config, prompt, onChunk);
      case 'comparison':
        return this.executeComparison(config, prompt, onChunk);
      case 'cascade':
        return this.executeCascade(config, prompt, onChunk);
      case 'sequential':
        return this.executeSequential(config, prompt, onChunk);
      default:
        throw new Error(`不支持的策略: ${config.strategy}`);
    }
  }

  /**
   * 路由策略：根据规则选择一个模型
   */
  private async executeRouting(
    config: ModelComboConfig,
    prompt: string,
    onChunk?: (chunk: Chunk) => void | Promise<void>
  ): Promise<ComboExecutionResult> {
    const startTime = Date.now();
    const selectedModelId = this.selectModelByRouting(config, prompt);

    const result = await this.callModel(selectedModelId, prompt, onChunk);

    return {
      comboId: config.id,
      strategy: 'routing',
      modelResults: [result],
      finalResult: {
        content: result.content,
        reasoning: result.reasoning,
        confidence: result.confidence || 0.9,
        explanation: `路由选择了模型: ${selectedModelId}`,
      },
      stats: {
        totalCost: result.cost || 0,
        totalLatency: Date.now() - startTime,
        modelsUsed: 1,
        strategy: 'routing',
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 集成策略：并行调用多个模型，合并结果
   */
  private async executeEnsemble(
    config: ModelComboConfig,
    prompt: string,
    onChunk?: (chunk: Chunk) => void | Promise<void>
  ): Promise<ComboExecutionResult> {
    const startTime = Date.now();

    // 并行调用所有模型
    const promises = config.models.map(m => this.callModel(m.modelId, prompt));
    const results = await Promise.all(promises);

    // 合并结果
    const successResults = results.filter(r => r.status === 'success');
    const finalContent = this.combineResults(successResults);

    // 发送最终结果
    if (onChunk) {
      await onChunk({
        type: ChunkType.TEXT_COMPLETE,
        text: finalContent,
      });
    }

    return {
      comboId: config.id,
      strategy: 'ensemble',
      modelResults: results,
      finalResult: {
        content: finalContent,
        confidence: successResults.length / results.length,
        explanation: `集成了 ${successResults.length} 个模型的结果`,
      },
      stats: {
        totalCost: results.reduce((sum, r) => sum + (r.cost || 0), 0),
        totalLatency: Date.now() - startTime,
        modelsUsed: successResults.length,
        strategy: 'ensemble',
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 对比策略：并行调用，返回所有结果供用户选择
   */
  private async executeComparison(
    config: ModelComboConfig,
    prompt: string,
    _onChunk?: (chunk: Chunk) => void | Promise<void>
  ): Promise<ComboExecutionResult> {
    const startTime = Date.now();

    const promises = config.models.map(m => this.callModel(m.modelId, prompt));
    const results = await Promise.all(promises);

    return {
      comboId: config.id,
      strategy: 'comparison',
      modelResults: results,
      finalResult: {
        content: '',
        confidence: 0,
        explanation: '请从多个模型的回答中选择最佳答案',
      },
      stats: {
        totalCost: results.reduce((sum, r) => sum + (r.cost || 0), 0),
        totalLatency: Date.now() - startTime,
        modelsUsed: results.filter(r => r.status === 'success').length,
        strategy: 'comparison',
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 级联策略：按优先级依次尝试，直到成功
   */
  private async executeCascade(
    config: ModelComboConfig,
    prompt: string,
    onChunk?: (chunk: Chunk) => void | Promise<void>
  ): Promise<ComboExecutionResult> {
    const startTime = Date.now();
    const modelResults: ModelExecutionResult[] = [];

    const sortedModels = [...config.models].sort((a, b) => a.priority - b.priority);

    for (const modelConfig of sortedModels) {
      const result = await this.callModel(modelConfig.modelId, prompt, onChunk);
      modelResults.push(result);

      if (result.status === 'success') {
        return {
          comboId: config.id,
          strategy: 'cascade',
          modelResults,
          finalResult: {
            content: result.content,
            reasoning: result.reasoning,
            confidence: result.confidence || 0.9,
            explanation: `级联成功，使用模型: ${modelConfig.modelId}`,
          },
          stats: {
            totalCost: modelResults.reduce((sum, r) => sum + (r.cost || 0), 0),
            totalLatency: Date.now() - startTime,
            modelsUsed: modelResults.length,
            strategy: 'cascade',
          },
          timestamp: new Date().toISOString(),
        };
      }
    }

    // 所有模型都失败
    return {
      comboId: config.id,
      strategy: 'cascade',
      modelResults,
      finalResult: {
        content: '所有模型都执行失败',
        confidence: 0,
      },
      stats: {
        totalCost: 0,
        totalLatency: Date.now() - startTime,
        modelsUsed: 0,
        strategy: 'cascade',
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 顺序策略：按步骤依次执行，传递上下文
   */
  private async executeSequential(
    config: ModelComboConfig,
    prompt: string,
    onChunk?: (chunk: Chunk) => void | Promise<void>
  ): Promise<ComboExecutionResult> {
    const startTime = Date.now();
    const modelResults: ModelExecutionResult[] = [];
    let reasoningContent = '';
    let finalContent = '';

    const sortedModels = [...config.models].sort((a, b) => a.priority - b.priority);

    for (let i = 0; i < sortedModels.length; i++) {
      const modelConfig = sortedModels[i];
      let currentPrompt: string;

      if (i === 0) {
        currentPrompt = prompt;
      } else {
        currentPrompt = `原始用户输入：
${prompt}

前面模型的推理过程：
${reasoningContent}

基于以上推理过程，请提供完整的答案：`;
      }

      // 只在最后一个模型时传递 onChunk
      const isLastModel = i === sortedModels.length - 1;
      const result = await this.callModel(
        modelConfig.modelId,
        currentPrompt,
        isLastModel ? onChunk : undefined
      );

      modelResults.push({
        ...result,
        role: modelConfig.role,
      });

      if (result.status === 'success') {
        if (modelConfig.role === 'thinking') {
          reasoningContent = result.reasoning || result.content;
          // 发送思考过程
          if (onChunk && config.displayConfig?.showThinking) {
            await onChunk({
              type: ChunkType.THINKING_COMPLETE,
              text: reasoningContent,
            });
          }
        } else if (modelConfig.role === 'generating') {
          finalContent = result.content;
        } else {
          if (isLastModel) {
            finalContent = result.content;
          } else {
            reasoningContent += '\n' + result.content;
          }
        }
      }
    }

    return {
      comboId: config.id,
      strategy: 'sequential',
      modelResults,
      finalResult: {
        content: finalContent || '顺序执行完成，但没有生成最终内容',
        reasoning: reasoningContent || undefined,
        confidence: modelResults.filter(r => r.status === 'success').length / modelResults.length,
        explanation: `顺序执行了 ${modelResults.length} 个模型`,
      },
      stats: {
        totalCost: modelResults.reduce((sum, r) => sum + (r.cost || 0), 0),
        totalLatency: Date.now() - startTime,
        modelsUsed: modelResults.filter(r => r.status === 'success').length,
        strategy: 'sequential',
      },
      timestamp: new Date().toISOString(),
    };
  }

  // ==================== Helper Methods ====================

  /**
   * 调用单个模型
   */
  private async callModel(
    modelId: string,
    prompt: string,
    onChunk?: (chunk: Chunk) => void | Promise<void>
  ): Promise<ModelExecutionResult> {
    const startTime = Date.now();

    try {
      const provider = this.providerResolver(modelId);
      if (!provider) {
        throw new Error(`未找到模型 ${modelId} 的 Provider`);
      }

      const client = await this.getClient(provider);

      // 构建参数
      const params: CompletionsParams = {
        messages: [{ id: '1', role: 'user', content: prompt }],
        assistant: {
          model: {
            id: modelId,
            name: modelId,
            provider: provider.id,
          },
        },
        onChunk,
      };

      // 获取转换器
      const transformer = client.getRequestTransformer();
      const sdkPayload = transformer.transform(params);

      // 执行请求
      let content = '';
      let reasoning = '';
      const rawStream = await client.createCompletions(sdkPayload as any, {});

      // 处理流式响应 - 简化处理，直接解析原始响应
      for await (const rawChunk of rawStream as AsyncIterable<any>) {
        // OpenAI 格式
        if (rawChunk.choices?.[0]?.delta?.content) {
          const text = rawChunk.choices[0].delta.content;
          content += text;
          if (onChunk) {
            await onChunk({ type: ChunkType.TEXT_DELTA, text });
          }
        }
        // Gemini 格式
        else if (rawChunk.candidates?.[0]?.content?.parts) {
          for (const part of rawChunk.candidates[0].content.parts) {
            if (part.thought && part.text) {
              reasoning += part.text;
              if (onChunk) {
                await onChunk({ type: ChunkType.THINKING_DELTA, text: part.text });
              }
            } else if (part.text) {
              content += part.text;
              if (onChunk) {
                await onChunk({ type: ChunkType.TEXT_DELTA, text: part.text });
              }
            }
          }
        }
      }

      return {
        modelId,
        role: 'primary',
        content,
        reasoning: reasoning || undefined,
        confidence: 0.9,
        latency: Date.now() - startTime,
        status: 'success',
      };
    } catch (error) {
      console.error(`[ComboExecutor] 模型 ${modelId} 调用失败:`, error);
      return {
        modelId,
        role: 'primary',
        content: '',
        latency: Date.now() - startTime,
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 获取或创建客户端
   */
  private async getClient(provider: Provider): Promise<BaseApiClient> {
    const cacheKey = provider.id;
    if (!this.clientCache.has(cacheKey)) {
      const client = ApiClientFactory.create(provider);
      this.clientCache.set(cacheKey, client);
    }
    return this.clientCache.get(cacheKey)!;
  }

  /**
   * 根据路由规则选择模型
   */
  private selectModelByRouting(config: ModelComboConfig, prompt: string): string {
    if (config.routingRules && config.routingRules.length > 0) {
      for (const rule of config.routingRules) {
        if (this.evaluateConditions(rule.conditions, prompt)) {
          return rule.targetModelId;
        }
      }
    }
    return config.models[0]?.modelId || '';
  }

  /**
   * 评估路由条件
   */
  private evaluateConditions(conditions: RoutingCondition[], prompt: string): boolean {
    return conditions.every(condition => {
      switch (condition.type) {
        case 'keyword':
          return prompt.toLowerCase().includes(String(condition.value).toLowerCase());
        case 'length':
          return this.evaluateNumeric(prompt.length, condition.operator, Number(condition.value));
        default:
          return true;
      }
    });
  }

  private evaluateNumeric(value: number, operator: string, target: number): boolean {
    switch (operator) {
      case 'greater': return value > target;
      case 'less': return value < target;
      case 'equals': return value === target;
      default: return true;
    }
  }

  /**
   * 合并集成结果
   */
  private combineResults(results: ModelExecutionResult[]): string {
    if (results.length === 0) return '所有模型都执行失败';
    // 简单取第一个成功结果
    return results[0].content;
  }

  /**
   * 清理缓存
   */
  clearCache(): void {
    this.clientCache.clear();
  }
}
