import { useState, useCallback } from 'react';
import type { ImageContent, FileContent } from '../types';
import type { FileStatus } from '../../components/preview/FilePreview';

/**
 * 文件状态记录类型
 */
export interface FileStatusRecord {
  status: FileStatus;
  progress?: number;
  error?: string;
}

/**
 * useInputState 返回类型
 */
export interface UseInputStateReturn {
  // 图片状态
  images: ImageContent[];
  setImages: React.Dispatch<React.SetStateAction<ImageContent[]>>;
  
  // 文件状态
  files: FileContent[];
  setFiles: React.Dispatch<React.SetStateAction<FileContent[]>>;
  
  // 上传中状态
  uploadingMedia: boolean;
  setUploadingMedia: React.Dispatch<React.SetStateAction<boolean>>;
  
  // 文件状态管理
  fileStatuses: Record<string, FileStatusRecord>;
  setFileStatuses: React.Dispatch<React.SetStateAction<Record<string, FileStatusRecord>>>;
  
  // 知识库刷新标记
  knowledgeRefreshKey: number;
  setKnowledgeRefreshKey: React.Dispatch<React.SetStateAction<number>>;
  
  // 辅助方法
  clearAllMedia: () => void;
  hasMedia: boolean;
  refreshKnowledge: () => void;
}

/**
 * 输入框共享状态Hook
 * 统一管理图片、文件、上传状态、文件状态、Toast消息和知识库刷新状态
 */
export function useInputState(): UseInputStateReturn {
  // 图片状态
  const [images, setImages] = useState<ImageContent[]>([]);
  
  // 文件状态
  const [files, setFiles] = useState<FileContent[]>([]);
  
  // 上传中状态
  const [uploadingMedia, setUploadingMedia] = useState(false);
  
  // 文件状态管理
  const [fileStatuses, setFileStatuses] = useState<Record<string, FileStatusRecord>>({});
  
  // 知识库状态刷新标记
  const [knowledgeRefreshKey, setKnowledgeRefreshKey] = useState(0);

  // 知识库选择状态现在通过 Redux knowledgeSelectionSlice 管理
  // 状态变化会自动触发组件重渲染，无需手动监听事件

  // 清空所有媒体内容
  const clearAllMedia = useCallback(() => {
    setImages([]);
    setFiles([]);
    setUploadingMedia(false);
    setFileStatuses({});
  }, []);

  // 是否有媒体内容
  const hasMedia = images.length > 0 || files.length > 0;

  // 刷新知识库显示
  const refreshKnowledge = useCallback(() => {
    setKnowledgeRefreshKey(prev => prev + 1);
  }, []);

  return {
    // 图片状态
    images,
    setImages,
    
    // 文件状态
    files,
    setFiles,
    
    // 上传中状态
    uploadingMedia,
    setUploadingMedia,
    
    // 文件状态管理
    fileStatuses,
    setFileStatuses,
    
    // 知识库刷新标记
    knowledgeRefreshKey,
    setKnowledgeRefreshKey,
    
    // 辅助方法
    clearAllMedia,
    hasMedia,
    refreshKnowledge
  };
}

export default useInputState;