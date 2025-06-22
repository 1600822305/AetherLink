import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  alpha,
  useTheme,
  Divider
} from '@mui/material';
import HueBar from './HueBar';
import SaturationValuePanel from './SaturationValuePanel';
import ColorInputs from './ColorInputs';
import { hexToHsv, hsvToHex, isValidHex } from '../utils/colorUtils';

interface MobileColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  onClose?: () => void;
  presetColors?: string[];
  disabled?: boolean;
}

// 默认预设颜色
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

const MobileColorPicker: React.FC<MobileColorPickerProps> = ({
  value,
  onChange,
  onClose,
  presetColors = DEFAULT_PRESET_COLORS,
  disabled = false
}) => {
  const theme = useTheme();
  const [currentColor, setCurrentColor] = useState(value || '#000000');
  const [hsv, setHsv] = useState(hexToHsv(value || '#000000'));

  // 当外部颜色值变化时更新内部状态
  useEffect(() => {
    if (value && isValidHex(value)) {
      setCurrentColor(value);
      setHsv(hexToHsv(value));
    }
  }, [value]);

  // 处理HSV变化
  const handleHsvChange = (newHsv: { h?: number; s?: number; v?: number }) => {
    const updatedHsv = { ...hsv, ...newHsv };
    setHsv(updatedHsv);
    
    const newColor = hsvToHex(updatedHsv);
    setCurrentColor(newColor);
    onChange(newColor);
  };

  // 处理色相变化
  const handleHueChange = (hue: number) => {
    handleHsvChange({ h: hue });
  };

  // 处理饱和度和亮度变化
  const handleSVChange = (saturation: number, value: number) => {
    handleHsvChange({ s: saturation, v: value });
  };

  // 处理预设颜色点击
  const handlePresetColorClick = (color: string) => {
    setCurrentColor(color);
    setHsv(hexToHsv(color));
    onChange(color);
  };

  // 处理颜色输入变化
  const handleColorInputChange = (color: string) => {
    if (isValidHex(color)) {
      setCurrentColor(color);
      setHsv(hexToHsv(color));
      onChange(color);
    }
  };

  return (
    <Paper 
      sx={{ 
        p: 3, 
        maxWidth: 320, 
        width: '100%',
        backgroundColor: theme.palette.background.paper,
        borderRadius: 2
      }}
    >
      {/* 标题 */}
      <Typography variant="h6" sx={{ mb: 2, textAlign: 'center', fontWeight: 600 }}>
        颜色选择器
      </Typography>

      {/* 饱和度-亮度面板 */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'center' }}>
        <SaturationValuePanel
          hue={hsv.h}
          saturation={hsv.s}
          value={hsv.v}
          onChange={handleSVChange}
          width={280}
          height={200}
          disabled={disabled}
        />
      </Box>

      {/* 色相条 */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'center' }}>
        <HueBar
          hue={hsv.h}
          onChange={handleHueChange}
          width={280}
          height={20}
          disabled={disabled}
        />
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* 预设颜色 */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="body2" sx={{ mb: 1.5, fontSize: '0.9rem', color: 'text.secondary', textAlign: 'center' }}>
          预设颜色
        </Typography>
        <Box sx={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(8, 1fr)', 
          gap: 0.75,
          justifyItems: 'center'
        }}>
          {presetColors.map((color, index) => (
            <Button
              key={index}
              onClick={() => handlePresetColorClick(color)}
              disabled={disabled}
              sx={{
                minWidth: 28,
                width: 28,
                height: 28,
                padding: 0,
                backgroundColor: color,
                border: '2px solid',
                borderColor: currentColor === color ? theme.palette.primary.main : theme.palette.divider,
                borderRadius: 1,
                '&:hover': {
                  borderColor: theme.palette.primary.main,
                  transform: 'scale(1.1)',
                },
                '&:disabled': {
                  opacity: 0.5,
                  transform: 'none'
                },
                transition: 'all 0.2s ease-in-out'
              }}
            />
          ))}
        </Box>
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* 颜色输入 */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="body2" sx={{ mb: 1.5, fontSize: '0.9rem', color: 'text.secondary', textAlign: 'center' }}>
          精确输入
        </Typography>
        <ColorInputs
          value={currentColor}
          onChange={handleColorInputChange}
          disabled={disabled}
        />
      </Box>

      {/* 当前颜色预览 */}
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 2,
        p: 2,
        backgroundColor: alpha(theme.palette.primary.main, 0.05),
        borderRadius: 1,
        mb: onClose ? 2 : 0
      }}>
        <Box
          sx={{
            width: 40,
            height: 40,
            backgroundColor: currentColor,
            border: `2px solid ${theme.palette.divider}`,
            borderRadius: 1,
            flexShrink: 0
          }}
        />
        <Box sx={{ flex: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
            当前颜色
          </Typography>
          <Typography variant="body2" sx={{ fontSize: '0.85rem', fontFamily: 'monospace', color: 'text.secondary' }}>
            {currentColor.toUpperCase()}
          </Typography>
        </Box>
      </Box>

      {/* 关闭按钮 */}
      {onClose && (
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <Button
            onClick={onClose}
            variant="contained"
            size="large"
            sx={{ minWidth: 120 }}
          >
            确定
          </Button>
        </Box>
      )}
    </Paper>
  );
};

export default MobileColorPicker;
