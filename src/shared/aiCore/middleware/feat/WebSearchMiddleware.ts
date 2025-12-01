/**
 * Web 搜索中间件
 * 对标 Cherry Studio WebSearchMiddleware
 * 
 * 处理内置 Web 搜索功能的结果收集和转发
 */
import type { CompletionsMiddleware } from '../types';
import type { CompletionsResult } from '../schemas';
import { ChunkType, type Chunk } from '../../types/chunk';

export const MIDDLEWARE_NAME = 'WebSearchMiddleware';

/**
 * Web 搜索来源枚举
 */
export enum WebSearchSource {
  OPENAI = 'openai',
  OPENAI_RESPONSE = 'openai_response',
  ANTHROPIC = 'anthropic',
  GEMINI = 'gemini',
  PERPLEXITY = 'perplexity',
  BING = 'bing',
  GOOGLE = 'google',
  AISDK = 'aisdk',
}

/**
 * Web 搜索结果
 */
export interface WebSearchResult {
  url: string;
  title?: string;
  snippet?: string;
  id?: string;
  source?: string;
}

/**
 * Web 搜索中间件
 * 收集和处理 Web 搜索结果
 */
export const WebSearchMiddleware: CompletionsMiddleware = (_api) => (next) =>
  async (context, params): Promise<CompletionsResult> => {
    const { enableWebSearch, onChunk } = params;

    // 如果没有启用 Web 搜索，跳过
    if (!enableWebSearch) {
      return next(context, params);
    }

    console.log('[WebSearchMiddleware] Web search enabled');

    const accumulated = context._internal.accumulated!;
    const webSearchResults: WebSearchResult[] = [];
    let searchSource: WebSearchSource = WebSearchSource.AISDK;

    // 包装 onChunk 收集搜索结果
    const wrappedOnChunk = onChunk
      ? async (chunk: Chunk) => {
          // 处理 LLM 内置 Web 搜索完成
          if (chunk.type === ChunkType.LLM_WEB_SEARCH_COMPLETE) {
            const searchChunk = chunk as any;
            if (searchChunk.llm_web_search?.results) {
              const results = Array.isArray(searchChunk.llm_web_search.results)
                ? searchChunk.llm_web_search.results
                : [searchChunk.llm_web_search.results];
              
              webSearchResults.push(...results);
              searchSource = searchChunk.llm_web_search.source || WebSearchSource.AISDK;
            }
          }

          // 处理普通 Web 搜索完成
          if (chunk.type === ChunkType.WEB_SEARCH_COMPLETE) {
            const searchChunk = chunk as any;
            if (searchChunk.web_search?.results) {
              webSearchResults.push(...searchChunk.web_search.results);
            }
          }

          // 处理 Gemini grounding metadata
          if ('providerMetadata' in chunk) {
            const metadata = (chunk as any).providerMetadata;
            if (metadata?.google?.groundingMetadata) {
              const groundingResults = extractGeminiGroundingResults(
                metadata.google.groundingMetadata
              );
              webSearchResults.push(...groundingResults);
              searchSource = WebSearchSource.GEMINI;
            }
          }

          // 处理 OpenAI citations
          if ('citations' in chunk) {
            const citations = (chunk as any).citations;
            if (Array.isArray(citations) && citations.length > 0) {
              const citationResults = citations.map((c: any) => ({
                url: c.url || '',
                title: c.title,
                snippet: c.text,
              }));
              webSearchResults.push(...citationResults);
              searchSource = WebSearchSource.OPENAI;
            }
          }

          // 转发原始 chunk
          await onChunk(chunk);
        }
      : undefined;

    // 执行下游中间件
    const result = await next(context, { ...params, onChunk: wrappedOnChunk });

    // 存储搜索结果
    if (webSearchResults.length > 0) {
      accumulated.webSearch = {
        results: webSearchResults,
        source: searchSource,
      };

      console.log(`[WebSearchMiddleware] Collected ${webSearchResults.length} results from ${searchSource}`);

      // 发送搜索完成事件
      if (onChunk) {
        await onChunk({
          type: ChunkType.LLM_WEB_SEARCH_COMPLETE,
          llm_web_search: {
            results: webSearchResults,
            source: searchSource,
          },
        } as any);
      }
    }

    return result;
  };

/**
 * 提取 Gemini grounding 结果
 */
function extractGeminiGroundingResults(groundingMetadata: any): WebSearchResult[] {
  const results: WebSearchResult[] = [];

  if (groundingMetadata?.groundingChunks) {
    for (const chunk of groundingMetadata.groundingChunks) {
      if (chunk.web) {
        results.push({
          url: chunk.web.uri || '',
          title: chunk.web.title,
        });
      }
    }
  }

  if (groundingMetadata?.webSearchQueries) {
    // 记录搜索查询（可选）
    console.log('[WebSearchMiddleware] Gemini queries:', groundingMetadata.webSearchQueries);
  }

  return results;
}
