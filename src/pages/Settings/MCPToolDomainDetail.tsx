import React, { useState, useEffect } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  alpha,
  Snackbar,
  Alert,
  Divider,
  CircularProgress,
  Menu,
  MenuItem,
  ListItemIcon as MuiListItemIcon,
  ListItemText as MuiListItemText
} from '@mui/material';
import CustomSwitch from '../../components/CustomSwitch';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft as ArrowBackIcon,
  Eye as ReadIcon,
  Pencil as WriteIcon,
  ShieldAlert as ConfirmIcon,
  Navigation as NavIcon,
} from 'lucide-react';

import type { MCPServer, MCPTool } from '../../shared/types';
import { mcpService } from '../../shared/services/mcp';
import { useTranslation } from '../../i18n';
import { SafeAreaContainer } from '../../components/settings/SettingComponents';
import Scrollbar from '../../components/Scrollbar';

const PERMISSION_CONFIG: Record<string, { color: string; label: string }> = {
  read:    { color: '#4CAF50', label: '只读' },
  write:   { color: '#ff9800', label: '写入' },
  confirm: { color: '#f44336', label: '需确认' },
  navigate:{ color: '#2196f3', label: '导航' }
};

function inferPermission(toolName: string): string {
  if (toolName.startsWith('delete_') || toolName.startsWith('create_') || toolName.startsWith('add_')) return 'confirm';
  if (toolName.startsWith('update_') || toolName.startsWith('set_') || toolName.startsWith('toggle_')) return 'write';
  if (toolName.startsWith('list_') || toolName.startsWith('get_') || toolName.startsWith('search_')) return 'read';
  return 'read';
}

function inferDomain(toolName: string): string {
  if (toolName.includes('knowledge') || toolName.includes('document')) return 'knowledge';
  if (toolName.includes('appearance') || toolName.includes('theme')) return 'appearance';
  if (toolName.includes('provider') || toolName.includes('model')) return 'providers';
  return 'general';
}

const DOMAIN_LABELS: Record<string, string> = {
  knowledge: '知识库管理',
  appearance: '外观设置',
  providers: '模型管理',
  general: '通用工具',
};

const getPermissionIcon = (permission: string) => {
  switch (permission) {
    case 'read': return <ReadIcon size={16} />;
    case 'write': return <WriteIcon size={16} />;
    case 'confirm': return <ConfirmIcon size={16} />;
    case 'navigate': return <NavIcon size={16} />;
    default: return <ReadIcon size={16} />;
  }
};

