import TurndownService from 'turndown';
import { gfm } from '@truto/turndown-plugin-gfm';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import rehypeRaw from 'rehype-raw';
import { createLogger } from '../../../shared/services/infra/logger';

const logger = createLogger('markdown');

// 创建 unified 处理器用于 Markdown → HTML
const markdownProcessor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  .use(rehypeStringify);

// 创建 Turndown 实例用于 HTML 转 Markdown
const turndownService = new TurndownService({
  headingStyle: 'atx',
  hr: '---',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  emDelimiter: '*',
  strongDelimiter: '**'
});

// 添加 GFM 支持（GitHub Flavored Markdown）
turndownService.use(gfm);

// 自定义规则：保留下划线标记
turndownService.addRule('underline', {
  filter: ['u'],
  replacement: (content) => `<u>${content}</u>`
});

// 自定义规则：处理图片
turndownService.addRule('image', {
  filter: 'img',
  replacement: (_content, node: any) => {
    const alt = node.getAttribute('alt') || '';
    const src = node.getAttribute('src') || '';
    const title = node.getAttribute('title');
    const titlePart = title ? ` "${title}"` : '';
    return `![${alt}](${src}${titlePart})`;
  }
});

/**
 * 将 HTML 转换为 Markdown
 */
export function htmlToMarkdown(html: string): string {
  if (!html || html.trim() === '') {
    return '';
  }

  try {
    return turndownService.turndown(html);
  } catch (error) {
    logger.error('Error converting HTML to Markdown:', error);
    // 降级方案：移除 HTML 标签
    const temp = document.createElement('div');
    temp.innerHTML = html;
    return temp.textContent || '';
  }
}

/**
 * 将 Markdown 转换为 HTML
 */
export function markdownToHtml(markdown: string): string {
  if (!markdown || markdown.trim() === '') {
    return '';
  }

  try {
    const result = markdownProcessor.processSync(markdown);
    return String(result);
  } catch (error) {
    logger.error('Error converting Markdown to HTML:', error);
    return markdown;
  }
}

/**
 * 清理 Markdown 内容
 */
export function cleanMarkdown(markdown: string): string {
  return markdown.trim();
}

/**
 * 计算纯文本字符数
 */
export function countCharacters(content: string): number {
  const plainText = content.replace(/<[^>]*>/g, '').replace(/[#*_~`[\]()]/g, '');
  return plainText.length;
}

/**
 * 将 Markdown 转换为预览文本
 */
export function markdownToPreviewText(markdown: string, maxLength: number = 100): string {
  const html = markdownToHtml(markdown);
  const temp = document.createElement('div');
  temp.innerHTML = html;
  const text = temp.textContent || '';
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}
