/**
 * OpenAI多模态处理模块
 * 负责处理图像和其他多模态内容，增强版文件支持
 */
import type { Message, ImageContent, Model } from '../../types';
// 不直接导入OpenAI，避免未使用的导入警告
import { adaptToAPIMessage } from '../../utils/messageAdapterUtils';
import { getMainTextContent, findImageBlocks } from '../../utils/messageUtils';
import { FileTypes, getFileTypeByExtension, readFileContent } from '../../utils/fileUtils';
import { findFileBlocks } from '../../utils/blockUtils';
import {
  isClaudeModel,
  isGeminiModel,
  isGemmaModel
} from '../../utils/modelUtils';
import { mobileFileStorage } from '../../services/MobileFileStorageService';

// 定义消息参数类型，避免使用OpenAI类型
export interface ChatCompletionMessageParam {
  role: 'system' | 'user' | 'assistant';
  content: string | any[];
}

export interface ChatCompletionUserMessageParam extends ChatCompletionMessageParam {
  role: 'user';
}

export interface ChatCompletionAssistantMessageParam extends ChatCompletionMessageParam {
  role: 'assistant';
}

export interface ChatCompletionSystemMessageParam extends ChatCompletionMessageParam {
  role: 'system';
}

// OpenAI消息内容项类型
export interface MessageContentItem {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: {
    url: string;
    detail?: 'auto' | 'low' | 'high';
  };
}

/**
 * 转换消息格式，支持图片
 * @param messages 消息数组
 * @returns OpenAI格式的消息数组
 */
export function convertToOpenAIMessages(messages: Message[]): Array<ChatCompletionMessageParam> {
  return messages.map(msg => {
    // 首先将消息转换为API兼容格式
    const apiMsg = adaptToAPIMessage(msg);

    // 检查消息是否包含图片 - 支持两种图片格式
    const isComplexContent = typeof apiMsg.content === 'object';
    const hasDirectImages = Array.isArray(apiMsg.images) && apiMsg.images.length > 0;

    // 添加调试日志
    console.log(`[OpenAI API] 处理消息类型: ${apiMsg.role}, 复杂内容: ${isComplexContent}, 直接图片: ${hasDirectImages}`);

    // 保持原始角色，不再将system角色转换为user角色
    const role = apiMsg.role;

    // 如果包含任意形式的图片，使用内容数组格式
    if ((isComplexContent || hasDirectImages) && role === 'user') {
      // 准备内容数组
      const contentArray: MessageContentItem[] = [];

      // 添加文本内容（如果有）
      const textContent = isComplexContent
        ? (apiMsg.content as {text?: string}).text || ''
        : typeof apiMsg.content === 'string' ? apiMsg.content : '';

      if (textContent) {
        contentArray.push({
          type: 'text',
          text: textContent
        });
      }

      // 添加内容里的图片（旧格式）
      if (isComplexContent) {
        const content = apiMsg.content as {text?: string; images?: ImageContent[]};
        if (content.images && content.images.length > 0) {
          console.log(`[OpenAI API] 处理旧格式图片，数量: ${content.images.length}`);
          content.images.forEach((image, index) => {
            if (image.base64Data) {
              contentArray.push({
                type: 'image_url',
                image_url: {
                  url: image.base64Data, // 已经包含完整的data:image/格式
                  detail: 'auto'
                }
              });
              console.log(`[OpenAI API] 添加base64图片 ${index+1}, 开头: ${image.base64Data.substring(0, 30)}...`);
            } else if (image.url) {
              contentArray.push({
                type: 'image_url',
                image_url: {
                  url: image.url,
                  detail: 'auto'
                }
              });
              console.log(`[OpenAI API] 添加URL图片 ${index+1}: ${image.url}`);
            }
          });
        }
      }

      // 添加直接附加的图片（新格式）
      if (hasDirectImages) {
        console.log(`[OpenAI API] 处理新格式图片，数量: ${apiMsg.images!.length}`);
        apiMsg.images!.forEach((imgFormat, index) => {
          if (imgFormat.image_url && imgFormat.image_url.url) {
            contentArray.push({
              type: 'image_url',
              image_url: {
                url: imgFormat.image_url.url,
                detail: 'auto'
              }
            });
            console.log(`[OpenAI API] 添加新格式图片 ${index+1}: ${imgFormat.image_url.url.substring(0, 30)}...`);
          }
        });
      }

      console.log(`[OpenAI API] 转换后内容数组长度: ${contentArray.length}, 包含图片数量: ${contentArray.filter(item => item.type === 'image_url').length}`);

      // 处理空内容的极端情况
      if (contentArray.length === 0) {
        console.warn('[OpenAI API] 警告: 生成了空内容数组，添加默认文本');
        contentArray.push({
          type: 'text',
          text: '图片'
        });
      }

      return {
        role,
        content: contentArray
      };
    } else {
      // 纯文本消息，保持原始角色
      return {
        role,
        content: typeof apiMsg.content === 'string' ? apiMsg.content : (apiMsg.content as {text?: string}).text || '',
      };
    }
  });
}

