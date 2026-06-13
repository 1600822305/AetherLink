import React, { useState, useCallback, memo, useEffect } from 'react';
import { buildCorsProxyRequestUrl } from '../../../shared/utils/universalFetch';
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
// 🚀 静态导入：这些模块已在其他地方被静态导入，改为静态导入避免 Vite 警告
import { isTauri } from '../../../shared/utils/platformDetection';
import { Capacitor } from '@capacitor/core';
import { CorsBypass } from 'capacitor-cors-bypass-enhanced';

interface AdvancedImagePreviewProps {
  src: string;
  alt?: string;
  style?: React.CSSProperties;
  // 移除通用属性传播，避免传递不合适的属性给 img 元素
}

/**
 * 检测是否是需要代理的外部图片URL
 */
function isExternalImageUrl(url: string): boolean {
  if (!url) return false;
  
  // base64 图片不需要代理
  if (url.startsWith('data:')) return false;
  
  // blob URL 不需要代理
  if (url.startsWith('blob:')) return false;
  
  // 本地文件不需要代理
  if (url.startsWith('file://')) return false;
  
  // 相对路径不需要代理
  if (!url.startsWith('http://') && !url.startsWith('https://')) return false;
  
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    
    // 本地地址不需要代理
    if (hostname === 'localhost' || 
        hostname === '127.0.0.1' || 
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.0.') ||
        hostname.startsWith('172.')) {
      return false;
    }
    
    // 其他外部 URL 需要代理
    return true;
  } catch {
    return false;
  }
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
  const [imageSrc, setImageSrc] = useState<string>(src);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // 跨平台加载外部图片
  useEffect(() => {
    let isMounted = true;
    let blobUrl: string | null = null;

    const loadExternalImage = async () => {
      // 如果不是外部URL，直接使用原始src
      if (!isExternalImageUrl(src)) {
        setImageSrc(src);
        return;
      }

      setIsLoading(true);
      setLoadError(null);

      try {
        let response: Response;

        if (isTauri()) {
          // Tauri 桌面端：使用 Tauri HTTP 插件
          console.log('[AdvancedImagePreview] Tauri 端加载外部图片:', src);
          const { fetch: tauriHttpFetch } = await import('@tauri-apps/plugin-http');
          response = await tauriHttpFetch(src, {
            method: 'GET',
            connectTimeout: 30000,
          });
        } else if (Capacitor.isNativePlatform()) {
          // 移动端：使用 CorsBypass 插件
          console.log('[AdvancedImagePreview] 移动端加载外部图片:', src);
          const result = await CorsBypass.request({
            url: src,
            method: 'GET',
            headers: {},
            timeout: 30000,
            responseType: 'arraybuffer' as any,
          });
          
          // CorsBypass 返回的是 base64 编码的数据
          if (result.data) {
            // 检测 MIME 类型
            const mimeType = result.headers?.['content-type'] || 'image/png';
            const dataUrl = `data:${mimeType};base64,${result.data}`;
            if (isMounted) {
              setImageSrc(dataUrl);
              setIsLoading(false);
            }
            return;
          }
          throw new Error('No data received from CorsBypass');
        } else {
          // Web 端：使用代理服务器
          console.log('[AdvancedImagePreview] Web 端通过代理加载外部图片:', src);
          const proxyUrl = buildCorsProxyRequestUrl(src);
          response = await fetch(proxyUrl, {
            method: 'GET',
          });
        }

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // 将响应转换为 blob URL
        const blob = await response.blob();
        blobUrl = URL.createObjectURL(blob);
        
        if (isMounted) {
          setImageSrc(blobUrl);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('[AdvancedImagePreview] 加载外部图片失败:', error);
        if (isMounted) {
          setLoadError(error instanceof Error ? error.message : '图片加载失败');
          setIsLoading(false);
          // 失败时尝试使用原始 URL（可能会因 CORS 显示不出来）
          setImageSrc(src);
        }
      }
    };

    loadExternalImage();

    return () => {
      isMounted = false;
      // 清理 blob URL
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [src]);
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
      {isLoading ? (
        <div
          style={{
            width: '200px',
            height: '150px',
            borderRadius: '8px',
            margin: '8px 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.1)',
            color: 'rgba(0, 0, 0, 0.5)',
            fontSize: '14px',
          }}
        >
          加载中...
        </div>
      ) : loadError ? (
        <div
          style={{
            maxWidth: '100%',
            padding: '12px',
            borderRadius: '8px',
            margin: '8px 0',
            backgroundColor: 'rgba(255, 0, 0, 0.1)',
            color: '#d32f2f',
            fontSize: '12px',
            cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent',
          }}
          onClick={() => window.open(src, '_blank')}
          title="点击在新标签页打开原图"
        >
          ⚠️ 图片加载失败: {loadError}
          <br />
          <span style={{ textDecoration: 'underline' }}>点击查看原图</span>
        </div>
      ) : (
        <img
          src={imageSrc}
          alt={alt}
          style={{
            maxWidth: '400px',
            maxHeight: '400px',
            width: 'auto',
            height: 'auto',
            borderRadius: '8px',
            margin: '8px 0',
            display: 'block',
            cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent',
            objectFit: 'contain',
            ...style
          }}
          onClick={handleOpen}
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            setLoadError('图片无法显示');
          }}
        />
      )}

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
            src={imageSrc}
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
