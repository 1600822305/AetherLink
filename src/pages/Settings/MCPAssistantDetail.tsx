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
  Chip,
  alpha,
  Snackbar,
  Alert,
  Divider,
  CircularProgress,
} from '@mui/material';
import CustomSwitch from '../../components/CustomSwitch';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  ArrowLeft as ArrowBackIcon,
  Bot as BotIcon,
  ChevronRight as ChevronRightIcon,
} from 'lucide-react';

import type { MCPServer, MCPTool } from '../../shared/types';
import { mcpService } from '../../shared/services/mcp';
import { useTranslation } from '../../i18n';
import { SafeAreaContainer, CARD_STYLES } from '../../components/settings/SettingComponents';
import Scrollbar from '../../components/Scrollbar';
import { createLogger } from '../../shared/services/infra/logger';

const logger = createLogger('MCPAssistantDetail');

/** 从工具名推断所属领域 */
function inferDomain(toolName: string): string {
  if (toolName.includes('knowledge') || toolName.includes('document')) return 'knowledge';
  if (toolName.includes('appearance') || toolName.includes('theme')) return 'appearance';
  if (toolName.includes('provider') || toolName.includes('model')) return 'providers';
  return 'general';
}

const DOMAIN_LABELS: Record<string, { zh: string; icon: string }> = {
  knowledge:  { zh: '知识库管理', icon: '📚' },
  appearance: { zh: '外观设置',   icon: '🎨' },
  providers:  { zh: '模型管理',   icon: '🧠' },
  general:    { zh: '通用工具',   icon: '🔧' }
};

const DOMAIN_COLORS: Record<string, string> = {
  knowledge: '#8b5cf6',
  appearance: '#06b6d4',
  providers: '#f59e0b',
  general: '#6b7280',
};