/**
 * 检查消息中是否包含图片
 * @param messages 消息数组
 * @returns 是否包含图片
 */
export function hasImages(messages: Message[]): boolean {
  // 检查直接图片
  const hasDirectImages = messages.some(msg => {
    const apiMsg = adaptToAPIMessage(msg);
    return Array.isArray(apiMsg.images) && apiMsg.images.length > 0;
  });

  // 检查内容图片
  const hasContentImages = messages.some(msg => {
    const apiMsg = adaptToAPIMessage(msg);
    if (typeof apiMsg.content !== 'object') return false;
    const content = apiMsg.content as {images?: ImageContent[]};
    return Array.isArray(content.images) && content.images.length > 0;
  });

  return hasDirectImages || hasContentImages;
}

/**
 * 检查OpenAI格式消息中是否包含图片
 * @param messages OpenAI格式的消息数组
 * @returns 是否包含图片
 */
export function hasOpenAIFormatImages(messages: ChatCompletionMessageParam[]): boolean {
  return messages.some(msg =>
    Array.isArray(msg.content) &&
    msg.content.some((item: any) => item.type === 'image_url')
  );
}

/**
 * 增强版消息处理：支持文件和图像
 * 处理消息中的文件和图像内容，支持不同模型的特定格式要求
 */
export async function processMessageWithFiles(
  message: Message,
  model: Model,
  supportsMultimodal: boolean = true
): Promise<ChatCompletionMessageParam> {
  try {
    // 获取基础文本内容
    const textContent = getMainTextContent(message);

    // 获取图片和文件块
    const imageBlocks = findImageBlocks(message);
    const fileBlocks = findFileBlocks(message);

    // 处理系统消息的特殊情况
    if (message.role === 'system') {
      return handleSystemMessage(textContent, model);
    }

    // 如果没有多媒体内容，返回简单文本消息
    if (imageBlocks.length === 0 && fileBlocks.length === 0) {
      return handleTextOnlyMessage(textContent, message.role, model);
    }

    // 处理多模态内容
    if (supportsMultimodal && (imageBlocks.length > 0 || fileBlocks.length > 0)) {
      return await handleMultimodalMessage(textContent, imageBlocks, fileBlocks, message.role, model);
    }

    // 处理不支持多模态但有文件的情况
    if (fileBlocks.length > 0) {
      return await handleTextWithFiles(textContent, fileBlocks, message.role, model);
    }

    // 默认返回文本内容
    return handleTextOnlyMessage(textContent, message.role, model);
  } catch (error) {
    console.error('[multimodal] 处理消息内容失败:', error);
    // 降级处理：返回基础文本消息
    return handleTextOnlyMessage(getMainTextContent(message), message.role, model);
  }
}

