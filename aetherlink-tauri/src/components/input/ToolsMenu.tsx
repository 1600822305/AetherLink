import React, { useState, useRef, useEffect } from 'react';
import { Box, Typography, useTheme, Menu, MenuItem, Dialog, DialogTitle, DialogContent, List, ListItem, ListItemText, ListItemIcon, ListItemSecondaryAction, Chip, Avatar, Button, alpha, useMediaQuery, IconButton } from '@mui/material';
// Lucide Icons - 按需导入，高端简约设计
import { Plus, Trash2, AlertTriangle, BookOpen, Video, Settings, Wrench, Database, Globe, ArrowLeft, X } from 'lucide-react';
import { CustomIcon } from '../icons';
import { useSelector } from 'react-redux';
import type { RootState } from '../../shared/store';
import { useTopicManagement } from '../../shared/hooks/useTopicManagement';
import WebSearchProviderSelector from '../WebSearchProviderSelector';
import KnowledgeSelector from '../chat/KnowledgeSelector';
import { useNavigate } from 'react-router-dom';
import type { MCPServer, MCPServerType } from '../../shared/types';
import { mcpService } from '../../shared/services/mcp';
import CustomSwitch from '../CustomSwitch';
import { useInputStyles } from '../../shared/hooks/useInputStyles';

interface ToolsMenuProps {
  anchorEl: null | HTMLElement;
  open: boolean;
  onClose: () => void;
  onClearTopic?: () => void;
  imageGenerationMode?: boolean;
  toggleImageGenerationMode?: () => void;
  videoGenerationMode?: boolean;
  toggleVideoGenerationMode?: () => void;
  webSearchActive?: boolean;
  toggleWebSearch?: () => void;
  toolsEnabled?: boolean;
  onToolsEnabledChange?: (enabled: boolean) => void;
}

