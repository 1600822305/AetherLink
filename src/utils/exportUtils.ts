import type { Message } from '../shared/types/newMessage';
import { getMainTextContent, findThinkingBlocks, findCitationBlocks, findToolBlocks } from '../shared/utils/messageUtils';
import type { ToolMessageBlock } from '../shared/types/newMessage';
import { processLatexBrackets, removeSpecialCharactersForFileName } from './formats';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Clipboard } from '@capacitor/clipboard';
import { isTauri } from '../shared/utils/platformDetection';
import { createLogger } from '../shared/services/infra/logger';

import dayjs from 'dayjs';
import html2canvas from 'html2canvas';
import { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Packer, ShadingType, BorderStyle } from 'docx';
import { saveAs } from 'file-saver';
import { toastManager } from '../components/EnhancedToast';

// 添加话题导出相关的导入
import type { ChatTopic } from '../shared/types';
import { dexieStorage } from '../shared/services/storage/DexieStorageService';

const logger = createLogger('ExportUtils');

/**
 * 获取消息标题
 */
export async function getMessageTitle(message: Message): Promise<string> {
  const content = getMainTextContent(message);
  if (!content) return 'Untitled';

  // 取前50个字符作为标题
  const title = content.substring(0, 50).replace(/\n/g, ' ').trim();
  return title || 'Untitled';
}

/**
 * 格式化工具块为Markdown（简化版，仅显示工具名称）
 */
function formatToolBlockToMarkdown(block: ToolMessageBlock): string {
  const toolName = block.toolName || block.metadata?.rawMcpToolResponse?.tool?.name || '未知工具';
  return `🔧 \`${toolName}\``;
}

/**
 * 创建基础Markdown内容
 */
function createBaseMarkdown(message: Message, includeReasoning = false, forceDollarMathInMarkdown = true) {
  const content = getMainTextContent(message);
  const thinkingBlocks = findThinkingBlocks(message);
  const citationBlocks = findCitationBlocks(message);
  const toolBlocks = findToolBlocks(message);

  // 标题部分
  const titleSection = message.role === 'user' ? '## 用户' : '## 助手';

  // 推理部分
  let reasoningSection = '';
  if (includeReasoning && thinkingBlocks.length > 0) {
    const thinkingContent = thinkingBlocks.map(block => block.content).join('\n\n');
    if (thinkingContent.trim()) {
      reasoningSection = `### 思考过程\n\n${thinkingContent}\n\n### 回答\n\n`;
    }
  }

  // 内容部分
  const contentSection = forceDollarMathInMarkdown ? processLatexBrackets(content) : content;

  // 工具调用部分
  let toolSection = '';
  if (toolBlocks.length > 0) {
    const toolContent = toolBlocks.map(block => formatToolBlockToMarkdown(block)).join('\n\n');
    if (toolContent.trim()) {
      toolSection = `### 工具调用\n\n${toolContent}`;
    }
  }

  // 引用部分
  let citation = '';
  if (citationBlocks.length > 0) {
    const citationContent = citationBlocks.map(block => block.content).join('\n\n');
    if (citationContent.trim()) {
      citation = `### 引用\n\n${citationContent}`;
    }
  }

  return { titleSection, reasoningSection, contentSection, toolSection, citation };
}

/**
 * 将消息转换为Markdown格式
 */
export function messageToMarkdown(message: Message): string {
  const { titleSection, contentSection, toolSection, citation } = createBaseMarkdown(message);
  return [titleSection, '', contentSection, toolSection, citation].filter(Boolean).join('\n\n');
}

/**
 * 将消息转换为包含推理的Markdown格式
 */
export function messageToMarkdownWithReasoning(message: Message): string {
  const { titleSection, reasoningSection, contentSection, toolSection, citation } = createBaseMarkdown(message, true);
  return [titleSection, '', reasoningSection + contentSection, toolSection, citation].filter(Boolean).join('\n\n');
}

/**
 * 将多个消息转换为Markdown格式
 */
export function messagesToMarkdown(messages: Message[], exportReasoning = false): string {
  return messages
    .map(message => exportReasoning ? messageToMarkdownWithReasoning(message) : messageToMarkdown(message))
    .join('\n\n---\n\n');
}

/**
 * 导出消息为Markdown文件
 */
