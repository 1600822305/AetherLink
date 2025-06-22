import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Typography,
  Box,
  Chip,
  Avatar,
  alpha,
  Button,
  Divider,
  useTheme,
  Alert,
  CircularProgress,
  Skeleton
} from '@mui/material';
// Lucide Icons - 按需导入，高端简约设计
import { Wrench, Database, Globe, Plus, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '../../shared/store';
import type { MCPServer, MCPServerType } from '../../shared/types';
import { mcpService } from '../../shared/services/mcp';
import CustomSwitch from '../CustomSwitch';
import { getGlassmorphismToolbarStyles, getTransparentToolbarStyles } from '../input';
import { useMCPServerStateManager } from '../../hooks/useMCPServerStateManager';

// 服务器类型配置常量
const SERVER_TYPE_CONFIG = {
  httpStream: {
    icon: Globe,
    color: '#9c27b0',
    label: 'HTTP Stream'
  },
  inMemory: {
    icon: Database,
    color: '#4CAF50',
    label: 'In Memory'
  },
  default: {
    icon: Settings,
    color: '#9e9e9e',
    label: 'Default'
  }
} as const;

interface MCPToolsButtonProps {
  toolsEnabled?: boolean;
  onToolsEnabledChange?: (enabled: boolean) => void;
}

const MCPToolsButton: React.FC<MCPToolsButtonProps> = ({
  toolsEnabled = true,
  onToolsEnabledChange
}) => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const [open, setOpen] = useState(false);
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [loadingServers, setLoadingServers] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  // 使用共享的MCP状态管理Hook
  const { createMCPToggleHandler } = useMCPServerStateManager();

  // 获取工具栏显示样式设置 - 修复类型安全
  const toolbarDisplayStyle = useSelector((state: RootState) =>
    state.settings?.toolbarDisplayStyle || 'both'
  ) as 'icon' | 'text' | 'both';

  // 获取工具栏样式设置 - 修复类型安全
  const toolbarStyle = useSelector((state: RootState) =>
    state.settings?.toolbarStyle || 'glassmorphism'
  ) as 'glassmorphism' | 'transparent';

  // 计算活跃服务器，避免冗余状态
  const activeServers = useMemo(
    () => servers.filter(server => server.isActive),
    [servers]
  );

  // 根据设置选择样式
  const currentStyles = useMemo(() =>
    toolbarStyle === 'glassmorphism'
      ? getGlassmorphismToolbarStyles(isDarkMode)
      : getTransparentToolbarStyles(isDarkMode),
    [toolbarStyle, isDarkMode]
  );

  // 使用 useCallback 优化 loadServers 函数
  const loadServers = useCallback(() => {
    try {
      const allServers = mcpService.getServers();
      setServers(allServers);
      setError(null);
    } catch (error) {
      console.error('加载服务器列表失败:', error);
      setError('加载服务器列表失败');
    } finally {
      setIsInitialLoading(false);
    }
  }, []);

  // 修复 useEffect 依赖项
  useEffect(() => {
    loadServers();
  }, [loadServers]);

  const handleOpen = useCallback(() => {
    setOpen(true);
    loadServers();
  }, [loadServers]);

  const handleClose = useCallback(() => {
    setOpen(false);
    setError(null);
  }, []);

  const handleToggleServer = useCallback(async (serverId: string, isActive: boolean) => {
    setLoadingServers(prev => ({ ...prev, [serverId]: true }));
    setError(null);

    try {
      await mcpService.toggleServer(serverId, isActive);
      loadServers();

      // 自动管理总开关逻辑 - 简化逻辑，避免复杂的状态管理
      if (onToolsEnabledChange) {
        const updatedActiveServers = mcpService.getActiveServers();

        if (isActive && !toolsEnabled) {
          // 开启任何服务器时，如果总开关是关闭的，自动开启
          console.log('[MCP] 开启服务器，自动启用MCP工具总开关');
          onToolsEnabledChange(true);
        } else if (!isActive && updatedActiveServers.length === 0 && toolsEnabled) {
          // 关闭所有服务器时，自动关闭总开关
          console.log('[MCP] 所有服务器已关闭，自动禁用MCP工具总开关');
          onToolsEnabledChange(false);
        }
      }
    } catch (error) {
      console.error('切换服务器状态失败:', error);
      setError(`切换服务器状态失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setLoadingServers(prev => {
        const { [serverId]: _, ...rest } = prev;
        return rest;
      });
    }
  }, [loadServers, onToolsEnabledChange, toolsEnabled]);

  const handleNavigateToSettings = useCallback(() => {
    setOpen(false);
    navigate('/settings/mcp-server');
  }, [navigate]);

  // 使用共享的MCP状态管理逻辑
  const handleToolsEnabledChange = useCallback(
    (checked: boolean) => {
      const handler = createMCPToggleHandler(loadServers, onToolsEnabledChange);
      return handler(checked);
    },
    [createMCPToggleHandler, loadServers, onToolsEnabledChange]
  );

  // 键盘导航处理
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleOpen();
    }
  }, [handleOpen]);

  // 使用配置常量的服务器类型函数
  const getServerTypeIcon = useCallback((type: MCPServerType) => {
    const config = SERVER_TYPE_CONFIG[type] || SERVER_TYPE_CONFIG.default;
    const IconComponent = config.icon;
    return <IconComponent size={16} />;
  }, []);

  const getServerTypeColor = useCallback((type: MCPServerType) => {
    const config = SERVER_TYPE_CONFIG[type] || SERVER_TYPE_CONFIG.default;
    return config.color;
  }, []);

  const hasActiveServers = activeServers.length > 0;

  return (
    <>
      <Box
        role="button"
        tabIndex={0}
        aria-label="打开 MCP 工具管理"
        onClick={handleOpen}
        onKeyDown={handleKeyDown}
        sx={{
          ...currentStyles.button,
          // 激活状态的特殊效果 - 绿色主题（仅在玻璃样式下）
          ...(hasActiveServers && toolbarStyle === 'glassmorphism' && {
            background: isDarkMode
              ? 'rgba(16, 185, 129, 0.15)'
              : 'rgba(16, 185, 129, 0.2)',
            border: isDarkMode
              ? '1px solid rgba(16, 185, 129, 0.25)'
              : '1px solid rgba(16, 185, 129, 0.35)',
            boxShadow: isDarkMode
              ? '0 4px 16px rgba(16, 185, 129, 0.1), 0 1px 4px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(16, 185, 129, 0.2)'
              : '0 4px 16px rgba(16, 185, 129, 0.08), 0 1px 4px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(16, 185, 129, 0.3)'
          }),
          // 激活状态的透明样式效果
          ...(hasActiveServers && toolbarStyle === 'transparent' && {
            background: isDarkMode ? 'rgba(16, 185, 129, 0.08)' : 'rgba(16, 185, 129, 0.05)'
          }),
          margin: toolbarStyle === 'glassmorphism' ? '0 4px' : '0 2px',
          '&:hover': {
            ...currentStyles.buttonHover,
            ...(hasActiveServers && toolbarStyle === 'glassmorphism' && {
              background: isDarkMode
                ? 'rgba(16, 185, 129, 0.2)'
                : 'rgba(16, 185, 129, 0.25)',
              border: isDarkMode
                ? '1px solid rgba(16, 185, 129, 0.3)'
                : '1px solid rgba(16, 185, 129, 0.4)',
              boxShadow: isDarkMode
                ? '0 6px 24px rgba(16, 185, 129, 0.15), 0 2px 8px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(16, 185, 129, 0.25)'
                : '0 6px 24px rgba(16, 185, 129, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(16, 185, 129, 0.4)'
            }),
            ...(hasActiveServers && toolbarStyle === 'transparent' && {
              background: isDarkMode ? 'rgba(16, 185, 129, 0.12)' : 'rgba(16, 185, 129, 0.08)'
            })
          },
          '&:active': {
            ...currentStyles.buttonActive
          },
          '&:focus': {
            outline: `2px solid ${isDarkMode ? 'rgba(16, 185, 129, 0.8)' : 'rgba(16, 185, 129, 0.6)'}`,
            outlineOffset: '2px',
          }
        }}
        title="MCP 工具"
      >
        {toolbarDisplayStyle !== 'text' && (
          <Wrench
            size={16}
            color={hasActiveServers
              ? (isDarkMode ? 'rgba(16, 185, 129, 0.9)' : 'rgba(16, 185, 129, 0.8)')
              : (isDarkMode ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.75)')
            }
          />
        )}
        {toolbarDisplayStyle !== 'icon' && (
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              fontSize: '13px',
              color: hasActiveServers
                ? (isDarkMode ? 'rgba(16, 185, 129, 0.95)' : 'rgba(16, 185, 129, 0.9)')
                : (isDarkMode ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.8)'),
              textShadow: isDarkMode
                ? '0 1px 2px rgba(0, 0, 0, 0.3)'
                : '0 1px 2px rgba(255, 255, 255, 0.8)',
              letterSpacing: '0.01em',
              ml: toolbarDisplayStyle === 'both' ? 0.5 : 0
            }}
          >
            工具
          </Typography>
        )}
      </Box>

      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="sm"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              borderRadius: 2,
              maxHeight: '80vh'
            }
          }
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Wrench size={20} color="#10b981" />
              <Typography variant="h6" fontWeight={600}>
                MCP 工具服务器
              </Typography>
              {hasActiveServers && (
                <Chip
                  label={`${activeServers.length} 个运行中`}
                  size="small"
                  color="success"
                  variant="outlined"
                />
              )}
            </Box>
            {onToolsEnabledChange && (
              <CustomSwitch
                checked={toolsEnabled}
                onChange={(e) => handleToolsEnabledChange(e.target.checked)}
              />
            )}
          </Box>
        </DialogTitle>

        <DialogContent sx={{ p: 0 }}>
          {/* 错误提示 */}
          {error && (
            <Box sx={{ p: 2 }}>
              <Alert severity="error" onClose={() => setError(null)}>
                {error}
              </Alert>
            </Box>
          )}

          {isInitialLoading ? (
            // 骨架屏加载状态
            <List sx={{ py: 0 }}>
              {[1, 2, 3].map((index) => (
                <ListItem key={index} sx={{ py: 2 }}>
                  <ListItemIcon>
                    <Skeleton variant="circular" width={32} height={32} />
                  </ListItemIcon>
                  <ListItemText
                    primary={<Skeleton variant="text" width="60%" height={24} />}
                    secondary={
                      <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                        <Skeleton variant="rectangular" width={60} height={20} sx={{ borderRadius: '10px' }} />
                        <Skeleton variant="rectangular" width={50} height={20} sx={{ borderRadius: '10px' }} />
                      </Box>
                    }
                  />
                  <Box sx={{ ml: 'auto' }}>
                    <Skeleton variant="rectangular" width={40} height={24} sx={{ borderRadius: '12px' }} />
                  </Box>
                </ListItem>
              ))}
            </List>
          ) : servers.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Wrench size={48} color="rgba(0,0,0,0.4)" style={{ marginBottom: 16 }} />
              <Typography variant="h6" gutterBottom>
                还没有配置 MCP 服务器
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                MCP 服务器可以为 AI 提供额外的工具和功能
              </Typography>
              <Button
                variant="contained"
                startIcon={<Plus size={16} />}
                onClick={handleNavigateToSettings}
                sx={{ bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }}
              >
                添加服务器
              </Button>
            </Box>
          ) : (
            <>
              <List sx={{ py: 0 }}>
                {servers.map((server, index) => (
                  <React.Fragment key={server.id}>
                    <ListItem
                      sx={{ py: 2 }}
                      secondaryAction={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {loadingServers[server.id] && (
                            <CircularProgress size={16} />
                          )}
                          <CustomSwitch
                            checked={server.isActive}
                            onChange={(e) => handleToggleServer(server.id, e.target.checked)}
                            disabled={loadingServers[server.id] || false}
                          />
                        </Box>
                      }
                    >
                      <ListItemIcon>
                        <Avatar
                          sx={{
                            bgcolor: alpha(getServerTypeColor(server.type), 0.1),
                            color: getServerTypeColor(server.type),
                            width: 32,
                            height: 32
                          }}
                        >
                          {getServerTypeIcon(server.type)}
                        </Avatar>
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="subtitle2" fontWeight={600}>
                              {server.name}
                            </Typography>
                            {server.isActive && (
                              <Chip
                                label="运行中"
                                size="small"
                                color="success"
                                variant="outlined"
                              />
                            )}
                          </Box>
                        }
                        secondary={
                          <Box component="div">
                            {server.description && (
                              <Typography variant="body2" color="text.secondary" component="span" sx={{ display: 'block' }}>
                                {server.description}
                              </Typography>
                            )}
                            {server.baseUrl && (
                              <Typography variant="caption" color="text.secondary" component="span" sx={{ display: 'block' }}>
                                {server.baseUrl}
                              </Typography>
                            )}
                          </Box>
                        }
                        slotProps={{
                          secondary: { component: 'div' }
                        }}
                      />
                    </ListItem>
                    {index < servers.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>

              <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<Settings size={16} />}
                  onClick={handleNavigateToSettings}
                  size="small"
                >
                  管理 MCP 服务器
                </Button>
              </Box>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default MCPToolsButton;