const ToolsMenu: React.FC<ToolsMenuProps> = ({
  anchorEl,
  open,
  onClose,
  onClearTopic,
  imageGenerationMode = false,
  toggleImageGenerationMode,
  videoGenerationMode = false,
  toggleVideoGenerationMode,
  webSearchActive = false,
  toggleWebSearch,
  toolsEnabled = true,
  onToolsEnabledChange
}) => {
  const [showProviderSelector, setShowProviderSelector] = useState(false);
  const [clearConfirmMode, setClearConfirmMode] = useState(false);
  const [showKnowledgeSelector, setShowKnowledgeSelector] = useState(false);
  const [showMCPDialog, setShowMCPDialog] = useState(false);
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [activeServers, setActiveServers] = useState<MCPServer[]>([]);

  const theme = useTheme();
  const isXs = useMediaQuery(theme.breakpoints.down('sm'));
  useInputStyles();
  const navigate = useNavigate();

  // 使用统一的话题管理Hook
  const { handleCreateTopic } = useTopicManagement();

  // 使用共享的MCP状态管理Hook
  // 注释掉未使用的mcpStateManager
  // const mcpStateManager = useMCPServerStateManager();

  // 从Redux获取网络搜索设置
  const webSearchSettings = useSelector((state: RootState) => state.webSearch);
  const webSearchEnabled = webSearchSettings?.enabled || false;
  const currentProvider = webSearchSettings?.provider;

  // 获取工具栏按钮配置
  const toolbarButtons = useSelector((state: RootState) => state.settings.toolbarButtons || {
    order: ['mcp-tools', 'new-topic', 'clear-topic', 'generate-image', 'generate-video', 'knowledge', 'web-search'],
    visibility: {
      'mcp-tools': true,
      'new-topic': true,
      'clear-topic': true,
      'generate-image': true,
      'generate-video': true,
      'knowledge': true,
      'web-search': true
    }
  });

  // 用于清理计时器的ref
  const clearTimerRef = useRef<number | undefined>(undefined);

  // 清理计时器的useEffect
  useEffect(() => {
    return () => {
      if (clearTimerRef.current) {
        clearTimeout(clearTimerRef.current);
      }
    };
  }, []);

  // 创建新话题的包装函数
  const handleCreateTopicAndClose = async () => {
    await handleCreateTopic();
    onClose();
  };

  // 处理清空话题
  const handleClearTopic = () => {
    if (clearConfirmMode) {
      // 执行清空操作
      onClearTopic?.();
      setClearConfirmMode(false);
      onClose();
    } else {
      // 进入确认模式，但不关闭菜单
      setClearConfirmMode(true);
      // 3秒后自动退出确认模式
      if (clearTimerRef.current) {
        clearTimeout(clearTimerRef.current);
      }
      clearTimerRef.current = window.setTimeout(() => setClearConfirmMode(false), 3000);
    }
  };

  // 处理知识库按钮点击
  const handleKnowledgeClick = () => {
    setShowKnowledgeSelector(true);
  };

  // 处理知识库选择
  const handleKnowledgeSelect = (knowledgeBase: any, searchResults: any[]) => {
    console.log('选择了知识库:', knowledgeBase, '搜索结果:', searchResults);

    // 存储选中的知识库信息到sessionStorage（风格：新模式）
    const knowledgeData = {
      knowledgeBase: {
        id: knowledgeBase.id,
        name: knowledgeBase.name
      },
      isSelected: true,
      searchOnSend: true // 标记需要在发送时搜索
    };

    console.log('[ToolsMenu] 保存知识库选择到sessionStorage:', knowledgeData);
    window.sessionStorage.setItem('selectedKnowledgeBase', JSON.stringify(knowledgeData));

    // 验证保存是否成功
    const saved = window.sessionStorage.getItem('selectedKnowledgeBase');
    console.log('[ToolsMenu] sessionStorage保存验证:', saved);

    // 关闭选择器
    setShowKnowledgeSelector(false);
  };

  // 处理网络搜索按钮点击
  const handleWebSearchClick = () => {
    // 总是显示提供商选择器
    setShowProviderSelector(true);
  };

  // 处理提供商选择
  const handleProviderSelect = (providerId: string) => {
    if (providerId && toggleWebSearch) {
      // 选择了提供商，激活搜索模式
      toggleWebSearch();
    }
    onClose();
  };

  // MCP服务器相关函数
  const loadServers = () => {
    const allServers = mcpService.getServers();
    const active = mcpService.getActiveServers();
    setServers(allServers);
    setActiveServers(active);
  };

  // 处理MCP工具按钮点击
  const handleMCPToolsClick = () => {
    setShowMCPDialog(true);
    loadServers();
  };

  const handleCloseMCPDialog = () => {
    setShowMCPDialog(false);
  };

  const handleToggleServer = async (serverId: string, isActive: boolean) => {
    try {
      await mcpService.toggleServer(serverId, isActive);
      loadServers();

      // 自动管理总开关逻辑
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
    }
  };

  const handleNavigateToSettings = () => {
    setShowMCPDialog(false);
    navigate('/settings/mcp-server');
  };

  // 使用共享的MCP状态管理逻辑
  const handleMCPToolsEnabledChange = (enabled: boolean) => {
    if (onToolsEnabledChange) {
      onToolsEnabledChange(enabled);
    }
    loadServers();
  };

  const getServerTypeIcon = (type: MCPServerType) => {
    switch (type) {
      case 'httpStream':
        return <Globe size={16} />;
      case 'inMemory':
        return <Database size={16} />;
      default:
        return <Settings size={16} />;
    }
  };

  const getServerTypeColor = (type: MCPServerType) => {
    switch (type) {
      case 'httpStream':
        return theme.palette.secondary.main;
      case 'inMemory':
        return theme.palette.warning.main;
      default:
        return theme.palette.text.disabled;
    }
  };

  // 定义所有可用的按钮配置
  const allButtonConfigs = {
    'mcp-tools': {
      id: 'mcp-tools',
      icon: <Wrench
        size={16}
        color={toolsEnabled
          ? theme.palette.success.main
          : theme.palette.text.disabled
        }
      />,
      label: '工具',
      onClick: handleMCPToolsClick,
      isActive: toolsEnabled
    },
    'new-topic': {
      id: 'new-topic',
      icon: <Plus
        size={16}
        color={theme.palette.success.main}
      />,
      label: '新建话题',
      onClick: handleCreateTopicAndClose,
      isActive: false
    },
    'clear-topic': {
      id: 'clear-topic',
      icon: clearConfirmMode
        ? <AlertTriangle
            size={16}
            color={theme.palette.error.main}
          />
        : <Trash2
            size={16}
            color={theme.palette.primary.main}
          />,
      label: clearConfirmMode ? '确认清空' : '清空内容',
      onClick: handleClearTopic,
      isActive: clearConfirmMode
    },
    'generate-image': {
      id: 'generate-image',
      icon: <CustomIcon
        name="imageGenerate"
        size={16}
        color={imageGenerationMode
          ? theme.palette.secondary.main
          : alpha(theme.palette.secondary.main, 0.6)
        }
      />,
      label: imageGenerationMode ? '取消生成' : '生成图片',
      onClick: () => {
        toggleImageGenerationMode?.();
        onClose();
      },
      isActive: imageGenerationMode
    },
    'generate-video': {
      id: 'generate-video',
      icon: <Video
        size={16}
        color={videoGenerationMode
          ? theme.palette.error.main
          : alpha(theme.palette.error.main, 0.6)
        }
      />,
      label: videoGenerationMode ? '取消生成' : '生成视频',
      onClick: () => {
        toggleVideoGenerationMode?.();
        onClose();
      },
      isActive: videoGenerationMode
    },
    'knowledge': {
      id: 'knowledge',
      icon: <BookOpen
        size={16}
        color={theme.palette.info.main}
      />,
      label: '知识库',
      onClick: handleKnowledgeClick,
      isActive: false
    },
    'web-search': webSearchEnabled && toggleWebSearch ? {
      id: 'web-search',
      icon: <CustomIcon
        name="search"
        size={16}
        color={webSearchActive
          ? theme.palette.primary.main
          : alpha(theme.palette.primary.main, 0.6)
        }
      />,
      label: webSearchSettings?.providers?.find(p => p.id === currentProvider)?.name || '网络搜索',
      onClick: handleWebSearchClick,
      isActive: webSearchActive
    } : null
  };

  // 根据设置生成按钮数组
  const buttons = toolbarButtons.order
    .filter(buttonId => {
      // 过滤掉不可见的按钮，以及配置不合法的按钮
      const config = allButtonConfigs[buttonId as keyof typeof allButtonConfigs];
      return (
        toolbarButtons.visibility[buttonId] &&
        config &&
        typeof config === 'object' &&
        'id' in config
      );
    })
    .map(buttonId => allButtonConfigs[buttonId as keyof typeof allButtonConfigs])
    .filter((button): button is NonNullable<typeof button> => button !== null);

  return (
    <>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={onClose}
        disableAutoFocus={true}
        disableRestoreFocus={true}
        disableEnforceFocus={true}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        slotProps={{
          paper: {
            sx: {
              borderRadius: 3,
              minWidth: { xs: '90vw', sm: 280 },
              maxWidth: { xs: '95vw', sm: 320 },
              width: { xs: '90vw', sm: 'auto' },
              maxHeight: { xs: '70vh', sm: '80vh' },
              overflow: 'auto',
              boxShadow: theme.shadows[8],
              backgroundColor: theme.palette.background.paper,
            }
          },
          root: {
            slotProps: {
              backdrop: {
                invisible: false,
                sx: {
                  backgroundColor: 'transparent'
                }
              }
            }
          }
        }}
        sx={{
          '& .MuiList-root': {
            '&:focus': {
              outline: 'none'
            }
          }
        }}
      >
        {buttons.map((button) => {
          // 普通按钮渲染（包括MCP工具按钮）
          if (!('onClick' in button) || !('icon' in button) || !('label' in button)) {
            return null;
          }

          return (
            <MenuItem
              key={button.id}
              onClick={() => {
                // 如果是清空内容按钮且不在确认模式，不关闭菜单
                if (button.id === 'clear-topic' && !clearConfirmMode) {
                  button.onClick();
                  // 不关闭菜单，让用户看到确认状态
                  return;
                }
                // 对于其他所有按钮，执行操作后关闭菜单
                button.onClick();
                onClose();
              }}
              sx={{
                padding: { xs: 1.5, sm: 2 },
                minHeight: { xs: 52, sm: 60 },
                display: 'flex',
                alignItems: 'center',
                '&:hover': {
                  backgroundColor: theme.palette.action.hover
                }
              }}
            >
              <Box sx={{
                width: { xs: 28, sm: 32 },
                height: { xs: 28, sm: 32 },
                borderRadius: 2,
                backgroundColor: button.isActive
                  ? (button.id === 'mcp-tools'
                      ? alpha(theme.palette.success.main, 0.15)
                      : alpha(theme.palette.primary.main, 0.15))
                  : alpha(theme.palette.text.primary, 0.08),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: { xs: 1.5, sm: 2 },
                flexShrink: 0
              }}>
                <Box sx={{ 
                  '& svg': { 
                    width: { xs: '14px', sm: '16px' }, 
                    height: { xs: '14px', sm: '16px' } 
                  } 
                }}>
                  {button.icon}
                </Box>
              </Box>
              <Typography
                variant="body2"
                sx={{
                  color: theme.palette.text.primary,
                  fontSize: { xs: '14px', sm: '15px' },
                  fontWeight: 500,
                  flex: 1
                }}
              >
                {button.label}
              </Typography>
            </MenuItem>
          );
        })}
      </Menu>

      {/* 网络搜索提供商选择器 */}
      <WebSearchProviderSelector
        open={showProviderSelector}
        onClose={() => setShowProviderSelector(false)}
        onProviderSelect={handleProviderSelect}
      />

      {/* 知识库选择器 */}
      <KnowledgeSelector
        open={showKnowledgeSelector}
        onClose={() => setShowKnowledgeSelector(false)}
        onSelect={handleKnowledgeSelect}
      />

      {/* MCP工具对话框 */}
      <Dialog
        open={showMCPDialog}
        onClose={handleCloseMCPDialog}
        maxWidth="sm"
        fullWidth
        fullScreen={isXs}
        PaperProps={{
          sx: {
            borderRadius: { xs: 0, sm: 2 },
            maxHeight: { xs: '100vh', sm: '80vh' },
            margin: { xs: 0, sm: 'auto' }
          }
        }}
      >
        <DialogTitle sx={{ pb: 1, px: { xs: 2, sm: 3 }, pt: { xs: 2, sm: 3 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 1 } }}>
              <IconButton onClick={handleCloseMCPDialog} sx={{ mr: 1, p: 0.5, display: { xs: 'inline-flex', sm: 'none' } }} >
                <ArrowLeft size={22} />
              </IconButton>
              <Box sx={{ 
                '& svg': { 
                  width: { xs: '18px', sm: '20px' }, 
                  height: { xs: '18px', sm: '20px' },
                  color: theme.palette.success.main,
                  display: { xs: 'none', sm: 'inline-flex'}
                } 
              }}>
              </Box>
              <Typography variant="h6" fontWeight={600} sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>
                MCP 工具服务器
              </Typography>
              {activeServers.length > 0 && (
                <Chip
                  label={`${activeServers.length} 个运行中`}
                  size="small"
                  color="success"
                  variant="outlined"
                  sx={{ ml: { xs: 0.5, sm: 1 } }}
                />
              )}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              {onToolsEnabledChange && (
                <CustomSwitch
                  checked={toolsEnabled}
                  onChange={(e) => handleMCPToolsEnabledChange(e.target.checked)}
                />
              )}
               <IconButton onClick={handleCloseMCPDialog} sx={{ ml: 1, display: { xs: 'none', sm: 'inline-flex' } }}>
                <X size={22} />
              </IconButton>
            </Box>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ p: 0 }}>
          {servers.length === 0 ? (
            <Box sx={{ p: { xs: 2, sm: 3 }, textAlign: 'center' }}>
              <Box sx={{ 
                '& svg': { 
                  width: { xs: '40px', sm: '48px' }, 
                  height: { xs: '40px', sm: '48px' } 
                },
                mb: { xs: 1.5, sm: 2 }
              }}>
                <Wrench size={48} color={theme.palette.text.disabled} />
              </Box>
              <Typography variant="h6" gutterBottom sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>
                还没有配置 MCP 服务器
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: { xs: 2, sm: 3 }, fontSize: { xs: '13px', sm: '14px' } }}>
                MCP 服务器可以为 AI 提供额外的工具和功能
              </Typography>
              <Button
                variant="contained"
                startIcon={
                  <Box sx={{ 
                    '& svg': { 
                      width: { xs: '14px', sm: '16px' }, 
                      height: { xs: '14px', sm: '16px' } 
                    } 
                  }}>
                    <Plus size={16} />
                  </Box>
                }
                onClick={handleNavigateToSettings}
                sx={{
                  bgcolor: theme.palette.success.main,
                  '&:hover': { bgcolor: theme.palette.success.dark },
                  fontSize: { xs: '14px', sm: '16px' }
                }}
              >
                添加服务器
              </Button>
            </Box>
          ) : (
            <>
              <List sx={{ px: { xs: 0, sm: 1 } }}>
                {servers.map((server) => (
                  <ListItem
                    key={server.id}
                    sx={{
                      padding: { xs: '12px 16px', sm: '12px' },
                      borderRadius: 2,
                      mb: 1.5,
                      backgroundColor: alpha(theme.palette.text.primary, 0.05),
                      transition: 'background-color 0.2s',
                      display: 'flex',
                      alignItems: 'flex-start',
                      '&:hover': {
                        backgroundColor: alpha(theme.palette.text.primary, 0.08),
                      },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 40, mt: 0.5 }}>
                      <Avatar
                        sx={{
                          bgcolor: alpha(getServerTypeColor(server.type), 0.1),
                          color: getServerTypeColor(server.type),
                          width: { xs: 28, sm: 32 },
                          height: { xs: 28, sm: 32 },
                          '& svg': {
                            width: { xs: '14px', sm: '16px' },
                            height: { xs: '14px', sm: '16px' }
                          }
                        }}
                      >
                        {getServerTypeIcon(server.type)}
                      </Avatar>
                    </ListItemIcon>
                    <Box sx={{ flex: 1, pr: 7 }}> 
                      <ListItemText
                        primary={server.name}
                        secondary={server.description}
                        primaryTypographyProps={{
                          fontWeight: 600,
                          fontSize: '1rem',
                          color: theme.palette.text.primary,
                        }}
                        secondaryTypographyProps={{
                          fontSize: '0.875rem',
                          color: theme.palette.text.secondary,
                          whiteSpace: 'normal',
                          sx: { wordBreak: 'break-word' },
                        }}
                      />
                    </Box>
                    <ListItemSecondaryAction>
                      <CustomSwitch
                        checked={server.isActive}
                        onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                          void handleToggleServer(server.id, event.target.checked);
                        }}
                      />
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>

              <Box sx={{ p: { xs: 1.5, sm: 2 }, borderTop: '1px solid', borderColor: 'divider' }}>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={
                    <Box sx={{ 
                      '& svg': { 
                        width: { xs: '14px', sm: '16px' }, 
                        height: { xs: '14px', sm: '16px' } 
                      } 
                    }}>
                      <Settings size={16} />
                    </Box>
                  }
                  onClick={handleNavigateToSettings}
                  sx={{ fontSize: { xs: '14px', sm: '16px' } }}
                >
                  管理服务器
                </Button>
              </Box>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ToolsMenu; 