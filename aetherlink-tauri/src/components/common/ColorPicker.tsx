import React, { useState, useRef } from 'react';
import {
  Box,
  Button,
  Popover,
  TextField,
  Typography,
  Paper,
  useTheme,
  alpha,
  Dialog,
  DialogContent,
  useMediaQuery
} from '@mui/material';
import { Palette } from 'lucide-react';
import MobileColorPicker from './ColorPicker/components/MobileColorPicker';
import { isMobileDevice } from './ColorPicker/utils/colorUtils';

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  label?: string;
  size?: 'small' | 'medium';
  disabled?: boolean;
  presetColors?: string[];
}

// 预设颜色调色板
const DEFAULT_PRESET_COLORS = [
  // 蓝色系
  '#1976d2', '#2196f3', '#03a9f4', '#00bcd4',
  // 绿色系
  '#4caf50', '#8bc34a', '#cddc39', '#ffeb3b',
  // 橙色系
  '#ff9800', '#ff5722', '#f44336', '#e91e63',
  // 紫色系
  '#9c27b0', '#673ab7', '#3f51b5', '#2196f3',
  // 灰色系
  '#9e9e9e', '#607d8b', '#795548', '#424242',
  // 特殊色
  '#000000', '#ffffff', '#f5f5f5', '#e0e0e0'
];

const ColorPicker: React.FC<ColorPickerProps> = ({
  value,
  onChange,
  label,
  size = 'small',
  disabled = false,
  presetColors = DEFAULT_PRESET_COLORS
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md')) || isMobileDevice();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [customColor, setCustomColor] = useState(value);
  const [mobileDialogOpen, setMobileDialogOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    if (!disabled) {
      if (isMobile) {
        setMobileDialogOpen(true);
      } else {
        setAnchorEl(event.currentTarget);
      }
      setCustomColor(value);
    }
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleMobileDialogClose = () => {
    setMobileDialogOpen(false);
  };

  const handlePresetColorClick = (color: string) => {
    onChange(color);
    setCustomColor(color);
    handleClose();
  };

  const handleCustomColorChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newColor = event.target.value;
    setCustomColor(newColor);
    onChange(newColor);
  };

  const handleCustomColorInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newColor = event.target.value;
    if (/^#[0-9A-Fa-f]{6}$/.test(newColor) || newColor === '') {
      setCustomColor(newColor);
      if (newColor !== '') {
        onChange(newColor);
      }
    }
  };

  const triggerNativeColorPicker = () => {
    if (inputRef.current) {
      // 确保input有有效的颜色值
      if (!customColor || !/^#[0-9A-Fa-f]{6}$/.test(customColor)) {
        inputRef.current.value = value || '#000000';
      }
      inputRef.current.click();
    }
  };

  const buttonSize = size === 'small' ? 32 : 40;

  return (
    <>
      {/* 颜色选择按钮 */}
      <Button
        onClick={handleClick}
        disabled={disabled}
        sx={{
          minWidth: buttonSize,
          width: buttonSize,
          height: buttonSize,
          padding: 0,
          border: '2px solid',
          borderColor: theme.palette.divider,
          borderRadius: 1,
          backgroundColor: value || '#ffffff',
          position: 'relative',
          overflow: 'hidden',
          '&:hover': {
            borderColor: theme.palette.primary.main,
            transform: 'scale(1.05)',
          },
          '&:disabled': {
            opacity: 0.5,
            cursor: 'not-allowed',
          },
          transition: 'all 0.2s ease-in-out'
        }}
      >
        {/* 如果没有颜色值，显示调色板图标 */}
        {!value && (
          <Palette 
            size={size === 'small' ? 16 : 20} 
            color={theme.palette.text.secondary} 
          />
        )}
        
        {/* 透明度网格背景（用于显示透明色） */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: `
              linear-gradient(45deg, #ccc 25%, transparent 25%), 
              linear-gradient(-45deg, #ccc 25%, transparent 25%), 
              linear-gradient(45deg, transparent 75%, #ccc 75%), 
              linear-gradient(-45deg, transparent 75%, #ccc 75%)
            `,
            backgroundSize: '8px 8px',
            backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0px',
            zIndex: -1
          }}
        />
      </Button>

      {/* 颜色选择弹窗 */}
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
      >
        <Paper sx={{ p: 2, minWidth: 280 }}>
          {label && (
            <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
              {label}
            </Typography>
          )}

          {/* 预设颜色网格 */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ mb: 1, fontSize: '0.85rem', color: 'text.secondary' }}>
              预设颜色
            </Typography>
            <Box sx={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(8, 1fr)', 
              gap: 0.5,
              mb: 1
            }}>
              {presetColors.map((color, index) => (
                <Button
                  key={index}
                  onClick={() => handlePresetColorClick(color)}
                  sx={{
                    minWidth: 28,
                    width: 28,
                    height: 28,
                    padding: 0,
                    backgroundColor: color,
                    border: '2px solid',
                    borderColor: value === color ? theme.palette.primary.main : theme.palette.divider,
                    borderRadius: 1,
                    '&:hover': {
                      borderColor: theme.palette.primary.main,
                      transform: 'scale(1.1)',
                    },
                    transition: 'all 0.2s ease-in-out'
                  }}
                />
              ))}
            </Box>
          </Box>

          {/* 自定义颜色输入 */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ mb: 1, fontSize: '0.85rem', color: 'text.secondary' }}>
              自定义颜色
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <TextField
                value={customColor}
                onChange={handleCustomColorInputChange}
                placeholder="#000000"
                size="small"
                sx={{ flex: 1 }}
                inputProps={{
                  maxLength: 7,
                  style: { fontFamily: 'monospace' }
                }}
              />
              <Button
                onClick={triggerNativeColorPicker}
                variant="outlined"
                size="small"
                sx={{ minWidth: 'auto', px: 1 }}
              >
                <Palette size={16} />
              </Button>
            </Box>
          </Box>

          {/* 隐藏的原生颜色选择器 */}
          <input
            ref={inputRef}
            type="color"
            value={customColor || value || '#000000'}
            onChange={handleCustomColorChange}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: '0px',
              height: '0px',
              opacity: 0,
              border: 'none',
              outline: 'none',
              background: 'transparent'
            }}
          />

          {/* 当前颜色预览 */}
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 1,
            p: 1,
            backgroundColor: alpha(theme.palette.primary.main, 0.05),
            borderRadius: 1
          }}>
            <Box
              sx={{
                width: 24,
                height: 24,
                backgroundColor: value,
                border: '1px solid',
                borderColor: theme.palette.divider,
                borderRadius: 0.5
              }}
            />
            <Typography variant="body2" sx={{ fontSize: '0.85rem', fontFamily: 'monospace' }}>
              {value || '未选择'}
            </Typography>
          </Box>
        </Paper>
      </Popover>

      {/* 移动端颜色选择器对话框 */}
      <Dialog
        open={mobileDialogOpen}
        onClose={handleMobileDialogClose}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            margin: 2,
            maxHeight: 'calc(100vh - 32px)',
            borderRadius: 2
          }
        }}
      >
        <DialogContent sx={{ p: 0 }}>
          <MobileColorPicker
            value={value}
            onChange={onChange}
            onClose={handleMobileDialogClose}
            presetColors={presetColors}
            disabled={disabled}
          />
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ColorPicker;
