# Phase 4: 功能中间件

> **目标**：实现 Web 搜索、图片生成、错误重试等功能中间件
> **预计工时**：2 天

---

## 1. 需要实现的中间件

| 中间件 | 功能 | 优先级 |
|--------|------|--------|
| `WebSearchMiddleware` | Web 搜索处理 | P1 |
| `ThinkingTagExtractionMiddleware` | `<think>` 标签提取 | P1 |
| `ImageGenerationMiddleware` | 图片生成处理 | P1 |
| `RetryMiddleware` | 错误重试 | P1 |
| `RateLimitMiddleware` | 频率限制处理 | P2 |

---

## 2. WebSearchMiddleware

**职责**：处理内置 Web 搜索功能

```typescript
/**
 * Web 搜索中间件
 * 对标 Cherry Studio WebSearchMiddleware
 */
export const MIDDLEWARE_NAME = 'WebSearchMiddleware';

export const WebSearchMiddleware: CompletionsMiddleware = (api) => (next) =>
  async (context, params) => {
    const { enableWebSearch, onChunk } = params;
    
    if (!enableWebSearch) {
      return next(context, params);
    }
    
    let webSearchResults: WebSearchResult[] = [];
    let searchSource: WebSearchSource = WebSearchSource.AISDK;
    
    // 包装 onChunk 收集搜索结果
    const wrappedOnChunk = async (chunk: Chunk) => {
      // 处理不同来源的搜索结果
      if (chunk.type === ChunkType.LLM_WEB_SEARCH_COMPLETE) {
        const searchChunk = chunk as LlmWebSearchCompleteChunk;
        webSearchResults = searchChunk.llm_web_search.results;
        searchSource = searchChunk.llm_web_search.source;
      }
      
      // 处理 Gemini grounding
      if ('providerMetadata' in chunk) {
        const metadata = (chunk as any).providerMetadata;
        if (metadata?.google?.groundingMetadata) {
          webSearchResults = extractGeminiGroundingResults(metadata.google.groundingMetadata);
          searchSource = WebSearchSource.GEMINI;
        }
      }
      
      // 处理 OpenAI citations
      if ('citations' in chunk) {
        const citations = (chunk as any).citations;
        if (citations?.length > 0) {
          webSearchResults = extractOpenAICitations(citations);
          searchSource = WebSearchSource.OPENAI;
        }
      }
      
      if (onChunk) {
        await onChunk(chunk);
      }
    };
    
    const result = await next(context, { ...params, onChunk: wrappedOnChunk });
    
    // 发送搜索结果完成事件
    if (webSearchResults.length > 0 && onChunk) {
      await onChunk({
        type: ChunkType.LLM_WEB_SEARCH_COMPLETE,
        llm_web_search: {
          results: webSearchResults,
          source: searchSource,
        },
      });
    }
    
    return result;
  };

/**
 * Web 搜索结果
 */
export interface WebSearchResult {
  url: string;
  title?: string;
  snippet?: string;
  id?: string;
}

/**
 * 搜索来源
 */
export enum WebSearchSource {
  OPENAI = 'openai',
  OPENAI_RESPONSE = 'openai_response',
  GEMINI = 'gemini',
  ANTHROPIC = 'anthropic',
  PERPLEXITY = 'perplexity',
  AISDK = 'aisdk',
}
```

---

## 3. ThinkingTagExtractionMiddleware

**职责**：从文本中提取 `<think>` `<reasoning>` 等思考标签

```typescript
/**
 * 思考标签提取中间件
 * 对标 Cherry Studio ThinkingTagExtractionMiddleware
 */
export const MIDDLEWARE_NAME = 'ThinkingTagExtractionMiddleware';

// 支持的标签名称
const THINKING_TAG_NAMES = ['think', 'thinking', 'reasoning', 'thought'];

export const ThinkingTagExtractionMiddleware: CompletionsMiddleware = (api) => (next) =>
  async (context, params) => {
    const { onChunk, assistant } = params;
    
    // 检查是否需要提取思考标签
    const model = assistant?.model;
    if (!model || !shouldExtractThinkingTags(model, context.apiClientInstance)) {
      return next(context, params);
    }
    
    let isInThinking = false;
    let thinkingBuffer = '';
    let textBuffer = '';
    
    const wrappedOnChunk = async (chunk: Chunk) => {
      if (chunk.type === ChunkType.TEXT_DELTA && 'text' in chunk) {
        const text = chunk.text;
        
        // 处理思考标签
        const { thinking, content, stillInThinking } = extractThinkingFromText(
          textBuffer + text,
          isInThinking,
          THINKING_TAG_NAMES
        );
        
        isInThinking = stillInThinking;
        
        // 发送思考内容
        if (thinking) {
          if (!thinkingBuffer) {
            // 首次思考，发送开始事件
            if (onChunk) {
              await onChunk({ type: ChunkType.THINKING_START });
            }
          }
          thinkingBuffer += thinking;
          if (onChunk) {
            await onChunk({
              type: ChunkType.THINKING_DELTA,
              text: thinkingBuffer,
            });
          }
        }
        
        // 发送正常文本
        if (content) {
          if (thinkingBuffer && !isInThinking) {
            // 思考结束
            if (onChunk) {
              await onChunk({
                type: ChunkType.THINKING_COMPLETE,
                text: thinkingBuffer,
              });
            }
          }
          if (onChunk) {
            await onChunk({
              type: ChunkType.TEXT_DELTA,
              text: content,
            });
          }
        }
        
        // 更新缓冲区
        textBuffer = stillInThinking ? textBuffer + text : '';
        
        return; // 不转发原始 chunk
      }
      
      // 其他类型直接转发
      if (onChunk) {
        await onChunk(chunk);
      }
    };
    
    return next(context, { ...params, onChunk: wrappedOnChunk });
  };

/**
 * 判断是否需要提取思考标签
 */
function shouldExtractThinkingTags(model: Model, client: BaseApiClient): boolean {
  const clientTypes = client.getClientCompatibilityType(model);
  
  // OpenAI 兼容客户端需要提取
  return clientTypes.includes('OpenAIAPIClient') || 
         clientTypes.includes('OpenAIClient');
}

/**
 * 从文本中提取思考内容
 */
function extractThinkingFromText(
  text: string,
  isInThinking: boolean,
  tagNames: string[]
): { thinking: string; content: string; stillInThinking: boolean } {
  let thinking = '';
  let content = '';
  let stillInThinking = isInThinking;
  
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
      } else {
        thinking = text;
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
        } else {
          thinking = afterOpen;
          stillInThinking = true;
        }
      } else {
        content = text;
      }
    }
    
    if (thinking || stillInThinking !== isInThinking) {
      break;
    }
  }
  
  return { thinking, content, stillInThinking };
}
```

