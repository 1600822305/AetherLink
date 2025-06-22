/**
 * HTML解析器模块 - 解析各种搜索引擎的结果
 */

import { parse } from 'node-html-parser';
import { v4 as uuidv4 } from 'uuid';
import type { BingSearchResult } from './types';
import { cleanText, normalizeUrl } from './utils';

/**
 * 解析Bing搜索结果
 */
export function parseBingResults(html: string, maxResults: number): BingSearchResult[] {
  const results: BingSearchResult[] = [];

  try {
    console.log('[Parsers] 解析Bing搜索结果，HTML长度:', html.length);

    const root = parse(html, {
      lowerCaseTagName: false,
      comment: false,
      fixNestedATags: true,
      parseNoneClosedTags: true,
      blockTextElements: {
        script: false,
        noscript: false,
        style: false,
        pre: true
      }
    });

    const selectors = ['.b_algo', '.b_result', '.b_ans', '.b_web', '[data-priority]'];
    let resultElements: any[] = [];

    for (const selector of selectors) {
      resultElements = root.querySelectorAll(selector);
      if (resultElements.length > 0) {
        console.log(`[Parsers] 使用选择器 "${selector}" 找到 ${resultElements.length} 个结果`);
        break;
      }
    }

    resultElements.forEach((element: any, index: number) => {
      if (results.length >= maxResults) return;

      try {
        const titleSelectors = ['h2 a', 'h3 a', '.b_title a', 'a[href]'];
        let title = '';
        let url = '';
        let snippet = '';

        for (const selector of titleSelectors) {
          const titleElement = element.querySelector(selector);
          if (titleElement) {
            title = cleanText(titleElement.text || '');
            url = titleElement.getAttribute('href') || '';
            if (title && url) break;
          }
        }

        const contentSelectors = ['.b_caption p', '.b_snippet', '.b_descript', 'p', 'span'];
        for (const selector of contentSelectors) {
          const contentElement = element.querySelector(selector);
          if (contentElement) {
            const text = cleanText(contentElement.text || '');
            if (text && text.length > snippet.length) {
              snippet = text;
            }
          }
        }

        if (title && url) {
          results.push({
            id: uuidv4(),
            title,
            url: normalizeUrl(url),
            snippet: snippet || '无描述',
            timestamp: new Date().toISOString(),
            provider: 'bing-free',
            score: 1.0 - (index * 0.1)
          });
        }
      } catch (error) {
        console.warn(`[Parsers] 解析Bing结果失败:`, error);
      }
    });

  } catch (error) {
    console.error('[Parsers] Bing结果解析失败:', error);
  }

  return results;
}

/**
 * 解析Google搜索结果
 */
export function parseGoogleResults(html: string, maxResults: number): BingSearchResult[] {
  const results: BingSearchResult[] = [];

  try {
    console.log('[Parsers] 解析Google搜索结果，HTML长度:', html.length);

    const root = parse(html, {
      lowerCaseTagName: false,
      comment: false,
      fixNestedATags: true,
      parseNoneClosedTags: true
    });

    // 基于SearXNG的Google选择器
    const resultElements = root.querySelectorAll('div[jscontroller*="SC7lYd"]');
    console.log(`[Parsers] Google找到 ${resultElements.length} 个结果容器`);

    if (resultElements.length === 0) {
      // 备用选择器
      const fallbackElements = root.querySelectorAll('.g, .rc, .yuRUbf');
      console.log(`[Parsers] Google备用选择器找到 ${fallbackElements.length} 个结果`);

      fallbackElements.forEach((element: any, index: number) => {
        if (results.length >= maxResults) return;
        parseGoogleResultElement(element, results, index);
      });
    } else {
      resultElements.forEach((element: any, index: number) => {
        if (results.length >= maxResults) return;
        parseGoogleResultElement(element, results, index);
      });
    }

  } catch (error) {
    console.error('[Parsers] Google结果解析失败:', error);
  }

  return results;
}

/**
 * 解析单个Google搜索结果元素
 */