const MCPAssistantDetail: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { serverId } = useParams<{ serverId: string }>();
  const location = useLocation();
  const [server, setServer] = useState<MCPServer | null>(null);
  const [tools, setTools] = useState<MCPTool[]>([]);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success'
  });

  useEffect(() => {
    const initServer = async () => {
      if (location.state?.server) {
        setServer(location.state.server);
        loadTools(location.state.server);
      } else if (serverId) {
        const foundServer = await mcpService.getServerByIdAsync(serverId);
        if (foundServer) {
          setServer(foundServer);
          loadTools(foundServer);
        }
      }
    };
    initServer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverId, location.state]);

  const loadTools = async (serverData: MCPServer) => {
    if (!serverData.isActive) return;
    setLoading(true);
    try {
      const toolsList = await mcpService.listTools(serverData, { includeDisabled: true });
      setTools(toolsList);
    } catch (error) {
      logger.error('加载工具列表失败', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate('/settings/mcp-server');
  };

  const handleToggleActive = async (isActive: boolean) => {
    if (!server) return;
    try {
      await mcpService.toggleServer(server.id, isActive);
      const updated = { ...server, isActive };
      setServer(updated);
      if (isActive) {
        await loadTools(updated);
      } else {
        setTools([]);
      }
      setSnackbar({
        open: true,
        message: isActive ? t('settings.mcpServer.messages.serverEnabled') : t('settings.mcpServer.messages.serverDisabled'),
        severity: 'success'
      });
    } catch (error) {
      setSnackbar({ open: true, message: t('settings.mcpServer.messages.operationFailed'), severity: 'error' });
    }
  };

  const isToolDisabled = (toolName: string): boolean => {
    return server?.disabledTools?.includes(toolName) ?? false;
  };

  // 按领域分组工具
  const groupedTools = tools.reduce<Record<string, MCPTool[]>>((acc, tool) => {
    const domain = inferDomain(tool.name);
    if (!acc[domain]) acc[domain] = [];
    acc[domain].push(tool);
    return acc;
  }, {});

  if (!server) {
    return (
      <SafeAreaContainer>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
          <CircularProgress />
        </Box>
      </SafeAreaContainer>
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
            sx={{ color: (theme) => theme.palette.primary.main }}
          >
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 600 }}>
            {server.name}
          </Typography>
        </Toolbar>
      </AppBar>

      <Scrollbar
        style={{
          flexGrow: 1,
          padding: '16px',
          paddingBottom: 'var(--content-bottom-padding)',
        }}
      >
        {/* ─── 服务器信息卡片 ─── */}
        <Paper elevation={0} sx={CARD_STYLES.elevated}>
          <Box sx={{ p: { xs: 2, sm: 2.5 }, display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{
              width: 48, height: 48, borderRadius: 2,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              bgcolor: alpha('#8b5cf6', 0.12), color: '#8b5cf6'
            }}>
              <BotIcon size={24} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle1" fontWeight={600}>{server.name}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>
                {server.description}
              </Typography>
            </Box>
            <CustomSwitch checked={server.isActive} onChange={(e) => handleToggleActive(e.target.checked)} />
          </Box>
        </Paper>

        {/* ─── 工具领域列表（点击进入详情） ─── */}
        {!server.isActive ? (
          <Paper elevation={0} sx={{ ...CARD_STYLES.elevated, mt: 2 }}>
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                启用服务器后可查看和管理工具
              </Typography>
            </Box>
          </Paper>
        ) : loading ? (
          <Paper elevation={0} sx={{ ...CARD_STYLES.elevated, mt: 2 }}>
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <CircularProgress size={24} sx={{ mb: 1 }} />
              <Typography variant="body2" color="text.secondary">加载工具列表...</Typography>
            </Box>
          </Paper>
        ) : Object.keys(groupedTools).length === 0 ? (
          <Paper elevation={0} sx={{ ...CARD_STYLES.elevated, mt: 2 }}>
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">暂无工具</Typography>
            </Box>
          </Paper>
        ) : (
          <Paper elevation={0} sx={{ ...CARD_STYLES.elevated, mt: 2 }}>
            <List disablePadding>
              {Object.entries(groupedTools).map(([domain, domainToolsList], index) => {
                const enabledCount = domainToolsList.filter(t => !isToolDisabled(t.name)).length;
                const domainInfo = DOMAIN_LABELS[domain];
                const domainColor = DOMAIN_COLORS[domain] || '#6b7280';
                return (
                  <React.Fragment key={domain}>
                    <ListItem
                      component="div"
                      onClick={() => navigate(`/settings/mcp-assistant/${serverId}/domain/${domain}`)}
                      sx={{
                        py: 2,
                        px: { xs: 2, sm: 2.5 },
                        cursor: 'pointer',
                        '&:hover': { bgcolor: (theme) => alpha(theme.palette.primary.main, 0.04) },
                        '&:active': { bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08) }
                      }}
                    >
                      <Box sx={{
                        width: 40, height: 40, borderRadius: 2,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        bgcolor: alpha(domainColor, 0.1), mr: 2, fontSize: '1.2rem'
                      }}>
                        {domainInfo?.icon || '🔧'}
                      </Box>
                      <ListItemText
                        primary={
                          <Typography sx={{ fontWeight: 600, fontSize: '0.95rem' }}>
                            {domainInfo?.zh || domain}
                          </Typography>
                        }
                        secondary={
                          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem', mt: 0.25 }}>
                            {domainToolsList.length} 个工具
                          </Typography>
                        }
                      />
                      <Chip
                        label={`${enabledCount}/${domainToolsList.length}`}
                        size="small"
                        sx={{
                          height: 24, fontSize: '0.75rem', fontWeight: 600, mr: 1,
                          bgcolor: enabledCount === domainToolsList.length
                            ? (theme) => alpha(theme.palette.success.main, 0.1)
                            : enabledCount === 0
                              ? (theme) => alpha(theme.palette.error.main, 0.1)
                              : (theme) => alpha(theme.palette.warning.main, 0.1),
                          color: enabledCount === domainToolsList.length
                            ? 'success.main'
                            : enabledCount === 0
                              ? 'error.main'
                              : 'warning.main'
                        }}
                      />
                      <ChevronRightIcon size={18} style={{ opacity: 0.4 }} />
                    </ListItem>
                    {index < Object.keys(groupedTools).length - 1 && <Divider component="li" />}
                  </React.Fragment>
                );
              })}
            </List>
          </Paper>
        )}
      </Scrollbar>

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

export default MCPAssistantDetail;
