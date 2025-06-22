/**
 * Gemini API 配置构建器
 * 负责构建 GenerateContentConfig 对象，统一管理所有 API 参数
 */
import {
  HarmBlockThreshold,
  HarmCategory,
  Modality,
  type GenerateContentConfig,
  type SafetySetting,
  type ThinkingConfig
} from '@google/genai';
import type { Model } from '../../types';
import {
  isGeminiReasoningModel,
  isGenerateImageModel,
  isGemmaModel
} from '../../config/models';
import { getThinkingBudget, getAppSettings } from '../../utils/settingsUtils';

/**
 * Gemini 配置构建器类
 * 提供链式调用方式构建 API 配置
 */
export class GeminiConfigBuilder {
  private assistant: any;
  private model: Model;
  private maxTokens: number;
  private systemInstruction?: string;
  private tools: any[];

  constructor(assistant: any, model: Model, maxTokens: number, systemInstruction?: string, tools: any[] = []) {
    this.assistant = assistant;
    this.model = model;
    this.maxTokens = maxTokens;
    this.systemInstruction = systemInstruction;
    this.tools = tools;
  }

  /**
   * 构建完整的 GenerateContentConfig
   */
  build(): GenerateContentConfig {
    const config: GenerateContentConfig = {
      safetySettings: this.getSafetySettings(),
      systemInstruction: isGemmaModel(this.model) ? undefined : this.systemInstruction,
      temperature: this.getTemperature(),
      topP: this.getTopP(),
      tools: this.tools,
      ...this.getBudgetToken(),
      ...this.getCustomParameters(),
      ...this.getGeminiSpecificParameters()
    };

    // 检查是否启用了最大输出Token参数
    const appSettings = getAppSettings();
    if (appSettings.enableMaxOutputTokens !== false) {
      config.maxOutputTokens = this.getMaxTokens();
    } else {
      console.log(`[GeminiConfigBuilder] 最大输出Token已禁用，从API参数中移除maxOutputTokens`);
    }

    // 为图像生成模型添加必要的配置
    if (isGenerateImageModel(this.model)) {
      config.responseModalities = [Modality.TEXT, Modality.IMAGE];
      config.responseMimeType = 'text/plain';
    }

    return config;
  }

  /**
   * 设置系统指令
   */
  setSystemInstruction(systemInstruction: string): GeminiConfigBuilder {
    this.systemInstruction = systemInstruction;
    return this;
  }

  /**
   * 设置工具
   */
  setTools(tools: any[]): GeminiConfigBuilder {
    this.tools = tools;
    return this;
  }

  /**
   * 设置最大输出 tokens
   */
  setMaxTokens(maxTokens: number): GeminiConfigBuilder {
    this.maxTokens = maxTokens;
    return this;
  }

