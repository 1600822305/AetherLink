/**
 * 思考过程处理服务
 * 集中处理不同AI模型的思考过程数据
 */

import type { Message, Model } from '../types';
import { isReasoningModel } from '../utils/modelDetection';
import type { ThinkingOption } from '../config/reasoningConfig';
import { getThinkingBudget } from '../config/reasoningConfig';

// 思考过程源类型 - 使用常量对象而不是enum（解决编译错误）
export const ThinkingSourceType = {
  GROK: 'grok',           // Grok模型的思考过程
  CLAUDE: 'claude',       // Claude的思考过程
  OPENAI: 'openai',       // OpenAI的思考过程
  DEEPSEEK: 'deepseek',   // DeepSeek模型的思考过程
  CUSTOM: 'custom'        // 自定义思考过程
} as const;

export type ThinkingSourceTypeValue = typeof ThinkingSourceType[keyof typeof ThinkingSourceType];

// 思考过程配置接口
export interface ThinkingConfig {
  enabled: boolean;        // 是否启用思考过程
  effort?: ThinkingOption;  // 思考过程的深度
  format?: 'plain' | 'markdown' | 'json'; // 思考过程的格式
}

// 思考过程结果接口
export interface ThinkingResult {
  content: string;         // 思考过程内容
  sourceType: ThinkingSourceTypeValue; // 思考过程来源
  timeMs?: number;         // 思考过程耗时（毫秒）
  tokens?: number;         // 思考过程消耗的token数量
}

// Grok思考过程配置
export function getGrokThinkingConfig(effort: 'low' | 'high' = 'high'): any {
  return {
    reasoning_effort: effort
  };
}

/**
 * 从API响应中提取思考过程
 * 支持多种模型的思考过程提取
 * @param response API响应对象
 * @param sourceType 思考过程源类型
 * @returns 思考过程结果对象或null
 */
export function extractThinkingFromResponse(
  response: any,
  sourceType: ThinkingSourceTypeValue
): ThinkingResult | null {
  if (!response) return null;

  switch (sourceType) {
    case ThinkingSourceType.GROK:
      // 从Grok API响应中提取思考过程
      if (response.reasoning) {
        return {
          content: response.reasoning,
          sourceType: ThinkingSourceType.GROK,
          timeMs: response.reasoningTime
        };
      } else if (response.choices?.[0]?.message?.reasoning_content) {
        // 备选字段名
        return {
          content: response.choices[0].message.reasoning_content,
          sourceType: ThinkingSourceType.GROK,
          timeMs: response.reasoningTime || 0
        };
      }
      break;

    case ThinkingSourceType.DEEPSEEK:
      // DeepSeek推理模型的思考过程提取
      if (response.choices?.[0]?.message?.reasoning) {
        return {
          content: response.choices[0].message.reasoning,
          sourceType: ThinkingSourceType.DEEPSEEK,
          timeMs: response.reasoning_time || 0
        };
      } else if (response.choices?.[0]?.message?.reasoning_content) {
        return {
          content: response.choices[0].message.reasoning_content,
          sourceType: ThinkingSourceType.DEEPSEEK,
          timeMs: response.reasoningTime || 0
        };
      } else if (response.usage?.completion_tokens_details?.reasoning_tokens) {
        // 如果有reasoning_tokens但没有直接的reasoning_content，尝试从其他字段提取
        const reasoningContent = response.reasoning || '';
        return {
          content: reasoningContent,
          sourceType: ThinkingSourceType.DEEPSEEK,
          timeMs: response.reasoningTime || 0,
          tokens: response.usage.completion_tokens_details.reasoning_tokens
        };
      } else if (response.reasoning) {
        // 直接从response.reasoning提取
        return {
          content: response.reasoning,
          sourceType: ThinkingSourceType.DEEPSEEK,
          timeMs: response.reasoningTime || response.reasoning_time || 0
        };
      }
      break;

    case ThinkingSourceType.CLAUDE:
      // Claude思考过程提取逻辑
      if (response.thinking) {
        return {
          content: response.thinking,
          sourceType: ThinkingSourceType.CLAUDE,
          timeMs: response.thinkingTime
        };
      } else if (response.content && Array.isArray(response.content)) {
        // 检查Claude响应中的content数组
        const thinkingBlock = response.content.find((block: any) => block.type === 'thinking');
        if (thinkingBlock && 'thinking' in thinkingBlock) {
          return {
            content: thinkingBlock.thinking,
            sourceType: ThinkingSourceType.CLAUDE,
            timeMs: response.thinkingTime || 0
          };
        }
      }
      break;

    case ThinkingSourceType.OPENAI:
      // OpenAI思考过程提取逻辑
      if (response.thinking || response.tool_calls?.find((tool: any) => tool.name === 'thinking')) {
        const thinking = response.thinking ||
          response.tool_calls?.find((tool: any) => tool.name === 'thinking')?.arguments;

        return {
          content: typeof thinking === 'string' ? thinking : JSON.stringify(thinking),
          sourceType: ThinkingSourceType.OPENAI,
          timeMs: response.thinking_time
        };
      } else if (response.choices?.[0]?.message?.reasoning) {
        // OpenAI o1/o3/o4模型的reasoning字段
        return {
          content: response.choices[0].message.reasoning,
          sourceType: ThinkingSourceType.OPENAI,
          timeMs: response.thinking_time || 0
        };
      } else if (response.reasoning) {
        // 直接从response.reasoning提取
        return {
          content: response.reasoning,
          sourceType: ThinkingSourceType.OPENAI,
          timeMs: response.reasoning_time || response.thinking_time || 0
        };
      } else if (response.choices?.[0]?.delta?.reasoning_content) {
        // 流式响应中的reasoning_content字段
        return {
          content: response.choices[0].delta.reasoning_content,
          sourceType: ThinkingSourceType.OPENAI,
          timeMs: response.thinking_time || 0
        };
      }
      break;

    case ThinkingSourceType.CUSTOM:
      // 处理自定义格式
      if (response.thinking || response.reasoning) {
        return {
          content: response.thinking || response.reasoning,
          sourceType: ThinkingSourceType.CUSTOM,
          timeMs: response.thinkingTime || response.reasoningTime
        };
      } else if (response.reasoning_content) {
        return {
          content: response.reasoning_content,
          sourceType: ThinkingSourceType.CUSTOM,
          timeMs: response.thinkingTime || response.reasoningTime || 0
        };
      }
      break;
  }

  // 通用检测 - 检查各种可能的字段名
  const possibleFields = [
    'thinking', 'reasoning', 'reasoning_content',
    'thought_process', 'chain_of_thought', 'cot'
  ];

  // 检查顶层字段
  for (const field of possibleFields) {
    if (response[field]) {
      return {
        content: response[field],
        sourceType: ThinkingSourceType.CUSTOM,
        timeMs: response.thinking_time || response.reasoningTime || 0
      };
    }
  }

  // 检查choices数组中的message对象
  if (response.choices && response.choices.length > 0) {
    const message = response.choices[0].message || response.choices[0].delta;
    if (message) {
      for (const field of possibleFields) {
        if (message[field]) {
          return {
            content: message[field],
            sourceType: ThinkingSourceType.CUSTOM,
            timeMs: response.thinking_time || response.reasoningTime || 0
          };
        }
      }
    }
  }

  return null;
}

