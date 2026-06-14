/**
 * Shiki 代码高亮服务
 * 参考 Cherry Studio 实现
 * 
 * - 支持流式代码高亮。
 * - 使用主线程处理高亮请求（简化版，不使用 Worker）。
 */
import { LRUCache } from 'lru-cache';
import type { HighlighterGeneric, ThemedToken } from 'shiki/core';
import {
  DEFAULT_LANGUAGES,
  DEFAULT_THEMES,
  getHighlighter,
  loadLanguageIfNeeded,
  loadThemeIfNeeded
} from '../../utils/shiki';
import type { ShikiStreamTokenizerOptions } from './ShikiStreamTokenizer';
import { ShikiStreamTokenizer } from './ShikiStreamTokenizer';
import { createLogger } from '../infra/logger';
const logger = createLogger('ShikiStream');

const SERVICE_CONFIG = {
  // LRU 缓存配置
  TOKENIZER_CACHE: {
    MAX_SIZE: 100, // 最大缓存数量
    TTL: 1000 * 60 * 30 // 30 分钟过期时间（毫秒）
  }
};

export type ShikiPreProperties = {
  class: string;
  style: string;
  tabindex: number;
};

/**
 * 代码 chunk 高亮结果
 *
 * @param lines 所有高亮行（包括稳定和不稳定）
 * @param recall 需要撤回的行数，-1 表示撤回所有行
 */
export interface HighlightChunkResult {
  lines: ThemedToken[][];
  recall: number;
}

/**
 * Shiki 代码高亮服务
 */
class ShikiStreamService {
  // 主线程 highlighter 和 tokenizers
  private highlighter: HighlighterGeneric<any, any> | null = null;

  // 保存以 callerId-language-theme 为键的 tokenizer map
  private tokenizerCache = new LRUCache<string, ShikiStreamTokenizer>({
    max: SERVICE_CONFIG.TOKENIZER_CACHE.MAX_SIZE,
    ttl: SERVICE_CONFIG.TOKENIZER_CACHE.TTL,
    updateAgeOnGet: true,
    dispose: (value) => {
      if (value) value.clear();
    }
  });

  // 缓存每个 callerId 对应的已处理内容
  private codeCache = new LRUCache<string, string>({
    max: SERVICE_CONFIG.TOKENIZER_CACHE.MAX_SIZE,
    ttl: SERVICE_CONFIG.TOKENIZER_CACHE.TTL,
    updateAgeOnGet: true
  });

  constructor() {
    // 延迟初始化
  }

  /**
   * 判断是否已初始化 highlighter
   */
  public hasHighlighter(): boolean {
    return !!this.highlighter;
  }

  /**
   * 确保 highlighter 已配置
   * @param language 语言
   * @param theme 主题
   */
  private async ensureHighlighterConfigured(
    language: string,
    theme: string
  ): Promise<{ loadedLanguage: string; loadedTheme: string }> {
    if (!this.highlighter) {
      this.highlighter = await getHighlighter(DEFAULT_LANGUAGES, DEFAULT_THEMES);
    }

    const loadedLanguage = await loadLanguageIfNeeded(this.highlighter, language);
    const loadedTheme = await loadThemeIfNeeded(this.highlighter, theme);

    return { loadedLanguage, loadedTheme };
  }

  /**
   * 获取 Shiki 的 pre 标签属性
   *
   * 跑一个简单的 hast 结果，从中提取 properties 属性。
   * @param language 语言
   * @param theme 主题
   * @returns pre 标签属性
   */
  async getShikiPreProperties(language: string, theme: string): Promise<ShikiPreProperties> {
    const { loadedLanguage, loadedTheme } = await this.ensureHighlighterConfigured(language, theme);

    if (!this.highlighter) {
      throw new Error('Highlighter not initialized');
    }

    const hast = this.highlighter.codeToHast('1', {
      lang: loadedLanguage,
      theme: loadedTheme
    });

    // @ts-ignore hack
    return hast.children[0].properties as ShikiPreProperties;
  }

