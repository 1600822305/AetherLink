/**
 * 响应转换中间件
 * 对标 Cherry Studio ResponseTransformMiddleware
 * 
 * 将 SDK 原始响应转换为统一的内部格式
 */
import type { CompletionsMiddleware } from '../types';
import type { CompletionsResult } from '../schemas';

export const MIDDLEWARE_NAME = 'ResponseTransformMiddleware';

/**
 * 响应转换中间件
 * 确保所有响应都符合统一的 CompletionsResult 格式
 */
export const ResponseTransformMiddleware: CompletionsMiddleware = (_api) => (next) =>
  async (context, params): Promise<CompletionsResult> => {
    const { apiClientInstance } = context;

    // 调用下游中间件获取原始结果
    const result = await next(context, params);

    // 如果结果已经是标准格式，直接返回
    if (result.getText && typeof result.getText === 'function') {
      return result;
    }

    // 转换原始响应为标准格式
    const rawOutput = result.rawOutput;
    
    // 使用客户端的 transformer 转换响应
    const transformer = apiClientInstance.getResponseChunkTransformer?.(context as any);
    
    let text = '';
    let reasoning: string | undefined;

    // 如果有原始输出，尝试提取文本
    if (rawOutput) {
      // 处理流式响应
      if (isAsyncIterable(rawOutput)) {
        const textChunks: string[] = [];
        const thinkingChunks: string[] = [];
        
        for await (const rawChunk of rawOutput as AsyncIterable<unknown>) {
          if (transformer) {
            const transformedChunks = transformer.transform(rawChunk);
            if (transformedChunks && Array.isArray(transformedChunks)) {
              for (const chunk of transformedChunks) {
                if ('text' in chunk && chunk.text) {
                  textChunks.push(chunk.text as string);
                }
                if ('thinking' in chunk && chunk.thinking) {
                  thinkingChunks.push(chunk.thinking as string);
                }
              }
            }
          }
        }
        
        text = textChunks.join('');
        reasoning = thinkingChunks.length > 0 ? thinkingChunks.join('') : undefined;
      }
      // 处理非流式响应
      else if (typeof rawOutput === 'object') {
        const output = rawOutput as Record<string, unknown>;
        
        // OpenAI 格式
        if ('choices' in output && Array.isArray(output.choices)) {
          const choice = output.choices[0] as Record<string, unknown>;
          if (choice?.message && typeof choice.message === 'object') {
            const message = choice.message as Record<string, unknown>;
            text = (message.content as string) || '';
          }
        }
        // Anthropic 格式
        else if ('content' in output && Array.isArray(output.content)) {
          const contents = output.content as Array<Record<string, unknown>>;
          text = contents
            .filter(c => c.type === 'text')
            .map(c => c.text as string)
            .join('');
        }
        // Gemini 格式
        else if ('candidates' in output && Array.isArray(output.candidates)) {
          const candidate = (output.candidates as Array<Record<string, unknown>>)[0];
          if (candidate?.content && typeof candidate.content === 'object') {
            const content = candidate.content as Record<string, unknown>;
            if (Array.isArray(content.parts)) {
              text = (content.parts as Array<Record<string, unknown>>)
                .map(p => p.text as string)
                .filter(Boolean)
                .join('');
            }
          }
        }
      }
    }

    // 返回标准化结果
    return {
      ...result,
      getText: () => text || result.getText?.() || '',
      getReasoning: () => reasoning || result.getReasoning?.(),
    };
  };

/**
 * 检查是否为异步可迭代对象
 */
function isAsyncIterable(obj: unknown): obj is AsyncIterable<unknown> {
  return obj != null && typeof (obj as any)[Symbol.asyncIterator] === 'function';
}
