import { ImageUploadService } from '../services/ImageUploadService';
import { FileUploadService } from '../services/FileUploadService';
import { dexieStorage } from '../services/storage/DexieStorageService';
import type { ImageContent, FileContent } from '../types';

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
      const selectedImages = await ImageUploadService.selectImages(source);
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
        console.log(`处理图片进度: ${completedImages}/${totalImages}`);
      };

      // 处理图片
      const processedImages = await Promise.all(
        selectedImages.map(async (img, index) => {
          try {
            // 1. 压缩图片
            const compressedImage = await ImageUploadService.compressImage(img, 1024); // 限制1MB
            updateProgress(0.5); // 算作半个完成单位

            // 2. 尝试保存到DexieStorageService
            if (currentTopicState) {
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
                console.warn('数据库存储图片失败，使用内存中的图片:', storageError);
                updateProgress(0.5);

                // 返回压缩后的图片，而不是引用
                return compressedImage;
              }
            } else {
              // 没有当前话题，使用原始方式
              const formattedImage = ImageUploadService.ensureCorrectFormat(compressedImage);
              updateProgress(0.5);
              return formattedImage;
            }
          } catch (error) {
            console.error(`处理第 ${index + 1} 张图片时出错:`, error);
            updateProgress(1);
            return null; // 返回null，稍后过滤掉
          }
        })
      );

      // 过滤掉错误的图片（null值）
      const validImages = processedImages.filter(img => img !== null) as ImageContent[];
      setUploadingMedia(false);
      return validImages;
    } catch (error) {
      console.error('图片上传失败:', error);
      setUploadingMedia(false);
      throw error;
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
      console.error('文件上传失败:', error);
      setUploadingMedia(false);
      throw error;
    }
  };

  return {
    handleImageUpload,
    handleFileUpload
  };
};