export async function exportMessageAsMarkdown(message: Message, exportReasoning = false): Promise<void> {
  try {
    const title = await getMessageTitle(message);
    const timestamp = dayjs().format('YYYY-MM-DD-HH-mm-ss');
    const fileName = `${removeSpecialCharactersForFileName(title)}_${timestamp}.md`;
    const markdown = exportReasoning ? messageToMarkdownWithReasoning(message) : messageToMarkdown(message);

    if (Capacitor.isNativePlatform()) {
      // 移动端：直接使用分享API，让用户选择保存位置
      try {
        // 创建临时文件
        const tempFileName = `temp_${Date.now()}.md`;
        await Filesystem.writeFile({
          path: tempFileName,
          data: markdown,
          directory: Directory.Cache,
          encoding: Encoding.UTF8
        });

        // 获取文件URI
        const fileUri = await Filesystem.getUri({
          path: tempFileName,
          directory: Directory.Cache
        });

        // 使用分享API
        await Share.share({
          title: '导出Markdown文件',
          text: markdown,
          url: fileUri.uri,
          dialogTitle: '保存Markdown文件'
        });

        // 清理临时文件
        try {
          await Filesystem.deleteFile({
            path: tempFileName,
            directory: Directory.Cache
          });
        } catch (deleteError) {
          logger.warn('清理临时文件失败:', deleteError);
        }

      } catch (shareError) {
        logger.warn('分享失败，尝试复制到剪贴板:', shareError);
        // 回退到复制到剪贴板
        await Clipboard.write({ string: markdown });
        toastManager.warning('分享失败，内容已复制到剪贴板', '导出提醒');
      }
    } else if (isTauri()) {
      // Tauri 桌面端：使用保存对话框
      try {
        const dialog = await import('@tauri-apps/plugin-dialog');
        const fs = await import('@tauri-apps/plugin-fs');
        
        const filePath = await dialog.save({
          title: '保存Markdown文件',
          defaultPath: fileName,
          filters: [{ name: 'Markdown', extensions: ['md'] }]
        });
        
        if (filePath) {
          await fs.writeTextFile(filePath, markdown);
          toastManager.success('文件已保存', '导出成功');
        }
      } catch (tauriError) {
        logger.error('Tauri保存失败:', tauriError);
        // 回退到复制到剪贴板
        await Clipboard.write({ string: markdown });
        toastManager.warning('保存失败，内容已复制到剪贴板', '导出提醒');
      }
    } else {
      // Web端：使用下载链接
      const blob = new Blob([markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  } catch (error) {
    logger.error('导出Markdown失败:', error);
    toastManager.error('导出失败: ' + (error as Error).message, '导出错误');
  }
}

/**
 * 复制消息为Markdown格式到剪贴板
 */
export async function copyMessageAsMarkdown(message: Message, exportReasoning = false): Promise<void> {
  try {
    const markdown = exportReasoning ? messageToMarkdownWithReasoning(message) : messageToMarkdown(message);

    // 优先使用Capacitor Clipboard插件（移动端）
    try {
      await Clipboard.write({
        string: markdown
      });
    } catch (capacitorError) {
      // 如果Capacitor失败，回退到Web API
      await navigator.clipboard.writeText(markdown);
    }

    // 复制成功，可以考虑使用更优雅的提示方式
    toastManager.success('Markdown内容已复制到剪贴板', '复制成功');
  } catch (error) {
    logger.error('复制Markdown失败:', error);
    toastManager.error('复制失败', '复制错误');
  }
}

/**
 * 导出到Obsidian（通过URL Scheme）
 */
export async function exportToObsidian(message: Message, options: {
  vault?: string;
  folder?: string;
  processingMethod?: '1' | '2' | '3'; // 1: append, 2: prepend, 3: overwrite
  includeReasoning?: boolean;
} = {}): Promise<void> {
  try {
    const title = await getMessageTitle(message);
    const markdown = options.includeReasoning ?
      messageToMarkdownWithReasoning(message) :
      messageToMarkdown(message);

    // 复制内容到剪贴板
    await Clipboard.write({ string: markdown });

    // 构建Obsidian URL
    const fileName = removeSpecialCharactersForFileName(title) + '.md';
    const filePath = options.folder ? `${options.folder}/${fileName}` : fileName;

    let obsidianUrl = `obsidian://new?file=${encodeURIComponent(filePath)}&clipboard=true`;

    if (options.vault) {
      obsidianUrl += `&vault=${encodeURIComponent(options.vault)}`;
    }

    if (options.processingMethod === '3') {
      obsidianUrl += '&overwrite=true';
    } else if (options.processingMethod === '2') {
      obsidianUrl += '&prepend=true';
    } else if (options.processingMethod === '1') {
      obsidianUrl += '&append=true';
    }

    // 打开Obsidian
    window.open(obsidianUrl, '_system');
    // 简化提示，避免过多弹窗
    toastManager.info('正在打开Obsidian...', '导出提醒');
  } catch (error) {
    logger.error('导出到Obsidian失败:', error);
    toastManager.error('导出到Obsidian失败', '导出错误');
  }
}

/**
 * 分享消息内容
 */
export async function shareMessage(message: Message, format: 'text' | 'markdown' = 'text'): Promise<void> {
  try {
    let content: string;
    let title: string;

    if (format === 'markdown') {
      content = messageToMarkdown(message);
      title = '分享Markdown内容';
    } else {
      content = getMainTextContent(message);
      title = '分享消息内容';
    }

    if (Capacitor.isNativePlatform()) {
      await Share.share({
        title,
        text: content,
        dialogTitle: title
      });
    } else {
      // Web端回退到复制到剪贴板
      await navigator.clipboard.writeText(content);
      toastManager.success('内容已复制到剪贴板', '分享成功');
    }
  } catch (error) {
    logger.error('分享失败:', error);
    toastManager.error('分享失败', '分享错误');
  }
}

/**
 * 通过分享方式保存消息内容为文件
 */
export async function shareContentAsFile(message: Message): Promise<void> {
  try {
    const textContent = getMainTextContent(message);
    const title = await getMessageTitle(message);
    const timestamp = dayjs().format('YYYY-MM-DD-HH-mm-ss');
    const fileName = `${removeSpecialCharactersForFileName(title)}_${timestamp}.txt`;

    if (Capacitor.isNativePlatform()) {
      // 移动端：创建临时文件并通过分享API让用户选择保存位置
      try {
        // 创建临时文件
        const tempFileName = `temp_${Date.now()}.txt`;
        await Filesystem.writeFile({
          path: tempFileName,
          data: textContent,
          directory: Directory.Cache,
          encoding: Encoding.UTF8
        });

        // 获取文件URI
        const fileUri = await Filesystem.getUri({
          path: tempFileName,
          directory: Directory.Cache
        });

        // 使用分享API
        await Share.share({
          title: '保存消息内容',
          text: textContent,
          url: fileUri.uri,
          dialogTitle: '保存文本文件'
        });

        // 清理临时文件
        try {
          await Filesystem.deleteFile({
            path: tempFileName,
            directory: Directory.Cache
          });
        } catch (deleteError) {
          logger.warn('清理临时文件失败:', deleteError);
        }

      } catch (shareError) {
        logger.warn('分享失败，尝试复制到剪贴板:', shareError);
        // 回退到复制到剪贴板
        await Clipboard.write({ string: textContent });
        toastManager.warning('分享失败，内容已复制到剪贴板', '保存提醒');
      }
    } else if (isTauri()) {
      // Tauri 桌面端：使用保存对话框
      try {
        const dialog = await import('@tauri-apps/plugin-dialog');
        const fs = await import('@tauri-apps/plugin-fs');
        
        const filePath = await dialog.save({
          title: '保存文本文件',
          defaultPath: fileName,
          filters: [{ name: '文本文件', extensions: ['txt'] }]
        });
        
        if (filePath) {
          await fs.writeTextFile(filePath, textContent);
          toastManager.success('文件已保存', '保存成功');
        }
      } catch (tauriError) {
        logger.error('Tauri保存失败:', tauriError);
        // 回退到复制到剪贴板
        await Clipboard.write({ string: textContent });
        toastManager.warning('保存失败，内容已复制到剪贴板', '保存提醒');
      }
    } else {
      // Web端：使用下载链接
      const blob = new Blob([textContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  } catch (error) {
    logger.error('保存文件失败:', error);
    toastManager.error('保存失败: ' + (error as Error).message, '保存错误');
  }
}

/**
 * 截图消息并复制到剪贴板
 */
export async function captureMessageAsImage(messageElement: HTMLElement): Promise<void> {
  try {
    const canvas = await html2canvas(messageElement, {
      backgroundColor: null,
      scale: 2, // 提高清晰度
      useCORS: true,
      allowTaint: true
    });

    if (Capacitor.isNativePlatform()) {
      // 移动端：转换为base64并复制
      const dataUrl = canvas.toDataURL('image/png');
      const base64Data = dataUrl.split(',')[1];

      try {
        // 在移动端，我们将图片保存为临时文件然后分享
        const tempFileName = `temp_image_${Date.now()}.png`;
        await Filesystem.writeFile({
          path: tempFileName,
          data: base64Data,
          directory: Directory.Cache
        });

        const fileUri = await Filesystem.getUri({
          path: tempFileName,
          directory: Directory.Cache
        });

        await Share.share({
          title: '复制图片',
          url: fileUri.uri,
          dialogTitle: '复制图片'
        });

        // 清理临时文件
        try {
          await Filesystem.deleteFile({
            path: tempFileName,
            directory: Directory.Cache
          });
        } catch (deleteError) {
          logger.warn('清理临时文件失败:', deleteError);
        }

      } catch (shareError) {
        logger.warn('分享失败:', shareError);
        toastManager.error('复制图片失败', '操作失败');
      }
    } else if (isTauri()) {
      // Tauri 桌面端：复制到剪贴板
      canvas.toBlob(async (blob) => {
        if (!blob) {
          toastManager.error('截图失败', '操作失败');
          return;
        }
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
          toastManager.success('图片已复制到剪贴板', '复制成功');
        } catch (clipboardError) {
          logger.warn('复制到剪贴板失败:', clipboardError);
          toastManager.error('复制图片失败', '操作失败');
        }
      }, 'image/png');
    } else {
      // Web端：转换为blob并复制到剪贴板
      canvas.toBlob(async (blob) => {
        if (!blob) {
          throw new Error('截图失败');
        }

        try {
          // 尝试复制到剪贴板
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
          toastManager.success('图片已复制到剪贴板', '复制成功');
        } catch (clipboardError) {
          logger.warn('复制到剪贴板失败，尝试下载:', clipboardError);

          // 回退到下载
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `message_${dayjs().format('YYYY-MM-DD-HH-mm-ss')}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }
      }, 'image/png');
    }
  } catch (error) {
    logger.error('截图失败:', error);
    toastManager.error('截图失败', '操作失败');
  }
}

/**
 * 截图消息并保存为文件
 */
export async function exportMessageAsImage(messageElement: HTMLElement): Promise<void> {
  try {
    const canvas = await html2canvas(messageElement, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
      allowTaint: true
    });

    const timestamp = dayjs().format('YYYY-MM-DD-HH-mm-ss');
    const fileName = `message_${timestamp}.png`;

    if (Capacitor.isNativePlatform()) {
      // 移动端：转换为base64并通过分享API保存
      const dataUrl = canvas.toDataURL('image/png');
      const base64Data = dataUrl.split(',')[1];

      try {
        // 创建临时文件
        const tempFileName = `temp_export_${Date.now()}.png`;
        await Filesystem.writeFile({
          path: tempFileName,
          data: base64Data,
          directory: Directory.Cache
        });

        // 获取文件URI
        const fileUri = await Filesystem.getUri({
          path: tempFileName,
          directory: Directory.Cache
        });

        // 使用分享API让用户选择保存位置
        await Share.share({
          title: '导出消息图片',
          url: fileUri.uri,
          dialogTitle: '保存图片'
        });

        // 清理临时文件
        try {
          await Filesystem.deleteFile({
            path: tempFileName,
            directory: Directory.Cache
          });
        } catch (deleteError) {
          logger.warn('清理临时文件失败:', deleteError);
        }

      } catch (shareError) {
        logger.warn('分享失败:', shareError);
        toastManager.error('导出图片失败', '导出失败');
      }
    } else if (isTauri()) {
      // Tauri 桌面端：使用保存对话框
      canvas.toBlob(async (blob) => {
        if (!blob) {
          toastManager.error('导出图片失败', '导出失败');
          return;
        }
        try {
          const dialog = await import('@tauri-apps/plugin-dialog');
          const fs = await import('@tauri-apps/plugin-fs');
          
          const filePath = await dialog.save({
            title: '保存图片',
            defaultPath: fileName,
            filters: [{ name: 'PNG图片', extensions: ['png'] }]
          });
          
          if (filePath) {
            // 将 blob 转为 Uint8Array
            const arrayBuffer = await blob.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            await fs.writeFile(filePath, uint8Array);
            toastManager.success('图片已保存', '导出成功');
          }
        } catch (tauriError) {
          logger.error('Tauri保存图片失败:', tauriError);
          toastManager.error('导出图片失败', '导出失败');
        }
      }, 'image/png');
    } else {
      // Web端：直接下载
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }
      }, 'image/png');
    }
  } catch (error) {
    logger.error('导出图片失败:', error);
    toastManager.error('导出图片失败', '导出失败');
  }
}

/**
 * 将话题转换为Markdown格式
 */
export async function topicToMarkdown(topic: ChatTopic, exportReasoning = false): Promise<string> {
  try {
    // 获取话题的所有消息
    const messages = await dexieStorage.getTopicMessages(topic.id);
    
    if (messages.length === 0) {
      return `# ${topic.name || topic.title || '空话题'}\n\n*此话题暂无消息*`;
    }

    // 为每条消息加载完整的块数据
    const messagesWithBlocks = [];
    for (const message of messages) {
      if (message.blocks && message.blocks.length > 0) {
        // 按 message.blocks 顺序获取块，保证导出顺序和显示顺序一致
        const blocks = await dexieStorage.getMessageBlocksByIds(message.blocks);
        // 创建完整的消息对象，包含块对象而不是块ID
        const messageWithBlocks = {
          ...message,
          blockObjects: blocks // 添加完整的块对象
        };
        messagesWithBlocks.push(messageWithBlocks);
      } else {
        messagesWithBlocks.push(message);
      }
    }

    // 创建markdown内容
    const markdown = [
      `# ${topic.name || topic.title || '对话记录'}`,
      '',
      `**创建时间:** ${dayjs(topic.createdAt).format('YYYY-MM-DD HH:mm:ss')}`,
      `**更新时间:** ${dayjs(topic.updatedAt || topic.createdAt).format('YYYY-MM-DD HH:mm:ss')}`,
      `**消息数量:** ${messages.length}`,
      '',
      '---',
      '',
      topicMessagesToMarkdown(messagesWithBlocks, exportReasoning)
    ].join('\n');

    return markdown;
  } catch (error) {
    logger.error('转换话题为Markdown失败:', error);
    throw error;
  }
}

/**
 * 将话题消息转换为Markdown格式（专门处理包含块对象的消息）
 */
function topicMessagesToMarkdown(messages: any[], exportReasoning = false): string {
  return messages
    .map(message => {
      // 使用消息的块对象来生成markdown
      if (message.blockObjects && message.blockObjects.length > 0) {
        return messageWithBlocksToMarkdown(message, exportReasoning);
      } else {
        // 如果没有块对象，尝试使用原来的方法
        return messageToMarkdown(message);
      }
    })
    .join('\n\n---\n\n');
}

/**
 * 将包含块对象的消息转换为Markdown格式
 */
function messageWithBlocksToMarkdown(message: any, exportReasoning = false): string {
  const blocks = message.blockObjects || [];
  
  // 分类块
  const mainTextBlocks = blocks.filter((block: any) => block.type === 'main_text');
  const thinkingBlocks = blocks.filter((block: any) => block.type === 'thinking');
  const citationBlocks = blocks.filter((block: any) => block.type === 'citation');
  
  // 标题部分
  const titleSection = message.role === 'user' ? '## 用户' : '## 助手';
  
  // 推理部分
  let reasoningSection = '';
  if (exportReasoning && thinkingBlocks.length > 0) {
    const thinkingContent = thinkingBlocks.map((block: any) => block.content).join('\n\n');
    if (thinkingContent.trim()) {
      reasoningSection = `### 思考过程\n\n${thinkingContent}\n\n### 回答\n\n`;
    }
  }
  
  // 内容部分
  const mainContent = mainTextBlocks.map((block: any) => block.content).join('\n\n');
  const contentSection = processLatexBrackets(mainContent);
  
  // 引用部分
  let citation = '';
  if (citationBlocks.length > 0) {
    const citationContent = citationBlocks.map((block: any) => block.content).join('\n\n');
    if (citationContent.trim()) {
      citation = `### 引用\n\n${citationContent}`;
    }
  }
  
  return [titleSection, '', reasoningSection + contentSection, citation].filter(Boolean).join('\n\n');
}

/**
 * 导出话题为Markdown文件
 */
export async function exportTopicAsMarkdown(topic: ChatTopic, exportReasoning = false): Promise<void> {
  try {
    const markdown = await topicToMarkdown(topic, exportReasoning);
    const timestamp = dayjs().format('YYYY-MM-DD-HH-mm-ss');
    const topicName = removeSpecialCharactersForFileName(topic.name || topic.title || '对话记录');
    const fileName = `${topicName}_${timestamp}.md`;

    if (Capacitor.isNativePlatform()) {
      // 移动端：使用分享API
      try {
        const tempFileName = `temp_topic_${Date.now()}.md`;
        await Filesystem.writeFile({
          path: tempFileName,
          data: markdown,
          directory: Directory.Cache,
          encoding: Encoding.UTF8
        });

        const fileUri = await Filesystem.getUri({
          path: tempFileName,
          directory: Directory.Cache
        });

        await Share.share({
          title: '导出话题Markdown文件',
          text: `${topic.name || '对话记录'} - Markdown格式`,
          url: fileUri.uri,
          dialogTitle: '保存话题Markdown文件'
        });

        // 清理临时文件
        try {
          await Filesystem.deleteFile({
            path: tempFileName,
            directory: Directory.Cache
          });
        } catch (deleteError) {
          logger.warn('清理临时文件失败:', deleteError);
        }

      } catch (shareError) {
        logger.warn('分享失败，尝试复制到剪贴板:', shareError);
        await Clipboard.write({ string: markdown });
        toastManager.warning('分享失败，内容已复制到剪贴板', '导出提醒');
      }
    } else {
      // Web端：直接下载
      const blob = new Blob([markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  } catch (error) {
    logger.error('导出话题Markdown失败:', error);
    toastManager.error('导出失败: ' + (error as Error).message, '导出错误');
  }
}

/**
 * 复制话题为Markdown格式到剪贴板
 */
export async function copyTopicAsMarkdown(topic: ChatTopic, exportReasoning = false): Promise<void> {
  try {
    const markdown = await topicToMarkdown(topic, exportReasoning);

    try {
      await Clipboard.write({
        string: markdown
      });
    } catch (capacitorError) {
      await navigator.clipboard.writeText(markdown);
    }

    toastManager.success('话题Markdown内容已复制到剪贴板', '复制成功');
  } catch (error) {
    logger.error('复制话题Markdown失败:', error);
    toastManager.error('复制失败', '复制错误');
  }
}

/**
 * 导出话题为DOCX格式
 * 使用docx库直接生成DOCX文件
 */
export async function exportTopicAsDocx(topic: ChatTopic, exportReasoning = false): Promise<void> {
  try {
    // 获取话题的所有消息
    const messages = await dexieStorage.getTopicMessages(topic.id);
    
    if (messages.length === 0) {
      toastManager.warning('话题没有消息内容，无法导出', '导出提醒');
      return;
    }

    // 为每条消息加载完整的块数据
    const messagesWithBlocks = [];
    for (const message of messages) {
      if (message.blocks && message.blocks.length > 0) {
        const blocks = await dexieStorage.getMessageBlocksByIds(message.blocks);
        messagesWithBlocks.push({
          ...message,
          blockObjects: blocks
        });
      } else {
        messagesWithBlocks.push(message);
      }
    }

    // 创建DOCX文档
    const doc = await createDocxFromTopic(topic, messagesWithBlocks, exportReasoning);
    
    // 生成文件
    const buffer = await Packer.toBlob(doc);
    
    const timestamp = dayjs().format('YYYY-MM-DD-HH-mm-ss');
    const topicName = removeSpecialCharactersForFileName(topic.name || topic.title || '对话记录');
    const fileName = `${topicName}_${timestamp}.docx`;

    if (Capacitor.isNativePlatform()) {
      // 移动端：转换为base64并分享
      try {
        const arrayBuffer = await buffer.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        const base64String = btoa(String.fromCharCode(...uint8Array));

        const tempFileName = `temp_topic_${Date.now()}.docx`;
        await Filesystem.writeFile({
          path: tempFileName,
          data: base64String,
          directory: Directory.Cache
        });

        const fileUri = await Filesystem.getUri({
          path: tempFileName,
          directory: Directory.Cache
        });

        await Share.share({
          title: '导出话题DOCX文件',
          text: `${topic.name || '对话记录'} - DOCX格式`,
          url: fileUri.uri,
          dialogTitle: '保存话题DOCX文件'
        });

        // 清理临时文件
        try {
          await Filesystem.deleteFile({
            path: tempFileName,
            directory: Directory.Cache
          });
        } catch (deleteError) {
          logger.warn('清理临时文件失败:', deleteError);
        }

      } catch (shareError) {
        logger.warn('分享失败:', shareError);
        toastManager.error('导出失败，请重试', '导出失败');
      }
    } else {
      // Web端：使用file-saver直接下载
      saveAs(buffer, fileName);
    }
  } catch (error) {
    logger.error('导出话题DOCX失败:', error);
    toastManager.error('导出失败: ' + (error as Error).message, '导出错误');
  }
}

/**
 * 从话题数据创建DOCX文档
 */
async function createDocxFromTopic(topic: ChatTopic, messages: any[], exportReasoning = false): Promise<Document> {
  const children: Paragraph[] = [];

  // 添加标题
  children.push(
    new Paragraph({
      text: topic.name || topic.title || '对话记录',
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    })
  );

  // 添加话题信息 - 优化布局
  const topicInfoParagraphs = [
    `创建时间: ${dayjs(topic.createdAt).format('YYYY-MM-DD HH:mm:ss')}`,
    `更新时间: ${dayjs(topic.updatedAt || topic.createdAt).format('YYYY-MM-DD HH:mm:ss')}`,
    `消息数量: ${messages.length}`
  ];

  // 创建信息表格样式的布局
  for (const info of topicInfoParagraphs) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: info,
            bold: true,
            font: {
              ascii: 'Microsoft YaHei',
              eastAsia: 'Microsoft YaHei'
            },
            size: 20,
            color: '374151',
          }),
        ],
        spacing: { after: 120 },
      })
    );
  }

  // 添加更美观的分隔线
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: '●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●',
          color: 'e5e7eb',
          size: 16,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 300, after: 300 },
    })
  );

  // 处理每条消息
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    const blocks = message.blockObjects || [];
    
    // 添加消息头部 - 使用更好看的图标和颜色
    const userIcon = '💬';  // 更简洁的用户图标
    const assistantIcon = '🤖';  // 保持助手图标
    const isUser = message.role === 'user';
    
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: isUser ? `${userIcon} ` : `${assistantIcon} `,
            size: 24,
          }),
          new TextRun({
            text: isUser ? '用户' : '助手',
            bold: true,
            size: 24,
            font: {
              ascii: 'Microsoft YaHei',
              eastAsia: 'Microsoft YaHei'
            },
            color: isUser ? '1d4ed8' : '059669',
          }),
        ],
        spacing: { before: 300, after: 150 },
        border: {
          bottom: {
            style: BorderStyle.SINGLE,
            size: 1,
            color: isUser ? '3b82f6' : '10b981',
          },
        },
      })
    );

    // 处理消息内容
    if (blocks.length > 0) {
      // 分类块
      const mainTextBlocks = blocks.filter((block: any) => block.type === 'main_text');
      const thinkingBlocks = blocks.filter((block: any) => block.type === 'thinking');
      const citationBlocks = blocks.filter((block: any) => block.type === 'citation');

      // 添加思考过程（如果需要）
      if (exportReasoning && thinkingBlocks.length > 0) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: '💭 思考过程',
                bold: true,
                italics: true,
                color: '7c3aed',
                font: {
                  ascii: 'Microsoft YaHei',
                  eastAsia: 'Microsoft YaHei'
                },
                size: 20,
              }),
            ],
            spacing: { before: 150, after: 100 },
          })
        );

        for (const block of thinkingBlocks) {
          await addFormattedContent(children, block.content, {
            italics: true,
            color: '6b7280',
          });
        }

        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: '💬 回答内容',
                bold: true,
                color: '059669',
                font: {
                  ascii: 'Microsoft YaHei',
                  eastAsia: 'Microsoft YaHei'
                },
                size: 20,
              }),
            ],
            spacing: { before: 200, after: 100 },
          })
        );
      }

      // 添加主要内容
      for (const block of mainTextBlocks) {
        await addFormattedContent(children, block.content);
      }

      // 添加引用
      if (citationBlocks.length > 0) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: '📚 参考引用',
                bold: true,
                color: '7c2d12',
                font: {
                  ascii: 'Microsoft YaHei',
                  eastAsia: 'Microsoft YaHei'
                },
                size: 20,
              }),
            ],
            spacing: { before: 200, after: 100 },
          })
        );

        for (const block of citationBlocks) {
          await addFormattedContent(children, block.content, {
            color: '6b7280',
          });
        }
      }
    } else {
      // 如果没有块数据，直接显示消息内容
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: '内容暂无',
              italics: true,
              color: '9ca3af',
              font: {
                ascii: 'Microsoft YaHei',
                eastAsia: 'Microsoft YaHei'
              },
            }),
          ],
          spacing: { after: 150 },
        })
      );
    }

    // 在消息之间添加空行分隔
    if (i < messages.length - 1) {
      children.push(
        new Paragraph({ text: '', spacing: { after: 200 } })
      );
    }
  }

  return new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440,      // 1 inch
              right: 1440,    // 1 inch
              bottom: 1440,   // 1 inch
              left: 1440,     // 1 inch
            },
          },
        },
        children: children,
      },
    ],
  });
}