/**
 * 从模型提供商类型获取思考源类型
 * 根据提供商名称判断对应的思考过程源类型
 * @param provider 提供商ID
 * @returns 思考过程源类型
 */
export function getThinkingSourceTypeFromProvider(provider: string): ThinkingSourceTypeValue {
  const providerLower = provider.toLowerCase();

  // Grok模型
  if (providerLower.includes('grok') ||
      providerLower.includes('xai') ||
      providerLower.includes('x.ai')) {
    return ThinkingSourceType.GROK;
  }

  // Claude模型
  else if (providerLower.includes('claude') ||
           providerLower.includes('anthropic') ||
           providerLower.includes('sonnet') ||
           providerLower.includes('opus') ||
           providerLower.includes('haiku')) {
    return ThinkingSourceType.CLAUDE;
  }

  // OpenAI模型
  else if (providerLower.includes('openai') ||
           providerLower.includes('gpt') ||
           providerLower.includes('o1') ||
           providerLower.includes('o3') ||
           providerLower.includes('o4') ||
           providerLower.includes('azure')) {
    return ThinkingSourceType.OPENAI;
  }

  // DeepSeek模型
  else if (providerLower.includes('deepseek') ||
           providerLower.includes('deepseek-reasoner') ||
           providerLower.includes('deepseek-coder')) {
    return ThinkingSourceType.DEEPSEEK;
  }

  // 其他模型 - 根据名称判断
  else if (providerLower.includes('gemini') ||
           providerLower.includes('google') ||
           providerLower.includes('palm')) {
    return ThinkingSourceType.CUSTOM;
  }
  else if (providerLower.includes('qwen') ||
           providerLower.includes('tongyi') ||
           providerLower.includes('alibaba')) {
    return ThinkingSourceType.CUSTOM;
  }
  else if (providerLower.includes('glm') ||
           providerLower.includes('chatglm') ||
           providerLower.includes('zhipu')) {
    return ThinkingSourceType.CUSTOM;
  }

  // 默认返回自定义类型
  return ThinkingSourceType.CUSTOM;
}

