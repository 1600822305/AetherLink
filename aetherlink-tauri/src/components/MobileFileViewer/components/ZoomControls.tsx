import React from 'react';
import { Box, IconButton, Typography } from '@mui/material';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw as ResetIcon
} from 'lucide-react';

interface ZoomControlsProps {
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  canZoomIn: boolean;
  canZoomOut: boolean;
}

export const ZoomControls: React.FC<ZoomControlsProps> = ({
  scale,
  onZoomIn,
  onZoomOut,
  onReset,
  canZoomIn,
  canZoomOut
}) => {
  return (
    <Box sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 0.5,
      '& .MuiIconButton-root': {
        color: '#cccccc',
        backgroundColor: '#333333',
        width: 24,
        height: 24,
        '&:hover': {
          backgroundColor: '#404040'
        },
        '&:disabled': {
          color: '#666666',
          backgroundColor: '#2a2a2a'
        }
      }
    }}>
      <IconButton
        size="small"
        onClick={onZoomOut}
        disabled={!canZoomOut}
        title="缩小"
      >
        <ZoomOut size={14} />
      </IconButton>

      <Typography
        variant="caption"
        sx={{
          minWidth: '40px',
          textAlign: 'center',
          fontSize: '0.65rem',
          color: '#cccccc'
        }}
      >
        {Math.round(scale * 100)}%
      </Typography>

      <IconButton
        size="small"
        onClick={onZoomIn}
        disabled={!canZoomIn}
        title="放大"
      >
        <ZoomIn size={14} />
      </IconButton>

      <IconButton
        size="small"
        onClick={onReset}
        title="重置缩放"
      >
        <ResetIcon size={14} />
      </IconButton>
    </Box>
  );
};
