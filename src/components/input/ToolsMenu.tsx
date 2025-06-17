import React, { useState } from 'react';
import { Box, Typography, useTheme, Menu, MenuItem, Dialog, DialogTitle, DialogContent, List, ListItem, ListItemText, ListItemIcon, ListItemSecondaryAction, Chip, Avatar, Button, Divider, alpha } from '@mui/material';
// Lucide Icons - 按需导入，高端简约设计
import { Plus, Trash2, AlertTriangle, Camera, Search, BookOpen, Video, Settings, Wrench, Database, Globe } from 'lucide-react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../../shared/store';
import { TopicService } from '../../shared/services/TopicService';
import { EventEmitter, EVENT_NAMES } from '../../shared/services/EventService';
import { newMessagesActions } from '../../shared/store/slices/newMessagesSlice';
import WebSearchProviderSelector from '../WebSearchProviderSelector';
import KnowledgeSelector from '../chat/KnowledgeSelector';
import { useNavigate } from 'react-router-dom';
import type { MCPServer, MCPServerType } from '../../shared/types';
import { mcpService } from '../../shared/services/mcp';
import CustomSwitch from '../CustomSwitch';
import { useMCPServerStateManager } from '../../hooks/useMCPServerStateManager';

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
  const isDarkMode = theme.palette.mode === 'dark';
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // 使用共享的MCP状态管理Hook
  const { createMCPToggleHandler } = useMCPServerStateManager();

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

  // 创建新话题
  const handleCreateTopic = async () => {
    // 触发新建话题事件
    EventEmitter.emit(EVENT_NAMES.ADD_NEW_TOPIC);
    console.log('[ToolsMenu] Emitted ADD_NEW_TOPIC event.');

    // 创建新话题
    const newTopic = await TopicService.createNewTopic();

    // 如果成功创建话题，自动跳转到新话题
    if (newTopic) {
      console.log('[ToolsMenu] 成功创建新话题，自动跳转:', newTopic.id);

      // 设置当前话题 - 立即选择新创建的话题
      dispatch(newMessagesActions.setCurrentTopicId(newTopic.id));

      // 确保话题侧边栏显示并选中新话题
      setTimeout(() => {
        EventEmitter.emit(EVENT_NAMES.SHOW_TOPIC_SIDEBAR);

        // 再次确保新话题被选中，防止其他逻辑覆盖
        setTimeout(() => {
          dispatch(newMessagesActions.setCurrentTopicId(newTopic.id));
        }, 50);
      }, 100);
    }
    
    // 关闭菜单
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
      setTimeout(() => setClearConfirmMode(false), 3000);
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
  const handleToolsEnabledChange = createMCPToggleHandler(loadServers, onToolsEnabledChange);

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
        return '#9c27b0';
      case 'inMemory':
        return '#ff9800';
      default:
        return '#9e9e9e';
    }
  };

  // 定义所有可用的按钮配置
  const allButtonConfigs = {
    'mcp-tools': {
      id: 'mcp-tools',
      icon: <Wrench
        size={16}
        color={toolsEnabled 
          ? (isDarkMode ? 'rgba(0, 255, 136, 0.8)' : 'rgba(0, 255, 136, 0.7)')
          : (isDarkMode ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.5)')
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
        color={isDarkMode ? 'rgba(76, 175, 80, 0.8)' : 'rgba(76, 175, 80, 0.7)'}
      />,
      label: '新建话题',
      onClick: handleCreateTopic,
      isActive: false
    },
    'clear-topic': {
      id: 'clear-topic',
      icon: clearConfirmMode
        ? <AlertTriangle
            size={16}
            color={isDarkMode ? 'rgba(244, 67, 54, 0.8)' : 'rgba(244, 67, 54, 0.7)'}
          />
        : <Trash2
            size={16}
            color={isDarkMode ? 'rgba(33, 150, 243, 0.8)' : 'rgba(33, 150, 243, 0.7)'}
          />,
      label: clearConfirmMode ? '确认清空' : '清空内容',
      onClick: handleClearTopic,
      isActive: clearConfirmMode
    },
    'generate-image': {
      id: 'generate-image',
      icon: <Camera
        size={16}
        color={imageGenerationMode
          ? (isDarkMode ? 'rgba(156, 39, 176, 0.9)' : 'rgba(156, 39, 176, 0.8)')
          : (isDarkMode ? 'rgba(156, 39, 176, 0.6)' : 'rgba(156, 39, 176, 0.5)')
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
          ? (isDarkMode ? 'rgba(233, 30, 99, 0.9)' : 'rgba(233, 30, 99, 0.8)')
          : (isDarkMode ? 'rgba(233, 30, 99, 0.6)' : 'rgba(233, 30, 99, 0.5)')
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
        color={isDarkMode ? 'rgba(5, 150, 105, 0.8)' : 'rgba(5, 150, 105, 0.7)'}
      />,
      label: '知识库',
      onClick: handleKnowledgeClick,
      isActive: false
    },
    'web-search': webSearchEnabled && toggleWebSearch ? {
      id: 'web-search',
      icon: <Search
        size={16}
        color={webSearchActive
          ? (isDarkMode ? 'rgba(59, 130, 246, 0.9)' : 'rgba(59, 130, 246, 0.8)')
          : (isDarkMode ? 'rgba(59, 130, 246, 0.6)' : 'rgba(59, 130, 246, 0.5)')
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
      // 过滤掉不可见的按钮和不存在的按钮配置
      return toolbarButtons.visibility[buttonId] && allButtonConfigs[buttonId as keyof typeof allButtonConfigs];
    })
    .map(buttonId => allButtonConfigs[buttonId as keyof typeof allButtonConfigs])
    .filter((button): button is NonNullable<typeof button> => button !== null);

  return (
    <>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={onClose}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        sx={{
          '& .MuiPaper-root': {
            borderRadius: 3,
            minWidth: { xs: '90vw', sm: 280 },
            maxWidth: { xs: '95vw', sm: 320 },
            width: { xs: '90vw', sm: 'auto' },
            maxHeight: { xs: '70vh', sm: '80vh' },
            overflow: 'auto',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
            backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff',
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
                button.onClick();
                // MCP工具按钮点击后不关闭菜单，让对话框处理
                if (button.id === 'mcp-tools') {
                  return;
                }
                onClose();
              }}
              sx={{
                padding: { xs: 1.5, sm: 2 },
                minHeight: { xs: 52, sm: 60 },
                display: 'flex',
                alignItems: 'center',
                '&:hover': {
                  backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)'
                }
              }}
            >
              <Box sx={{
                width: { xs: 28, sm: 32 },
                height: { xs: 28, sm: 32 },
                borderRadius: 2,
                backgroundColor: button.isActive 
                  ? (button.id === 'mcp-tools' 
                      ? (isDarkMode ? 'rgba(0, 255, 136, 0.2)' : 'rgba(0, 255, 136, 0.1)')
                      : (isDarkMode ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)'))
                  : (isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'),
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
                  color: isDarkMode ? '#ffffff' : '#1a1a1a',
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
        fullScreen={window.innerWidth < 600}
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
              <Box sx={{ 
                '& svg': { 
                  width: { xs: '18px', sm: '20px' }, 
                  height: { xs: '18px', sm: '20px' } 
                } 
              }}>
                <Wrench size={20} color="#10b981" />
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
            {onToolsEnabledChange && (
              <CustomSwitch
                checked={toolsEnabled}
                onChange={(e) => handleToolsEnabledChange(e.target.checked)}
              />
            )}
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
                <Wrench size={48} color="rgba(0,0,0,0.4)" />
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
                  bgcolor: '#10b981', 
                  '&:hover': { bgcolor: '#059669' },
                  fontSize: { xs: '14px', sm: '16px' }
                }}
              >
                添加服务器
              </Button>
            </Box>
          ) : (
            <>
              <List sx={{ py: 0 }}>
                {servers.map((server, index) => (
                  <React.Fragment key={server.id}>
                    <ListItem sx={{ py: { xs: 1.5, sm: 2 }, px: { xs: 2, sm: 3 } }}>
                      <ListItemIcon sx={{ minWidth: { xs: 36, sm: 40 } }}>
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
                        secondaryTypographyProps={{ component: 'div' }}
                      />
                      <ListItemSecondaryAction>
                        <CustomSwitch
                          checked={server.isActive}
                          onChange={(e) => handleToggleServer(server.id, e.target.checked)}
                        />
                      </ListItemSecondaryAction>
                    </ListItem>
                    {index < servers.length - 1 && <Divider />}
                  </React.Fragment>
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