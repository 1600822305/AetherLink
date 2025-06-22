import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../../shared/store';
import { useFileUpload } from '../../../shared/hooks/useFileUpload';
import type { ImageContent, FileContent } from '../../../shared/types';
import type { FileStatus } from '../../FilePreview';
import IntegratedFilePreview from '../../IntegratedFilePreview';
import { toastManager } from '../../EnhancedToast';
import { dexieStorage } from '../../../shared/services/storage/DexieStorageService';

interface FileUploadManagerProps {
  images: ImageContent[];
  files: FileContent[];
  setImages: React.Dispatch<React.SetStateAction<ImageContent[]>>;
  setFiles: React.Dispatch<React.SetStateAction<FileContent[]>>;
  setUploadingMedia: React.Dispatch<React.SetStateAction<boolean>>;
  fileStatuses: Record<string, { status: FileStatus; progress?: number; error?: string }>;
  setFileStatuses: React.Dispatch<React.SetStateAction<Record<string, { status: FileStatus; progress?: number; error?: string }>>>;
  isDarkMode: boolean;
  isMobile: boolean;
  borderRadius: string;
}

export interface FileUploadManagerRef {
  handleImageUpload: (source?: 'camera' | 'photos') => Promise<void>;
  handleFileUpload: () => Promise<void>;
  handlePaste: (e: React.ClipboardEvent) => Promise<void>;
}

