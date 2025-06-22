// 模型组合服务
import type {
  ModelComboConfig,
  ModelComboResult,
  ModelComboTemplate,
  RoutingCondition
} from '../types/ModelCombo';
import type { Model } from '../types';
import { dexieStorage } from './storage/DexieStorageService';
import { EventEmitter, EVENT_NAMES } from './EventEmitter';
import { sendChatRequest } from '../api';
import store from '../store';

/**
 * 模型组合服务
 * 负责管理和执行模型组合策略
 */
export class ModelComboService {
  private static instance: ModelComboService;

  public static getInstance(): ModelComboService {
    if (!ModelComboService.instance) {
      ModelComboService.instance = new ModelComboService();
    }
    return ModelComboService.instance;
  }

  /**
   * 获取所有模型组合配置
   */
  async getAllCombos(): Promise<ModelComboConfig[]> {
    try {
      const combos = await dexieStorage.getAllModelCombos();
      return combos || [];
    } catch (error) {
      console.error('[ModelComboService] 获取模型组合失败:', error);
      return [];
    }
  }

  /**
   * 创建新的模型组合
   */
  async createCombo(config: Omit<ModelComboConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<ModelComboConfig> {
    const now = new Date().toISOString();
    const newCombo: ModelComboConfig = {
      ...config,
      id: `combo_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      createdAt: now,
      updatedAt: now
    };

    try {
      await dexieStorage.saveModelCombo(newCombo);

      // 发送事件
      EventEmitter.emit(EVENT_NAMES.MODEL_COMBO_CREATED, newCombo);

      return newCombo;
    } catch (error) {
      console.error('[ModelComboService] 创建模型组合失败:', error);
      throw error;
    }
  }

  /**
   * 更新模型组合
   */
  async updateCombo(id: string, updates: Partial<ModelComboConfig>): Promise<ModelComboConfig> {
    try {
      const existing = await dexieStorage.getModelCombo(id);
      if (!existing) {
        throw new Error(`模型组合 ${id} 不存在`);
      }

      const updated: ModelComboConfig = {
        ...existing,
        ...updates,
        id, // 确保ID不被覆盖
        updatedAt: new Date().toISOString()
      };

      await dexieStorage.saveModelCombo(updated);

      // 发送事件
      EventEmitter.emit(EVENT_NAMES.MODEL_COMBO_UPDATED, updated);

      return updated;
    } catch (error) {
      console.error('[ModelComboService] 更新模型组合失败:', error);
      throw error;
    }
  }

  /**
   * 删除模型组合
   */
  async deleteCombo(id: string): Promise<void> {
    try {
      await dexieStorage.deleteModelCombo(id);

      // 发送事件
      EventEmitter.emit(EVENT_NAMES.MODEL_COMBO_DELETED, { id });
    } catch (error) {
      console.error('[ModelComboService] 删除模型组合失败:', error);
      throw error;
    }
  }

  /**
   * 执行模型组合
   */
  async executeCombo(
    comboId: string,
    prompt: string
  ): Promise<ModelComboResult> {
    try {
      const combo = await dexieStorage.getModelCombo(comboId);
      if (!combo) {
        throw new Error(`模型组合 ${comboId} 不存在`);
      }

      console.log(`[ModelComboService] 执行模型组合: ${combo.name} (${combo.strategy})`);

      switch (combo.strategy) {
        case 'routing':
          return await this.executeRouting(combo, prompt);
        case 'ensemble':
          return await this.executeEnsemble(combo, prompt);
        case 'comparison':
          return await this.executeComparison(combo, prompt);
        case 'cascade':
          return await this.executeCascade(combo, prompt);
        case 'sequential':
          return await this.executeSequential(combo, prompt);
        default:
          throw new Error(`不支持的策略: ${combo.strategy}`);
      }
    } catch (error) {
      console.error('[ModelComboService] 执行模型组合失败:', error);
      throw error;
    }
  }

  /**
   * 执行路由策略
   */
  private async executeRouting(
    combo: ModelComboConfig,
    prompt: string
  ): Promise<ModelComboResult> {
    // 根据路由规则选择模型
    const selectedModelId = this.selectModelByRouting(combo, prompt);
    const model = await this.getModelById(selectedModelId);

    if (!model) {
      throw new Error(`模型 ${selectedModelId} 不存在`);
    }

    const startTime = Date.now();

    try {
      // 调用真实的模型API

      // 构造消息格式
      const messages = [{
        role: 'user' as const,
        content: prompt
      }];

      console.log(`[ModelComboService] 调用模型 ${selectedModelId} 处理请求`);

      // 发送请求到选中的模型
      const response = await sendChatRequest({
        messages,
        modelId: selectedModelId
      });

      const latency = Date.now() - startTime;

      if (response.success && response.content) {
        return {
          comboId: combo.id,
          strategy: 'routing',
          modelResults: [{
            modelId: selectedModelId,
            role: 'primary',
            content: response.content,
            reasoning: response.reasoning,
            confidence: 0.9,
            latency,
            status: 'success'
          }],
          finalResult: {
            content: response.content,
            confidence: 0.9,
            explanation: `使用路由策略选择了模型: ${selectedModelId}`
          },
          stats: {
            totalCost: 0,
            totalLatency: latency,
            modelsUsed: 1,
            strategy: 'routing'
          },
          timestamp: new Date().toISOString()
        };
      } else {
        throw new Error(response.error || '模型调用失败');
      }
    } catch (error) {
      return {
        comboId: combo.id,
        strategy: 'routing',
        modelResults: [{
          modelId: selectedModelId,
          role: 'primary',
          content: '',
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
          latency: Date.now() - startTime
        }],
        finalResult: {
          content: '',
          confidence: 0,
          explanation: `模型 ${selectedModelId} 调用失败: ${error instanceof Error ? error.message : String(error)}`
        },
        stats: {
          totalCost: 0,
          totalLatency: Date.now() - startTime,
          modelsUsed: 1,
          strategy: 'routing'
        },
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 执行集成策略
   */
  private async executeEnsemble(
    combo: ModelComboConfig,
    prompt: string
  ): Promise<ModelComboResult> {
    const startTime = Date.now();
    const modelResults = [];
    let totalCost = 0;

    // 并行执行所有模型
    const promises = combo.models.map(async (modelConfig) => {
      const model = await this.getModelById(modelConfig.modelId);
      if (!model) return null;

      try {
        // 暂时简化实现，直接返回模拟响应
        const response = `Mock response from ${modelConfig.modelId} for: ${prompt.substring(0, 50)}...`;

        return {
          modelId: modelConfig.modelId,
          role: modelConfig.role,
          content: response,
          reasoning: undefined,
          confidence: 0.8,
          cost: 0,
          status: 'success' as const
        };
      } catch (error) {
        return {
          modelId: modelConfig.modelId,
          role: modelConfig.role,
          content: '',
          status: 'error' as const,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    });

    const results = await Promise.all(promises);
    const validResults = results.filter(r => r !== null);

    modelResults.push(...validResults);
    totalCost = validResults.reduce((sum, r) => sum + (r.cost || 0), 0);

    // 根据集成配置合并结果
    const finalResult = this.combineEnsembleResults(validResults);

    return {
      comboId: combo.id,
      strategy: 'ensemble',
      modelResults,
      finalResult,
      stats: {
        totalCost,
        totalLatency: Date.now() - startTime,
        modelsUsed: validResults.length,
        strategy: 'ensemble'
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 执行对比分析策略
   * 同时调用多个模型，返回所有结果供用户对比选择
   */
  private async executeComparison(combo: ModelComboConfig, prompt: string): Promise<ModelComboResult> {
    const startTime = Date.now();
    const modelResults: ModelComboResult['modelResults'] = [];
    let totalCost = 0;

    console.log(`[ModelComboService] 执行对比分析策略，模型数量: ${combo.models.length}`);

    // 并行调用所有模型
    const promises = combo.models.map(async (modelConfig) => {
      try {
        const result = await this.callSingleModel(modelConfig.modelId, prompt);
        if (result) {
          return {
            modelId: modelConfig.modelId,
            role: modelConfig.role,
            content: result.content,
            reasoning: result.reasoning,
            confidence: result.confidence || 0.8,
            cost: result.cost || 0,
            latency: result.latency || 0,
            status: 'success' as const
          };
        }
        return null;
      } catch (error) {
        console.error(`[ModelComboService] 模型 ${modelConfig.modelId} 调用失败:`, error);
        return {
          modelId: modelConfig.modelId,
          role: modelConfig.role,
          content: `模型调用失败: ${error instanceof Error ? error.message : '未知错误'}`,
          cost: 0,
          latency: Date.now() - startTime,
          status: 'error' as const,
          error: error instanceof Error ? error.message : '未知错误'
        };
      }
    });

    const results = await Promise.all(promises);
    const validResults = results.filter(r => r !== null);

    modelResults.push(...validResults);
    totalCost = validResults.reduce((sum, r) => sum + (r.cost || 0), 0);

    // 对比策略不需要合并结果，保留所有结果供用户选择
    return {
      comboId: combo.id,
      strategy: 'comparison',
      modelResults,
      finalResult: {
        content: '', // 对比策略没有最终结果，由用户选择
        confidence: 0,
        explanation: '请从多个模型的回答中选择最佳答案'
      },
      stats: {
        totalCost,
        totalLatency: Date.now() - startTime,
        modelsUsed: validResults.length,
        strategy: 'comparison'
      },
      timestamp: new Date().toISOString()
    };
  }

  private async executeCascade(combo: ModelComboConfig, prompt: string): Promise<ModelComboResult> {
    // 实现级联策略
    return this.executeRouting(combo, prompt);
  }

  private async executeSequential(combo: ModelComboConfig, prompt: string): Promise<ModelComboResult> {
    const startTime = Date.now();
    const modelResults = [];
    let totalCost = 0;
    let reasoningContent = '';
    let finalContent = '';

    try {
      console.log(`[ModelComboService] 开始执行顺序策略，模型数量: ${combo.models.length}`);

      // 按优先级排序模型
      const sortedModels = [...combo.models].sort((a, b) => (a.priority || 0) - (b.priority || 0));

      for (let i = 0; i < sortedModels.length; i++) {
        const modelConfig = sortedModels[i];
        const model = await this.getModelById(modelConfig.modelId);

        if (!model) {
          console.warn(`[ModelComboService] 模型 ${modelConfig.modelId} 不存在，跳过`);
          continue;
        }

        console.log(`[ModelComboService] 执行第 ${i + 1} 步: ${modelConfig.modelId} (${modelConfig.role})`);

        try {
          let messages;

          if (i === 0) {
            // 第一个模型：使用原始用户输入
            messages = [{
              role: 'user' as const,
              content: prompt
            }];
          } else {
            // 后续模型：使用原始输入 + 前面模型的推理结果
            const combinedPrompt = `原始用户输入：
${prompt}

前面模型的推理过程：
${reasoningContent}

基于以上推理过程，请提供完整的答案：`;

            messages = [{
              role: 'user' as const,
              content: combinedPrompt
            }];
          }

          const response = await sendChatRequest({
            messages,
            modelId: modelConfig.modelId
          });

          const stepLatency = Date.now() - startTime;

          if (response.success && response.content) {
            const result = {
              modelId: modelConfig.modelId,
              role: modelConfig.role,
              content: response.content,
              reasoning: response.reasoning,
              confidence: 0.9,
              latency: stepLatency,
              status: 'success' as const
            };

            modelResults.push(result);

            // 根据角色处理结果
            if (modelConfig.role === 'thinking') {
              // 推理模型的输出作为推理内容
              reasoningContent = response.reasoning || response.content;
              console.log(`[ModelComboService] 收集推理内容，长度: ${reasoningContent.length}`);
            } else if (modelConfig.role === 'generating') {
              // 生成模型的输出作为最终内容
              finalContent = response.content;
              console.log(`[ModelComboService] 收集最终内容，长度: ${finalContent.length}`);
            } else {
              // 默认处理：最后一个模型的输出作为最终内容
              if (i === sortedModels.length - 1) {
                finalContent = response.content;
              } else {
                reasoningContent += '\n' + response.content;
              }
            }
          } else {
            throw new Error(response.error || '模型调用失败');
          }
        } catch (error) {
          console.error(`[ModelComboService] 模型 ${modelConfig.modelId} 执行失败:`, error);

          modelResults.push({
            modelId: modelConfig.modelId,
            role: modelConfig.role,
            content: '',
            status: 'error' as const,
            error: error instanceof Error ? error.message : String(error),
            latency: Date.now() - startTime
          });

          // 如果是关键步骤失败，可以选择中断或继续
          if (modelConfig.role === 'thinking' && i === 0) {
            // 如果第一个推理模型失败，使用默认推理内容继续
            reasoningContent = '推理模型执行失败，将直接使用生成模型处理用户请求。';
          }
        }
      }

      // 确保有最终内容
      if (!finalContent && modelResults.length > 0) {
        const lastSuccessResult = modelResults.filter(r => r.status === 'success').pop();
        if (lastSuccessResult) {
          finalContent = lastSuccessResult.content;
        }
      }

      return {
        comboId: combo.id,
        strategy: 'sequential',
        modelResults,
        finalResult: {
          content: finalContent || '顺序执行完成，但没有生成最终内容',
          reasoning: reasoningContent || undefined, // 将推理内容传递给UI
          confidence: modelResults.filter(r => r.status === 'success').length / modelResults.length,
          explanation: `顺序执行了 ${modelResults.length} 个模型，推理内容长度: ${reasoningContent.length}，最终内容长度: ${finalContent.length}`
        },
        stats: {
          totalCost,
          totalLatency: Date.now() - startTime,
          modelsUsed: modelResults.filter(r => r.status === 'success').length,
          strategy: 'sequential'
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('[ModelComboService] 顺序策略执行失败:', error);
      throw error;
    }
  }

  /**
   * 辅助方法
   */
  private selectModelByRouting(combo: ModelComboConfig, prompt: string): string {
    // 简化的路由逻辑
    if (combo.routingRules && combo.routingRules.length > 0) {
      for (const rule of combo.routingRules) {
        if (this.evaluateRoutingConditions(rule.conditions, prompt)) {
          return rule.targetModelId;
        }
      }
    }

    // 默认返回第一个模型
    return combo.models[0]?.modelId || '';
  }

  private evaluateRoutingConditions(conditions: RoutingCondition[], prompt: string): boolean {
    // 简化的条件评估
    return conditions.every(condition => {
      switch (condition.type) {
        case 'keyword':
          return prompt.toLowerCase().includes(condition.value.toString().toLowerCase());
        case 'length':
          return this.evaluateNumericCondition(prompt.length, condition.operator, Number(condition.value));
        default:
          return true;
      }
    });
  }

  private evaluateNumericCondition(value: number, operator: string, target: number): boolean {
    switch (operator) {
      case 'greater': return value > target;
      case 'less': return value < target;
      case 'equals': return value === target;
      default: return true;
    }
  }

  private combineEnsembleResults(results: any[]): any {
    // 简化的结果合并逻辑
    const successResults = results.filter(r => r.status === 'success');
    if (successResults.length === 0) {
      return { content: '所有模型都执行失败', confidence: 0 };
    }

    // 简单的多数投票或取第一个结果
    return {
      content: successResults[0].content,
      confidence: successResults.reduce((sum, r) => sum + (r.confidence || 0), 0) / successResults.length,
      explanation: `集成了 ${successResults.length} 个模型的结果`
    };
  }

  /**
   * 调用单个模型
   */
  private async callSingleModel(modelId: string, prompt: string): Promise<{
    content: string;
    reasoning?: string;
    confidence?: number;
    cost?: number;
    latency?: number;
  } | null> {
    const startTime = Date.now();

    try {
      // 调用真实的模型API

      // 构造消息格式
      const messages = [{
        role: 'user' as const,
        content: prompt
      }];

      console.log(`[ModelComboService] 调用模型 ${modelId} 处理请求`);

      // 发送请求到模型
      const response = await sendChatRequest({
        messages,
        modelId
      });

      const latency = Date.now() - startTime;

      if (response.success && response.content) {
        return {
          content: response.content,
          reasoning: response.reasoning,
          confidence: 0.8,
          cost: 0, // TODO: 实际计算成本
          latency
        };
      } else {
        throw new Error(response.error || '模型调用失败');
      }
    } catch (error) {
      console.error(`[ModelComboService] 模型 ${modelId} 调用失败:`, error);
      throw error;
    }
  }

  private async getModelById(modelId: string): Promise<Model | null> {
    // 从Redux store中获取模型配置
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

      console.warn(`[ModelComboService] 未找到模型: ${modelId}`);
      return null;
    } catch (error) {
      console.error('[ModelComboService] 获取模型失败:', error);
      return null;
    }
  }

  /**
   * 获取预设模板
   */
  getTemplates(): ModelComboTemplate[] {
    return [
      {
        id: 'deepclaude',
        name: 'DeepClaude',
        description: '编程专用：DeepSeek R1 思考 + Claude 4.0 生成',
        strategy: 'sequential',
        icon: '🧠',
        category: 'coding',
        template: {
          strategy: 'sequential',
          enabled: true,
          models: [
            { id: '1', modelId: 'deepseek-r1', role: 'thinking', priority: 1 },
            { id: '2', modelId: 'claude-4-0', role: 'generating', priority: 2 }
          ],
          sequentialConfig: {
            steps: [
              { modelId: 'deepseek-r1', role: 'thinking', maxTokens: 1000 },
              { modelId: 'claude-4-0', role: 'generating', maxTokens: 4000 }
            ]
          },
          displayConfig: {
            showThinking: true,
            layout: 'vertical'
          },
          description: '先用DeepSeek R1进行深度思考，再用Claude 4.0生成高质量代码'
        },
        recommendedModels: [
          { role: 'thinking', modelTypes: ['reasoning'], description: '推理思考模型' },
          { role: 'generating', modelTypes: ['chat', 'function_calling'], description: '代码生成模型' }
        ]
      },
      {
        id: 'deepgemini',
        name: 'DeepGemini',
        description: '内容创作：DeepSeek R1 思考 + Gemini 2.5 Pro 生成',
        strategy: 'sequential',
        icon: '✨',
        category: 'writing',
        template: {
          strategy: 'sequential',
          enabled: true,
          models: [
            { id: '1', modelId: 'deepseek-r1', role: 'thinking', priority: 1 },
            { id: '2', modelId: 'gemini-2.5-pro', role: 'generating', priority: 2 }
          ],
          sequentialConfig: {
            steps: [
              { modelId: 'deepseek-r1', role: 'thinking', maxTokens: 1000 },
              { modelId: 'gemini-2.5-pro', role: 'generating', maxTokens: 4000 }
            ]
          },
          displayConfig: {
            showThinking: true,
            layout: 'vertical'
          },
          description: '先用DeepSeek R1进行深度思考，再用Gemini 2.5 Pro生成优质内容'
        },
        recommendedModels: [
          { role: 'thinking', modelTypes: ['reasoning'], description: '推理思考模型' },
          { role: 'generating', modelTypes: ['chat'], description: '内容生成模型' }
        ]
      }
    ];
  }
}

// 导出单例
export const modelComboService = ModelComboService.getInstance();