/**
 * 添加格式化内容到文档
 */
async function addFormattedContent(
  children: Paragraph[], 
  content: string, 
  defaultStyle: {
    italics?: boolean;
    color?: string;
    bold?: boolean;
  } = {}
): Promise<void> {
  const lines = content.split('\n');
  let inCodeBlock = false;
  let codeBlockContent: string[] = [];
  let codeLanguage = '';

  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // 处理代码块开始/结束
    if (trimmedLine.startsWith('```')) {
      if (!inCodeBlock) {
        // 开始代码块
        inCodeBlock = true;
        codeLanguage = trimmedLine.substring(3).trim();
        codeBlockContent = [];
      } else {
        // 结束代码块
        inCodeBlock = false;
        if (codeBlockContent.length > 0) {
          addCodeBlock(children, codeBlockContent.join('\n'), codeLanguage);
        }
        codeBlockContent = [];
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }

    // 跳过空行
    if (!trimmedLine) {
      children.push(new Paragraph({ text: '' }));
      continue;
    }

    // 处理普通文本行
    const textRuns = await parseMarkdownLine(line, defaultStyle);
    if (textRuns.length > 0) {
      children.push(
        new Paragraph({
          children: textRuns,
          spacing: { after: 120 },
        })
      );
    }
  }

  // 如果最后还在代码块中，处理剩余内容
  if (inCodeBlock && codeBlockContent.length > 0) {
    addCodeBlock(children, codeBlockContent.join('\n'), codeLanguage);
  }
}

