import React, { useState, useCallback, memo } from 'react';
import {
  Box,
  Dialog,
  DialogContent,
  IconButton,
  Tooltip,
  Fab,
  Zoom,
  Backdrop
} from '@mui/material';
import {
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  RotateCcw as RotateLeftIcon,
  RotateCw as RotateRightIcon,
  FlipHorizontal as FlipHorizontalIcon,
  FlipVertical as FlipVerticalIcon,
  Download as DownloadIcon,
  X as CloseIcon,
  RotateCcw as ResetIcon
} from 'lucide-react';

interface AdvancedImagePreviewProps {
  src: string;
  alt?: string;
  style?: React.CSSProperties;
  // 移除通用属性传播，避免传递不合适的属性给 img 元素
}

interface ImageTransform {
  scale: number;
  rotation: number;
  flipX: boolean;
  flipY: boolean;
  translateX: number;
  translateY: number;
}

/**
 *  升级版高级图片预览组件
 * 参考实现，提供完整的图片预览工具栏功能
 */
const AdvancedImagePreview: React.FC<AdvancedImagePreviewProps> = ({
  src,
  alt = 'Generated Image',
  style
}) => {
  const [open, setOpen] = useState(false);
  const [transform, setTransform] = useState<ImageTransform>({
    scale: 1,
    rotation: 0,
    flipX: false,
    flipY: false,
    translateX: 0,
    translateY: 0
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showToolbar, setShowToolbar] = useState(false);

  // 打开预览
  const handleOpen = useCallback(() => {
    setOpen(true);
    setShowToolbar(true);
  }, []);

  // 关闭预览
  const handleClose = useCallback(() => {
    setOpen(false);
    setShowToolbar(false);
    // 重置变换
    setTransform({
      scale: 1,
      rotation: 0,
      flipX: false,
      flipY: false,
      translateX: 0,
      translateY: 0
    });
  }, []);

  // 缩放
  const handleZoom = useCallback((delta: number) => {
    setTransform(prev => ({
      ...prev,
      scale: Math.max(0.1, Math.min(5, prev.scale + delta))
    }));
  }, []);

  // 旋转
  const handleRotate = useCallback((degrees: number) => {
    setTransform(prev => ({
      ...prev,
      rotation: (prev.rotation + degrees) % 360
    }));
  }, []);

  // 翻转
  const handleFlip = useCallback((axis: 'x' | 'y') => {
    setTransform(prev => ({
      ...prev,
      [axis === 'x' ? 'flipX' : 'flipY']: !prev[axis === 'x' ? 'flipX' : 'flipY']
    }));
  }, []);

  // 重置变换
  const handleReset = useCallback(() => {
    setTransform({
      scale: 1,
      rotation: 0,
      flipX: false,
      flipY: false,
      translateX: 0,
      translateY: 0
    });
  }, []);

  // 下载图片
  const handleDownload = useCallback(async () => {
    try {
      const response = await fetch(src);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = alt || 'image';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('下载图片失败:', error);
    }
  }, [src, alt]);

  // 鼠标拖拽开始
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) { // 左键
      setIsDragging(true);
      setDragStart({ x: e.clientX - transform.translateX, y: e.clientY - transform.translateY });
    }
  }, [transform.translateX, transform.translateY]);

  // 鼠标拖拽
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      setTransform(prev => ({
        ...prev,
        translateX: e.clientX - dragStart.x,
        translateY: e.clientY - dragStart.y
      }));
    }
  }, [isDragging, dragStart]);

  // 鼠标拖拽结束
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // 滚轮缩放
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    handleZoom(delta);
  }, [handleZoom]);

  // 生成变换样式
  const getTransformStyle = (): React.CSSProperties => {
    const { scale, rotation, flipX, flipY, translateX, translateY } = transform;
    return {
      transform: `
        translate(${translateX}px, ${translateY}px)
        scale(${scale})
        rotate(${rotation}deg)
        scaleX(${flipX ? -1 : 1})
        scaleY(${flipY ? -1 : 1})
      `,
      cursor: isDragging ? 'grabbing' : 'grab',
      transition: isDragging ? 'none' : 'transform 0.2s ease'
    };
  };

  return (
    <>
      {/* 缩略图 */}
      <img
        src={src}
        alt={alt}
        style={{
          maxWidth: '100%',
          height: 'auto',
          borderRadius: '8px',
          margin: '8px 0',
          display: 'block',
          cursor: 'pointer',
          ...style
        }}
        onClick={handleOpen}
        onError={(e) => {
          const target = e.target as HTMLImageElement;
          target.style.display = 'none';
        }}
      />

      {/* 预览对话框 */}
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth={false}
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: 'transparent',
            boxShadow: 'none',
            overflow: 'hidden'
          }
        }}
        BackdropComponent={Backdrop}
        BackdropProps={{
          sx: {
            backgroundColor: 'rgba(0, 0, 0, 0.9)'
          }
        }}
      >
        <DialogContent
          sx={{
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            position: 'relative',
            overflow: 'hidden'
          }}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        >
          {/* 预览图片 */}
          <img
            src={src}
            alt={alt}
            style={{
              maxWidth: '90%',
              maxHeight: '90%',
              objectFit: 'contain',
              userSelect: 'none',
              ...getTransformStyle()
            }}
            onMouseDown={handleMouseDown}
            draggable={false}
          />

          {/* 关闭按钮 */}
          <IconButton
            onClick={handleClose}
            sx={{
              position: 'absolute',
              top: 16,
              right: 16,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              color: 'white',
              '&:hover': {
                backgroundColor: 'rgba(0, 0, 0, 0.7)'
              }
            }}
          >
            <CloseIcon />
          </IconButton>

          {/* 工具栏 */}
          <Zoom in={showToolbar}>
            <Box
              sx={{
                position: 'absolute',
                bottom: 24,
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                gap: 1,
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                borderRadius: 3,
                padding: 1,
                backdropFilter: 'blur(10px)'
              }}
            >
              {/* 放大 */}
              <Tooltip title="放大">
                <Fab
                  size="small"
                  onClick={() => handleZoom(0.2)}
                  sx={{
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    color: 'white',
                    '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.2)' }
                  }}
                >
                  <ZoomInIcon fontSize="small" />
                </Fab>
              </Tooltip>

              {/* 缩小 */}
              <Tooltip title="缩小">
                <Fab
                  size="small"
                  onClick={() => handleZoom(-0.2)}
                  sx={{
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    color: 'white',
                    '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.2)' }
                  }}
                >
                  <ZoomOutIcon fontSize="small" />
                </Fab>
              </Tooltip>

              {/* 左旋转 */}
              <Tooltip title="向左旋转">
                <Fab
                  size="small"
                  onClick={() => handleRotate(-90)}
                  sx={{
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    color: 'white',
                    '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.2)' }
                  }}
                >
                  <RotateLeftIcon fontSize="small" />
                </Fab>
              </Tooltip>

              {/* 右旋转 */}
              <Tooltip title="向右旋转">
                <Fab
                  size="small"
                  onClick={() => handleRotate(90)}
                  sx={{
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    color: 'white',
                    '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.2)' }
                  }}
                >
                  <RotateRightIcon fontSize="small" />
                </Fab>
              </Tooltip>

              {/* 水平翻转 */}
              <Tooltip title="水平翻转">
                <Fab
                  size="small"
                  onClick={() => handleFlip('x')}
                  sx={{
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    color: 'white',
                    '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.2)' }
                  }}
                >
                  <FlipHorizontalIcon fontSize="small" />
                </Fab>
              </Tooltip>

              {/* 垂直翻转 */}
              <Tooltip title="垂直翻转">
                <Fab
                  size="small"
                  onClick={() => handleFlip('y')}
                  sx={{
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    color: 'white',
                    '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.2)' }
                  }}
                >
                  <FlipVerticalIcon fontSize="small" />
                </Fab>
              </Tooltip>

              {/* 重置 */}
              <Tooltip title="重置">
                <Fab
                  size="small"
                  onClick={handleReset}
                  sx={{
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    color: 'white',
                    '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.2)' }
                  }}
                >
                  <ResetIcon fontSize="small" />
                </Fab>
              </Tooltip>

              {/* 下载 */}
              <Tooltip title="下载图片">
                <Fab
                  size="small"
                  onClick={handleDownload}
                  sx={{
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    color: 'white',
                    '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.2)' }
                  }}
                >
                  <DownloadIcon fontSize="small" />
                </Fab>
              </Tooltip>
            </Box>
          </Zoom>

          {/* 缩放比例显示 */}
          <Box
            sx={{
              position: 'absolute',
              top: 16,
              left: 16,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              color: 'white',
              padding: '4px 8px',
              borderRadius: 1,
              fontSize: '12px',
              fontFamily: 'monospace'
            }}
          >
            {Math.round(transform.scale * 100)}%
          </Box>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default memo(AdvancedImagePreview);