/**
 * 为指定模型和提供商获取适当的思考过程配置
 * 根据不同模型类型返回对应的思考过程配置
 * @param provider 提供商ID或模型对象
 * @param reasoningEffort 思考深度
 * @param maxTokens 最大令牌数
 * @returns 思考过程配置对象
 */
export function getThinkingConfig(
  provider: string | Model,
  reasoningEffort?: ThinkingOption,
  maxTokens: number = 4096
): any {
  // 如果未指定思考深度，表示不启用思考过程
  if (reasoningEffort === undefined) {
    return getDisabledThinkingConfig(provider);
  }

  // 如果传入的是模型对象，直接使用
  const model = typeof provider === 'string'
    ? { id: provider, name: provider, provider } as Model
    : provider;

  // 获取思考过程源类型
  const sourceType = getThinkingSourceTypeFromProvider(model.provider);

  // 使用getThinkingBudget函数计算预算令牌数
  const budgetTokens = getThinkingBudget(model, reasoningEffort, maxTokens);

  // DeepSeek Reasoner模型
  if (model.id.includes('deepseek-reasoner')) {
    return {}; // DeepSeek Reasoner模型默认启用思考过程，不需要额外配置
  }

  // Gemini模型
  if (model.id.includes('gemini')) {
    return {
      thinkingConfig: {
        thinkingBudget: budgetTokens,
        includeThoughts: true,
        thinkingMode: reasoningEffort === 'auto' ? 'auto' : 'manual'
      }
    };
  }

  // Qwen模型
  if (model.id.includes('qwen')) {
    return {
      enable_thinking: true,
      thinking_budget: budgetTokens,
      qwenThinkMode: true
    };
  }

  // 根据源类型返回配置
  switch (sourceType) {
    case ThinkingSourceType.GROK:
      // Grok只支持"low"和"high"
      const grokEffort = reasoningEffort === 'medium' || reasoningEffort === 'auto' ? 'high' : reasoningEffort;
      return {
        reasoning_effort: grokEffort
      };

    case ThinkingSourceType.CLAUDE:
      // Claude的思考过程配置
      return {
        thinking: {
          type: 'enabled',
          budget_tokens: Math.max(1024, budgetTokens)
        }
      };

    case ThinkingSourceType.OPENAI:
      // OpenAI的思考过程配置
      return {
        reasoning_effort: reasoningEffort === 'auto' ? 'high' : reasoningEffort
      };

    case ThinkingSourceType.DEEPSEEK:
      // DeepSeek模型的思考过程配置
      return {}; // DeepSeek模型默认启用思考过程，不需要额外配置

    default:
      // 默认配置
      return { thinking: true };
  }
}

/**
 * 获取禁用思考过程的配置
 * @param provider 提供商ID或模型对象
 * @returns 禁用思考过程的配置
 */
function getDisabledThinkingConfig(provider: string | Model): any {
  // 如果传入的是模型对象，直接使用
  const model = typeof provider === 'string'
    ? { id: provider, name: provider, provider } as Model
    : provider;

  // Qwen模型
  if (model.id.includes('qwen')) {
    return { enable_thinking: false };
  }

  // Claude模型
  if (model.id.includes('claude')) {
    return { thinking: { type: 'disabled' } };
  }

  // Gemini模型
  if (model.id.includes('gemini')) {
    if (model.provider === 'openrouter') {
      return { reasoning: { maxTokens: 0, exclude: true } };
    }
    return { reasoning_effort: 'none' };
  }

  // 默认返回空对象
  return {};
}

// 使用从reasoningConfig.ts导入的getModelTokenLimit函数

/**
 * 获取指定模型是否支持思考过程
 * 使用更全面的模型检测方法，与最佳实例保持一致
 * @param model 模型对象或模型ID
 * @returns 是否支持思考过程
 */
export function isThinkingSupported(model: Model | string): boolean {
  // 如果传入的是字符串（模型ID），创建一个临时模型对象
  if (typeof model === 'string') {
    return isReasoningModel({ id: model, name: model, provider: '' });
  }

  // 如果传入的是模型对象，直接使用isReasoningModel函数判断
  return isReasoningModel(model);
}

// 将思考过程添加到消息中
export function addThinkingToMessage(message: Message, thinking: ThinkingResult): Message {
  // 创建新对象并使用类型断言
  const result = { ...message } as any;

  // 添加思考过程属性
  if (thinking.content) {
    result.reasoning = thinking.content;
  }

  if (thinking.timeMs) {
    result.reasoningTime = thinking.timeMs;
  }

  // 返回类型转换后的消息
  return result as Message;
}

// 思考时间格式化函数已移至thinkingUtils.ts

export default {
  ThinkingSourceType,
  getGrokThinkingConfig,
  extractThinkingFromResponse,
  getThinkingSourceTypeFromProvider,
  getThinkingConfig,
  isThinkingSupported,
  addThinkingToMessage
};