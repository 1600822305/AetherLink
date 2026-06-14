import React, { useState, useRef } from 'react';
import {
  Box,
  Typography,
  FormControl,
  Select,
  MenuItem,
  Paper,
  Tooltip,
  IconButton,
  AppBar,
  Toolbar,
  alpha,
  Slider,
  Alert,
  Card,
  CardMedia,
  Collapse,
  useTheme,
  Stack
} from '@mui/material';
import CustomSwitch from '../../components/CustomSwitch';
import { ArrowLeft, Info, X, Image as ImageIcon, Layout, MessageSquare, Quote, FileText, Image } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../../shared/store';
import { updateSettings } from '../../shared/store/settingsSlice';
import {
  validateImageFile,
  compressImage,
  cleanupBackgroundImage
} from '../../shared/utils/backgroundUtils';
import useScrollPosition from '../../hooks/useScrollPosition';
import { useTranslation } from '../../i18n';
import { createLogger } from '../../shared/services/infra/logger';

const logger = createLogger('ChatInterfaceSettings');
import { SafeAreaContainer } from '../../components/settings/SettingComponents';
import Scrollbar from '../../components/Scrollbar';

const ChatInterfaceSettings: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const theme = useTheme();
  const settings = useAppSelector((state) => state.settings);

  // 使用滚动位置保存功能
  const {
    containerRef,
    handleScroll
  } = useScrollPosition('settings-chat-interface', {
    autoRestore: true,
    restoreDelay: 100
  });

  // 本地状态
  const [uploadError, setUploadError] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 获取所有设置项
  const multiModelDisplayStyle = (settings as any).multiModelDisplayStyle || 'horizontal';
  const showToolDetails = (settings as any).showToolDetails !== false;
  const showCitationDetails = (settings as any).showCitationDetails !== false;
  const showSystemPromptBubble = settings.showSystemPromptBubble !== false;

  // 背景设置
  const chatBackground = settings.chatBackground || {
    enabled: false,
    imageUrl: '',
    opacity: 0.7, // 默认透明度70% - 直接控制背景图
    size: 'cover',
    position: 'center',
    repeat: 'no-repeat',
    showOverlay: true, // 默认显示遮罩
  };

  const handleBack = () => {
    navigate('/settings/appearance');
  };

  // 事件处理函数
  const handleMultiModelDisplayStyleChange = (event: { target: { value: any } }) => {
    dispatch(updateSettings({
      multiModelDisplayStyle: event.target.value
    }));
  };

  const handleShowToolDetailsChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(updateSettings({
      showToolDetails: event.target.checked
    }));
  };

  const handleShowCitationDetailsChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(updateSettings({
      showCitationDetails: event.target.checked
    }));
  };

  const handleSystemPromptBubbleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(updateSettings({
      showSystemPromptBubble: event.target.checked
    }));
  };

  // 背景设置事件处理函数
  const handleBackgroundEnabledChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(updateSettings({
      chatBackground: {
        ...chatBackground,
        enabled: event.target.checked
      }
    }));
  };

  const handleBackgroundOpacityChange = (_event: Event, newValue: number | number[]) => {
    dispatch(updateSettings({
      chatBackground: {
        ...chatBackground,
        opacity: newValue as number
      }
    }));
  };

  const handleBackgroundSizeChange = (event: { target: { value: any } }) => {
    dispatch(updateSettings({
      chatBackground: {
        ...chatBackground,
        size: event.target.value
      }
    }));
  };

  const handleBackgroundPositionChange = (event: { target: { value: any } }) => {
    dispatch(updateSettings({
      chatBackground: {
        ...chatBackground,
        position: event.target.value
      }
    }));
  };

  const handleBackgroundRepeatChange = (event: { target: { value: any } }) => {
    dispatch(updateSettings({
      chatBackground: {
        ...chatBackground,
        repeat: event.target.value
      }
    }));
  };

  const handleShowOverlayChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(updateSettings({
      chatBackground: {
        ...chatBackground,
        showOverlay: event.target.checked
      }
    }));
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadError('');
    setIsUploading(true);

    try {
      // 验证文件
      const validation = validateImageFile(file, t);
      if (!validation.valid) {
        setUploadError(validation.error || t('settings.appearance.chatInterface.background.errors.validationFailed'));
        return;
      }

      // 压缩并转换为数据URL
      const dataUrl = await compressImage(file);

      // 清理旧的背景图片
      if (chatBackground.imageUrl) {
        cleanupBackgroundImage(chatBackground.imageUrl);
      }

      // 更新设置
      dispatch(updateSettings({
        chatBackground: {
          ...chatBackground,
          imageUrl: dataUrl,
          enabled: true // 上传后自动启用
        }
      }));

    } catch (error) {
      setUploadError(t('settings.appearance.chatInterface.background.errors.uploadFailed'));
      logger.error('Background upload error:', error);
    } finally {
      setIsUploading(false);
      // 清空文件输入
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveBackground = () => {
    if (chatBackground.imageUrl) {
      cleanupBackgroundImage(chatBackground.imageUrl);
    }

    dispatch(updateSettings({
      chatBackground: {
        ...chatBackground,
        imageUrl: '',
        enabled: false
      }
    }));
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  // 通用卡片样式
  const cardStyle = {
    mb: 2,
    p: 2.5,
    borderRadius: 3,
    border: '1px solid',
    borderColor: 'divider',
    bgcolor: 'background.paper',
    boxShadow: 'none', // 移除阴影，更扁平
    transition: 'all 0.2s ease-in-out',
    '&:hover': {
      borderColor: alpha(theme.palette.primary.main, 0.3),
      bgcolor: alpha(theme.palette.background.paper, 0.8),
    }
  };

  // 设置项行样式
  const settingRowStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 2
  };

  // 根据全局字体大小计算图标大小
  const getIconSize = (baseSize: number = 20) => {
    const scale = settings.fontSize / 16; // 16px 是基准字体大小
    return Math.round(baseSize * scale);
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
              mr: 1
            }}
          >
            <ArrowLeft size={getIconSize(20)} />
          </IconButton>
          <Typography
            variant="h6"
            component="div"
            sx={{
              flexGrow: 1,
              fontWeight: 600,
            }}
          >
            {t('settings.appearance.chatInterface.title')}
          </Typography>
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
        {/* 多模型对比显示设置 */}
        <Paper sx={cardStyle}>
          <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ 
              p: 1, 
              borderRadius: 2, 
              bgcolor: alpha(theme.palette.primary.main, 0.1),
              color: theme.palette.primary.main 
            }}>
              <Layout size={getIconSize(20)} />
            </Box>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="subtitle1" fontWeight={600}>
                  {t('settings.appearance.chatInterface.multiModel.title')}
                </Typography>
                <Tooltip title={t('settings.appearance.chatInterface.multiModel.tooltip')}>
                  <Info size={getIconSize(16)} className="text-gray-400 hover:text-gray-600 cursor-help" />
                </Tooltip>
              </Box>
              <Typography variant="body2" color="text.secondary">
                {t('settings.appearance.chatInterface.multiModel.description')}
              </Typography>
            </Box>
          </Box>

          <FormControl fullWidth variant="outlined" size="small">
            <Select
              value={multiModelDisplayStyle}
              onChange={handleMultiModelDisplayStyleChange}
              sx={{ borderRadius: 2 }}
            >
              <MenuItem value="horizontal">{t('settings.appearance.chatInterface.multiModel.horizontal')}</MenuItem>
              <MenuItem value="vertical">{t('settings.appearance.chatInterface.multiModel.vertical')}</MenuItem>
              <MenuItem value="single">{t('settings.appearance.chatInterface.multiModel.single')}</MenuItem>
            </Select>
          </FormControl>
        </Paper>

        {/* 开关类设置组 */}
        <Stack spacing={2} mb={3}>
          {/* 工具调用设置 */}
          <Paper sx={cardStyle}>
            <Box sx={settingRowStyle}>
              <Box sx={{ display: 'flex', gap: 2, flex: 1 }}>
                <Box sx={{ 
                  p: 1, 
                  height: 'fit-content',
                  borderRadius: 2, 
                  bgcolor: alpha('#6366f1', 0.1),
                  color: '#6366f1' 
                }}>
                  <MessageSquare size={getIconSize(20)} />
                </Box>
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="subtitle1" fontWeight={600}>
                      {t('settings.appearance.chatInterface.toolCall.title')}
                    </Typography>
                    <Tooltip title={t('settings.appearance.chatInterface.toolCall.tooltip')}>
                      <Info size={getIconSize(16)} className="text-gray-400 hover:text-gray-600 cursor-help" />
                    </Tooltip>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {t('settings.appearance.chatInterface.toolCall.description')}
                  </Typography>
                </Box>
              </Box>
              <CustomSwitch
                checked={showToolDetails}
                onChange={handleShowToolDetailsChange}
              />
            </Box>
          </Paper>

          {/* 引用设置 */}
          <Paper sx={cardStyle}>
            <Box sx={settingRowStyle}>
              <Box sx={{ display: 'flex', gap: 2, flex: 1 }}>
                <Box sx={{ 
                  p: 1, 
                  height: 'fit-content',
                  borderRadius: 2, 
                  bgcolor: alpha('#10b981', 0.1),
                  color: '#10b981' 
                }}>
                  <Quote size={getIconSize(20)} />
                </Box>
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="subtitle1" fontWeight={600}>
                      {t('settings.appearance.chatInterface.citation.title')}
                    </Typography>
                    <Tooltip title={t('settings.appearance.chatInterface.citation.tooltip')}>
                      <Info size={getIconSize(16)} className="text-gray-400 hover:text-gray-600 cursor-help" />
                    </Tooltip>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {t('settings.appearance.chatInterface.citation.description')}
                  </Typography>
                </Box>
              </Box>
              <CustomSwitch
                checked={showCitationDetails}
                onChange={handleShowCitationDetailsChange}
              />
            </Box>
          </Paper>

          {/* 系统提示词设置 */}
          <Paper sx={cardStyle}>
            <Box sx={settingRowStyle}>
              <Box sx={{ display: 'flex', gap: 2, flex: 1 }}>
                <Box sx={{ 
                  p: 1, 
                  height: 'fit-content',
                  borderRadius: 2, 
                  bgcolor: alpha('#f59e0b', 0.1),
                  color: '#f59e0b' 
                }}>
                  <FileText size={getIconSize(20)} />
                </Box>
                <Box>
                  <Typography variant="subtitle1" fontWeight={600}>
                    {t('settings.appearance.chatInterface.systemPrompt.title')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {t('settings.appearance.chatInterface.systemPrompt.description')}
                  </Typography>
                </Box>
              </Box>
              <CustomSwitch
                checked={showSystemPromptBubble}
                onChange={handleSystemPromptBubbleChange}
              />
            </Box>
          </Paper>
        </Stack>

        {/* 聊天背景设置 */}
        <Paper sx={cardStyle}>
          <Box sx={settingRowStyle}>
            <Box sx={{ display: 'flex', gap: 2, flex: 1 }}>
              <Box sx={{ 
                p: 1, 
                height: 'fit-content',
                borderRadius: 2, 
                bgcolor: alpha('#ec4899', 0.1),
                color: '#ec4899' 
              }}>
                <Image size={getIconSize(20)} />
              </Box>
              <Box>
                <Typography variant="subtitle1" fontWeight={600}>
                  {t('settings.appearance.chatInterface.background.title')}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {t('settings.appearance.chatInterface.background.description')}
                </Typography>
              </Box>
            </Box>
            <CustomSwitch
              checked={chatBackground.enabled}
              onChange={handleBackgroundEnabledChange}
            />
          </Box>
          
          <Collapse in={chatBackground.enabled}>
            <Box sx={{ mt: 3, pt: 3, borderTop: '1px dashed', borderColor: 'divider' }}>
              {/* 背景图片上传 */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
                  {t('settings.appearance.chatInterface.background.imageLabel')}
                </Typography>

                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  {chatBackground.imageUrl ? (
                    <Card sx={{ 
                      width: 200, 
                      position: 'relative',
                      borderRadius: 2,
                      overflow: 'visible',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                    }}>
                      <CardMedia
                        component="img"
                        height="120"
                        image={chatBackground.imageUrl}
                        alt="Preview"
                        sx={{ borderRadius: 2, objectFit: 'cover' }}
                      />
                      <IconButton
                        size="small"
                        onClick={handleRemoveBackground}
                        sx={{
                          position: 'absolute',
                          top: -8,
                          right: -8,
                          bgcolor: 'error.main',
                          color: 'white',
                          '&:hover': { bgcolor: 'error.dark' },
                          boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                        }}
                      >
                        <X size={getIconSize(14)} />
                      </IconButton>
                    </Card>
                  ) : (
                    <Box
                      onClick={handleUploadClick}
                      sx={{
                        width: '100%',
                        height: 120,
                        border: '2px dashed',
                        borderColor: 'divider',
                        borderRadius: 2,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        '&:hover': {
                          borderColor: 'primary.main',
                          bgcolor: alpha(theme.palette.primary.main, 0.02)
                        }
                      }}
                    >
                      <ImageIcon size={getIconSize(32)} style={{ color: theme.palette.text.secondary, marginBottom: 8 }} />
                      <Typography variant="body2" color="text.secondary" fontWeight={500}>
                        {isUploading ? t('settings.appearance.chatInterface.background.uploading') : t('settings.appearance.chatInterface.background.uploadHint')}
                      </Typography>
                      <Typography variant="caption" color="text.disabled">
                        {t('settings.appearance.chatInterface.background.uploadFormat')}
                      </Typography>
                    </Box>
                  )}
                </Box>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />

                {uploadError && (
                  <Alert severity="error" sx={{ mt: 2, borderRadius: 2 }}>
                    {uploadError}
                  </Alert>
                )}
              </Box>

              {/* 背景详细设置 */}
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 3 }}>
                {/* 透明度设置 */}
                <Box sx={{ gridColumn: '1 / -1' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="subtitle2" fontWeight={600}>
                      {t('settings.appearance.chatInterface.background.opacityLabel')}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" fontWeight={500}>
                      {Math.round(chatBackground.opacity * 100)}%
                    </Typography>
                  </Box>
                  <Slider
                    value={chatBackground.opacity}
                    onChange={handleBackgroundOpacityChange}
                    min={0.1}
                    max={1}
                    step={0.1}
                    marks={[
                      { value: 0.1, label: '10%' },
                      { value: 0.5, label: '50%' },
                      { value: 1, label: '100%' }
                    ]}
                  />
                </Box>

                {/* 遮罩开关 */}
                <Box sx={{ gridColumn: '1 / -1' }}>
                  <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    p: 2,
                    borderRadius: 2,
                    bgcolor: 'action.hover',
                  }}>
                    <Box>
                      <Typography variant="subtitle2" fontWeight={600}>
                        显示渐变遮罩
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        在背景上方添加白色渐变遮罩，提高文字可读性。关闭后可直接通过透明度控制背景
                      </Typography>
                    </Box>
                    <CustomSwitch
                      checked={chatBackground.showOverlay !== false}
                      onChange={handleShowOverlayChange}
                    />
                  </Box>
                </Box>

                {/* 背景尺寸 */}
                <FormControl fullWidth size="small">
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                    {t('settings.appearance.chatInterface.background.sizeLabel')}
                  </Typography>
                  <Select
                    value={chatBackground.size}
                    onChange={handleBackgroundSizeChange}
                    sx={{ borderRadius: 2 }}
                  >
                    {['cover', 'contain', 'auto'].map((value) => (
                      <MenuItem key={value} value={value}>
                        {t(`settings.appearance.chatInterface.background.presets.${value}.label`)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {/* 背景位置 */}
                <FormControl fullWidth size="small">
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                    {t('settings.appearance.chatInterface.background.positionLabel')}
                  </Typography>
                  <Select
                    value={chatBackground.position}
                    onChange={handleBackgroundPositionChange}
                    sx={{ borderRadius: 2 }}
                  >
                    {['center', 'top', 'bottom', 'left', 'right'].map((value) => (
                      <MenuItem key={value} value={value}>
                        {t(`settings.appearance.chatInterface.background.positions.${value}`)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {/* 背景重复 */}
                <FormControl fullWidth size="small">
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                    {t('settings.appearance.chatInterface.background.repeatLabel')}
                  </Typography>
                  <Select
                    value={chatBackground.repeat}
                    onChange={handleBackgroundRepeatChange}
                    sx={{ borderRadius: 2 }}
                  >
                    <MenuItem value="no-repeat">{t('settings.appearance.chatInterface.background.repeats.noRepeat')}</MenuItem>
                    <MenuItem value="repeat">{t('settings.appearance.chatInterface.background.repeats.repeat')}</MenuItem>
                    <MenuItem value="repeat-x">{t('settings.appearance.chatInterface.background.repeats.repeatX')}</MenuItem>
                    <MenuItem value="repeat-y">{t('settings.appearance.chatInterface.background.repeats.repeatY')}</MenuItem>
                  </Select>
                </FormControl>
              </Box>
            </Box>
          </Collapse>
        </Paper>

        {/* 底部间距 */}
        <Box sx={{ height: '40px' }} />
      </Scrollbar>
    </SafeAreaContainer>
  );
};

export default ChatInterfaceSettings;