function parseGoogleResultElement(element: any, results: BingSearchResult[], index: number) {
  try {
    const titleElement = element.querySelector('a h3');
    if (!titleElement) {
      console.debug('[Parsers] Google结果缺少标题，跳过');
      return;
    }

    const title = cleanText(titleElement.text || '');

    const linkElement = element.querySelector('a[href]');
    if (!linkElement) {
      console.debug('[Parsers] Google结果缺少链接，跳过');
      return;
    }

    const url = linkElement.getAttribute('href') || '';
    if (!url || !url.startsWith('http')) {
      console.debug('[Parsers] Google结果链接无效，跳过');
      return;
    }

    const contentElements = element.querySelectorAll('div[data-sncf="1"], .VwiC3b, .s3v9rd, .st');
    let snippet = '';

    for (const contentElement of contentElements) {
      const scripts = contentElement.querySelectorAll('script');
      scripts.forEach((script: any) => script.remove());

      const text = cleanText(contentElement.text || '');
      if (text && text.length > snippet.length) {
        snippet = text;
      }
    }

    if (title && url) {
      results.push({
        id: uuidv4(),
        title,
        url: normalizeUrl(url),
        snippet: snippet || '无描述',
        timestamp: new Date().toISOString(),
        provider: 'bing-free',
        score: 1.0 - (index * 0.1)
      });
      console.log(`[Parsers] Google解析成功 ${results.length}: ${title.substring(0, 50)}`);
    }
  } catch (error) {
    console.warn(`[Parsers] 解析Google单个结果失败:`, error);
  }
}

/**
 * 解析百度搜索结果
 */
export function parseBaiduResults(html: string, maxResults: number): BingSearchResult[] {
  const results: BingSearchResult[] = [];

  try {
    console.log('[Parsers] 解析百度搜索结果，HTML长度:', html.length);

    const root = parse(html, {
      lowerCaseTagName: false,
      comment: false,
      fixNestedATags: true,
      parseNoneClosedTags: true
    });

    const resultElements = root.querySelectorAll('.result, .c-container, .result-op');
    console.log(`[Parsers] 百度找到 ${resultElements.length} 个结果容器`);

    if (resultElements.length === 0) {
      const fallbackElements = root.querySelectorAll('h3');
      console.log(`[Parsers] 百度备用选择器找到 ${fallbackElements.length} 个h3标签`);

      fallbackElements.forEach((element: any, index: number) => {
        if (results.length >= maxResults) return;
        parseBaiduResultElement(element, results, index);
      });
    } else {
      resultElements.forEach((element: any, index: number) => {
        if (results.length >= maxResults) return;
        parseBaiduResultElement(element, results, index);
      });
    }

  } catch (error) {
    console.error('[Parsers] 百度结果解析失败:', error);
  }

  return results;
}

/**
 * 解析单个百度搜索结果元素
 */
function parseBaiduResultElement(element: any, results: BingSearchResult[], index: number) {
  try {
    const titleElement = element.querySelector('h3 a, .t a, .c-title a, a[href]');
    if (!titleElement) {
      console.debug('[Parsers] 百度结果缺少标题，跳过');
      return;
    }

    const title = cleanText(titleElement.text || '');
    const url = titleElement.getAttribute('href') || '';

    if (!title || !url) {
      console.debug('[Parsers] 百度结果标题或链接无效，跳过');
      return;
    }

    let snippet = '';
    const contentSelectors = ['.c-abstract', '.c-span9', '.c-span-last', 'p', 'span'];

    for (const selector of contentSelectors) {
      const contentElement = element.querySelector(selector);
      if (contentElement) {
        const text = cleanText(contentElement.text || '');
        if (text && text.length > snippet.length && text !== title) {
          snippet = text;
          break;
        }
      }
    }

    if (title && url) {
      results.push({
        id: uuidv4(),
        title,
        url: normalizeUrl(url),
        snippet: snippet || '无描述',
        timestamp: new Date().toISOString(),
        provider: 'bing-free',
        score: 1.0 - (index * 0.1)
      });
      console.log(`[Parsers] 百度解析成功 ${results.length}: ${title.substring(0, 50)}`);
    }
  } catch (error) {
    console.warn(`[Parsers] 解析百度单个结果失败:`, error);
  }
}

