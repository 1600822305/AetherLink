/**
 * 图像回调模块
 * 处理图像生成和搜索响应
 * 
 * 参考 Cherry Studio imageCallbacks 设计
 */

import { v4 as uuid } from 'uuid';
import { MessageBlockStatus, MessageBlockType } from '../../../types/newMessage';
import type { ImageMessageBlock, MessageBlock } from '../../../types/newMessage';
import type { CallbackDependencies, StreamProcessorCallbacks } from './types';

/**
 * 创建图像回调
 */
export function createImageCallbacks(deps: CallbackDependencies): Partial<StreamProcessorCallbacks> {
  const { messageId, blockManager } = deps;
  
  // 内部状态
  let imageBlockId: string | null = null;

  /**
   * 创建新的图像块
   */
  const createNewImageBlock = (overrides: Partial<ImageMessageBlock> = {}): MessageBlock => {
    return {
      id: uuid(),
      messageId,
      type: MessageBlockType.IMAGE,
      url: '',
      mimeType: 'image/png',
      createdAt: new Date().toISOString(),
      status: MessageBlockStatus.PENDING,
      ...overrides
    } as ImageMessageBlock;
  };

  return {
    /**
     * 图像创建
     */
    onImageCreated: async () => {
      console.log('[ImageCallbacks] 图像创建');
      
      if (blockManager.hasInitialPlaceholder && blockManager.initialPlaceholderBlockId) {
        // 复用占位符块
        imageBlockId = blockManager.initialPlaceholderBlockId;
        blockManager.smartBlockUpdate(
          imageBlockId,
          {
            type: MessageBlockType.IMAGE,
            status: MessageBlockStatus.PENDING
          },
          MessageBlockType.IMAGE,
          false
        );
      } else if (!imageBlockId) {
        // 创建新图像块
        const newBlock = createNewImageBlock({ status: MessageBlockStatus.PENDING });
        imageBlockId = newBlock.id;
        await blockManager.handleBlockTransition(newBlock, MessageBlockType.IMAGE);
      }
    },

    /**
     * 图像增量更新
     */
    onImageDelta: async (imageData: any) => {
      if (!imageBlockId) {
        // 如果没有图像块，先创建
        const newBlock = createNewImageBlock({ status: MessageBlockStatus.STREAMING });
        imageBlockId = newBlock.id;
        await blockManager.handleBlockTransition(newBlock, MessageBlockType.IMAGE);
      }
      
      const imageUrl = imageData?.images?.[0] || imageData?.url || '';
      const changes: Partial<ImageMessageBlock> = {
        url: imageUrl,
        metadata: { generateImageResponse: imageData },
        status: MessageBlockStatus.STREAMING
      };
      
      blockManager.smartBlockUpdate(imageBlockId, changes, MessageBlockType.IMAGE, false);
    },

    /**
     * 图像生成完成
     */
    onImageComplete: async (imageData?: any) => {
      console.log('[ImageCallbacks] 图像完成');
      
      if (imageBlockId) {
        const imageUrl = imageData?.images?.[0] || imageData?.url || '';
        const changes: Partial<ImageMessageBlock> = {
          url: imageUrl,
          metadata: imageData ? { generateImageResponse: imageData } : undefined,
          status: MessageBlockStatus.SUCCESS
        };
        
        blockManager.smartBlockUpdate(imageBlockId, changes, MessageBlockType.IMAGE, true);
        imageBlockId = null;
      } else if (imageData) {
        // 没有块但有数据，创建完成的块
        const newBlock = createNewImageBlock({
          url: imageData.images?.[0] || imageData.url || '',
          metadata: { generateImageResponse: imageData },
          status: MessageBlockStatus.SUCCESS
        });
        await blockManager.handleBlockTransition(newBlock, MessageBlockType.IMAGE);
      } else {
        console.warn('[ImageCallbacks] onImageComplete 调用但没有图像块或数据');
      }
    },

    /**
     * 图像搜索结果
     */
    onImageSearched: async (images: any[]) => {
      console.log('[ImageCallbacks] 图像搜索结果', images?.length || 0);
      
      if (!images || images.length === 0) return;
      
      // 为每个搜索到的图像创建块
      for (const image of images) {
        const imageUrl = typeof image === 'string' ? image : (image.url || image.content || '');
        const mimeType = image.mimeType || image.mime || 'image/png';
        
        // 构建最终的图像 URL
        const finalUrl = image.type === 'base64' 
          ? `data:${mimeType};base64,${image.content || imageUrl}` 
          : imageUrl;
        
        const newBlock = createNewImageBlock({
          url: finalUrl,
          mimeType,
          metadata: image.metadata || {},
          status: MessageBlockStatus.SUCCESS
        });
        
        await blockManager.handleBlockTransition(newBlock, MessageBlockType.IMAGE);
      }
    },

    // 暴露内部状态
    getCurrentImageBlockId: () => imageBlockId,
    resetImageBlock: () => {
      imageBlockId = null;
    }
  } as any;
}
