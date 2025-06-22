/**
 * 搜索服务工具函数
 */

import { CorsBypass } from 'capacitor-cors-bypass-enhanced';
import { Capacitor } from '@capacitor/core';

/**
 * 清理文本内容
 */
export function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ') // 合并多个空白字符
    .replace(/[\r\n\t]/g, ' ') // 替换换行和制表符
    .trim();
}

/**
 * 标准化URL
 */
export function normalizeUrl(url: string, baseUrl: string = 'https://cn.bing.com'): string {
  try {
    // 添加安全检查
    if (!url || typeof url !== 'string') {
      return url || '';
    }

    // 如果是相对URL，转换为绝对URL
    if (url.startsWith('/')) {
      return `${baseUrl}${url}`;
    }

    // 如果是Bing重定向URL，提取真实URL
    if (url.includes('bing.com/ck/a?')) {
      const urlParts = url.split('?');
      const queryString = urlParts.length > 1 ? urlParts[1] : '';
      if (queryString) {
        const urlParams = new URLSearchParams(queryString);
        const realUrl = urlParams.get('u');
        if (realUrl) {
          return decodeURIComponent(realUrl);
        }
      }
    }

    return url;
  } catch (error) {
    console.warn('[SearchUtils] URL标准化失败:', error);
    return url;
  }
}

/**
 * 获取搜索页面
 */
export async function fetchSearchPage(url: string, timeout: number): Promise<any> {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'DNT': '1',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1'
  };

  if (Capacitor.isNativePlatform()) {
    // 移动端使用 CorsBypass 插件
    console.log('[SearchUtils] 使用 CorsBypass 插件请求');

    const response = await CorsBypass.request({
      url,
      method: 'GET',
      headers,
      timeout,
      responseType: 'text'
    });

    console.log('[SearchUtils] 插件响应:', {
      status: response.status,
      dataLength: response.data?.length || 0,
      headers: Object.keys(response.headers || {})
    });

    return response;
  } else {
    // Web端使用标准fetch（可能需要代理）
    console.log('[SearchUtils] 使用标准 fetch 请求');

    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(timeout)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.text();
    return {
      data,
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries())
    };
  }
}

/**
 * 判断是否应该跳过某些URL
 */
export function shouldSkipUrl(url: string): boolean {
  const skipPatterns = [
    /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar|7z)$/i,
    /\.(jpg|jpeg|png|gif|bmp|svg|webp)$/i,
    /\.(mp3|mp4|avi|mov|wmv|flv)$/i,
    /^mailto:/,
    /^tel:/,
    /^javascript:/,
    /#$/
  ];

  return skipPatterns.some(pattern => pattern.test(url));
}

/**
 * 从HTML中提取纯文本内容
 */
export function extractTextContent(html: string, maxLength: number): string {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // 移除脚本和样式标签
    const scripts = doc.querySelectorAll('script, style, nav, header, footer, aside');
    scripts.forEach(el => el.remove());

    // 优先提取主要内容区域
    const contentSelectors = [
      'main',
      'article',
      '.content',
      '.main-content',
      '.post-content',
      '.entry-content',
      '#content',
      '.container'
    ];

    let textContent = '';
    for (const selector of contentSelectors) {
      const element = doc.querySelector(selector);
      if (element) {
        textContent = element.textContent || '';
        break;
      }
    }

    // 如果没找到主要内容区域，使用body
    if (!textContent) {
      textContent = doc.body?.textContent || '';
    }

    // 清理文本
    textContent = textContent
      .replace(/\s+/g, ' ') // 合并空白字符
      .replace(/\n\s*\n/g, '\n') // 合并多个换行
      .trim();

    // 限制长度
    if (textContent.length > maxLength) {
      textContent = textContent.substring(0, maxLength) + '...';
    }

    return textContent || '无法提取内容';
  } catch (error) {
    console.warn('[SearchUtils] 文本提取失败:', error);
    return '内容解析失败';
  }
}
