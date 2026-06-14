import React, { useState, useRef, useEffect, useId } from 'react';
import { useDialogBackHandler } from '../../hooks/useDialogBackHandler';
import { Box, Typography, useTheme, Menu, MenuItem, alpha } from '@mui/material';
import { Plus, Trash2, AlertTriangle, BookOpen, Video, Wrench } from 'lucide-react';
import { CustomIcon } from '../icons';
import { useSelector } from 'react-redux';
import type { RootState } from '../../shared/store';
// KnowledgeSelector 内部已处理 Redux dispatch（多选模式）
import { useTopicManagement } from '../../shared/hooks/useTopicManagement';
import WebSearchProviderSelector from '../WebSearchProviderSelector';
import KnowledgeSelector from '../chat/KnowledgeSelector';
import { useInputStyles } from '../../shared/hooks/useInputStyles';
import MCPServerQuickPanel from './buttons/MCPServerQuickPanel';
import { createLogger } from '../../shared/services/infra/logger';

const logger = createLogger('ToolsMenu');

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
  // 返回键关闭支持
  const menuId = useId();
  useDialogBackHandler(`tools-menu-${menuId}`, open, onClose);

  const [showProviderSelector, setShowProviderSelector] = useState(false);
  const [clearConfirmMode, setClearConfirmMode] = useState(false);
  const [showKnowledgeSelector, setShowKnowledgeSelector] = useState(false);
  const [showMCPDialog, setShowMCPDialog] = useState(false);

  const theme = useTheme();
  useInputStyles();

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
  const handleKnowledgeSelect = (knowledgeBase: { id: string; name: string }, searchResults: unknown[]) => {
    logger.debug('选择了知识库:', knowledgeBase, '搜索结果:', searchResults);
    // Redux dispatch 已由 KnowledgeSelector 内部处理（支持多选）
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
    if (toggleWebSearch) {
      if (providerId && !webSearchActive) {
        // 选择了提供商且搜索未激活，激活搜索模式
        toggleWebSearch();
      } else if (!providerId && webSearchActive) {
        // 选择了"不使用网络搜索"且搜索已激活，关闭搜索模式
        toggleWebSearch();
      }
    }
    onClose();
  };

  // 处理MCP工具按钮点击
  const handleMCPToolsClick = () => {
    setShowMCPDialog(true);
  };

  const handleCloseMCPDialog = () => {
    setShowMCPDialog(false);
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
      label: webSearchSettings?.providers?.find((p: { id: string; name: string }) => p.id === currentProvider)?.name || '网络搜索',
      onClick: handleWebSearchClick,
      isActive: webSearchActive
    } : null
  };

  // 根据设置生成按钮数组
  const buttons = toolbarButtons.order
    .filter((buttonId: string) => {
      // 过滤掉不可见的按钮，以及配置不合法的按钮
      const config = allButtonConfigs[buttonId as keyof typeof allButtonConfigs];
      return (
        toolbarButtons.visibility[buttonId] &&
        config &&
        typeof config === 'object' &&
        'id' in config
      );
    })
    .map((buttonId: string) => allButtonConfigs[buttonId as keyof typeof allButtonConfigs])
    .filter((button: typeof allButtonConfigs[keyof typeof allButtonConfigs]): button is NonNullable<typeof button> => button !== null);

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
        {buttons.map((button: NonNullable<typeof allButtonConfigs[keyof typeof allButtonConfigs]>) => {
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

      {/* MCP工具对话框 - 使用共享组件 */}
      <MCPServerQuickPanel
        open={showMCPDialog}
        onClose={handleCloseMCPDialog}
        toolsEnabled={toolsEnabled}
        onToolsEnabledChange={onToolsEnabledChange}
      />
    </>
  );
};

export default ToolsMenu; 
