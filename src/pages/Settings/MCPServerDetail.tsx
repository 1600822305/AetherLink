import React, { useState, useEffect } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Paper,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Button,
  Chip,
  Avatar,
  alpha,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  Snackbar,
  Alert,
  CircularProgress,
  Stack
} from '@mui/material';
import CustomSwitch from '../../components/CustomSwitch';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  ArrowLeft as ArrowBackIcon,
  Save as SaveIcon,
  Play as TestIcon,
  ChevronDown as ExpandMoreIcon,
  Database as StorageIcon,
  Globe as HttpIcon,
  Settings as SettingsIcon,
  Wrench as BuildIcon,
  FileText as DescriptionIcon,
  Folder as FolderIcon,
  Plus as PlusIcon,
  Trash2 as DeleteIcon,
  Terminal as TerminalIcon
} from 'lucide-react';
import { isTauri, isDesktop } from '../../shared/utils/platformDetection';
import type { MCPServer, MCPServerType, MCPTool, MCPPrompt, MCPResource } from '../../shared/types';
import { mcpService } from '../../shared/services/mcp';
import { useTranslation } from '../../i18n';
import { SafeAreaContainer } from '../../components/settings/SettingComponents';

const MCPServerDetail: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { serverId } = useParams<{ serverId: string }>();
  const location = useLocation();
  const [server, setServer] = useState<MCPServer | null>(null);
  const [tools, setTools] = useState<MCPTool[]>([]);
  const [prompts, setPrompts] = useState<MCPPrompt[]>([]);
  const [resources, setResources] = useState<MCPResource[]>([]);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success'
  });

  // 请求头和环境变量的内部状态（带唯一 ID）
  type KeyValuePair = { id: string; key: string; value: string };
  const [headerPairs, setHeaderPairs] = useState<KeyValuePair[]>([]);
  const [envPairs, setEnvPairs] = useState<KeyValuePair[]>([]);

  // 从 server.headers 初始化 headerPairs
  useEffect(() => {
    if (server?.headers) {
      const pairs = Object.entries(server.headers).map(([key, value]) => ({
        id: Math.random().toString(36).substring(7),
        key,
        value
      }));
      setHeaderPairs(pairs);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [server?.id]); // 只在服务器 ID 变化时重新初始化

  // 从 server.env 初始化 envPairs
  useEffect(() => {
    if (server?.env) {
      const pairs = Object.entries(server.env).map(([key, value]) => ({
        id: Math.random().toString(36).substring(7),
        key,
        value
      }));
      setEnvPairs(pairs);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [server?.id]); // 只在服务器 ID 变化时重新初始化

  useEffect(() => {
    const initServer = async () => {
      if (location.state?.server) {
        setServer(location.state.server);
        loadServerData(location.state.server);
      } else if (serverId) {
        // 🔧 修复：使用异步方法确保数据完整加载，避免竞态条件
        const foundServer = await mcpService.getServerByIdAsync(serverId);
        if (foundServer) {
          setServer(foundServer);
          loadServerData(foundServer);
        }
      }
    };
    initServer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverId, location.state]);

  const loadServerData = async (serverData: MCPServer) => {
    if (!serverData.isActive) return;

    setLoading(true);
    try {
      const [toolsList, promptsList, resourcesList] = await Promise.all([
        mcpService.listTools(serverData),
        mcpService.listPrompts(serverData),
        mcpService.listResources(serverData)
      ]);

      setTools(toolsList);
      setPrompts(promptsList);
      setResources(resourcesList);
    } catch (error) {
      console.error(t('settings.mcpServer.messages.loadDataFailed'), error);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate('/settings/mcp-server');
  };

  const handleSave = async () => {
    if (!server) return;

    try {
      await mcpService.updateServer(server);
      setSnackbar({
        open: true,
        message: t('settings.mcpServer.messages.saveSuccess'),
        severity: 'success'
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: t('settings.mcpServer.messages.saveFailed'),
        severity: 'error'
      });
    }
  };

  const handleTest = async () => {
    if (!server) return;

    setTesting(true);
    try {
      const result = await mcpService.testConnection(server);
      setSnackbar({
        open: true,
        message: result ? t('settings.mcpServer.messages.testSuccess') : t('settings.mcpServer.messages.testFailed'),
        severity: result ? 'success' : 'error'
      });

      if (result && server.isActive) {
        await loadServerData(server);
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: t('settings.mcpServer.messages.testFailed'),
        severity: 'error'
      });
    } finally {
      setTesting(false);
    }
  };

  const handleToggleActive = async (isActive: boolean) => {
    if (!server) return;

    try {
      await mcpService.toggleServer(server.id, isActive);
      setServer({ ...server, isActive });

      if (isActive) {
        await loadServerData({ ...server, isActive });
      } else {
        setTools([]);
        setPrompts([]);
        setResources([]);
      }

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

  // 检测是否为 Tauri 桌面端
  const isTauriDesktop = isTauri() && isDesktop();

  const getServerTypeIcon = (type: MCPServerType) => {
    switch (type) {
      case 'sse':
      case 'streamableHttp':
      case 'httpStream':
        return <HttpIcon />;
      case 'stdio':
        return <TerminalIcon />;
      case 'inMemory':
        return <StorageIcon />;
      default:
        return <SettingsIcon />;
    }
  };

  const getServerTypeColor = (type: MCPServerType) => {
    switch (type) {
      case 'sse':
        return '#2196f3';
      case 'streamableHttp':
        return '#00bcd4';
      case 'httpStream':
        return '#9c27b0';
      case 'stdio':
        return '#ff9800';
      case 'inMemory':
        return '#4CAF50';
      default:
        return '#9e9e9e';
    }
  };

  if (!server) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <SafeAreaContainer>
      <AppBar
        position="static"
        elevation={0}
        sx={{
          bgcolor: 'background.paper',
          color: 'text.primary',
          borderBottom: 1,
          borderColor: 'divider'
        }}
      >
        <Toolbar>
          <IconButton
            edge="start"
            onClick={handleBack}
            aria-label="back"
            sx={{ color: 'primary.main' }}
          >
            <ArrowBackIcon />
          </IconButton>
          <Avatar
            sx={{
              bgcolor: alpha(getServerTypeColor(server.type), 0.1),
              color: getServerTypeColor(server.type),
              mr: 2,
              width: 32,
              height: 32
            }}
          >
            {getServerTypeIcon(server.type)}
          </Avatar>
          <Typography
            variant="h6"
            component="div"
            sx={{
              flexGrow: 1,
              fontWeight: 600
            }}
          >
            {server.name}
          </Typography>
          <Button
            startIcon={testing ? <CircularProgress size={16} /> : <TestIcon />}
            onClick={handleTest}
            disabled={testing}
            size="small"
            sx={{ mr: 1 }}
          >
            {t('settings.mcpServer.detail.buttons.test')}
          </Button>
          <Button
            startIcon={<SaveIcon />}
            onClick={handleSave}
            variant="contained"
            size="small"
          >
            {t('settings.mcpServer.detail.buttons.save')}
          </Button>
        </Toolbar>
      </AppBar>

      <Box
        sx={{
          flexGrow: 1,
          overflow: 'auto',
          px: 2,
          py: 2,
          pb: 'var(--content-bottom-padding)'
        }}
      >
        {/* 基本信息 */}
        <Paper sx={{ p: 3, mb: 2 }}>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SettingsIcon />
            {t('settings.mcpServer.detail.basicInfo.title')}
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <FormControlLabel
              control={
                <CustomSwitch
                  checked={server.isActive}
                  onChange={(e) => handleToggleActive(e.target.checked)}
                />
              }
              label={t('settings.mcpServer.detail.basicInfo.enableServer')}
            />
            {server.isActive && (
              <Chip
                label={t('settings.mcpServer.status.active')}
                size="small"
                color="success"
                variant="outlined"
                sx={{ ml: 2 }}
              />
            )}
          </Box>

          <TextField
            fullWidth
            label={t('settings.mcpServer.detail.basicInfo.serverName')}
            value={server.name}
            onChange={(e) => setServer({ ...server, name: e.target.value })}
            sx={{ mb: 2 }}
          />

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>{t('settings.mcpServer.detail.basicInfo.serverType')}</InputLabel>
            <Select
              value={server.type}
              label={t('settings.mcpServer.detail.basicInfo.serverType')}
              onChange={(e) => setServer({ ...server, type: e.target.value as MCPServerType })}
            >
              <MenuItem value="sse">{t('settings.mcpServer.detail.basicInfo.types.sse')}</MenuItem>
              <MenuItem value="streamableHttp">{t('settings.mcpServer.detail.basicInfo.types.streamableHttp')}</MenuItem>
              <MenuItem value="inMemory">{t('settings.mcpServer.detail.basicInfo.types.inMemory')}</MenuItem>
              {/* stdio 类型仅在 Tauri 桌面端显示 */}
              {isTauriDesktop && (
                <MenuItem value="stdio">{t('settings.mcpServer.detail.basicInfo.types.stdio') || '标准输入/输出 (stdio)'}</MenuItem>
              )}
            </Select>
          </FormControl>

          {(server.type === 'sse' || server.type === 'streamableHttp' || server.type === 'httpStream') && (
            <TextField
              fullWidth
              label={t('settings.mcpServer.detail.basicInfo.serverUrl')}
              value={server.baseUrl || ''}
              onChange={(e) => setServer({ ...server, baseUrl: e.target.value })}
              placeholder={t('settings.mcpServer.detail.basicInfo.placeholders.url')}
              sx={{ mb: 2 }}
            />
          )}

          {/* stdio 类型的命令和参数输入 */}
          {server.type === 'stdio' && (
            <>
              <TextField
                fullWidth
                label={t('settings.mcpServer.detail.basicInfo.command') || '命令'}
                value={server.command || ''}
                onChange={(e) => setServer({ ...server, command: e.target.value })}
                placeholder="npx, node, python, uvx..."
                helperText={t('settings.mcpServer.detail.basicInfo.commandHelp') || '要执行的命令程序'}
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                label={t('settings.mcpServer.detail.basicInfo.args') || '命令参数'}
                value={server.argsText ?? (server.args || []).join(' ')}
                onChange={(e) => setServer({ ...server, argsText: e.target.value })}
                onBlur={() =>
                  setServer((prev) => {
                    if (!prev) return prev;
                    return {
                      ...prev,
                      args: (prev.argsText ?? '').trim() ? (prev.argsText ?? '').trim().split(/\s+/) : []
                    };
                  })
                }
                placeholder="C:\\path\\to\\script.js 或 -y @anthropic/mcp-server-fetch"
                helperText={t('settings.mcpServer.detail.basicInfo.argsHelp') || '命令参数，用空格分隔'}
                sx={{ mb: 2 }}
              />
            </>
          )}

          <TextField
            fullWidth
            label={t('settings.mcpServer.detail.basicInfo.description')}
            value={server.description || ''}
            onChange={(e) => setServer({ ...server, description: e.target.value })}
            multiline
            rows={2}
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label={t('settings.mcpServer.detail.basicInfo.timeout')}
            type="number"
            value={server.timeout || 60}
            onChange={(e) => setServer({ ...server, timeout: parseInt(e.target.value) || 60 })}
            inputProps={{ min: 1, max: 300 }}
            sx={{ mb: 2 }}
          />

        </Paper>

        {/* 高级设置 */}
        <Accordion sx={{ mb: 2 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <BuildIcon />
              {t('settings.mcpServer.detail.advanced.title')}
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            {/* 自定义请求头 */}
            <Typography variant="subtitle2" gutterBottom sx={{ mt: 1, mb: 1, fontWeight: 600 }}>
              {t('settings.mcpServer.detail.advanced.headers')}
            </Typography>
            <Stack spacing={1.5} sx={{ mb: 3 }}>
              {headerPairs.map((pair) => (
                <Stack 
                  key={pair.id} 
                  direction={{ xs: 'column', sm: 'row' }} 
                  spacing={1} 
                  alignItems={{ xs: 'stretch', sm: 'center' }}
                  sx={{
                    p: { xs: 1.5, sm: 0 },
                    bgcolor: { xs: 'background.paper', sm: 'transparent' },
                    borderRadius: { xs: 1, sm: 0 },
                    border: { xs: 1, sm: 0 },
                    borderColor: { xs: 'divider', sm: 'transparent' }
                  }}
                >
                  <TextField
                    size="small"
                    label={t('settings.mcpServer.detail.advanced.placeholders.headerKey')}
                    placeholder={t('settings.mcpServer.detail.advanced.placeholders.headerKey')}
                    value={pair.key}
                    onChange={(e) => {
                      const newPairs = headerPairs.map(p => 
                        p.id === pair.id ? { ...p, key: e.target.value } : p
                      );
                      setHeaderPairs(newPairs);
                      // 更新 server.headers
                      const newHeaders: Record<string, string> = {};
                      newPairs.forEach(p => {
                        if (p.key.trim()) newHeaders[p.key] = p.value;
                      });
                      setServer({ ...server, headers: newHeaders });
                    }}
                    sx={{ flex: { xs: 'auto', sm: 1 } }}
                  />
                  <TextField
                    size="small"
                    label={t('settings.mcpServer.detail.advanced.placeholders.headerValue')}
                    placeholder={t('settings.mcpServer.detail.advanced.placeholders.headerValue')}
                    value={pair.value}
                    onChange={(e) => {
                      const newPairs = headerPairs.map(p => 
                        p.id === pair.id ? { ...p, value: e.target.value } : p
                      );
                      setHeaderPairs(newPairs);
                      // 更新 server.headers
                      const newHeaders: Record<string, string> = {};
                      newPairs.forEach(p => {
                        if (p.key.trim()) newHeaders[p.key] = p.value;
                      });
                      setServer({ ...server, headers: newHeaders });
                    }}
                    sx={{ flex: { xs: 'auto', sm: 2 } }}
                  />
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => {
                      const newPairs = headerPairs.filter(p => p.id !== pair.id);
                      setHeaderPairs(newPairs);
                      // 更新 server.headers
                      const newHeaders: Record<string, string> = {};
                      newPairs.forEach(p => {
                        if (p.key.trim()) newHeaders[p.key] = p.value;
                      });
                      setServer({ ...server, headers: newHeaders });
                    }}
                    sx={{ alignSelf: { xs: 'flex-end', sm: 'center' } }}
                  >
                    <DeleteIcon size={18} />
                  </IconButton>
                </Stack>
              ))}
              <Button
                startIcon={<PlusIcon size={16} />}
                onClick={() => {
                  setHeaderPairs([
                    ...headerPairs,
                    { id: Math.random().toString(36).substring(7), key: '', value: '' }
                  ]);
                }}
                variant="outlined"
                size="small"
                sx={{ alignSelf: 'flex-start' }}
              >
                {t('settings.mcpServer.detail.advanced.addHeader')}
              </Button>
            </Stack>

            {/* 环境变量 */}
            <Typography variant="subtitle2" gutterBottom sx={{ mt: 2, mb: 1, fontWeight: 600 }}>
              {t('settings.mcpServer.detail.advanced.env')}
            </Typography>
            <Stack spacing={1.5} sx={{ mb: 3 }}>
              {envPairs.map((pair) => (
                <Stack 
                  key={pair.id} 
                  direction={{ xs: 'column', sm: 'row' }} 
                  spacing={1} 
                  alignItems={{ xs: 'stretch', sm: 'center' }}
                  sx={{
                    p: { xs: 1.5, sm: 0 },
                    bgcolor: { xs: 'background.paper', sm: 'transparent' },
                    borderRadius: { xs: 1, sm: 0 },
                    border: { xs: 1, sm: 0 },
                    borderColor: { xs: 'divider', sm: 'transparent' }
                  }}
                >
                  <TextField
                    size="small"
                    label={t('settings.mcpServer.detail.advanced.placeholders.envKey')}
                    placeholder={t('settings.mcpServer.detail.advanced.placeholders.envKey')}
                    value={pair.key}
                    onChange={(e) => {
                      const newPairs = envPairs.map(p => 
                        p.id === pair.id ? { ...p, key: e.target.value } : p
                      );
                      setEnvPairs(newPairs);
                      // 更新 server.env
                      const newEnv: Record<string, string> = {};
                      newPairs.forEach(p => {
                        if (p.key.trim()) newEnv[p.key] = p.value;
                      });
                      setServer({ ...server, env: newEnv });
                    }}
                    sx={{ flex: { xs: 'auto', sm: 1 } }}
                  />
                  <TextField
                    size="small"
                    label={t('settings.mcpServer.detail.advanced.placeholders.envValue')}
                    placeholder={t('settings.mcpServer.detail.advanced.placeholders.envValue')}
                    value={pair.value}
                    onChange={(e) => {
                      const newPairs = envPairs.map(p => 
                        p.id === pair.id ? { ...p, value: e.target.value } : p
                      );
                      setEnvPairs(newPairs);
                      // 更新 server.env
                      const newEnv: Record<string, string> = {};
                      newPairs.forEach(p => {
                        if (p.key.trim()) newEnv[p.key] = p.value;
                      });
                      setServer({ ...server, env: newEnv });
                    }}
                    sx={{ flex: { xs: 'auto', sm: 2 } }}
                  />
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => {
                      const newPairs = envPairs.filter(p => p.id !== pair.id);
                      setEnvPairs(newPairs);
                      // 更新 server.env
                      const newEnv: Record<string, string> = {};
                      newPairs.forEach(p => {
                        if (p.key.trim()) newEnv[p.key] = p.value;
                      });
                      setServer({ ...server, env: newEnv });
                    }}
                    sx={{ alignSelf: { xs: 'flex-end', sm: 'center' } }}
                  >
                    <DeleteIcon size={18} />
                  </IconButton>
                </Stack>
              ))}
              <Button
                startIcon={<PlusIcon size={16} />}
                onClick={() => {
                  setEnvPairs([
                    ...envPairs,
                    { id: Math.random().toString(36).substring(7), key: '', value: '' }
                  ]);
                }}
                variant="outlined"
                size="small"
                sx={{ alignSelf: 'flex-start' }}
              >
                {t('settings.mcpServer.detail.advanced.addEnv')}
              </Button>
            </Stack>

            {/* 启动参数（仅 inMemory 类型需要） */}
            {server.type === 'inMemory' && (
              <>
                <Typography variant="subtitle2" gutterBottom sx={{ mt: 2, mb: 1, fontWeight: 600 }}>
                  {t('settings.mcpServer.detail.advanced.args')}
                </Typography>
                <TextField
                  fullWidth
                  value={(server.args || []).join('\n')}
                  onChange={(e) => {
                    const value = e.target.value || '';
                    const args = value.split('\n').filter(arg => arg.trim());
                    setServer({ ...server, args });
                  }}
                  multiline
                  rows={3}
                  placeholder={t('settings.mcpServer.detail.advanced.placeholders.args')}
                  size="small"
                />
              </>
            )}
          </AccordionDetails>
        </Accordion>

        {/* 工具列表 */}
        {server.isActive && (
          <Accordion sx={{ mb: 2 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <BuildIcon />
                {t('settings.mcpServer.detail.tools.title')} ({tools.length})
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                  <CircularProgress />
                </Box>
              ) : tools.length === 0 ? (
                <Typography color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                  {t('settings.mcpServer.detail.tools.empty')}
                </Typography>
              ) : (
                <List>
                  {tools.map((tool, index) => (
                    <ListItem key={index} divider>
                      <ListItemText
                        primary={tool.name}
                        secondary={tool.description || t('settings.mcpServer.detail.tools.noDescription')}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </AccordionDetails>
          </Accordion>
        )}

        {/* 提示词列表 */}
        {server.isActive && (
          <Accordion sx={{ mb: 2 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <DescriptionIcon />
                {t('settings.mcpServer.detail.prompts.title')} ({prompts.length})
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                  <CircularProgress />
                </Box>
              ) : prompts.length === 0 ? (
                <Typography color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                  {t('settings.mcpServer.detail.prompts.empty')}
                </Typography>
              ) : (
                <List>
                  {prompts.map((prompt, index) => (
                    <ListItem key={index} divider>
                      <ListItemText
                        primary={prompt.name}
                        secondary={prompt.description || t('settings.mcpServer.detail.prompts.noDescription')}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </AccordionDetails>
          </Accordion>
        )}

        {/* 资源列表 */}
        {server.isActive && (
          <Accordion sx={{ mb: 2 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <FolderIcon />
                {t('settings.mcpServer.detail.resources.title')} ({resources.length})
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                  <CircularProgress />
                </Box>
              ) : resources.length === 0 ? (
                <Typography color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                  {t('settings.mcpServer.detail.resources.empty')}
                </Typography>
              ) : (
                <List>
                  {resources.map((resource, index) => (
                    <ListItem key={index} divider>
                      <ListItemText
                        primary={resource.name}
                        secondary={
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              {resource.description || t('settings.mcpServer.detail.resources.noDescription')}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {t('settings.mcpServer.detail.resources.uri')}: {resource.uri}
                            </Typography>
                          </Box>
                        }
                        secondaryTypographyProps={{ component: 'div' }}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </AccordionDetails>
          </Accordion>
        )}
      </Box>

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

export default MCPServerDetail;
