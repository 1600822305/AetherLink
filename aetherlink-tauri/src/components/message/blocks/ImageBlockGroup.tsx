import React, { useState, useMemo } from 'react';
import { Box, Grid, Modal, IconButton } from '@mui/material';
import { X as CloseIcon, ChevronLeft as NavigateBeforeIcon, ChevronRight as NavigateNextIcon } from 'lucide-react';
import LazyImage from '../../common/LazyImage';
import { useDeepMemo } from '../../../hooks/useMemoization';

interface ImageBlockGroupProps {
  images: Array<{
    id: string;
    url: string;
    alt?: string;
  }>;
  columns?: 1 | 2 | 3 | 4;
  spacing?: number;
  maxHeight?: string | number;
}

/**
 * 图片块分组组件
 * 用于显示多张图片，支持网格布局和图片预览
 */
const ImageBlockGroup: React.FC<ImageBlockGroupProps> = ({
  images,
  columns = 2,
  spacing = 1,
  maxHeight = '240px',
}) => {
  // 不需要使用主题
  const [open, setOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  // 记忆化图片数组，避免不必要的重渲染
  const memoizedImages = useDeepMemo(() => images, [images]);

  // 计算每行显示的图片数量
  const itemsPerRow = useMemo(() => {
    if (memoizedImages.length === 1) return 1;
    if (memoizedImages.length === 2) return 2;
    if (memoizedImages.length <= 4) return 2;
    return columns;
  }, [memoizedImages.length, columns]);

  // 打开图片预览
  const handleOpen = (index: number) => {
    setCurrentIndex(index);
    setOpen(true);
  };

  // 关闭图片预览
  const handleClose = () => {
    setOpen(false);
  };

  // 查看上一张图片
  const handlePrev = () => {
    setCurrentIndex((prev) => (prev === 0 ? memoizedImages.length - 1 : prev - 1));
  };

  // 查看下一张图片
  const handleNext = () => {
    setCurrentIndex((prev) => (prev === memoizedImages.length - 1 ? 0 : prev + 1));
  };

  // 键盘导航
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowLeft') {
      handlePrev();
    } else if (event.key === 'ArrowRight') {
      handleNext();
    } else if (event.key === 'Escape') {
      handleClose();
    }
  };

  return (
    <>
      <Grid container spacing={spacing}>
        {memoizedImages.map((image, index) => (
          <Box sx={{ width: `${100 / itemsPerRow}%`, p: 0.5 }} key={image.id}>
            <LazyImage
              src={image.url}
              alt={image.alt || `图片 ${index + 1}`}
              maxHeight={maxHeight}
              onClick={() => handleOpen(index)}
              showZoom
            />
          </Box>

        ))}
      </Grid>

      {/* 图片预览模态框 */}
      <Modal
        open={open}
        onClose={handleClose}
        aria-labelledby="image-preview-modal"
        onKeyDown={handleKeyDown}
      >
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '90%',
            maxWidth: '1200px',
            maxHeight: '90vh',
            bgcolor: 'background.paper',
            boxShadow: 24,
            p: 1,
            outline: 'none',
            borderRadius: 1,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* 关闭按钮 */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
            <IconButton onClick={handleClose} size="small">
              <CloseIcon />
            </IconButton>
          </Box>

          {/* 图片容器 */}
          <Box
            sx={{
              position: 'relative',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              flexGrow: 1,
              overflow: 'hidden',
            }}
          >
            {/* 导航按钮 */}
            {memoizedImages.length > 1 && (
              <>
                <IconButton
                  onClick={handlePrev}
                  sx={{
                    position: 'absolute',
                    left: 8,
                    zIndex: 1,
                    backgroundColor: 'rgba(0, 0, 0, 0.3)',
                    color: 'white',
                    '&:hover': {
                      backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    },
                  }}
                >
                  <NavigateBeforeIcon />
                </IconButton>
                <IconButton
                  onClick={handleNext}
                  sx={{
                    position: 'absolute',
                    right: 8,
                    zIndex: 1,
                    backgroundColor: 'rgba(0, 0, 0, 0.3)',
                    color: 'white',
                    '&:hover': {
                      backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    },
                  }}
                >
                  <NavigateNextIcon />
                </IconButton>
              </>
            )}

            {/* 图片 */}
            <img
              src={memoizedImages[currentIndex]?.url}
              alt={memoizedImages[currentIndex]?.alt || `图片 ${currentIndex + 1}`}
              style={{
                maxWidth: '100%',
                maxHeight: 'calc(90vh - 60px)',
                objectFit: 'contain',
              }}
            />
          </Box>

          {/* 图片计数 */}
          {memoizedImages.length > 1 && (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                mt: 1,
                color: 'text.secondary',
                fontSize: '0.875rem',
              }}
            >
              {currentIndex + 1} / {memoizedImages.length}
            </Box>
          )}
        </Box>
      </Modal>
    </>
  );
};

export default React.memo(ImageBlockGroup);
