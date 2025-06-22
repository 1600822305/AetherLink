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
import { workspaceService } from '../../shared/services/WorkspaceService';
import { WorkspaceCreateDialog } from '../../components/WorkspaceCreateDialog';
import type { Workspace } from '../../shared/types/workspace';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

const WorkspaceSettings: React.FC = () => {
  const navigate = useNavigate();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [workspaceToDelete, setWorkspaceToDelete] = useState<Workspace | null>(null);

  // 加载工作区列表
  const loadWorkspaces = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await workspaceService.getWorkspaces();
      setWorkspaces(result.workspaces);
    } catch (err) {
      setError('加载工作区列表失败');
      console.error('加载工作区失败:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkspaces();
  }, []);

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
        setError(result.error || '删除工作区失败');
      }
    } catch (err) {
      setError('删除工作区失败');
      console.error('删除工作区失败:', err);
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
            工作区管理
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
            权限管理
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
            添加
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
            <Typography>加载中...</Typography>
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
            <FolderOpenIcon size={64} style={{ color: '#666', marginBottom: 16 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              还没有工作区
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              创建工作区来管理您的文件和文档
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setCreateDialogOpen(true)}
              sx={{
                bgcolor: 'primary.main',
                color: 'white',
                fontWeight: 600,
                borderRadius: 2,
                boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)',
                '&:hover': {
                  bgcolor: 'primary.dark',
                  boxShadow: '0 6px 16px rgba(79, 70, 229, 0.4)',
                },
              }}
            >
              创建第一个工作区
            </Button>
          </Paper>
        ) : (
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
            }}
          >
            <Box sx={{ p: 2, bgcolor: 'rgba(0,0,0,0.01)' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                工作区列表
              </Typography>
              <Typography variant="body2" color="text.secondary">
                管理您的工作区，点击对应的工作区进行访问和管理
              </Typography>
            </Box>

            <Divider />

            <List disablePadding>
              {workspaces.map((workspace, index) => (
                <React.Fragment key={workspace.id}>
                  <ListItemButton
                    onClick={() => enterWorkspace(workspace)}
                    sx={{
                      transition: 'all 0.2s',
                      '&:hover': {
                        bgcolor: (theme) => alpha(theme.palette.primary.main, 0.05),
                      },
                      py: 2,
                    }}
                  >
                    <ListItemAvatar>
                      <Avatar
                        sx={{
                          bgcolor: '#1976d2',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.05)'
                        }}
                      >
                        <FolderIcon />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Typography sx={{ fontWeight: 600, color: 'text.primary' }}>
                          {workspace.name}
                        </Typography>
                      }
                      secondary={
                        <Box>
                          {workspace.description && (
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                              {workspace.description}
                            </Typography>
                          )}
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                            <Chip
                              label={formatPath(workspace.path)}
                              size="small"
                              sx={{
                                backgroundColor: '#333333',
                                color: '#cccccc',
                                height: '20px',
                                '& .MuiChip-label': { fontSize: '0.65rem', px: 0.5 }
                              }}
                            />
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <AccessTimeIcon size={14} style={{ marginRight: 4, color: '#666' }} />
                            <Typography variant="caption" color="text.secondary">
                              {workspace.lastAccessedAt
                                ? `最后访问 ${dayjs(workspace.lastAccessedAt).fromNow()}`
                                : `创建于 ${dayjs(workspace.createdAt).fromNow()}`
                              }
                            </Typography>
                          </Box>
                        </Box>
                      }
                    />
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        openDeleteDialog(workspace);
                      }}
                      sx={{
                        mr: 1,
                        color: 'text.secondary',
                        '&:hover': {
                          color: 'error.main',
                          bgcolor: (theme) => alpha(theme.palette.error.main, 0.1),
                        },
                      }}
                    >
                      <DeleteIcon size={16} />
                    </IconButton>
                  </ListItemButton>
                  {index < workspaces.length - 1 && <Divider variant="inset" component="li" sx={{ ml: 0 }} />}
                </React.Fragment>
              ))}
            </List>
          </Paper>
        )}

        {/* 推荐操作 */}
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
          }}
        >
          <List
            subheader={
              <ListSubheader
                component="div"
                sx={{
                  bgcolor: 'rgba(0,0,0,0.01)',
                  py: 1,
                  fontWeight: 600,
                  color: 'text.primary'
                }}
              >
                推荐操作
              </ListSubheader>
            }
          >
            <ListItem disablePadding>
              <ListItemButton
                onClick={() => setCreateDialogOpen(true)}
                sx={{
                  transition: 'all 0.2s',
                  '&:hover': {
                    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.05),
                  }
                }}
              >
                <ListItemAvatar>
                  <Avatar sx={{
                    bgcolor: alpha('#4f46e5', 0.12),
                    color: '#4f46e5',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.05)'
                  }}>
                    <AddIcon />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={<Typography sx={{ fontWeight: 600, color: 'text.primary' }}>创建新工作区</Typography>}
                  secondary="添加新的工作区来管理您的文件和文档"
                />
              </ListItemButton>
            </ListItem>

            <Divider variant="inset" component="li" sx={{ ml: 0 }} />

            <ListItem disablePadding>
              <ListItemButton
                onClick={goToPermissionPage}
                sx={{
                  transition: 'all 0.2s',
                  '&:hover': {
                    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.05),
                  }
                }}
              >
                <ListItemAvatar>
                  <Avatar sx={{
                    bgcolor: alpha('#06b6d4', 0.12),
                    color: '#06b6d4',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.05)'
                  }}>
                    <ShieldIcon />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={<Typography sx={{ fontWeight: 600, color: 'text.primary' }}>文件权限管理</Typography>}
                  secondary="管理文件访问权限和安全设置"
                />
              </ListItemButton>
            </ListItem>
          </List>
        </Paper>
      </Box>

      {/* 创建工作区对话框 */}
      <WorkspaceCreateDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onSuccess={handleCreateSuccess}
      />

      {/* 删除确认对话框 */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
          }
        }}
      >
        <DialogTitle sx={{
          fontWeight: 600,
          backgroundImage: 'linear-gradient(90deg, #9333EA, #754AB4)',
          backgroundClip: 'text',
          color: 'transparent',
        }}>
          删除工作区
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Typography>
            确定要删除工作区 "{workspaceToDelete?.name}" 吗？
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            这只会删除工作区配置，不会删除实际的文件。
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteDialogOpen(false)}>取消</Button>
          <Button
            onClick={handleDeleteWorkspace}
            color="error"
            variant="contained"
            sx={{
              borderRadius: 2,
            }}
          >
            删除
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default WorkspaceSettings;
