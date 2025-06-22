import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Checkbox,
  Typography,
  Box,
  Alert,
  CircularProgress,
  Chip
} from '@mui/material';
import {
  Trash2 as DeleteIcon,
  RotateCcw as RestoreIcon,
  RefreshCw as RefreshIcon,
  CloudDownload as CloudDownloadIcon
} from 'lucide-react';
import type { WebDavConfig, WebDavBackupFile } from '../../../../../shared/types';
import { WebDavBackupService } from '../../../../../shared/services/storage/WebDavBackupService';
import { formatFileSize, formatDateTime, parseBackupFileName } from '../../../../../shared/utils/webdavUtils';

interface WebDavBackupManagerProps {
  open: boolean;
  onClose: () => void;
  config: WebDavConfig | null;
  onRestore?: (fileName: string, data: any) => Promise<void>;
}

const WebDavBackupManager: React.FC<WebDavBackupManagerProps> = ({
  open,
  onClose,
  config,
  onRestore
}) => {
  const [files, setFiles] = useState<WebDavBackupFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const webdavService = WebDavBackupService.getInstance();

  useEffect(() => {
    if (open && config) {
      loadFiles();
    }
  }, [open, config]);

  const loadFiles = async () => {
    if (!config) return;

    setLoading(true);
    setError(null);

    try {
      await webdavService.initialize(config);
      const fileList = await webdavService.getBackupFilesList();
      setFiles(fileList);
      setSelectedFiles([]);
    } catch (error) {
      setError(`加载文件列表失败: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectFile = (fileName: string) => {
    setSelectedFiles(prev =>
      prev.includes(fileName)
        ? prev.filter(f => f !== fileName)
        : [...prev, fileName]
    );
  };

  const handleSelectAll = () => {
    if (selectedFiles.length === files.length) {
      setSelectedFiles([]);
    } else {
      setSelectedFiles(files.map(f => f.fileName));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedFiles.length === 0) return;

    setDeleting(true);
    setError(null);

    try {
      for (const fileName of selectedFiles) {
        const result = await webdavService.deleteBackupFile(fileName);
        if (!result.success) {
          throw new Error(result.error || `删除文件 ${fileName} 失败`);
        }
      }

      await loadFiles();
      setSelectedFiles([]);
    } catch (error) {
      setError(`删除文件失败: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setDeleting(false);
    }
  };

  const handleRestore = async (fileName: string) => {
    if (!onRestore) return;

    setRestoring(true);
    setError(null);

    try {
      const result = await webdavService.restoreFromWebDav(fileName);
      if (result.success && result.data) {
        await onRestore(fileName, result.data);
        onClose();
      } else {
        throw new Error(result.error || '恢复失败');
      }
    } catch (error) {
      setError(`恢复失败: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setRestoring(false);
    }
  };

  const renderFileType = (fileName: string) => {
    const { type, isValid } = parseBackupFileName(fileName);

    if (!isValid) {
      return <Chip label="未知" size="small" color="default" />;
    }

    const typeMap: Record<string, { label: string; color: any }> = {
      'AetherLink_Backup': { label: '基础备份', color: 'primary' },
      'AetherLink_FullBackup': { label: '完整备份', color: 'secondary' },
      'AetherLink_CustomBackup': { label: '自定义备份', color: 'info' }
    };

    const typeInfo = typeMap[type] || { label: '备份', color: 'default' };
    return <Chip label={typeInfo.label} size="small" color={typeInfo.color} />;
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { height: '80vh' }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <CloudDownloadIcon style={{ marginRight: 8 }} />
            WebDAV 备份管理
          </Box>
          <Button
            startIcon={<RefreshIcon />}
            onClick={loadFiles}
            disabled={loading}
            size="small"
          >
            刷新
          </Button>
        </Box>
      </DialogTitle>

      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : files.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="textSecondary">
              暂无备份文件
            </Typography>
          </Box>
        ) : (
          <>
            <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="textSecondary">
                共 {files.length} 个备份文件
              </Typography>

              {selectedFiles.length > 0 && (
                <Button
                  startIcon={<DeleteIcon />}
                  color="error"
                  onClick={handleDeleteSelected}
                  disabled={deleting}
                  size="small"
                >
                  删除选中 ({selectedFiles.length})
                </Button>
              )}
            </Box>

            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selectedFiles.length === files.length && files.length > 0}
                        indeterminate={selectedFiles.length > 0 && selectedFiles.length < files.length}
                        onChange={handleSelectAll}
                      />
                    </TableCell>
                    <TableCell>文件名</TableCell>
                    <TableCell>类型</TableCell>
                    <TableCell>修改时间</TableCell>
                    <TableCell>大小</TableCell>
                    <TableCell>操作</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {files.map((file) => (
                    <TableRow key={file.fileName} hover>
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selectedFiles.includes(file.fileName)}
                          onChange={() => handleSelectFile(file.fileName)}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" noWrap>
                          {file.fileName}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {renderFileType(file.fileName)}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {formatDateTime(file.modifiedTime)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {formatFileSize(file.size)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <IconButton
                            size="small"
                            onClick={() => handleRestore(file.fileName)}
                            disabled={restoring || deleting}
                            title="恢复此备份"
                            color="primary"
                          >
                            <RestoreIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeleteSelected()}
                            disabled={deleting || restoring}
                            title="删除文件"
                            sx={{ display: selectedFiles.includes(file.fileName) ? 'inline-flex' : 'none' }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>
          关闭
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default WebDavBackupManager;
