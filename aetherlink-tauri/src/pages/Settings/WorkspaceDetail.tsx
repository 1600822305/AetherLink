/**
 * 工作区详情页面
 * 显示工作区内的文件和文件夹，支持文件夹导航
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  AppBar,
  Toolbar,
  IconButton,
  Breadcrumbs,
  Link,
  Alert,
  Chip,
  Divider,
  Paper,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button
} from '@mui/material';
import {
  ArrowLeft as ArrowBackIcon,
  Folder as FolderIcon,
  File as FileIcon,
  Home as HomeIcon,
  ChevronRight as NavigateNextIcon,
  FolderOpen as FolderOpenIcon,
  MoreVertical as MoreVertIcon,
  FolderPlus as CreateFolderIcon,
  FilePlus as CreateFileIcon,
  Edit as EditIcon,
  Trash2 as DeleteIcon,
  Search as SearchIcon,
  FileText,
  Code,
  Image,
  FileVideo,
  FileAudio,
  Archive,
  Settings as ConfigIcon
} from 'lucide-react';
import { workspaceService } from '../../shared/services/WorkspaceService';
import { MobileFileViewer } from '../../components/MobileFileViewer';
import { advancedFileManagerService } from '../../shared/services/AdvancedFileManagerService';
import type { Workspace, WorkspaceFile } from '../../shared/types/workspace';
import dayjs from 'dayjs';

const WorkspaceDetail: React.FC = () => {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [parentPath, setParentPath] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pathHistory, setPathHistory] = useState<string[]>([]);

  // 文件操作相关状态
  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
    file: WorkspaceFile | null;
  } | null>(null);
  const [createFolderDialog, setCreateFolderDialog] = useState(false);
  const [createFileDialog, setCreateFileDialog] = useState(false);
  const [renameDialog, setRenameDialog] = useState<{ open: boolean; file: WorkspaceFile | null }>({ open: false, file: null });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; file: WorkspaceFile | null }>({ open: false, file: null });
  const [newItemName, setNewItemName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<WorkspaceFile[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // 文件查看器状态
  const [fileViewerOpen, setFileViewerOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<WorkspaceFile | null>(null);

  // 获取文件图标
  const getFileIcon = (file: WorkspaceFile) => {
    if (file.isDirectory) {
      return <FolderIcon size={20} color="#1976d2" />;
    }

    const extension = file.name.split('.').pop()?.toLowerCase();

    // 文本文件
    const textExts = ['txt', 'md', 'readme', 'log', 'csv'];
    if (textExts.includes(extension || '')) {
      return <FileText size={20} color="#666" />;
    }

    // 代码文件
    const codeExts = ['js', 'ts', 'jsx', 'tsx', 'html', 'css', 'scss', 'py', 'java', 'cpp', 'c', 'h', 'json', 'xml', 'yaml', 'yml'];
    if (codeExts.includes(extension || '')) {
      return <Code size={20} color="#4caf50" />;
    }

    // 图片文件
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'ico'];
    if (imageExts.includes(extension || '')) {
      return <Image size={20} color="#ff9800" />;
    }

    // 视频文件
    const videoExts = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv'];
    if (videoExts.includes(extension || '')) {
      return <FileVideo size={20} color="#e91e63" />;
    }

    // 音频文件
    const audioExts = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma'];
    if (audioExts.includes(extension || '')) {
      return <FileAudio size={20} color="#9c27b0" />;
    }

    // 压缩文件
    const archiveExts = ['zip', 'rar', '7z', 'tar', 'gz', 'bz2'];
    if (archiveExts.includes(extension || '')) {
      return <Archive size={20} color="#795548" />;
    }

    // 配置文件
    const configExts = ['config', 'conf', 'ini', 'properties', 'env'];
    if (configExts.includes(extension || '')) {
      return <ConfigIcon size={20} color="#607d8b" />;
    }

    // 默认文件图标
    return <FileIcon size={20} color="#757575" />;
  };

  // 加载工作区信息
  const loadWorkspace = async () => {
    if (!workspaceId) return;
    
    try {
      const ws = await workspaceService.getWorkspace(workspaceId);
      if (!ws) {
        setError('工作区不存在');
        return;
      }
      setWorkspace(ws);
    } catch (err) {
      setError('加载工作区信息失败');
      console.error('加载工作区失败:', err);
    }
  };

  // 加载文件列表
  const loadFiles = async (subPath: string = '') => {
    if (!workspaceId) return;

    try {
      setLoading(true);
      setError(null);

      // 优先使用高级文件管理器
      const result = await workspaceService.getWorkspaceFilesAdvanced(workspaceId, subPath);
      setFiles(result.files);
      setCurrentPath(result.currentPath);
      setParentPath(result.parentPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载文件列表失败');
      console.error('加载文件失败:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkspace();
    loadFiles();
  }, [workspaceId]);

  // 处理返回
  const handleBack = () => {
    navigate('/settings/workspace');
  };

  // 进入文件夹
  const enterFolder = (file: WorkspaceFile) => {
    if (!file.isDirectory) return;

    const newSubPath = currentPath === workspace?.path 
      ? file.name 
      : `${currentPath.replace(workspace?.path || '', '').replace(/^\//, '')}/${file.name}`;
    
    setPathHistory([...pathHistory, currentPath]);
    loadFiles(newSubPath);
  };

  // 返回上级目录
  const goBack = () => {
    if (pathHistory.length > 0) {
      const previousPath = pathHistory[pathHistory.length - 1];
      const newHistory = pathHistory.slice(0, -1);
      setPathHistory(newHistory);
      
      const subPath = previousPath === workspace?.path 
        ? '' 
        : previousPath.replace(workspace?.path || '', '').replace(/^\//, '');
      
      loadFiles(subPath);
    } else if (parentPath !== undefined) {
      loadFiles(parentPath);
    }
  };

  // 返回根目录
  const goToRoot = () => {
    setPathHistory([]);
    loadFiles();
  };

  // 格式化文件大小
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };



  // 文件操作处理函数
  const handleContextMenu = (event: React.MouseEvent, file: WorkspaceFile) => {
    event.preventDefault();
    setContextMenu({
      mouseX: event.clientX - 2,
      mouseY: event.clientY - 4,
      file
    });
  };

  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  const handleCreateFolder = async () => {
    if (!workspaceId || !newItemName.trim()) return;

    try {
      const result = await workspaceService.createFolder(workspaceId, currentPath, newItemName.trim());
      if (result.success) {
        setCreateFolderDialog(false);
        setNewItemName('');
        loadFiles(currentPath === workspace?.path ? '' : currentPath.replace(workspace?.path || '', '').replace(/^\//, ''));
      } else {
        setError(result.error || '创建文件夹失败');
      }
    } catch (err) {
      setError('创建文件夹失败');
      console.error('创建文件夹失败:', err);
    }
  };

  const handleCreateFile = async () => {
    if (!workspaceId || !newItemName.trim()) return;

    try {
      // 如果文件名没有扩展名，默认添加.txt
      let fileName = newItemName.trim();
      if (!fileName.includes('.')) {
        fileName += '.txt';
      }

      const result = await workspaceService.createFile(workspaceId, currentPath, fileName);
      if (result.success) {
        setCreateFileDialog(false);
        setNewItemName('');
        loadFiles(currentPath === workspace?.path ? '' : currentPath.replace(workspace?.path || '', '').replace(/^\//, ''));
      } else {
        setError(result.error || '创建文件失败');
      }
    } catch (err) {
      setError('创建文件失败');
      console.error('创建文件失败:', err);
    }
  };

  const handleDeleteItem = async () => {
    if (!workspaceId || !deleteDialog.file) return;

    try {
      const result = await workspaceService.deleteItem(
        workspaceId,
        deleteDialog.file.path,
        deleteDialog.file.isDirectory
      );
      if (result.success) {
        setDeleteDialog({ open: false, file: null });
        loadFiles(currentPath === workspace?.path ? '' : currentPath.replace(workspace?.path || '', '').replace(/^\//, ''));
      } else {
        setError(result.error || '删除失败');
      }
    } catch (err) {
      setError('删除失败');
      console.error('删除失败:', err);
    }
  };

  const handleRenameItem = async () => {
    if (!workspaceId || !renameDialog.file || !newItemName.trim()) return;

    try {
      const result = await workspaceService.renameItem(workspaceId, renameDialog.file.path, newItemName.trim());
      if (result.success) {
        setRenameDialog({ open: false, file: null });
        setNewItemName('');
        loadFiles(currentPath === workspace?.path ? '' : currentPath.replace(workspace?.path || '', '').replace(/^\//, ''));
      } else {
        setError(result.error || '重命名失败');
      }
    } catch (err) {
      setError('重命名失败');
      console.error('重命名失败:', err);
    }
  };

  const handleSearch = async () => {
    if (!workspaceId || !searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setIsSearching(true);
      const result = await workspaceService.searchFiles(workspaceId, searchQuery.trim());
      if (result.success && result.files) {
        setSearchResults(result.files);
      } else {
        setError(result.error || '搜索失败');
      }
    } catch (err) {
      setError('搜索失败');
      console.error('搜索失败:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
  };

  // 打开文件查看器
  const openFileViewer = (file: WorkspaceFile) => {
    setSelectedFile(file);
    setFileViewerOpen(true);
  };

  // 关闭文件查看器
  const closeFileViewer = () => {
    setFileViewerOpen(false);
    setSelectedFile(null);
  };

  // 保存文件内容
  const saveFileContent = async (content: string) => {
    if (!selectedFile) return;

    try {
      await advancedFileManagerService.writeFile({
        path: selectedFile.path,
        content: content,
        encoding: 'utf8',
        append: false
      });

      // 刷新文件列表
      const subPath = currentPath === workspace?.path ? '' : currentPath.replace(workspace?.path || '', '').replace(/^\//, '');
      loadFiles(subPath);
    } catch (error) {
      throw new Error('保存文件失败: ' + (error instanceof Error ? error.message : String(error)));
    }
  };

  // 生成面包屑导航
  const generateBreadcrumbs = () => {
    if (!workspace) return [];

    const breadcrumbs = [
      {
        label: workspace.name,
        path: workspace.path,
        isRoot: true
      }
    ];

    if (currentPath !== workspace.path) {
      const relativePath = currentPath.replace(workspace.path, '').replace(/^\//, '');
      const pathParts = relativePath.split('/').filter(part => part);

      pathParts.forEach((part, index) => {
        breadcrumbs.push({
          label: part,
          path: `${workspace.path}/${pathParts.slice(0, index + 1).join('/')}`,
          isRoot: false
        });
      });
    }

    return breadcrumbs;
  };

  if (!workspace) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">工作区不存在</Alert>
      </Box>
    );
  }

  const breadcrumbs = generateBreadcrumbs();

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* 顶部导航栏 */}
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar>
          <IconButton edge="start" onClick={handleBack} sx={{ mr: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" noWrap>
              {workspace.name}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {workspace.path}
            </Typography>
          </Box>
          <IconButton onClick={() => setCreateFolderDialog(true)} title="创建文件夹">
            <CreateFolderIcon />
          </IconButton>
          <IconButton onClick={() => setCreateFileDialog(true)} title="创建文件">
            <CreateFileIcon />
          </IconButton>
        </Toolbar>

        {/* 搜索栏 */}
        <Box sx={{ px: 2, pb: 1 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="搜索文件..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (e.target.value === '') {
                clearSearch();
              }
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            slotProps={{
              input: {
                endAdornment: (
                  <Box sx={{ display: 'flex' }}>
                    {searchQuery && (
                      <IconButton onClick={clearSearch} size="small">
                        ×
                      </IconButton>
                    )}
                    <IconButton onClick={handleSearch} disabled={isSearching}>
                      <SearchIcon />
                    </IconButton>
                  </Box>
                )
              }
            }}
          />
          {searchResults.length > 0 && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              找到 {searchResults.length} 个结果
            </Typography>
          )}
        </Box>
      </AppBar>

      {/* 面包屑导航 */}
      <Paper sx={{ p: 2, borderRadius: 0 }} elevation={0}>
        <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />}>
          {breadcrumbs.map((crumb, index) => (
            <Link
              key={index}
              component="button"
              variant="body2"
              onClick={() => {
                if (crumb.isRoot) {
                  goToRoot();
                } else {
                  // 导航到特定路径的逻辑可以在这里实现
                }
              }}
              sx={{
                display: 'flex',
                alignItems: 'center',
                textDecoration: 'none',
                color: index === breadcrumbs.length - 1 ? 'text.primary' : 'primary.main',
                '&:hover': {
                  textDecoration: index === breadcrumbs.length - 1 ? 'none' : 'underline'
                }
              }}
            >
              {crumb.isRoot && <HomeIcon size={16} style={{ marginRight: 4 }} />}
              {crumb.label}
            </Link>
          ))}
        </Breadcrumbs>
      </Paper>

      {/* 主要内容 */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {/* 错误提示 */}
        {error && (
          <Alert severity="error" sx={{ m: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* 文件列表 */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
            <Typography>加载中...</Typography>
          </Box>
        ) : files.length === 0 ? (
          <Box sx={{ textAlign: 'center', mt: 8, px: 2 }}>
            <FolderOpenIcon size={64} style={{ color: '#666', marginBottom: 16 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              文件夹为空
            </Typography>
            <Typography variant="body2" color="text.secondary">
              此文件夹中没有文件或子文件夹
            </Typography>
          </Box>
        ) : (
          <List>
            {/* 返回上级目录按钮 */}
            {(pathHistory.length > 0 || parentPath !== undefined) && (
              <>
                <ListItem>
                  <ListItemButton onClick={goBack}>
                    <ListItemIcon>
                      <ArrowBackIcon />
                    </ListItemIcon>
                    <ListItemText primary="返回上级目录" />
                  </ListItemButton>
                </ListItem>
                <Divider />
              </>
            )}

            {/* 文件和文件夹列表 */}
            {(searchResults.length > 0 ? searchResults : files).map((file, index) => (
              <ListItem
                key={index}
                disablePadding
                secondaryAction={
                  <IconButton
                    edge="end"
                    onClick={(e) => handleContextMenu(e, file)}
                    size="small"
                  >
                    <MoreVertIcon />
                  </IconButton>
                }
              >
                <ListItemButton
                  onClick={() => file.isDirectory ? enterFolder(file) : openFileViewer(file)}
                  onContextMenu={(e) => handleContextMenu(e, file)}
                >
                  <ListItemIcon>
                    {getFileIcon(file)}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body1" noWrap>
                          {file.name}
                        </Typography>
                        {file.isDirectory && (
                          <Chip label="文件夹" size="small" variant="outlined" />
                        )}
                      </Box>
                    }
                    secondary={
                      !file.isDirectory && (
                        <Typography variant="caption" color="text.secondary">
                          {formatFileSize(file.size)} • {dayjs(file.modifiedTime).format('YYYY-MM-DD HH:mm')}
                        </Typography>
                      )
                    }
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}
      </Box>

      {/* 右键菜单 */}
      <Menu
        open={contextMenu !== null}
        onClose={handleCloseContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
      >
        <MenuItem
          onClick={() => {
            setRenameDialog({ open: true, file: contextMenu?.file || null });
            setNewItemName(contextMenu?.file?.name || '');
            handleCloseContextMenu();
          }}
        >
          <EditIcon size={16} style={{ marginRight: 8 }} />
          重命名
        </MenuItem>
        <MenuItem
          onClick={() => {
            setDeleteDialog({ open: true, file: contextMenu?.file || null });
            handleCloseContextMenu();
          }}
        >
          <DeleteIcon size={16} style={{ marginRight: 8 }} />
          删除
        </MenuItem>
      </Menu>

      {/* 创建文件夹对话框 */}
      <Dialog open={createFolderDialog} onClose={() => setCreateFolderDialog(false)}>
        <DialogTitle>创建文件夹</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="文件夹名称"
            fullWidth
            variant="outlined"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateFolderDialog(false)}>取消</Button>
          <Button onClick={handleCreateFolder} variant="contained">创建</Button>
        </DialogActions>
      </Dialog>

      {/* 创建文件对话框 */}
      <Dialog open={createFileDialog} onClose={() => setCreateFileDialog(false)}>
        <DialogTitle>创建文件</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="文件名称"
            fullWidth
            variant="outlined"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateFile()}
            helperText="如果不指定扩展名，将自动添加 .txt"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateFileDialog(false)}>取消</Button>
          <Button onClick={handleCreateFile} variant="contained">创建</Button>
        </DialogActions>
      </Dialog>

      {/* 重命名对话框 */}
      <Dialog open={renameDialog.open} onClose={() => setRenameDialog({ open: false, file: null })}>
        <DialogTitle>重命名</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="新名称"
            fullWidth
            variant="outlined"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRenameItem()}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenameDialog({ open: false, file: null })}>取消</Button>
          <Button onClick={handleRenameItem} variant="contained">重命名</Button>
        </DialogActions>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog open={deleteDialog.open} onClose={() => setDeleteDialog({ open: false, file: null })}>
        <DialogTitle>确认删除</DialogTitle>
        <DialogContent>
          <Typography>
            确定要删除 "{deleteDialog.file?.name}" 吗？此操作无法撤销。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, file: null })}>取消</Button>
          <Button onClick={handleDeleteItem} variant="contained" color="error">删除</Button>
        </DialogActions>
      </Dialog>

      {/* 文件查看器 */}
      <MobileFileViewer
        open={fileViewerOpen}
        file={selectedFile}
        onClose={closeFileViewer}
        onSave={saveFileContent}
      />
    </Box>
  );
};

export default WorkspaceDetail;
