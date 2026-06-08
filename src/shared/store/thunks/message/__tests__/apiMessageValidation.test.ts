import { describe, expect, it } from 'vitest';
import { ModelType, type Model } from '../../../../types';
import {
  assertModelSupportsApiMessages,
  hasImageContentInApiMessages,
  modelSupportsImageInput
} from '../apiMessageValidation';

const baseModel: Model = {
  id: 'deepseek-chat',
  name: 'DeepSeek Chat',
  provider: 'deepseek'
};

describe('apiMessageValidation', () => {
  it('detects image_url parts in prepared API messages', () => {
    expect(hasImageContentInApiMessages([
      { content: 'hello' },
      {
        content: [
          { type: 'text', text: 'describe this' },
          { type: 'image_url', image_url: { url: 'data:image/png;base64,abc' } }
        ]
      }
    ])).toBe(true);
  });

  it('throws a local capability error for text-only models with image input', () => {
    expect(() => assertModelSupportsApiMessages(baseModel, [
      {
        content: [
          { type: 'text', text: 'describe this' },
          { type: 'image_url', image_url: { url: 'data:image/png;base64,abc' } }
        ]
      }
    ])).toThrow('不支持图片输入');
  });

  it('allows explicitly vision-capable models with image input', () => {
    const visionModel: Model = {
      ...baseModel,
      id: 'custom-vision-model',
      modelTypes: [ModelType.Vision]
    };

    expect(modelSupportsImageInput(visionModel)).toBe(true);
    expect(() => assertModelSupportsApiMessages(visionModel, [
      {
        content: [
          { type: 'text', text: 'describe this' },
          { type: 'image_url', image_url: { url: 'data:image/png;base64,abc' } }
        ]
      }
    ])).not.toThrow();
  });
});
