import { ModelType, type Model } from '../../../types';

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
  if (model.capabilities?.vision || model.capabilities?.multimodal || model.multimodal) {
    return true;
  }

  if (model.modelTypes?.includes(ModelType.Vision)) {
    return true;
  }

  const modelId = model.id.toLowerCase();
  return [
    'gpt-4o',
    'gpt-4.1',
    'gpt-4-vision',
    'gemini',
    'claude-3',
    'qwen-vl',
    'qwen2-vl',
    'qwen2.5-vl',
    'vision'
  ].some((visionModelId) => modelId.includes(visionModelId));
}

export function assertModelSupportsApiMessages(model: Model, apiMessages: Array<{ content?: unknown }>): void {
  if (!hasImageContentInApiMessages(apiMessages) || modelSupportsImageInput(model)) {
    return;
  }

  const modelName = model.name || model.id;
  throw new Error(`当前模型「${modelName}」不支持图片输入，请切换到视觉模型、移除图片后重试，或在 设置 → 视觉识别 中开启自动图片分析。`);
}