/**
 * 解析搜狗搜索结果
 */
export function parseSogouResults(html: string, maxResults: number): BingSearchResult[] {
  const results: BingSearchResult[] = [];

  try {
    console.log('[Parsers] 解析搜狗搜索结果，HTML长度:', html.length);

    const root = parse(html, {
      lowerCaseTagName: false,
      comment: false,
      fixNestedATags: true,
      parseNoneClosedTags: true
    });

    const resultElements = root.querySelectorAll('div.vrwrap');
    console.log(`[Parsers] 搜狗找到 ${resultElements.length} 个结果容器`);

    if (resultElements.length === 0) {
      const fallbackElements = root.querySelectorAll('.results, .result, .rb');
      console.log(`[Parsers] 搜狗备用选择器找到 ${fallbackElements.length} 个结果`);

      fallbackElements.forEach((element: any, index: number) => {
        if (results.length >= maxResults) return;
        parseSogouResultElement(element, results, index);
      });
    } else {
      resultElements.forEach((element: any, index: number) => {
        if (results.length >= maxResults) return;
        parseSogouResultElement(element, results, index);
      });
    }

  } catch (error) {
    console.error('[Parsers] 搜狗结果解析失败:', error);
  }

  return results;
}

/**
 * 解析单个搜狗搜索结果元素
 */
function parseSogouResultElement(element: any, results: BingSearchResult[], index: number) {
  try {
    const titleElement = element.querySelector('h3.vr-title a, h3 a');
    if (!titleElement) {
      console.debug('[Parsers] 搜狗结果缺少标题，跳过');
      return;
    }

    const title = cleanText(titleElement.text || '');
    let url = titleElement.getAttribute('href') || '';

    // 处理搜狗的链接重定向
    if (url.startsWith('/link?url=')) {
      url = `https://www.sogou.com${url}`;
    }

    if (!title || !url) {
      console.debug('[Parsers] 搜狗结果标题或链接无效，跳过');
      return;
    }

    let snippet = '';
    const contentSelectors = [
      '.text-layout .star-wiki',
      '.fz-mid.space-txt',
      '.str_info',
      '.str_content',
      'p',
      'span'
    ];

    for (const selector of contentSelectors) {
      const contentElement = element.querySelector(selector);
      if (contentElement) {
        const text = cleanText(contentElement.text || '');
        if (text && text.length > snippet.length && text !== title) {
          snippet = text;
          break;
        }
      }
    }

    if (title && url) {
      results.push({
        id: uuidv4(),
        title,
        url: normalizeUrl(url),
        snippet: snippet || '无描述',
        timestamp: new Date().toISOString(),
        provider: 'bing-free',
        score: 1.0 - (index * 0.1)
      });
      console.log(`[Parsers] 搜狗解析成功 ${results.length}: ${title.substring(0, 50)}`);
    }
  } catch (error) {
    console.warn(`[Parsers] 解析搜狗单个结果失败:`, error);
  }
}

/**
 * 解析Yandex搜索结果
 */
