/**
 * 流处理工具函数
 * 提供处理流式响应的工具函数
 */

/**
 * 将异步生成器转换为可读流
 * @param generator 异步生成器
 * @returns 可读流
 */
export async function* asyncIterableToGenerator<T>(iterable: AsyncIterable<T>): AsyncGenerator<T> {
  for await (const item of iterable) {
    yield item;
  }
}

/**
 * 将异步生成器转换为可读流
 * @param generator 异步生成器
 * @returns 可读流
 */
export function asyncGeneratorToReadableStream<T>(generator: AsyncGenerator<T>): ReadableStream<T> {
  return new ReadableStream<T>({
    async pull(controller) {
      try {
        const { value, done } = await generator.next();
        if (done) {
          controller.close();
        } else {
          controller.enqueue(value);
        }
      } catch (error) {
        controller.error(error);
      }
    },
    async cancel() {
      // 尝试取消生成器，忽略返回值
      try {
        await generator.return?.({} as T);
      } catch (e) {
        // 忽略错误
      }
    }
  });
}

/**
 * 将可读流转换为异步迭代器
 * @param stream 可读流
 * @returns 异步迭代器
 */
export async function* readableStreamAsyncIterable<T>(stream: ReadableStream<T>): AsyncIterable<T> {
  const reader = stream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        return;
      }
      yield value;
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * 将文本块转换为文本增量
 * @param text 文本块
 * @returns 文本增量对象
 */
export function textToTextDelta(text: string): { type: 'text-delta'; textDelta: string } {
  return { type: 'text-delta', textDelta: text };
}

/**
 * 将思考块转换为思考增量
 * @param text 思考块
 * @returns 思考增量对象
 */
export function textToReasoningDelta(text: string): { type: 'reasoning'; textDelta: string } {
  return { type: 'reasoning', textDelta: text };
}

/**
 * OpenAI流式响应块类型
 */
export type OpenAIStreamChunk =
  | { type: 'text-delta'; textDelta: string }
  | { type: 'reasoning'; textDelta: string };

/**
 * 将OpenAI块转换为文本增量或思考增量
 * @param chunk OpenAI块
 * @returns 文本增量或思考增量对象
 */
export async function* openAIChunkToTextDelta(stream: AsyncIterable<any>): AsyncGenerator<OpenAIStreamChunk> {
  // 用于跟踪已经收到的完整推理消息，避免重复处理
  let processedReasoning = '';
  let chunkCount = 0;

  // 只在开发环境输出开始日志
  if (process.env.NODE_ENV === 'development') {
    console.log('[openAIChunkToTextDelta] 开始处理流式响应');
  }

  for await (const chunk of stream) {
    chunkCount++;
    // 移除频繁的 chunk 日志，只在出错时输出
    if (chunk.choices && chunk.choices.length > 0) {
      const delta = chunk.choices[0].delta;

      // 处理文本内容 - 添加安全检查
      if (delta?.content && typeof delta.content === 'string') {
        // 确保只处理新增的内容
        const textDelta = delta.content;
        yield { type: 'text-delta', textDelta };
      }

      // 处理思考内容 - 支持多种字段名，添加安全检查
      if (delta?.reasoning_content || delta?.reasoning) {
        const reasoningContent = delta.reasoning_content || delta.reasoning;
        // 确保只处理新增的思考内容，并检查类型
        if (reasoningContent && typeof reasoningContent === 'string') {
          yield { type: 'reasoning', textDelta: reasoningContent };
        }
      }

      // 处理DeepSeek特有的思考内容字段
      // 特别注意：DeepSeek有时会发送完整消息而非增量
      if (chunk.choices[0]?.message?.reasoning_content) {
        const fullReasoning = chunk.choices[0].message.reasoning_content;

        // 添加安全检查
        if (fullReasoning && typeof fullReasoning === 'string' && fullReasoning !== processedReasoning) {
          // 找出新增的部分
          const newContent = fullReasoning.slice(processedReasoning.length);
          if (newContent) {
            processedReasoning = fullReasoning;
            yield { type: 'reasoning', textDelta: newContent };
          }
        }
      }

      // 处理完成原因 - 确保在流结束时正确处理
      const finishReason = chunk.choices[0]?.finish_reason;
      if (finishReason && process.env.NODE_ENV === 'development') {
        console.log(`[openAIChunkToTextDelta] 检测到完成原因: ${finishReason}`);
        // 注意：这里不需要yield finish事件，因为上层会处理
        // 但我们需要确保这个chunk被正确处理
      }
    }
  }

  // 只在开发环境输出完成日志
  if (process.env.NODE_ENV === 'development') {
    console.log(`[openAIChunkToTextDelta] 流式响应处理完成，总共处理了 ${chunkCount} 个chunk`);
  }
}
