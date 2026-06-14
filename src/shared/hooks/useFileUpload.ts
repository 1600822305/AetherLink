import { ImageUploadService } from '../services/files/ImageUploadService';
import { FileUploadService } from '../services/files/FileUploadService';
import { dexieStorage } from '../services/storage/DexieStorageService';
import type { ImageContent, FileContent } from '../types';
import { createLogger } from '../services/infra/logger';

const logger = createLogger('FileUpload');

interface UseFileUploadProps {
  currentTopicState?: any;
  setUploadingMedia: React.Dispatch<React.SetStateAction<boolean>>;
}

export const useFileUpload = ({ currentTopicState, setUploadingMedia }: UseFileUploadProps) => {
  
  // 处理图片上传
  const handleImageUpload = async (source: 'camera' | 'photos' = 'photos'): Promise<ImageContent[]> => {
    try {
      setUploadingMedia(true);

      // 选择图片
      let selectedImages: ImageContent[];
      try {
        selectedImages = await ImageUploadService.selectImages(source);
      } catch (selectError: any) {
        // 处理选择图片时的错误（包括用户取消）
        const errorMessage = selectError?.message || String(selectError);
        if (errorMessage.includes('cancel') || 
            errorMessage.includes('取消') || 
            errorMessage.includes('User cancelled')) {
          // 用户取消是正常行为，不记录错误
          setUploadingMedia(false);
          return [];
        }
        // 其他错误记录日志并返回空数组
        logger.error('选择图片时出错:', selectError);
        setUploadingMedia(false);
        return [];
      }
      
      if (selectedImages.length === 0) {
        setUploadingMedia(false);
        return [];
      }

      // 压缩图片并存储进度
      const totalImages = selectedImages.length;
      let completedImages = 0;

      // 创建一个进度更新函数
      const updateProgress = (increment: number = 1) => {
        completedImages += increment;
        logger.debug(`处理图片进度: ${completedImages}/${totalImages}`);
      };

      // 处理图片
      const processedImages = await Promise.all(
        selectedImages.map(async (img, index) => {
          try {
            // 1. 压缩图片
            const compressedImage = await ImageUploadService.compressImage(img, 1024); // 限制1MB
            updateProgress(0.5); // 算作半个完成单位

            // 2. 尝试保存到DexieStorageService
            // 确保 currentTopicState 和 currentTopicState.id 都存在
            if (currentTopicState && currentTopicState.id) {
              try {
                const imageRef = await dexieStorage.saveBase64Image(
                  compressedImage.base64Data || '',
                  {
                    mimeType: compressedImage.mimeType,
                    width: compressedImage.width,
                    height: compressedImage.height,
                    size: compressedImage.size,
                    topicId: currentTopicState.id
                  }
                );

                updateProgress(0.5);

                // 成功保存，返回图片引用
                return {
                  url: `[图片:${imageRef}]`, // 注意：这里imageRef直接是字符串ID
                  mimeType: compressedImage.mimeType,
                  width: compressedImage.width,
                  height: compressedImage.height
                } as ImageContent;

              } catch (storageError) {
                // 数据库存储失败，直接使用压缩后的图片
                logger.warn('数据库存储图片失败，使用内存中的图片:', storageError);
                updateProgress(0.5);

                // 返回压缩后的图片，而不是引用
                return compressedImage;
              }
            } else {
              // 没有当前话题或话题ID，使用原始方式
              logger.debug('当前没有话题或话题ID，直接使用压缩后的图片');
              const formattedImage = ImageUploadService.ensureCorrectFormat(compressedImage);
              updateProgress(0.5);
              return formattedImage;
            }
          } catch (error) {
            logger.error(`处理第 ${index + 1} 张图片时出错:`, error);
            updateProgress(1);
            // 返回null，稍后过滤掉，避免因单张图片失败导致整体失败
            return null;
          }
        })
      );

      // 过滤掉错误的图片（null值）
      const validImages = processedImages.filter((img): img is ImageContent => img !== null);
      setUploadingMedia(false);
      return validImages;
    } catch (error: any) {
      // 捕获所有未预期的错误，避免闪退
      const errorMessage = error?.message || String(error);
      logger.error('图片上传失败:', error);
      setUploadingMedia(false);
      
      // 对于用户取消等正常操作，返回空数组而不是抛出错误
      if (errorMessage.includes('cancel') || 
          errorMessage.includes('取消') || 
          errorMessage.includes('User cancelled')) {
        return [];
      }
      
      // 其他错误也返回空数组，避免闪退
      return [];
    }
  };

  // 处理文件上传
  const handleFileUpload = async (): Promise<FileContent[]> => {
    try {
      setUploadingMedia(true);

      // 选择文件
      const selectedFiles = await FileUploadService.selectFiles();
      if (selectedFiles.length === 0) {
        setUploadingMedia(false);
        return [];
      }

      setUploadingMedia(false);
      return selectedFiles;
    } catch (error) {
      logger.error('文件上传失败:', error);
      setUploadingMedia(false);
      throw error;
    }
  };

  return {
    handleImageUpload,
    handleFileUpload
  };
};
