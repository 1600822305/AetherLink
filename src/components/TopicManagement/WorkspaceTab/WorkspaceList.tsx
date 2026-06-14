import React, { useState, useEffect } from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemButton,
  IconButton,
  Typography,
  Breadcrumbs,
  Link,
  Menu,
  MenuItem,
  TextField,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  CircularProgress,
  Tooltip
} from '@mui/material';
import BackButtonDialog from '../../common/BackButtonDialog';
import {
  Folder as FolderIcon,
  FileText as FileIcon,
  MoreVertical,
  Plus,
  FolderPlus,
  ArrowLeft,
  Trash2,
  RefreshCw,
  Home
} from 'lucide-react';
import { workspaceService } from '../../../shared/services/files/WorkspaceService';
import type { Workspace, WorkspaceFile } from '../../../shared/types/workspace';
import { toastManager } from '../../EnhancedToast';
import { createLogger } from '../../../shared/services/infra/logger';

const logger = createLogger('WorkspaceList');

interface WorkspaceListProps {
  onSelectWorkspace: (workspaceId: string) => void;
}

const WorkspaceList: React.FC<WorkspaceListProps> = ({ onSelectWorkspace }) => {
  // 视图模式: 'workspaces' 显示工作区列表, 'files' 显示文件列表
  const [viewMode, setViewMode] = useState<'workspaces' | 'files'>('workspaces');
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [currentPath, setCurrentPath] = useState('');
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedFile, setSelectedFile] = useState<WorkspaceFile | null>(null);
  
  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createType, setCreateType] = useState<'file' | 'folder'>('file');
  const [newItemName, setNewItemName] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  useEffect(() => {
    loadWorkspaces();
  }, []);

  const loadWorkspaces = async () => {
    setLoading(true);
    try {
      const result = await workspaceService.getWorkspaces();
      setWorkspaces(result.workspaces);
    } catch (error) {
      logger.error('加载工作区失败:', error);
      toastManager.error('加载工作区失败', '错误');
    } finally {
      setLoading(false);
    }
  };

  const loadFiles = async (workspaceId: string, subPath: string = '') => {
    setLoading(true);
    try {
      const result = await workspaceService.getWorkspaceFilesAdvanced(workspaceId, subPath);
      setFiles(result.files);
      setCurrentPath(subPath);
    } catch (error) {
      logger.error('加载文件失败:', error);
      toastManager.error('加载文件失败', '错误');
    } finally {
      setLoading(false);
    }
  };

  const handleWorkspaceClick = (workspace: Workspace) => {
    setCurrentWorkspace(workspace);
    setViewMode('files');
    loadFiles(workspace.id);
  };

  const handleFileClick = (file: WorkspaceFile) => {
    if (file.isDirectory && currentWorkspace) {
      const newPath = currentPath ? `${currentPath}/${file.name}` : file.name;
      loadFiles(currentWorkspace.id, newPath);
    } else {
      // 点击文件，可以跳转到工作区详情页面
      if (currentWorkspace) {
        onSelectWorkspace(currentWorkspace.id);
      }
    }
  };

  const handleBackToWorkspaces = () => {
    setViewMode('workspaces');
    setCurrentWorkspace(null);
    setCurrentPath('');
    setFiles([]);
  };

  const handleBackToParent = () => {
    if (!currentWorkspace) return;
    
    if (currentPath) {
      const parts = currentPath.split('/');
      const parentPath = parts.slice(0, -1).join('/');
      loadFiles(currentWorkspace.id, parentPath);
    } else {
      handleBackToWorkspaces();
    }
  };

  const handleBreadcrumbClick = (index: number) => {
    if (!currentWorkspace) return;
    
    if (index === -1) {
      // 点击工作区名称，回到工作区根目录
      loadFiles(currentWorkspace.id, '');
    } else if (index === -2) {
      // 点击"工作区"，回到工作区列表
      handleBackToWorkspaces();
    } else {
      const parts = currentPath.split('/');
      const newPath = parts.slice(0, index + 1).join('/');
      loadFiles(currentWorkspace.id, newPath);
    }
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, file: WorkspaceFile) => {
    event.stopPropagation();
    setMenuAnchorEl(event.currentTarget);
    setSelectedFile(file);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setSelectedFile(null);
  };

  const handleOpenCreateDialog = (type: 'file' | 'folder') => {
    if (!currentWorkspace) {
      toastManager.warning('请先选择工作区', '提示');
      return;
    }
    setCreateType(type);
    setNewItemName('');
    setCreateDialogOpen(true);
  };

  const handleCreate = async () => {
    if (!newItemName || !currentWorkspace) return;
    try {
      const fullPath = currentPath 
        ? `${currentWorkspace.path}/${currentPath}` 
        : currentWorkspace.path;
      
      if (createType === 'folder') {
        await workspaceService.createFolder(currentWorkspace.id, fullPath, newItemName);
      } else {
        await workspaceService.createFile(currentWorkspace.id, fullPath, newItemName);
      }
      setCreateDialogOpen(false);
      setNewItemName('');
      loadFiles(currentWorkspace.id, currentPath);
      toastManager.success(`${createType === 'folder' ? '文件夹' : '文件'}创建成功`, '成功');
    } catch (error) {
      logger.error('创建失败:', error);
      toastManager.error('创建失败: ' + (error instanceof Error ? error.message : String(error)), '错误');
    }
  };

  const handleOpenDeleteDialog = () => {
    if (selectedFile) {
      setDeleteDialogOpen(true);
      handleMenuClose();
    }
  };

  const handleDelete = async () => {
    if (!selectedFile || !currentWorkspace) return;
    try {
      await workspaceService.deleteItem(currentWorkspace.id, selectedFile.path, selectedFile.isDirectory);
      setDeleteDialogOpen(false);
      loadFiles(currentWorkspace.id, currentPath);
      toastManager.success('删除成功', '成功');
    } catch (error) {
      logger.error('删除失败:', error);
      toastManager.error('删除失败', '错误');
    }
  };

  const pathParts = currentPath ? currentPath.split('/') : [];

  // 工作区列表视图
  if (viewMode === 'workspaces') {
    return (
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {/* Toolbar */}
        <Box sx={{ 
          p: 1, 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1, 
          borderBottom: 1, 
          borderColor: 'divider',
          flexShrink: 0
        }}>
          <Home size={18} style={{ marginLeft: 4 }} />
          <Typography variant="subtitle2" sx={{ flexGrow: 1, fontWeight: 600 }}>
            工作区列表
          </Typography>
          <Tooltip title="刷新">
            <IconButton onClick={loadWorkspaces} size="small">
              <RefreshCw size={18} />
            </IconButton>
          </Tooltip>
        </Box>

        {/* List */}
        <Box sx={{ 
          flex: 1, 
          overflow: 'auto',
          minHeight: 0,
          pb: 'calc(16px + env(safe-area-inset-bottom, 0px))'  // 底部安全区域
        }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress size={24} />
            </Box>
          ) : workspaces.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="text.secondary" gutterBottom>
                还没有工作区
              </Typography>
              <Button variant="contained" href="/settings/workspace" size="small">
                去创建
              </Button>
            </Box>
          ) : (
            <List dense disablePadding>
              {workspaces.map((workspace) => (
                <ListItem key={workspace.id} disablePadding>
                  <ListItemButton onClick={() => handleWorkspaceClick(workspace)} sx={{ py: 1.5 }}>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <FolderIcon size={20} color="#1976d2" />
                    </ListItemIcon>
                    <ListItemText
                      primary={workspace.name}
                      secondary={
                        <Typography 
                          variant="caption" 
                          color="text.secondary"
                          sx={{ 
                            display: 'block',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: '200px'
                          }}
                        >
                          {workspace.path}
                        </Typography>
                      }
                      primaryTypographyProps={{ 
                        noWrap: true, 
                        fontWeight: 500,
                        sx: { mb: 0.5 }
                      }}
                      secondaryTypographyProps={{ component: 'div' }}
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          )}
        </Box>
      </Box>
    );
  }

  // 文件列表视图
  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Toolbar */}
      <Box sx={{ 
        p: 1, 
        display: 'flex', 
        alignItems: 'center', 
        gap: 1, 
        borderBottom: 1, 
        borderColor: 'divider',
        flexShrink: 0
      }}>
        <IconButton onClick={handleBackToParent} size="small">
          <ArrowLeft size={18} />
        </IconButton>
        
        <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
          <Breadcrumbs 
            maxItems={3} 
            itemsBeforeCollapse={1}
            itemsAfterCollapse={1}
            separator="›"
            sx={{ '& .MuiBreadcrumbs-ol': { flexWrap: 'nowrap' } }}
          >
            <Link
              component="button"
              color="inherit"
              onClick={() => handleBreadcrumbClick(-2)}
              sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', fontSize: '0.8rem' }}
            >
              <Home size={14} style={{ marginRight: 2 }} />
              工作区
            </Link>
            <Link
              component="button"
              color="inherit"
              onClick={() => handleBreadcrumbClick(-1)}
              sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', fontSize: '0.8rem' }}
            >
              <FolderIcon size={14} style={{ marginRight: 2 }} />
              {currentWorkspace?.name}
            </Link>
            {pathParts.map((part, index) => (
              <Typography key={index} color="text.primary" noWrap sx={{ maxWidth: 80, fontSize: '0.8rem' }}>
                {part}
              </Typography>
            ))}
          </Breadcrumbs>
        </Box>

        <Tooltip title="刷新">
          <IconButton onClick={() => currentWorkspace && loadFiles(currentWorkspace.id, currentPath)} size="small">
            <RefreshCw size={18} />
          </IconButton>
        </Tooltip>
        <Tooltip title="新建文件夹">
          <IconButton onClick={() => handleOpenCreateDialog('folder')} size="small">
            <FolderPlus size={18} />
          </IconButton>
        </Tooltip>
        <Tooltip title="新建文件">
          <IconButton onClick={() => handleOpenCreateDialog('file')} size="small" color="primary">
            <Plus size={18} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* List */}
      <Box sx={{ 
        flex: 1, 
        overflow: 'auto',
        minHeight: 0,
        pb: 'calc(16px + env(safe-area-inset-bottom, 0px))'  // 底部安全区域
      }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress size={24} />
          </Box>
        ) : files.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="text.secondary">空文件夹</Typography>
          </Box>
        ) : (
          <List dense disablePadding>
            {files.map((file) => (
              <ListItem
                key={file.path}
                disablePadding
                secondaryAction={
                  <IconButton edge="end" onClick={(e) => handleMenuOpen(e, file)} size="small">
                    <MoreVertical size={16} />
                  </IconButton>
                }
              >
                <ListItemButton onClick={() => handleFileClick(file)} sx={{ py: 1 }}>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    {file.isDirectory ? (
                      <FolderIcon size={20} color="#FBC02D" />
                    ) : (
                      <FileIcon size={20} color="#42A5F5" />
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary={file.name}
                    secondary={file.size ? `${(file.size / 1024).toFixed(1)} KB` : null}
                    primaryTypographyProps={{ 
                      sx: {
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }
                    }}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}
      </Box>

      {/* Context Menu */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleOpenDeleteDialog} sx={{ color: 'error.main' }}>
          <ListItemIcon><Trash2 size={16} color="var(--mui-palette-error-main)" /></ListItemIcon>
          删除
        </MenuItem>
      </Menu>

      {/* Create Dialog */}
      <BackButtonDialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)}>
        <DialogTitle>新建{createType === 'folder' ? '文件夹' : '文件'}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="名称"
            fullWidth
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleCreate()}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>取消</Button>
          <Button onClick={handleCreate} variant="contained">创建</Button>
        </DialogActions>
      </BackButtonDialog>

      {/* Delete Dialog */}
      <BackButtonDialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>确认删除</DialogTitle>
        <DialogContent>
          <Typography>
            确定要删除 "{selectedFile?.name}" 吗？
            {selectedFile?.isDirectory && " 该文件夹内的所有内容也将被删除。"}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>取消</Button>
          <Button onClick={handleDelete} color="error" variant="contained">删除</Button>
        </DialogActions>
      </BackButtonDialog>
    </Box>
  );
};

export default WorkspaceList;
