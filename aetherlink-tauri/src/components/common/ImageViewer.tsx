import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Modal,
  IconButton,
  Typography,
  Slider,
  Tooltip
} from '@mui/material';
import {
  X as CloseIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  RotateCcw as RotateLeftIcon,
  RotateCw as RotateRightIcon,
  Download as DownloadIcon,
  ChevronLeft as NavigateBeforeIcon,
  ChevronRight as NavigateNextIcon
} from 'lucide-react';

interface ImageViewerProps {
  open: boolean;
  onClose: () => void;
  images: Array<{
    url: string;
    alt?: string;
    id?: string;
  }>;
  initialIndex?: number;
}

/**
 * 图片查看器组件
 * 用于查看和操作图片，支持缩放、旋转和下载
 */
const ImageViewer: React.FC<ImageViewerProps> = ({
  open,
  onClose,
  images,
  initialIndex = 0,
}) => {
  // 不需要使用主题
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // 重置图片状态
  const resetImageState = useCallback(() => {
    setScale(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  }, []);

  // 切换到指定索引的图片
  const goToImage = useCallback((index: number) => {
    resetImageState();
    setCurrentIndex(index);
  }, [resetImageState]);

  // 查看上一张图片
  const handlePrev = useCallback(() => {
    goToImage(currentIndex === 0 ? images.length - 1 : currentIndex - 1);
  }, [currentIndex, images.length, goToImage]);

  // 查看下一张图片
  const handleNext = useCallback(() => {
    goToImage(currentIndex === images.length - 1 ? 0 : currentIndex + 1);
  }, [currentIndex, images.length, goToImage]);

  // 放大图片
  const handleZoomIn = useCallback(() => {
    setScale(prev => Math.min(prev + 0.25, 5));
  }, []);

  // 缩小图片
  const handleZoomOut = useCallback(() => {
    setScale(prev => Math.max(prev - 0.25, 0.25));
  }, []);

  // 向左旋转图片
  const handleRotateLeft = useCallback(() => {
    setRotation(prev => (prev - 90) % 360);
  }, []);

  // 向右旋转图片
  const handleRotateRight = useCallback(() => {
    setRotation(prev => (prev + 90) % 360);
  }, []);

  // 下载图片
  const handleDownload = useCallback(() => {
    const image = images[currentIndex];
    if (!image) return;

    const link = document.createElement('a');
    link.href = image.url;
    link.download = image.alt || `image-${currentIndex + 1}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [currentIndex, images]);

  // 处理鼠标按下事件
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return; // 只处理左键点击
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  }, [position]);

  // 处理鼠标移动事件
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  }, [isDragging, dragStart]);

  // 处理鼠标释放事件
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // 处理键盘事件
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowLeft':
        handlePrev();
        break;
      case 'ArrowRight':
        handleNext();
        break;
      case 'Escape':
        onClose();
        break;
      case '+':
        handleZoomIn();
        break;
      case '-':
        handleZoomOut();
        break;
      case 'r':
        handleRotateRight();
        break;
      case 'l':
        handleRotateLeft();
        break;
      default:
        break;
    }
  }, [handlePrev, handleNext, onClose, handleZoomIn, handleZoomOut, handleRotateRight, handleRotateLeft]);

  // 添加键盘事件监听
  useEffect(() => {
    if (open) {
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [open, handleKeyDown]);

  // 当模态框关闭时重置状态
  useEffect(() => {
    if (!open) {
      resetImageState();
    }
  }, [open, resetImageState]);

  // 当初始索引变化时更新当前索引
  useEffect(() => {
    if (initialIndex >= 0 && initialIndex < images.length) {
      setCurrentIndex(initialIndex);
    }
  }, [initialIndex, images.length]);

  // 当前图片
  const currentImage = images[currentIndex];

  return (
    <Modal
      open={open}
      onClose={onClose}
      aria-labelledby="image-viewer-modal"
    >
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          bgcolor: 'rgba(0, 0, 0, 0.9)',
          display: 'flex',
          flexDirection: 'column',
          outline: 'none',
        }}
      >
        {/* 顶部工具栏 */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            p: 1,
            bgcolor: 'rgba(0, 0, 0, 0.5)',
          }}
        >
          <Typography variant="body2" color="white">
            {currentIndex + 1} / {images.length}
          </Typography>
          <Box>
            <Tooltip title="下载">
              <IconButton onClick={handleDownload} size="small" sx={{ color: 'white' }}>
                <DownloadIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="关闭">
              <IconButton onClick={onClose} size="small" sx={{ color: 'white' }}>
                <CloseIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* 图片容器 */}
        <Box
          ref={containerRef}
          sx={{
            flexGrow: 1,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            position: 'relative',
            overflow: 'hidden',
            cursor: isDragging ? 'grabbing' : 'grab',
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* 图片 */}
          {currentImage && (
            <img
              src={currentImage.url}
              alt={currentImage.alt || `图片 ${currentIndex + 1}`}
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                transform: `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)`,
                transition: isDragging ? 'none' : 'transform 0.2s ease',
              }}
              draggable={false}
            />
          )}

          {/* 导航按钮 */}
          {images.length > 1 && (
            <>
              <IconButton
                onClick={handlePrev}
                sx={{
                  position: 'absolute',
                  left: 16,
                  color: 'white',
                  bgcolor: 'rgba(0, 0, 0, 0.5)',
                  '&:hover': {
                    bgcolor: 'rgba(0, 0, 0, 0.7)',
                  },
                }}
              >
                <NavigateBeforeIcon />
              </IconButton>
              <IconButton
                onClick={handleNext}
                sx={{
                  position: 'absolute',
                  right: 16,
                  color: 'white',
                  bgcolor: 'rgba(0, 0, 0, 0.5)',
                  '&:hover': {
                    bgcolor: 'rgba(0, 0, 0, 0.7)',
                  },
                }}
              >
                <NavigateNextIcon />
              </IconButton>
            </>
          )}
        </Box>

        {/* 底部工具栏 */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            p: 1,
            bgcolor: 'rgba(0, 0, 0, 0.5)',
          }}
        >
          <Tooltip title="向左旋转">
            <IconButton onClick={handleRotateLeft} size="small" sx={{ color: 'white' }}>
              <RotateLeftIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="缩小">
            <IconButton onClick={handleZoomOut} size="small" sx={{ color: 'white' }}>
              <ZoomOutIcon />
            </IconButton>
          </Tooltip>
          <Slider
            value={scale}
            min={0.25}
            max={5}
            step={0.25}
            onChange={(_, value) => setScale(value as number)}
            sx={{
              width: 100,
              mx: 2,
              color: 'white',
            }}
          />
          <Tooltip title="放大">
            <IconButton onClick={handleZoomIn} size="small" sx={{ color: 'white' }}>
              <ZoomInIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="向右旋转">
            <IconButton onClick={handleRotateRight} size="small" sx={{ color: 'white' }}>
              <RotateRightIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    </Modal>
  );
};

export default React.memo(ImageViewer);
