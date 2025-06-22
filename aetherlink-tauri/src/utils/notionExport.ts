import type { ChatTopic } from '../shared/types';
import { dexieStorage } from '../shared/services/storage/DexieStorageService';
import dayjs from 'dayjs';
import { notionApiRequest, showSuccessMessage, showErrorMessage } from './notionApiUtils';

// Notion API 相关类型定义
interface NotionPageProperties {
  [key: string]: {
    title?: Array<{
      text: {
        content: string;
      };
    }>;
    rich_text?: Array<{
      text: {
        content: string;
      };
    }>;
    date?: {
      start: string;
    };
    number?: number;
  };
}

interface NotionCreatePageRequest {
  parent: {
    database_id: string;
  };
  properties: NotionPageProperties;
  children: Array<{
    object: 'block';
    type: string;
    [key: string]: any;
  }>;
}

interface NotionExportSettings {
  apiKey: string;
  databaseId: string;
  pageTitleField: string;
  dateField?: string;
}

// 定义内联格式匹配项的类型
interface InlineMatch {
  type: 'bold' | 'italic' | 'code' | 'link' | 'strikethrough';
  start: number;
  end: number;
  fullMatch: string;
  content: string;
  url?: string;
}

// 定义Notion富文本类型
interface NotionRichText {
  type: 'text';
  text: {
    content: string;
    link?: { url: string };
  };
  annotations?: {
    bold?: boolean;
    italic?: boolean;
    code?: boolean;
    strikethrough?: boolean;
  };
}

// 定义消息块类型（兼容项目中的MessageBlock类型）
interface NotionMessageBlock {
  id: string;
  type: 'main_text' | 'thinking' | 'unknown';
  content: string;
}

// 定义带块数据的消息类型
interface MessageWithBlocks {
  id: string;
  role: 'user' | 'assistant' | 'system';
  blocks?: string[];
  blockObjects?: NotionMessageBlock[];
}

/**
 * 解析内联Markdown格式并转换为Notion rich_text格式
 */
function parseInlineMarkdown(text: string): NotionRichText[] {
  const richTextElements: NotionRichText[] = [];
  let currentIndex = 0;
  
  // 正则表达式匹配各种内联格式
  const patterns = [
    { type: 'bold' as const, regex: /\*\*(.*?)\*\*/g },
    { type: 'italic' as const, regex: /\*(.*?)\*/g },
    { type: 'code' as const, regex: /`(.*?)`/g },
    { type: 'link' as const, regex: /\[([^\]]+)\]\(([^)]+)\)/g },
    { type: 'strikethrough' as const, regex: /~~(.*?)~~/g }
  ];
  
  // 找到所有匹配项并按位置排序
  const matches: InlineMatch[] = [];
  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.regex.exec(text)) !== null) {
      matches.push({
        type: pattern.type,
        start: match.index,
        end: match.index + match[0].length,
        fullMatch: match[0],
        content: match[1],
        url: match[2] // 仅用于链接
      });
    }
  });
  
  // 按起始位置排序
  matches.sort((a, b) => a.start - b.start);
  
  // 处理重叠的匹配项（优先处理较短的匹配）
  const validMatches: InlineMatch[] = [];
  for (const match of matches) {
    const hasOverlap = validMatches.some(validMatch => 
      (match.start < validMatch.end && match.end > validMatch.start)
    );
    if (!hasOverlap) {
      validMatches.push(match);
    }
  }
  
  validMatches.sort((a, b) => a.start - b.start);
  
  // 构建rich_text数组
  for (const match of validMatches) {
    // 添加匹配前的普通文本
    if (match.start > currentIndex) {
      const plainText = text.slice(currentIndex, match.start);
      if (plainText) {
        richTextElements.push({
          type: 'text',
          text: { content: plainText }
        });
      }
    }
    
    // 添加格式化文本
    const annotations: any = {};
    switch (match.type) {
      case 'bold':
        annotations.bold = true;
        richTextElements.push({
          type: 'text',
          text: { content: match.content },
          annotations
        });
        break;
      case 'italic':
        annotations.italic = true;
        richTextElements.push({
          type: 'text',
          text: { content: match.content },
          annotations
        });
        break;
      case 'code':
        annotations.code = true;
        richTextElements.push({
          type: 'text',
          text: { content: match.content },
          annotations
        });
        break;
      case 'strikethrough':
        annotations.strikethrough = true;
        richTextElements.push({
          type: 'text',
          text: { content: match.content },
          annotations
        });
        break;
      case 'link':
        if (match.url) {
          richTextElements.push({
            type: 'text',
            text: {
              content: match.content,
              link: { url: match.url }
            }
          });
        } else {
          // 如果没有URL，当作普通文本处理
          richTextElements.push({
            type: 'text',
            text: { content: match.content }
          });
        }
        break;
    }
    
    currentIndex = match.end;
  }
  
  // 添加剩余的普通文本
  if (currentIndex < text.length) {
    const remainingText = text.slice(currentIndex);
    if (remainingText) {
      richTextElements.push({
        type: 'text',
        text: { content: remainingText }
      });
    }
  }
  
  // 如果没有任何格式化，返回简单的文本块
  if (richTextElements.length === 0) {
    return [{
      type: 'text',
      text: { content: text }
    }];
  }
  
  return richTextElements;
}

