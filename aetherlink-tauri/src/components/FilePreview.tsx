import React, { useState } from 'react';
import { Box, Typography, IconButton, Chip, LinearProgress, Tooltip, useTheme } from '@mui/material';
import {
  X,
  File,
  FileText,
  Image,
  Music,
  Video,
  Code,
  CheckCircle,
  AlertCircle,
  GripVertical
} from 'lucide-react';
import type { FileContent } from '../shared/types';
import { FileUploadService } from '../shared/services/FileUploadService';
import { getFileTypeByExtension } from '../shared/utils/fileUtils';

export type FileStatus = 'uploading' | 'success' | 'error' | 'validating';

interface FilePreviewProps {
  file: FileContent;
  onRemove: () => void;
  status?: FileStatus;
  progress?: number;
  error?: string;
  compact?: boolean; // 紧凑模式，用于集成到输入框内部
  draggable?: boolean; // 是否支持拖拽
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
}

const FilePreview: React.FC<FilePreviewProps> = ({
  file,
  onRemove,
  status = 'success',
  progress = 0,
  error,
  compact = false,
  draggable = false,
  onDragStart,
  onDragEnd
}) => {
  const theme = useTheme();
  const [isDragging, setIsDragging] = useState(false);

  // 获取文件类型
  const fileType = getFileTypeByExtension(file.name);

  // 获取文件图标和颜色
  const getFileIcon = () => {
    const mimeType = file.mimeType.toLowerCase();
    const iconSize = compact ? 16 : 24;

    if (mimeType.startsWith('image/')) {
      return <Image size={iconSize} color="#2196f3" />;
    } else if (mimeType.startsWith('video/')) {
      return <Video size={iconSize} color="#f44336" />;
    } else if (mimeType.startsWith('audio/')) {
      return <Music size={iconSize} color="#4caf50" />;
    } else if (mimeType.includes('pdf')) {
      return <FileText size={iconSize} color="#e53935" />;
    } else if (mimeType.includes('word') || mimeType.includes('document')) {
      return <FileText size={iconSize} color="#1565c0" />;
    } else if (fileType === 'code') {
      return <Code size={iconSize} color="#ff9800" />;
    } else if (mimeType.includes('text/')) {
      return <FileText size={iconSize} color="#757575" />;
    } else {
      return <File size={iconSize} color="#9e9e9e" />;
    }
  };

  // 获取状态图标
  const getStatusIcon = () => {
    switch (status) {
      case 'success':
        return <CheckCircle size={16} color="#4caf50" />;
      case 'error':
        return <AlertCircle size={16} color="#f44336" />;
      case 'uploading':
      case 'validating':
        return null; // 显示进度条
      default:
        return null;
    }
  };

  // 获取文件类型标签颜色
  const getTypeChipColor = () => {
    switch (fileType) {
      case 'image': return '#2196f3';
      case 'video': return '#f44336';
      case 'audio': return '#4caf50';
      case 'code': return '#ff9800';
      case 'text': return '#757575';
      case 'document': return '#9c27b0';
      default: return '#607d8b';
    }
  };

  // 拖拽处理
  const handleDragStart = (e: React.DragEvent) => {
    setIsDragging(true);
    onDragStart?.(e);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setIsDragging(false);
    onDragEnd?.(e);
  };

  if (compact) {
    // 紧凑模式 - 集成到输入框内部
    return (
      <Tooltip title={error || `${file.name} (${FileUploadService.formatFileSize(file.size)})`}>
        <Box
          draggable={draggable}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '4px 8px',
            margin: '2px',
            borderRadius: '16px',
            backgroundColor: status === 'error' ? 'rgba(244, 67, 54, 0.1)' : 'rgba(0, 0, 0, 0.08)',
            border: status === 'error' ? '1px solid rgba(244, 67, 54, 0.3)' : 'none',
            position: 'relative',
            cursor: draggable ? 'grab' : 'default',
            opacity: isDragging ? 0.5 : 1,
            transition: 'all 0.2s ease',
            maxWidth: '200px',
            '&:hover': {
              backgroundColor: status === 'error' ? 'rgba(244, 67, 54, 0.15)' : 'rgba(0, 0, 0, 0.12)',
            }
          }}
        >
          {/* 拖拽指示器 */}
          {draggable && (
            <GripVertical size={12} color="rgba(0, 0, 0, 0.4)" style={{ marginRight: '4px' }} />
          )}

          {/* 文件图标 */}
          <Box sx={{ marginRight: '6px', display: 'flex', alignItems: 'center' }}>
            {getFileIcon()}
          </Box>

          {/* 文件名 */}
          <Typography
            variant="caption"
            sx={{
              fontWeight: 500,
              textOverflow: 'ellipsis',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              maxWidth: '100px',
              marginRight: '6px'
            }}
          >
            {file.name}
          </Typography>

          {/* 状态图标 */}
          {getStatusIcon()}

          {/* 删除按钮 */}
          <IconButton
            size="small"
            onClick={onRemove}
            sx={{
              marginLeft: '4px',
              padding: '2px',
              width: '16px',
              height: '16px',
              color: 'rgba(0, 0, 0, 0.6)',
              '&:hover': {
                color: '#f44336',
                backgroundColor: 'rgba(244, 67, 54, 0.1)',
              },
            }}
          >
            <X size={12} />
          </IconButton>

          {/* 进度条 */}
          {(status === 'uploading' || status === 'validating') && (
            <LinearProgress
              variant={progress > 0 ? 'determinate' : 'indeterminate'}
              value={progress}
              sx={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: '2px',
                borderRadius: '0 0 16px 16px',
              }}
            />
          )}
        </Box>
      </Tooltip>
    );
  }

  // 标准模式 - 独立显示
  return (
    <Box
      draggable={draggable}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      sx={{
        display: 'flex',
        alignItems: 'center',
        padding: '12px',
        borderRadius: '12px',
        backgroundColor: status === 'error'
          ? 'rgba(244, 67, 54, 0.05)'
          : theme.palette.mode === 'dark'
            ? 'rgba(255, 255, 255, 0.05)'
            : 'rgba(0, 0, 0, 0.03)',
        border: status === 'error' ? '1px solid rgba(244, 67, 54, 0.3)' : '1px solid rgba(0, 0, 0, 0.08)',
        position: 'relative',
        margin: '8px 0',
        maxWidth: '100%',
        cursor: draggable ? 'grab' : 'default',
        opacity: isDragging ? 0.5 : 1,
        transition: 'all 0.2s ease',
        '&:hover': {
          backgroundColor: status === 'error'
            ? 'rgba(244, 67, 54, 0.08)'
            : theme.palette.mode === 'dark'
              ? 'rgba(255, 255, 255, 0.08)'
              : 'rgba(0, 0, 0, 0.06)',
        }
      }}
    >
      {/* 拖拽指示器 */}
      {draggable && (
        <Box sx={{ marginRight: '8px', display: 'flex', alignItems: 'center' }}>
          <GripVertical size={20} color="rgba(0, 0, 0, 0.4)" />
        </Box>
      )}

      {/* 文件图标 */}
      <Box sx={{ marginRight: '12px', display: 'flex', alignItems: 'center' }}>
        {getFileIcon()}
      </Box>

      {/* 文件信息 */}
      <Box sx={{ flexGrow: 1, overflow: 'hidden', marginRight: '12px' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 500,
              textOverflow: 'ellipsis',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              maxWidth: '250px',
              marginRight: '8px'
            }}
          >
            {file.name}
          </Typography>

          {/* 文件类型标签 */}
          <Chip
            label={fileType.toUpperCase()}
            size="small"
            sx={{
              height: '20px',
              fontSize: '10px',
              fontWeight: 'bold',
              backgroundColor: getTypeChipColor(),
              color: 'white',
              '& .MuiChip-label': {
                padding: '0 6px'
              }
            }}
          />
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Typography variant="caption" color="textSecondary">
            {FileUploadService.formatFileSize(file.size)}
          </Typography>

          {/* 状态信息 */}
          {status === 'uploading' && (
            <Typography variant="caption" color="primary">
              上传中... {progress > 0 && `${Math.round(progress)}%`}
            </Typography>
          )}
          {status === 'validating' && (
            <Typography variant="caption" color="warning.main">
              验证中...
            </Typography>
          )}
          {status === 'error' && error && (
            <Typography variant="caption" color="error">
              {error}
            </Typography>
          )}
          {status === 'success' && (
            <Typography variant="caption" color="success.main">
              就绪
            </Typography>
          )}
        </Box>
      </Box>

      {/* 状态图标 */}
      <Box sx={{ marginRight: '8px' }}>
        {getStatusIcon()}
      </Box>

      {/* 删除按钮 */}
      <IconButton
        size="small"
        onClick={onRemove}
        sx={{
          color: 'rgba(0, 0, 0, 0.6)',
          '&:hover': {
            color: '#f44336',
            backgroundColor: 'rgba(244, 67, 54, 0.1)',
          },
        }}
      >
        <X size={20} />
      </IconButton>

      {/* 进度条 */}
      {(status === 'uploading' || status === 'validating') && (
        <LinearProgress
          variant={progress > 0 ? 'determinate' : 'indeterminate'}
          value={progress}
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '3px',
            borderRadius: '0 0 12px 12px',
          }}
        />
      )}
    </Box>
  );
};

export default FilePreview;