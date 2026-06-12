import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Box,
  Button,
  Typography,
  Slider,
  TextField,
  InputAdornment,
} from '@mui/material';
import { useDialogBackHandler } from '../../../hooks/useDialogBackHandler';
import { SIDEBAR_WIDTH_MIN, getSafeMaxSidebarWidth } from '../sidebarOptimization';

interface SidebarWidthDialogProps {
  open: boolean;
  onClose: () => void;
  currentWidth: number;
  onWidthChange: (width: number) => void;
}

const DIALOG_ID = 'sidebar-width-dialog';

/**
 * 侧边栏宽度调整对话框
 * 支持滑块、输入框和快捷预设；改动需点击"保存"后才会生效
 */
const SidebarWidthDialog: React.FC<SidebarWidthDialogProps> = ({
  open,
  onClose,
  currentWidth,
  onWidthChange,
}) => {
  // 使用返回键处理
  const { handleClose } = useDialogBackHandler(DIALOG_ID, open, onClose);

  // 当前屏幕允许的最大宽度（对话框打开时随当前视口实时计算）
  const safeMaxWidth = getSafeMaxSidebarWidth();

  const clamp = (value: number) =>
    Math.min(safeMaxWidth, Math.max(SIDEBAR_WIDTH_MIN, value));

  // 草稿宽度：仅在点击"保存"后才应用到实际设置
  const [draftWidth, setDraftWidth] = useState(() => clamp(currentWidth));

  // 每次打开对话框时同步当前宽度
  useEffect(() => {
    if (open) {
      setDraftWidth(clamp(currentWidth));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentWidth]);

  const handleDraftChange = (newWidth: number) => {
    setDraftWidth(clamp(newWidth));
  };

  const handleSave = () => {
    onWidthChange(clamp(draftWidth));
    onClose();
  };

  if (!open) return null;

  const presets = [340, 400, 500, 600].filter((p) => p <= safeMaxWidth);

  return createPortal(
    <>
      {/* 点击外部关闭（不保存） */}
      <Box
        onClick={handleClose}
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1300,
          bgcolor: 'rgba(0, 0, 0, 0.3)',
        }}
      />
      <Box
        sx={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 1301,
          bgcolor: 'background.paper',
          borderRadius: 2,
          boxShadow: 6,
          p: 2.5,
          width: 280,
        }}
        data-gesture-exclude="true"
      >
        <Typography variant="subtitle2" fontWeight="medium" sx={{ mb: 1.5 }}>
          侧边栏宽度
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          范围 {SIDEBAR_WIDTH_MIN}–{safeMaxWidth}px，修改后点击"保存"生效
        </Typography>
        
        {/* 滑块 */}
        <Slider
          value={draftWidth}
          min={SIDEBAR_WIDTH_MIN}
          max={safeMaxWidth}
          step={10}
          onChange={(_, value) => handleDraftChange(value as number)}
          sx={{
            mb: 2,
            '& .MuiSlider-thumb': {
              width: 16,
              height: 16,
            },
          }}
        />
        
        {/* 数值输入 */}
        <TextField
          type="number"
          size="small"
          value={draftWidth}
          onChange={(e) => {
            const value = parseInt(e.target.value, 10);
            if (!isNaN(value)) {
              handleDraftChange(value);
            }
          }}
          InputProps={{
            endAdornment: <InputAdornment position="end">px</InputAdornment>,
            inputProps: {
              min: SIDEBAR_WIDTH_MIN,
              max: safeMaxWidth,
              style: { textAlign: 'center' },
            },
          }}
          sx={{ width: '100%' }}
        />
        
        {/* 快捷预设 */}
        <Box sx={{ display: 'flex', gap: 0.5, mt: 1.5, flexWrap: 'wrap' }}>
          {presets.map((preset) => (
            <Box
              key={preset}
              onClick={() => handleDraftChange(preset)}
              sx={{
                px: 1.5,
                py: 0.5,
                borderRadius: 1,
                fontSize: '0.75rem',
                cursor: 'pointer',
                bgcolor: draftWidth === preset ? 'primary.main' : 'action.hover',
                color: draftWidth === preset ? 'primary.contrastText' : 'text.secondary',
                '&:hover': {
                  bgcolor: draftWidth === preset ? 'primary.dark' : 'action.selected',
                },
                transition: 'all 0.15s',
              }}
            >
              {preset}
            </Box>
          ))}
        </Box>

        {/* 操作按钮 */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2 }}>
          <Button size="small" color="inherit" onClick={handleClose}>
            取消
          </Button>
          <Button size="small" variant="contained" onClick={handleSave}>
            保存
          </Button>
        </Box>
      </Box>
    </>,
    document.body
  );
};

export default SidebarWidthDialog;
