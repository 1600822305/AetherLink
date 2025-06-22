import type { FileContent } from '../types';
import { Capacitor } from '@capacitor/core';
import { FilePicker } from '@capawesome/capacitor-file-picker';
import { Toast } from '@capacitor/toast';
import { mobileFileStorage } from './MobileFileStorageService';

// 最大文件大小限制（50MB）
const MAX_FILE_SIZE = 50 * 1024 * 1024;

/**
 * 文件上传服务
 * 处理文件选择、转换和管理
 */
export const FileUploadService = {
  /**
   * 选择文件
   * @returns Promise<FileContent[]> 选择的文件内容数组
   */
  async selectFiles(): Promise<FileContent[]> {
    try {
      // 检查当前是否在移动设备上
      const isNative = Capacitor.isNativePlatform();

      if (isNative) {
        // 在移动设备上使用Capacitor FilePicker
        const result = await FilePicker.pickFiles({
          // 只读取一个文件，但将来可以根据需求支持多个
          // multiple: true, // FilePicker不支持multiple参数
          // 允许所有类型的文件
          readData: true,
        });

        if (!result || !result.files || result.files.length === 0) {
          return [];
        }

        // 处理文件
        const fileContents: FileContent[] = [];

        for (const file of result.files) {
          // 检查文件大小
          if (file.size > MAX_FILE_SIZE) {
            await Toast.show({
              text: `文件 ${file.name} 太大，最大允许50MB`,
              duration: 'long'
            });
            continue;
          }

          // 使用新的文件存储服务处理文件
          try {
            const uploadedFile = await mobileFileStorage.uploadFile({
              name: file.name,
              mimeType: file.mimeType,
              size: file.size,
              base64Data: file.data ? `data:${file.mimeType};base64,${file.data}` : ''
            });

            // 创建FileContent对象
            const fileContent: FileContent = {
              name: file.name,
              mimeType: file.mimeType,
              extension: file.name.split('.').pop() || '',
              size: file.size,
              base64Data: uploadedFile.base64Data ? `data:${file.mimeType};base64,${uploadedFile.base64Data}` : undefined,
              url: '',
              fileId: uploadedFile.id,
              fileRecord: uploadedFile
            };

            // 如果是图片文件，添加宽高信息
            if (file.mimeType.startsWith('image/') && uploadedFile.base64Data) {
              try {
                const dimensions = await this.getImageDimensions(`data:${file.mimeType};base64,${uploadedFile.base64Data}`);
                fileContent.width = dimensions.width;
                fileContent.height = dimensions.height;
              } catch (error) {
                console.warn('获取图片尺寸失败:', error);
              }
            }

            fileContents.push(fileContent);
          } catch (uploadError) {
            console.error('文件上传失败:', uploadError);
            await Toast.show({
              text: `文件 ${file.name} 上传失败: ${uploadError instanceof Error ? uploadError.message : '未知错误'}`,
              duration: 'long'
            });
          }
        }

        return fileContents;
      } else {
        // 在Web环境中使用文件选择器
        return new Promise((resolve, reject) => {
          const input = document.createElement('input');
          input.type = 'file';
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
              const validFiles = Array.from(files).filter(file => {
                if (file.size > MAX_FILE_SIZE) {
                  alert(`文件 ${file.name} 太大，最大允许50MB`);
                  return false;
                }
                return true;
              });

              if (validFiles.length === 0) {
                resolve([]);
                return;
              }

              const fileContents = [];
              for (const file of validFiles) {
                try {
                  // 直接使用文件存储服务处理文件，避免重复处理
                  const uploadedFile = await mobileFileStorage.uploadFile({
                    name: file.name,
                    mimeType: file.type,
                    size: file.size,
                    base64Data: await this.readFileAsBase64(file)
                  });

                  // 创建FileContent对象
                  const fileContent: FileContent = {
                    name: file.name,
                    mimeType: file.type,
                    extension: file.name.split('.').pop() || '',
                    size: file.size,
                    base64Data: uploadedFile.base64Data ? `data:${file.type};base64,${uploadedFile.base64Data}` : undefined,
                    url: '',
                    fileId: uploadedFile.id,
                    fileRecord: uploadedFile
                  };

                  // 如果是图片文件，添加宽高信息
                  if (file.type.startsWith('image/') && uploadedFile.base64Data) {
                    try {
                      const dimensions = await this.getImageDimensions(`data:${file.type};base64,${uploadedFile.base64Data}`);
                      fileContent.width = dimensions.width;
                      fileContent.height = dimensions.height;
                    } catch (error) {
                      console.warn('获取图片尺寸失败:', error);
                    }
                  }

                  fileContents.push(fileContent);
                } catch (uploadError) {
                  console.error('文件上传失败:', uploadError);
                  alert(`文件 ${file.name} 上传失败: ${uploadError instanceof Error ? uploadError.message : '未知错误'}`);
                }
              }
              resolve(fileContents);
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
      console.error('选择文件失败:', error);
      await Toast.show({
        text: '选择文件失败: ' + (error instanceof Error ? error.message : String(error)),
        duration: 'long'
      });
      throw error;
    }
  },



  /**
   * 根据MIME类型获取文件图标
   * @param mimeType 文件MIME类型
   * @returns 文件图标名称
   */
  getFileIconByMimeType(mimeType: string): string {
    if (mimeType.startsWith('image/')) {
      return 'image';
    } else if (mimeType.startsWith('video/')) {
      return 'video';
    } else if (mimeType.startsWith('audio/')) {
      return 'audio';
    } else if (mimeType.includes('pdf')) {
      return 'picture_as_pdf';
    } else if (mimeType.includes('word') || mimeType.includes('document')) {
      return 'description';
    } else if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) {
      return 'table_chart';
    } else if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) {
      return 'slideshow';
    } else if (mimeType.includes('text/')) {
      return 'text_snippet';
    } else {
      return 'insert_drive_file';
    }
  },

  /**
   * 读取文件为base64格式
   * @param file 文件对象
   * @returns Promise<string> base64数据（包含data:前缀）
   */
  async readFileAsBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (!event.target || !event.target.result) {
          reject(new Error('读取文件失败'));
          return;
        }
        resolve(event.target.result as string);
      };
      reader.onerror = () => {
        reject(new Error('读取文件失败'));
      };
      reader.readAsDataURL(file);
    });
  },

  /**
   * 获取图片尺寸
   * @param base64Data base64图片数据
   * @returns Promise<{width: number, height: number}> 图片尺寸
   */
  async getImageDimensions(base64Data: string): Promise<{width: number, height: number}> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.width, height: img.height });
      };
      img.onerror = () => {
        reject(new Error('图片加载失败'));
      };
      img.src = base64Data;
    });
  },

  /**
   * 格式化文件大小
   * @param bytes 文件大小（字节）
   * @returns 格式化后的文件大小字符串
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';

    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));

    return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + sizes[i];
  }
};