---

## 4. ImageGenerationMiddleware

**职责**：处理图片生成请求

```typescript
/**
 * 图片生成中间件
 */
export const MIDDLEWARE_NAME = 'ImageGenerationMiddleware';

export const ImageGenerationMiddleware: CompletionsMiddleware = (api) => (next) =>
  async (context, params) => {
    const { assistant, onChunk } = params;
    const model = assistant?.model;
    
    // 检查是否是图片生成模型
    if (!model || !isDedicatedImageGenerationModel(model)) {
      return next(context, params);
    }
    
    console.log(`[ImageGenerationMiddleware] Handling image generation for model: ${model.id}`);
    
    // 发送图片创建开始事件
    if (onChunk) {
      await onChunk({ type: ChunkType.IMAGE_CREATED });
    }
    
    try {
      // 提取 prompt
      const prompt = extractPromptFromMessages(params.messages);
      
      // 调用图片生成
      const images = await context.apiClientInstance.generateImage({
        model: model.id,
        prompt,
        n: 1,
        size: '1024x1024',
      });
      
      // 发送图片完成事件
      if (onChunk) {
        await onChunk({
          type: ChunkType.IMAGE_COMPLETE,
          image: {
            type: 'url',
            images,
          },
        });
      }
      
      return {
        getText: () => '',
        getReasoning: () => undefined,
      };
    } catch (error) {
      if (onChunk) {
        await onChunk({
          type: ChunkType.ERROR,
          error: {
            message: error instanceof Error ? error.message : String(error),
            type: 'IMAGE_GENERATION_ERROR',
          },
        });
      }
      throw error;
    }
  };

/**
 * 判断是否是专用图片生成模型
 */
function isDedicatedImageGenerationModel(model: Model): boolean {
  const imageModels = ['dall-e-2', 'dall-e-3', 'stable-diffusion', 'midjourney'];
  return imageModels.some(m => model.id.toLowerCase().includes(m));
}
```

---

## 5. RetryMiddleware

**职责**：自动重试失败的请求

```typescript
/**
 * 重试中间件
 */
export const MIDDLEWARE_NAME = 'RetryMiddleware';

interface RetryConfig {
  maxRetries: number;
  retryDelay: number;
  retryableErrors: string[];
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  retryDelay: 1000,
  retryableErrors: ['ECONNRESET', 'ETIMEDOUT', '429', '503', '502'],
};

export const RetryMiddleware: CompletionsMiddleware = (api) => (next) =>
  async (context, params) => {
    const config = { ...DEFAULT_RETRY_CONFIG };
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`[RetryMiddleware] Retry attempt ${attempt}/${config.maxRetries}`);
          await sleep(config.retryDelay * attempt); // 指数退避
        }
        
        return await next(context, params);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // 检查是否可重试
        if (!isRetryableError(lastError, config.retryableErrors)) {
          throw lastError;
        }
        
        // 检查是否是中断
        if (context._internal.flowControl?.abortSignal?.aborted) {
          throw lastError;
        }
        
        console.warn(`[RetryMiddleware] Retryable error: ${lastError.message}`);
      }
    }
    
    throw lastError || new Error('Max retries exceeded');
  };

function isRetryableError(error: Error, patterns: string[]): boolean {
  const message = error.message.toLowerCase();
  return patterns.some(pattern => message.includes(pattern.toLowerCase()));
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

---

## 6. 验收标准

- [ ] Web 搜索结果正确收集和发送
- [ ] 思考标签正确提取
- [ ] 图片生成流程完整
- [ ] 错误重试逻辑正确
- [ ] 所有中间件可独立启用/禁用
