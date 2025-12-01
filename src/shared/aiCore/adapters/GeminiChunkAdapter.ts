/**
 * Gemini Chunk 适配器
 * 
 * @deprecated 请使用统一的 AiSdkToChunkAdapter
 * 此类保留用于向后兼容，内部委托给 AiSdkToChunkAdapter
 * 
 * 设计说明（参考 Cherry Studio）：
 * - AI SDK 已将各 Provider 的响应格式标准化
 * - 不再需要为每个 Provider 创建独立适配器
 * - 使用单一的 AiSdkToChunkAdapter 处理所有事件
 */

import { AiSdkToChunkAdapter } from './AiSdkToChunkAdapter';
import type { ChunkAdapterConfig, AiSdkStreamResult } from './types';

/**
 * @deprecated 请使用 AiSdkToChunkAdapter
 */
export class GeminiChunkAdapter extends AiSdkToChunkAdapter {
  constructor(config: ChunkAdapterConfig) {
    super(config);
    console.warn('[GeminiChunkAdapter] 已废弃，请使用 AiSdkToChunkAdapter');
  }

  /**
   * 处理流式响应
   * 保留原有方法签名以兼容现有代码
   */
  async processStream(stream: AiSdkStreamResult | AsyncIterable<any>): Promise<string> {
    // 如果是 AI SDK 标准格式
    if ('fullStream' in stream && 'text' in stream) {
      return super.processStream(stream as AiSdkStreamResult);
    }
    
    // 兼容旧的 AsyncIterable 格式
    console.warn('[GeminiChunkAdapter] 检测到旧格式流，建议迁移到 AI SDK 格式');
    return this.processLegacyStream(stream as AsyncIterable<any>);
  }

  /**
   * 处理旧格式的流（兼容）
   */
  private async processLegacyStream(stream: AsyncIterable<any>): Promise<string> {
    let text = '';
    
    for await (const chunk of stream) {
      // 尝试多种方式获取文本
      const content = this.extractText(chunk);
      if (content) {
        text += content;
      }
    }
    
    return text;
  }

  /**
   * 从 Gemini chunk 中提取文本
   */
  private extractText(chunk: any): string | null {
    // Gemini SDK 格式
    if (typeof chunk.text === 'function') {
      return chunk.text() || null;
    }
    
    // 直接文本
    if (typeof chunk.text === 'string') {
      return chunk.text;
    }
    
    // candidates 格式
    const candidate = chunk.candidates?.[0];
    if (candidate?.content?.parts) {
      const textPart = candidate.content.parts.find((p: any) => 
        typeof p.text === 'string'
      );
      return textPart?.text || null;
    }

    return null;
  }
}
