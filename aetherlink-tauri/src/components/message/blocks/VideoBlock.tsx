import React, { useState, useEffect, useRef } from 'react';
import { Box, IconButton, Dialog, DialogContent, CircularProgress, Typography } from '@mui/material';
import { Maximize2 as ZoomOutMapIcon, AlertCircle as ErrorOutlineIcon } from 'lucide-react';
import type { VideoMessageBlock } from '../../../shared/types/newMessage';
import { dexieStorage } from '../../../shared/services/storage/DexieStorageService';

interface Props {
  block: VideoMessageBlock;
}

/**
 * 视频块组件
 * 负责渲染视频内容，支持播放控制和全屏查看
 */
const VideoBlock: React.FC<Props> = ({ block }) => {
  const [open, setOpen] = useState(false);
  const [videoSrc, setVideoSrc] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  // 加载视频
  useEffect(() => {
    const loadVideo = async () => {
      if (!block.url) {
        setError(true);
        setLoading(false);
        return;
      }

      // 检查是否为视频引用格式 [视频:ID]
      const refMatch = block.url.match(/\[视频:([a-zA-Z0-9_-]+)\]/);
      if (refMatch && refMatch[1]) {
        try {
          // 从数据库加载视频
          const videoId = refMatch[1];

          // 检查缓存
          const cachedUrl = sessionStorage.getItem(`video_cache_${videoId}`);
          if (cachedUrl) {
            setVideoSrc(cachedUrl);
            setLoading(false);
            return;
          }

          // 从数据库获取视频Blob
          const blob = await dexieStorage.getImageBlob(videoId); // 复用图片存储方法
          if (!blob) {
            throw new Error('视频不存在');
          }

          // 创建Blob URL
          const url = URL.createObjectURL(blob);

          // 缓存到sessionStorage
          sessionStorage.setItem(`video_cache_${videoId}`, url);

          setVideoSrc(url);
          setLoading(false);
        } catch (err) {
          console.error('加载视频引用失败:', err);
          setError(true);
          setLoading(false);
        }
      } else {
        // 直接使用URL（base64或普通URL）
        setVideoSrc(block.url);
        setLoading(false);
      }
    };

    loadVideo();
  }, [block.url]);

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '200px',
          borderRadius: '8px',
          backgroundColor: 'rgba(0, 0, 0, 0.05)'
        }}
      >
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (error || !videoSrc) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '200px',
          borderRadius: '8px',
          backgroundColor: 'rgba(0, 0, 0, 0.05)',
          color: 'text.secondary'
        }}
      >
        <ErrorOutlineIcon />
        <Box sx={{ mt: 1, fontSize: '0.75rem' }}>视频加载失败</Box>
      </Box>
    );
  }

  return (
    <Box sx={{ position: 'relative', maxWidth: '100%', display: 'inline-block' }}>
      <video
        ref={videoRef}
        src={videoSrc}
        poster={block.poster}
        controls
        style={{
          maxWidth: '100%',
          maxHeight: '400px',
          borderRadius: '8px',
          backgroundColor: '#000'
        }}
        width={block.width}
        height={block.height}
        preload="metadata"
      >
        <Typography variant="body2" color="text.secondary">
          您的浏览器不支持视频播放
        </Typography>
      </video>

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

      <Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth>
        <DialogContent sx={{ padding: 0, backgroundColor: '#000' }}>
          <video
            src={videoSrc}
            poster={block.poster}
            controls
            autoPlay
            style={{
              width: '100%',
              maxHeight: '90vh'
            }}
          >
            <Typography variant="body2" color="white">
              您的浏览器不支持视频播放
            </Typography>
          </video>
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default React.memo(VideoBlock);
