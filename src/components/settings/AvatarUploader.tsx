import React, { useState, useRef, useEffect, useCallback } from 'react';
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
import BackButtonDialog from '../common/BackButtonDialog';
import { CloudUpload as CloudUploadIcon, Camera as PhotoCameraIcon } from 'lucide-react';
import Cropper from 'react-easy-crop';
import type { Area, Point } from 'react-easy-crop';
import { getCroppedImg } from './cropImage.ts';
import { createLogger } from '../../shared/services/infra/logger';

const logger = createLogger('AvatarUploader');

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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [image, setImage] = useState<string | null>(null);
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState<number>(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

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
      };
      reader.readAsDataURL(file);
    }
  };

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleSave = async () => {
    if (!image || !croppedAreaPixels) return;

    setIsSaving(true);
    try {
      const croppedImage = await getCroppedImg(
        image,
        croppedAreaPixels,
        0 // 输出为圆形
      );
      onSave(croppedImage);
      onClose();
    } catch (error) {
      logger.error('Error cropping image:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectFile = () => {
    fileInputRef.current?.click();
  };

  const handleZoomChange = (zoom: number) => {
    setZoom(zoom);
  };

  return (
    <BackButtonDialog 
      open={open} 
      onClose={onClose} 
      maxWidth={isMobile ? false : "sm"}
      fullWidth={isMobile ? true : false}
      fullScreen={isMobile}
      slotProps={{
        paper: {
          sx: {
            // 移动端全屏适配
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
      <DialogTitle>{title}</DialogTitle>
      <DialogContent sx={{ 
        p: isMobile ? 2 : 3,
        minHeight: isMobile ? '400px' : 'auto',
        flex: 1,
        overflow: 'auto'
      }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          {!image ? (
            <Box
              sx={{
                width: isMobile ? 250 : 200,
                height: isMobile ? 250 : 200,
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
                <PhotoCameraIcon size={isMobile ? 64 : 48} color="var(--mui-palette-text-secondary)" />
                <Typography variant={isMobile ? "h6" : "body2"} color="text.secondary">
                  点击上传图片
                </Typography>
              </Box>
            </Box>
          ) : (
            <>
              <Box 
                sx={{ 
                  position: 'relative', 
                  width: isMobile ? 300 : 280, 
                  height: isMobile ? 300 : 280,
                  borderRadius: '50%',
                  overflow: 'hidden',
                  backgroundColor: '#000'
                }}
              >
                <Cropper
                  image={image}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  onCropChange={setCrop}
                  onCropComplete={onCropComplete}
                  onZoomChange={setZoom}
                  cropShape="round"
                  showGrid={false}
                  style={{
                    containerStyle: {
                      width: '100%',
                      height: '100%',
                    },
                    cropAreaStyle: {
                      width: isMobile ? 250 : 200,
                      height: isMobile ? 250 : 200,
                    },
                  }}
                />
              </Box>
              <Box sx={{ width: '100%', mt: 2 }}>
                <Typography gutterBottom>缩放</Typography>
                <Slider
                  value={zoom}
                  onChange={(_e, value) => handleZoomChange(value as number)}
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
                size={isMobile ? "large" : "medium"}
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
        </Box>
      </DialogContent>
      <DialogActions sx={{
        ...(isMobile && {
          px: 2
        })
      }}>
        <Button onClick={onClose} size={isMobile ? "large" : "medium"}>取消</Button>
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

export default AvatarUploader;
