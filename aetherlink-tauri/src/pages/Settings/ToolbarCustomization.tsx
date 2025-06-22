import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  FormControl,
  RadioGroup,
  FormControlLabel,
  Radio,
  Paper,
  AppBar,
  Toolbar,
  IconButton,
  Card,
  CardContent,
  alpha,
  Chip,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,

} from '@mui/material';
import { ArrowLeft, Wrench, Plus, Trash2, Camera, Video, BookOpen, Search, GripVertical, Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../../shared/store';
import { setToolbarStyle, updateSettings, updateToolbarButtons } from '../../shared/store/settingsSlice';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';

// 工具栏按钮配置
const TOOLBAR_BUTTONS = [
  {
    id: 'mcp-tools',
    icon: Wrench,
    label: 'MCP工具',
    description: '启用/禁用MCP工具调用功能',
    color: 'rgba(255, 152, 0, 0.8)'
  },
  {
    id: 'new-topic',
    icon: Plus,
    label: '新建话题',
    description: '创建新的对话话题',
    color: 'rgba(76, 175, 80, 0.8)'
  },
  {
    id: 'clear-topic',
    icon: Trash2,
    label: '清空内容',
    description: '清空当前话题的所有消息',
    color: 'rgba(33, 150, 243, 0.8)'
  },
  {
    id: 'generate-image',
    icon: Camera,
    label: '生成图片',
    description: '切换到图像生成模式',
    color: 'rgba(156, 39, 176, 0.8)'
  },
  {
    id: 'generate-video',
    icon: Video,
    label: '生成视频',
    description: '切换到视频生成模式',
    color: 'rgba(233, 30, 99, 0.8)'
  },
  {
    id: 'knowledge',
    icon: BookOpen,
    label: '知识库',
    description: '选择知识库进行搜索',
    color: 'rgba(5, 150, 105, 0.8)'
  },
  {
    id: 'web-search',
    icon: Search,
    label: '网络搜索',
    description: '启用网络搜索功能',
    color: 'rgba(59, 130, 246, 0.8)'
  }
];

const ToolbarCustomization: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const settings = useAppSelector((state) => state.settings);
  const isDarkMode = settings.theme === 'dark' ||
    (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  // 获取工具栏显示样式设置
  const toolbarDisplayStyle = settings.toolbarDisplayStyle || 'both';

  // 获取工具栏按钮配置
  const toolbarButtons = settings.toolbarButtons || {
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
  };

  // 本地状态管理
  const [localButtonOrder, setLocalButtonOrder] = useState<string[]>(toolbarButtons.order);
  const [localButtonVisibility, setLocalButtonVisibility] = useState<{ [key: string]: boolean }>(toolbarButtons.visibility);

  // 同步本地状态与Redux状态
  useEffect(() => {
    setLocalButtonOrder(toolbarButtons.order);
    setLocalButtonVisibility(toolbarButtons.visibility);
  }, [toolbarButtons]);

  const handleBack = () => {
    navigate('/settings/appearance');
  };

  const handleToolbarStyleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setToolbarStyle(event.target.value as 'glassmorphism' | 'transparent'));
  };

  const handleToolbarDisplayStyleChange = (event: { target: { value: any } }) => {
    dispatch(updateSettings({
      toolbarDisplayStyle: event.target.value
    }));
  };

  // 处理拖拽结束
  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) {
      return;
    }

    const sourceIndex = result.source.index;
    const destinationIndex = result.destination.index;

    if (sourceIndex === destinationIndex) {
      return;
    }

    // 重新排序按钮
    const newOrder = Array.from(localButtonOrder);
    const [removed] = newOrder.splice(sourceIndex, 1);
    newOrder.splice(destinationIndex, 0, removed);

    // 更新本地状态
    setLocalButtonOrder(newOrder);

    // 更新Redux状态
    dispatch(updateToolbarButtons({
      order: newOrder,
      visibility: localButtonVisibility
    }));
  };

  // 处理按钮可见性切换
  const handleVisibilityToggle = (buttonId: string) => {
    const newVisibility = {
      ...localButtonVisibility,
      [buttonId]: !localButtonVisibility[buttonId]
    };

    // 更新本地状态
    setLocalButtonVisibility(newVisibility);

    // 更新Redux状态
    dispatch(updateToolbarButtons({
      order: localButtonOrder,
      visibility: newVisibility
    }));
  };

  // 重置为默认配置
  const handleResetToDefault = () => {
    const defaultOrder = ['mcp-tools', 'new-topic', 'clear-topic', 'generate-image', 'generate-video', 'knowledge', 'web-search'];
    const defaultVisibility = {
      'mcp-tools': true,
      'new-topic': true,
      'clear-topic': true,
      'generate-image': true,
      'generate-video': true,
      'knowledge': true,
      'web-search': true
    };

    setLocalButtonOrder(defaultOrder);
    setLocalButtonVisibility(defaultVisibility);

    dispatch(updateToolbarButtons({
      order: defaultOrder,
      visibility: defaultVisibility
    }));
  };

  // 玻璃样式预览
  const getGlassPreviewStyle = () => ({
    background: isDarkMode
      ? 'rgba(255, 255, 255, 0.08)'
      : 'rgba(255, 255, 255, 0.15)',
    border: isDarkMode
      ? '1px solid rgba(255, 255, 255, 0.12)'
      : '1px solid rgba(255, 255, 255, 0.25)',
    borderRadius: '16px',
    padding: '8px 14px',
    backdropFilter: 'blur(12px) saturate(120%)',
    WebkitBackdropFilter: 'blur(12px) saturate(120%)',
    boxShadow: isDarkMode
      ? '0 4px 16px rgba(0, 0, 0, 0.15), 0 1px 4px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
      : '0 4px 16px rgba(0, 0, 0, 0.08), 0 1px 4px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.4)',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    minHeight: '36px',
    margin: '0 4px',
    cursor: 'pointer',
    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
  });

  // 透明样式预览
  const getTransparentPreviewStyle = () => ({
    background: 'transparent',
    border: 'none',
    borderRadius: '20px',
    padding: '6px 12px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    minHeight: '32px',
    margin: '0 2px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    '&:hover': {
      background: isDarkMode
        ? 'rgba(255, 255, 255, 0.06)'
        : 'rgba(0, 0, 0, 0.04)'
    }
  });

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
            <ArrowLeft size={24} />
          </IconButton>
          <Typography
            variant="h6"
            component="div"
            sx={{
              flexGrow: 1,
              fontWeight: 600,
              backgroundImage: 'linear-gradient(90deg, #06b6d4, #0891b2)',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            输入框工具栏定制
          </Typography>
        </Toolbar>
      </AppBar>

      <Box
        sx={{
          flexGrow: 1,
          overflowY: 'auto',
          p: 2,
          mt: 8,
          '&::-webkit-scrollbar': {
            width: '6px',
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'rgba(0,0,0,0.1)',
            borderRadius: '3px',
          },
        }}
      >
        {/* 工具栏样式选择 */}
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
          <Box sx={{ p: 2, bgcolor: 'rgba(0,0,0,0.01)' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              工具栏背景样式
            </Typography>
            <Typography variant="body2" color="text.secondary">
              选择输入框工具栏的背景效果，影响新建话题、清空内容等按钮的外观
            </Typography>
          </Box>

          <Box sx={{ p: 3 }}>
            <FormControl component="fieldset" fullWidth>
              <RadioGroup
                value={settings.toolbarStyle || 'glassmorphism'}
                onChange={handleToolbarStyleChange}
                sx={{ gap: 2 }}
              >
                {/* 毛玻璃效果选项 */}
                <Card
                  variant="outlined"
                  sx={{
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    border: settings.toolbarStyle === 'glassmorphism' ? 2 : 1,
                    borderColor: settings.toolbarStyle === 'glassmorphism' 
                      ? 'primary.main' 
                      : 'divider',
                    '&:hover': {
                      borderColor: 'primary.main',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    }
                  }}
                  onClick={() => dispatch(setToolbarStyle('glassmorphism'))}
                >
                  <CardContent sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <FormControlLabel
                        value="glassmorphism"
                        control={<Radio />}
                        label={
                          <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                              毛玻璃效果 (推荐)
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              现代玻璃UI设计，具有模糊背景和立体阴影效果
                            </Typography>
                          </Box>
                        }
                        sx={{ m: 0, flex: 1 }}
                      />
                      {settings.toolbarStyle === 'glassmorphism' && (
                        <Chip label="当前" size="small" color="primary" />
                      )}
                    </Box>
                    
                    {/* 毛玻璃效果预览 */}
                    <Box sx={{ 
                      display: 'flex', 
                      gap: 1, 
                      p: 2, 
                      bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.05)',
                      borderRadius: 2,
                      position: 'relative',
                      overflow: 'hidden'
                    }}>
                      <Box sx={getGlassPreviewStyle()}>
                        <Plus size={16} />
                        <Typography variant="body2" sx={{ fontSize: '13px', fontWeight: 600 }}>
                          新建话题
                        </Typography>
                      </Box>
                      <Box sx={getGlassPreviewStyle()}>
                        <Trash2 size={16} />
                        <Typography variant="body2" sx={{ fontSize: '13px', fontWeight: 600 }}>
                          清空内容
                        </Typography>
                      </Box>
                      <Box sx={getGlassPreviewStyle()}>
                        <Wrench size={16} />
                        <Typography variant="body2" sx={{ fontSize: '13px', fontWeight: 600 }}>
                          工具
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>

                {/* 透明效果选项 */}
                <Card
                  variant="outlined"
                  sx={{
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    border: settings.toolbarStyle === 'transparent' ? 2 : 1,
                    borderColor: settings.toolbarStyle === 'transparent' 
                      ? 'primary.main' 
                      : 'divider',
                    '&:hover': {
                      borderColor: 'primary.main',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    }
                  }}
                  onClick={() => dispatch(setToolbarStyle('transparent'))}
                >
                  <CardContent sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <FormControlLabel
                        value="transparent"
                        control={<Radio />}
                        label={
                          <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                              透明效果
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              简约透明设计，悬停时显示淡色背景
                            </Typography>
                          </Box>
                        }
                        sx={{ m: 0, flex: 1 }}
                      />
                      {settings.toolbarStyle === 'transparent' && (
                        <Chip label="当前" size="small" color="primary" />
                      )}
                    </Box>
                    
                    {/* 透明效果预览 */}
                    <Box sx={{ 
                      display: 'flex', 
                      gap: 1, 
                      p: 2, 
                      bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.05)',
                      borderRadius: 2 
                    }}>
                      <Box sx={getTransparentPreviewStyle()}>
                        <Plus size={16} />
                        <Typography variant="body2" sx={{ fontSize: '13px', fontWeight: 500 }}>
                          新建话题
                        </Typography>
                      </Box>
                      <Box sx={getTransparentPreviewStyle()}>
                        <Trash2 size={16} />
                        <Typography variant="body2" sx={{ fontSize: '13px', fontWeight: 500 }}>
                          清空内容
                        </Typography>
                      </Box>
                      <Box sx={getTransparentPreviewStyle()}>
                        <Wrench size={16} />
                        <Typography variant="body2" sx={{ fontSize: '13px', fontWeight: 500 }}>
                          工具
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </RadioGroup>
            </FormControl>
          </Box>
        </Paper>

        {/* 工具栏显示方式设置 */}
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
          <Box sx={{ p: 2, bgcolor: 'rgba(0,0,0,0.01)' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              工具栏显示方式
            </Typography>
            <Typography variant="body2" color="text.secondary">
              设置工具栏按钮的显示方式，可以选择同时显示图标和文字，或仅显示图标，或仅显示文字
            </Typography>
          </Box>

          <Divider />

          <Box sx={{ p: 3 }}>
            <FormControl fullWidth variant="outlined" sx={{ mb: 2 }}>
              <InputLabel>工具栏显示样式</InputLabel>
              <Select
                value={toolbarDisplayStyle}
                onChange={handleToolbarDisplayStyleChange}
                label="工具栏显示样式"
                MenuProps={{
                  disableAutoFocus: true,
                  disableRestoreFocus: true
                }}
              >
                <MenuItem value="both">图标+文字（默认）</MenuItem>
                <MenuItem value="icon">仅图标</MenuItem>
                <MenuItem value="text">仅文字</MenuItem>
              </Select>
            </FormControl>

            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              设置聊天界面工具栏的显示方式。可以选择同时显示图标和文字，或仅显示图标，或仅显示文字。
            </Typography>

            {/* 预览效果 */}
            <Box sx={{
              mt: 3,
              p: 2,
              bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.05)',
              borderRadius: 2,
              position: 'relative',
              overflow: 'hidden'
            }}>
              <Typography variant="body2" sx={{ mb: 2, fontWeight: 600 }}>
                预览效果：
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                {/* 根据当前选择的样式显示预览 */}
                {toolbarDisplayStyle === 'both' && (
                  <>
                    <Box sx={settings.toolbarStyle === 'glassmorphism' ? getGlassPreviewStyle() : getTransparentPreviewStyle()}>
                      <Plus size={16} />
                      <Typography variant="body2" sx={{ fontSize: '13px', fontWeight: 600 }}>
                        新建话题
                      </Typography>
                    </Box>
                    <Box sx={settings.toolbarStyle === 'glassmorphism' ? getGlassPreviewStyle() : getTransparentPreviewStyle()}>
                      <Trash2 size={16} />
                      <Typography variant="body2" sx={{ fontSize: '13px', fontWeight: 600 }}>
                        清空内容
                      </Typography>
                    </Box>
                    <Box sx={settings.toolbarStyle === 'glassmorphism' ? getGlassPreviewStyle() : getTransparentPreviewStyle()}>
                      <Wrench size={16} />
                      <Typography variant="body2" sx={{ fontSize: '13px', fontWeight: 600 }}>
                        工具
                      </Typography>
                    </Box>
                  </>
                )}
                {toolbarDisplayStyle === 'icon' && (
                  <>
                    <Box sx={settings.toolbarStyle === 'glassmorphism' ? getGlassPreviewStyle() : getTransparentPreviewStyle()}>
                      <Plus size={16} />
                    </Box>
                    <Box sx={settings.toolbarStyle === 'glassmorphism' ? getGlassPreviewStyle() : getTransparentPreviewStyle()}>
                      <Trash2 size={16} />
                    </Box>
                    <Box sx={settings.toolbarStyle === 'glassmorphism' ? getGlassPreviewStyle() : getTransparentPreviewStyle()}>
                      <Wrench size={16} />
                    </Box>
                  </>
                )}
                {toolbarDisplayStyle === 'text' && (
                  <>
                    <Box sx={settings.toolbarStyle === 'glassmorphism' ? getGlassPreviewStyle() : getTransparentPreviewStyle()}>
                      <Typography variant="body2" sx={{ fontSize: '13px', fontWeight: 600 }}>
                        新建话题
                      </Typography>
                    </Box>
                    <Box sx={settings.toolbarStyle === 'glassmorphism' ? getGlassPreviewStyle() : getTransparentPreviewStyle()}>
                      <Typography variant="body2" sx={{ fontSize: '13px', fontWeight: 600 }}>
                        清空内容
                      </Typography>
                    </Box>
                    <Box sx={settings.toolbarStyle === 'glassmorphism' ? getGlassPreviewStyle() : getTransparentPreviewStyle()}>
                      <Typography variant="body2" sx={{ fontSize: '13px', fontWeight: 600 }}>
                        工具
                      </Typography>
                    </Box>
                  </>
                )}
              </Box>
            </Box>
          </Box>
        </Paper>

        {/* 工具栏按钮自定义 */}
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
          <Box sx={{ p: 2, bgcolor: 'rgba(0,0,0,0.01)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  工具栏按钮自定义
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  拖拽调整按钮顺序，点击眼睛图标控制按钮显示/隐藏
                </Typography>
              </Box>
              <IconButton
                onClick={handleResetToDefault}
                size="small"
                sx={{
                  bgcolor: 'action.hover',
                  '&:hover': { bgcolor: 'action.selected' }
                }}
              >
                <Wrench size={16} />
              </IconButton>
            </Box>
          </Box>

          <Divider />

          <Box sx={{ p: 3, position: 'relative' }}>
            {/* 防止复制的覆盖层 */}
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 1,
                pointerEvents: 'none',
                userSelect: 'none',
                WebkitUserSelect: 'none',
                MozUserSelect: 'none',
                msUserSelect: 'none',
                '&::selection': {
                  background: 'transparent'
                },
                '& *::selection': {
                  background: 'transparent'
                }
              }}
            />

            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="toolbar-buttons">
                {(provided, snapshot) => (
                  <List
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    sx={{
                      bgcolor: snapshot.isDraggingOver ? 'action.hover' : 'transparent',
                      borderRadius: 1,
                      transition: 'background-color 0.2s ease',
                      minHeight: 200,
                      position: 'relative',
                      zIndex: 2,
                      userSelect: 'none',
                      WebkitUserSelect: 'none',
                      MozUserSelect: 'none',
                      msUserSelect: 'none',
                      '& *': {
                        userSelect: 'none',
                        WebkitUserSelect: 'none',
                        MozUserSelect: 'none',
                        msUserSelect: 'none'
                      },
                      '&::selection': {
                        background: 'transparent'
                      },
                      '& *::selection': {
                        background: 'transparent'
                      }
                    }}
                  >
                    {localButtonOrder.map((buttonId, index) => {
                      const buttonConfig = TOOLBAR_BUTTONS.find(btn => btn.id === buttonId);
                      if (!buttonConfig) return null;

                      const IconComponent = buttonConfig.icon;
                      const isVisible = localButtonVisibility[buttonId];

                      return (
                        <Draggable key={buttonId} draggableId={buttonId} index={index}>
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
                                transform: snapshot.isDragging ? 'rotate(2deg)' : 'none',
                                transition: 'all 0.2s ease',
                                opacity: isVisible ? 1 : 0.5,
                                cursor: 'grab',
                                '&:active': { cursor: 'grabbing' },
                                '&:hover': {
                                  borderColor: 'primary.main',
                                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                                }
                              }}
                            >
                              <ListItemIcon sx={{ minWidth: 40 }}>
                                <GripVertical size={16} color="rgba(0,0,0,0.4)" />
                              </ListItemIcon>

                              <ListItemIcon sx={{ minWidth: 40 }}>
                                <IconComponent
                                  size={20}
                                  color={buttonConfig.color}
                                />
                              </ListItemIcon>

                              <ListItemText
                                primary={
                                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                    {buttonConfig.label}
                                  </Typography>
                                }
                                secondary={buttonConfig.description}
                                sx={{ flex: 1 }}
                              />

                              <IconButton
                                edge="end"
                                onClick={(e) => {
                                  e.stopPropagation(); // 防止触发拖拽
                                  handleVisibilityToggle(buttonId);
                                }}
                                sx={{
                                  color: isVisible ? 'primary.main' : 'text.disabled',
                                  ml: 1,
                                  '&:hover': {
                                    bgcolor: isVisible ? 'primary.light' : 'action.hover'
                                  }
                                }}
                              >
                                {isVisible ? <Eye size={18} /> : <EyeOff size={18} />}
                              </IconButton>
                            </ListItem>
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                  </List>
                )}
              </Droppable>
            </DragDropContext>

            {/* 实时预览 */}
            <Box sx={{ mt: 3 }}>
              <Typography variant="body2" sx={{ mb: 2, fontWeight: 600 }}>
                实时预览：
              </Typography>
              <Box sx={{
                display: 'flex',
                gap: 1,
                p: 2,
                bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.05)',
                borderRadius: 2,
                flexWrap: 'wrap'
              }}>
                {localButtonOrder
                  .filter(buttonId => localButtonVisibility[buttonId])
                  .map(buttonId => {
                    const buttonConfig = TOOLBAR_BUTTONS.find(btn => btn.id === buttonId);
                    if (!buttonConfig) return null;

                    const IconComponent = buttonConfig.icon;
                    const previewStyle = settings.toolbarStyle === 'glassmorphism'
                      ? getGlassPreviewStyle()
                      : getTransparentPreviewStyle();

                    return (
                      <Box key={buttonId} sx={previewStyle}>
                        {toolbarDisplayStyle !== 'text' && (
                          <IconComponent size={16} color={buttonConfig.color} />
                        )}
                        {toolbarDisplayStyle !== 'icon' && (
                          <Typography variant="body2" sx={{
                            fontSize: '13px',
                            fontWeight: settings.toolbarStyle === 'glassmorphism' ? 600 : 500,
                            ml: toolbarDisplayStyle === 'both' ? 0.5 : 0
                          }}>
                            {buttonConfig.label}
                          </Typography>
                        )}
                      </Box>
                    );
                  })}
              </Box>
            </Box>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
};

export default ToolbarCustomization;