/**
 * 添加代码块
 */
function addCodeBlock(children: Paragraph[], code: string, language: string = ''): void {
  const codeLines = code.split('\n');
  
  // 添加代码块标题（如果有语言标识）
  if (language) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `📝 ${language.toUpperCase()} 代码`,
            bold: true,
            size: 18,
            color: '374151',
            font: {
              ascii: 'Microsoft YaHei',
              eastAsia: 'Microsoft YaHei'
            },
          }),
        ],
        spacing: { before: 200, after: 100 },
      })
    );
  }

  // 添加代码内容
  for (const codeLine of codeLines) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: codeLine || ' ', // 空行用空格占位
            font: {
              ascii: 'Consolas',
              eastAsia: 'Microsoft YaHei'
            },
            size: 18,
            color: '1f2937',
          }),
        ],
        shading: {
          type: ShadingType.SOLID,
          fill: 'f8f9fa',
        },
        spacing: { after: 0 },
        border: {
          left: {
            style: BorderStyle.SINGLE,
            size: 2,
            color: '6366f1',
          },
        },
        indent: {
          left: 360, // 0.25 inch left indent
        },
      })
    );
  }

  // 代码块后添加空行
  children.push(new Paragraph({ text: '', spacing: { after: 200 } }));
}

/**
 * 解析Markdown行，处理粗体、斜体、链接等
 */