export function parseYandexResults(html: string, maxResults: number): BingSearchResult[] {
  const results: BingSearchResult[] = [];

  try {
    console.log('[Parsers] 解析Yandex搜索结果，HTML长度:', html.length);

    const root = parse(html, {
      lowerCaseTagName: false,
      comment: false,
      fixNestedATags: true,
      parseNoneClosedTags: true
    });

    // 基于SearXNG的Yandex选择器
    const resultElements = root.querySelectorAll('li.serp-item');
    console.log(`[Parsers] Yandex找到 ${resultElements.length} 个结果容器`);

    if (resultElements.length === 0) {
      // 更广泛的备用选择器
      const fallbackSelectors = [
        '.serp-item',
        '.organic',
        '.result',
        '.search-result',
        '.serp-list__item',
        '.serp-adv__found',
        '[data-cid]'
      ];

      let fallbackElements: any[] = [];
      for (const selector of fallbackSelectors) {
        fallbackElements = root.querySelectorAll(selector);
        if (fallbackElements.length > 0) {
          console.log(`[Parsers] Yandex备用选择器 "${selector}" 找到 ${fallbackElements.length} 个结果`);
          break;
        }
      }

      if (fallbackElements.length === 0) {
        // 最后尝试：查找所有包含链接的元素
        const allLinks = root.querySelectorAll('a[href]');
        console.log(`[Parsers] Yandex找到 ${allLinks.length} 个链接`);

        // 过滤出可能是搜索结果的链接
        const possibleResults = allLinks.filter((link: any) => {
          const href = link.getAttribute('href') || '';
          const text = link.text?.trim() || '';
          return href &&
                 !href.includes('yandex.') &&
                 !href.startsWith('#') &&
                 !href.startsWith('javascript:') &&
                 text.length > 10;
        });

        console.log(`[Parsers] Yandex过滤后的可能结果: ${possibleResults.length} 个`);

        possibleResults.slice(0, maxResults).forEach((element: any, index: number) => {
          parseYandexResultElement(element, results, index);
        });
      } else {
        fallbackElements.forEach((element: any, index: number) => {
          if (results.length >= maxResults) return;
          parseYandexResultElement(element, results, index);
        });
      }
    } else {
      resultElements.forEach((element: any, index: number) => {
        if (results.length >= maxResults) return;
        parseYandexResultElement(element, results, index);
      });
    }

  } catch (error) {
    console.error('[Parsers] Yandex结果解析失败:', error);
  }

  return results;
}

/**
 * 解析单个Yandex搜索结果元素
 */
function parseYandexResultElement(element: any, results: BingSearchResult[], index: number) {
  try {
    let title = '';
    let url = '';
    let snippet = '';

    // 如果元素本身就是链接
    if (element.tagName === 'A') {
      title = cleanText(element.text || '');
      url = element.getAttribute('href') || '';

      // 尝试从父元素或兄弟元素获取描述
      const parent = element.parentNode;
      if (parent) {
        const siblingElements = parent.querySelectorAll('p, span, div');
        for (const sibling of siblingElements) {
          const text = cleanText(sibling.text || '');
          if (text && text !== title && text.length > snippet.length) {
            snippet = text;
          }
        }
      }
    } else {
      // 更广泛的标题选择器
      const titleSelectors = [
        'a.b-serp-item__title-link',
        'h3 a',
        'h2 a',
        '.title a',
        '.organic__title a',
        'a[href]'
      ];

      for (const selector of titleSelectors) {
        const titleElement = element.querySelector(selector);
        if (titleElement) {
          title = cleanText(titleElement.text || '');
          url = titleElement.getAttribute('href') || '';
          if (title && url) break;
        }
      }

      // 更广泛的内容选择器
      const contentSelectors = [
        '.b-serp-item__content .b-serp-item__text',
        '.organic__text',
        '.snippet',
        '.content',
        '.text-container',
        '.serp-item__text',
        'p',
        'span'
      ];

      for (const selector of contentSelectors) {
        const contentElement = element.querySelector(selector);
        if (contentElement) {
          const text = cleanText(contentElement.text || '');
          if (text && text !== title && text.length > snippet.length) {
            snippet = text;
          }
        }
      }
    }

    // 验证URL有效性
    if (!title || !url || url.startsWith('#') || url.startsWith('javascript:')) {
      console.debug('[Parsers] Yandex结果标题或链接无效，跳过');
      return;
    }

    // 过滤掉Yandex内部链接
    if (url.includes('yandex.') && !url.startsWith('http')) {
      console.debug('[Parsers] Yandex内部链接，跳过');
      return;
    }

    results.push({
      id: uuidv4(),
      title,
      url: normalizeUrl(url),
      snippet: snippet || '无描述',
      timestamp: new Date().toISOString(),
      provider: 'bing-free',
      score: 1.0 - (index * 0.1)
    });
    console.log(`[Parsers] Yandex解析成功 ${results.length}: ${title.substring(0, 50)}`);
  } catch (error) {
    console.warn(`[Parsers] 解析Yandex单个结果失败:`, error);
  }
}
