import React from 'react';
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  AppBar,
  Toolbar,
  IconButton,
  Divider,
} from '@mui/material';
import { ArrowLeft, Trash2, Camera, Video, BookOpen, Search, Plus, Wrench, Image, FileText, ArrowLeftRight, Send, Mic } from 'lucide-react';
import { CustomIcon } from '../../components/icons';
import { useNavigate } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../../shared/store';
import { updateSettings } from '../../shared/store/settingsSlice';
import DraggableButtonConfig from '../../components/DraggableButtonConfig';
import { IntegratedChatInput } from '../../components/input';
import { useTranslation } from '../../i18n';
import { SafeAreaContainer, CARD_STYLES } from '../../components/settings/SettingComponents';
import Scrollbar from '../../components/Scrollbar';
import { createLogger } from '../../shared/services/infra/logger';

const logger = createLogger('InputBoxSettings');

// 输入框预览组件 - 模仿真实聊天页面布局
const InputBoxPreview: React.FC<{
  inputBoxStyle: string;
}> = () => {
  const { t } = useTranslation();

  // 通用预览阻止函数
  const preventAction = (actionName: string) => () => {
    logger.debug(`预览模式：阻止${actionName}`);
  };

  // 预览用的空函数
  const previewProps = {
    onSendMessage: preventAction('发送消息'),
    onSendImagePrompt: preventAction('图像生成'),
    isLoading: false,
    allowConsecutiveMessages: false,
    imageGenerationMode: false,
    videoGenerationMode: false,
    webSearchActive: false,
    onStopResponse: preventAction('停止响应'),
    isStreaming: false,
    isDebating: false,
    toolsEnabled: false,
    availableModels: [],
    onClearTopic: preventAction('清空话题'),
    onNewTopic: preventAction('新建话题'),
    toggleImageGenerationMode: preventAction('切换图像生成模式'),
    toggleVideoGenerationMode: preventAction('切换视频生成模式'),
    toggleWebSearch: preventAction('切换网络搜索'),
    toggleToolsEnabled: preventAction('切换工具启用状态'),
    onToolsEnabledChange: preventAction('工具启用状态变更'),
  };

  return (
    <Box
      sx={{
        // 模仿真实聊天页面的容器结构
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        maxWidth: '100%',
        position: 'relative',
        // 移除居中对齐和padding限制
        alignItems: 'stretch',
        p: 0,
        bgcolor: 'action.hover',
        borderRadius: 2,
        minHeight: '100px',
        overflow: 'hidden',
      }}
    >
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1, px: 1.5, pt: 1.5, fontSize: '0.8rem' }}>
        {t('settings.appearance.inputBox.preview.label')}
      </Typography>
      {/* 移除所有宽度限制，让输入框组件使用自己的响应式布局 */}
      <Box
        sx={{
          width: '100%',
          maxWidth: '100%',
          position: 'relative',
        }}
      >
        <IntegratedChatInput {...previewProps} />
      </Box>
    </Box>
  );
};

