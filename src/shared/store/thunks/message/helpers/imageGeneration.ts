/**
 * 图像生成处理模块
 */
import { generateImage as generateOpenAIImage } from '../../../../api/openai/image';
import { generateImage as generateGeminiImage } from '../../../../api/gemini-aisdk/image';
import { generateImage as generateDashScopeImage, isDashScopeImageModel } from '../../../../api/dashscope/image';
import { createImageBlock } from '../../../../utils/messageUtils';
import { dexieStorage } from '../../../../services/storage/DexieStorageService';
import { newMessagesActions } from '../../../slices/newMessagesSlice';
import { addOneBlock } from '../../../slices/messageBlocksSlice';
import { updateMessageAndTopic } from './dbHelpers';
import { isGeminiModel as isGeminiProvider } from '../../../../../config/models';
import type { Model } from '../../../../types';
import type { Message } from '../../../../types/newMessage';
import type { AppDispatch } from '../../../index';

interface ImageGenerationContext {
  dispatch: AppDispatch;
  model: Model;
  assistantMessage: Message;
  topicId: string;
  apiMessages: any[];
  responseHandler: {
    handleStringContent: (content: string) => void;
  };
}

/**
 * 从 API 消息中提取图像生成提示词
 */
function extractImagePrompt(apiMessages: any[]): string {
  const lastUserMessage = apiMessages
    .filter((msg: { role: string }) => msg.role === 'user')
    .pop();

  if (!lastUserMessage?.content) {
    return '生成一张图片';
  }

  if (typeof lastUserMessage.content === 'string') {
    return lastUserMessage.content;
  }

  if (Array.isArray(lastUserMessage.content)) {
    const textParts = lastUserMessage.content
      .filter((part: any) => part.type === 'text')
      .map((part: any) => part.text);
    return textParts.join(' ') || '生成一张图片';
  }

  return '生成一张图片';
}

/**
 * 保存 base64 图片并返回引用 URL
 */
async function saveBase64Image(
  imageUrl: string,
  topicId: string,
  messageId: string,
  modelId: string
): Promise<string> {
  if (!imageUrl.startsWith('data:image/')) {
    return imageUrl;
  }

  try {
    const imageId = await dexieStorage.saveBase64Image(imageUrl, {
      topicId,
      messageId,
      source: 'ai_generated',
      model: modelId
    });
    return `[图片:${imageId}]`;
  } catch (error) {
    console.error('保存生成的图片失败，使用原始base64:', error);
    return imageUrl;
  }
}

/**
 * 获取图片的 MIME 类型
 */
function getImageMimeType(imageUrl: string): string {
  if (imageUrl.startsWith('data:image/png')) return 'image/png';
  if (imageUrl.startsWith('data:image/jpeg')) return 'image/jpeg';
  return 'image/png';
}

/**
 * 处理图像生成请求
 */
export async function handleImageGeneration(
  context: ImageGenerationContext
): Promise<string> {
  const { dispatch, model, assistantMessage, topicId, apiMessages, responseHandler } = context;

  const prompt = extractImagePrompt(apiMessages);
  let imageUrls: string[] = [];

  // 根据模型类型选择不同的图像生成 API
  if (isGeminiProvider(model)) {
    imageUrls = await generateGeminiImage(model, {
      prompt,
      imageSize: '1024x1024',
      batchSize: 1
    });
    responseHandler.handleStringContent('Gemini 图像生成完成！');
  } else if (isDashScopeImageModel(model)) {
    imageUrls = await generateDashScopeImage(model, {
      prompt,
      imageSize: '1024x1024',
      batchSize: 1
    });
    responseHandler.handleStringContent('Qwen 图像生成完成！');
  } else {
    imageUrls = await generateOpenAIImage(model, {
      prompt,
      imageSize: '1024x1024',
      batchSize: 1
    });
    responseHandler.handleStringContent('图像生成完成！');
  }

  // 处理图像生成结果
  if (!imageUrls || imageUrls.length === 0) {
    return '图像生成失败，没有返回有效的图像URL。';
  }

  const imageUrl = imageUrls[0];
  const finalImageUrl = await saveBase64Image(imageUrl, topicId, assistantMessage.id, model.id);

  // 创建图片块
  const imageBlock = createImageBlock(assistantMessage.id, {
    url: finalImageUrl,
    mimeType: getImageMimeType(imageUrl)
  });

  // 添加图片块到 Redux 状态
  dispatch(addOneBlock(imageBlock));

  // 保存图片块到数据库
  await dexieStorage.saveMessageBlock(imageBlock);

  // 将图片块 ID 添加到消息的 blocks 数组
  dispatch(newMessagesActions.upsertBlockReference({
    messageId: assistantMessage.id,
    blockId: imageBlock.id,
    status: imageBlock.status
  }));

  // 更新消息
  const updatedChanges = {
    blocks: [...(assistantMessage.blocks || []), imageBlock.id],
    updatedAt: new Date().toISOString()
  };

  dispatch(newMessagesActions.updateMessage({
    id: assistantMessage.id,
    changes: updatedChanges
  }));

  // 保存到数据库
  await updateMessageAndTopic(assistantMessage.id, topicId, updatedChanges);

  return '图像生成完成！';
}
