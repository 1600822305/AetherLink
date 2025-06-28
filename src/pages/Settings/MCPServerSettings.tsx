import React, { useState, useEffect } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  ListItemAvatar,
  Chip,
  Avatar,
  alpha,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Snackbar,
  Alert,
  Divider,
  FormControlLabel,
  Checkbox
} from '@mui/material';
import CustomSwitch from '../../components/CustomSwitch';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft as ArrowBackIcon,
  Plus as AddIcon,
  Settings as SettingsIcon,
  Database as StorageIcon,
  Globe as HttpIcon,
  Trash2 as DeleteIcon
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { MCPServer, MCPServerType } from '../../shared/types';
import { mcpService } from '../../shared/services/mcp';

const MCPServerSettings: React.FC = () => {
  const navigate = useNavigate();
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [builtinDialogOpen, setBuiltinDialogOpen] = useState(false);
  const [builtinServers, setBuiltinServers] = useState<MCPServer[]>([]);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'warning' }>({
    open: false,
    message: '',
    severity: 'success'
  });
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { t, i18n } = useTranslation();

  // New server form state
  const [newServer, setNewServer] = useState<Partial<MCPServer>>({
    name: '',
    type: 'httpStream',
    description: '',
    baseUrl: '',
    isActive: false,
    enableSSE: false 
  });

  useEffect(() => {
    loadServers();
    loadBuiltinServers();
  }, [i18n.language]);

  const loadServers = () => {
    const serverList = mcpService.getServers();
    setServers(serverList);
  };

  const loadBuiltinServers = () => {
    try {
      const builtinList = mcpService.getBuiltinServers();
      setBuiltinServers(builtinList);
    } catch (error) {
      console.error(`[MCPSettings] ${t('settings.mcpServer.status.builtinLoadFailed')}:`, error);
    }
  };

  const handleBack = () => {
    navigate('/settings');
  };

  const handleToggleServer = async (serverId: string, isActive: boolean) => {
    try {
      await mcpService.toggleServer(serverId, isActive);
      loadServers();
      setSnackbar({
        open: true,
        message: isActive ? t('settings.mcpServer.status.enabled') : t('settings.mcpServer.status.disabled'),
        severity: 'success'
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: t('settings.mcpServer.status.opFailed'),
        severity: 'error'
      });
    }
  };

  const handleAddServer = async () => {
    if (!newServer.name || !newServer.type) {
      setSnackbar({
        open: true,
        message: t('settings.mcpServer.status.fillRequired'),
        severity: 'error'
      });
      return;
    }

    if (newServer.type === 'httpStream' && !newServer.baseUrl) {
      setSnackbar({
        open: true,
        message: t('settings.mcpServer.status.urlRequired'),
        severity: 'error'
      });
      return;
    }

    try {
      const server: MCPServer = {
        id: Date.now().toString(),
        name: newServer.name!,
        type: newServer.type!,
        description: newServer.description,
        baseUrl: newServer.baseUrl,
        isActive: false,
        headers: {},
        env: {},
        args: []
      };

      await mcpService.addServer(server);
      loadServers();
      setAddDialogOpen(false);
      setNewServer({
        name: '',
        type: 'httpStream',
        description: '',
        baseUrl: '',
        isActive: false,
        enableSSE: false
      });
      setSnackbar({
        open: true,
        message: t('settings.mcpServer.status.addSuccess'),
        severity: 'success'
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: t('settings.mcpServer.status.addFailed'),
        severity: 'error'
      });
    }
  };

  const isBuiltinServerAdded = (builtinServerName: string): boolean => {
    return servers.some(server => server.name === builtinServerName);
  };

  const handleAddBuiltinServer = async (builtinServer: MCPServer) => {
    if (isBuiltinServerAdded(builtinServer.name)) {
      setSnackbar({
        open: true,
        message: t('settings.mcpServer.status.alreadyExists', { name: builtinServer.name }),
        severity: 'warning'
      });
      return;
    }

    try {
      await mcpService.addBuiltinServer(builtinServer.name, {
        description: builtinServer.description,
        env: builtinServer.env,
        args: builtinServer.args,
        tags: builtinServer.tags,
        provider: builtinServer.provider
      });

      loadServers();
      setSnackbar({
        open: true,
        message: t('settings.mcpServer.status.builtinAddSuccess', { name: builtinServer.name }),
        severity: 'success'
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: t('settings.mcpServer.status.builtinAddFailed'),
        severity: 'error'
      });
    }
  };

  const handleEditServer = (server: MCPServer) => {
    navigate(`/settings/mcp-server/${server.id}`, { state: { server } });
  };

  const handleDeleteServer = async (server: MCPServer) => {
    if (deletingId) return;
    setDeletingId(server.id);

    try {
      await mcpService.removeServer(server.id);
      loadServers();
      setSnackbar({
        open: true,
        message: t('settings.mcpServer.status.deleteSuccess', { name: server.name }),
        severity: 'success'
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: t('settings.mcpServer.status.deleteFailed'),
        severity: 'error'
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleImportJson = async () => {
    try {
      const config = JSON.parse(importJson);

      if (!config.mcpServers || typeof config.mcpServers !== 'object') {
        throw new Error(t('settings.mcpServer.status.jsonFormatError'));
      }

      let importCount = 0;
      const errors: string[] = [];

      for (const [serverName, serverConfig] of Object.entries(config.mcpServers)) {
        try {
          const server: MCPServer = {
            id: Date.now().toString() + Math.random().toString(36).substring(2, 11),
            name: serverName,
            type: (serverConfig as any).type || 'sse',
            baseUrl: (serverConfig as any).url,
            description: t('settings.mcpServer.status.importDesc', { serverName }),
            isActive: false,
            headers: {},
            env: {},
            args: []
          };

          await mcpService.addServer(server);
          importCount++;
        } catch (error) {
          errors.push(`${serverName}: ${error instanceof Error ? error.message : t('common.unknownError')}`);
        }
      }

      loadServers();
      setImportDialogOpen(false);
      setImportJson('');

      const errorInfo = errors.length > 0 ? t('settings.mcpServer.status.importErrorCount', { errorCount: errors.length }) : '';
      setSnackbar({
        open: true,
        message: t('settings.mcpServer.status.importSuccess', { importCount: importCount, errorInfo: errorInfo }),
        severity: errors.length > 0 ? 'warning' : 'success'
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: t('settings.mcpServer.status.importFailed', { error: error instanceof Error ? error.message : t('common.unknownError') }),
        severity: 'error'
      });
    }
  };

  const getServerTypeIcon = (type: MCPServerType) => {
    switch (type) {
      case 'httpStream':
        return <HttpIcon />;
      case 'inMemory':
        return <StorageIcon />;
      default:
        return <SettingsIcon />;
    }
  };

  const getServerTypeLabel = (type: MCPServerType) => {
    const key = `settings.mcpServer.serverType.${type.replace('Stream', '')}`;
    const translated = t(key);
    return translated === key ? type : translated;
  };

  const getServerTypeColor = (type: MCPServerType) => {
    switch (type) {
      case 'httpStream':
        return '#9c27b0';
      case 'inMemory':
        return '#ff9800';
      default:
        return '#9e9e9e';
    }
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
            {t('settings.mcpServer.title')}
          </Typography>
          <Button
            startIcon={<AddIcon />}
            onClick={() => setAddDialogOpen(true)}
            sx={{
              bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
              color: 'primary.main',
              '&:hover': {
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.2),
              },
              borderRadius: 2,
            }}
          >
            {t('settings.mcpServer.list.addServer')}
          </Button>
        </Toolbar>
      </AppBar>

      <Box
        sx={{
          flexGrow: 1,
          overflowY: 'auto',
          p: { xs: 1, sm: 2 },
          mt: 8,
          '&::-webkit-scrollbar': {
            width: { xs: '4px', sm: '6px' },
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'rgba(0,0,0,0.1)',
            borderRadius: '3px',
          },
        }}
      >
        {servers.length === 0 ? (
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
            <Box sx={{ p: { xs: 3, sm: 4 }, textAlign: 'center' }}>
              <Box sx={{ mb: { xs: 1.5, sm: 2 } }}>
                <SettingsIcon size={48} style={{ color: '#9333EA' }} />
              </Box>
              <Typography
                variant="h6"
                gutterBottom
                sx={{
                  fontWeight: 600,
                  fontSize: { xs: '1.1rem', sm: '1.25rem' }
                }}
              >
                {t('settings.mcpServer.list.emptyTitle')}
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  mb: { xs: 2.5, sm: 3 },
                  fontSize: { xs: '0.875rem', sm: '0.875rem' }
                }}
              >
                {t('settings.mcpServer.list.emptyDesc')}
              </Typography>
              <Box sx={{
                display: 'flex',
                gap: { xs: 1.5, sm: 2 },
                flexWrap: 'wrap',
                justifyContent: 'center',
                flexDirection: { xs: 'column', sm: 'row' },
                alignItems: 'center'
              }}>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => setAddDialogOpen(true)}
                  fullWidth={window.innerWidth < 600}
                  sx={{
                    bgcolor: 'primary.main',
                    '&:hover': { bgcolor: 'primary.dark' },
                    minHeight: { xs: 44, sm: 36 },
                    fontSize: { xs: '0.9rem', sm: '0.875rem' }
                  }}
                >
                  {t('settings.mcpServer.list.addServer')}
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => setImportDialogOpen(true)}
                  fullWidth={window.innerWidth < 600}
                  sx={{
                    borderColor: 'primary.main',
                    color: 'primary.main',
                    '&:hover': { borderColor: 'primary.dark', color: 'primary.dark' },
                    minHeight: { xs: 44, sm: 36 },
                    fontSize: { xs: '0.9rem', sm: '0.875rem' }
                  }}
                >
                  {t('settings.mcpServer.quickActions.import')}
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => setBuiltinDialogOpen(true)}
                  fullWidth={window.innerWidth < 600}
                  sx={{
                    borderColor: 'primary.main',
                    color: 'primary.main',
                    '&:hover': { borderColor: 'primary.dark', color: 'primary.dark' },
                    minHeight: { xs: 44, sm: 36 },
                    fontSize: { xs: '0.9rem', sm: '0.875rem' }
                  }}
                >
                  {t('settings.mcpServer.quickActions.builtin')}
                </Button>
              </Box>
            </Box>
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
            <Box sx={{ p: { xs: 1.5, sm: 2 }, bgcolor: 'rgba(0,0,0,0.01)' }}>
              <Typography
                variant="subtitle1"
                sx={{
                  fontWeight: 600,
                  fontSize: { xs: '1rem', sm: '1.1rem' }
                }}
              >
                {t('settings.mcpServer.list.title')}
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
              >
                {t('settings.mcpServer.list.subtitle')}
              </Typography>
            </Box>

            <Divider />

            <List disablePadding>
              {servers.map((server, index) => (
                <React.Fragment key={server.id}>
                  <ListItem
                    disablePadding
                    sx={{
                      transition: 'all 0.2s',
                      '&:hover': {
                        bgcolor: (theme) => alpha(theme.palette.primary.main, 0.05),
                      }
                    }}
                  >
                    <ListItemButton
                      onClick={() => handleEditServer(server)}
                      sx={{ flex: 1 }}
                    >
                      <ListItemAvatar>
                        <Avatar
                          sx={{
                            bgcolor: alpha(getServerTypeColor(server.type), 0.12),
                            color: getServerTypeColor(server.type),
                            boxShadow: '0 2px 6px rgba(0,0,0,0.05)'
                          }}
                        >
                          {getServerTypeIcon(server.type)}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Box sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: { xs: 0.5, sm: 1 },
                            flexWrap: 'wrap'
                          }}>
                            <Typography sx={{
                              fontWeight: 600,
                              color: 'text.primary',
                              fontSize: { xs: '0.9rem', sm: '1rem' }
                            }}>
                              {server.name}
                            </Typography>
                            <Chip
                              label={getServerTypeLabel(server.type)}
                              size="small"
                              sx={{
                                bgcolor: alpha(getServerTypeColor(server.type), 0.1),
                                color: getServerTypeColor(server.type),
                                fontWeight: 500,
                                fontSize: { xs: '0.7rem', sm: '0.75rem' },
                                height: { xs: 20, sm: 24 }
                              }}
                            />
                            {server.isActive && (
                              <Chip
                                label={t('settings.mcpServer.status.running')}
                                size="small"
                                color="success"
                                variant="outlined"
                                sx={{
                                  fontSize: { xs: '0.7rem', sm: '0.75rem' },
                                  height: { xs: 20, sm: 24 }
                                }}
                              />
                            )}
                          </Box>
                        }
                        secondary={
                          <Box component="div" sx={{ mt: { xs: 0.5, sm: 1 } }}>
                            {server.description && (
                              <Typography
                                variant="body2"
                                color="text.secondary"
                                component="div"
                                sx={{
                                  fontSize: { xs: '0.8rem', sm: '0.875rem' },
                                  lineHeight: 1.4,
                                  display: '-webkit-box',
                                  WebkitLineClamp: { xs: 2, sm: 3 },
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden'
                                }}
                              >
                                {server.description}
                              </Typography>
                            )}
                            {server.baseUrl && (
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                component="div"
                                sx={{
                                  fontSize: { xs: '0.7rem', sm: '0.75rem' },
                                  mt: 0.5,
                                  wordBreak: 'break-all'
                                }}
                              >
                                {server.baseUrl}
                              </Typography>
                            )}
                          </Box>
                        }
                      />
                    </ListItemButton>

                    {/* 操作按钮区域 */}
                    <Box sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      pr: 2
                    }}>
                      <CustomSwitch
                        checked={server.isActive}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleToggleServer(server.id, e.target.checked);
                        }}
                      />
                      <IconButton
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteServer(server);
                        }}
                        size="small"
                        disabled={deletingId === server.id}
                        sx={{
                          color: deletingId === server.id ? 'text.disabled' : 'error.main',
                          '&:hover': {
                            bgcolor: (theme) => alpha(theme.palette.error.main, 0.1),
                          }
                        }}
                      >
                        <DeleteIcon size={18} />
                      </IconButton>
                    </Box>
                  </ListItem>
                  {index < servers.length - 1 && <Divider variant="inset" component="li" sx={{ ml: 0 }} />}
                </React.Fragment>
              ))}
            </List>
          </Paper>
        )}

        {/* 快捷操作 */}
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
          <Box sx={{ p: { xs: 1.5, sm: 2 }, bgcolor: 'rgba(0,0,0,0.01)' }}>
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 600,
                fontSize: { xs: '1rem', sm: '1.1rem' }
              }}
            >
              {t('settings.mcpServer.quickActions.title')}
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
            >
              {t('settings.mcpServer.quickActions.subtitle')}
            </Typography>
          </Box>

          <Divider />

          <List disablePadding>
            <ListItem disablePadding>
              <ListItemButton
                onClick={() => setImportDialogOpen(true)}
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
                    <AddIcon />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Typography sx={{
                      fontWeight: 600,
                      color: 'text.primary',
                      fontSize: { xs: '0.9rem', sm: '1rem' }
                    }}>
                      {t('settings.mcpServer.quickActions.import')}
                    </Typography>
                  }
                  secondary={
                    <Typography sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
                      {t('settings.mcpServer.quickActions.importDesc')}
                    </Typography>
                  }
                />
              </ListItemButton>
            </ListItem>

            <Divider variant="inset" component="li" sx={{ ml: 0 }} />

            <ListItem disablePadding>
              <ListItemButton
                onClick={() => setBuiltinDialogOpen(true)}
                sx={{
                  transition: 'all 0.2s',
                  '&:hover': {
                    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.05),
                  }
                }}
              >
                <ListItemAvatar>
                  <Avatar sx={{
                    bgcolor: alpha('#8b5cf6', 0.12),
                    color: '#8b5cf6',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.05)'
                  }}>
                    <SettingsIcon />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Typography sx={{
                      fontWeight: 600,
                      color: 'text.primary',
                      fontSize: { xs: '0.9rem', sm: '1rem' }
                    }}>
                      {t('settings.mcpServer.quickActions.builtin')}
                    </Typography>
                  }
                  secondary={
                    <Typography sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
                      {t('settings.mcpServer.quickActions.builtinDesc')}
                    </Typography>
                  }
                />
              </ListItemButton>
            </ListItem>
          </List>
        </Paper>
      </Box>

      {/* 添加服务器对话框 */}
      <Dialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{t('settings.mcpServer.dialog.addTitle')}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label={t('settings.mcpServer.form.name')}
            fullWidth
            variant="outlined"
            value={newServer.name}
            onChange={(e) => setNewServer({ ...newServer, name: e.target.value })}
            sx={{ mb: 2 }}
          />
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>{t('settings.mcpServer.form.type')}</InputLabel>
            <Select
              value={newServer.type}
              label={t('settings.mcpServer.form.type')}
              onChange={(e) => setNewServer({ ...newServer, type: e.target.value as MCPServerType })}
            >
              <MenuItem value="httpStream">{t('settings.mcpServer.form.typeHttp')}</MenuItem>
              <MenuItem value="inMemory">{t('settings.mcpServer.form.typeMemory')}</MenuItem>
            </Select>
          </FormControl>
          {newServer.type === 'httpStream' && (
            <TextField
              margin="dense"
              label={t('settings.mcpServer.form.url')}
              fullWidth
              variant="outlined"
              value={newServer.baseUrl}
              onChange={(e) => setNewServer({ ...newServer, baseUrl: e.target.value })}
              placeholder="https://example.com/mcp"
              sx={{ mb: 2 }}
            />
          )}
          <TextField
            margin="dense"
            label={t('settings.mcpServer.form.description')}
            fullWidth
            variant="outlined"
            multiline
            rows={2}
            value={newServer.description}
            onChange={(e) => setNewServer({ ...newServer, description: e.target.value })}
          />
          {newServer.type === 'httpStream' && (
            <FormControlLabel
              control={
                <Checkbox
                  checked={newServer.enableSSE === true} // 默认禁用
                  onChange={(e) => setNewServer({ ...newServer, enableSSE: e.target.checked })}
                />
              }
              label={t('settings.mcpServer.form.enableSSE')}
              sx={{ mt: 1 }}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleAddServer} variant="contained">{t('common.add')}</Button>
        </DialogActions>
      </Dialog>

      {/* JSON 导入对话框 */}
      <Dialog
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>{t('settings.mcpServer.dialog.importTitle')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('settings.mcpServer.dialog.importDesc')}
          </Typography>
          <Box
            sx={{
              bgcolor: 'grey.100',
              p: 2,
              borderRadius: 1,
              mb: 2,
              fontFamily: 'monospace',
              fontSize: '0.875rem'
            }}
          >
            {`{
  "mcpServers": {
    "fetch": {
      "type": "sse",
      "url": "https://mcp.api-inference.modelscope.cn/sse/89261d74d6814a"
    },
    "memory": {
      "type": "streamableHttp",
      "url": "https://example.com/mcp/memory"
    }
  }
}`}
          </Box>
          <TextField
            autoFocus
            margin="dense"
            label={t('settings.mcpServer.form.json')}
            fullWidth
            multiline
            rows={10}
            variant="outlined"
            value={importJson}
            onChange={(e) => setImportJson(e.target.value)}
            placeholder={t('settings.mcpServer.form.jsonPlaceholder')}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button
            onClick={handleImportJson}
            variant="contained"
            disabled={!importJson.trim()}
          >
            {t('common.import')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 内置服务器对话框 */}
      <Dialog
        open={builtinDialogOpen}
        onClose={() => setBuiltinDialogOpen(false)}
        maxWidth="md"
        fullWidth
        fullScreen={window.innerWidth < 600}
        sx={{
          '& .MuiDialog-paper': {
            maxHeight: { xs: '100vh', sm: '90vh' },
            margin: { xs: 0, sm: 2 },
            borderRadius: { xs: 0, sm: 2 }
          }
        }}
      >
        <DialogTitle sx={{
          px: { xs: 2, sm: 3 },
          py: { xs: 2, sm: 2.5 },
          fontSize: { xs: '1.25rem', sm: '1.5rem' },
          fontWeight: 600,
          borderBottom: '1px solid',
          borderColor: 'divider'
        }}>
          {t('settings.mcpServer.dialog.builtinTitle')}
        </DialogTitle>
        <DialogContent sx={{ px: { xs: 2, sm: 3 }, py: { xs: 2, sm: 3 } }}>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              mb: { xs: 2, sm: 3 },
              fontSize: { xs: '0.875rem', sm: '0.875rem' },
              lineHeight: 1.5
            }}
          >
            {t('settings.mcpServer.dialog.builtinDesc')}
          </Typography>
          <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: { xs: 1.5, sm: 2 },
            maxHeight: { xs: 'calc(100vh - 200px)', sm: '70vh', md: '80vh' },
            overflow: 'auto',
            pr: { xs: 0.5, sm: 1 },
            // 移动端滚动优化
            WebkitOverflowScrolling: 'touch',
            '&::-webkit-scrollbar': {
              width: { xs: '2px', sm: '4px' }
            },
            '&::-webkit-scrollbar-track': {
              background: 'transparent'
            },
            '&::-webkit-scrollbar-thumb': {
              background: 'rgba(0, 0, 0, 0.2)',
              borderRadius: '2px'
            }
          }}>
            {builtinServers.map((builtinServer) => {
              const isAdded = isBuiltinServerAdded(builtinServer.name);
              return (
                <Paper
                  key={builtinServer.id}
                  elevation={0}
                  sx={{
                    border: '1px solid',
                    borderColor: isAdded ? '#d1fae5' : '#e5e7eb',
                    borderRadius: { xs: 2, sm: 2 },
                    transition: 'all 0.2s ease-in-out',
                    backgroundColor: isAdded ? '#f0fdf4' : '#ffffff',
                    cursor: 'pointer',
                    // 移动端触摸优化
                    touchAction: 'manipulation',
                    '&:hover': {
                      borderColor: isAdded ? '#a7f3d0' : '#10b981',
                      boxShadow: { xs: '0 2px 8px rgba(0,0,0,0.06)', sm: '0 4px 12px rgba(0,0,0,0.08)' }
                    },
                    '&:active': {
                      transform: { xs: 'scale(0.98)', sm: 'none' }
                    }
                  }}
                >
                <Box
                  sx={{
                    p: { xs: 2, sm: 2.5, md: 3 },
                    display: 'flex',
                    flexDirection: { xs: 'column', sm: 'row' },
                    alignItems: { xs: 'stretch', sm: 'flex-start' },
                    gap: { xs: 2, sm: 2.5 }
                  }}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    {/* 服务器名称 */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: { xs: 0.75, sm: 1 } }}>
                      <Typography
                        variant="h6"
                        fontWeight={600}
                        sx={{
                          fontSize: { xs: '1rem', sm: '1.1rem', md: '1.2rem' },
                          color: 'text.primary',
                          lineHeight: 1.3,
                          wordBreak: 'break-word'
                        }}
                      >
                        {builtinServer.name}
                      </Typography>
                      {isAdded && (
                        <Chip
                          label="已添加"
                          size="small"
                          sx={{
                            height: 20,
                            fontSize: '0.7rem',
                            backgroundColor: '#dcfce7',
                            color: '#166534',
                            border: '1px solid #bbf7d0',
                            fontWeight: 500
                          }}
                        />
                      )}
                    </Box>

                    {/* 描述 */}
                    <Typography
                      variant="body2"
                      sx={{
                        color: 'text.secondary',
                        mb: { xs: 1.5, sm: 2 },
                        lineHeight: 1.6,
                        fontSize: { xs: '0.8rem', sm: '0.875rem', md: '0.9rem' },
                        display: '-webkit-box',
                        WebkitLineClamp: { xs: 3, sm: 2 },
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}
                    >
                      {builtinServer.description}
                    </Typography>

                    {/* 标签 */}
                    <Box sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: { xs: 0.75, sm: 1 },
                      flexWrap: 'wrap'
                    }}>
                      {builtinServer.tags && builtinServer.tags.map((tag) => (
                        <Chip
                          key={tag}
                          label={tag}
                          size="small"
                          variant="outlined"
                          sx={{
                            fontSize: { xs: '0.7rem', sm: '0.75rem' },
                            height: { xs: 22, sm: 24 },
                            borderColor: '#e5e7eb',
                            color: '#6b7280',
                            backgroundColor: '#f9fafb',
                            fontWeight: 500,
                            '& .MuiChip-label': {
                              px: { xs: 1, sm: 1.5 }
                            },
                            '&:hover': {
                              borderColor: '#10b981',
                              backgroundColor: alpha('#10b981', 0.05)
                            }
                          }}
                        />
                      ))}
                    </Box>
                  </Box>

                  {/* 添加按钮 */}
                  <Box sx={{
                    display: 'flex',
                    alignItems: { xs: 'stretch', sm: 'center' },
                    flexShrink: 0,
                    mt: { xs: 1, sm: 0 }
                  }}>
                    {isBuiltinServerAdded(builtinServer.name) ? (
                      <Button
                        variant="outlined"
                        size={window.innerWidth < 600 ? 'medium' : 'small'}
                        fullWidth={window.innerWidth < 600}
                        disabled
                        sx={{
                          borderColor: '#d1d5db',
                          color: '#6b7280',
                          borderRadius: { xs: 2, sm: 1.5 },
                          px: { xs: 3, sm: 2 },
                          py: { xs: 1, sm: 0.75 },
                          fontWeight: 500,
                          fontSize: { xs: '0.9rem', sm: '0.875rem' },
                          textTransform: 'none',
                          minWidth: { xs: 'auto', sm: 'auto' },
                          minHeight: { xs: 44, sm: 'auto' },
                          cursor: 'default'
                        }}
                      >
                        {t('settings.mcpServer.status.alreadyAdded')}
                      </Button>
                    ) : (
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddBuiltinServer(builtinServer);
                        }}
                        variant="contained"
                        size={window.innerWidth < 600 ? 'medium' : 'small'}
                        fullWidth={window.innerWidth < 600}
                        sx={{
                          backgroundColor: '#10b981',
                          color: 'white',
                          borderRadius: { xs: 2, sm: 1.5 },
                          px: { xs: 3, sm: 2 },
                          py: { xs: 1, sm: 0.75 },
                          fontWeight: 500,
                          fontSize: { xs: '0.9rem', sm: '0.875rem' },
                          textTransform: 'none',
                          minWidth: { xs: 'auto', sm: 'auto' },
                          minHeight: { xs: 44, sm: 'auto' },
                          '&:hover': {
                            backgroundColor: '#059669'
                          }
                        }}
                      >
                        {t('common.add')}
                      </Button>
                    )}
                  </Box>
                </Box>
              </Paper>
              );
            })}
          </Box>
        </DialogContent>
        <DialogActions sx={{
          px: { xs: 2, sm: 3 },
          py: { xs: 2, sm: 2.5 },
          borderTop: '1px solid',
          borderColor: 'divider',
          gap: { xs: 1, sm: 2 }
        }}>
          <Button
            onClick={() => setBuiltinDialogOpen(false)}
            variant="outlined"
            fullWidth={window.innerWidth < 600}
            sx={{
              minHeight: { xs: 44, sm: 36 },
              fontSize: { xs: '1rem', sm: '0.875rem' }
            }}
          >
            {t('common.close')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog
        open={!!deletingId}
        onClose={() => setDeletingId(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{t('settings.mcpServer.dialog.deleteTitle')}</DialogTitle>
        <DialogContent>
          <Typography>{t('settings.mcpServer.dialog.deleteContent', { name: servers.find(s => s.id === deletingId)?.name })}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeletingId(null)}>{t('common.cancel')}</Button>
          <Button onClick={() => handleDeleteServer(servers.find(s => s.id === deletingId) as MCPServer)} variant="contained" color="error">
            {t('common.delete')}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default MCPServerSettings;
