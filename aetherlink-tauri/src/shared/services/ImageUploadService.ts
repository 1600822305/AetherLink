import type { ImageContent } from '../types';
import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

/**
 * 图片上传服务
 * 处理图片选择、压缩和转换
 */
export const ImageUploadService = {
  /**
   * 从相册或相机选择图片
   * @param source 图片来源，'camera' 或 'photos'
   * @returns Promise<ImageContent[]> 选择的图片内容数组
   */
  async selectImages(source: 'camera' | 'photos' = 'photos'): Promise<ImageContent[]> {
    try {
      // 检查当前是否在移动设备上
      const isNative = Capacitor.isNativePlatform();
      
      if (isNative) {
        // 在移动设备上使用Capacitor Camera API
        const cameraSource = 
          source === 'camera' ? CameraSource.Camera : CameraSource.Photos;
        
        // 请求权限
        const permissionStatus = await Camera.checkPermissions();
        if (permissionStatus.photos !== 'granted' && source === 'photos') {
          const requested = await Camera.requestPermissions({
            permissions: ['photos']
          });
          if (requested.photos !== 'granted') {
            throw new Error('需要相册访问权限');
          }
        } else if (permissionStatus.camera !== 'granted' && source === 'camera') {
          const requested = await Camera.requestPermissions({
            permissions: ['camera']
          });
          if (requested.camera !== 'granted') {
            throw new Error('需要相机访问权限');
          }
        }
        
        // 获取图片
        const result = await Camera.getPhoto({
          quality: 75, // 降低质量以避免过大的图片
          allowEditing: false,
          resultType: CameraResultType.Base64,
          source: cameraSource,
          width: 1024, // 限制宽度，以减小文件大小
          height: 1024, // 限制高度
          correctOrientation: true,
        });
        
        if (!result || !result.base64String) {
          throw new Error('获取图片失败');
        }
        
        // 判断MIME类型
        let mimeType = result.format ? `image/${result.format.toLowerCase()}` : 'image/jpeg';
        
        // 创建图片内容对象，确保base64数据格式正确
        const imageContent: ImageContent = {
          url: '', // 本地图片没有URL
          base64Data: `data:${mimeType};base64,${result.base64String}`,
          mimeType: mimeType,
          // 不从Camera.getPhoto结果中获取宽高，因为Photo类型可能不包含这些属性
          // 我们将在加载或压缩图片时设置正确的宽高
        };
        
        return [imageContent];
      } else {
        // 在Web环境中使用文件选择器
        return new Promise((resolve, reject) => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'image/*';
          input.multiple = true;

          let isResolved = false;

          input.onchange = async (event) => {
            if (isResolved) return;
            isResolved = true;

            const files = (event.target as HTMLInputElement).files;
            if (!files || files.length === 0) {
              resolve([]);
              return;
            }

            try {
              const imageContents = await Promise.all(
                Array.from(files).map(file => this.processFile(file))
              );
              resolve(imageContents);
            } catch (error) {
              reject(error);
            }
          };

          // 处理用户取消选择的情况
          input.oncancel = () => {
            if (isResolved) return;
            isResolved = true;
            resolve([]);
          };

          // 添加焦点失去事件处理，用于检测用户取消
          const handleWindowFocus = () => {
            setTimeout(() => {
              if (!isResolved && (!input.files || input.files.length === 0)) {
                isResolved = true;
                resolve([]);
              }
              window.removeEventListener('focus', handleWindowFocus);
            }, 300); // 延迟检查，给文件选择器时间完成
          };

          window.addEventListener('focus', handleWindowFocus);
          input.click();
        });
      }
    } catch (error) {
      console.error('选择图片失败:', error);
      throw error;
    }
  },
  
  /**
   * 处理文件，转换为ImageContent对象
   * @param file 文件对象
   * @returns Promise<ImageContent> 处理后的图片内容
   */
  async processFile(file: File): Promise<ImageContent> {
    return new Promise((resolve, reject) => {
      try {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (!event.target || !event.target.result) {
            reject(new Error('读取文件失败'));
            return;
          }
          
          const base64Data = event.target.result as string;
          const img = new Image();
          img.onload = () => {
            const imageContent: ImageContent = {
              url: '', // 本地图片没有URL
              base64Data,
              mimeType: file.type,
              width: img.width,
              height: img.height,
              size: file.size,
            };
            resolve(imageContent);
          };
          img.onerror = () => {
            reject(new Error('图片加载失败'));
          };
          img.src = base64Data;
        };
        reader.onerror = () => {
          reject(new Error('读取文件失败'));
        };
        reader.readAsDataURL(file);
      } catch (error) {
        reject(error);
      }
    });
  },
  
  /**
   * 压缩图片以适应API要求
   * @param imageContent 原始图片内容
   * @param maxSize 最大尺寸（KB）
   * @returns Promise<ImageContent> 压缩后的图片内容
   */
  async compressImage(imageContent: ImageContent, maxSize: number = 1024): Promise<ImageContent> {
    return new Promise((resolve, reject) => {
      try {
        if (!imageContent.base64Data) {
          resolve(imageContent);
          return;
        }
        
        const img = new Image();
        img.onload = () => {
          // 计算原始大小（KB）
          const originalSize = Math.round((imageContent.base64Data?.length || 0) * 0.75 / 1024);
          
          // 如果已经小于最大尺寸，直接返回
          if (originalSize <= maxSize) {
            resolve({
              ...imageContent,
              width: img.width,
              height: img.height
            });
            return;
          }
          
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            reject(new Error('无法创建Canvas上下文'));
            return;
          }
          
          // 硅基流动API图片尺寸限制：最大支持3584×3584像素，最小为56×56像素
          const MAX_DIMENSION = 2048; // 设置一个安全的最大值
          const MIN_DIMENSION = 56;
          
          // 计算新尺寸，保持宽高比
          let width = img.width;
          let height = img.height;
          
          // 确保尺寸在API允许的范围内
          if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
            if (width > height) {
              height = Math.round(height * MAX_DIMENSION / width);
              width = MAX_DIMENSION;
            } else {
              width = Math.round(width * MAX_DIMENSION / height);
              height = MAX_DIMENSION;
            }
          }
          
          // 确保尺寸不小于最小值
          if (width < MIN_DIMENSION) width = MIN_DIMENSION;
          if (height < MIN_DIMENSION) height = MIN_DIMENSION;
          
          canvas.width = width;
          canvas.height = height;
          
          // 清空画布并绘制图像
          ctx.clearRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          
          // 调整压缩质量以满足大小要求
          let quality = 0.85;
          if (originalSize > maxSize * 2) {
            quality = 0.7;
          } else if (originalSize > maxSize * 5) {
            quality = 0.5;
          }
          
          // 将图片转换为JPEG格式以减小尺寸
          let compressedBase64 = canvas.toDataURL('image/jpeg', quality);
          let currentSize = Math.round(compressedBase64.length * 0.75 / 1024);
          
          // 如果仍然太大，继续压缩
          let attempts = 0;
          while (currentSize > maxSize && attempts < 5) {
            attempts++;
            quality *= 0.8;
            compressedBase64 = canvas.toDataURL('image/jpeg', quality);
            currentSize = Math.round(compressedBase64.length * 0.75 / 1024);
          }
          
          console.log(`图片压缩：原始大小=${originalSize}KB, 压缩后=${currentSize}KB, 质量=${quality}, 尺寸=${width}x${height}`);
          
          resolve({
            ...imageContent,
            base64Data: compressedBase64,
            mimeType: 'image/jpeg',
            width,
            height,
            size: currentSize * 1024,
          });
        };
        
        img.onerror = () => {
          reject(new Error('图片加载失败'));
        };
        
        img.src = imageContent.base64Data;
      } catch (error) {
        reject(error);
      }
    });
  },
  
  /**
   * 确保图片格式正确，在不同场景下可能需要不同格式
   * @param imageContent 图片内容
   * @returns 格式化后的图片内容
   */
  ensureCorrectFormat(imageContent: ImageContent): ImageContent {
    // 如果没有base64数据，直接返回原始图片
    if (!imageContent.base64Data) return imageContent;
    
    // 确保base64数据包含正确的前缀
    if (!imageContent.base64Data.startsWith('data:')) {
      const mimeType = imageContent.mimeType || 'image/jpeg';
      return {
        ...imageContent,
        base64Data: `data:${mimeType};base64,${imageContent.base64Data}`
      };
    }
    
    // 如果没有宽高信息，尝试从已有图片中获取，但不等待Promise
    if ((!imageContent.width || !imageContent.height) && imageContent.base64Data) {
      // 这是一个副作用，我们不等待它完成，也不改变返回类型
      const img = new Image();
      img.onload = () => {
        // 这里不修改原始对象，因为它可能已经被使用
        // 只是记录一下，以便将来可能的优化
        console.log(`获取到图片尺寸: ${img.width}x${img.height}`);
      };
      img.src = imageContent.base64Data;
    }
    
    return imageContent;
  },
  
  /**
   * 从Base64提取原始二进制数据
   * @param base64Data Base64编码的图片数据
   * @returns Uint8Array 二进制数据
   */
  base64ToUint8Array(base64Data: string): Uint8Array {
    // 移除data URL前缀
    const base64 = base64Data.split(',')[1];
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    return bytes;
  }
};

export default ImageUploadService; 