import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Box,
  Button,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
  useMediaQuery,
  useTheme,
  Slider
} from '@mui/material';
import BackButtonDialog from '../../../common/BackButtonDialog';
import { CloudUpload as CloudUploadIcon, Image as ImageIcon } from 'lucide-react';
import Cropper from 'react-easy-crop';
import type { Area, Point } from 'react-easy-crop';
import type { AssistantChatBackground } from './BasicSettingsTab';
import { createLogger } from '../../../../shared/services/infra/logger';

const logger = createLogger('WallpaperEditor');

interface WallpaperEditorProps {
  open: boolean;
  onClose: () => void;
  onSave: (background: AssistantChatBackground) => void;
  currentBackground?: AssistantChatBackground;
}

const WallpaperEditor: React.FC<WallpaperEditorProps> = ({
  open,
  onClose,
  onSave,
  currentBackground
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [image, setImage] = useState<string | null>(null);
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState<number>(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // 当对话框打开时，加载当前壁纸
  useEffect(() => {
    if (open && currentBackground?.imageUrl && !image) {
      setImage(currentBackground.imageUrl);
    }
  }, [open, currentBackground]);

  // 当对话框关闭时重置状态
  useEffect(() => {
    if (!open) {
      setImage(null);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
    }
  }, [open]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setImage(result);
        // 重置缩放和位置
        setCrop({ x: 0, y: 0 });
        setZoom(1);
      };
      reader.readAsDataURL(file);
    }
  };

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  // 裁剪并保存壁纸
  const handleSave = async () => {
    if (!image || !croppedAreaPixels) return;

    setIsSaving(true);
    try {
      // 创建 canvas 来裁剪图片
      const imageElement = new Image();
      imageElement.src = image;
      
      await new Promise((resolve) => {
        imageElement.onload = resolve;
      });

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('无法获取 canvas context');

      // 设置输出尺寸（保持高质量但限制大小）
      const maxSize = 1920;
      const scale = Math.min(maxSize / croppedAreaPixels.width, maxSize / croppedAreaPixels.height, 1);
      
      canvas.width = croppedAreaPixels.width * scale;
      canvas.height = croppedAreaPixels.height * scale;

      ctx.drawImage(
        imageElement,
        croppedAreaPixels.x,
        croppedAreaPixels.y,
        croppedAreaPixels.width,
        croppedAreaPixels.height,
        0,
        0,
        canvas.width,
        canvas.height
      );

      // 转换为 dataURL
      const croppedImage = canvas.toDataURL('image/jpeg', 0.85);

      onSave({
        enabled: true,
        imageUrl: croppedImage,
        opacity: currentBackground?.opacity ?? 0.7,
        size: 'cover',
        position: 'center',
        repeat: 'no-repeat',
        showOverlay: currentBackground?.showOverlay ?? true
      });
      onClose();
    } catch (error) {
      logger.error('裁剪壁纸失败:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectFile = () => {
    fileInputRef.current?.click();
  };

  return (
    <BackButtonDialog 
      open={open} 
      onClose={onClose} 
      maxWidth={isMobile ? false : "md"}
      fullWidth
      fullScreen={isMobile}
      slotProps={{
        paper: {
          sx: {
            ...(isMobile && {
              margin: 0,
              maxHeight: '100vh',
              height: '100vh',
              display: 'flex',
              flexDirection: 'column'
            })
          }
        }
      }}
    >
      <DialogTitle>编辑壁纸</DialogTitle>
      <DialogContent sx={{ 
        p: isMobile ? 2 : 3,
        flex: 1,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          gap: 2,
          flex: 1
        }}>
          {!image ? (
            <Box
              sx={{
                width: '100%',
                height: isMobile ? 300 : 400,
                border: '2px dashed',
                borderColor: theme.palette.divider,
                borderRadius: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                backgroundColor: theme.palette.action.hover,
                transition: 'all 0.2s',
                '&:hover': {
                  borderColor: theme.palette.primary.main,
                  backgroundColor: theme.palette.action.selected
                }
              }}
              onClick={handleSelectFile}
            >
              <Box sx={{ textAlign: 'center' }}>
                <ImageIcon size={isMobile ? 64 : 48} color={theme.palette.text.secondary} />
                <Typography variant={isMobile ? "h6" : "body1"} color="text.secondary" sx={{ mt: 1 }}>
                  点击选择壁纸图片
                </Typography>
                <Typography variant="caption" color="text.disabled">
                  支持 JPG、PNG、WebP 格式
                </Typography>
              </Box>
            </Box>
          ) : (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                拖动调整位置，双指缩放调整大小
              </Typography>
              <Box 
                sx={{ 
                  position: 'relative', 
                  width: '100%',
                  height: isMobile ? 300 : 400,
                  borderRadius: 2,
                  overflow: 'hidden',
                  backgroundColor: '#000'
                }}
              >
                <Cropper
                  image={image}
                  crop={crop}
                  zoom={zoom}
                  aspect={9 / 16} // 手机屏幕比例
                  onCropChange={setCrop}
                  onCropComplete={onCropComplete}
                  onZoomChange={setZoom}
                  cropShape="rect"
                  showGrid={true}
                  style={{
                    containerStyle: {
                      width: '100%',
                      height: '100%',
                    }
                  }}
                />
              </Box>
              
              <Box sx={{ width: '100%', mt: 2, px: 2 }}>
                <Typography gutterBottom variant="body2" color="text.secondary">
                  缩放: {zoom.toFixed(1)}x
                </Typography>
                <Slider
                  value={zoom}
                  onChange={(_e, value) => setZoom(value as number)}
                  min={1}
                  max={3}
                  step={0.1}
                  aria-labelledby="zoom-slider"
                />
              </Box>
              
              <Button
                variant="outlined"
                startIcon={<CloudUploadIcon size={18} />}
                onClick={handleSelectFile}
                size={isMobile ? "large" : "medium"}
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
        </Box>
      </DialogContent>
      <DialogActions sx={{
        ...(isMobile && {
          px: 2
        })
      }}>
        <Button onClick={onClose} size={isMobile ? "large" : "medium"}>
          取消
        </Button>
        <Button
          onClick={handleSave}
          color="primary"
          variant="contained"
          disabled={!image || isSaving}
          size={isMobile ? "large" : "medium"}
        >
          {isSaving ? '保存中...' : '保存'}
        </Button>
      </DialogActions>
    </BackButtonDialog>
  );
};

export default WallpaperEditor;
