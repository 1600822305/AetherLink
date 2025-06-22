import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Box, CircularProgress, IconButton, Dialog } from '@mui/material';
import { Maximize2 as ZoomOutMapIcon, X as CloseIcon, AlertCircle as ErrorOutlineIcon } from 'lucide-react';
import type { ImageContent as ImageContentType } from '../../shared/types';
import { dexieStorage } from '../../shared/services/storage/DexieStorageService';

interface ImageContentProps {
  image: ImageContentType;
  index: number;
}

const ImageContent: React.FC<ImageContentProps> = ({ image, index }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);
  const [imgSrc, setImgSrc] = useState<string>('');
  const imgRef = useRef<HTMLImageElement>(null);
  const observer = useRef<IntersectionObserver | null>(null);

  // 从图片引用加载图片
  const loadImageFromReference = useCallback(async (id: string) => {
    try {
      // 检查是否已有缓存
      const cachedUrl = sessionStorage.getItem(`img_cache_${id}`);
      if (cachedUrl) {
        setImgSrc(cachedUrl);
        return;
      }

      // 获取图片Blob
      const blob = await dexieStorage.getImageBlob(id);
      if (!blob) {
        throw new Error('图片不存在');
      }

      // 获取图片元数据
      const metadata = await dexieStorage.getImageMetadata(id);
      console.debug('Image metadata loaded:', metadata);

      // 创建Blob URL
      const url = URL.createObjectURL(blob);

      // 缓存到sessionStorage
      sessionStorage.setItem(`img_cache_${id}`, url);

      // 设置图片源
      setImgSrc(url);

      // 预加载高清图片（如果是在预览模式）
      if (!open) {
        const img = new Image();
        img.src = url;
      }
    } catch (error) {
      console.error('从引用加载图片失败:', error);
      setError(true);
      setLoading(false);
    }
  }, [open]);

  // 判断是否为图片引用 (格式为 [图片:ID])
  useEffect(() => {
    const checkImageReference = async () => {
  // 使用base64数据或URL
      if (image.base64Data) {
        setImgSrc(image.base64Data);
        return;
      } else if (image.url) {
        // 检查URL是否为图片引用格式 [图片:ID]
        const refMatch = image.url.match(/\[图片:([a-zA-Z0-9_-]+)\]/);
        if (refMatch && refMatch[1]) {
          try {
            // 从DataService获取图片
            await loadImageFromReference(refMatch[1]);
          } catch (err) {
            console.error('加载图片引用失败:', err);
            setError(true);
            setLoading(false);
          }
        } else {
          setImgSrc(image.url);
        }
      }
    };

    checkImageReference();
  }, [image, loadImageFromReference, open]);

  // 图片懒加载
  useEffect(() => {
    const currentImg = imgRef.current;
    if (!currentImg) return;

    observer.current = new IntersectionObserver((entries) => {
      const [entry] = entries;
      if (entry.isIntersecting) {
        // 图片进入视口，加载图片
        if (currentImg && currentImg.getAttribute('data-src')) {
          currentImg.src = currentImg.getAttribute('data-src') || '';
          observer.current?.unobserve(currentImg);
        }
      }
    }, {
      root: null,
      threshold: 0.1,
      rootMargin: '100px'
    });

    observer.current.observe(currentImg);

    return () => {
      if (currentImg && observer.current) {
        observer.current.unobserve(currentImg);
      }
    };
  }, [imgSrc]);



  const handleOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleImageLoad = () => {
    setLoading(false);
  };

  const handleImageError = () => {
    setLoading(false);
    setError(true);
  };

  return (
    <>
      <Box
        sx={{
          position: 'relative',
          margin: '4px 0',
          borderRadius: 2,
          overflow: 'hidden',
          maxWidth: '240px',
          maxHeight: '240px',
          backgroundColor: '#f0f0f0',
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
        }}
      >
        {loading && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(240, 240, 240, 0.8)',
              zIndex: 1,
            }}
          >
            <CircularProgress size={24} />
          </Box>
        )}

        {error ? (
          <Box
            sx={{
              width: '100%',
              height: '120px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#f0f0f0',
              color: '#ff5252',
            }}
          >
            <ErrorOutlineIcon />
            <Box sx={{ mt: 1, fontSize: '0.75rem' }}>图片加载失败</Box>
          </Box>
        ) : (
          <Box sx={{ position: 'relative' }}>
            <img
              ref={imgRef}
              src={imgSrc}
              alt={`上传图片 ${index + 1}`}
              style={{
                width: '100%',
                maxHeight: '240px',
                objectFit: 'contain',
                cursor: 'pointer',
                opacity: loading ? 0 : 1, // 加载时透明
                transition: 'opacity 0.3s ease', // 平滑过渡
              }}
              loading="lazy" // 原生懒加载
              onLoad={handleImageLoad}
              onError={handleImageError}
              onClick={handleOpen}
            />
            <IconButton
              size="small"
              onClick={handleOpen}
              sx={{
                position: 'absolute',
                right: 8,
                bottom: 8,
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                color: 'white',
                '&:hover': {
                  backgroundColor: 'rgba(0, 0, 0, 0.7)',
                },
                width: 28,
                height: 28,
                padding: 0.5,
              }}
            >
              <ZoomOutMapIcon size={16} />
            </IconButton>
          </Box>
        )}
      </Box>

      {/* 图片预览对话框 */}
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="xl"
        slotProps={{
          paper: {
            style: {
              backgroundColor: 'transparent',
              boxShadow: 'none',
              overflow: 'hidden',
              margin: 0,
              padding: 0,
            },
          },
        }}
      >
        <Box
          sx={{
            position: 'relative',
            width: '100vw',
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            padding: 2,
          }}
          onClick={handleClose}
        >
          <IconButton
            onClick={handleClose}
            sx={{
              position: 'absolute',
              top: 16,
              right: 16,
              color: 'white',
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              '&:hover': {
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
              },
            }}
          >
            <CloseIcon />
          </IconButton>
          <img
            src={imgSrc}
            alt={`上传图片 ${index + 1}`}
            style={{
              maxWidth: '90vw',
              maxHeight: '90vh',
              objectFit: 'contain',
            }}
            onClick={(e) => e.stopPropagation()}
          />
        </Box>
      </Dialog>
    </>
  );
};

export default ImageContent;