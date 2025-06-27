import React, { useState } from 'react';
import { Box, Typography, IconButton, Chip, useTheme } from '@mui/material';
import {
  File as FileIcon,
  FileText as DocumentIcon,
  Image as ImageIcon,
  Code as CodeIcon,
  Archive as ArchiveIcon,
  Download as DownloadIcon,
  Eye as ViewIcon
} from 'lucide-react';
import type { FileMessageBlock } from '../../../shared/types/newMessage';
import { FileTypes } from '../../../shared/utils/fileUtils';
import { MobileFileViewer } from '../../MobileFileViewer';
import type { WorkspaceFile } from '../../MobileFileViewer/types';

interface Props {
  block: FileMessageBlock;
}

// 将 FileMessageBlock 的文件数据转换为 WorkspaceFile 格式
const convertToWorkspaceFile = (fileBlock: FileMessageBlock): WorkspaceFile | null => {
  if (!fileBlock.file) return null;

  const { file } = fileBlock;
  const fileName = file.origin_name || file.name || '未知文件';

  return {
    name: fileName,
    path: `temp://${file.id}`, // 使用特殊路径标识这是临时文件
    size: file.size || 0,
    isDirectory: false,
    type: file.type || 'unknown',
    modifiedTime: Date.now(),
    extension: (fileName && typeof fileName === 'string' && fileName.includes('.')) ? fileName.split('.').pop() : undefined
  };
};

// 自定义文件读取服务，从 base64 数据读取内容
const createFileReaderService = (fileBlock: FileMessageBlock) => {
  return {
    readFile: async (options: { path: string; encoding: string }) => {
      if (!fileBlock.file?.base64Data) {
        throw new Error('文件没有可用的内容数据');
      }

      try {
        // 从 base64 数据解码文件内容
        let base64Data = fileBlock.file.base64Data;
        if (base64Data && typeof base64Data === 'string' && base64Data.includes(',')) {
          base64Data = base64Data.split(',')[1];
        }

        // 解码为文本内容
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        // 尝试解码为 UTF-8 文本
        const decoder = new TextDecoder('utf-8');
        const content = decoder.decode(bytes);

        return { content, encoding: options.encoding };
      } catch (error) {
        console.error('解码文件内容失败:', error);
        throw new Error('无法读取文件内容，可能不是文本文件');
      }
    }
  };
};

/**
 * 文件块组件
 * 用于显示文件信息和提供下载功能
 */
