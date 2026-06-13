import type { Model } from '../../../types';
import { isVisionModel } from '../../../../config/models/vision';

export function hasImageContentInApiMessages(apiMessages: Array<{ content?: unknown }>): boolean {
  return apiMessages.some((message) => {
    if (!Array.isArray(message.content)) return false;
    return message.content.some((part) => {
      if (!part || typeof part !== 'object') return false;
      return (part as { type?: string }).type === 'image_url';
    });
  });
}

export function modelSupportsImageInput(model: Model): boolean {
  if (model.multimodal) {
    return true;
  }

  return isVisionModel(model);
}

export function assertModelSupportsApiMessages(model: Model, apiMessages: Array<{ content?: unknown }>): void {
  if (!hasImageContentInApiMessages(apiMessages) || modelSupportsImageInput(model)) {
    return;
  }

  const modelName = model.name || model.id;
  throw new Error(`当前模型「${modelName}」不支持图片输入，请切换到视觉模型、移除图片后重试，或在 设置 → 视觉识别 中开启自动图片分析。`);
}
