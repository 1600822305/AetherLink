/**
 * 流处理工具函数
 * 提供处理流式响应的工具函数
 */

/**
 * 将异步迭代器转换为异步生成器。
 * 注意：在现代JavaScript中，任何异步迭代器都可以直接在 for...await...of 中使用，
 * 这个函数主要用于类型转换或明确意图。
 * @param iterable 异步迭代器
 * @returns 异步生成器
 */
export async function* asyncIterableToGenerator<T>(iterable: AsyncIterable<T>): AsyncGenerator<T> {
  for await (const item of iterable) {
    yield item;
  }
}

/**
 * 将异步生成器转换为 Web API 的 ReadableStream。
 * @param generator 异步生成器
 * @returns 可读流 (ReadableStream)
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
    async cancel(reason) {
      console.log('[asyncGeneratorToReadableStream] 流被取消，原因:', reason);
      // 尝试优雅地关闭生成器
      try {
        await generator.return?.(undefined as any);
      } catch (e) {
        // 忽略在取消过程中可能发生的错误
      }
    }
  });
}

/**
 * 将 Web API 的 ReadableStream 转换为异步迭代器，以便在 for...await...of 中使用。
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
 * OpenAI流式响应块的标准化类型定义
 */
export type OpenAIStreamChunk =
  | { type: 'text-delta'; textDelta: string }
  | { type: 'reasoning'; textDelta: string };


/**
 * 将原始的OpenAI事件流转换为标准化的文本或思考增量块。
 *
 * 这是一个经过性能和健壮性优化的版本，具有以下特性：
 * 1. 【性能】使用缓冲区批量处理数据，合并多个微小的数据块，显著减少yield调用频率，从而避免UI渲染瓶颈，保证动画流畅。
 * 2. 【健壮性】包含完整的 try/catch/finally 错误处理，确保在流中断或结束时，缓冲区内容不会丢失。
 * 3. 【兼容性】支持多种推理字段名 (e.g., `reasoning`, `reasoning_content`)。
 * 4. 【特殊处理】兼容 DeepSeek 等特定模型可能一次性发送完整消息而非增量的行为，并能正确计算出增量部分。
 *
 * @param stream 从OpenAI API接收的原始事件流 (AsyncIterable<any>)
 * @returns 一个异步生成器，产出标准化的 `OpenAIStreamChunk` 对象
 */
export async function* openAIChunkToTextDelta(stream: AsyncIterable<any>): AsyncGenerator<OpenAIStreamChunk> {
  // 缓冲区，用于批量更新，提升性能
  let textBuffer = '';
  let reasoningBuffer = '';
  // 用于处理DeepSeek等发送完整消息而非增量的模型
  let processedFullReasoning = '';

  // 当缓冲区大小达到此值时，立即刷新（yield），可根据需要调整
  const BUFFER_FLUSH_SIZE = 64;

  // 辅助函数：用于清空并yield缓冲区中的内容，避免代码重复
  const flushBuffers = function* (): Generator<OpenAIStreamChunk, void, unknown> {
    if (textBuffer.length > 0) {
      // `as const` 保留字面量类型，防止被宽化为 string
      yield { type: 'text-delta', textDelta: textBuffer } as const;
      textBuffer = '';
    }
    if (reasoningBuffer.length > 0) {
      yield { type: 'reasoning', textDelta: reasoningBuffer } as const;
      reasoningBuffer = '';
    }
  };

  try {
    for await (const chunk of stream) {
      // 安全检查，跳过无效的chunk
      if (!chunk.choices || chunk.choices.length === 0) continue;

      const choice = chunk.choices[0];
      const delta = choice.delta;

      // 1. 处理增量内容 (最常见的情况)
      if (delta) {
        // 处理标准文本内容
        if (delta.content && typeof delta.content === 'string') {
          textBuffer += delta.content;
        }

        // 处理增量思考内容
        const reasoningDelta = delta.reasoning_content || delta.reasoning;
        if (reasoningDelta && typeof reasoningDelta === 'string') {
          reasoningBuffer += reasoningDelta;
        }
      }

      // 2. 处理DeepSeek等模型发送的完整(非增量)推理消息
      const fullReasoning = choice.message?.reasoning_content;
      if (fullReasoning && typeof fullReasoning === 'string' && fullReasoning !== processedFullReasoning) {
        // 计算出新增的部分并加入缓冲区
        const newReasoningContent = fullReasoning.slice(processedFullReasoning.length);
        if (newReasoningContent) {
          reasoningBuffer += newReasoningContent;
          processedFullReasoning = fullReasoning; // 更新已处理的完整内容记录
        }
      }

      // 3. 检查是否需要刷新缓冲区以进行批量更新
      if (textBuffer.length >= BUFFER_FLUSH_SIZE || reasoningBuffer.length >= BUFFER_FLUSH_SIZE) {
        yield* flushBuffers();
      }
    }
  } catch (error) {
    console.error('[openAIChunkToTextDelta] 处理流时发生严重错误:', error);
    // 在重新抛出错误之前，确保将缓冲区中剩余的内容全部发送出去，防止数据丢失
    yield* flushBuffers();
    throw error; // 将错误继续向上传递，以便上层调用者可以捕获
  } finally {
    // 无论流是正常结束还是因错误中断，都必须在最后执行此块
    // 这确保了缓冲区中所有剩余的数据都被发送出去
    yield* flushBuffers();
    if (process.env.NODE_ENV === 'development') {
      console.log('[openAIChunkToTextDelta] 流处理结束，所有缓冲区已清空。');
    }
  }
}
