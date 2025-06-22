import React, { useState, useCallback, useEffect } from 'react';
import { Box, Collapse, IconButton, Typography, useTheme } from '@mui/material';
import { ChevronDown as ExpandMoreIcon, ChevronUp as ExpandLessIcon } from 'lucide-react';
import FilePreview from './FilePreview';
import type { FileStatus } from './FilePreview';
import type { FileContent, ImageContent } from '../shared/types';
import { dexieStorage } from '../shared/services/storage/DexieStorageService';

interface IntegratedFilePreviewProps {
  files: FileContent[];
  images: ImageContent[];
  onRemoveFile: (index: number) => void;
  onRemoveImage: (index: number) => void;
  fileStatuses?: Record<string, { status: FileStatus; progress?: number; error?: string }>;
  compact?: boolean;
  maxVisibleItems?: number;
}

const IntegratedFilePreview: React.FC<IntegratedFilePreviewProps> = ({
  files,
  images,
  onRemoveFile,
  onRemoveImage,
  fileStatuses = {},
  compact = true,
  maxVisibleItems = 3
}) => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});

  // 当图片数组变化时，清理无效的缓存
  useEffect(() => {
    setImageUrls(prev => {
      const newImageUrls: Record<string, string> = {};
      // 只保留当前存在的图片的缓存
      images.forEach((_, index) => {
        const key = index.toString();
        if (prev[key]) {
          newImageUrls[key] = prev[key];
        }
      });
      return newImageUrls;
    });
  }, [images.length]); // 当图片数量变化时触发

  // 处理图片引用格式的加载
  const loadImageFromReference = useCallback(async (imageId: string, imageIndex: number) => {
    try {
      // 检查缓存
      const cacheKey = `img_cache_${imageId}`;
      const cachedUrl = sessionStorage.getItem(cacheKey);
      if (cachedUrl) {
        setImageUrls(prev => ({ ...prev, [imageIndex]: cachedUrl }));
        return;
      }

      // 从数据库获取图片Blob
      const blob = await dexieStorage.getImageBlob(imageId);
      if (!blob) {
        console.warn('图片不存在:', imageId);
        return;
      }

      // 创建Blob URL
      const url = URL.createObjectURL(blob);

      // 缓存到sessionStorage
      sessionStorage.setItem(cacheKey, url);

      // 更新状态
      setImageUrls(prev => ({ ...prev, [imageIndex]: url }));
    } catch (error) {
      console.error('加载图片引用失败:', error);
    }
  }, []);

  // 获取图片显示URL
  const getImageSrc = useCallback((image: ImageContent, index: number) => {
    // 优先使用base64数据
    if (image.base64Data) {
      return image.base64Data;
    }

    // 检查是否为图片引用格式
    if (image.url) {
      const refMatch = image.url.match(/\[图片:([a-zA-Z0-9_-]+)\]/);
      if (refMatch && refMatch[1]) {
        const imageId = refMatch[1];
        // 如果还没有加载，触发加载
        if (!imageUrls[index]) {
          loadImageFromReference(imageId, index);
          return ''; // 返回空字符串，显示加载状态
        }
        return imageUrls[index];
      }
      return image.url;
    }

    return '';
  }, [imageUrls, loadImageFromReference]);

  const totalItems = files.length + images.length;
  const hasItems = totalItems > 0;
  const hasMoreItems = totalItems > maxVisibleItems;
  const visibleFiles = expanded ? files : files.slice(0, Math.max(0, maxVisibleItems - images.length));
  const visibleImages = expanded ? images : images.slice(0, maxVisibleItems);

  if (!hasItems) return null;

  return (
    <Box
      sx={{
        width: '100%',
        marginBottom: '8px',
        borderRadius: '12px',
        backgroundColor: theme.palette.background.paper,
        border: `1px solid ${theme.palette.divider}`,
        overflow: 'hidden',
        transition: 'all 0.3s ease'
      }}
    >
      {/* 头部信息 */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          backgroundColor: theme.palette.action.hover,
          borderBottom: `1px solid ${theme.palette.divider}`
        }}
      >
        <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 500 }}>
          {totalItems} 个文件已选择
        </Typography>

        {hasMoreItems && (
          <IconButton
            size="small"
            onClick={() => setExpanded(!expanded)}
            sx={{
              padding: '2px',
              color: theme.palette.text.secondary,
              '&:hover': {
                backgroundColor: theme.palette.action.hover,
              }
            }}
          >
            {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
          </IconButton>
        )}
      </Box>

      {/* 文件预览内容 */}
      <Box sx={{ padding: '8px' }}>
        {/* 图片预览 */}
        {visibleImages.length > 0 && (
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '6px',
              marginBottom: visibleFiles.length > 0 ? '8px' : 0
            }}
          >
            {visibleImages.map((image, index) => {
              // 优先使用图片的唯一 ID，避免第三个图片重复显示问题
              const imageKey = image.id || `image-${index}-${image.name || 'unnamed'}-${image.size || Date.now()}`;
              const imageSrc = getImageSrc(image, index);

              return (
                <Box
                  key={imageKey}
                  sx={{
                    position: 'relative',
                    width: '48px',
                    height: '48px',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    border: '1px solid rgba(0, 0, 0, 0.1)',
                    backgroundColor: !imageSrc ? 'rgba(0, 0, 0, 0.05)' : 'transparent'
                  }}
                >
                  {imageSrc ? (
                    <img
                      src={imageSrc}
                      alt={`预览 ${index + 1}`}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                      }}
                      onError={(e) => {
                        // 图片加载失败时的处理
                        console.warn('图片加载失败:', image);
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <Box
                      sx={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        color: 'rgba(0, 0, 0, 0.5)'
                      }}
                    >
                      加载中...
                    </Box>
                  )}
                  <IconButton
                    size="small"
                    onClick={() => onRemoveImage(index)}
                    sx={{
                      position: 'absolute',
                      top: -6,
                      right: -6,
                      backgroundColor: 'rgba(0, 0, 0, 0.7)',
                      color: 'white',
                      padding: '2px',
                      width: '16px',
                      height: '16px',
                      '&:hover': {
                        backgroundColor: 'rgba(244, 67, 54, 0.8)',
                      },
                    }}
                  >
                    <ExpandMoreIcon size={10} style={{ transform: 'rotate(45deg)' }} />
                  </IconButton>
                </Box>
              );
            })}
          </Box>
        )}

        {/* 文件预览 */}
        {visibleFiles.length > 0 && (
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '4px'
            }}
          >
            {visibleFiles.map((file, index) => {
              const fileKey = `${file.name}-${file.size}`;
              const fileStatus = fileStatuses[fileKey];
              // 优先使用文件的唯一 ID，避免第三个文件重复显示问题
              const uniqueFileKey = file.id || `file-${index}-${file.name}-${file.size || Date.now()}`;

              return (
                <FilePreview
                  key={uniqueFileKey}
                  file={file}
                  onRemove={() => onRemoveFile(index)}
                  compact={compact}
                  status={fileStatus?.status}
                  progress={fileStatus?.progress}
                  error={fileStatus?.error}
                  draggable={false}
                />
              );
            })}
          </Box>
        )}

        {/* 折叠的额外内容 */}
        <Collapse in={expanded}>
          <Box sx={{ marginTop: '8px' }}>
            {/* 显示剩余的图片 */}
            {images.length > maxVisibleItems && (
              <Box
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '6px',
                  marginBottom: '8px'
                }}
              >
                {images.slice(maxVisibleItems).map((image, index) => {
                  const actualIndex = maxVisibleItems + index;
                  // 优先使用图片的唯一 ID，避免重复显示问题
                  const extraImageKey = image.id ? `extra-${image.id}` : `extra-image-${actualIndex}-${image.name || 'unnamed'}-${image.size || Date.now()}`;
                  const imageSrc = getImageSrc(image, actualIndex);

                  return (
                    <Box
                      key={extraImageKey}
                      sx={{
                        position: 'relative',
                        width: '48px',
                        height: '48px',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        border: '1px solid rgba(0, 0, 0, 0.1)',
                        backgroundColor: !imageSrc ? 'rgba(0, 0, 0, 0.05)' : 'transparent'
                      }}
                    >
                      {imageSrc ? (
                        <img
                          src={imageSrc}
                          alt={`预览 ${actualIndex + 1}`}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover'
                          }}
                          onError={(e) => {
                            // 图片加载失败时的处理
                            console.warn('图片加载失败:', image);
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : (
                        <Box
                          sx={{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '12px',
                            color: 'rgba(0, 0, 0, 0.5)'
                          }}
                        >
                          加载中...
                        </Box>
                      )}
                      <IconButton
                        size="small"
                        onClick={() => onRemoveImage(actualIndex)}
                        sx={{
                          position: 'absolute',
                          top: -6,
                          right: -6,
                          backgroundColor: 'rgba(0, 0, 0, 0.7)',
                          color: 'white',
                          padding: '2px',
                          width: '16px',
                          height: '16px',
                          '&:hover': {
                            backgroundColor: 'rgba(244, 67, 54, 0.8)',
                          },
                        }}
                      >
                        <ExpandMoreIcon size={10} style={{ transform: 'rotate(45deg)' }} />
                      </IconButton>
                    </Box>
                  );
                })}
              </Box>
            )}

            {/* 显示剩余的文件 */}
            {files.length > Math.max(0, maxVisibleItems - images.length) && (
              <Box
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '4px'
                }}
              >
                {files.slice(Math.max(0, maxVisibleItems - images.length)).map((file, index) => {
                  const fileKey = `${file.name}-${file.size}`;
                  const fileStatus = fileStatuses[fileKey];
                  const actualIndex = Math.max(0, maxVisibleItems - images.length) + index;
                  // 优先使用文件的唯一 ID，避免重复显示问题
                  const extraFileKey = file.id ? `extra-${file.id}` : `extra-file-${actualIndex}-${file.name}-${file.size || Date.now()}`;

                  return (
                    <FilePreview
                      key={extraFileKey}
                      file={file}
                      onRemove={() => onRemoveFile(actualIndex)}
                      compact={compact}
                      status={fileStatus?.status}
                      progress={fileStatus?.progress}
                      error={fileStatus?.error}
                      draggable={false}
                    />
                  );
                })}
              </Box>
            )}
          </Box>
        </Collapse>
      </Box>
    </Box>
  );
};

export default IntegratedFilePreview;
