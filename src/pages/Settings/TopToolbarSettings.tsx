import React from 'react';
import {
  Box,
  Typography,
  Paper,
  FormGroup,
  FormControlLabel,
  Switch,
  RadioGroup,
  Radio,
  Tooltip,
  IconButton,
  AppBar,
  Toolbar,
  Chip,
  ListItem,
  ListItemIcon,
  ListItemText,
  Card,
  Button,
  Divider,
  alpha
} from '@mui/material';
import {
  ArrowLeft,
  Info,
  AlignJustify,
  Settings,
  Plus,
  Trash2,
  Bot,
  GripVertical,
  Type,
  MessageSquare,
  Wand2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../../shared/store';
import { updateSettings } from '../../shared/store/settingsSlice';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';

const TopToolbarSettings: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const settings = useAppSelector((state) => state.settings);
  const topToolbar = settings.topToolbar || {
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
  };

  const handleBack = () => {
    navigate('/settings/appearance');
  };

  // 更新顶部工具栏设置的通用函数
  const updateTopToolbarSetting = (key: string, value: any) => {
    dispatch(updateSettings({
      topToolbar: {
        ...topToolbar,
        [key]: value
      }
    }));
  };

  // 处理组件开关的函数
  const handleComponentToggle = (componentId: string, enabled: boolean) => {
    const config = componentConfig[componentId as keyof typeof componentConfig];
    if (!config) return;

    // 更新组件的显示状态
    updateTopToolbarSetting(config.key, enabled);

    // 如果关闭组件，从排序数组中移除
    if (!enabled) {
      const newLeftComponents = (topToolbar.leftComponents || []).filter(id => id !== componentId);
      const newRightComponents = (topToolbar.rightComponents || []).filter(id => id !== componentId);

      dispatch(updateSettings({
        topToolbar: {
          ...topToolbar,
          [config.key]: false,
          leftComponents: newLeftComponents,
          rightComponents: newRightComponents,
        }
      }));
    } else {
      // 如果开启组件，添加到合适的位置
      // 根据组件类型决定默认位置
      const isRightComponent = ['modelSelector', 'settingsButton'].includes(componentId);
      const targetArray = isRightComponent ? 'rightComponents' : 'leftComponents';
      const currentArray = topToolbar[targetArray] || [];

      // 如果组件不在数组中，添加到末尾
      if (!currentArray.includes(componentId)) {
        dispatch(updateSettings({
          topToolbar: {
            ...topToolbar,
            [config.key]: true,
            [targetArray]: [...currentArray, componentId],
          }
        }));
      } else {
        // 如果已经在数组中，只更新显示状态
        updateTopToolbarSetting(config.key, enabled);
      }
    }
  };

  // 组件配置
  const componentConfig = {
    menuButton: { name: '菜单按钮', icon: <AlignJustify size={20} />, key: 'showMenuButton' },
    chatTitle: { name: '对话标题', icon: <Type size={20} />, key: 'showChatTitle' },
    topicName: { name: '话题名称', icon: <MessageSquare size={20} />, key: 'showTopicName' },
    newTopicButton: { name: '新建话题', icon: <Plus size={20} />, key: 'showNewTopicButton' },
    clearButton: { name: '清空按钮', icon: <Trash2 size={20} />, key: 'showClearButton' },
    modelSelector: { name: '模型选择器', icon: <Bot size={20} />, key: 'showModelSelector' },
    settingsButton: { name: '设置按钮', icon: <Settings size={20} />, key: 'showSettingsButton' },
  };

  // 拖拽结束处理
  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const { source, destination } = result;

    if (source.droppableId === destination.droppableId) {
      // 同一区域内重排序
      const items = source.droppableId === 'left' ? [...(topToolbar.leftComponents || [])] : [...(topToolbar.rightComponents || [])];
      const [reorderedItem] = items.splice(source.index, 1);
      items.splice(destination.index, 0, reorderedItem);

      const updateKey = source.droppableId === 'left' ? 'leftComponents' : 'rightComponents';
      updateTopToolbarSetting(updateKey, items);
    } else {
      // 跨区域移动
      const sourceItems = source.droppableId === 'left' ? [...(topToolbar.leftComponents || [])] : [...(topToolbar.rightComponents || [])];
      const destItems = destination.droppableId === 'left' ? [...(topToolbar.leftComponents || [])] : [...(topToolbar.rightComponents || [])];

      const [movedItem] = sourceItems.splice(source.index, 1);
      destItems.splice(destination.index, 0, movedItem);

      dispatch(updateSettings({
        topToolbar: {
          ...topToolbar,
          leftComponents: source.droppableId === 'left' ? sourceItems : destItems,
          rightComponents: source.droppableId === 'right' ? sourceItems : destItems,
        }
      }));
    }
  };

  // 渲染组件的函数
  const renderComponent = (componentId: string) => {
    const config = componentConfig[componentId as keyof typeof componentConfig];
    if (!config || !topToolbar[config.key as keyof typeof topToolbar]) return null;

    switch (componentId) {
      case 'menuButton':
        return (
          <IconButton key={componentId} edge="start" color="inherit" size="small" sx={{ mr: 1 }}>
            <AlignJustify size={20} />
          </IconButton>
        );
      case 'chatTitle':
        return (
          <Typography key={componentId} variant="h6" noWrap component="div">
            对话
          </Typography>
        );
      case 'topicName':
        return (
          <Typography key={componentId} variant="body2" noWrap sx={{ color: 'text.secondary', ml: 1 }}>
            示例话题名称
          </Typography>
        );
      case 'newTopicButton':
        return (
          <IconButton key={componentId} color="inherit" size="small" sx={{ ml: 1 }}>
            <Plus size={20} />
          </IconButton>
        );
      case 'clearButton':
        return (
          <IconButton key={componentId} color="inherit" size="small" sx={{ ml: 1 }}>
            <Trash2 size={20} />
          </IconButton>
        );
      case 'modelSelector':
        return (
          <Chip
            key={componentId}
            label="GPT-4"
            size="small"
            variant="outlined"
            sx={{
              borderColor: 'divider',
              color: 'text.primary',
              '& .MuiChip-label': { fontSize: '0.75rem' }
            }}
          />
        );
      case 'settingsButton':
        return (
          <IconButton key={componentId} color="inherit" size="small">
            <Settings size={20} />
          </IconButton>
        );
      default:
        return null;
    }
  };

  // 预览组件
  const PreviewToolbar = () => (
    <Paper elevation={2} sx={{ mb: 3, overflow: 'hidden' }}>
      <Typography variant="subtitle2" sx={{ p: 2, pb: 1, fontWeight: 600 }}>
        实时预览
      </Typography>
      <AppBar
        position="static"
        elevation={0}
        sx={{
          bgcolor: 'background.paper',
          color: 'text.primary',
          borderTop: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between', minHeight: '56px !important' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {(topToolbar.leftComponents || []).map(renderComponent)}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {(topToolbar.rightComponents || []).map(renderComponent)}
          </Box>
        </Toolbar>
      </AppBar>
      <Typography variant="caption" sx={{ p: 2, pt: 1, color: 'text.secondary', display: 'block' }}>
        这是顶部工具栏的实时预览，修改设置后会立即更新。可以拖拽下方的组件来调整顺序。
      </Typography>
    </Paper>
  );

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
            <ArrowLeft size={20} />
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
            顶部工具栏设置
          </Typography>
          <Button
            variant="outlined"
            onClick={() => navigate('/settings/appearance/top-toolbar-test')}
            size="small"
            sx={{
              mr: 1,
              borderColor: 'primary.main',
              color: 'primary.main',
              '&:hover': { borderColor: 'primary.dark', color: 'primary.dark' }
            }}
          >
            测试页面
          </Button>
          <Button
            variant="contained"
            startIcon={<Wand2 size={16} />}
            onClick={() => navigate('/settings/appearance/top-toolbar-diy')}
            size="small"
            sx={{
              bgcolor: 'primary.main',
              '&:hover': { bgcolor: 'primary.dark' }
            }}
          >
            DIY 布局
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

        {/* 实时预览 */}
        <PreviewToolbar />

        {/* 基础组件显示设置 */}
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
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Typography
                variant="subtitle1"
                sx={{
                  fontWeight: 600,
                  fontSize: { xs: '1rem', sm: '1.1rem' }
                }}
              >
                基础组件显示
              </Typography>
              <Tooltip title="控制顶部工具栏中基础组件的显示与隐藏">
                <IconButton size="small" sx={{ ml: 1 }}>
                  <Info size={16} />
                </IconButton>
              </Tooltip>
            </Box>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
            >
              自定义顶部工具栏中基础组件的显示状态
            </Typography>
          </Box>

          <Divider />

          <Box sx={{ p: { xs: 1.5, sm: 2 } }}>
            <FormGroup>
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={topToolbar.showSettingsButton}
                    onChange={(e) => handleComponentToggle('settingsButton', e.target.checked)}
                  />
                }
                label="显示设置按钮"
              />
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={topToolbar.showModelSelector}
                    onChange={(e) => handleComponentToggle('modelSelector', e.target.checked)}
                  />
                }
                label="显示模型选择器"
              />
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={topToolbar.showChatTitle}
                    onChange={(e) => handleComponentToggle('chatTitle', e.target.checked)}
                  />
                }
                label='显示"对话"标题'
              />
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={topToolbar.showMenuButton}
                    onChange={(e) => handleComponentToggle('menuButton', e.target.checked)}
                  />
                }
                label="显示菜单按钮"
              />
            </FormGroup>

            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                mt: 1,
                fontSize: { xs: '0.8rem', sm: '0.875rem' },
                lineHeight: 1.5
              }}
            >
              控制顶部工具栏中基础组件的显示。隐藏设置按钮后，可以通过侧边栏菜单访问设置。
            </Typography>
          </Box>
        </Paper>

        {/* 模型选择器样式 */}
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
              onChange={(e) => updateTopToolbarSetting('modelSelectorStyle', e.target.value)}
            >
              <FormControlLabel
                value="dialog"
                control={<Radio size="small" />}
                label="弹窗式选择器（点击按钮弹出对话框）"
              />
              <FormControlLabel
                value="dropdown"
                control={<Radio size="small" />}
                label="下拉式选择器（直接下拉选择）"
              />
            </RadioGroup>

            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              图标模式可以节省顶部空间，适合小屏设备使用。
            </Typography>
          </Paper>
        )}

        {/* 扩展功能组件 */}
        <Paper elevation={0} sx={{ p: 2, mb: 3, border: '1px solid #eee' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Typography variant="subtitle1">扩展功能组件</Typography>
            <Tooltip title="添加额外的功能按钮到顶部工具栏">
              <IconButton size="small" sx={{ ml: 1 }}>
                <Info size={16} />
              </IconButton>
            </Tooltip>
          </Box>

          <FormGroup>
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={topToolbar.showTopicName}
                  onChange={(e) => handleComponentToggle('topicName', e.target.checked)}
                />
              }
              label="显示当前话题名称"
            />
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={topToolbar.showNewTopicButton}
                  onChange={(e) => handleComponentToggle('newTopicButton', e.target.checked)}
                />
              }
              label="显示新建话题按钮"
            />
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={topToolbar.showClearButton}
                  onChange={(e) => handleComponentToggle('clearButton', e.target.checked)}
                />
              }
              label="显示清空对话按钮"
            />
          </FormGroup>

          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            这些功能可以让你快速访问常用操作，提高使用效率。
          </Typography>
        </Paper>

        {/* 组件排序设置 */}
        <Paper elevation={0} sx={{ p: 2, mb: 3, border: '1px solid #eee' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Typography variant="subtitle1">组件排序</Typography>
            <Tooltip title="长按拖拽组件来调整顶部工具栏的布局顺序">
              <IconButton size="small" sx={{ ml: 1 }}>
                <Info size={16} />
              </IconButton>
            </Tooltip>
          </Box>

          <DragDropContext onDragEnd={handleDragEnd}>
            <Box sx={{ display: 'flex', gap: 2 }}>
              {/* 左侧组件 */}
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                  左侧组件
                </Typography>
                <Droppable droppableId="left">
                  {(provided, snapshot) => (
                    <Card
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      sx={{
                        minHeight: 200,
                        p: 1,
                        bgcolor: snapshot.isDraggingOver ? 'action.hover' : 'background.default',
                        border: '2px dashed',
                        borderColor: snapshot.isDraggingOver ? 'primary.main' : 'divider',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      {(topToolbar.leftComponents || [])
                        .filter(componentId => {
                          const config = componentConfig[componentId as keyof typeof componentConfig];
                          return config && topToolbar[config.key as keyof typeof topToolbar];
                        })
                        .map((componentId, index) => {
                        const config = componentConfig[componentId as keyof typeof componentConfig];
                        if (!config) return null;

                        return (
                          <Draggable key={componentId} draggableId={componentId} index={index}>
                            {(provided, snapshot) => (
                              <ListItem
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                sx={{
                                  mb: 1,
                                  bgcolor: snapshot.isDragging ? 'primary.light' : 'background.paper',
                                  borderRadius: 1,
                                  border: '1px solid',
                                  borderColor: snapshot.isDragging ? 'primary.main' : 'divider',
                                  cursor: 'grab',
                                  '&:active': { cursor: 'grabbing' },
                                  transform: snapshot.isDragging ? 'rotate(5deg)' : 'none',
                                  transition: 'all 0.2s ease'
                                }}
                              >
                                <ListItemIcon sx={{ minWidth: 36 }}>
                                  <GripVertical size={20} color="action" />
                                </ListItemIcon>
                                <ListItemIcon sx={{ minWidth: 36 }}>
                                  {config.icon}
                                </ListItemIcon>
                                <ListItemText
                                  primary={config.name}
                                  primaryTypographyProps={{ variant: 'body2' }}
                                />
                              </ListItem>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </Card>
                  )}
                </Droppable>
              </Box>

              {/* 右侧组件 */}
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                  右侧组件
                </Typography>
                <Droppable droppableId="right">
                  {(provided, snapshot) => (
                    <Card
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      sx={{
                        minHeight: 200,
                        p: 1,
                        bgcolor: snapshot.isDraggingOver ? 'action.hover' : 'background.default',
                        border: '2px dashed',
                        borderColor: snapshot.isDraggingOver ? 'primary.main' : 'divider',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      {(topToolbar.rightComponents || [])
                        .filter(componentId => {
                          const config = componentConfig[componentId as keyof typeof componentConfig];
                          return config && topToolbar[config.key as keyof typeof topToolbar];
                        })
                        .map((componentId, index) => {
                        const config = componentConfig[componentId as keyof typeof componentConfig];
                        if (!config) return null;

                        return (
                          <Draggable key={componentId} draggableId={componentId} index={index}>
                            {(provided, snapshot) => (
                              <ListItem
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                sx={{
                                  mb: 1,
                                  bgcolor: snapshot.isDragging ? 'primary.light' : 'background.paper',
                                  borderRadius: 1,
                                  border: '1px solid',
                                  borderColor: snapshot.isDragging ? 'primary.main' : 'divider',
                                  cursor: 'grab',
                                  '&:active': { cursor: 'grabbing' },
                                  transform: snapshot.isDragging ? 'rotate(5deg)' : 'none',
                                  transition: 'all 0.2s ease'
                                }}
                              >
                                <ListItemIcon sx={{ minWidth: 36 }}>
                                  <GripVertical size={20} color="action" />
                                </ListItemIcon>
                                <ListItemIcon sx={{ minWidth: 36 }}>
                                  {config.icon}
                                </ListItemIcon>
                                <ListItemText
                                  primary={config.name}
                                  primaryTypographyProps={{ variant: 'body2' }}
                                />
                              </ListItem>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </Card>
                  )}
                </Droppable>
              </Box>
            </Box>
          </DragDropContext>

          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            拖拽组件来调整顺序。只显示已开启的组件，关闭的组件不会出现在排序列表中。可以在左右区域之间拖拽来调整组件位置。
          </Typography>
        </Paper>

        {/* 预设配置 */}
        <Paper elevation={0} sx={{ p: 2, mb: 3, border: '1px solid #eee' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Typography variant="subtitle1">快速配置</Typography>
            <Tooltip title="一键应用预设的工具栏配置">
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
      </Box>
    </Box>
  );
};

export default TopToolbarSettings;
