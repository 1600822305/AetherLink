import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Slider,
  Typography
} from '@mui/material';
import { CloudUpload as CloudUploadIcon, Camera as PhotoCameraIcon } from 'lucide-react';

interface AvatarUploaderProps {
  open: boolean;
  onClose: () => void;
  onSave: (avatarDataUrl: string) => void;
  currentAvatar?: string;
  title?: string;
}

const AvatarUploader: React.FC<AvatarUploaderProps> = ({
  open,
  onClose,
  onSave,
  currentAvatar,
  title = '上传头像'
}) => {
  const [image, setImage] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  // 当对话框打开时，检查是否有当前头像
  useEffect(() => {
    if (open && currentAvatar && !image) {
      setImage(currentAvatar);
    }
  }, [open, currentAvatar]);

  // 当对话框关闭时重置状态
  useEffect(() => {
    if (!open) {
      setImage(null);
      setZoom(1);
    }
  }, [open]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setImage(result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleZoomChange = (_event: Event, newValue: number | number[]) => {
    setZoom(newValue as number);
  };

  const handleSave = () => {
    if (!image || !canvasRef.current) return;

    // 创建临时图像
    const tempImage = new Image();
    tempImage.onload = () => {
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext('2d')!;

      // 设置画布大小
      canvas.width = 200;
      canvas.height = 200;

      // 清除画布
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 计算缩放后的尺寸
      const size = Math.min(tempImage.width, tempImage.height);
      const sx = (tempImage.width - size) / 2;
      const sy = (tempImage.height - size) / 2;

      // 绘制裁剪后的图像
      ctx.drawImage(
        tempImage,
        sx, sy, size, size,
        0, 0, canvas.width, canvas.height
      );

      // 转换为 data URL
      const dataUrl = canvas.toDataURL('image/png');
      onSave(dataUrl);
      onClose();
    };

    tempImage.src = image;
  };

  const handleSelectFile = () => {
    fileInputRef.current?.click();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          {!image ? (
            <Box
              sx={{
                width: 200,
                height: 200,
                border: '2px dashed #ccc',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                backgroundColor: 'rgba(0,0,0,0.03)'
              }}
              onClick={handleSelectFile}
            >
              <Box sx={{ textAlign: 'center' }}>
                <PhotoCameraIcon size={48} color="var(--mui-palette-text-secondary)" />
                <Typography variant="body2" color="text.secondary">
                  点击上传图片
                </Typography>
              </Box>
            </Box>
          ) : (
            <>
              <Box sx={{ position: 'relative', width: 200, height: 200, overflow: 'hidden', borderRadius: '50%' }}>
                <img
                  ref={imageRef}
                  src={image}
                  alt="Avatar preview"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    transform: `scale(${zoom})`,
                    transformOrigin: 'center'
                  }}
                />
              </Box>
              <Box sx={{ width: '100%', mt: 2 }}>
                <Typography gutterBottom>缩放</Typography>
                <Slider
                  value={zoom}
                  onChange={handleZoomChange}
                  min={1}
                  max={3}
                  step={0.1}
                  aria-labelledby="zoom-slider"
                />
              </Box>
              <Button
                variant="outlined"
                startIcon={<CloudUploadIcon />}
                onClick={handleSelectFile}
                sx={{ mt: 1 }}
              >
                更换图片
              </Button>
            </>
          )}

          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept="image/*"
            onChange={handleFileChange}
          />

          {/* 隐藏的画布用于处理图像 */}
          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button
          onClick={handleSave}
          color="primary"
          variant="contained"
          disabled={!image}
        >
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AvatarUploader;