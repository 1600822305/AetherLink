/**
 * 视觉识别服务
 *
 * 负责：
 * - 根据视觉识别设置解析出可用的视觉模型（预设供应商模型 / 独立API配置）
 * - 调用视觉模型分析图片，返回文本描述
 * - 设置页的"测试 API 连接"
 *
 * 独立API配置走 OpenAI 兼容协议，复用 openai/client 的统一客户端
 * （自动获得平台适配 fetch、CORS 处理、baseURL 规范化等能力）。
 */

import store from '../../store';
import type { Model } from '../../types';
import type { VisionRecognitionState } from '../../store/slices/visionRecognitionSlice';
import { createClient } from '../../api/openai/client';
import { createLogger } from '../infra/logger';
import type { ApiMessage, ImageUrlPart } from '../../store/thunks/message/visionFallback';
import {
  extractLastUserImages,
  applyVisionAnalysisToApiMessages,
} from '../../store/thunks/message/visionFallback';
import {
  hasImageContentInApiMessages,
  modelSupportsImageInput,
  assertModelSupportsApiMessages,
} from '../../store/thunks/message/apiMessageValidation';

const logger = createLogger('VisionRecognition');

/** 独立API配置对应的虚拟 provider 标识 */
export const VISION_CUSTOM_PROVIDER_ID = 'vision-custom';

export interface VisionTestResult {
  success: boolean;
  message: string;
  latencyMs?: number;
}

/** 根据视觉识别设置解析出用于调用的 Model 对象 */
export function resolveVisionModel(state: VisionRecognitionState): Model | null {
  if (state.modelSource === 'custom') {
    const { modelName, baseUrl, apiKey } = state.custom;
    if (!modelName || !baseUrl || !apiKey) return null;
    return {
      id: modelName,
      name: modelName,
      provider: VISION_CUSTOM_PROVIDER_ID,
      providerType: 'openai',
      apiKey,
      baseUrl,
    };
  }

  const ref = state.presetModelRef;
  if (!ref) return null;

  const providers = store.getState().settings?.providers || [];
  const provider = providers.find((p: any) => p.id === ref.providerId);
  if (!provider) return null;

  const model = (provider.models || []).find((m: Model) => m.id === ref.modelId);
  if (!model) return null;

  return {
    ...model,
    provider: provider.id,
    apiKey: model.apiKey || provider.apiKey,
    baseUrl: model.baseUrl || provider.baseUrl,
    providerType: model.providerType || provider.providerType || provider.id,
    useCorsPlugin: model.useCorsPlugin ?? provider.useCorsPlugin,
  };
}

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label}超时（${Math.round(timeoutMs / 1000)}秒）`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

/**
 * 调用视觉模型分析图片
 * @returns 视觉模型生成的图片描述文本
 */
export async function analyzeImagesWithVisionModel(options: {
  model: Model;
  images: ImageUrlPart[];
  userText: string;
  prompt: string;
  timeoutMs: number;
  abortSignal?: AbortSignal;
}): Promise<string> {
  const { model, images, userText, prompt, timeoutMs, abortSignal } = options;

  logger.info(`开始分析图片，模型: ${model.id}，图片数: ${images.length}`);

  const client = createClient(model);

  const userContent: Array<Record<string, unknown>> = [
    {
      type: 'text',
      text: userText
        ? `${prompt}\n\n用户随图片提出的问题（分析时请重点关注与之相关的内容）：${userText}`
        : prompt,
    },
    ...images,
  ];

  const request = client.chat.completions.create(
    {
      model: model.id,
      messages: [{ role: 'user', content: userContent as any }],
      stream: false,
    },
    { signal: abortSignal }
  );

  const response = await withTimeout(request, timeoutMs, '图片分析');

  const content = response.choices?.[0]?.message?.content;
  if (!content || !content.trim()) {
    throw new Error('视觉模型返回了空的分析结果');
  }

  logger.info(`图片分析完成，结果长度: ${content.length}`);
  return content;
}

/**
 * 发送前回退入口：
 * 当 apiMessages 含图片且当前模型不支持视觉时——
 * - 启用视觉识别：用视觉模型分析图片并改写 apiMessages（剥图 + 注入分析文本）
 * - 未启用：维持原有校验行为（抛出"不支持图片输入"错误）
 * 当前模型本身支持视觉时原样返回，不影响既有链路。
 */
export async function applyVisionFallbackIfNeeded(
  model: Model,
  apiMessages: ApiMessage[],
  abortSignal?: AbortSignal
): Promise<ApiMessage[]> {
  if (!hasImageContentInApiMessages(apiMessages) || modelSupportsImageInput(model)) {
    return apiMessages;
  }

  const state = store.getState().visionRecognition;
  if (!state?.enabled) {
    assertModelSupportsApiMessages(model, apiMessages);
    return apiMessages;
  }

  const visionModel = resolveVisionModel(state);
  if (!visionModel) {
    throw new Error('视觉识别已启用但未配置可用的视觉模型，请在 设置 → 视觉识别 中完成配置。');
  }

  const { images, userText } = extractLastUserImages(apiMessages);
  if (images.length === 0) {
    // 本轮无新图，仅剥离历史图片避免触发供应商报错
    return applyVisionAnalysisToApiMessages(apiMessages, null);
  }

  try {
    const analysis = await analyzeImagesWithVisionModel({
      model: visionModel,
      images,
      userText,
      prompt: state.prompt,
      timeoutMs: state.timeoutMs,
      abortSignal,
    });
    return applyVisionAnalysisToApiMessages(apiMessages, analysis);
  } catch (error: any) {
    if (error?.name === 'AbortError' || abortSignal?.aborted) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    if (state.onFailure === 'continueWithoutImage') {
      logger.warn(`图片分析失败，按降级策略继续发送（无图）: ${message}`);
      return applyVisionAnalysisToApiMessages(apiMessages, null);
    }
    throw new Error(`视觉识别分析失败: ${message}`, { cause: error });
  }
}

/** 测试视觉模型 API 连接（设置页"测试 API 连接"按钮） */
export async function testVisionModelConnection(state: VisionRecognitionState): Promise<VisionTestResult> {
  const model = resolveVisionModel(state);
  if (!model) {
    return { success: false, message: '配置不完整：请填写模型名称、API地址和密钥，或选择一个预设模型' };
  }

  const startedAt = Date.now();
  try {
    const client = createClient(model);
    const response = await withTimeout(
      client.chat.completions.create({
        model: model.id,
        messages: [{ role: 'user', content: '你好' }],
        max_tokens: 16,
        stream: false,
      }),
      30000,
      '连接测试'
    );
    const content = response.choices?.[0]?.message?.content ?? '';
    return {
      success: true,
      message: `连接成功！响应: ${content.slice(0, 50) || '(空内容)'}`,
      latencyMs: Date.now() - startedAt,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, message: `连接失败: ${message}` };
  }
}