  /**
   * 获取安全设置 - 全部开放，不阻止任何内容
   */
  private getSafetySettings(): SafetySetting[] {
    const safetyThreshold = HarmBlockThreshold.BLOCK_NONE;
    return [
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: safetyThreshold },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: safetyThreshold },
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: safetyThreshold },
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: safetyThreshold },
      { category: HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY, threshold: safetyThreshold }
    ];
  }

  /**
   * 获取温度参数
   */
  private getTemperature(): number {
    return this.assistant?.settings?.temperature || this.assistant?.temperature || this.model?.temperature || 0.7;
  }

  /**
   * 获取 TopP 参数
   */
  private getTopP(): number {
    return this.assistant?.settings?.topP || this.assistant?.topP || (this.model as any)?.topP || 0.95;
  }

  /**
   * 获取最大输出 tokens
   */
  private getMaxTokens(): number {
    // 从应用设置中获取maxOutputTokens
    const appSettings = getAppSettings();
    const appMaxOutputTokens = appSettings.maxOutputTokens;

    // 优先级：助手设置 > 助手直接设置 > 应用设置 > 模型设置 > 构造函数传入值 > 默认值
    const maxTokens = this.assistant?.settings?.maxTokens ??
                     this.assistant?.maxTokens ??
                     appMaxOutputTokens ??
                     this.model.maxTokens ??
                     this.maxTokens ??
                     4096;

    // 确保值在合理范围内（最小1）
    const finalTokens = Math.max(maxTokens, 1);

    console.log(`[GeminiConfigBuilder] maxTokens参数 - 助手设置: ${this.assistant?.settings?.maxTokens}, 助手直接设置: ${this.assistant?.maxTokens}, 应用设置: ${appMaxOutputTokens}, 模型设置: ${this.model.maxTokens}, 构造函数传入: ${this.maxTokens}, 最终值: ${finalTokens}`);

    return finalTokens;
  }

  /**
   * 获取推理配置
   */
  private getBudgetToken() {
    if (isGeminiReasoningModel(this.model)) {
      // 从应用设置中获取思考预算
      const appThinkingBudget = getThinkingBudget();
      
      // 检查是否启用思维链
      const enableThinking = this.assistant?.enableThinking;
      // 优先使用助手设置的思考预算，如果没有则使用应用设置的默认值
      const thinkingBudget = this.assistant?.thinkingBudget || appThinkingBudget;

      // 对于 Gemini 2.5 Pro 模型，必须设置思考预算，不能为0
      if (this.model.id === 'gemini-2.5-pro-preview-06-05' || this.model.id === 'gemini-2.5-pro') {
        // 确保思考预算在有效范围内 (128-32768)
        const budget = Math.max(128, Math.min(thinkingBudget, 32768));
        
        return {
          thinkingConfig: {
            thinkingBudget: budget,
            includeThoughts: true
          } as ThinkingConfig
        };
      }

      if (!enableThinking || thinkingBudget === 0) {
        return {
          thinkingConfig: {
            includeThoughts: false,
            thinkingBudget: 0
          } as ThinkingConfig
        };
      }

      // 使用用户设置的thinkingBudget，范围0-24576
      const budget = Math.max(0, Math.min(thinkingBudget, 24576));

      return {
        thinkingConfig: {
          thinkingBudget: budget,
          includeThoughts: true
        } as ThinkingConfig
      };
    }
    return {};
  }

  /**
   * 获取自定义参数
   */
  private getCustomParameters(): any {
    return this.assistant?.settings?.customParameters || {};
  }

  /**
   * 获取Gemini专属参数
   */
  private getGeminiSpecificParameters(): any {
    const params: any = {};

    // Candidate Count
    if (this.assistant?.candidateCount !== undefined && this.assistant.candidateCount !== 1) {
      params.candidateCount = this.assistant.candidateCount;
    }

    // Response Modalities
    if (this.assistant?.responseModalities && Array.isArray(this.assistant.responseModalities)) {
      if (JSON.stringify(this.assistant.responseModalities) !== JSON.stringify(['TEXT'])) {
        params.responseModalities = this.assistant.responseModalities.map((modality: string) => {
          switch (modality) {
            case 'TEXT': return 'TEXT';
            case 'IMAGE': return 'IMAGE';
            case 'AUDIO': return 'AUDIO';
            default: return 'TEXT';
          }
        });
      }
    }

    // Speech Config
    if (this.assistant?.enableSpeech) {
      params.speechConfig = {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: this.assistant.speechLanguage === 'zh-CN' ? 'zh-CN-Wavenet-A' : 'en-US-Wavenet-A'
          }
        }
      };
    }

    // Media Resolution (影响图像处理的token消耗)
    if (this.assistant?.mediaResolution && this.assistant.mediaResolution !== 'medium') {
      params.mediaResolution = this.assistant.mediaResolution;
    }

    // 通用参数
    // Top-K
    if (this.assistant?.topK !== undefined && this.assistant.topK !== 40) {
      params.topK = this.assistant.topK;
    }

    // Frequency Penalty
    if (this.assistant?.frequencyPenalty !== undefined && this.assistant.frequencyPenalty !== 0) {
      params.frequencyPenalty = this.assistant.frequencyPenalty;
    }

    // Presence Penalty
    if (this.assistant?.presencePenalty !== undefined && this.assistant.presencePenalty !== 0) {
      params.presencePenalty = this.assistant.presencePenalty;
    }

    // Seed
    if (this.assistant?.seed !== undefined && this.assistant.seed !== null) {
      params.seed = this.assistant.seed;
    }

    // Stop Sequences
    if (this.assistant?.stopSequences && Array.isArray(this.assistant.stopSequences) && this.assistant.stopSequences.length > 0) {
      params.stopSequences = this.assistant.stopSequences;
    }

    return params;
  }
}

/**
 * 创建 Gemini 配置构建器的工厂函数
 */
export function createGeminiConfigBuilder(
  assistant: any,
  model: Model,
  maxTokens: number,
  systemInstruction?: string,
  tools: any[] = []
): GeminiConfigBuilder {
  return new GeminiConfigBuilder(assistant, model, maxTokens, systemInstruction, tools);
}
