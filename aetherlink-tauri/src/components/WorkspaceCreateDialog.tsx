/**
 * 工作区创建对话框
 * 使用系统文件选择器选择文件夹，简化创建流程
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  CardActionArea
} from '@mui/material';
import {
  FolderOpen as FolderOpenIcon,
  Folder as FolderIcon
} from 'lucide-react';
import { workspaceService } from '../shared/services/WorkspaceService';
import { advancedFileManagerService } from '../shared/services/AdvancedFileManagerService';
import type { WorkspaceCreateRequest } from '../shared/types/workspace';

interface WorkspaceCreateDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const WorkspaceCreateDialog: React.FC<WorkspaceCreateDialogProps> = ({
  open,
  onClose,
  onSuccess
}) => {
  const [selectedPath, setSelectedPath] = useState(''); // 实际路径（content URI）
  const [displayPath, setDisplayPath] = useState(''); // 显示路径（友好路径）
  const [workspaceName, setWorkspaceName] = useState('');
  const [workspaceDescription, setWorkspaceDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);

  // 重置对话框状态
  const resetDialog = () => {
    setSelectedPath('');
    setDisplayPath('');
    setWorkspaceName('');
    setWorkspaceDescription('');
    setError(null);
    setLoading(false);
    setSelecting(false);
  };

  // 处理关闭
  const handleClose = () => {
    if (!loading && !selecting) {
      resetDialog();
      onClose();
    }
  };

  // 选择文件夹
  const selectFolder = async () => {
    try {
      setSelecting(true);
      setError(null);

      // 首先检查权限
      const permissionResult = await advancedFileManagerService.checkPermissions();
      if (!permissionResult.granted) {
        console.log('权限未授予，尝试请求权限...');
        const requestResult = await advancedFileManagerService.requestPermissions();
        if (!requestResult.granted) {
          setError('需要文件访问权限才能选择文件夹。Android 11+需要在设置中授予"所有文件访问权限"。');
          setSelecting(false);
          return;
        }
      }

      const result = await advancedFileManagerService.openSystemFilePicker({
        type: 'directory',
        multiple: false,
        title: '选择工作区文件夹'
      });

      if (!result.cancelled && result.directories.length > 0) {
        const selectedDir = result.directories[0];

        console.log('选择的目录信息:', selectedDir);

        // 优先使用转换后的友好路径，如果没有则使用原始路径
        const pathToUse = selectedDir.displayPath || selectedDir.path || selectedDir.uri || (typeof selectedDir === 'string' ? selectedDir : '');
        setSelectedPath(pathToUse);
        setDisplayPath(pathToUse);

        // 自动生成工作区名称 - 现在服务已经处理了名称提取
        if (!workspaceName) {
          setWorkspaceName(selectedDir.name || '新工作区');
        }
      }
    } catch (err) {
      console.error('选择文件夹失败:', err);
      setError('选择文件夹失败，请手动输入路径');
    } finally {
      setSelecting(false);
    }
  };

  // 创建工作区
  const createWorkspace = async () => {
    if (!selectedPath.trim() || !workspaceName.trim()) {
      setError('请填写完整信息');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const request: WorkspaceCreateRequest = {
        name: workspaceName.trim(),
        path: selectedPath.trim(),
        description: workspaceDescription.trim() || undefined
      };

      const result = await workspaceService.createWorkspace(request);
      
      if (result.success) {
        resetDialog();
        onSuccess();
      } else {
        setError(result.error || '创建工作区失败');
      }
    } catch (err) {
      setError('创建工作区失败，请重试');
      console.error('创建工作区失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const canCreate = selectedPath.trim() && workspaceName.trim();

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Typography variant="h6">创建新工作区</Typography>
      </DialogTitle>

      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* 文件夹选择 */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="body1" gutterBottom>
            选择工作区文件夹：
          </Typography>
          
          <Card variant="outlined" sx={{ mb: 2 }}>
            <CardActionArea onClick={selectFolder} disabled={selecting}>
              <CardContent sx={{ textAlign: 'center', py: 3 }}>
                {selecting ? (
                  <CircularProgress size={40} />
                ) : (
                  <FolderOpenIcon size={40} style={{ color: '#1976d2', marginBottom: 8 }} />
                )}
                <Typography variant="body1" color={selecting ? 'text.secondary' : 'primary'}>
                  {selecting ? '选择中...' : '点击选择文件夹'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  使用系统文件管理器选择
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>

          <TextField
            fullWidth
            label="文件夹路径"
            placeholder="例如: /storage/emulated/0/Download"
            value={displayPath || selectedPath}
            onChange={(e) => {
              const newPath = e.target.value;
              setSelectedPath(newPath);
              setDisplayPath(newPath);
              // 自动生成工作区名称
              if (!workspaceName && newPath && typeof newPath === 'string') {
                const folderName = newPath.split('/').pop() || '新工作区';
                setWorkspaceName(folderName);
              }
            }}
            helperText="请输入完整的文件夹路径"
          />
        </Box>

        {/* 工作区信息 */}
        <Box>
          <Typography variant="body1" gutterBottom>
            工作区信息：
          </Typography>
          
          <TextField
            fullWidth
            label="工作区名称"
            value={workspaceName}
            onChange={(e) => setWorkspaceName(e.target.value)}
            sx={{ mb: 2 }}
            required
          />
          
          <TextField
            fullWidth
            label="描述（可选）"
            value={workspaceDescription}
            onChange={(e) => setWorkspaceDescription(e.target.value)}
            multiline
            rows={3}
            placeholder="描述这个工作区的用途..."
          />
        </Box>

        {(displayPath || selectedPath) && (
          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2">
              <strong>文件夹路径：</strong> {displayPath || selectedPath}
            </Typography>
          </Alert>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          取消
        </Button>
        <Button
          onClick={createWorkspace}
          variant="contained"
          disabled={!canCreate || loading}
          startIcon={loading ? <CircularProgress size={16} /> : <FolderIcon />}
        >
          {loading ? '创建中...' : '创建工作区'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
