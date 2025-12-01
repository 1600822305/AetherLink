/**
 * 思考标签提取中间件
 * 对标 Cherry Studio ThinkingTagExtractionMiddleware
 * 
 * 从文本中提取 <think>, <thinking>, <reasoning> 等标签内容
 */
import type { CompletionsMiddleware } from '../types';
import type { CompletionsResult } from '../schemas';
import { ChunkType, type Chunk } from '../../types/chunk';

export const MIDDLEWARE_NAME = 'ThinkingTagExtractionMiddleware';

/**
 * 支持的思考标签名称
 */
const THINKING_TAG_NAMES = ['think', 'thinking', 'reasoning', 'thought'];

/**
 * 思考标签提取中间件
 * 从文本流中提取思考标签内容并转换为 THINKING_* 事件
 */
export const ThinkingTagExtractionMiddleware: CompletionsMiddleware = (_api) => (next) =>
  async (context, params): Promise<CompletionsResult> => {
    const { onChunk, assistant } = params;
    const { apiClientInstance } = context;

    // 检查是否需要提取思考标签（仅 OpenAI 兼容客户端）
    const model = assistant?.model;
    const clientTypes = apiClientInstance.getClientCompatibilityType?.(model) || [];
    const shouldExtract = clientTypes.some(t => 
      t.includes('OpenAI') || t.includes('openai')
    );

    if (!shouldExtract || !onChunk) {
      return next(context, params);
    }

    console.log('[ThinkingTagExtractionMiddleware] Enabled for OpenAI-compatible client');

    // 状态
    let buffer = '';
    let isInThinking = false;
    let hasEmittedThinkingStart = false;
    let thinkingContent = '';

    // 包装 onChunk 提取思考标签
    const wrappedOnChunk = async (chunk: Chunk) => {
      if (chunk.type !== ChunkType.TEXT_DELTA || !('text' in chunk)) {
        await onChunk(chunk);
        return;
      }

      buffer += chunk.text;

      // 尝试处理缓冲区
      const { thinking, content, stillInThinking } = processBuffer(
        buffer,
        isInThinking,
        THINKING_TAG_NAMES
      );

      // 如果进入思考模式
      if (stillInThinking && !isInThinking) {
        isInThinking = true;
        if (!hasEmittedThinkingStart) {
          hasEmittedThinkingStart = true;
          await onChunk({ type: ChunkType.THINKING_START });
        }
      }

      // 发送思考内容
      if (thinking) {
        thinkingContent += thinking;
        await onChunk({
          type: ChunkType.THINKING_DELTA,
          text: thinkingContent,
        });
      }

      // 如果离开思考模式
      if (!stillInThinking && isInThinking) {
        isInThinking = false;
        await onChunk({
          type: ChunkType.THINKING_COMPLETE,
          text: thinkingContent,
        });
        thinkingContent = '';
      }

      // 发送正常文本内容
      if (content) {
        await onChunk({
          type: ChunkType.TEXT_DELTA,
          text: content,
        });
      }

      // 更新缓冲区
      buffer = stillInThinking ? buffer : '';
    };

    // 执行下游中间件
    const result = await next(context, { ...params, onChunk: wrappedOnChunk });

    // 处理剩余缓冲区
    if (buffer && onChunk) {
      if (isInThinking) {
        // 未闭合的思考标签
        thinkingContent += buffer;
        await onChunk({
          type: ChunkType.THINKING_COMPLETE,
          text: thinkingContent,
        });
      } else {
        // 正常文本
        await onChunk({
          type: ChunkType.TEXT_DELTA,
          text: buffer,
        });
      }
    }

    return result;
  };

/**
 * 处理缓冲区，提取思考内容
 */
function processBuffer(
  text: string,
  isInThinking: boolean,
  tagNames: string[]
): { thinking: string; content: string; stillInThinking: boolean } {
  let thinking = '';
  let content = '';
  let stillInThinking = isInThinking;
  let processed = false;

  for (const tagName of tagNames) {
    const openTag = `<${tagName}>`;
    const closeTag = `</${tagName}>`;

    if (isInThinking) {
      // 在思考中，寻找结束标签
      const closeIndex = text.indexOf(closeTag);
      if (closeIndex !== -1) {
        thinking = text.substring(0, closeIndex);
        content = text.substring(closeIndex + closeTag.length);
        stillInThinking = false;
        processed = true;
        break;
      } else {
        // 未找到结束标签，继续累积
        thinking = text;
        processed = true;
        break;
      }
    } else {
      // 寻找开始标签
      const openIndex = text.indexOf(openTag);
      if (openIndex !== -1) {
        content = text.substring(0, openIndex);
        const afterOpen = text.substring(openIndex + openTag.length);

        // 检查是否有结束标签
        const closeIndex = afterOpen.indexOf(closeTag);
        if (closeIndex !== -1) {
          thinking = afterOpen.substring(0, closeIndex);
          content += afterOpen.substring(closeIndex + closeTag.length);
          stillInThinking = false;
        } else {
          thinking = afterOpen;
          stillInThinking = true;
        }
        processed = true;
        break;
      }
    }
  }

  if (!processed) {
    // 没有标签，按原样处理
    if (isInThinking) {
      thinking = text;
    } else {
      content = text;
    }
  }

  return { thinking, content, stillInThinking };
}