const FileUploadManager = forwardRef<FileUploadManagerRef, FileUploadManagerProps>(({
  images,
  files,
  setImages,
  setFiles,
  setUploadingMedia,
  fileStatuses,
  setFileStatuses,
  isDarkMode,
  isMobile,
  borderRadius
}, ref) => {
  // 拖拽状态
  const [isDragging, setIsDragging] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);

  // 获取当前话题状态
  const currentTopicId = useSelector((state: RootState) => state.messages.currentTopicId);
  const [currentTopicState, setCurrentTopicState] = useState<any>(null);

  // 获取设置状态
  const settings = useSelector((state: RootState) => state.settings);

  // 文件上传功能
  const { handleImageUpload, handleFileUpload } = useFileUpload({
    currentTopicState,
    setUploadingMedia
  });

  // 当话题ID变化时，从数据库获取话题信息
  useEffect(() => {
    const loadTopic = async () => {
      if (!currentTopicId) return;

      try {
        const topic = await dexieStorage.getTopic(currentTopicId);
        if (topic) {
          setCurrentTopicState(topic);
        }
      } catch (error) {
        console.error('加载话题信息失败:', error);
      }
    };

    loadTopic();
  }, [currentTopicId]);

  // 文件上传处理函数 - 包装 hook 提供的函数以更新本地状态
  const handleImageUploadLocal = async (source: 'camera' | 'photos' = 'photos') => {
    try {
      const uploadedImages = await handleImageUpload(source);
      // 只有当实际上传了图片时才更新状态
      if (uploadedImages && uploadedImages.length > 0) {
        setImages(prev => [...prev, ...uploadedImages]);
      }
    } catch (error) {
      console.error('图片上传失败:', error);
      // 确保在错误情况下重置上传状态
      setUploadingMedia(false);
    }
  };

  const handleFileUploadLocal = async () => {
    try {
      const uploadedFiles = await handleFileUpload();
      // 只有当实际上传了文件时才更新状态
      if (uploadedFiles && uploadedFiles.length > 0) {
        setFiles(prev => [...prev, ...uploadedFiles]);
      }
    } catch (error) {
      console.error('文件上传失败:', error);
      // 确保在错误情况下重置上传状态
      setUploadingMedia(false);
    }
  };

  // 暴露上传函数给父组件
  useImperativeHandle(ref, () => ({
    handleImageUpload: handleImageUploadLocal,
    handleFileUpload: handleFileUploadLocal,
    handlePaste: handlePaste
  }), []);

  // 删除已选择的图片
  const handleRemoveImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  // 删除已选择的文件
  const handleRemoveFile = (index: number) => {
    const fileToRemove = files[index];
    if (fileToRemove) {
      const fileKey = `${fileToRemove.name}-${fileToRemove.size}`;
      // 清理文件状态
      setFileStatuses(prev => {
        const newStatuses = { ...prev };
        delete newStatuses[fileKey];
        return newStatuses;
      });
    }
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  // 拖拽事件处理函数
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(prev => prev + 1);
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(prev => prev - 1);
    if (dragCounter <= 1) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setDragCounter(0);

    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length === 0) return;

    try {
      setUploadingMedia(true);

      for (const file of droppedFiles) {
        if (file.type.startsWith('image/')) {
          // 处理图片文件
          const reader = new FileReader();
          reader.onload = (event) => {
            const base64Data = event.target?.result as string;
            // 生成更唯一的 ID，避免重复显示问题
            const uniqueId = `img-${Date.now()}-${Math.random().toString(36).substring(2, 11)}-${file.name.replace(/[^a-zA-Z0-9]/g, '')}`;
            const newImage: ImageContent = {
              id: uniqueId,
              url: base64Data,
              base64Data: base64Data,
              mimeType: file.type,
              name: file.name,
              size: file.size
            };
            setImages(prev => [...prev, newImage]);
          };
          reader.readAsDataURL(file);
        } else {
          // 处理其他文件
          const reader = new FileReader();
          reader.onload = (event) => {
            const base64Data = event.target?.result as string;
            // 生成更唯一的 ID，避免重复显示问题
            const uniqueId = `file-${Date.now()}-${Math.random().toString(36).substring(2, 11)}-${file.name.replace(/[^a-zA-Z0-9]/g, '')}`;
            const newFile: FileContent = {
              id: uniqueId,
              name: file.name,
              mimeType: file.type,
              extension: (file.name && typeof file.name === 'string') ? (file.name.split('.').pop() || '') : '',
              size: file.size,
              base64Data: base64Data,
              url: ''
            };
            setFiles(prev => [...prev, newFile]);
          };
          reader.readAsDataURL(file);
        }
      }

      toastManager.show({
        message: `成功添加 ${droppedFiles.length} 个文件`,
        type: 'success',
        duration: 3000
      });
    } catch (error) {
      console.error('拖拽文件处理失败:', error);
      toastManager.show({
        message: '文件处理失败，请重试',
        type: 'error',
        duration: 3000
      });
    } finally {
      setUploadingMedia(false);
    }
  };

  // 剪贴板粘贴事件处理函数
  const handlePaste = async (e: React.ClipboardEvent) => {
    const clipboardData = e.clipboardData;
    if (!clipboardData) return;

    // 获取长文本粘贴设置
    const pasteLongTextAsFile = settings.pasteLongTextAsFile ?? false;
    const pasteLongTextThreshold = settings.pasteLongTextThreshold ?? 1500;

    // 优先处理文本粘贴（长文本转文件功能）
    const textData = clipboardData.getData('text');
    if (textData && pasteLongTextAsFile && textData.length > pasteLongTextThreshold) {
      e.preventDefault(); // 阻止默认粘贴行为

      try {
        setUploadingMedia(true);

        // 使用移动端文件存储服务创建文件
        const { MobileFileStorageService } = await import('../../../shared/services/MobileFileStorageService');
        const fileStorageService = MobileFileStorageService.getInstance();

        const fileName = `粘贴的文本_${new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')}.txt`;

        // 将文本转换为 base64 (支持中文等多字节字符)
        const encoder = new TextEncoder();
        const data = encoder.encode(textData);
        const base64Data = btoa(String.fromCharCode(...data));

        const fileData = {
          name: fileName,
          size: new Blob([textData], { type: 'text/plain' }).size,
          mimeType: 'text/plain',
          base64Data: `data:text/plain;base64,${base64Data}`
        };

        const fileRecord = await fileStorageService.uploadFile(fileData);

        // 转换为 FileContent 格式
        const fileContent = {
          name: fileRecord.origin_name,
          mimeType: fileRecord.mimeType || 'text/plain',
          extension: fileRecord.ext || '.txt',
          size: fileRecord.size,
          base64Data: fileRecord.base64Data,
          url: fileRecord.path || '',
          fileId: fileRecord.id,
          fileRecord: fileRecord
        };

        setFiles(prev => [...prev, fileContent]);

        toastManager.show({
          message: `长文本已转换为文件: ${fileName}`,
          type: 'success',
          duration: 3000
        });
      } catch (error) {
        console.error('长文本转文件失败:', error);
        toastManager.show({
          message: '长文本转文件失败，请重试',
          type: 'error',
          duration: 3000
        });
      } finally {
        setUploadingMedia(false);
      }
      return;
    }

    // 处理图片粘贴
    const items = Array.from(clipboardData.items);
    const imageItems = items.filter(item => item.type.startsWith('image/'));

    if (imageItems.length === 0) return;

    e.preventDefault(); // 阻止默认粘贴行为

    try {
      setUploadingMedia(true);

      for (const item of imageItems) {
        const file = item.getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const base64Data = event.target?.result as string;
            // 生成更唯一的 ID，避免重复显示问题
            const timestamp = Date.now();
            const uniqueId = `paste-img-${timestamp}-${Math.random().toString(36).substring(2, 11)}`;
            const newImage: ImageContent = {
              id: uniqueId,
              url: base64Data,
              base64Data: base64Data,
              mimeType: file.type,
              name: `粘贴的图片_${timestamp}.${file.type && typeof file.type === 'string' && file.type.includes('/') ? (file.type.split('/')[1] || 'png') : 'png'}`,
              size: file.size
            };
            setImages(prev => [...prev, newImage]);
          };
          reader.readAsDataURL(file);
        }
      }

      toastManager.show({
        message: `成功粘贴 ${imageItems.length} 张图片`,
        type: 'success',
        duration: 3000
      });
    } catch (error) {
      console.error('粘贴图片处理失败:', error);
      toastManager.show({
        message: '粘贴图片失败，请重试',
        type: 'error',
        duration: 3000
      });
    } finally {
      setUploadingMedia(false);
    }
  };

  return (
    <div
      style={{
        position: 'relative',
        width: '100%'
      }}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* 集成的文件预览区域 */}
      <IntegratedFilePreview
        files={files}
        images={images}
        onRemoveFile={handleRemoveFile}
        onRemoveImage={handleRemoveImage}
        fileStatuses={fileStatuses}
        compact={true}
        maxVisibleItems={isMobile ? 2 : 3}
      />

      {/* 拖拽覆盖层 */}
      {isDragging && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: isDarkMode ? 'rgba(33, 150, 243, 0.1)' : 'rgba(33, 150, 243, 0.05)',
          border: `2px dashed ${isDarkMode ? '#2196F3' : '#1976D2'}`,
          borderRadius: borderRadius,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1002,
          pointerEvents: 'none'
        }}>
          <div style={{
            color: isDarkMode ? '#2196F3' : '#1976D2',
            fontSize: '16px',
            fontWeight: 500,
            textAlign: 'center',
            padding: '20px'
          }}>
            📁 拖拽文件到这里上传
          </div>
        </div>
      )}


    </div>
  );
});

FileUploadManager.displayName = 'FileUploadManager';

export default FileUploadManager;
