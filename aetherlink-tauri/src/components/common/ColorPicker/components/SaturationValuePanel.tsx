import React, { useRef, useCallback, useEffect } from 'react';
import { Box, useTheme } from '@mui/material';
import { getHueColor } from '../utils/colorUtils';

interface SaturationValuePanelProps {
  hue: number; // 0-360
  saturation: number; // 0-100
  value: number; // 0-100
  onChange: (saturation: number, value: number) => void;
  width?: number;
  height?: number;
  disabled?: boolean;
}

const SaturationValuePanel: React.FC<SaturationValuePanelProps> = ({
  hue,
  saturation,
  value,
  onChange,
  width = 280,
  height = 200,
  disabled = false
}) => {
  const theme = useTheme();
  const panelRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  // 计算饱和度和亮度值
  const calculateSV = useCallback((clientX: number, clientY: number): { s: number; v: number } => {
    if (!panelRef.current) return { s: saturation, v: value };

    const rect = panelRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const y = Math.max(0, Math.min(clientY - rect.top, rect.height));
    
    const newSaturation = Math.round((x / rect.width) * 100);
    const newValue = Math.round(100 - (y / rect.height) * 100);
    
    return {
      s: Math.max(0, Math.min(100, newSaturation)),
      v: Math.max(0, Math.min(100, newValue))
    };
  }, [saturation, value]);

  // 鼠标事件处理
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (disabled) return;
    
    e.preventDefault();
    isDragging.current = true;
    const { s, v } = calculateSV(e.clientX, e.clientY);
    onChange(s, v);
  }, [disabled, calculateSV, onChange]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current || disabled) return;
    
    e.preventDefault();
    const { s, v } = calculateSV(e.clientX, e.clientY);
    onChange(s, v);
  }, [disabled, calculateSV, onChange]);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  // 触摸事件处理
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled) return;
    
    e.preventDefault();
    isDragging.current = true;
    const touch = e.touches[0];
    const { s, v } = calculateSV(touch.clientX, touch.clientY);
    onChange(s, v);
  }, [disabled, calculateSV, onChange]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDragging.current || disabled) return;
    
    e.preventDefault();
    const touch = e.touches[0];
    const { s, v } = calculateSV(touch.clientX, touch.clientY);
    onChange(s, v);
  }, [disabled, calculateSV, onChange]);

  const handleTouchEnd = useCallback(() => {
    isDragging.current = false;
  }, []);

  // 添加全局事件监听器
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => handleMouseMove(e);
    const handleGlobalMouseUp = () => handleMouseUp();
    const handleGlobalTouchMove = (e: TouchEvent) => handleTouchMove(e);
    const handleGlobalTouchEnd = () => handleTouchEnd();

    if (isDragging.current) {
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
      document.addEventListener('touchmove', handleGlobalTouchMove, { passive: false });
      document.addEventListener('touchend', handleGlobalTouchEnd);
    }

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.removeEventListener('touchmove', handleGlobalTouchMove);
      document.removeEventListener('touchend', handleGlobalTouchEnd);
    };
  }, [handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

  // 计算滑块位置
  const sliderX = (saturation / 100) * width;
  const sliderY = ((100 - value) / 100) * height;

  // 获取当前色相的纯色
  const hueColor = getHueColor(hue);

  return (
    <Box
      sx={{
        position: 'relative',
        width,
        height,
        cursor: disabled ? 'not-allowed' : 'crosshair',
        opacity: disabled ? 0.5 : 1,
        userSelect: 'none',
        touchAction: 'none'
      }}
    >
      {/* 饱和度-亮度面板背景 */}
      <Box
        ref={panelRef}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        sx={{
          width: '100%',
          height: '100%',
          borderRadius: 1,
          border: `1px solid ${theme.palette.divider}`,
          position: 'relative',
          overflow: 'hidden',
          background: `
            linear-gradient(to top, #000000 0%, transparent 100%),
            linear-gradient(to right, #ffffff 0%, ${hueColor} 100%)
          `
        }}
      >
        {/* 滑块 */}
        <Box
          sx={{
            position: 'absolute',
            top: sliderY - 6,
            left: sliderX - 6,
            width: 12,
            height: 12,
            backgroundColor: 'transparent',
            border: `2px solid #ffffff`,
            borderRadius: '50%',
            boxShadow: `0 0 0 1px ${theme.palette.text.primary}, ${theme.shadows[2]}`,
            cursor: disabled ? 'not-allowed' : 'grab',
            transition: isDragging.current ? 'none' : 'all 0.1s ease-out',
            '&:active': {
              cursor: disabled ? 'not-allowed' : 'grabbing'
            }
          }}
        />
      </Box>
    </Box>
  );
};

export default SaturationValuePanel;