async function parseMarkdownLine(
  line: string, 
  defaultStyle: {
    italics?: boolean;
    color?: string;
    bold?: boolean;
  } = {}
): Promise<TextRun[]> {
  const parts: TextRun[] = [];

  // URL正则表达式
  const urlRegex = /(https?:\/\/[^\s)]+)/g;
  // 粗体正则表达式
  const boldRegex = /\*\*(.*?)\*\*/g;
  // 行内代码正则表达式
  const inlineCodeRegex = /`([^`]+)`/g;

  // 创建所有匹配项的数组
  const matches: Array<{ type: string; match: RegExpExecArray; content: string }> = [];
  
  let match;
  
  // 查找URL
  urlRegex.lastIndex = 0;
  while ((match = urlRegex.exec(line)) !== null) {
    matches.push({ type: 'url', match, content: match[1] });
  }
  
  // 查找粗体
  boldRegex.lastIndex = 0;
  while ((match = boldRegex.exec(line)) !== null) {
    matches.push({ type: 'bold', match, content: match[1] });
  }
  
  // 查找行内代码
  inlineCodeRegex.lastIndex = 0;
  while ((match = inlineCodeRegex.exec(line)) !== null) {
    matches.push({ type: 'code', match, content: match[1] });
  }

  // 按位置排序
  matches.sort((a, b) => a.match.index - b.match.index);

  let lastIndex = 0;

  for (const item of matches) {
    const matchIndex = item.match.index;
    const matchEnd = matchIndex + item.match[0].length;

    // 添加匹配之前的普通文本
    if (matchIndex > lastIndex) {
      const beforeText = line.substring(lastIndex, matchIndex);
      if (beforeText) {
        parts.push(new TextRun({
          text: beforeText,
          font: {
            ascii: 'Microsoft YaHei',
            eastAsia: 'Microsoft YaHei'
          },
          size: 22,
          color: defaultStyle.color || '374151',
          bold: defaultStyle.bold,
          italics: defaultStyle.italics,
        }));
      }
    }

    // 添加匹配的特殊格式内容
    switch (item.type) {
      case 'url':
        parts.push(new TextRun({
          text: item.content,
          font: {
            ascii: 'Microsoft YaHei',
            eastAsia: 'Microsoft YaHei'
          },
          size: 22,
          color: '2563eb',
          underline: {},
        }));
        break;
      case 'bold':
        parts.push(new TextRun({
          text: item.content,
          font: {
            ascii: 'Microsoft YaHei',
            eastAsia: 'Microsoft YaHei'
          },
          size: 22,
          bold: true,
          color: defaultStyle.color || '374151',
          italics: defaultStyle.italics,
        }));
        break;
      case 'code':
        parts.push(new TextRun({
          text: item.content,
          font: {
            ascii: 'Consolas',
            eastAsia: 'Microsoft YaHei'
          },
          size: 20,
          color: '7c3aed',
        }));
        break;
    }

    lastIndex = matchEnd;
  }

  // 添加剩余的普通文本
  if (lastIndex < line.length) {
    const remainingText = line.substring(lastIndex);
    if (remainingText) {
      parts.push(new TextRun({
        text: remainingText,
        font: {
          ascii: 'Microsoft YaHei',
          eastAsia: 'Microsoft YaHei'
        },
        size: 22,
        color: defaultStyle.color || '374151',
        bold: defaultStyle.bold,
        italics: defaultStyle.italics,
      }));
    }
  }

  // 如果没有任何匹配，返回整行作为普通文本
  if (parts.length === 0 && line.trim()) {
    parts.push(new TextRun({
      text: line,
      font: {
        ascii: 'Microsoft YaHei',
        eastAsia: 'Microsoft YaHei'
      },
      size: 22,
      color: defaultStyle.color || '374151',
      bold: defaultStyle.bold,
      italics: defaultStyle.italics,
    }));
  }

  return parts;
}

/**
 * 分享文本内容为文件
 * 通用工具函数，可用于分享任何文本内容
 */
export async function shareTextAsFile(content: string, fileName: string): Promise<void> {
  try {
    if (Capacitor.isNativePlatform()) {
      // 移动端：创建临时文件并通过分享API
      const tempFileName = `temp_${Date.now()}.txt`;
      await Filesystem.writeFile({
        path: tempFileName,
        data: content,
        directory: Directory.Cache,
        encoding: Encoding.UTF8
      });

      const fileUri = await Filesystem.getUri({
        path: tempFileName,
        directory: Directory.Cache
      });

      await Share.share({
        title: fileName,
        url: fileUri.uri,
        dialogTitle: '保存文件'
      });

      // 清理临时文件
      try {
        await Filesystem.deleteFile({
          path: tempFileName,
          directory: Directory.Cache
        });
      } catch (deleteError) {
        logger.warn('清理临时文件失败:', deleteError);
      }
    } else {
      // Web端：下载文件
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  } catch (error) {
    logger.error('分享文件失败:', error);
    // 回退到复制到剪贴板
    try {
      await Clipboard.write({ string: content });
      toastManager.warning('分享失败，内容已复制到剪贴板', '分享提醒');
    } catch (clipboardError) {
      await navigator.clipboard.writeText(content);
      toastManager.warning('分享失败，内容已复制到剪贴板', '分享提醒');
    }
  }
}
