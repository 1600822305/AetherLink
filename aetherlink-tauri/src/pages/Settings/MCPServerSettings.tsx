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





  // 新服务器表单状态
  const [newServer, setNewServer] = useState<Partial<MCPServer>>({
    name: '',
    type: 'httpStream',
    description: '',
    baseUrl: '',
    isActive: false,
    enableSSE: false // 默认禁用SSE，避免不必要的错误
  });

  useEffect(() => {
    loadServers();
    loadBuiltinServers();
  }, []);

  const loadServers = () => {
    const serverList = mcpService.getServers();
    setServers(serverList);
  };

  const loadBuiltinServers = () => {
    try {
      const builtinList = mcpService.getBuiltinServers();
      setBuiltinServers(builtinList);
    } catch (error) {
      console.error('加载内置服务器失败:', error);
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
        message: isActive ? '服务器已启用' : '服务器已停用',
        severity: 'success'
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: '操作失败',
        severity: 'error'
      });
    }
  };

  const handleAddServer = async () => {
    if (!newServer.name || !newServer.type) {
      setSnackbar({
        open: true,
        message: '请填写必要信息',
        severity: 'error'
      });
      return;
    }

    if (newServer.type === 'httpStream' && !newServer.baseUrl) {
      setSnackbar({
        open: true,
        message: 'HTTP Stream 服务器需要提供 URL',
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
        enableSSE: false // 默认禁用SSE，避免不必要的错误
      });
      setSnackbar({
        open: true,
        message: '服务器添加成功',
        severity: 'success'
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: '添加失败',
        severity: 'error'
      });
    }
  };

  // 检查内置服务器是否已添加
  const isBuiltinServerAdded = (builtinServerName: string): boolean => {
    return servers.some(server => server.name === builtinServerName);
  };

  const handleAddBuiltinServer = async (builtinServer: MCPServer) => {
    // 检查是否已添加
    if (isBuiltinServerAdded(builtinServer.name)) {
      setSnackbar({
        open: true,
        message: `服务器 ${builtinServer.name} 已存在`,
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
        message: `内置服务器 ${builtinServer.name} 添加成功`,
        severity: 'success'
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: '添加内置服务器失败',
        severity: 'error'
      });
    }
  };

  const handleEditServer = (server: MCPServer) => {
    navigate(`/settings/mcp-server/${server.id}`, { state: { server } });
  };

  // 处理删除服务器
  const handleDeleteServer = async (server: MCPServer) => {
    if (deletingId) return; // 防止重复进入
    setDeletingId(server.id); // 标记为忙碌

    try {
      await mcpService.removeServer(server.id);
      loadServers();
      setSnackbar({
        open: true,
        message: `服务器 "${server.name}" 已删除`,
        severity: 'success'
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: '删除失败',
        severity: 'error'
      });
    } finally {
      setDeletingId(null); // 重置
    }
  };



  const handleImportJson = async () => {
    try {
      const config = JSON.parse(importJson);

      if (!config.mcpServers || typeof config.mcpServers !== 'object') {
        throw new Error('JSON 格式不正确：缺少 mcpServers 字段');
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
            description: `从 JSON 导入的服务器: ${serverName}`,
            isActive: false,
            headers: {},
            env: {},
            args: []
          };

          await mcpService.addServer(server);
          importCount++;
        } catch (error) {
          errors.push(`${serverName}: ${error instanceof Error ? error.message : '未知错误'}`);
        }
      }

      loadServers();
      setImportDialogOpen(false);
      setImportJson('');

      if (importCount > 0) {
        setSnackbar({
          open: true,
          message: `成功导入 ${importCount} 个服务器${errors.length > 0 ? `，${errors.length} 个失败` : ''}`,
          severity: errors.length > 0 ? 'error' : 'success'
        });
      } else {
        setSnackbar({
          open: true,
          message: '导入失败：' + errors.join('; '),
          severity: 'error'
        });
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: `JSON 解析失败: ${error instanceof Error ? error.message : '未知错误'}`,
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
    switch (type) {
      case 'httpStream':
        return 'HTTP Stream';
      case 'inMemory':
        return '内存';
      default:
        return '未知';
    }
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
            MCP 服务器
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
            添加
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
                还没有配置 MCP 服务器
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  mb: { xs: 2.5, sm: 3 },
                  fontSize: { xs: '0.875rem', sm: '0.875rem' }
                }}
              >
                MCP 服务器可以为 AI 提供额外的工具和功能
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
                  添加服务器
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
                  导入配置
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
                  内置服务器
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
                MCP 服务器列表
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
              >
                管理您的 MCP 服务器配置和状态
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
                                label="运行中"
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
              快捷操作
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
            >
              快速添加和管理 MCP 服务器
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
                      导入配置
                    </Typography>
                  }
                  secondary={
                    <Typography sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
                      从 JSON 文件导入 MCP 服务器配置
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
                      内置服务器
                    </Typography>
                  }
                  secondary={
                    <Typography sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
                      添加预配置的内置 MCP 服务器
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
        <DialogTitle>添加 MCP 服务器</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="服务器名称"
            fullWidth
            variant="outlined"
            value={newServer.name}
            onChange={(e) => setNewServer({ ...newServer, name: e.target.value })}
            sx={{ mb: 2 }}
          />
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>服务器类型</InputLabel>
            <Select
              value={newServer.type}
              label="服务器类型"
              onChange={(e) => setNewServer({ ...newServer, type: e.target.value as MCPServerType })}
            >
              <MenuItem value="httpStream">HTTP Stream (支持SSE+HTTP)</MenuItem>
              <MenuItem value="inMemory">内存服务器</MenuItem>
            </Select>
          </FormControl>
          {newServer.type === 'httpStream' && (
            <TextField
              margin="dense"
              label="服务器 URL"
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
            label="描述（可选）"
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
              label="启用SSE流（Server-Sent Events）"
              sx={{ mt: 1 }}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialogOpen(false)}>取消</Button>
          <Button onClick={handleAddServer} variant="contained">添加</Button>
        </DialogActions>
      </Dialog>

      {/* JSON 导入对话框 */}
      <Dialog
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>导入 MCP 服务器配置</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            粘贴包含 MCP 服务器配置的 JSON 文件内容。支持的格式示例：
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
            label="JSON 配置"
            fullWidth
            multiline
            rows={10}
            variant="outlined"
            value={importJson}
            onChange={(e) => setImportJson(e.target.value)}
            placeholder="在此粘贴 JSON 配置..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportDialogOpen(false)}>取消</Button>
          <Button
            onClick={handleImportJson}
            variant="contained"
            disabled={!importJson.trim()}
          >
            导入
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
          添加内置 MCP 服务器
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
            选择要添加的内置 MCP 服务器。这些服务器由 Cherry Studio 提供，无需额外配置即可使用。
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
                        已添加
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
                        添加
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
            关闭
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
