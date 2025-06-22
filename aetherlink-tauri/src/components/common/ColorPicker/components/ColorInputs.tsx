import React, { useState, useEffect } from 'react';
import { Box, TextField, Typography, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { hexToRgb, rgbToHex, hexToHsv, hsvToHex, isValidHex, clampColor } from '../utils/colorUtils';
import type { RGB, HSV } from '../utils/colorUtils';

interface ColorInputsProps {
  value: string; // hex color
  onChange: (color: string) => void;
  disabled?: boolean;
}

type InputMode = 'hex' | 'rgb' | 'hsv';

const ColorInputs: React.FC<ColorInputsProps> = ({
  value,
  onChange,
  disabled = false
}) => {
  const [inputMode, setInputMode] = useState<InputMode>('hex');
  const [hexInput, setHexInput] = useState(value);
  const [rgbInput, setRgbInput] = useState<RGB>({ r: 0, g: 0, b: 0 });
  const [hsvInput, setHsvInput] = useState<HSV>({ h: 0, s: 0, v: 0 });

  // 当外部颜色值变化时更新内部状态
  useEffect(() => {
    if (isValidHex(value)) {
      setHexInput(value);
      setRgbInput(hexToRgb(value));
      setHsvInput(hexToHsv(value));
    }
  }, [value]);

  // 处理输入模式切换
  const handleModeChange = (_: React.MouseEvent<HTMLElement>, newMode: InputMode | null) => {
    if (newMode !== null) {
      setInputMode(newMode);
    }
  };

  // 处理十六进制输入
  const handleHexChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newHex = event.target.value;
    setHexInput(newHex);
    
    if (isValidHex(newHex)) {
      onChange(newHex);
    }
  };

  // 处理RGB输入
  const handleRgbChange = (component: keyof RGB, value: string) => {
    const numValue = parseInt(value) || 0;
    const clampedValue = clampColor(numValue, 0, 255);
    
    const newRgb = { ...rgbInput, [component]: clampedValue };
    setRgbInput(newRgb);
    
    const newHex = rgbToHex(newRgb);
    onChange(newHex);
  };

  // 处理HSV输入
  const handleHsvChange = (component: keyof HSV, value: string) => {
    const numValue = parseInt(value) || 0;
    let clampedValue: number;
    
    if (component === 'h') {
      clampedValue = clampColor(numValue, 0, 360);
    } else {
      clampedValue = clampColor(numValue, 0, 100);
    }
    
    const newHsv = { ...hsvInput, [component]: clampedValue };
    setHsvInput(newHsv);
    
    const newHex = hsvToHex(newHsv);
    onChange(newHex);
  };

  return (
    <Box sx={{ width: '100%' }}>
      {/* 输入模式切换 */}
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'center' }}>
        <ToggleButtonGroup
          value={inputMode}
          exclusive
          onChange={handleModeChange}
          size="small"
          disabled={disabled}
        >
          <ToggleButton value="hex">HEX</ToggleButton>
          <ToggleButton value="rgb">RGB</ToggleButton>
          <ToggleButton value="hsv">HSV</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* 输入字段 */}
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        {inputMode === 'hex' && (
          <TextField
            label="HEX"
            value={hexInput}
            onChange={handleHexChange}
            disabled={disabled}
            size="small"
            fullWidth
            inputProps={{
              maxLength: 7,
              style: { fontFamily: 'monospace', textAlign: 'center' }
            }}
            placeholder="#000000"
            error={!isValidHex(hexInput) && hexInput !== ''}
            helperText={!isValidHex(hexInput) && hexInput !== '' ? '请输入有效的十六进制颜色' : ''}
          />
        )}

        {inputMode === 'rgb' && (
          <>
            <Box sx={{ flex: 1 }}>
              <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', mb: 0.5 }}>
                R
              </Typography>
              <TextField
                value={rgbInput.r}
                onChange={(e) => handleRgbChange('r', e.target.value)}
                disabled={disabled}
                size="small"
                fullWidth
                inputProps={{
                  min: 0,
                  max: 255,
                  style: { textAlign: 'center' }
                }}
                type="number"
              />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', mb: 0.5 }}>
                G
              </Typography>
              <TextField
                value={rgbInput.g}
                onChange={(e) => handleRgbChange('g', e.target.value)}
                disabled={disabled}
                size="small"
                fullWidth
                inputProps={{
                  min: 0,
                  max: 255,
                  style: { textAlign: 'center' }
                }}
                type="number"
              />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', mb: 0.5 }}>
                B
              </Typography>
              <TextField
                value={rgbInput.b}
                onChange={(e) => handleRgbChange('b', e.target.value)}
                disabled={disabled}
                size="small"
                fullWidth
                inputProps={{
                  min: 0,
                  max: 255,
                  style: { textAlign: 'center' }
                }}
                type="number"
              />
            </Box>
          </>
        )}

        {inputMode === 'hsv' && (
          <>
            <Box sx={{ flex: 1 }}>
              <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', mb: 0.5 }}>
                H
              </Typography>
              <TextField
                value={hsvInput.h}
                onChange={(e) => handleHsvChange('h', e.target.value)}
                disabled={disabled}
                size="small"
                fullWidth
                inputProps={{
                  min: 0,
                  max: 360,
                  style: { textAlign: 'center' }
                }}
                type="number"
              />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', mb: 0.5 }}>
                S
              </Typography>
              <TextField
                value={hsvInput.s}
                onChange={(e) => handleHsvChange('s', e.target.value)}
                disabled={disabled}
                size="small"
                fullWidth
                inputProps={{
                  min: 0,
                  max: 100,
                  style: { textAlign: 'center' }
                }}
                type="number"
              />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', mb: 0.5 }}>
                V
              </Typography>
              <TextField
                value={hsvInput.v}
                onChange={(e) => handleHsvChange('v', e.target.value)}
                disabled={disabled}
                size="small"
                fullWidth
                inputProps={{
                  min: 0,
                  max: 100,
                  style: { textAlign: 'center' }
                }}
                type="number"
              />
            </Box>
          </>
        )}
      </Box>
    </Box>
  );
};

export default ColorInputs;
