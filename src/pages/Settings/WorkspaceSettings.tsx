/**
 * 工作区设置页面
 * 显示工作区列表，提供创建、删除工作区功能
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Chip,
  AppBar,
  Toolbar,
  Paper,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemButton,
  Avatar,
  Divider,
  ListSubheader,
  alpha
} from '@mui/material';
import {
  Plus as AddIcon,
  Folder as FolderIcon,
  Trash2 as DeleteIcon,
  ArrowLeft as ArrowBackIcon,
  Clock as AccessTimeIcon,
  FolderOpen as FolderOpenIcon,
  Shield as ShieldIcon
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { workspaceService } from '../../shared/services/WorkspaceService';
import { WorkspaceCreateDialog } from '../../components/WorkspaceCreateDialog';
import type { Workspace } from '../../shared/types/workspace';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

const WorkspaceSettings: React.FC = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [workspaceToDelete, setWorkspaceToDelete] = useState<Workspace | null>(null);

  useEffect(() => {
    // dayjs 本地化
    const dayjsLocale = i18n.language === 'zh' ? 'zh-cn' : 'en';
    dayjs.locale(dayjsLocale);
    import(`dayjs/locale/${dayjsLocale}`).catch((err) => {
      console.warn(`Failed to load dayjs locale: ${dayjsLocale}`, err);
    });
  }, [i18n.language]);

  // 加载工作区列表
  const loadWorkspaces = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await workspaceService.getWorkspaces();
      setWorkspaces(result.workspaces);
    } catch (err) {
      setError(t('settings.workspace.notifications.loadFailed'));
      console.error(t('settings.workspace.log.loadFailed'), err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkspaces();
  }, [t]);

  // 处理返回
  const handleBack = () => {
    navigate('/settings');
  };

  // 处理创建工作区
  const handleCreateSuccess = () => {
    setCreateDialogOpen(false);
    loadWorkspaces();
  };

  // 处理删除工作区
  const handleDeleteWorkspace = async () => {
    if (!workspaceToDelete) return;

    try {
      const result = await workspaceService.deleteWorkspace(workspaceToDelete.id);
      if (result.success) {
        setDeleteDialogOpen(false);
        setWorkspaceToDelete(null);
        loadWorkspaces();
      } else {
        setError(result.error || t('settings.workspace.notifications.deleteFailed'));
      }
    } catch (err) {
      setError(t('settings.workspace.notifications.deleteFailed'));
      console.error(t('settings.workspace.log.deleteFailed'), err);
    }
  };

  // 打开删除确认对话框
  const openDeleteDialog = (workspace: Workspace) => {
    setWorkspaceToDelete(workspace);
    setDeleteDialogOpen(true);
  };

  // 进入工作区详情
  const enterWorkspace = (workspace: Workspace) => {
    navigate(`/settings/workspace/${workspace.id}`);
  };

  // 进入权限管理页面
  const goToPermissionPage = () => {
    navigate('/settings/file-permission');
  };

  // 格式化文件路径显示
  const formatPath = (path: string) => {
    if (path.length > 30) {
      return `...${path.slice(-27)}`;
    }
    return path;
  };

  return (
    <Box sx={{
      flexGrow: 1,
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      bgcolor: (theme) => theme.palette.mode === 'light'
        ? alpha(theme.palette.primary.main, 0.02)
        : alpha(theme.palette.background.default, 0.9),
    }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 1,
          bgcolor: 'background.paper',
          color: 'text.primary',
          borderBottom: 1,
          borderColor: 'divider',
          backdropFilter: 'blur(8px)',
        }}
      >
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            onClick={handleBack}
            aria-label="back"
            sx={{
              color: (theme) => theme.palette.primary.main,
            }}
          >
            <ArrowBackIcon />
          </IconButton>
          <Typography
            variant="h6"
            component="div"
            sx={{
              flexGrow: 1,
              fontWeight: 600,
              backgroundImage: 'linear-gradient(90deg, #9333EA, #754AB4)',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            {t('settings.workspace.title')}
          </Typography>
          <Button
            startIcon={<ShieldIcon />}
            onClick={goToPermissionPage}
            sx={{
              bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
              color: 'primary.main',
              '&:hover': {
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.2),
              },
              borderRadius: 2,
              mr: 1,
            }}
          >
            {t('settings.workspace.permissions')}
          </Button>
          <Button
            startIcon={<AddIcon />}
            onClick={() => setCreateDialogOpen(true)}
            sx={{
              bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
              color: 'primary.main',
              '&:hover': {
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.2),
              },
              borderRadius: 2,
            }}
          >
            {t('common.add')}
          </Button>
        </Toolbar>
      </AppBar>

      <Box
        sx={{
          flexGrow: 1,
          overflowY: 'auto',
          p: 2,
          mt: 8,
          '&::-webkit-scrollbar': {
            width: '6px',
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'rgba(0,0,0,0.1)',
            borderRadius: '3px',
          },
        }}
      >
        {/* 错误提示 */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
            <Typography>{t('settings.workspace.loading')}</Typography>
          </Box>
        ) : workspaces.length === 0 ? (
          <Paper
            elevation={0}
            sx={{
              mb: 2,
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              overflow: 'hidden',
              bgcolor: 'background.paper',
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
              textAlign: 'center',
              p: 6,
            }}
          >
            <FolderOpenIcon sx={{ fontSize: 60, color: 'primary.main', opacity: 0.6 }} />
            <Typography variant="h5" sx={{ mt: 2, fontWeight: 600 }}>
              {t('settings.workspace.empty.title')}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mt: 1, mb: 3 }}>
              {t('settings.workspace.empty.description')}
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setCreateDialogOpen(true)}
              size="large"
            >
              {t('settings.workspace.empty.createButton')}
            </Button>
          </Paper>
        ) : (
          <List>
            <ListSubheader sx={{ bgcolor: 'transparent', fontWeight: 600 }}>
              {t('settings.workspace.listTitle')}
            </ListSubheader>
            {workspaces.map((workspace) => (
              <Paper key={workspace.id} sx={{ mb: 2, borderRadius: 2, overflow: 'hidden' }}>
                <ListItemButton onClick={() => enterWorkspace(workspace)}>
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: 'primary.main' }}>
                      <FolderIcon size={20} />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Typography variant="h6" sx={{ fontWeight: 600, mr: 1.5 }}>
                          {workspace.name}
                        </Typography>
                        <Chip
                          label={t(`settings.workspace.scope.${workspace.scope}`)}
                          color={workspace.scope === 'global' ? 'secondary' : 'default'}
                          size="small"
                        />
                      </Box>
                    }
                    secondary={
                      <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', color: 'text.secondary' }}>
                        <Typography variant="body2">{formatPath(workspace.path)}</Typography>
                        <AccessTimeIcon sx={{ fontSize: 14, ml: 2, mr: 0.5 }} />
                        <Typography variant="caption">{t('settings.workspace.lastAccessed', { time: dayjs(workspace.lastAccessed).fromNow() })}</Typography>
                      </Box>
                    }
                  />
                  <IconButton edge="end" aria-label="delete" onClick={(e) => {
                    e.stopPropagation();
                    openDeleteDialog(workspace);
                  }}>
                    <DeleteIcon />
                  </IconButton>
                </ListItemButton>
              </Paper>
            ))}
          </List>
        )}
      </Box>

      {/* 创建工作区对话框 */}
      <WorkspaceCreateDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onSuccess={handleCreateSuccess}
      />

      {/* 删除确认对话框 */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>{t('settings.workspace.deleteDialog.title')}</DialogTitle>
        <DialogContent>
          <Typography>
            {t('settings.workspace.deleteDialog.content', { name: workspaceToDelete?.name })}
          </Typography>
          <Alert severity="warning" sx={{ mt: 2 }}>
            {t('settings.workspace.deleteDialog.warning')}
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleDeleteWorkspace} color="error">{t('common.delete')}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default WorkspaceSettings;
