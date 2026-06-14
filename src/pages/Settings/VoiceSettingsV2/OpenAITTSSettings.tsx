import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  AppBar,
  Toolbar,
  IconButton,
  Alert,
  Button,
  FormControlLabel,
  Divider
} from '@mui/material';
import {
  ArrowLeft,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { TTSManager, type OpenAITTSConfig } from '../../../shared/services/tts-v2';
import { getStorageItem, setStorageItem } from '../../../shared/utils/storage';
import { cssVar } from '../../../shared/utils/cssVariables';
import {
  OpenAITTSTab,
  type OpenAITTSSettings as OpenAITTSSettingsType,
} from '../../../components/TTS';
import TTSTestSection from '../../../components/TTS/TTSTestSection';
import CustomSwitch from '../../../components/CustomSwitch';
import { useTranslation } from '../../../i18n';
import { SafeAreaContainer } from '../../../components/settings/SettingComponents';
import Scrollbar from '../../../components/Scrollbar';
import { createLogger } from '../../../shared/services/infra/logger';

const logger = createLogger('OpenAITTSSettings');

const OpenAITTSSettings: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const ttsManager = useMemo(() => TTSManager.getInstance(), []);
  
  // 定时器引用
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const playCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 状态管理
  const [settings, setSettings] = useState<OpenAITTSSettingsType>({
    apiKey: '',
    showApiKey: false,
    selectedModel: 'tts-1',
    selectedVoice: 'alloy',
    selectedFormat: 'mp3',
    speed: 1.0,
    useStream: false,
  });

  const [uiState, setUIState] = useState({
    isSaved: false,
    saveError: '',
    isTestPlaying: false,
  });

  const [testText, setTestText] = useState('');
  const [enableTTS, setEnableTTS] = useState(true);
  const [isEnabled, setIsEnabled] = useState(false);

  // 加载设置
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const storedOpenaiApiKey = await getStorageItem<string>('openai_tts_api_key') || '';
        const storedOpenaiModel = await getStorageItem<string>('openai_tts_model') || 'tts-1';
        const storedOpenaiVoice = await getStorageItem<string>('openai_tts_voice') || 'alloy';
        const storedOpenaiFormat = await getStorageItem<string>('openai_tts_format') || 'mp3';
        const storedOpenaiSpeed = Number(await getStorageItem<string>('openai_tts_speed') || '1.0');
        const storedUseOpenaiStream = (await getStorageItem<string>('openai_tts_stream')) === 'true';
        const storedEnableTTS = (await getStorageItem<string>('enable_tts')) !== 'false';
        const storedSelectedTTSService = await getStorageItem<string>('selected_tts_service') || 'siliconflow';

        setSettings({
          apiKey: storedOpenaiApiKey,
          showApiKey: false,
          selectedModel: storedOpenaiModel,
          selectedVoice: storedOpenaiVoice,
          selectedFormat: storedOpenaiFormat,
          speed: storedOpenaiSpeed,
          useStream: storedUseOpenaiStream,
        });

        setEnableTTS(storedEnableTTS);
        setIsEnabled(storedSelectedTTSService === 'openai');

        // 设置 TTSManager
        ttsManager.configureEngine('openai', {
          enabled: true,
          apiKey: storedOpenaiApiKey,
          model: storedOpenaiModel,
          voice: storedOpenaiVoice,
          speed: storedOpenaiSpeed,
          responseFormat: storedOpenaiFormat
        } as Partial<OpenAITTSConfig>);
        
        // 加载测试文本
        const defaultTestText = t('settings.voice.openai.testText');
        setTestText(defaultTestText);
      } catch (error) {
        logger.error(t('settings.voice.common.loadingError', { service: 'OpenAI TTS' }), error);
      }
    };

    loadSettings();
  }, [ttsManager, t]);

  // 保存设置
  const handleSave = useCallback(async () => {
    try {
      await setStorageItem('openai_tts_api_key', settings.apiKey);
      await setStorageItem('openai_tts_model', settings.selectedModel);
      await setStorageItem('openai_tts_voice', settings.selectedVoice);
      await setStorageItem('openai_tts_format', settings.selectedFormat);
      await setStorageItem('openai_tts_speed', settings.speed.toString());
      await setStorageItem('openai_tts_stream', settings.useStream.toString());
      await setStorageItem('enable_tts', enableTTS.toString());
      await setStorageItem('use_capacitor_tts', 'false');

      // 只有启用时才设置为当前服务
      if (isEnabled) {
        await setStorageItem('selected_tts_service', 'openai');
        await setStorageItem('use_openai_tts', 'true');
        // 禁用其他TTS服务
        await setStorageItem('use_azure_tts', 'false');
      } else {
        await setStorageItem('use_openai_tts', 'false');
      }

      // 更新 TTSManager
      ttsManager.configureEngine('openai', {
        enabled: true,
        apiKey: settings.apiKey,
        model: settings.selectedModel,
        voice: settings.selectedVoice,
        speed: settings.speed,
        responseFormat: settings.selectedFormat
      } as Partial<OpenAITTSConfig>);

      if (isEnabled) {
        await setStorageItem('selected_tts_service', 'openai');
        await setStorageItem('use_openai_tts', 'true');
        await setStorageItem('use_azure_tts', 'false');
        await setStorageItem('use_capacitor_tts', 'false');
        
        ttsManager.setActiveEngine('openai');
      } else {
        await setStorageItem('use_openai_tts', 'false');
        ttsManager.configureEngine('openai', { enabled: false });
      }

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // 保存成功后返回上级页面
      setTimeout(() => {
        navigate('/settings/voice');
      }, 0);


    } catch (error) {
      logger.error(t('settings.voice.common.saveErrorText', { service: 'OpenAI TTS' }), error);
      setUIState(prev => ({
        ...prev,
        saveError: t('settings.voice.common.saveError'),
      }));
    }
  }, [settings, enableTTS, isEnabled, ttsManager, navigate, t]);

  // 处理启用状态变化
  const handleEnableChange = useCallback((enabled: boolean) => {
    setIsEnabled(enabled);
  }, []);

  // 测试TTS
  const handleTestTTS = useCallback(async () => {
    if (uiState.isTestPlaying) {
      ttsManager.stop();
      if (playCheckIntervalRef.current) {
        clearInterval(playCheckIntervalRef.current);
      }
      setUIState(prev => ({ ...prev, isTestPlaying: false }));
      return;
    }

    if (!settings.apiKey) {
      setUIState(prev => ({ ...prev, saveError: t('settings.voice.common.apiKeyRequired') }));
      return;
    }

    setUIState(prev => ({ ...prev, isTestPlaying: true }));

    // 设置为使用 OpenAI TTS
    ttsManager.configureEngine('openai', {
      enabled: true,
      apiKey: settings.apiKey,
      model: settings.selectedModel,
      voice: settings.selectedVoice,
      speed: settings.speed,
      responseFormat: settings.selectedFormat
    } as Partial<OpenAITTSConfig>);
    ttsManager.setActiveEngine('openai');

    const success = await ttsManager.speak(testText);
    if (!success) {
      setUIState(prev => ({ ...prev, isTestPlaying: false }));
      return;
    }

    const checkPlaybackStatus = () => {
      if (!ttsManager.isPlaying) {
        setUIState(prev => ({ ...prev, isTestPlaying: false }));
        if (playCheckIntervalRef.current) {
          clearInterval(playCheckIntervalRef.current);
        }
      }
    };
    
    playCheckIntervalRef.current = setInterval(checkPlaybackStatus, 100);
  }, [settings, testText, ttsManager, uiState.isTestPlaying, t]);

  const handleBack = () => {
    navigate('/settings/voice');
  };

  // 清理定时器
  useEffect(() => {
    const saveTimeout = saveTimeoutRef.current;
    const playCheckInterval = playCheckIntervalRef.current;
    const autoSaveTimeout = autoSaveTimeoutRef.current;
    return () => {
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }
      if (playCheckInterval) {
        clearInterval(playCheckInterval);
      }
      if (autoSaveTimeout) {
        clearTimeout(autoSaveTimeout);
      }
      if (uiState.isTestPlaying) {
        ttsManager.stop();
      }
    };
  }, [uiState.isTestPlaying, ttsManager]);

  // 获取主题变量
  const toolbarBg = cssVar('toolbar-bg');
  const toolbarBorder = cssVar('toolbar-border');
  const toolbarShadow = cssVar('toolbar-shadow');
  const textPrimary = cssVar('text-primary');
  const borderDefault = cssVar('border-default');
  const borderSubtle = cssVar('border-subtle');
  const hoverBg = cssVar('hover-bg');
  const bgPaper = cssVar('bg-paper');
  const bgDefault = cssVar('bg-default');
  const primaryColor = cssVar('primary');

  return (
    <SafeAreaContainer sx={{
      width: '100vw',
      overflow: 'hidden',
      backgroundColor: bgDefault,
    }}>
      {/* 顶部导航栏 */}
      <AppBar
        position="static"
        elevation={0}
        sx={{
          backgroundColor: toolbarBg,
          color: textPrimary,
          borderBottom: `1px solid ${toolbarBorder}`,
          boxShadow: `0 18px 40px -24px ${toolbarShadow}`,
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
          transition: 'background-color 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease',
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 56, sm: 64 }, px: { xs: 1.5, sm: 2.5, md: 4 }, gap: { xs: 1, sm: 1.5 } }}>
          <IconButton
            edge="start"
            onClick={handleBack}
            aria-label={t('settings.voice.back')}
            size="large"
            sx={{
              color: primaryColor,
              mr: { xs: 1, sm: 2 },
              borderRadius: 2,
              border: `1px solid ${borderSubtle}`,
              transition: 'all 0.2s ease',
              '&:hover': {
                backgroundColor: hoverBg,
                transform: 'translateY(-1px)',
              },
              '&:focus-visible': {
                outline: `2px solid ${primaryColor}`,
                outlineOffset: '2px',
              },
            }}
          >
            <ArrowLeft size={20} />
          </IconButton>
          <Typography
            variant="h6"
            component="div"
            sx={{
              flexGrow: 1,
              fontWeight: 700,
              letterSpacing: '0.03em',
              textTransform: 'uppercase',
            }}
          >
            {t('settings.voice.openai.title')}
          </Typography>
          <Button
            onClick={handleSave}
            variant="contained"
            sx={{
              borderRadius: 2,
              px: { xs: 2.5, sm: 3 },
              py: { xs: 0.9, sm: 1 },
              fontWeight: 700,
            }}
          >
            {t('settings.voice.common.save')}
          </Button>
        </Toolbar>
      </AppBar>

      {/* 可滚动的内容区域 */}
      <Scrollbar
        style={{
          flex: 1,
          paddingTop: '16px',
          paddingBottom: 'var(--content-bottom-padding)',
          paddingLeft: '16px',
          paddingRight: '16px',
        }}
      >
        <Box sx={{ maxWidth: 960, mx: 'auto', width: '100%' }}>
          {/* 保存结果提示 */}
          {uiState.isSaved && (
            <Alert
              severity="success"
              sx={{
                mb: { xs: 1.5, sm: 2 },
                borderRadius: { xs: 1, sm: 2 },
              }}
            >
              {t('settings.voice.common.saveSuccess')}
            </Alert>
          )}

          {uiState.saveError && (
            <Alert
              severity="error"
              sx={{
                mb: { xs: 1.5, sm: 2 },
                borderRadius: { xs: 1, sm: 2 },
              }}
            >
              {uiState.saveError}
            </Alert>
          )}

          {/* 配置区域 */}
          <Paper
            elevation={0}
            sx={{
              p: { xs: 2.5, sm: 3 },
              mb: { xs: 2, sm: 3 },
              borderRadius: { xs: 2, sm: 2.5 },
              border: `1px solid ${borderDefault}`,
              bgcolor: bgPaper,
              boxShadow: `0 18px 40px -28px ${toolbarShadow}`,
            }}
          >
            <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
              {t('settings.voice.common.apiConfig')}
            </Typography>

            {/* 启用开关 */}
            <Box sx={{ mb: 3 }}>
              <FormControlLabel
                control={
                  <CustomSwitch
                    checked={isEnabled}
                    onChange={(e) => handleEnableChange(e.target.checked)}
                  />
                }
                label={t('settings.voice.common.enableService', { name: t('settings.voice.services.openai.name') })}
              />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1, ml: 4 }}>
                {t('settings.voice.openai.enableDesc')}
              </Typography>
            </Box>

            <Divider sx={{ mb: 3 }} />

            <OpenAITTSTab
              settings={settings}
              onSettingsChange={setSettings}
            />
          </Paper>

          {/* 测试区域 */}
          <TTSTestSection
            testText={testText}
            setTestText={setTestText}
            handleTestTTS={handleTestTTS}
            isTestPlaying={uiState.isTestPlaying}
            enableTTS={enableTTS}
            selectedTTSService="openai"
            openaiApiKey={settings.apiKey}
            azureApiKey=""
            siliconFlowApiKey=""
          />
        </Box>
      </Scrollbar>
    </SafeAreaContainer>
  );
};

export default OpenAITTSSettings;
