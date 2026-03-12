import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Snackbar,
  Alert,
  Divider,
  Tabs,
  Tab
} from '@mui/material';
import { nanoid } from 'nanoid';
import CustomSwitch from '../../components/CustomSwitch';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft as ArrowBackIcon,
  Plus as AddIcon,
  Server as ServerIcon,
  Trash2 as DeleteIcon,
  Wrench as ToolIcon,
  Bot as BotIcon
} from 'lucide-react';

import type { MCPServer } from '../../shared/types';
import { mcpService } from '../../shared/services/mcp';
import { useTranslation } from '../../i18n';
import { SafeAreaContainer, CARD_STYLES } from '../../components/settings/SettingComponents';
import Scrollbar from '../../components/Scrollbar';
import { isTauri, isDesktop } from '../../shared/utils/platformDetection';
import { getServerTypeIcon, getServerTypeLabel, getServerTypeColor, normalizeType } from './MCPServerSettings/mcpServerUtils';
import AddServerDialog from './MCPServerSettings/AddServerDialog';
import ImportJsonDialog from './MCPServerSettings/ImportJsonDialog';
import BuiltinServerListItem from './MCPServerSettings/BuiltinServerListItem';

const MCPServerSettings: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [builtinServers, setBuiltinServers] = useState<MCPServer[]>([]);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'warning' }>({
    open: false,
    message: '',
    severity: 'success'
  });
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // 从 URL query 参数恢复 Tab 状态
  const initialTab = (() => {
    const params = new URLSearchParams(location.search);
    const tab = parseInt(params.get('tab') || '0', 10);
    return [0, 1, 2].includes(tab) ? tab : 0;
  })();
  const [activeTab, setActiveTab] = useState(initialTab);

  // ─── 左右滑动切换 Tab ───
  const TAB_COUNT = 3;
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isSwiping = useRef(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isSwiping.current = false;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    // 水平滑动距离 > 60px 且水平位移大于垂直位移（防止误触纵向滚动）
    if (Math.abs(deltaX) > 60 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
      setActiveTab(prev => {
        if (deltaX < 0) return Math.min(prev + 1, TAB_COUNT - 1); // 左滑 → 下一个
        return Math.max(prev - 1, 0); // 右滑 → 上一个
      });
    }
  }, []);

  // 新服务器表单状态
  const [newServer, setNewServer] = useState<Partial<MCPServer>>({
    id: nanoid(),
    name: '',
    type: 'sse',
    description: '',
    baseUrl: '',
    command: '',
    isActive: false
  });

  // 检测是否为 Tauri 桌面端（仅在此环境下显示 stdio 选项）
  const isTauriDesktop = isTauri() && isDesktop();

  useEffect(() => {
    loadServers();
    loadBuiltinServers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadServers = async () => {
    // 🔧 修复：使用异步方法确保数据完整加载，避免竞态条件
    const serverList = await mcpService.getServersAsync();
    setServers(serverList);
  };

  const loadBuiltinServers = () => {
    try {
      const builtinList = mcpService.getBuiltinServers();
      setBuiltinServers(builtinList);
    } catch (error) {
      console.error(t('settings.mcpServer.messages.loadBuiltinFailed'), error);
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
        message: isActive ? t('settings.mcpServer.messages.serverEnabled') : t('settings.mcpServer.messages.serverDisabled'),
        severity: 'success'
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: t('settings.mcpServer.messages.operationFailed'),
        severity: 'error'
      });
    }
  };

  const handleAddServer = async () => {
    if (!newServer.name || !newServer.type) {
      setSnackbar({ open: true, message: t('settings.mcpServer.messages.fillRequiredInfo'), severity: 'error' });
      return;
    }
    if ((newServer.type === 'sse' || newServer.type === 'streamableHttp' || newServer.type === 'httpStream') && !newServer.baseUrl) {
      setSnackbar({ open: true, message: t('settings.mcpServer.messages.urlRequired'), severity: 'error' });
      return;
    }
    if (newServer.type === 'stdio' && !newServer.command) {
      setSnackbar({ open: true, message: t('settings.mcpServer.messages.commandRequired') || '请输入要执行的命令', severity: 'error' });
      return;
    }

    try {
      const parsedArgs = (newServer.argsText ?? '').trim()
        ? (newServer.argsText ?? '').trim().split(/\s+/)
        : (newServer.args ?? []);

      const server: MCPServer = {
        id: Date.now().toString(),
        name: newServer.name!,
        type: newServer.type!,
        description: newServer.description,
        baseUrl: newServer.baseUrl,
        command: newServer.command,
        isActive: false,
        headers: {},
        env: {},
        args: parsedArgs
      };
      await mcpService.addServer(server);
      loadServers();
      setAddDialogOpen(false);
      resetNewServer();
      setSnackbar({ open: true, message: t('settings.mcpServer.messages.serverAdded'), severity: 'success' });
    } catch (error) {
      setSnackbar({ open: true, message: t('settings.mcpServer.messages.addFailed'), severity: 'error' });
    }
  };

  const resetNewServer = () => {
    setNewServer({ id: nanoid(), name: '', type: 'sse', description: '', baseUrl: '', command: '', isActive: false });
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
        message: t('settings.mcpServer.messages.serverExists', { name: builtinServer.name }),
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
        message: t('settings.mcpServer.messages.builtinServerAdded', { name: builtinServer.name }),
        severity: 'success'
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: t('settings.mcpServer.messages.builtinAddFailed'),
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
        message: t('settings.mcpServer.messages.serverDeleted', { name: server.name }),
        severity: 'success'
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: t('settings.mcpServer.messages.deleteFailed'),
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
        throw new Error(t('settings.mcpServer.messages.jsonFormatError'));
      }

      let importCount = 0;
      const errors: string[] = [];

      for (const [serverName, serverConfig] of Object.entries(config.mcpServers)) {
        try {
          const configAny = serverConfig as any;
          const server: MCPServer = {
            id: Date.now().toString() + Math.random().toString(36).substring(2, 11),
            name: serverName,
            type: normalizeType(configAny.type, configAny),
            baseUrl: configAny.url || configAny.baseUrl,
            command: configAny.command,
            description: t('settings.mcpServer.messages.importFromJson', { name: serverName }),
            isActive: false,
            headers: configAny.headers || {},
            env: configAny.env || {},
            args: configAny.args || []
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
          message: errors.length > 0
            ? t('settings.mcpServer.messages.importPartial', { count: importCount, errors: errors.length })
            : t('settings.mcpServer.messages.importSuccess', { count: importCount }),
          severity: errors.length > 0 ? 'error' : 'success'
        });
      } else {
        setSnackbar({ open: true, message: t('settings.mcpServer.messages.importFailed', { errors: errors.join('; ') }), severity: 'error' });
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: t('settings.mcpServer.messages.jsonParseError', { error: error instanceof Error ? error.message : t('settings.mcpServer.messages.operationFailed') }),
        severity: 'error'
      });
    }
  };


  // ─── 分类过滤 ───
  const externalServers = servers.filter(s => !mcpService.isBuiltinServer(s.name));
  const builtinTemplates = builtinServers.filter(s => s.category !== 'assistant');
  const assistantTemplates = builtinServers.filter(s => s.category === 'assistant');

  const getAddedServer = (templateName: string): MCPServer | undefined => {
    return servers.find(s => s.name === templateName);
  };

  const handleNavigateAssistant = (server: MCPServer) => {
    navigate(`/settings/mcp-assistant/${server.id}`, { state: { server } });
  };

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
              }}
            >
              {t('settings.mcpServer.pageTitle')}
            </Typography>
          {activeTab === 0 && (
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
              {t('settings.mcpServer.addButton')}
            </Button>
          )}
        </Toolbar>
      </AppBar>

      {/* ─── Tab 导航栏 ─── */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          variant="fullWidth"
          sx={{ minHeight: 42 }}
        >
          <Tab
            icon={<ServerIcon size={16} />} iconPosition="start"
            label={t('settings.mcpServer.tabs.external') || '外部服务器'}
            sx={{ minHeight: 42, textTransform: 'none', fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
          />
          <Tab
            icon={<ToolIcon size={16} />} iconPosition="start"
            label={t('settings.mcpServer.tabs.builtin') || '内置工具'}
            sx={{ minHeight: 42, textTransform: 'none', fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
          />
          <Tab
            icon={<BotIcon size={16} />} iconPosition="start"
            label={t('settings.mcpServer.tabs.assistant') || '智能助手'}
            sx={{ minHeight: 42, textTransform: 'none', fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
          />
        </Tabs>
      </Box>

      <Scrollbar
        style={{
          flexGrow: 1,
          padding: '16px',
          paddingBottom: 'var(--content-bottom-padding)',
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* ═══════ Tab 0: 外部服务器 ═══════ */}
        {activeTab === 0 && (
          <>
            {externalServers.length === 0 ? (
              <Paper elevation={0} sx={CARD_STYLES.elevated}>
                <Box sx={{ p: { xs: 3, sm: 4 }, textAlign: 'center' }}>
                  <Box sx={{ mb: { xs: 1.5, sm: 2 } }}>
                    <ServerIcon size={48} style={{ color: '#2196f3' }} />
                  </Box>
                  <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>
                    {t('settings.mcpServer.emptyState.title')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: { xs: 2.5, sm: 3 } }}>
                    {t('settings.mcpServer.emptyState.description')}
                  </Typography>
                  <Box sx={{
                    display: 'flex', gap: { xs: 1.5, sm: 2 }, flexWrap: 'wrap',
                    justifyContent: 'center', flexDirection: { xs: 'column', sm: 'row' }, alignItems: 'center'
                  }}>
                    <Button variant="contained" startIcon={<AddIcon />}
                      onClick={() => setAddDialogOpen(true)}
                      fullWidth={window.innerWidth < 600}
                      sx={{ minHeight: { xs: 44, sm: 36 } }}
                    >
                      {t('settings.mcpServer.emptyState.addServer')}
                    </Button>
                    <Button variant="outlined"
                      onClick={() => setImportDialogOpen(true)}
                      fullWidth={window.innerWidth < 600}
                      sx={{ minHeight: { xs: 44, sm: 36 } }}
                    >
                      {t('settings.mcpServer.emptyState.importConfig')}
                    </Button>
                  </Box>
                </Box>
              </Paper>
            ) : (
              <Paper elevation={0} sx={CARD_STYLES.elevated}>
                <Box sx={CARD_STYLES.header}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, fontSize: { xs: '1rem', sm: '1.1rem' } }}>
                    {t('settings.mcpServer.serverList.title')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
                    {t('settings.mcpServer.serverList.description')}
                  </Typography>
                </Box>
                <Divider />
                <List disablePadding>
                  {externalServers.map((server, index) => (
                    <React.Fragment key={server.id}>
                      <ListItem disablePadding sx={{ transition: 'all 0.2s', '&:hover': { bgcolor: (theme) => alpha(theme.palette.primary.main, 0.05) } }}>
                        <ListItemButton onClick={() => handleEditServer(server)} sx={{ flex: 1 }}>
                          <ListItemAvatar>
                            <Avatar sx={{ bgcolor: alpha(getServerTypeColor(server.type), 0.12), color: getServerTypeColor(server.type), boxShadow: '0 2px 6px rgba(0,0,0,0.05)' }}>
                              {getServerTypeIcon(server.type)}
                            </Avatar>
                          </ListItemAvatar>
                          <ListItemText
                            primary={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 1 }, flexWrap: 'wrap' }}>
                                <Typography sx={{ fontWeight: 600, fontSize: { xs: '0.9rem', sm: '1rem' } }}>
                                  {server.name}
                                </Typography>
                                <Chip label={getServerTypeLabel(server.type, t)} size="small"
                                  sx={{ bgcolor: alpha(getServerTypeColor(server.type), 0.1), color: getServerTypeColor(server.type), fontWeight: 500, fontSize: '0.7rem', height: { xs: 20, sm: 24 } }}
                                />
                                {server.isActive && (
                                  <Chip label={t('settings.mcpServer.status.active')} size="small" color="success" variant="outlined"
                                    sx={{ fontSize: '0.7rem', height: { xs: 20, sm: 24 } }}
                                  />
                                )}
                              </Box>
                            }
                            secondary={
                              <Box component="div" sx={{ mt: { xs: 0.5, sm: 1 } }}>
                                {server.description && (
                                  <Typography variant="body2" color="text.secondary" component="div"
                                    sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' }, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                                  >
                                    {server.description}
                                  </Typography>
                                )}
                                {server.baseUrl && (
                                  <Typography variant="caption" color="text.secondary" component="div"
                                    sx={{ fontSize: '0.7rem', mt: 0.5, wordBreak: 'break-all' }}
                                  >
                                    {server.baseUrl}
                                  </Typography>
                                )}
                              </Box>
                            }
                            secondaryTypographyProps={{ component: 'div' }}
                          />
                        </ListItemButton>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 2 }}>
                          <CustomSwitch checked={server.isActive}
                            onChange={(e) => { e.stopPropagation(); handleToggleServer(server.id, e.target.checked); }}
                          />
                          <IconButton size="small" disabled={deletingId === server.id}
                            onClick={(e) => { e.stopPropagation(); handleDeleteServer(server); }}
                            sx={{ color: deletingId === server.id ? 'text.disabled' : 'error.main', '&:hover': { bgcolor: (theme) => alpha(theme.palette.error.main, 0.1) } }}
                          >
                            <DeleteIcon size={18} />
                          </IconButton>
                        </Box>
                      </ListItem>
                      {index < externalServers.length - 1 && <Divider variant="inset" component="li" sx={{ ml: 0 }} />}
                    </React.Fragment>
                  ))}
                </List>
              </Paper>
            )}

            {/* 快捷操作 */}
            <Paper elevation={0} sx={{ ...CARD_STYLES.elevated, mt: 2 }}>
              <List disablePadding>
                <ListItem disablePadding>
                  <ListItemButton onClick={() => setImportDialogOpen(true)}
                    sx={{ transition: 'all 0.2s', '&:hover': { bgcolor: (theme) => alpha(theme.palette.primary.main, 0.05) } }}
                  >
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: alpha('#06b6d4', 0.12), color: '#06b6d4' }}><AddIcon /></Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={<Typography sx={{ fontWeight: 600, fontSize: { xs: '0.9rem', sm: '1rem' } }}>{t('settings.mcpServer.quickActions.import.title')}</Typography>}
                      secondary={<Typography sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>{t('settings.mcpServer.quickActions.import.description')}</Typography>}
                      secondaryTypographyProps={{ component: 'div' }}
                    />
                  </ListItemButton>
                </ListItem>
              </List>
            </Paper>
          </>
        )}

        {/* ═══════ Tab 1: 内置工具 ═══════ */}
        {activeTab === 1 && (
          <Paper elevation={0} sx={CARD_STYLES.elevated}>
            <Box sx={CARD_STYLES.header}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, fontSize: { xs: '1rem', sm: '1.1rem' } }}>
                {t('settings.mcpServer.builtinDialog.title')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
                {t('settings.mcpServer.builtinDialog.description') || '选择并启用内置工具，无需配置即可使用'}
              </Typography>
            </Box>
            <Divider />
            <List disablePadding>
              {builtinTemplates.map((tpl, i) => (
                <BuiltinServerListItem key={tpl.id} template={tpl} index={i} total={builtinTemplates.length}
                  addedServer={getAddedServer(tpl.name)} deletingId={deletingId}
                  onToggleServer={handleToggleServer} onDeleteServer={handleDeleteServer}
                  onAddBuiltinServer={handleAddBuiltinServer} onNavigateAssistant={handleNavigateAssistant}
                  onEditServer={handleEditServer}
                />
              ))}
            </List>
          </Paper>
        )}

        {/* ═══════ Tab 2: 智能助手 ═══════ */}
        {activeTab === 2 && (
          <Paper elevation={0} sx={CARD_STYLES.elevated}>
            <Box sx={CARD_STYLES.header}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, fontSize: { xs: '1rem', sm: '1.1rem' } }}>
                {t('settings.mcpServer.tabs.assistant')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
                AI 智能助手可以在对话中直接管理应用设置，敏感操作需要用户确认
              </Typography>
            </Box>
            <Divider />
            {assistantTemplates.length > 0 ? (
              <List disablePadding>
                {assistantTemplates.map((tpl, i) => (
                <BuiltinServerListItem key={tpl.id} template={tpl} index={i} total={assistantTemplates.length}
                  addedServer={getAddedServer(tpl.name)} deletingId={deletingId}
                  onToggleServer={handleToggleServer} onDeleteServer={handleDeleteServer}
                  onAddBuiltinServer={handleAddBuiltinServer} onNavigateAssistant={handleNavigateAssistant}
                  onEditServer={handleEditServer}
                />
              ))}
              </List>
            ) : (
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <BotIcon size={40} style={{ color: '#8b5cf6', marginBottom: 8 }} />
                <Typography variant="body2" color="text.secondary">
                  暂无智能助手工具
                </Typography>
              </Box>
            )}
          </Paper>
        )}
      </Scrollbar>

      <AddServerDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        newServer={newServer}
        onNewServerChange={setNewServer}
        onAdd={handleAddServer}
        isTauriDesktop={isTauriDesktop}
      />

      <ImportJsonDialog
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        importJson={importJson}
        onImportJsonChange={setImportJson}
        onImport={handleImportJson}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </SafeAreaContainer>
  );
};

export default MCPServerSettings;