/**
 * 处理系统消息
 */
function handleSystemMessage(content: string, model: Model): ChatCompletionMessageParam {
  if (isClaudeModel(model)) {
    return { role: 'system', content };
  }

  if (isGeminiModel(model)) {
    return { role: 'user', content: `<system>\n${content}\n</system>` };
  }

  if (isGemmaModel(model)) {
    return { role: 'user', content: `<start_of_turn>system\n${content}\n<end_of_turn>` };
  }

  return { role: 'system', content };
}

/**
 * 处理纯文本消息
 */
function handleTextOnlyMessage(content: string, role: string, model: Model): ChatCompletionMessageParam {
  if (isGeminiModel(model)) {
    return {
      role: role === 'assistant' ? 'assistant' : role as any,
      content: [{ text: content }] as any
    };
  }

  return { role: role as any, content };
}

/**
 * 处理多模态消息（图片 + 文件）
 */
async function handleMultimodalMessage(
  textContent: string,
  imageBlocks: any[],
  fileBlocks: any[],
  role: string,
  model: Model
): Promise<ChatCompletionMessageParam> {
  if (isClaudeModel(model)) {
    return await handleClaudeMultimodal(textContent, imageBlocks, fileBlocks, role);
  }

  if (isGeminiModel(model)) {
    return await handleGeminiMultimodal(textContent, imageBlocks, fileBlocks, role);
  }

  // 默认OpenAI格式
  return await handleOpenAIMultimodal(textContent, imageBlocks, fileBlocks, role);
}

/**
 * 处理Claude多模态格式
 */
async function handleClaudeMultimodal(
  textContent: string,
  imageBlocks: any[],
  fileBlocks: any[],
  role: string
): Promise<ChatCompletionMessageParam> {
  const parts: any[] = [];

  // 添加文本内容
  if (textContent) {
    parts.push({ type: 'text', text: textContent });
  }

  // 处理图片
  for (const block of imageBlocks) {
    if (block.url) {
      parts.push({
        type: 'image',
        source: { type: 'url', url: block.url }
      });
    } else if (block.base64Data) {
      parts.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: block.mimeType || 'image/jpeg',
          data: block.base64Data.includes(',') ? block.base64Data.split(',')[1] : block.base64Data
        }
      });
    }
  }

  // 处理文件
  for (const block of fileBlocks) {
    if (block.file) {
      const fileType = getFileTypeByExtension(block.file.origin_name || block.file.name || '');

      // PDF文件特殊处理
      if (block.file.ext === '.pdf' && block.file.size < 32 * 1024 * 1024) {
        try {
          const result = await mobileFileStorage.getFileBase64(block.file.id);
          const cleanBase64 = (result.data && typeof result.data === 'string' && result.data.includes(',')) ? result.data.split(',')[1] : result.data;
          parts.push({
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: cleanBase64
            }
          });
        } catch (error) {
          console.error('[multimodal] Claude PDF处理失败:', error);
          // 降级为文本处理
          const fileContent = await readFileContent(block.file);
          parts.push({
            type: 'text',
            text: `文件: ${block.file.origin_name}\n\n${fileContent}`
          });
        }
      } else if (fileType === FileTypes.TEXT || fileType === FileTypes.CODE || fileType === FileTypes.DOCUMENT) {
        // 文本文件处理
        try {
          const fileContent = await readFileContent(block.file);
          parts.push({
            type: 'text',
            text: `文件: ${block.file.origin_name}\n\n${fileContent}`
          });
        } catch (error) {
          console.error('[multimodal] Claude文本文件处理失败:', error);
        }
      }
    }
  }

  return { role: role as any, content: parts };
}

/**
 * 处理Gemini多模态格式
 */