/**
 * 将文本内容转换为Notion块格式（增强版，支持更多Markdown语法）
 */
function textToNotionBlocks(text: string): Array<any> {
  const blocks: Array<any> = [];
  const lines = text.split('\n');
  
  let currentParagraphLines: string[] = [];
  let inCodeBlock = false;
  let codeBlockContent = '';
  let codeBlockLanguage = '';
  let inQuoteBlock = false;
  let quoteBlockContent: string[] = [];
  let inListBlock = false;
  let listItems: string[] = [];
  let listType: 'bulleted' | 'numbered' = 'bulleted';

  const flushCurrentContent = () => {
    // 处理段落内容
    if (currentParagraphLines.length > 0) {
      const paragraphText = currentParagraphLines.join('\n').trim();
      if (paragraphText) {
        blocks.push({
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: parseInlineMarkdown(paragraphText)
          }
        });
      }
      currentParagraphLines = [];
    }
    
    // 处理引用块
    if (inQuoteBlock && quoteBlockContent.length > 0) {
      const quoteText = quoteBlockContent.join('\n').trim();
      if (quoteText) {
        blocks.push({
          object: 'block',
          type: 'quote',
          quote: {
            rich_text: parseInlineMarkdown(quoteText)
          }
        });
      }
      quoteBlockContent = [];
      inQuoteBlock = false;
    }
    
    // 处理列表
    if (inListBlock && listItems.length > 0) {
      listItems.forEach(item => {
        blocks.push({
          object: 'block',
          type: listType === 'numbered' ? 'numbered_list_item' : 'bulleted_list_item',
          [listType === 'numbered' ? 'numbered_list_item' : 'bulleted_list_item']: {
            rich_text: parseInlineMarkdown(item)
          }
        });
      });
      listItems = [];
      inListBlock = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // 检测代码块开始/结束
    if (trimmedLine.startsWith('```')) {
      flushCurrentContent();
      
      if (!inCodeBlock) {
        // 开始代码块
        inCodeBlock = true;
        codeBlockLanguage = trimmedLine.substring(3).trim() || 'text';
        codeBlockContent = '';
      } else {
        // 结束代码块
        inCodeBlock = false;
        blocks.push({
          object: 'block',
          type: 'code',
          code: {
            caption: [],
            rich_text: [{
              type: 'text',
              text: { content: codeBlockContent }
            }],
            language: codeBlockLanguage
          }
        });
        codeBlockContent = '';
        codeBlockLanguage = '';
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent += (codeBlockContent ? '\n' : '') + line;
      continue;
    }

    // 检测标题
    if (trimmedLine.startsWith('# ')) {
      flushCurrentContent();
      blocks.push({
        object: 'block',
        type: 'heading_1',
        heading_1: {
          rich_text: parseInlineMarkdown(trimmedLine.substring(2).trim())
        }
      });
      continue;
    }
    
    if (trimmedLine.startsWith('## ')) {
      flushCurrentContent();
      blocks.push({
        object: 'block',
        type: 'heading_2',
        heading_2: {
          rich_text: parseInlineMarkdown(trimmedLine.substring(3).trim())
        }
      });
      continue;
    }
    
    if (trimmedLine.startsWith('### ')) {
      flushCurrentContent();
      blocks.push({
        object: 'block',
        type: 'heading_3',
        heading_3: {
          rich_text: parseInlineMarkdown(trimmedLine.substring(4).trim())
        }
      });
      continue;
    }

    // 检测分隔线
    if (trimmedLine === '---' || trimmedLine === '***' || trimmedLine === '___') {
      flushCurrentContent();
      blocks.push({
        object: 'block',
        type: 'divider',
        divider: {}
      });
      continue;
    }

    // 检测引用块
    if (trimmedLine.startsWith('> ')) {
      flushCurrentContent();
      inQuoteBlock = true;
      quoteBlockContent.push(trimmedLine.substring(2));
      continue;
    }
    
    if (inQuoteBlock && trimmedLine.startsWith('>')) {
      quoteBlockContent.push(trimmedLine.substring(1).trim());
      continue;
    }
    
    if (inQuoteBlock && !trimmedLine.startsWith('>')) {
      flushCurrentContent();
    }

    // 检测列表项
    const bulletMatch = trimmedLine.match(/^[-*+]\s+(.+)$/);
    const numberedMatch = trimmedLine.match(/^\d+\.\s+(.+)$/);
    
    if (bulletMatch) {
      if (!inListBlock || listType !== 'bulleted') {
        flushCurrentContent();
        inListBlock = true;
        listType = 'bulleted';
      }
      listItems.push(bulletMatch[1]);
      continue;
    }
    
    if (numberedMatch) {
      if (!inListBlock || listType !== 'numbered') {
        flushCurrentContent();
        inListBlock = true;
        listType = 'numbered';
      }
      listItems.push(numberedMatch[1]);
      continue;
    }
    
    if (inListBlock && trimmedLine === '') {
      // 空行可能表示列表结束，但我们继续等待下一行来确定
      continue;
    }
    
    if (inListBlock && !bulletMatch && !numberedMatch && trimmedLine !== '') {
      flushCurrentContent();
    }

    // 空行处理
    if (trimmedLine === '') {
      if (currentParagraphLines.length > 0) {
        flushCurrentContent();
      }
      continue;
    }

    // 普通文本行
    currentParagraphLines.push(line);
  }

  // 处理文件末尾的内容
  flushCurrentContent();

  // 处理未闭合的代码块
  if (inCodeBlock && codeBlockContent) {
    blocks.push({
      object: 'block',
      type: 'code',
      code: {
        caption: [],
        rich_text: [{
          type: 'text',
          text: { content: codeBlockContent }
        }],
        language: codeBlockLanguage || 'text'
      }
    });
  }

  return blocks;
}

/**
 * 将话题转换为Markdown格式（简化版，用于Notion导出）
 */
async function topicToMarkdownForNotion(topic: ChatTopic, exportReasoning = false): Promise<string> {
  try {
    // 获取话题的所有消息
    const messages = await dexieStorage.getTopicMessages(topic.id);
    
    if (messages.length === 0) {
      return '*此话题暂无消息*';
    }

    // 批量获取所有消息的块数据，避免循环查询
    const messageIds = messages.filter(msg => msg.blocks && msg.blocks.length > 0).map(msg => msg.id);
    const allBlocks = messageIds.length > 0
      ? await Promise.all(messageIds.map(id => dexieStorage.getMessageBlocksByMessageId(id)))
      : [];

    // 创建块数据映射表，转换类型以兼容
    const blocksMap = new Map<string, NotionMessageBlock[]>();
    messageIds.forEach((id, index) => {
      const blocks = allBlocks[index] || [];
      // 转换块类型，过滤掉不支持的类型
      const notionBlocks: NotionMessageBlock[] = blocks
        .filter(block => block.type === 'main_text' || block.type === 'thinking')
        .map(block => ({
          id: block.id,
          type: block.type as 'main_text' | 'thinking',
          content: block.content
        }));
      blocksMap.set(id, notionBlocks);
    });

    // 组装消息数据，过滤掉system消息（Notion导出不需要）
    const messagesWithBlocks: MessageWithBlocks[] = messages
      .filter(message => message.role !== 'system')
      .map(message => ({
        ...message,
        blockObjects: blocksMap.get(message.id) || []
      }));

    // 创建消息内容
    const messageContents = messagesWithBlocks.map((message: MessageWithBlocks) => {
       const blocks = message.blockObjects || [];
      
      // 分类块
      const mainTextBlocks = blocks.filter((block: NotionMessageBlock) => block.type === 'main_text');
      const thinkingBlocks = blocks.filter((block: NotionMessageBlock) => block.type === 'thinking');
      
      // 角色标题
      const roleTitle = message.role === 'user' ? '## 用户' : '## 助手';
      
      let content = roleTitle + '\n\n';
      
      // 添加思考过程（如果需要）
      if (exportReasoning && thinkingBlocks.length > 0) {
        const thinkingContent = thinkingBlocks.map((block: NotionMessageBlock) => block.content).join('\n\n');
        if (thinkingContent.trim()) {
          content += '### 思考过程\n\n' + thinkingContent + '\n\n### 回答\n\n';
        }
      }

      // 添加主要内容
      const mainContent = mainTextBlocks.map((block: NotionMessageBlock) => block.content).join('\n\n');
      content += mainContent;
      
      return content;
    });

    return messageContents.join('\n\n---\n\n');
  } catch (error) {
    console.error('转换话题为Markdown失败:', error);
    throw error;
  }
}

/**
 * 导出话题到Notion数据库
 */
export async function exportTopicToNotion(
  topic: ChatTopic, 
  settings: NotionExportSettings,
  exportReasoning = false
): Promise<void> {
  try {
    if (!settings.apiKey || !settings.databaseId) {
      throw new Error('Notion API密钥和数据库ID不能为空');
    }

    // 获取话题内容
    const markdown = await topicToMarkdownForNotion(topic, exportReasoning);
    
    // 转换为Notion块格式
    const blocks = textToNotionBlocks(markdown);

    // 创建页面属性
    const properties: NotionPageProperties = {};
    properties[settings.pageTitleField] = {
      title: [{
        text: {
          content: topic.name || topic.title || '未命名对话'
        }
      }]
    };

    // 添加日期属性（如果配置了日期字段且有创建时间）
    if (settings.dateField && topic.createdAt) {
      properties[settings.dateField] = {
        date: {
          start: dayjs(topic.createdAt).format('YYYY-MM-DD')
        }
      };
    }

    // 创建Notion页面请求
    const createPageRequest: NotionCreatePageRequest = {
      parent: {
        database_id: settings.databaseId
      },
      properties,
      children: blocks
    };

    // 发送请求到Notion API
    const result = await notionApiRequest('/v1/pages', {
      method: 'POST',
      apiKey: settings.apiKey,
      body: createPageRequest
    });

    console.log('话题已成功导出到Notion:', result.url);

    // 显示成功消息
    showSuccessMessage(
      `话题 "${topic.name || topic.title || '未命名对话'}" 已成功导出到Notion数据库`,
      result.url
    );
    
  } catch (error) {
    console.error('导出到Notion失败:', error);
    showErrorMessage(error as Error);
    throw error;
  }
} 