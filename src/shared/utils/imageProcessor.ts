/**
 * 图片处理工具模块
 * 
 * 统一处理图片格式化逻辑，包括：
 * - 合并 images 数组和 files 中的图片文件
 * - 解析图片引用格式并从数据库加载实际图片
 * - 转换为 SiliconFlowImageFormat 标准格式
 * - 过滤非图片文件
 */

import type { ImageContent, SiliconFlowImageFormat, FileContent } from '../types';
import { dexieStorage } from '../services/storage/DexieStorageService';
import { createLogger } from '../services/infra/logger';
const logger = createLogger('ImageProcessor');

/** 图片引用格式的正则表达式 */
const IMAGE_REF_PATTERN = /\[图片:([a-zA-Z0-9_-]+)\]/;

/**
 * 将 Blob 转换为 base64 Data URL
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}

/**
 * 解析单张图片的 URL，处理图片引用格式
 * 如果是 [图片:id] 引用格式，则从数据库加载实际图片数据
 */
async function resolveImageUrl(img: ImageContent): Promise<string> {
  let imageUrl = img.base64Data || img.url;

  if (img.url && IMAGE_REF_PATTERN.test(img.url)) {
    const refMatch = img.url.match(IMAGE_REF_PATTERN);
    if (refMatch && refMatch[1]) {
      try {
        const imageId = refMatch[1];
        const blob = await dexieStorage.getImageBlob(imageId);
        if (blob) {
          imageUrl = await blobToBase64(blob);
        }
      } catch (error) {
        logger.error('加载图片引用失败:', error);
      }
    }
  }

  return imageUrl;
}

/**
 * 合并 images 和 files 中的图片，统一为 ImageContent 数组
 */
export function mergeImageSources(images: ImageContent[], files: FileContent[]): ImageContent[] {
  return [
    ...images,
    ...files.filter(f => f.mimeType.startsWith('image/')).map(file => ({
      base64Data: file.base64Data,
      url: file.url || '',
      width: file.width,
      height: file.height
    } as ImageContent))
  ];
}

/**
 * 将图片列表处理为 SiliconFlowImageFormat 格式
 * 
 * 核心处理流程：
 * 1. 合并 images 数组和 files 中的图片文件
 * 2. 对每张图片解析引用并加载实际数据
 * 3. 转换为 SiliconFlowImageFormat 标准格式
 * 
 * @param images - 直接上传的图片列表
 * @param files - 上传的文件列表（会自动过滤出图片）
 * @returns 格式化后的图片数组
 */
export async function processImages(
  images: ImageContent[],
  files: FileContent[]
): Promise<SiliconFlowImageFormat[]> {
  const allImages = mergeImageSources(images, files);

  const formattedImages: SiliconFlowImageFormat[] = await Promise.all(
    allImages.map(async (img) => {
      const imageUrl = await resolveImageUrl(img);
      return {
        type: 'image_url',
        image_url: {
          url: imageUrl
        }
      } as SiliconFlowImageFormat;
    })
  );

  return formattedImages;
}

/**
 * 从文件列表中过滤出非图片文件
 * 用于发送消息时避免图片文件被重复发送
 */
export function getNonImageFiles(files: FileContent[]): FileContent[] {
  return files.filter(f => !f.mimeType.startsWith('image/'));
}