async function handleGeminiMultimodal(
  textContent: string,
  imageBlocks: any[],
  fileBlocks: any[],
  role: string
): Promise<ChatCompletionMessageParam> {
  const parts: any[] = [];

  // 添加文本内容
  if (textContent) {
    parts.push({ text: textContent });
  }

  // 处理图片
  for (const block of imageBlocks) {
    if (block.url || block.base64Data) {
      const base64Data = block.base64Data
        ? (block.base64Data && typeof block.base64Data === 'string' && block.base64Data.includes(',') ? block.base64Data.split(',')[1] : block.base64Data)
        : '[URL_IMAGE]';

      parts.push({
        inlineData: {
          mimeType: block.mimeType || 'image/jpeg',
          data: base64Data
        }
      });
    }
  }

  // 处理文件
  for (const block of fileBlocks) {
    if (block.file) {
      const fileType = getFileTypeByExtension(block.file.origin_name || block.file.name || '');

      if (fileType === FileTypes.TEXT || fileType === FileTypes.CODE || fileType === FileTypes.DOCUMENT) {
        try {
          const fileContent = await readFileContent(block.file);
          parts.push({
            text: `文件: ${block.file.origin_name}\n\n${fileContent}`
          });
        } catch (error) {
          console.error('[multimodal] Gemini文件处理失败:', error);
        }
      }
    }
  }

  return {
    role: role === 'assistant' ? 'assistant' : role as any,
    content: parts
  };
}

/**
 * 处理OpenAI多模态格式
 */
async function handleOpenAIMultimodal(
  textContent: string,
  imageBlocks: any[],
  fileBlocks: any[],
  role: string
): Promise<ChatCompletionMessageParam> {
  const parts: MessageContentItem[] = [];

  // 添加文本内容
  if (textContent) {
    parts.push({ type: 'text', text: textContent });
  }

  // 处理图片
  for (const block of imageBlocks) {
    if (block.url) {
      parts.push({
        type: 'image_url',
        image_url: { url: block.url, detail: 'auto' }
      });
    } else if (block.base64Data) {
      const dataUrl = block.base64Data.startsWith('data:')
        ? block.base64Data
        : `data:${block.mimeType || 'image/jpeg'};base64,${block.base64Data}`;

      parts.push({
        type: 'image_url',
        image_url: { url: dataUrl, detail: 'auto' }
      });
    }
  }

  // 处理文件
  for (const block of fileBlocks) {
    if (block.file) {
      const fileType = getFileTypeByExtension(block.file.origin_name || block.file.name || '');

      if (fileType === FileTypes.TEXT || fileType === FileTypes.CODE || fileType === FileTypes.DOCUMENT) {
        try {
          const fileContent = await readFileContent(block.file);
          parts.push({
            type: 'text',
            text: `文件: ${block.file.origin_name}\n\n${fileContent}`
          });
        } catch (error) {
          console.error('[multimodal] OpenAI文件处理失败:', error);
        }
      }
    }
  }

  return { role: role as any, content: parts };
}

/**
 * 处理包含文件但不支持多模态的消息
 */
async function handleTextWithFiles(
  textContent: string,
  fileBlocks: any[],
  role: string,
  model: Model
): Promise<ChatCompletionMessageParam> {
  let combinedContent = textContent ? textContent + '\n\n' : '';

  // 添加文件内容
  for (const block of fileBlocks) {
    if (block.file) {
      const fileType = getFileTypeByExtension(block.file.origin_name || block.file.name || '');

      if (fileType === FileTypes.TEXT || fileType === FileTypes.CODE || fileType === FileTypes.DOCUMENT) {
        try {
          const fileContent = await readFileContent(block.file);
          combinedContent += `文件: ${block.file.origin_name}\n\n${fileContent}\n\n`;
        } catch (error) {
          console.error('[multimodal] 文件内容读取失败:', error);
          combinedContent += `文件: ${block.file.origin_name} (读取失败)\n\n`;
        }
      }
    }
  }

  return handleTextOnlyMessage(combinedContent.trim(), role, model);
}
