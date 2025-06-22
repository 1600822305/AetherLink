import React from 'react';
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  Slider,
  FormHelperText,
  Chip,
  AppBar,
  Toolbar,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Divider,
  alpha,
  Switch,
  FormControlLabel
} from '@mui/material';
import { ArrowLeft, ChevronRight, MessageSquare, MessageCircle, Wrench, Brain } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../../shared/store';
import { setTheme, setFontSize, setFontFamily, setShowPerformanceMonitor } from '../../shared/store/settingsSlice';
import ThemeStyleSelector from '../../components/settings/ThemeStyleSelector';
import { fontOptions, fontCategoryLabels, getFontById } from '../../shared/config/fonts';
import useScrollPosition from '../../hooks/useScrollPosition';

const AppearanceSettings: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const settings = useAppSelector((state) => state.settings);

  // 使用滚动位置保存功能
  const {
    containerRef,
    handleScroll
  } = useScrollPosition('settings-appearance', {
    autoRestore: true,
    restoreDelay: 100
  });

  const handleBack = () => {
    navigate('/settings');
  };

  // 字体大小处理函数
  const handleFontSizeChange = (_: Event, newValue: number | number[]) => {
    dispatch(setFontSize(newValue as number));
  };

  // 字体家族处理函数
  const handleFontFamilyChange = (event: any) => {
    dispatch(setFontFamily(event.target.value));
  };

  // 字体大小预设值
  const fontSizePresets = [
    { value: 12, label: '极小' },
    { value: 14, label: '小' },
    { value: 16, label: '标准' },
    { value: 18, label: '大' },
    { value: 20, label: '极大' },
    { value: 24, label: '超大' }
  ];

  // 获取当前字体大小的描述
  const getCurrentFontSizeLabel = (fontSize: number) => {
    const preset = fontSizePresets.find(p => p.value === fontSize);
    return preset ? preset.label : '自定义';
  };

  // 获取当前字体的描述
  const getCurrentFontLabel = (fontId: string) => {
    const font = getFontById(fontId);
    return font ? font.name : '系统默认';
  };

  const handleNavigateToChatInterface = () => {
    navigate('/settings/appearance/chat-interface');
  };

  const handleNavigateToTopToolbar = () => {
    navigate('/settings/appearance/top-toolbar');
  };

  const handleNavigateToToolbarCustomization = () => {
    navigate('/settings/appearance/toolbar-customization');
  };

  const handleNavigateToMessageBubble = () => {
    navigate('/settings/appearance/message-bubble');
  };

  const handleNavigateToThinkingProcess = () => {
    navigate('/settings/appearance/thinking-process');
  };

  const handleNavigateToInputBox = () => {
    navigate('/settings/appearance/input-box');
  };

  // 性能监控开关处理函数
  const handlePerformanceMonitorChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setShowPerformanceMonitor(event.target.checked));
  };

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
              backgroundImage: 'linear-gradient(90deg, #9333EA, #754AB4)',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            外观设置
          </Typography>
        </Toolbar>
      </AppBar>

      <Box
        ref={containerRef}
        onScroll={handleScroll}
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
        {/* 主题和字体设置 */}
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
              主题和字体
            </Typography>
            <Typography variant="body2" color="text.secondary">
              自定义应用的外观主题和全局字体大小设置
            </Typography>
          </Box>

          <Divider />

          <Box sx={{ p: 2 }}>
            {/* 主题选择 */}
            <FormControl fullWidth variant="outlined" sx={{ mb: 3 }}>
              <InputLabel>主题</InputLabel>
              <Select
                value={settings.theme}
                onChange={(e) => dispatch(setTheme(e.target.value as 'light' | 'dark' | 'system'))}
                label="主题"
                MenuProps={{
                  disableAutoFocus: true,
                  disableRestoreFocus: true
                }}
                sx={{
                  '& .MuiSelect-select': {
                    fontSize: { xs: '0.9rem', sm: '1rem' },
                  },
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderRadius: 2,
                  },
                }}
              >
                <MenuItem value="light">浅色</MenuItem>
                <MenuItem value="dark">深色</MenuItem>
                <MenuItem value="system">跟随系统</MenuItem>
              </Select>
              <FormHelperText>
                选择应用的外观主题，跟随系统将自动适配设备的深色/浅色模式
              </FormHelperText>
            </FormControl>

            {/* 主题风格选择器 */}
            <Box sx={{ mb: 3 }}>
              <ThemeStyleSelector compact />
            </Box>

          {/* 全局字体大小控制 */}
          <Box sx={{ mb: 2 }}>
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              mb: 2
            }}>
              <Typography
                variant="body1"
                sx={{
                  fontWeight: 500,
                  fontSize: { xs: '0.9rem', sm: '1rem' },
                }}
              >
                全局字体大小
              </Typography>
              <Chip
                label={`${settings.fontSize}px (${getCurrentFontSizeLabel(settings.fontSize)})`}
                size="small"
                color="primary"
                variant="outlined"
                sx={{
                  fontSize: { xs: '0.7rem', sm: '0.75rem' },
                  fontWeight: 500,
                }}
              />
            </Box>

            <Slider
              value={settings.fontSize}
              min={12}
              max={24}
              step={1}
              onChange={handleFontSizeChange}
              valueLabelDisplay="auto"
              valueLabelFormat={(value) => `${value}px`}
              marks={fontSizePresets.map(preset => ({
                value: preset.value,
                label: preset.label
              }))}
              sx={{
                '& .MuiSlider-thumb': {
                  width: { xs: 20, sm: 24 },
                  height: { xs: 20, sm: 24 },
                  '&:hover': {
                    boxShadow: '0 0 0 8px rgba(147, 51, 234, 0.16)',
                  },
                },
                '& .MuiSlider-track': {
                  background: 'linear-gradient(90deg, #9333EA, #754AB4)',
                },
                '& .MuiSlider-rail': {
                  opacity: 0.3,
                },
                '& .MuiSlider-mark': {
                  backgroundColor: 'currentColor',
                  height: 8,
                  width: 2,
                  '&.MuiSlider-markActive': {
                    backgroundColor: 'currentColor',
                  },
                },
                '& .MuiSlider-markLabel': {
                  fontSize: { xs: '0.65rem', sm: '0.75rem' },
                  color: 'text.secondary',
                  transform: 'translateX(-50%)',
                  top: { xs: 28, sm: 32 },
                },
                '& .MuiSlider-valueLabel': {
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  background: 'linear-gradient(45deg, #9333EA, #754AB4)',
                },
              }}
            />

            <FormHelperText sx={{ mt: 1, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
              调整应用中所有文本的基础字体大小，影响聊天消息、界面文字等全局显示效果
            </FormHelperText>
          </Box>

          {/* 全局字体选择 */}
          <Box sx={{ mb: 2 }}>
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              mb: 2
            }}>
              <Typography
                variant="body1"
                sx={{
                  fontWeight: 500,
                  fontSize: { xs: '0.9rem', sm: '1rem' },
                }}
              >
                全局字体
              </Typography>
              <Chip
                label={getCurrentFontLabel(settings.fontFamily || 'system')}
                size="small"
                color="secondary"
                variant="outlined"
                sx={{
                  fontSize: { xs: '0.7rem', sm: '0.75rem' },
                  fontWeight: 500,
                }}
              />
            </Box>

            <FormControl fullWidth variant="outlined">
              <InputLabel>字体</InputLabel>
              <Select
                value={settings.fontFamily || 'system'}
                onChange={handleFontFamilyChange}
                label="字体"
                MenuProps={{
                  disableAutoFocus: true,
                  disableRestoreFocus: true,
                  PaperProps: {
                    style: {
                      maxHeight: 300,
                    },
                  },
                }}
                sx={{
                  '& .MuiSelect-select': {
                    fontSize: { xs: '0.9rem', sm: '1rem' },
                  },
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderRadius: 2,
                  },
                }}
              >
                {Object.entries(fontCategoryLabels).map(([category, label]) => [
                  <MenuItem key={`category-${category}`} disabled sx={{
                    fontWeight: 600,
                    color: 'primary.main',
                    fontSize: '0.875rem',
                    opacity: '1 !important'
                  }}>
                    {label}
                  </MenuItem>,
                  ...fontOptions
                    .filter(font => font.category === category)
                    .map(font => (
                      <MenuItem
                        key={font.id}
                        value={font.id}
                        sx={{
                          fontFamily: font.fontFamily.join(', '),
                          pl: 3,
                          '&:hover': {
                            bgcolor: 'action.hover',
                          }
                        }}
                      >
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {font.name}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{
                              display: 'block',
                              fontFamily: font.fontFamily.join(', '),
                              mt: 0.5
                            }}
                          >
                            {font.preview}
                          </Typography>
                        </Box>
                      </MenuItem>
                    ))
                ]).flat()}
              </Select>
              <FormHelperText sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                选择应用的全局字体，将影响所有界面文字的显示效果
              </FormHelperText>
            </FormControl>
          </Box>
          </Box>
        </Paper>

        {/* 界面定制选项 */}
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
              界面定制
            </Typography>
            <Typography variant="body2" color="text.secondary">
              自定义聊天界面、消息气泡和工具栏的外观设置
            </Typography>
          </Box>

          <Divider />

          <List disablePadding>
            {/* 1. 顶部工具栏设置 */}
            <ListItem disablePadding>
              <ListItemButton
                onClick={handleNavigateToTopToolbar}
                sx={{
                  transition: 'all 0.2s',
                  '&:hover': {
                    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.05),
                  }
                }}
              >
                <ListItemAvatar>
                  <Avatar sx={{
                    bgcolor: alpha('#10b981', 0.12),
                    color: '#10b981',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.05)'
                  }}>
                    <Wrench size={20} />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={<Typography sx={{ fontWeight: 600, color: 'text.primary' }}>顶部工具栏设置</Typography>}
                  secondary="自定义顶部工具栏的组件和布局，支持拖拽DIY布局"
                />
                <ChevronRight size={20} style={{ color: 'var(--mui-palette-text-secondary)' }} />
              </ListItemButton>
            </ListItem>

            <Divider variant="inset" component="li" sx={{ ml: 0 }} />

            {/* 2. 聊天界面设置 */}
            <ListItem disablePadding>
              <ListItemButton
                onClick={handleNavigateToChatInterface}
                sx={{
                  transition: 'all 0.2s',
                  '&:hover': {
                    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.05),
                  }
                }}
              >
                <ListItemAvatar>
                  <Avatar sx={{
                    bgcolor: alpha('#6366f1', 0.12),
                    color: '#6366f1',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.05)'
                  }}>
                    <MessageSquare size={20} />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={<Typography sx={{ fontWeight: 600, color: 'text.primary' }}>聊天界面设置</Typography>}
                  secondary="自定义聊天界面布局和显示选项"
                />
                <ChevronRight size={20} style={{ color: 'var(--mui-palette-text-secondary)' }} />
              </ListItemButton>
            </ListItem>

            <Divider variant="inset" component="li" sx={{ ml: 0 }} />

            {/* 3. 思考过程设置 */}
            <ListItem disablePadding>
              <ListItemButton
                onClick={handleNavigateToThinkingProcess}
                sx={{
                  transition: 'all 0.2s',
                  '&:hover': {
                    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.05),
                  }
                }}
              >
                <ListItemAvatar>
                  <Avatar sx={{
                    bgcolor: alpha('#f59e0b', 0.12),
                    color: '#f59e0b',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.05)'
                  }}>
                    <Brain size={20} />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={<Typography sx={{ fontWeight: 600, color: 'text.primary' }}>思考过程设置</Typography>}
                  secondary="自定义AI思考过程的显示方式和自动折叠行为"
                />
                <ChevronRight size={20} style={{ color: 'var(--mui-palette-text-secondary)' }} />
              </ListItemButton>
            </ListItem>

            <Divider variant="inset" component="li" sx={{ ml: 0 }} />

            {/* 4. 信息气泡管理 */}
            <ListItem disablePadding>
              <ListItemButton
                onClick={handleNavigateToMessageBubble}
                sx={{
                  transition: 'all 0.2s',
                  '&:hover': {
                    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.05),
                  }
                }}
              >
                <ListItemAvatar>
                  <Avatar sx={{
                    bgcolor: alpha('#8b5cf6', 0.12),
                    color: '#8b5cf6',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.05)'
                  }}>
                    <MessageCircle size={20} />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={<Typography sx={{ fontWeight: 600, color: 'text.primary' }}>信息气泡管理</Typography>}
                  secondary="调整消息气泡的样式和宽度设置"
                />
                <ChevronRight size={20} style={{ color: 'var(--mui-palette-text-secondary)' }} />
              </ListItemButton>
            </ListItem>

            <Divider variant="inset" component="li" sx={{ ml: 0 }} />

            {/* 5. 输入框工具栏设置 */}
            <ListItem disablePadding>
              <ListItemButton
                onClick={handleNavigateToToolbarCustomization}
                sx={{
                  transition: 'all 0.2s',
                  '&:hover': {
                    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.05),
                  }
                }}
              >
                <ListItemAvatar>
                  <Avatar sx={{
                    bgcolor: alpha('#06b6d4', 0.12),
                    color: '#06b6d4',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.05)'
                  }}>
                    <Wrench size={20} />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={<Typography sx={{ fontWeight: 600, color: 'text.primary' }}>输入框工具栏设置</Typography>}
                  secondary="自定义输入框工具栏的背景样式和外观效果"
                />
                <ChevronRight size={20} style={{ color: 'var(--mui-palette-text-secondary)' }} />
              </ListItemButton>
            </ListItem>

            <Divider variant="inset" component="li" sx={{ ml: 0 }} />

            {/* 6. 输入框管理设置 */}
            <ListItem disablePadding>
              <ListItemButton
                onClick={handleNavigateToInputBox}
                sx={{
                  transition: 'all 0.2s',
                  '&:hover': {
                    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.05),
                  }
                }}
              >
                <ListItemAvatar>
                  <Avatar sx={{
                    bgcolor: alpha('#ec4899', 0.12),
                    color: '#ec4899',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.05)'
                  }}>
                    <MessageSquare size={20} />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={<Typography sx={{ fontWeight: 600, color: 'text.primary' }}>输入框管理设置</Typography>}
                  secondary="自定义输入框的风格和布局样式"
                />
                <ChevronRight size={20} style={{ color: 'var(--mui-palette-text-secondary)' }} />
              </ListItemButton>
            </ListItem>
          </List>
        </Paper>

        {/* 开发者工具 */}
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
              开发者工具
            </Typography>
            <Typography variant="body2" color="text.secondary">
              用于调试和性能监控的开发者工具设置
            </Typography>
          </Box>

          <Divider />

          <Box sx={{ p: 3 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={settings.showPerformanceMonitor || false}
                  onChange={handlePerformanceMonitorChange}
                  color="primary"
                />
              }
              label={
                <Box>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    显示性能监控
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    在聊天界面显示实时性能监控面板，包括FPS、滚动事件、渲染时间和内存使用情况
                  </Typography>
                </Box>
              }
              sx={{
                alignItems: 'flex-start',
                '& .MuiFormControlLabel-label': {
                  mt: 0.5
                }
              }}
            />
          </Box>
        </Paper>
      </Box>
    </Box>
  );
};

export default AppearanceSettings;