const MCPToolDomainDetail: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { serverId, domain } = useParams<{ serverId: string; domain: string }>();
  const [server, setServer] = useState<MCPServer | null>(null);
  const [domainTools, setDomainTools] = useState<MCPTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success'
  });

  const [permMenuAnchor, setPermMenuAnchor] = useState<null | HTMLElement>(null);
  const [permMenuTool, setPermMenuTool] = useState<string>('');

  useEffect(() => {
    const init = async () => {
      if (!serverId) return;
      const foundServer = await mcpService.getServerByIdAsync(serverId);
      if (foundServer) {
        setServer(foundServer);
        if (foundServer.isActive) {
          try {
            const allTools = await mcpService.listTools(foundServer, { includeDisabled: true });
            const filtered = allTools.filter(tool => inferDomain(tool.name) === domain);
            setDomainTools(filtered);
          } catch (error) {
            console.error('加载工具列表失败', error);
          }
        }
      }
      setLoading(false);
    };
    init();
  }, [serverId, domain]);

  const handleBack = () => {
    navigate(`/settings/mcp-assistant/${serverId}`);
  };

  const isToolDisabled = (toolName: string): boolean => {
    return server?.disabledTools?.includes(toolName) ?? false;
  };

  const getEffectivePermission = (toolName: string): string => {
    const overrides = server?.toolPermissionOverrides || {};
    return overrides[toolName] || inferPermission(toolName);
  };

  const handleOpenPermMenu = (event: React.MouseEvent<HTMLElement>, toolName: string) => {
    event.stopPropagation();
    setPermMenuAnchor(event.currentTarget);
    setPermMenuTool(toolName);
  };

  const handleClosePermMenu = () => {
    setPermMenuAnchor(null);
    setPermMenuTool('');
  };

  const handleChangePermission = async (toolName: string, newPerm: 'read' | 'write' | 'confirm') => {
    if (!server) return;
    handleClosePermMenu();
    try {
      const currentOverrides = { ...(server.toolPermissionOverrides || {}) };
      const defaultPerm = inferPermission(toolName);
      if (newPerm === defaultPerm) {
        delete currentOverrides[toolName];
      } else {
        currentOverrides[toolName] = newPerm;
      }
      const updated = { ...server, toolPermissionOverrides: currentOverrides };
      await mcpService.updateServer(updated);
      setServer(updated);
      setSnackbar({ open: true, message: `${toolName} 权限已更改为「${PERMISSION_CONFIG[newPerm]?.label || newPerm}」`, severity: 'success' });
    } catch (error) {
      setSnackbar({ open: true, message: t('settings.mcpServer.messages.saveFailed'), severity: 'error' });
    }
  };

  const handleToggleTool = async (toolName: string, enabled: boolean) => {
    if (!server) return;
    try {
      const currentDisabled = server.disabledTools || [];
      const newDisabled = enabled
        ? currentDisabled.filter(t => t !== toolName)
        : [...currentDisabled, toolName];
      const updated = { ...server, disabledTools: newDisabled };
      await mcpService.updateServer(updated);
      setServer(updated);
    } catch (error) {
      setSnackbar({ open: true, message: t('settings.mcpServer.messages.saveFailed'), severity: 'error' });
    }
  };

  const handleToggleAll = async (enabled: boolean) => {
    if (!server) return;
    try {
      const toolNames = domainTools.map(t => t.name);
      const currentDisabled = server.disabledTools || [];
      const newDisabled = enabled
        ? currentDisabled.filter(name => !toolNames.includes(name))
        : [...new Set([...currentDisabled, ...toolNames])];
      const updated = { ...server, disabledTools: newDisabled };
      await mcpService.updateServer(updated);
      setServer(updated);
    } catch (error) {
      setSnackbar({ open: true, message: t('settings.mcpServer.messages.saveFailed'), severity: 'error' });
    }
  };

  const enabledCount = domainTools.filter(t => !isToolDisabled(t.name)).length;
  const domainLabel = DOMAIN_LABELS[domain || ''] || domain || '工具';

  if (loading) {
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
            {domainLabel}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
              {enabledCount}/{domainTools.length}
            </Typography>
            <CustomSwitch
              checked={enabledCount > 0}
              onChange={(e) => handleToggleAll(e.target.checked)}
            />
          </Box>
        </Toolbar>
      </AppBar>

      <Scrollbar
        style={{
          flexGrow: 1,
          paddingBottom: 'var(--content-bottom-padding)',
        }}
      >
        {domainTools.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">该领域暂无工具</Typography>
          </Box>
        ) : (
          <List disablePadding>
            {domainTools.map((tool, index) => {
              const permission = getEffectivePermission(tool.name);
              const permConfig = PERMISSION_CONFIG[permission] || PERMISSION_CONFIG['read'];
              const isOverridden = !!(server?.toolPermissionOverrides || {})[tool.name];
              const disabled = isToolDisabled(tool.name);

              return (
                <React.Fragment key={tool.name}>
                  <ListItem sx={{
                    py: 1.5,
                    px: { xs: 2, sm: 2.5 },
                    opacity: disabled ? 0.5 : 1,
                    transition: 'opacity 0.2s',
                    gap: 1,
                    '&:hover': { bgcolor: (theme) => alpha(theme.palette.primary.main, 0.04) }
                  }}>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <Box sx={{ color: permConfig.color }}>
                        {getPermissionIcon(permission)}
                      </Box>
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                          <Typography sx={{
                            fontWeight: 600, fontSize: '0.9rem', fontFamily: 'monospace',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            maxWidth: { xs: '50vw', sm: 'none' }
                          }}>
                            {tool.name}
                          </Typography>
                          <Chip
                            label={isOverridden ? `${permConfig.label} ✎` : permConfig.label}
                            size="small"
                            onClick={(e) => handleOpenPermMenu(e, tool.name)}
                            sx={{
                              height: 20, fontSize: '0.65rem', fontWeight: 600,
                              bgcolor: alpha(permConfig.color, 0.1),
                              color: permConfig.color,
                              border: `1px solid ${alpha(permConfig.color, isOverridden ? 0.6 : 0.3)}`,
                              cursor: 'pointer',
                              '&:hover': { bgcolor: alpha(permConfig.color, 0.2) }
                            }}
                          />
                        </Box>
                      }
                      secondary={
                        <Typography variant="body2" color="text.secondary" component="div"
                          sx={{ mt: 0.5, fontSize: '0.8rem', lineHeight: 1.5 }}
                        >
                          {tool.description || '无描述'}
                        </Typography>
                      }
                      secondaryTypographyProps={{ component: 'div' }}
                    />
                    <Box sx={{ flexShrink: 0, ml: 1 }}>
                      <CustomSwitch
                        checked={!disabled}
                        onChange={(e) => handleToggleTool(tool.name, e.target.checked)}
                      />
                    </Box>
                  </ListItem>
                  {index < domainTools.length - 1 && <Divider component="li" />}
                </React.Fragment>
              );
            })}
          </List>
        )}
      </Scrollbar>

      {/* ─── 权限编辑菜单 ─── */}
      <Menu
        anchorEl={permMenuAnchor}
        open={Boolean(permMenuAnchor)}
        onClose={handleClosePermMenu}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{ paper: { sx: { minWidth: 180, borderRadius: 2 } } }}
      >
        {(['read', 'write', 'confirm'] as const).map((perm) => {
          const config = PERMISSION_CONFIG[perm];
          const isCurrentPerm = Boolean(permMenuTool) && getEffectivePermission(permMenuTool) === perm;
          const isDefault = Boolean(permMenuTool) && inferPermission(permMenuTool) === perm;
          return (
            <MenuItem
              key={perm}
              selected={isCurrentPerm}
              onClick={() => handleChangePermission(permMenuTool, perm)}
              sx={{ py: 1 }}
            >
              <MuiListItemIcon sx={{ minWidth: 32, color: config.color }}>
                {getPermissionIcon(perm)}
              </MuiListItemIcon>
              <MuiListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Typography sx={{ fontSize: '0.85rem', fontWeight: isCurrentPerm ? 700 : 400 }}>
                      {config.label}
                    </Typography>
                    {isDefault && (
                      <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>
                        (默认)
                      </Typography>
                    )}
                  </Box>
                }
              />
            </MenuItem>
          );
        })}
      </Menu>

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

export default MCPToolDomainDetail;
