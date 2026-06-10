import { describe, expect, it } from 'vitest';
import {
  applyVisionAnalysisToApiMessages,
  buildAnalysisText,
  extractLastUserImages,
  type ApiMessage,
} from '../visionFallback';

const imagePart = (url: string) => ({ type: 'image_url', image_url: { url } });

describe('visionFallback', () => {
  describe('extractLastUserImages', () => {
    it('extracts images and text from the last user message containing images', () => {
      const messages: ApiMessage[] = [
        { role: 'user', content: [{ type: 'text', text: 'old' }, imagePart('data:image/png;base64,old')] },
        { role: 'assistant', content: 'reply' },
        { role: 'user', content: [{ type: 'text', text: '这是什么？' }, imagePart('data:image/png;base64,new')] },
      ];

      const result = extractLastUserImages(messages);
      expect(result.messageIndex).toBe(2);
      expect(result.userText).toBe('这是什么？');
      expect(result.images).toHaveLength(1);
      expect(result.images[0].image_url.url).toBe('data:image/png;base64,new');
    });

    it('returns messageIndex -1 when no user message contains images', () => {
      const messages: ApiMessage[] = [
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: [imagePart('data:image/png;base64,a')] },
      ];

      expect(extractLastUserImages(messages).messageIndex).toBe(-1);
    });
  });

  describe('buildAnalysisText', () => {
    it('wraps trimmed analysis in an image_analysis block', () => {
      const text = buildAnalysisText('  图片里有一只猫。  ');
      expect(text).toContain('<image_analysis');
      expect(text).toContain('图片里有一只猫。');
      expect(text.endsWith('</image_analysis>')).toBe(true);
    });
  });

  describe('applyVisionAnalysisToApiMessages', () => {
    it('injects analysis into the last image message and strips historical images', () => {
      const messages: ApiMessage[] = [
        { role: 'user', content: [{ type: 'text', text: 'old question' }, imagePart('data:image/png;base64,old')] },
        { role: 'assistant', content: 'reply' },
        { role: 'user', content: [{ type: 'text', text: '这是什么？' }, imagePart('data:image/png;base64,new')] },
      ];

      const result = applyVisionAnalysisToApiMessages(messages, '一只猫');

      // 历史消息：图片替换为占位文本
      expect(JSON.stringify(result[0].content)).not.toContain('image_url');
      expect(JSON.stringify(result[0].content)).toContain('历史消息中的图片');

      // 最后一条带图消息：注入分析文本
      const lastContent = JSON.stringify(result[2].content);
      expect(lastContent).not.toContain('image_url');
      expect(lastContent).toContain('image_analysis');
      expect(lastContent).toContain('一只猫');
      expect(lastContent).toContain('这是什么？');
    });

    it('strips images with unavailable placeholder when analysis is null', () => {
      const messages: ApiMessage[] = [
        { role: 'user', content: [{ type: 'text', text: '看图' }, imagePart('data:image/png;base64,a')] },
      ];

      const result = applyVisionAnalysisToApiMessages(messages, null);
      const content = JSON.stringify(result[0].content);
      expect(content).not.toContain('image_url');
      expect(content).toContain('视觉分析不可用');
    });

    it('degrades a single remaining text part to string content', () => {
      const messages: ApiMessage[] = [
        { role: 'user', content: [imagePart('data:image/png;base64,a')] },
      ];

      const result = applyVisionAnalysisToApiMessages(messages, '描述');
      expect(typeof result[0].content).toBe('string');
      expect(result[0].content).toContain('image_analysis');
    });

    it('does not modify the original messages (pure function)', () => {
      const messages: ApiMessage[] = [
        { role: 'user', content: [{ type: 'text', text: 'q' }, imagePart('data:image/png;base64,a')] },
      ];
      const snapshot = JSON.stringify(messages);

      applyVisionAnalysisToApiMessages(messages, '描述');
      expect(JSON.stringify(messages)).toBe(snapshot);
    });
  });
});