const InputBoxSettings: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const settings = useAppSelector((state) => state.settings);
  
  // 获取可用的自定义按钮配置
  const getAvailableButtons = () => [
    {
      id: 'tools',
      label: t('settings.appearance.inputBox.buttons.tools.label'),
      icon: () => <CustomIcon name="settingsPanel" size={20} />,
      description: t('settings.appearance.inputBox.buttons.tools.description'),
      color: '#4CAF50'
    },
    {
      id: 'mcp-tools',
      label: t('settings.appearance.inputBox.buttons.mcpTools.label'),
      icon: Wrench,
      description: t('settings.appearance.inputBox.buttons.mcpTools.description'),
      color: '#4CAF50'
    },
    {
      id: 'clear',
      label: t('settings.appearance.inputBox.buttons.clear.label'),
      icon: Trash2,
      description: t('settings.appearance.inputBox.buttons.clear.description'),
      color: 'currentColor'
    },
    {
      id: 'image',
      label: t('settings.appearance.inputBox.buttons.image.label'),
      icon: Camera,
      description: t('settings.appearance.inputBox.buttons.image.description'),
      color: '#9C27B0'
    },
    {
      id: 'video',
      label: t('settings.appearance.inputBox.buttons.video.label'),
      icon: Video,
      description: t('settings.appearance.inputBox.buttons.video.description'),
      color: '#E91E63'
    },
    {
      id: 'knowledge',
      label: t('settings.appearance.inputBox.buttons.knowledge.label'),
      icon: BookOpen,
      description: t('settings.appearance.inputBox.buttons.knowledge.description'),
      color: '#059669'
    },
    {
      id: 'search',
      label: t('settings.appearance.inputBox.buttons.search.label'),
      icon: Search,
      description: t('settings.appearance.inputBox.buttons.search.description'),
      color: '#3B82F6'
    },
    {
      id: 'upload',
      label: t('settings.appearance.inputBox.buttons.upload.label'),
      icon: Plus,
      description: t('settings.appearance.inputBox.buttons.upload.description'),
      color: '#F59E0B'
    },
    {
      id: 'camera',
      label: t('settings.appearance.inputBox.buttons.camera.label'),
      icon: Camera,
      description: t('settings.appearance.inputBox.buttons.camera.description'),
      color: '#9C27B0'
    },
    {
      id: 'photo-select',
      label: t('settings.appearance.inputBox.buttons.photoSelect.label'),
      icon: Image,
      description: t('settings.appearance.inputBox.buttons.photoSelect.description'),
      color: '#1976D2'
    },
    {
      id: 'file-upload',
      label: t('settings.appearance.inputBox.buttons.fileUpload.label'),
      icon: FileText,
      description: t('settings.appearance.inputBox.buttons.fileUpload.description'),
      color: '#4CAF50'
    },
    {
      id: 'ai-debate',
      label: t('settings.appearance.inputBox.buttons.aiDebate.label'),
      icon: () => <CustomIcon name="aiDebate" size={20} />,
      description: t('settings.appearance.inputBox.buttons.aiDebate.description'),
      color: '#2196F3'
    },
    {
      id: 'quick-phrase',
      label: t('settings.appearance.inputBox.buttons.quickPhrase.label'),
      icon: () => <CustomIcon name="quickPhrase" size={20} />,
      description: t('settings.appearance.inputBox.buttons.quickPhrase.description'),
      color: '#9C27B0'
    },
    {
      id: 'multi-model',
      label: t('settings.appearance.inputBox.buttons.multiModel.label'),
      icon: ArrowLeftRight,
      description: t('settings.appearance.inputBox.buttons.multiModel.description'),
      color: 'currentColor'
    },
    {
      id: 'send',
      label: t('settings.appearance.inputBox.buttons.send.label'),
      icon: Send,
      description: t('settings.appearance.inputBox.buttons.send.description'),
      color: 'currentColor'
    },
    {
      id: 'voice',
      label: t('settings.appearance.inputBox.buttons.voice.label'),
      icon: Mic,
      description: t('settings.appearance.inputBox.buttons.voice.description'),
      color: 'currentColor'
    }
  ];
  
  const AVAILABLE_BUTTONS = getAvailableButtons();

  // 获取输入框相关设置
  const inputBoxStyle = settings.inputBoxStyle || 'default';

  // 新的左右布局配置
  const leftButtons = (settings as any).integratedInputLeftButtons || ['tools', 'clear', 'search'];
  const rightButtons = (settings as any).integratedInputRightButtons || ['upload', 'voice', 'send'];

  const handleBack = () => {
    navigate('/settings/appearance');
  };

  // 事件处理函数
  const handleInputBoxStyleChange = (event: { target: { value: any } }) => {
    dispatch(updateSettings({
      inputBoxStyle: event.target.value
    }));
  };




  // 处理左右布局更新
  const handleLayoutUpdate = (newLeftButtons: string[], newRightButtons: string[]) => {
    dispatch(updateSettings({
      integratedInputLeftButtons: newLeftButtons,
      integratedInputRightButtons: newRightButtons,
      // 同时更新旧的配置以保持兼容性
      integratedInputButtons: [...newLeftButtons, ...newRightButtons]
    } as any));
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
            <ArrowLeft size={20} />
          </IconButton>
          <Typography
            variant="h6"
            component="div"
              sx={{
                flexGrow: 1,
                fontWeight: 600,
              }}
            >
            {t('settings.appearance.inputBox.title')}
          </Typography>
        </Toolbar>
      </AppBar>

      <Scrollbar
        style={{
          flexGrow: 1,
          padding: '16px',
          paddingBottom: 'var(--content-bottom-padding)',
        }}
      >
        {/* 实时预览区域 */}
        <Paper elevation={0} sx={{ ...CARD_STYLES.base, p: 0, overflow: 'hidden' }}>
          <Typography variant="subtitle1" sx={{ mb: 1, p: 1.5, pb: 0, fontWeight: 600, fontSize: '0.95rem' }}>
            {t('settings.appearance.inputBox.preview.title')}
          </Typography>
          <InputBoxPreview inputBoxStyle={inputBoxStyle} />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, textAlign: 'center', p: 1.5, pt: 0, fontSize: '0.8rem' }}>
            {t('settings.appearance.inputBox.preview.currentConfig')} {t(`settings.appearance.inputBox.preview.styles.${inputBoxStyle}`)}
          </Typography>

          {/* 集成样式自定义按钮配置 - 拖拽式配置 */}
          <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #eee' }}>
            <Typography variant="subtitle1" sx={{ mb: 1, px: 1.5 }}>
              {t('settings.appearance.inputBox.preview.buttonLayout.title')}
            </Typography>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, px: 1.5 }}>
              {t('settings.appearance.inputBox.preview.buttonLayout.description')}
            </Typography>

            <DraggableButtonConfig
              availableButtons={AVAILABLE_BUTTONS}
              leftButtons={leftButtons}
              rightButtons={rightButtons}
              onUpdateLayout={handleLayoutUpdate}
            />

            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, px: 1.5, pb: 2 }}>
              {t('settings.appearance.inputBox.preview.buttonLayout.summary', { left: leftButtons.length, right: rightButtons.length })}
            </Typography>
          </Box>
        </Paper>

        <Divider sx={{ mb: 1.5 }} />

        {/* 输入框风格设置 */}
        <Paper elevation={0} sx={{ ...CARD_STYLES.base, p: 1.5 }}>
          <Typography variant="subtitle1" sx={{ mb: 1.5, fontWeight: 600, fontSize: '0.95rem' }}>
            {t('settings.appearance.inputBox.style.title')}
          </Typography>

          <FormControl fullWidth variant="outlined" sx={{ mb: 1.5 }} size="small">
            <InputLabel>{t('settings.appearance.inputBox.style.label')}</InputLabel>
            <Select
              value={inputBoxStyle}
              onChange={handleInputBoxStyleChange}
              label={t('settings.appearance.inputBox.style.label')}
              MenuProps={{
                disableAutoFocus: true,
                disableRestoreFocus: true,
                autoFocus: false,
                disablePortal: true
              }}
            >
              <MenuItem value="default">{t('settings.appearance.inputBox.style.default')}</MenuItem>
              <MenuItem value="modern">{t('settings.appearance.inputBox.style.modern')}</MenuItem>
              <MenuItem value="minimal">{t('settings.appearance.inputBox.style.minimal')}</MenuItem>
            </Select>
          </FormControl>

          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontSize: '0.8rem', lineHeight: 1.5 }}>
            {t('settings.appearance.inputBox.style.description')}
            <br />{t('settings.appearance.inputBox.style.defaultDesc')}
            <br />{t('settings.appearance.inputBox.style.modernDesc')}
            <br />{t('settings.appearance.inputBox.style.minimalDesc')}
          </Typography>
        </Paper>




        {/* 底部间距 */}
        <Box sx={{ height: '20px' }} />
      </Scrollbar>
    </SafeAreaContainer>
  );
};

export default InputBoxSettings;
