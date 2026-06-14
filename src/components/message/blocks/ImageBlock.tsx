import React, { useState, useEffect } from 'react';
import { Box, IconButton, DialogContent, CircularProgress } from '@mui/material';
import BackButtonDialog from '../../common/BackButtonDialog';
import { Maximize2 as ZoomOutMapIcon, AlertCircle as ErrorOutlineIcon } from 'lucide-react';
import type { ImageMessageBlock } from '../../../shared/types/newMessage';
import { dexieStorage } from '../../../shared/services/storage/DexieStorageService';
import { createLogger } from '../../../shared/services/infra/logger';

const logger = createLogger('ImageBlock');

interface Props {
  block: ImageMessageBlock;
  /** 是否为单独显示（非分组），影响最大高度 */
  isSingle?: boolean;
}

/**
 * 图片块组件
 * 负责渲染图片内容，支持点击放大和图片引用格式
 */
const ImageBlock: React.FC<Props> = ({ block, isSingle = true }) => {
  const [open, setOpen] = useState(false);
  const [imageSrc, setImageSrc] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const handleOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  // 加载图片
  useEffect(() => {
    const loadImage = async () => {
      if (!block.url) {
        setError(true);
        setLoading(false);
        return;
      }

      // 检查是否为图片引用格式 [图片:ID]
      const refMatch = block.url.match(/\[图片:([a-zA-Z0-9_-]+)\]/);
      if (refMatch && refMatch[1]) {
        try {
          // 从数据库加载图片
          const imageId = refMatch[1];

          // 检查缓存
          const cachedUrl = sessionStorage.getItem(`img_cache_${imageId}`);
          if (cachedUrl) {
            setImageSrc(cachedUrl);
            setLoading(false);
            return;
          }

          // 从数据库获取图片Blob
          const blob = await dexieStorage.getImageBlob(imageId);
          if (!blob) {
            throw new Error('图片不存在');
          }

          // 创建Blob URL
          const url = URL.createObjectURL(blob);

          // 缓存到sessionStorage
          sessionStorage.setItem(`img_cache_${imageId}`, url);

          setImageSrc(url);
          setLoading(false);
        } catch (err) {
          logger.error('加载图片引用失败:', err);
          setError(true);
          setLoading(false);
        }
      } else {
        // 直接使用URL（base64或普通URL）
        setImageSrc(block.url);
        setLoading(false);
      }
    };

    loadImage();
  }, [block.url]);

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100px',
          borderRadius: '8px',
          backgroundColor: 'rgba(0, 0, 0, 0.05)'
        }}
      >
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (error || !imageSrc) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100px',
          borderRadius: '8px',
          backgroundColor: 'rgba(0, 0, 0, 0.05)',
          color: 'text.secondary'
        }}
      >
        <ErrorOutlineIcon />
        <Box sx={{ mt: 1, fontSize: '0.75rem' }}>图片加载失败</Box>
      </Box>
    );
  }

  return (
    <Box sx={{ position: 'relative', maxWidth: '100%', display: 'inline-block' }}>
      <Box
        component="img"
        src={imageSrc}
        alt="图片内容"
        sx={{
          maxWidth: '100%',
          maxHeight: isSingle ? '300px' : '180px',
          borderRadius: '8px',
          cursor: 'pointer',
          objectFit: 'cover',
          WebkitTapHighlightColor: 'transparent'
        }}
        onClick={handleOpen}
      />

      <IconButton
        size="small"
        sx={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          color: 'white',
          '&:hover': {
            backgroundColor: 'rgba(0, 0, 0, 0.7)'
          }
        }}
        onClick={handleOpen}
      >
        <ZoomOutMapIcon fontSize="small" />
      </IconButton>

      <BackButtonDialog open={open} onClose={handleClose} maxWidth="lg">
        <DialogContent sx={{ padding: 0 }}>
          <Box
            component="img"
            src={imageSrc}
            alt="图片内容"
            sx={{
              maxWidth: '100%',
              maxHeight: '90vh'
            }}
          />
        </DialogContent>
      </BackButtonDialog>
    </Box>
  );
};

export default React.memo(ImageBlock);
