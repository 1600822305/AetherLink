import React, { useState, useEffect, useMemo } from 'react';
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
  TextField,
  InputAdornment,
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
  Button,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions
} from '@mui/material';
import BackButtonDialog from '../../components/common/BackButtonDialog';
import { ArrowLeft, ChevronRight, ChevronRight as ChevronRightIcon, MessageSquare, MessageCircle, Palette, LayoutDashboard, Edit3, Sparkles, Share2, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../../shared/store';
import { setTheme, setFontSize, setFontFamily, setShowPerformanceMonitor, setShowDevToolsFloatingButton, updateSettings } from '../../shared/store/settingsSlice';
import { 
  fontCategoryLabels, 
  getFontByIdSync, 
  getAllFontOptions, 
  loadFont,
  type FontOption
} from '../../shared/config/fonts';
import { 
  addCustomFontFromFile, 
  removeCustomFont,
  getCustomFonts,
  loadSavedCustomFonts
} from '../../shared/services/ui/GoogleFontsService';
import useScrollPosition from '../../hooks/useScrollPosition';
import { useLanguageSettings } from '../../i18n/useLanguageSettings';
import { supportedLanguages } from '../../i18n';
import { Globe } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { createLogger } from '../../shared/services/infra/logger';

const logger = createLogger('AppearanceSettings');
import { SafeAreaContainer } from '../../components/settings/SettingComponents';
import Scrollbar from '../../components/Scrollbar';
import CustomSwitch from '../../components/CustomSwitch';
import ShareAppearanceDialog from '../../components/dialogs/ShareAppearanceDialog';
import ImportAppearanceDialog from '../../components/dialogs/ImportAppearanceDialog';
import { extractAppearanceConfig, extractShareConfigFromUrl } from '../../shared/utils/appearanceConfig';
import type { AppearanceConfig } from '../../shared/utils/appearanceConfig';
import FullScreenSelectorSolid, { type SelectorGroup } from '../../components/TTS/FullScreenSelectorSolid';

const AppearanceSettings: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const settings = useAppSelector((state) => state.settings);
  const { currentLanguage, changeLanguage } = useLanguageSettings();
  const { t } = useTranslation();

  // 对话框状态
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [pendingConfig, setPendingConfig] = useState<AppearanceConfig | null>(null);
  
  // 字体全屏选择器状态
  const [fontSelectorOpen, setFontSelectorOpen] = useState(false);
  const [fontOptions, setFontOptions] = useState<FontOption[]>([]);
  const [fontsLoading, setFontsLoading] = useState(false);
  
  // 自定义字体文件输入
  const fontFileInputRef = React.useRef<HTMLInputElement>(null);
  
  // 刷新字体列表
  const refreshFontOptions = async () => {
    setFontsLoading(true);
    try {
      // 确保自定义字体已加载
      await loadSavedCustomFonts();
      const fonts = await getAllFontOptions();
      setFontOptions(fonts);
    } catch (err) {
      logger.error('加载字体列表失败:', err);
    } finally {
      setFontsLoading(false);
    }
  };
  
  // 异步加载 Google Fonts 列表
  useEffect(() => {
    if (fontSelectorOpen && fontOptions.length === 0 && !fontsLoading) {
      refreshFontOptions();
    }
  }, [fontSelectorOpen, fontOptions.length, fontsLoading]);
  
  // 处理自定义字体文件选择
  const handleFontFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    try {
      const customFont = await addCustomFontFromFile(file);
      if (customFont) {
        // 刷新字体列表
        await refreshFontOptions();
        // 自动选择新添加的字体
        dispatch(setFontFamily(customFont.id));
      }
    } catch (error: any) {
      alert(error.message || '添加字体失败');
    }
    
    // 清空 input 以便再次选择同一文件
    event.target.value = '';
  };
  
  // 删除自定义字体
  const handleRemoveCustomFont = async (fontId: string) => {
    const success = await removeCustomFont(fontId);
    if (success) {
      // 如果删除的是当前字体，切换回系统默认
      if (settings.fontFamily === fontId) {
        dispatch(setFontFamily('system'));
      }
      // 刷新字体列表
      await refreshFontOptions();
    }
  };
  
  // 将字体选项转换为 SelectorGroup 格式
  const fontGroups: SelectorGroup[] = useMemo(() => {
    if (fontOptions.length === 0) {
      return [{ name: '加载中...', items: [] }];
    }
    
    // 获取自定义字体 ID 列表
    const customFontIds = new Set(getCustomFonts().map(f => f.id));
    
    return Object.entries(fontCategoryLabels).map(([category, label]) => ({
      name: label,
      items: fontOptions
        .filter(font => font.category === category)
        .map(font => ({
          key: font.id,
          label: font.name,
          subLabel: font.preview,
          // 自定义字体标记为可删除
          deletable: customFontIds.has(font.id),
        })),
    })).filter(group => group.items.length > 0);
  }, [fontOptions]);

  // 使用滚动位置保存功能
  const {
    containerRef,
    handleScroll
  } = useScrollPosition('settings-appearance', {
    autoRestore: true,
    restoreDelay: 100
  });

  // 检查 URL 中是否有分享配置
  useEffect(() => {
    const sharedConfig = extractShareConfigFromUrl();
    if (sharedConfig) {
      setPendingConfig(sharedConfig);
      setConfirmDialogOpen(true);
      // 清除 URL 参数
      window.history.replaceState({}, '', window.location.pathname + window.location.hash.split('?')[0]);
    }
  }, []);

  const handleBack = () => {
    navigate('/settings');
  };

  // 分享外观设置
  const handleShareAppearance = () => {
    setShareDialogOpen(true);
  };

  // 导入外观设置
  const handleImportAppearance = () => {
    setImportDialogOpen(true);
  };

  // 应用导入的配置
  const handleApplyConfig = (config: AppearanceConfig) => {
    setPendingConfig(config);
    setConfirmDialogOpen(true);
  };

  // 确认应用配置
  const handleConfirmApply = () => {
    if (pendingConfig) {
      dispatch(updateSettings(pendingConfig));
      setConfirmDialogOpen(false);
      setPendingConfig(null);
    }
  };

  // 取消应用配置
  const handleCancelApply = () => {
    setConfirmDialogOpen(false);
    setPendingConfig(null);
  };

  // 字体大小处理函数
  const handleFontSizeChange = (_: Event, newValue: number | number[]) => {
    dispatch(setFontSize(newValue as number));
  };

  // 全屏选择器字体选择处理
  const handleFontSelect = async (key: string) => {
    // 先加载字体
    await loadFont(key);
    // 再设置字体
    dispatch(setFontFamily(key));
  };

  // 字体大小预设值
  const fontSizePresets = [
    { value: 12, label: t('settings.appearance.fontSize.presets.12') },
    { value: 14, label: t('settings.appearance.fontSize.presets.14') },
    { value: 16, label: t('settings.appearance.fontSize.presets.16') },
    { value: 18, label: t('settings.appearance.fontSize.presets.18') },
    { value: 20, label: t('settings.appearance.fontSize.presets.20') },
    { value: 24, label: t('settings.appearance.fontSize.presets.24') }
  ];

  // 获取当前字体大小的描述
  const getCurrentFontSizeLabel = (fontSize: number) => {
    const preset = fontSizePresets.find(p => p.value === fontSize);
    return preset ? preset.label : t('settings.appearance.fontSize.custom');
  };

  // 获取当前字体的描述
  const getCurrentFontLabel = (fontId: string) => {
    // 优先从已加载的字体列表中查找
    const loadedFont = fontOptions.find(f => f.id === fontId);
    if (loadedFont) return loadedFont.name;
    
    // 同步获取静态字体
    const staticFont = getFontByIdSync(fontId);
    if (staticFont) return staticFont.name;
    
    // 如果是 Google Font，将 ID 转换为显示名称
    if (fontId && fontId !== 'system') {
      return fontId.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }
    
    return t('settings.appearance.fontFamily.systemDefault') as string;
  };

  const handleNavigateToChatInterface = () => {
    navigate('/settings/appearance/chat-interface');
  };

  const handleNavigateToTopToolbar = () => {
    navigate('/settings/appearance/top-toolbar');
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

  const handleNavigateToThemeStyle = () => {
    navigate('/settings/appearance/theme-style');
  };

  // 性能监控开关处理函数
  const handlePerformanceMonitorChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setShowPerformanceMonitor(event.target.checked));
  };

  // 开发者工具悬浮窗开关处理函数
  const handleDevToolsFloatingButtonChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setShowDevToolsFloatingButton(event.target.checked));
  };

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
            }}
          >
            {t('settings.appearance.title')}
          </Typography>
          <IconButton
            color="inherit"
            onClick={handleImportAppearance}
            aria-label="import"
            sx={{
              color: (theme) => theme.palette.primary.main,
              mr: 1,
            }}
          >
            <Upload size={20} />
          </IconButton>
          <IconButton
            color="inherit"
            onClick={handleShareAppearance}
            aria-label="share"
            sx={{
              color: (theme) => theme.palette.primary.main,
            }}
          >
            <Share2 size={20} />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Scrollbar
        ref={containerRef}
        onScroll={handleScroll}
        style={{
          flexGrow: 1,
          padding: '16px',
          paddingBottom: 'var(--content-bottom-padding)',
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
              {t('settings.appearance.themeAndFont.title')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('settings.appearance.themeAndFont.description')}
            </Typography>
          </Box>

          <Divider />

          <Box sx={{ p: 2 }}>
            {/* 主题选择 */}
            <FormControl fullWidth variant="outlined" sx={{ mb: 3 }}>
              <InputLabel>{t('settings.appearance.theme.label')}</InputLabel>
              <Select
                value={settings.theme}
                onChange={(e) => dispatch(setTheme(e.target.value as 'light' | 'dark' | 'system'))}
                label={t('settings.appearance.theme.label')}
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
                <MenuItem value="light">{t('settings.light')}</MenuItem>
                <MenuItem value="dark">{t('settings.dark')}</MenuItem>
                <MenuItem value="system">{t('settings.system')}</MenuItem>
              </Select>
              <FormHelperText>
                {t('settings.appearance.theme.helperText')}
              </FormHelperText>
            </FormControl>

            {/* 语言选择 */}
            <FormControl fullWidth variant="outlined" sx={{ mb: 3 }}>
              <InputLabel>{t('settings.appearance.language.label')}</InputLabel>
              <Select
                value={currentLanguage}
                onChange={(e) => changeLanguage(e.target.value)}
                label={t('settings.appearance.language.label')}
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
                {supportedLanguages.map((lang) => (
                  <MenuItem key={lang.code} value={lang.code}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Globe size={16} />
                      <Typography>{lang.nativeName}</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                        {lang.name}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>
                {t('settings.appearance.language.helperText')}
              </FormHelperText>
            </FormControl>

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
                {t('settings.appearance.fontSize.label')}
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
              {t('settings.appearance.fontSize.helperText')}
            </FormHelperText>
          </Box>

          {/* 全局字体选择 - 点击打开全屏选择器 */}
          <Box sx={{ mb: 2 }}>
            <TextField
              fullWidth
              label={t('settings.appearance.fontFamily.label')}
              value={getCurrentFontLabel(settings.fontFamily || 'system')}
              onClick={() => setFontSelectorOpen(true)}
              sx={{ 
                cursor: 'pointer',
                '& .MuiOutlinedInput-notchedOutline': {
                  borderRadius: 2,
                },
              }}
              helperText={t('settings.appearance.fontFamily.helperText')}
              InputProps={{
                readOnly: true,
                endAdornment: (
                  <InputAdornment position="end">
                    <ChevronRightIcon size={18} />
                  </InputAdornment>
                ),
                sx: { cursor: 'pointer' }
              }}
            />
            
            {/* 添加自定义字体按钮 */}
            <Button
              variant="outlined"
              size="small"
              onClick={() => fontFileInputRef.current?.click()}
              sx={{ mt: 1 }}
            >
              添加本地字体
            </Button>
            
            {/* 隐藏的文件输入 */}
            <input
              ref={fontFileInputRef}
              type="file"
              accept=".ttf,.otf,.woff,.woff2"
              style={{ display: 'none' }}
              onChange={handleFontFileSelect}
            />
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
              {t('settings.appearance.customization.title')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('settings.appearance.customization.description')}
            </Typography>
          </Box>

          <Divider />

          <List disablePadding>
            {/* 1. 主题风格设置 */}
            <ListItem disablePadding>
              <ListItemButton
                onClick={handleNavigateToThemeStyle}
                sx={{
                  transition: 'all 0.2s',
                  '&:hover': {
                    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.05),
                  }
                }}
              >
                <ListItemAvatar>
                  <Avatar sx={{
                    bgcolor: alpha('#9333EA', 0.12),
                    color: '#9333EA',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.05)'
                  }}>
                    <Palette size={20} />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={<Typography sx={{ fontWeight: 600, color: 'text.primary' }}>{t('settings.appearance.themeStyle.title')}</Typography>}
                  secondary={t('settings.appearance.themeStyle.navigationDescription')}
                  primaryTypographyProps={{ component: 'div' }}
                />
                <ChevronRight size={20} style={{ color: 'var(--mui-palette-text-secondary)' }} />
              </ListItemButton>
            </ListItem>

            <Divider variant="inset" component="li" sx={{ ml: 0 }} />

            {/* 2. 顶部工具栏设置 */}
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
                    <LayoutDashboard size={20} />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={<Typography sx={{ fontWeight: 600, color: 'text.primary' }}>{t('settings.appearance.topToolbar.title')}</Typography>}
                  secondary={t('settings.appearance.topToolbar.description')}
                  primaryTypographyProps={{ component: 'div' }}
                />
                <ChevronRight size={20} style={{ color: 'var(--mui-palette-text-secondary)' }} />
              </ListItemButton>
            </ListItem>

            <Divider variant="inset" component="li" sx={{ ml: 0 }} />

            {/* 3. 聊天界面设置 */}
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
                  primary={<Typography sx={{ fontWeight: 600, color: 'text.primary' }}>{t('settings.appearance.chatInterface.title')}</Typography>}
                  secondary={t('settings.appearance.chatInterface.description')}
                  primaryTypographyProps={{ component: 'div' }}
                />
                <ChevronRight size={20} style={{ color: 'var(--mui-palette-text-secondary)' }} />
              </ListItemButton>
            </ListItem>

            <Divider variant="inset" component="li" sx={{ ml: 0 }} />

            {/* 4. 思考过程设置 */}
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
                    <Sparkles size={20} />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={<Typography sx={{ fontWeight: 600, color: 'text.primary' }}>{t('settings.appearance.thinkingProcess.title')}</Typography>}
                  secondary={t('settings.appearance.thinkingProcess.description')}
                  primaryTypographyProps={{ component: 'div' }}
                />
                <ChevronRight size={20} style={{ color: 'var(--mui-palette-text-secondary)' }} />
              </ListItemButton>
            </ListItem>

            <Divider variant="inset" component="li" sx={{ ml: 0 }} />

            {/* 5. 信息气泡管理 */}
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
                  primary={<Typography sx={{ fontWeight: 600, color: 'text.primary' }}>{t('settings.appearance.messageBubble.title')}</Typography>}
                  secondary={t('settings.appearance.messageBubble.description')}
                  primaryTypographyProps={{ component: 'div' }}
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
                    <Edit3 size={20} />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={<Typography sx={{ fontWeight: 600, color: 'text.primary' }}>{t('settings.appearance.inputBox.title')}</Typography>}
                  secondary={t('settings.appearance.inputBox.description')}
                  primaryTypographyProps={{ component: 'div' }}
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
              {t('settings.appearance.developerTools.title')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('settings.appearance.developerTools.description')}
            </Typography>
          </Box>

          <Divider />

          <Box sx={{ p: 3 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 2,
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography 
                  variant="body1" 
                  sx={{ 
                    fontWeight: 500,
                    mb: 0.5,
                    fontSize: { xs: '0.9rem', sm: '1rem' }
                  }}
                >
                  {t('settings.appearance.developerTools.performanceMonitor.title')}
                </Typography>
                <Typography 
                  variant="body2" 
                  color="text.secondary"
                  sx={{
                    fontSize: { xs: '0.8rem', sm: '0.875rem' },
                    lineHeight: 1.5
                  }}
                >
                  {t('settings.appearance.developerTools.performanceMonitor.description')}
                </Typography>
              </Box>
              <Box sx={{ flexShrink: 0, pt: 0.5 }}>
                <CustomSwitch
                  checked={settings.showPerformanceMonitor || false}
                  onChange={handlePerformanceMonitorChange}
                />
              </Box>
            </Box>

            <Divider sx={{ my: 2 }} />

            <Box
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 2,
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  variant="body1"
                  sx={{
                    fontWeight: 500,
                    mb: 0.5,
                    fontSize: { xs: '0.9rem', sm: '1rem' }
                  }}
                >
                  {t('settings.appearance.developerTools.floatingButton.title')}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{
                    fontSize: { xs: '0.8rem', sm: '0.875rem' },
                    lineHeight: 1.5
                  }}
                >
                  {t('settings.appearance.developerTools.floatingButton.description')}
                </Typography>
              </Box>
              <Box sx={{ flexShrink: 0, pt: 0.5 }}>
                <CustomSwitch
                  checked={settings.showDevToolsFloatingButton || false}
                  onChange={handleDevToolsFloatingButtonChange}
                />
              </Box>
            </Box>
          </Box>
        </Paper>
      </Scrollbar>

      {/* 分享外观设置对话框 */}
      <ShareAppearanceDialog
        open={shareDialogOpen}
        onClose={() => setShareDialogOpen(false)}
        config={extractAppearanceConfig(settings)}
      />

      {/* 导入外观设置对话框 */}
      <ImportAppearanceDialog
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        onImport={handleApplyConfig}
      />

      {/* 确认应用配置对话框 */}
      <BackButtonDialog
        open={confirmDialogOpen}
        onClose={handleCancelApply}
        maxWidth="sm"
        PaperProps={{
          sx: {
            borderRadius: 3,
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 600 }}>
          确认应用外观设置
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            你确定要应用这个外观配置吗？这将覆盖你当前的外观设置。
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCancelApply} variant="text">
            取消
          </Button>
          <Button onClick={handleConfirmApply} variant="contained" autoFocus>
            确认应用
          </Button>
        </DialogActions>
      </BackButtonDialog>

      {/* 字体全屏选择器 */}
      <FullScreenSelectorSolid
        open={fontSelectorOpen}
        onClose={() => setFontSelectorOpen(false)}
        title={t('settings.appearance.fontFamily.label') as string}
        groups={fontGroups}
        selectedKey={settings.fontFamily || 'system'}
        onSelect={(key) => handleFontSelect(key)}
        onDelete={handleRemoveCustomFont}
      />
    </SafeAreaContainer>
  );
};

export default AppearanceSettings;