  /**
   * 高亮流式输出的代码，调用方传入完整代码内容，得到增量高亮结果。
   *
   * - 检测当前内容与上次处理内容的差异。
   * - 如果是末尾追加，只传输增量部分（此时性能最好）。
   * - 如果不是追加，重置 tokenizer 并处理完整内容。
   *
   * 调用者需要自行处理撤回。
   * @param code 完整代码内容
   * @param language 语言
   * @param theme 主题
   * @param callerId 调用者ID
   * @returns 高亮结果，recall 为 -1 表示撤回所有行
   */
  async highlightStreamingCode(
    code: string,
    language: string,
    theme: string,
    callerId: string
  ): Promise<HighlightChunkResult> {
    const cacheKey = `${callerId}-${language}-${theme}`;
    const lastContent = this.codeCache.get(cacheKey) || '';

    let isAppend = false;

    if (code.length === lastContent.length) {
      // 内容没有变化，返回空结果
      if (code === lastContent) {
        return { lines: [], recall: 0 };
      }
    } else if (code.length > lastContent.length) {
      // 长度增加，可能是追加
      isAppend = code.startsWith(lastContent);
    }

    try {
      let result: HighlightChunkResult;

      if (isAppend) {
        // 流式追加，只传输增量
        const chunk = code.slice(lastContent.length);
        result = await this.highlightCodeChunk(chunk, language, theme, callerId);
      } else {
        // 非追加变化，重置并处理完整内容
        this.cleanupTokenizers(callerId);
        this.codeCache.delete(cacheKey); // 清除缓存

        result = await this.highlightCodeChunk(code, language, theme, callerId);

        // 撤回所有行
        result = {
          ...result,
          recall: -1
        };
      }

      // 成功处理后更新缓存
      this.codeCache.set(cacheKey, code);
      return result;
    } catch (error) {
      // 处理失败时不更新缓存，保持之前的状态
      logger.error('Failed to highlight streaming code:', error);
      throw error;
    }
  }

  /**
   * 高亮代码 chunk，返回本次高亮的所有 ThemedToken 行
   *
   * @param chunk 代码内容
   * @param language 语言
   * @param theme 主题
   * @param callerId 调用者ID，用于标识不同的组件实例
   * @returns ThemedToken 行
   */
  async highlightCodeChunk(
    chunk: string,
    language: string,
    theme: string,
    callerId: string
  ): Promise<HighlightChunkResult> {
    try {
      const tokenizer = await this.getStreamTokenizer(callerId, language, theme);

      const result = await tokenizer.enqueue(chunk);

      // 合并稳定和不稳定的行作为本次高亮的所有行
      return {
        lines: [...result.stable, ...result.unstable],
        recall: result.recall
      };
    } catch (error) {
      logger.error('Failed to highlight code chunk:', error);

      // 提供简单的 fallback
      const fallbackToken: ThemedToken = { content: chunk || '', color: '#000000', offset: 0 };
      return {
        lines: [[fallbackToken]],
        recall: 0
      };
    }
  }

  /**
   * 获取或创建 tokenizer
   * @param callerId 调用者ID
   * @param language 语言
   * @param theme 主题
   * @returns tokenizer 实例
   */
  private async getStreamTokenizer(callerId: string, language: string, theme: string): Promise<ShikiStreamTokenizer> {
    // 创建复合键
    const cacheKey = `${callerId}-${language}-${theme}`;

    // 如果已存在，直接返回
    if (this.tokenizerCache.has(cacheKey)) {
      return this.tokenizerCache.get(cacheKey)!;
    }

    // 确保 highlighter 已配置
    const { loadedLanguage, loadedTheme } = await this.ensureHighlighterConfigured(language, theme);

    if (!this.highlighter) {
      throw new Error('Highlighter not initialized');
    }

    // 创建新的 tokenizer
    const options: ShikiStreamTokenizerOptions = {
      highlighter: this.highlighter,
      lang: loadedLanguage,
      theme: loadedTheme
    };

    const tokenizer = new ShikiStreamTokenizer(options);
    this.tokenizerCache.set(cacheKey, tokenizer);

    return tokenizer;
  }

  /**
   * 清理特定调用者的 tokenizers
   * @param callerId 调用者ID
   */
  cleanupTokenizers(callerId: string): void {
    // 清理对应的内容缓存
    for (const key of this.codeCache.keys()) {
      if (key.startsWith(`${callerId}-`)) {
        this.codeCache.delete(key);
      }
    }

    // 清理主线程中的 tokenizers，移除所有以 callerId 开头的缓存项
    for (const key of this.tokenizerCache.keys()) {
      if (key.startsWith(`${callerId}-`)) {
        this.tokenizerCache.delete(key);
      }
    }
  }

  /**
   * 销毁所有资源
   */
  dispose() {
    this.tokenizerCache.clear();
    this.codeCache.clear();
    this.highlighter = null;
  }
}

export const shikiStreamService = new ShikiStreamService();
