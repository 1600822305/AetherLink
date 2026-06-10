import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
  AppBar,
  Box,
  Button,
  Collapse,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemSecondaryAction,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Switch,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
  CircularProgress
} from '@mui/material';
import BackButtonDialog from '../../components/common/BackButtonDialog';
import { useNavigate } from 'react-router-dom';
import { useSmartBack } from '../../shared/hooks/useSmartBack';
import {
  ArrowLeft as ArrowBackIcon,
  FolderOpen as FolderIcon,
  ChevronRight,
  FileText,
  Folder,
  FolderPlus,
  FilePlus,
  ArrowUpAZ,
  Star,
  Search,
  MoreVertical,
  Edit2,
  Trash2,
  UploadCloud,
  Home
} from 'lucide-react';
import { useDispatch } from 'react-redux';
import { simpleNoteService } from '../../shared/services/notes/SimpleNoteService';
import { unifiedFileManager } from '../../shared/services/files/UnifiedFileManagerService';
import { useNotesSearch } from '../../shared/hooks/useNotesSearch';
import { toastManager } from '../../components/EnhancedToast';
import { SafeAreaContainer } from '../../components/settings/SettingComponents';
import { updateSettings } from '../../shared/store/settingsSlice';
import { ENABLE_NOTE_SIDEBAR_KEY } from '../../shared/services/notes/SimpleNoteService';
import type { NoteFile } from '../../shared/types/note';
import type { SearchResult } from '../../shared/services/notes/NotesSearchService';

interface FolderCache {
  [path: string]: NoteFile[];
}

