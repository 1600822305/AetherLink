import React, { useState, useRef, useEffect } from 'react';
import { Box, CircularProgress, IconButton } from '@mui/material';
import { Maximize2 as ZoomOutMapIcon, AlertCircle as ErrorOutlineIcon } from 'lucide-react';

interface LazyImageProps {
  src: string;
  alt?: string;
  width?: string | number;
  height?: string | number;
  maxHeight?: string | number;
  objectFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
  onClick?: () => void;
  onLoad?: () => void;
  onError?: () => void;
  showZoom?: boolean;
  className?: string;
  style?: React.CSSProperties;
  placeholderHeight?: string | number;
}

/**
 * 懒加载图片组件
 * 使用IntersectionObserver实现图片懒加载
 */
const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt = '',
  width = '100%',
  height = 'auto',
  maxHeight = '240px',
  objectFit = 'contain',
  onClick,
  onLoad,
  onError,
  showZoom = true,
  className,
  style,
  placeholderHeight = '180px',
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [imageSrc, setImageSrc] = useState<string>('');
  const imgRef = useRef<HTMLImageElement>(null);
  const observer = useRef<IntersectionObserver | null>(null);

  // 处理图片加载完成
  const handleImageLoad = () => {
    setLoading(false);
    onLoad?.();
  };

  // 处理图片加载错误
  const handleImageError = () => {
    setLoading(false);
    setError(true);
    onError?.();
  };

  // 处理图片点击
  const handleImageClick = () => {
    if (!loading && !error && onClick) {
      onClick();
    }
  };

  // 设置懒加载
  useEffect(() => {
    if (!imgRef.current) return;

    observer.current = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          // 图片进入视口，加载图片
          setImageSrc(src);
          observer.current?.unobserve(entry.target);
        }
      },
      {
        root: null,
        threshold: 0.1,
        rootMargin: '100px',
      }
    );

    observer.current.observe(imgRef.current);

    return () => {
      if (imgRef.current && observer.current) {
        observer.current.unobserve(imgRef.current);
      }
    };
  }, [src]);

  return (
    <Box
      className={className}
      sx={{
        position: 'relative',
        width,
        height: loading ? placeholderHeight : height,
        maxHeight,
        overflow: 'hidden',
        borderRadius: '4px',
        ...style,
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
            backgroundColor: 'rgba(0, 0, 0, 0.03)',
          }}
        >
          <CircularProgress size={24} />
        </Box>
      )}

      {error ? (
        <Box
          sx={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.03)',
            color: 'text.secondary',
          }}
        >
          <ErrorOutlineIcon size={24} />
          <Box sx={{ mt: 1, fontSize: '0.75rem' }}>图片加载失败</Box>
        </Box>
      ) : (
        <Box sx={{ position: 'relative', height: '100%' }}>
          <img
            ref={imgRef}
            src={imageSrc}
            alt={alt}
            style={{
              width: '100%',
              height: '100%',
              objectFit,
              cursor: onClick ? 'pointer' : 'default',
              opacity: loading ? 0 : 1,
              transition: 'opacity 0.3s ease',
            }}
            onLoad={handleImageLoad}
            onError={handleImageError}
            onClick={handleImageClick}
          />
          {!loading && showZoom && onClick && (
            <IconButton
              size="small"
              onClick={onClick}
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
          )}
        </Box>
      )}
    </Box>
  );
};

export default React.memo(LazyImage);
