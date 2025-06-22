/**
 * AI SDK 流式响应模块
 * 使用 @ai-sdk/openai 实现真正的流式响应，解决浏览器环境下的延迟问题
 */
import { streamText } from 'ai';
import { logApiRequest } from '../../services/LoggerService';
import { EventEmitter, EVENT_NAMES } from '../../services/EventEmitter';
import { hasToolUseTags } from '../../utils/mcpToolParser';
import { ChunkType } from '../../types/chunk';
import { getAppropriateTag } from '../../config/reasoningTags';
import type { Model } from '../../types';



/**
 * AI SDK 流式完成函数
 * 与原有 streamCompletion 接口保持一致，但内部使用 AI SDK
 */
export async function streamCompletionAISDK(
  aiSdkClient: any, // AI SDK 客户端
  modelId: string,
  messages: any[],
  temperature?: number,
  maxTokens?: number,
  onUpdate?: (content: string, reasoning?: string) => void,
  additionalParams?: any,
  onChunk?: (chunk: any) => void
): Promise<string> {
  console.log('[AI SDK streamCompletion] 开始流式响应...');

  try {
    // 获取中断信号
    const signal = additionalParams?.signal;

    // 检查是否启用推理
    const enableReasoning = additionalParams?.enableReasoning !== false;

    // 获取模型信息和推理标签
    const model = additionalParams?.model || { id: modelId, provider: 'openai-aisdk' } as Model;
    const reasoningTag = getAppropriateTag(model);

    console.log(`[AI SDK streamCompletion] 模型: ${modelId}, 温度: ${temperature}, 最大令牌: ${maxTokens}`);
    console.log(`[AI SDK streamCompletion] 推理模式: ${enableReasoning ? '启用' : '禁用'}, 标签: ${reasoningTag}`);

    // 准备消息
    const processedMessages = messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    // 记录API请求
    logApiRequest('OpenAI AI SDK Chat Completions Stream', 'INFO', {
      provider: 'openai-aisdk',
      model: modelId,
      messages: processedMessages,
      temperature,
      maxTokens,
      timestamp: Date.now()
    });

    // 使用AI SDK创建流式文本生成
    const result = await streamText({
      model: aiSdkClient(modelId),
      messages: processedMessages,
      temperature: temperature || 1.0,
      maxTokens: maxTokens || 2000,
      abortSignal: signal
    });

    console.log('[AI SDK streamCompletion] 流式响应已创建，开始处理数据...');

    let fullContent = '';
    let fullReasoning = '';
    let contentBuffer = ''; // 缓冲区，用于处理跨chunk的标签
    let isInThinkTag = false; // 是否在<think>标签内
    let thinkBuffer = ''; // 思考内容缓冲区
    let hasReasoningContent = false;
    let reasoningStartTime = 0;

    // 处理流式响应
    for await (const textPart of result.textStream) {
      // 将当前内容添加到缓冲区
      contentBuffer += textPart;

      // 处理<think>标签 - 改进的逻辑，确保不丢失内容
      let processedAnyContent = true;
      while (processedAnyContent && contentBuffer.length > 0) {
        processedAnyContent = false;

        if (!isInThinkTag) {
          // 查找<think>开始标签
          const thinkStartIndex = contentBuffer.indexOf('<think>');
          if (thinkStartIndex !== -1) {
            // 处理<think>标签之前的普通内容
            const beforeThink = contentBuffer.substring(0, thinkStartIndex);
            if (beforeThink) {
              fullContent += beforeThink;
              if (onUpdate) {
                onUpdate(beforeThink);
              }
            }

            // 进入思考模式
            isInThinkTag = true;
            if (!hasReasoningContent) {
              hasReasoningContent = true;
              reasoningStartTime = Date.now();
            }

            // 移除已处理的内容
            contentBuffer = contentBuffer.substring(thinkStartIndex + 7); // 7 = '<think>'.length
            processedAnyContent = true;
          } else {
            // 没有找到<think>标签，但可能标签被分割了，保留一些内容以防万一
            if (contentBuffer.length > 10) {
              // 只有当缓冲区足够大时才处理普通内容，避免截断<think>标签
              const safeContent = contentBuffer.substring(0, contentBuffer.length - 10);
              const remainingContent = contentBuffer.substring(contentBuffer.length - 10);

              if (safeContent) {
                fullContent += safeContent;
                if (onUpdate) {
                  onUpdate(safeContent);
                }
              }

              contentBuffer = remainingContent;
              processedAnyContent = true;
            }
            // 如果缓冲区不够大，等待更多内容
          }
        } else {
          // 在<think>标签内，查找</think>结束标签
          const thinkEndIndex = contentBuffer.indexOf('</think>');
          if (thinkEndIndex !== -1) {
            // 处理思考内容
            const thinkContent = contentBuffer.substring(0, thinkEndIndex);
            if (thinkContent) {
              thinkBuffer += thinkContent;
              fullReasoning += thinkContent;
              // 发送思考内容事件
              if (onChunk) {
                onChunk({
                  type: 'thinking.delta',
                  text: thinkContent,
                  thinking_millsec: Date.now() - reasoningStartTime
                });
              }
            }

            // 退出思考模式
            isInThinkTag = false;

            // 移除已处理的内容
            contentBuffer = contentBuffer.substring(thinkEndIndex + 8); // 8 = '</think>'.length
            processedAnyContent = true;
          } else {
            // 没有找到结束标签，但可能标签被分割了，保留一些内容以防万一
            if (contentBuffer.length > 10) {
              // 只有当缓冲区足够大时才处理思考内容，避免截断</think>标签
              const safeThinkContent = contentBuffer.substring(0, contentBuffer.length - 10);
              const remainingContent = contentBuffer.substring(contentBuffer.length - 10);

              if (safeThinkContent) {
                thinkBuffer += safeThinkContent;
                fullReasoning += safeThinkContent;
                // 发送思考内容片段事件
                if (onChunk) {
                  onChunk({
                    type: ChunkType.THINKING_DELTA,
                    text: safeThinkContent,
                    thinking_millsec: Date.now() - reasoningStartTime
                  });
                }
              }

              contentBuffer = remainingContent;
              processedAnyContent = true;
            }
            // 如果缓冲区不够大，等待更多内容
          }
        }
      }
    }

    // 处理流结束后剩余的内容
    if (contentBuffer.length > 0) {
      if (isInThinkTag) {
        // 如果还在思考标签内，将剩余内容作为思考内容
        thinkBuffer += contentBuffer;
        fullReasoning += contentBuffer;
        if (onChunk) {
          onChunk({
            type: 'thinking.delta',
            text: contentBuffer,
            thinking_millsec: Date.now() - reasoningStartTime
          });
        }
      } else {
        // 否则作为普通内容
        fullContent += contentBuffer;
        if (onUpdate) {
          onUpdate(contentBuffer);
        }
      }
    }

    console.log(`[AI SDK streamCompletion] 流式响应完成，总长度: ${fullContent.length}`);

    // 发送完成事件
    EventEmitter.emit(EVENT_NAMES.STREAM_COMPLETE, {
      provider: 'openai-aisdk',
      model: modelId,
      content: fullContent,
      reasoning: fullReasoning,
      timestamp: Date.now()
    });

    // 检查是否包含工具使用标签
    if (hasToolUseTags(fullContent)) {
      console.log('[AI SDK streamCompletion] 检测到工具使用标签');
      EventEmitter.emit(EVENT_NAMES.TOOL_USE_DETECTED, {
        content: fullContent,
        model: modelId
      });
    }

    return fullContent;

  } catch (error: any) {
    console.error('[AI SDK streamCompletion] 流式响应失败:', error);

    // 发送错误事件
    EventEmitter.emit(EVENT_NAMES.STREAM_ERROR, {
      provider: 'openai-aisdk',
      model: modelId,
      error: error.message,
      timestamp: Date.now()
    });

    throw error;
  }
}