const FileBlock: React.FC<Props> = ({ block }) => {
  const theme = useTheme();
  const [viewerOpen, setViewerOpen] = useState(false);
  const [workspaceFile, setWorkspaceFile] = useState<WorkspaceFile | null>(null);

  if (!block.file) {
    return (
      <Box sx={{ p: 2, border: '1px solid #e0e0e0', borderRadius: 1 }}>
        <Typography color="error">文件信息不可用</Typography>
      </Box>
    );
  }

  const { file } = block;

  // 判断文件是否可以编辑（文本或代码文件）
  const isEditableFile = () => {
    const fileName = file.origin_name || file.name || '';
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    const textExts = ['txt', 'md', 'json', 'xml', 'csv', 'log', 'yaml', 'yml'];
    const codeExts = ['js', 'ts', 'jsx', 'tsx', 'html', 'css', 'scss', 'py', 'java', 'cpp', 'c', 'h'];
    return textExts.includes(ext) || codeExts.includes(ext);
  };

  // 处理文件查看
  const handleViewFile = () => {
    const convertedFile = convertToWorkspaceFile(block);
    if (convertedFile) {
      setWorkspaceFile(convertedFile);
      setViewerOpen(true);
    }
  };

  // 处理编辑器关闭
  const handleCloseViewer = () => {
    setViewerOpen(false);
    setWorkspaceFile(null);
  };

  // 处理文件保存（暂时只是提示，实际保存需要更复杂的逻辑）
  const handleSaveFile = async (content: string) => {
    console.log('保存文件内容:', content);
    // TODO: 实现实际的保存逻辑
    alert('文件保存功能暂未实现，这是演示版本');
  };

  // 根据文件类型选择图标
  const getFileIcon = () => {
    switch (file.type) {
      case FileTypes.IMAGE:
        return <ImageIcon size={24} />;
      case FileTypes.TEXT:
      case FileTypes.DOCUMENT:
        return <DocumentIcon size={24} />;
      case FileTypes.CODE:
        return <CodeIcon size={24} />;
      case FileTypes.ARCHIVE:
        return <ArchiveIcon size={24} />;
      default:
        return <FileIcon size={24} />;
    }
  };

  // 格式化文件大小
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 处理文件下载
  const handleDownload = () => {
    if (!file.base64Data) {
      console.warn('文件没有base64数据，无法下载');
      return;
    }

    try {
      // 创建下载链接
      const link = document.createElement('a');

      // 处理base64数据
      let base64Data = file.base64Data;
      if (base64Data.includes(',')) {
        base64Data = base64Data.split(',')[1];
      }

      // 创建Blob
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: file.mimeType || 'application/octet-stream' });

      // 创建下载URL
      const url = URL.createObjectURL(blob);
      link.href = url;
      link.download = file.origin_name || file.name || '下载文件';

      // 触发下载
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // 清理URL
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('文件下载失败:', error);
    }
  };

  return (
    <>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          p: 2,
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: 1,
          backgroundColor: theme.palette.mode === 'dark'
            ? 'rgba(255, 255, 255, 0.05)'
            : 'rgba(0, 0, 0, 0.02)',
          maxWidth: '400px',
          gap: 2,
          cursor: isEditableFile() ? 'pointer' : 'default',
          '&:hover': isEditableFile() ? {
            backgroundColor: theme.palette.mode === 'dark'
              ? 'rgba(255, 255, 255, 0.08)'
              : 'rgba(0, 0, 0, 0.04)',
            borderColor: theme.palette.primary.main
          } : {}
        }}
        onClick={isEditableFile() ? handleViewFile : undefined}
      >
      {/* 文件图标 */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 40,
          height: 40,
          borderRadius: 1,
          backgroundColor: theme.palette.mode === 'dark'
            ? 'rgba(33, 150, 243, 0.15)'
            : 'rgba(33, 150, 243, 0.1)',
          color: theme.palette.primary.main
        }}
      >
        {getFileIcon()}
      </Box>

      {/* 文件信息 */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          variant="body2"
          sx={{
            fontWeight: 500,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {file.origin_name || file.name || '未知文件'}
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
          <Typography variant="caption" color="text.secondary">
            {formatFileSize(file.size || 0)}
          </Typography>

          {(() => {
            const fileName = file.origin_name || file.name || '';
            if (!fileName) return null;
            const parts = fileName.split('.');
            const ext = parts.length > 1 ? parts.pop() : '';
            return ext && ext !== fileName ? (
              <Chip
                label={ext.toUpperCase()}
                size="small"
                variant="outlined"
                sx={{ height: 20, fontSize: '0.7rem' }}
              />
            ) : null;
          })()}
        </Box>
      </Box>

      {/* 操作按钮 */}
      <Box sx={{ display: 'flex', gap: 0.5 }}>
        {/* 查看按钮 - 仅对可编辑文件显示 */}
        {isEditableFile() && (
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation(); // 防止触发外层点击事件
              handleViewFile();
            }}
            sx={{
              color: theme.palette.primary.main,
              '&:hover': {
                backgroundColor: theme.palette.mode === 'dark'
                  ? 'rgba(33, 150, 243, 0.15)'
                  : 'rgba(33, 150, 243, 0.1)'
              }
            }}
            title="查看/编辑文件"
          >
            <ViewIcon size={16} />
          </IconButton>
        )}

        {/* 下载按钮 */}
        {file.base64Data && (
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation(); // 防止触发外层点击事件
              handleDownload();
            }}
            sx={{
              color: theme.palette.primary.main,
              '&:hover': {
                backgroundColor: theme.palette.mode === 'dark'
                  ? 'rgba(33, 150, 243, 0.15)'
                  : 'rgba(33, 150, 243, 0.1)'
              }
            }}
            title="下载文件"
          >
            <DownloadIcon size={16} />
          </IconButton>
        )}
      </Box>
    </Box>

    {/* 文件查看器 */}
    <MobileFileViewer
      open={viewerOpen}
      file={workspaceFile}
      onClose={handleCloseViewer}
      onSave={handleSaveFile}
      customFileReader={createFileReaderService(block)}
    />
  </>
  );
};

export default React.memo(FileBlock);