const NoteSettings: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  // 基础设置
  const [storagePath, setStoragePath] = useState<string>('');
  const [sidebarEnabled, setSidebarEnabled] = useState(false);

  // 文件管理状态
  const [currentPath, setCurrentPath] = useState<string>(''); // 当前所在目录
  const [folderCache, setFolderCache] = useState<FolderCache>({});
  const [loadingPaths, setLoadingPaths] = useState<Record<string, boolean>>({});
  const [selectedItem, setSelectedItem] = useState<NoteFile | null>(null);
  const [sortType, setSortType] = useState<'name' | 'date'>('name');
  const [searchOpen, setSearchOpen] = useState(false);
  
  // 全文搜索
  const { 
    search, 
    reset: _resetSearch, 
    keyword: searchQuery, 
    isSearching, 
    results: searchResults,
    stats 
  } = useNotesSearch({ debounceMs: 300 });
  void _resetSearch; // 显式标记为已使用（预留清空搜索功能）
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createType, setCreateType] = useState<'file' | 'folder'>('file');
  const [createTargetDir, setCreateTargetDir] = useState('');
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [menuTargetItem, setMenuTargetItem] = useState<NoteFile | null>(null);
  const [newItemName, setNewItemName] = useState('');

  const hasStorage = Boolean(storagePath);

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (hasStorage) {
      // 重置到根目录
      setCurrentPath('');
      setFolderCache({});
      void loadFolder('');
    } else {
      setFolderCache({});
      setSelectedItem(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasStorage]);

  const loadSettings = async () => {
    const path = await simpleNoteService.getStoragePath();
    const enabled = await simpleNoteService.isSidebarEnabled();
    setStoragePath(path || '');
    setSidebarEnabled(enabled);
  };

  const handleBack = useSmartBack('/settings');

  const handleSelectPath = async () => {
    try {
      const result = await unifiedFileManager.openSystemFilePicker({
        type: 'directory',
        multiple: false,
        title: '选择笔记存储目录'
      });

      if (!result.cancelled && result.directories && result.directories.length > 0) {
        const selectedDir = result.directories[0];
        const pathToUse = selectedDir.displayPath || selectedDir.path || selectedDir.uri;

        if (!pathToUse) {
          toastManager.error('无法获取有效的目录路径', '错误');
          return;
        }

        await simpleNoteService.setStoragePath(pathToUse);
        setStoragePath(pathToUse);
        toastManager.success('存储路径已更新', '设置成功');
      }
    } catch (error) {
      console.error('选择目录失败:', error);
      toastManager.error('选择目录失败', '错误');
    }
  };

  const handleSidebarToggle = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const enabled = event.target.checked;
    await simpleNoteService.setSidebarEnabled(enabled);
    dispatch(updateSettings({ [ENABLE_NOTE_SIDEBAR_KEY]: enabled }));
    setSidebarEnabled(enabled);
    toastManager.success(`侧边栏入口已${enabled ? '启用' : '禁用'}`, '设置成功');
  };

  const setLoadingFlag = useCallback((path: string, value: boolean) => {
    setLoadingPaths((prev) => ({ ...prev, [path]: value }));
  }, []);

  const loadFolder = useCallback(async (path: string) => {
    setLoadingFlag(path, true);
    try {
      const items = await simpleNoteService.listNotes(path);
      setFolderCache((prev) => ({ ...prev, [path]: items }));
    } catch (error) {
      console.error(`加载目录 ${path} 失败:`, error);
      toastManager.error('加载目录失败', '错误');
    } finally {
      setLoadingFlag(path, false);
    }
  }, [setLoadingFlag]);

  const refreshFolder = async (path: string) => {
    await loadFolder(path);
  };

  const getParentPath = (path: string) => {
    if (!path) return '';
    return path.split('/').slice(0, -1).join('/');
  };

  // 进入文件夹
  const handleEnterFolder = async (path: string) => {
    setCurrentPath(path);
    if (!folderCache[path]) {
      await loadFolder(path);
    }
  };

  // 返回上级目录
  const handleGoBack = () => {
    const parentPath = getParentPath(currentPath);
    setCurrentPath(parentPath);
  };

  // 获取面包屑路径数组
  const getBreadcrumbs = () => {
    if (!currentPath) return [{ name: '根目录', path: '' }];
    const parts = currentPath.split('/');
    const breadcrumbs = [{ name: '根目录', path: '' }];
    let accPath = '';
    parts.forEach((part) => {
      accPath = accPath ? `${accPath}/${part}` : part;
      breadcrumbs.push({ name: part, path: accPath });
    });
    return breadcrumbs;
  };

  const openCreateDialog = (type: 'file' | 'folder') => {
    if (!hasStorage) {
      toastManager.warning('请先设置存储目录', '提示');
      return;
    }
    // 在当前目录下创建
    setCreateTargetDir(currentPath);
    setCreateType(type);
    setNewItemName('');
    setCreateDialogOpen(true);
  };

  const handleCreate = async () => {
    if (!newItemName) return;
    try {
      if (createType === 'folder') {
        await simpleNoteService.createFolder(createTargetDir, newItemName);
      } else {
        await simpleNoteService.createNote(createTargetDir, newItemName);
      }
      setCreateDialogOpen(false);
      setNewItemName('');
      await refreshFolder(currentPath);
      toastManager.success('创建成功', '成功');
    } catch (error) {
      console.error('创建失败:', error);
      toastManager.error('创建失败', '错误');
    }
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, item: NoteFile) => {
    event.stopPropagation();
    event.preventDefault();
    setMenuAnchorEl(event.currentTarget);
    setMenuTargetItem(item);
    setNewItemName(item.name);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
  };

  const handleRename = async () => {
    if (!menuTargetItem || !newItemName) {
      console.log('重命名条件不满足:', { menuTargetItem, newItemName });
      return;
    }
    
    console.log('开始重命名:', { path: menuTargetItem.path, newName: newItemName });
    
    try {
      await simpleNoteService.renameItem(menuTargetItem.path, newItemName);
      setRenameDialogOpen(false);
      setNewItemName('');
      await refreshFolder(getParentPath(menuTargetItem.path));
      toastManager.success('重命名成功', '成功');
    } catch (error) {
      console.error('重命名失败:', error);
      toastManager.error(`重命名失败: ${error instanceof Error ? error.message : String(error)}`, '错误');
    }
  };

  const handleDelete = async () => {
    if (!menuTargetItem) return;
    try {
      await simpleNoteService.deleteItem(menuTargetItem.path, menuTargetItem.isDirectory);
      setDeleteDialogOpen(false);
      await refreshFolder(getParentPath(menuTargetItem.path));
      if (selectedItem?.path === menuTargetItem.path) {
        setSelectedItem(null);
      }
      toastManager.success('删除成功', '成功');
    } catch (error) {
      toastManager.error('删除失败', '错误');
    }
  };

  const handleFileClick = useCallback((item: NoteFile) => {
    setSelectedItem(item);
    if (item.isDirectory) {
      // 进入文件夹
      void handleEnterFolder(item.path);
    } else {
      // 跳转到编辑器页面
      navigate(`/settings/notes/edit?path=${encodeURIComponent(item.path)}&name=${encodeURIComponent(item.name)}`);
    }
  }, [handleEnterFolder, navigate]);

  // 当前显示的列表项（搜索模式下使用搜索结果，否则使用当前目录）
  const displayItems = useMemo(() => {
    if (searchOpen && searchQuery) {
      return searchResults;
    }
    
    const items = folderCache[currentPath] || [];
    let result = [...items];
    result.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) {
        return a.isDirectory ? -1 : 1;
      }
      if (sortType === 'date') {
        return new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime();
      }
      return a.name.localeCompare(b.name);
    });
    return result;
  }, [searchOpen, searchQuery, searchResults, folderCache, currentPath, sortType]);

  // 渲染当前目录的文件列表
  const renderFileList = useCallback(() => {
    // 搜索模式下不需要等待 folderCache
    if (!searchOpen || !searchQuery) {
      const items = folderCache[currentPath];
      
      if (!items) {
        if (loadingPaths[currentPath]) {
          return (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', p: 4 }}>
              <CircularProgress size={24} />
              <Typography variant="body2" sx={{ ml: 2 }}>加载中...</Typography>
            </Box>
          );
        }
        return null;
      }
    }
    
    // 搜索中状态
    if (searchOpen && isSearching) {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', p: 4 }}>
          <CircularProgress size={24} />
          <Typography variant="body2" sx={{ ml: 2 }}>搜索中...</Typography>
        </Box>
      );
    }

    if (displayItems.length === 0 && !searchQuery) {
      return (
        <ListItem>
          <ListItemText primary={<Typography color="text.secondary">此文件夹为空</Typography>} />
        </ListItem>
      );
    }

    if (displayItems.length === 0 && searchQuery) {
      return (
        <ListItem>
          <ListItemText primary={
            <Box>
              <Typography color="text.secondary">未找到匹配的笔记</Typography>
              <Typography variant="caption" color="text.secondary">尝试使用其他关键词</Typography>
            </Box>
          } />
        </ListItem>
      );
    }
    
    // 搜索统计
    const searchStats = searchOpen && searchQuery && stats.total > 0 ? (
      <Box sx={{ px: 1.5, py: 0.5, fontSize: 11, color: 'text.secondary' }}>
        找到 {stats.total} 个结果
        {stats.bothMatches > 0 && ` (其中 ${stats.bothMatches} 个全匹配)`}
      </Box>
    ) : null;

    return (
      <>
        {searchStats}
        {displayItems.map((item: NoteFile | SearchResult) => {
          const isSelected = selectedItem?.path === item.path;
          const isSearchResult = 'matchType' in item;
          const searchItem = isSearchResult ? item as SearchResult : null;
          
          return (
            <ListItem
              key={item.path}
              disablePadding
              sx={{ display: 'block' }}
              onContextMenu={(event) => handleMenuOpen(event, item as NoteFile)}
            >
              <ListItemButton
                selected={isSelected}
                onClick={() => handleFileClick(item as NoteFile)}
                sx={{
                  pl: 1.5,
                  pr: 1,
                  minHeight: 40,
                  '&.Mui-selected': {
                    bgcolor: 'action.selected',
                  },
                  '&:hover': {
                    bgcolor: 'action.hover',
                  }
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', gap: 1 }}>
                  <Box sx={{ color: item.isDirectory ? '#FBC02D' : '#42A5F5', display: 'flex' }}>
                    {item.isDirectory ? <Folder size={18} /> : <FileText size={18} />}
                  </Box>
                  <ListItemText
                    primaryTypographyProps={{ variant: 'body2', noWrap: true }}
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <span>{item.name}</span>
                        {searchItem?.matchType === 'both' && (
                          <Box component="span" sx={{ 
                            fontSize: 10, 
                            px: 0.5, 
                            py: 0.25, 
                            borderRadius: 0.5,
                            bgcolor: 'primary.main',
                            color: 'primary.contrastText'
                          }}>
                            全
                          </Box>
                        )}
                      </Box>
                    }
                    secondary={
                      <>
                        {/* 搜索模式下显示路径 */}
                        {searchOpen && item.path.includes('/') && (
                          <Typography component="span" variant="caption" sx={{ display: 'block', opacity: 0.7 }}>
                            {item.path}
                          </Typography>
                        )}
                        {/* 显示匹配上下文 */}
                        {searchItem?.matches && searchItem.matches.length > 0 && (
                          <Typography 
                            component="span" 
                            variant="caption" 
                            sx={{ 
                              display: 'block',
                              '& mark': {
                                bgcolor: 'warning.light',
                                color: 'inherit',
                                px: 0.25,
                                borderRadius: 0.25
                              }
                            }}
                            dangerouslySetInnerHTML={{
                              __html: (() => {
                                const m = searchItem.matches[0];
                                const before = m.context.substring(0, m.matchStart);
                                const match = m.context.substring(m.matchStart, m.matchEnd);
                                const after = m.context.substring(m.matchEnd);
                                return `${before}<mark>${match}</mark>${after}`;
                              })()
                            }}
                          />
                        )}
                        {/* 非搜索模式显示时间 */}
                        {!searchOpen && !item.isDirectory && new Date(item.lastModified).toLocaleString('zh-CN')}
                      </>
                    }
                    secondaryTypographyProps={{ variant: 'caption' }}
                  />
                  {item.isDirectory && (
                    <ChevronRight size={16} style={{ opacity: 0.5 }} />
                  )}
                  <IconButton 
                    size="small" 
                    onClick={(event) => handleMenuOpen(event, item as NoteFile)}
                    sx={{ ml: 'auto' }}
                  >
                    <MoreVertical size={14} />
                  </IconButton>
                </Box>
              </ListItemButton>
            </ListItem>
          );
        })}
      </>
    );
  }, [currentPath, displayItems, handleFileClick, selectedItem?.path, folderCache, loadingPaths, searchQuery, searchOpen, isSearching, stats]);

  return (
    <SafeAreaContainer>
      <AppBar
        position="static"
        elevation={0}
        sx={{
          bgcolor: 'background.paper',
          color: 'text.primary',
          borderBottom: 1,
          borderColor: 'divider',
          backdropFilter: 'blur(8px)',
        }}
      >
        <Toolbar>
          <IconButton edge="start" onClick={handleBack} aria-label="back" sx={{ color: 'primary.main' }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 600 }}>
            笔记设置
          </Typography>
        </Toolbar>
      </AppBar>

      <Box sx={{ flexGrow: 1, overflow: 'auto', p: { xs: 1, sm: 2 }, pb: 'var(--content-bottom-padding)', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Paper elevation={0} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
          <List>
            <ListItem>
              <ListItemText
                primary="存储位置"
                secondary={storagePath || '未设置，请选择存储目录'}
                secondaryTypographyProps={{
                  sx: {
                    wordBreak: 'break-all',
                    color: storagePath ? 'text.secondary' : 'error.main'
                  }
                }}
              />
              <ListItemSecondaryAction>
                <Button variant="outlined" size="small" startIcon={<FolderIcon size={16} />} onClick={handleSelectPath}>
                  选择目录
                </Button>
              </ListItemSecondaryAction>
            </ListItem>
            <Divider />
            <ListItem>
              <ListItemText primary="侧边栏入口" secondary="在聊天界面侧边栏显示笔记 Tab" />
              <ListItemSecondaryAction>
                <Switch edge="end" checked={sidebarEnabled} onChange={handleSidebarToggle} />
              </ListItemSecondaryAction>
            </ListItem>
          </List>
        </Paper>

        <Paper elevation={0} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', display: 'flex', flexDirection: 'column', minHeight: 420 }}>
            <Box sx={{ p: 1, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                笔记文件
              </Typography>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <Tooltip title="新建笔记">
                <IconButton size="small" onClick={() => openCreateDialog('file')}>
                  <FilePlus size={16} />
                </IconButton>
              </Tooltip>
              <Tooltip title="新建文件夹">
                <IconButton size="small" onClick={() => openCreateDialog('folder')}>
                  <FolderPlus size={16} />
                </IconButton>
              </Tooltip>
              <Tooltip title="切换排序">
                <IconButton size="small" color={sortType === 'date' ? 'primary' : 'default'} onClick={() => setSortType(sortType === 'name' ? 'date' : 'name')}>
                  <ArrowUpAZ size={16} />
                </IconButton>
              </Tooltip>
              <Tooltip title="收藏（即将推出）">
                <IconButton size="small">
                  <Star size={16} />
                </IconButton>
              </Tooltip>
              <Tooltip title="搜索">
                <IconButton size="small" color={searchOpen ? 'primary' : 'default'} onClick={() => setSearchOpen((prev) => !prev)}>
                  <Search size={16} />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          <Collapse in={searchOpen} unmountOnExit>
            <Box sx={{ p: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
              <TextField
                size="small"
                fullWidth
                placeholder="搜索笔记名称或内容..."
                value={searchQuery}
                onChange={(event) => search(event.target.value)}
                InputProps={{ startAdornment: <Search size={14} style={{ marginRight: 6, opacity: 0.6 }} /> }}
              />
            </Box>
          </Collapse>

          {!hasStorage ? (
            <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1.5, p: 3 }}>
              <Typography color="text.secondary">请先选择存储目录以管理笔记</Typography>
              <Button variant="contained" onClick={handleSelectPath} startIcon={<FolderIcon size={16} />}>
                立即设置
              </Button>
            </Box>
          ) : (
            <>
              {/* 面包屑导航 */}
              <Box sx={{ px: 1.5, py: 1, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {currentPath && (
                  <Tooltip title="返回上级">
                    <IconButton size="small" onClick={handleGoBack}>
                      <ArrowBackIcon size={16} />
                    </IconButton>
                  </Tooltip>
                )}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap', flex: 1 }}>
                  {getBreadcrumbs().map((crumb, index) => (
                    <React.Fragment key={crumb.path}>
                      {index > 0 && <ChevronRight size={14} style={{ opacity: 0.4 }} />}
                      <Button
                        size="small"
                        onClick={() => setCurrentPath(crumb.path)}
                        sx={{
                          minWidth: 'auto',
                          textTransform: 'none',
                          color: index === getBreadcrumbs().length - 1 ? 'primary.main' : 'text.secondary',
                          fontWeight: index === getBreadcrumbs().length - 1 ? 600 : 400,
                          '&:hover': {
                            bgcolor: 'action.hover'
                          }
                        }}
                        startIcon={index === 0 ? <Home size={14} /> : undefined}
                      >
                        {crumb.name}
                      </Button>
                    </React.Fragment>
                  ))}
                </Box>
              </Box>

              {/* 文件列表 */}
              <Box sx={{ flexGrow: 1, overflowY: 'auto' }}>
                <List dense disablePadding>
                  {renderFileList()}
                </List>
              </Box>

              {/* 拖拽导入区域 */}
              <Box
                sx={{
                  m: 1.5,
                  p: 1.5,
                  border: '1px dashed',
                  borderColor: 'divider',
                  borderRadius: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 1,
                  color: 'text.secondary',
                  fontSize: '0.85rem',
                  bgcolor: 'action.hover',
                  '&:hover': {
                    borderColor: 'primary.main',
                    color: 'primary.main'
                  }
                }}
              >
                <UploadCloud size={16} />
                拖拽 .md 文件或目录到此处导入（即将支持）
              </Box>
            </>
          )}
        </Paper>

        <Typography variant="caption" color="text.secondary" sx={{ px: 1 }}>
          注意：笔记功能依赖于本地文件系统访问权限。请确保已授予应用相应的存储权限。
        </Typography>
      </Box>

      <Menu anchorEl={menuAnchorEl} open={Boolean(menuAnchorEl)} onClose={handleMenuClose}>
        <MenuItem onClick={() => { 
          if (menuTargetItem) {
            setNewItemName(menuTargetItem.name);
          }
          setRenameDialogOpen(true); 
          handleMenuClose(); 
        }}>
          <ListItemIcon>
            <Edit2 size={14} />
          </ListItemIcon>
          重命名
        </MenuItem>
        <MenuItem onClick={() => { setDeleteDialogOpen(true); handleMenuClose(); }} sx={{ color: 'error.main' }}>
          <ListItemIcon>
            <Trash2 size={14} color="var(--mui-palette-error-main)" />
          </ListItemIcon>
          删除
        </MenuItem>
      </Menu>

      <BackButtonDialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>新建{createType === 'folder' ? '文件夹' : '笔记'}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="名称"
            value={newItemName}
            onChange={(event) => setNewItemName(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && handleCreate()}
          />
          {createTargetDir && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              位置：{createTargetDir || '根目录'}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>取消</Button>
          <Button onClick={handleCreate} variant="contained">创建</Button>
        </DialogActions>
      </BackButtonDialog>

      <BackButtonDialog open={renameDialogOpen} onClose={() => setRenameDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>重命名</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="新名称"
            value={newItemName}
            onChange={(event) => setNewItemName(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && handleRename()}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenameDialogOpen(false)}>取消</Button>
          <Button onClick={handleRename} variant="contained">确定</Button>
        </DialogActions>
      </BackButtonDialog>

      <BackButtonDialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} maxWidth="xs">
        <DialogTitle>确认删除</DialogTitle>
        <DialogContent>
          <Typography>
            确定要删除 "{menuTargetItem?.name}" 吗？
            {menuTargetItem?.isDirectory && ' 该文件夹内的所有内容也将被删除。'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>取消</Button>
          <Button onClick={handleDelete} color="error" variant="contained">删除</Button>
        </DialogActions>
      </BackButtonDialog>
    </SafeAreaContainer>
  );
};

export default NoteSettings;
