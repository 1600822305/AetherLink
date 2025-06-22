import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../../shared/store';
import { updateSettings } from '../../shared/store/settingsSlice';
import {
  Box,
  Typography,
  Paper,

  FormControlLabel,
  RadioGroup,
  Radio,
  IconButton,
  Tooltip,
  Chip,
  Button,
  Card,
  Grid
} from '@mui/material';
import CustomSwitch from '../../components/CustomSwitch';
import {
  ArrowLeft,
  Info,
  Settings,
  Plus,
  Trash2,
  Bot,
  Type,
  MessageSquare,
  Hand,
  Wand2,
  RotateCcw
} from 'lucide-react';
import { CustomIcon } from '../../components/icons';
import useScrollPosition from '../../hooks/useScrollPosition';

interface ComponentPosition {
  id: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
}

interface DragState {
  isDragging: boolean;
  draggedComponent: string | null;
  startPosition: { x: number; y: number };
  currentPosition: { x: number; y: number };
}

const TopToolbarDIYSettings: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const settings = useAppSelector((state) => state.settings);
  const previewRef = useRef<HTMLDivElement>(null);

  // 使用滚动位置保存功能
  const {
    containerRef,
    handleScroll
  } = useScrollPosition('settings-top-toolbar', {
    autoRestore: true,
    restoreDelay: 100
  });

  // 获取当前工具栏设置，如果没有positions则初始化
  const topToolbar = settings.topToolbar || {
    showSettingsButton: true,
    showModelSelector: true,
    modelSelectorStyle: 'dialog',
    showChatTitle: true,
    showTopicName: false,
    showNewTopicButton: false,
    showClearButton: false,
    showSearchButton: false,
    showMenuButton: true,
    // 新增：组件位置信息
    componentPositions: [] as ComponentPosition[]
  };

  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    draggedComponent: null,
    startPosition: { x: 0, y: 0 },
    currentPosition: { x: 0, y: 0 }
  });

  // 组件配置
  const componentConfig = {
    menuButton: { name: '菜单按钮', icon: <CustomIcon name="documentPanel" size={20} />, key: 'showMenuButton' },
    chatTitle: { name: '对话标题', icon: <Type size={20} />, key: 'showChatTitle' },
    topicName: { name: '话题名称', icon: <MessageSquare size={20} />, key: 'showTopicName' },
    newTopicButton: { name: '新建话题', icon: <Plus size={20} />, key: 'showNewTopicButton' },
    clearButton: { name: '清空按钮', icon: <Trash2 size={20} />, key: 'showClearButton' },
    searchButton: { name: '搜索按钮', icon: <CustomIcon name="search" size={20} />, key: 'showSearchButton' },
    modelSelector: { name: '模型选择器', icon: <Bot size={20} />, key: 'showModelSelector' },
    settingsButton: { name: '设置按钮', icon: <Settings size={20} />, key: 'showSettingsButton' },
  };

  const handleBack = () => {
    navigate('/settings/appearance');
  };

  // 更新组件开关状态
  const handleComponentToggle = (componentId: string, enabled: boolean) => {
    const config = componentConfig[componentId as keyof typeof componentConfig];
    if (!config) return;

    dispatch(updateSettings({
      topToolbar: {
        ...topToolbar,
        [config.key]: enabled
      }
    }));
  };

  // 开始拖拽
  const handleDragStart = useCallback((componentId: string, event: React.MouseEvent | React.TouchEvent) => {
    event.preventDefault();

    const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
    const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;

    setDragState({
      isDragging: true,
      draggedComponent: componentId,
      startPosition: { x: clientX, y: clientY },
      currentPosition: { x: clientX, y: clientY }
    });
  }, []);

  // 拖拽移动
  const handleDragMove = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    if (!dragState.isDragging) return;

    event.preventDefault();
    const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
    const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;

    setDragState(prev => ({
      ...prev,
      currentPosition: { x: clientX, y: clientY }
    }));
  }, [dragState.isDragging]);

  // 结束拖拽
  const handleDragEnd = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    if (!dragState.isDragging || !dragState.draggedComponent || !previewRef.current) return;

    const clientX = 'touches' in event ? event.changedTouches[0].clientX : event.clientX;
    const clientY = 'touches' in event ? event.changedTouches[0].clientY : event.clientY;

    const previewRect = previewRef.current.getBoundingClientRect();

    // 检查是否拖拽到预览区域内
    if (
      clientX >= previewRect.left &&
      clientX <= previewRect.right &&
      clientY >= previewRect.top &&
      clientY <= previewRect.bottom
    ) {
      // 计算相对于预览区域的位置
      const relativeX = ((clientX - previewRect.left) / previewRect.width) * 100;
      const relativeY = ((clientY - previewRect.top) / previewRect.height) * 100;

      // 更新组件位置
      const newPositions = [...(topToolbar.componentPositions || [])];
      const existingIndex = newPositions.findIndex(pos => pos.id === dragState.draggedComponent);

      const newPosition: ComponentPosition = {
        id: dragState.draggedComponent,
        x: Math.max(0, Math.min(90, relativeX)), // 限制在0-90%范围内
        y: Math.max(0, Math.min(80, relativeY))  // 限制在0-80%范围内
      };

      if (existingIndex >= 0) {
        newPositions[existingIndex] = newPosition;
      } else {
        newPositions.push(newPosition);
      }

      dispatch(updateSettings({
        topToolbar: {
          ...topToolbar,
          componentPositions: newPositions
        }
      }));
    }

    setDragState({
      isDragging: false,
      draggedComponent: null,
      startPosition: { x: 0, y: 0 },
      currentPosition: { x: 0, y: 0 }
    });
  }, [dragState, topToolbar, dispatch]);

  // 渲染预览组件
  const renderPreviewComponent = (componentId: string, position?: ComponentPosition) => {
    const config = componentConfig[componentId as keyof typeof componentConfig];
    if (!config || !topToolbar[config.key as keyof typeof topToolbar]) return null;

    const style = position ? {
      position: 'absolute' as const,
      left: `${position.x}%`,
      top: `${position.y}%`,
      transform: 'translate(-50%, -50%)',
      zIndex: 10
    } : {};

    switch (componentId) {
      case 'menuButton':
        return (
          <IconButton key={componentId} color="inherit" size="small" sx={style}>
            <CustomIcon name="documentPanel" size={20} />
          </IconButton>
        );
      case 'chatTitle':
        return (
          <Typography key={componentId} variant="h6" noWrap sx={style}>
            对话
          </Typography>
        );
      case 'topicName':
        return (
          <Typography key={componentId} variant="body2" noWrap sx={{ ...style, color: 'text.secondary' }}>
            示例话题
          </Typography>
        );
      case 'newTopicButton':
        return (
          <IconButton key={componentId} color="inherit" size="small" sx={style}>
            <Plus size={20} />
          </IconButton>
        );
      case 'clearButton':
        return (
          <IconButton key={componentId} color="inherit" size="small" sx={style}>
            <Trash2 size={20} />
          </IconButton>
        );
      case 'searchButton':
        return (
          <IconButton key={componentId} color="inherit" size="small" sx={style}>
            <CustomIcon name="search" size={20} />
          </IconButton>
        );
      case 'modelSelector':
        return topToolbar.modelSelectorStyle === 'dialog' ? (
          <IconButton key={componentId} color="inherit" size="small" sx={style}>
            <Bot size={20} />
          </IconButton>
        ) : (
          <Chip
            key={componentId}
            label="GPT-4"
            size="small"
            variant="outlined"
            sx={{
              ...style,
              borderColor: 'divider',
              color: 'text.primary'
            }}
          />
        );
      case 'settingsButton':
        return (
          <IconButton key={componentId} color="inherit" size="small" sx={style}>
            <Settings size={20} />
          </IconButton>
        );
      default:
        return null;
    }
  };

  // 重置布局
  const handleResetLayout = () => {
    dispatch(updateSettings({
      topToolbar: {
        ...topToolbar,
        componentPositions: []
      }
    }));
  };

  return (
    <Box sx={{
      height: '100vh',
      backgroundColor: 'background.default',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* 头部 */}
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        padding: 2,
        borderBottom: 1,
        borderColor: 'divider',
        backgroundColor: 'background.paper',
        zIndex: 10,
        flexShrink: 0
      }}>
        <ArrowLeft
          size={20}
          style={{ marginRight: 16, cursor: 'pointer' }}
          onClick={handleBack}
        />
        <Typography variant="h6" color="primary" sx={{ flexGrow: 1 }}>
          顶部工具栏 DIY 设置
        </Typography>
        <Button
          startIcon={<RotateCcw size={16} />}
          onClick={handleResetLayout}
          size="small"
          variant="outlined"
        >
          重置布局
        </Button>
      </Box>

      <Box
        ref={containerRef}
        onScroll={handleScroll}
        sx={{ p: 2, flex: 1, overflow: 'auto' }}
      >
        {/* DIY 预览区域 */}
        <Paper elevation={2} sx={{ mb: 3, overflow: 'hidden' }}>
          <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Wand2 size={20} color="primary" />
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              DIY 布局预览
            </Typography>
            <Tooltip title="拖拽下方组件到此区域进行自由布局">
              <IconButton size="small">
                <Info size={16} />
              </IconButton>
            </Tooltip>
          </Box>

          <Box
            ref={previewRef}
            sx={{
              position: 'relative',
              height: 200,
              bgcolor: 'background.paper',
              border: '2px dashed',
              borderColor: 'primary.main',
              borderTop: '1px solid',
              borderTopColor: 'divider',
              overflow: 'hidden'
            }}
            onMouseMove={handleDragMove}
            onMouseUp={handleDragEnd}
            onTouchMove={handleDragMove}
            onTouchEnd={handleDragEnd}
          >
            {/* 网格背景 */}
            <Box sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundImage: `
                linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px),
                linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)
              `,
              backgroundSize: '20px 20px',
              opacity: 0.3
            }} />

            {/* 渲染已放置的组件 */}
            {(topToolbar.componentPositions || []).map(position =>
              renderPreviewComponent(position.id, position)
            )}

            {/* 拖拽中的组件 */}
            {dragState.isDragging && dragState.draggedComponent && (
              <Box sx={{
                position: 'fixed',
                left: dragState.currentPosition.x,
                top: dragState.currentPosition.y,
                transform: 'translate(-50%, -50%)',
                zIndex: 1000,
                opacity: 0.8,
                pointerEvents: 'none'
              }}>
                {renderPreviewComponent(dragState.draggedComponent)}
              </Box>
            )}

            {/* 提示文字 */}
            {(topToolbar.componentPositions || []).length === 0 && (
              <Box sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                textAlign: 'center',
                color: 'text.secondary'
              }}>
                <Hand size={48} style={{ marginBottom: 8, opacity: 0.5 }} />
                <Typography variant="body2">
                  拖拽下方组件到此区域进行自由布局
                </Typography>
              </Box>
            )}
          </Box>
        </Paper>

        {/* 组件面板 */}
        <Paper elevation={0} sx={{ p: 2, mb: 3, border: '1px solid #eee' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Typography variant="subtitle1">可用组件</Typography>
            <Tooltip title="长按组件拖拽到预览区域进行布局">
              <IconButton size="small" sx={{ ml: 1 }}>
                <Info size={16} />
              </IconButton>
            </Tooltip>
          </Box>

          <Grid container spacing={2}>
            {Object.entries(componentConfig).map(([componentId, config]) => {
              const isEnabled = topToolbar[config.key as keyof typeof topToolbar];
              const isPlaced = (topToolbar.componentPositions || []).some(pos => pos.id === componentId);

              return (
                <Grid size={{ xs: 6, sm: 4, md: 3 }} key={componentId}>
                  <Card
                    sx={{
                      p: 2,
                      textAlign: 'center',
                      cursor: isEnabled ? 'grab' : 'not-allowed',
                      opacity: isEnabled ? 1 : 0.5,
                      border: isPlaced ? '2px solid' : '1px solid',
                      borderColor: isPlaced ? 'success.main' : 'divider',
                      bgcolor: isPlaced ? 'success.light' : 'background.paper',
                      transition: 'all 0.2s ease',
                      '&:hover': isEnabled ? {
                        transform: 'translateY(-2px)',
                        boxShadow: 2
                      } : {},
                      '&:active': isEnabled ? {
                        cursor: 'grabbing',
                        transform: 'scale(0.95)'
                      } : {}
                    }}
                    onMouseDown={isEnabled ? (e) => handleDragStart(componentId, e) : undefined}
                    onTouchStart={isEnabled ? (e) => handleDragStart(componentId, e) : undefined}
                  >
                    <Box sx={{ mb: 1, color: isEnabled ? 'primary.main' : 'text.disabled' }}>
                      {config.icon}
                    </Box>
                    <Typography
                      variant="caption"
                      sx={{
                        fontWeight: 500,
                        color: isEnabled ? 'text.primary' : 'text.disabled'
                      }}
                    >
                      {config.name}
                    </Typography>
                    {isPlaced && (
                      <Typography variant="caption" color="success.main" sx={{ display: 'block', mt: 0.5 }}>
                        已放置
                      </Typography>
                    )}
                  </Card>
                </Grid>
              );
            })}
          </Grid>

          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            💡 提示：长按组件并拖拽到预览区域的任意位置进行自由布局。灰色组件需要先在下方开启显示。
          </Typography>
        </Paper>

        {/* 组件开关设置 */}
        <Paper elevation={0} sx={{ p: 2, mb: 3, border: '1px solid #eee' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Typography variant="subtitle1">组件显示设置</Typography>
            <Tooltip title="控制哪些组件可以在工具栏中显示">
              <IconButton size="small" sx={{ ml: 1 }}>
                <Info size={16} />
              </IconButton>
            </Tooltip>
          </Box>

          <Grid container spacing={2}>
            {Object.entries(componentConfig).map(([componentId, config]) => (
              <Grid size={{ xs: 12, sm: 6 }} key={componentId}>
                <FormControlLabel
                  control={
                    <CustomSwitch
                      checked={topToolbar[config.key as keyof typeof topToolbar] as boolean}
                      onChange={(e) => handleComponentToggle(componentId, e.target.checked)}
                    />
                  }
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {config.icon}
                      <Typography variant="body2">{config.name}</Typography>
                    </Box>
                  }
                />
              </Grid>
            ))}
          </Grid>
        </Paper>

        {/* 快速预设配置 */}
        <Paper elevation={0} sx={{ p: 2, mb: 3, border: '1px solid #eee' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Typography variant="subtitle1">快速预设配置</Typography>
            <Tooltip title="选择预设的工具栏配置方案">
              <IconButton size="small" sx={{ ml: 1 }}>
                <Info size={16} />
              </IconButton>
            </Tooltip>
          </Box>

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Box
              sx={{
                p: 1.5,
                border: '1px solid #ddd',
                borderRadius: 1,
                cursor: 'pointer',
                '&:hover': { bgcolor: 'action.hover' }
              }}
              onClick={() => {
                dispatch(updateSettings({
                  topToolbar: {
                    showSettingsButton: true,
                    showModelSelector: true,
                    modelSelectorStyle: 'dialog',
                    showChatTitle: true,
                    showTopicName: false,
                    showNewTopicButton: false,
                    showClearButton: false,
                    showMenuButton: true,
                    leftComponents: ['menuButton', 'chatTitle', 'topicName', 'newTopicButton', 'clearButton'],
                    rightComponents: ['modelSelector', 'settingsButton'],
                    componentPositions: [] // 重置DIY布局
                  }
                }));
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 500 }}>默认配置</Typography>
              <Typography variant="caption" color="text.secondary">
                标准的工具栏布局
              </Typography>
            </Box>

            <Box
              sx={{
                p: 1.5,
                border: '1px solid #ddd',
                borderRadius: 1,
                cursor: 'pointer',
                '&:hover': { bgcolor: 'action.hover' }
              }}
              onClick={() => {
                dispatch(updateSettings({
                  topToolbar: {
                    showSettingsButton: false,
                    showModelSelector: true,
                    modelSelectorStyle: 'dialog',
                    showChatTitle: false,
                    showTopicName: true,
                    showNewTopicButton: true,
                    showClearButton: true,
                    showMenuButton: true,
                    leftComponents: ['menuButton', 'topicName', 'newTopicButton', 'clearButton'],
                    rightComponents: ['modelSelector'],
                    componentPositions: [] // 重置DIY布局
                  }
                }));
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 500 }}>简洁配置</Typography>
              <Typography variant="caption" color="text.secondary">
                精简的工具栏，节省空间
              </Typography>
            </Box>
          </Box>
        </Paper>

        {/* 模型选择器样式设置 */}
        {topToolbar.showModelSelector && (
          <Paper elevation={0} sx={{ p: 2, mb: 3, border: '1px solid #eee' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Typography variant="subtitle1">模型选择器样式</Typography>
              <Tooltip title="选择模型选择器的显示样式">
                <IconButton size="small" sx={{ ml: 1 }}>
                  <Info size={16} />
                </IconButton>
              </Tooltip>
            </Box>

            <RadioGroup
              value={topToolbar.modelSelectorStyle}
              onChange={(e) => {
                dispatch(updateSettings({
                  topToolbar: {
                    ...topToolbar,
                    modelSelectorStyle: e.target.value as 'dialog' | 'dropdown'
                  }
                }));
              }}
            >
              <FormControlLabel
                value="dialog"
                control={<Radio size="small" />}
                label="图标模式（显示图标按钮，点击弹出模型选择对话框）"
              />
              <FormControlLabel
                value="dropdown"
                control={<Radio size="small" />}
                label="文字模式（显示当前模型名称，点击下拉选择）"
              />
            </RadioGroup>

            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              图标模式节省空间，适合小屏设备；文字模式显示当前模型，更直观。
            </Typography>
          </Paper>
        )}

        {/* 使用说明 */}
        <Paper elevation={0} sx={{ p: 2, border: '1px solid #eee', bgcolor: 'info.light' }}>
          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
            🎨 DIY 布局使用说明
          </Typography>
          <Box component="ul" sx={{ pl: 2, m: 0 }}>
            <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
              首先在"组件显示设置"中开启需要的组件
            </Typography>
            <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
              长按"可用组件"中的组件并拖拽到预览区域
            </Typography>
            <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
              可以将组件放置在工具栏的任意位置
            </Typography>
            <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
              点击"重置布局"可以清除所有自定义位置
            </Typography>
            <Typography component="li" variant="body2">
              设置会实时保存并应用到聊天页面
            </Typography>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
};

export default TopToolbarDIYSettings;
