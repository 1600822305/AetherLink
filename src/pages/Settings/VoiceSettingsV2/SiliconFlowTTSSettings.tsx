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
  ArrowLeft
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { TTSManager, type SiliconFlowTTSConfig } from '../../../shared/services/tts-v2';
import { getStorageItem, setStorageItem } from '../../../shared/utils/storage';
import { cssVar } from '../../../shared/utils/cssVariables';
import {
  SiliconFlowTTSTab,
  type SiliconFlowTTSSettings as SiliconFlowTTSSettingsType,
} from '../../../components/TTS';
import TTSTestSection from '../../../components/TTS/TTSTestSection';
import CustomSwitch from '../../../components/CustomSwitch';
import { useTranslation } from '../../../i18n';
import { SafeAreaContainer } from '../../../components/settings/SettingComponents';
import Scrollbar from '../../../components/Scrollbar';
import { createLogger } from '../../../shared/services/infra/logger';

const logger = createLogger('SiliconFlowTTSSettings');

const SiliconFlowTTSSettings: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const ttsManager = useMemo(() => TTSManager.getInstance(), []);
  
  // 定时器引用
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const playCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 状态管理
  const [settings, setSettings] = useState<SiliconFlowTTSSettingsType>({
    apiKey: '',
    showApiKey: false,
    selectedModel: 'FunAudioLLM/CosyVoice2-0.5B',
    selectedVoice: 'alex',
    useStream: false,
    // MOSS-TTSD 默认值
    speed: 1,
    gain: 0,
    maxTokens: 1600,
  });

  const [uiState, setUIState] = useState({
    saveError: '',
    isTestPlaying: false,
  });

  const [testText, setTestText] = useState('');
  const [enableTTS, setEnableTTS] = useState(true);
  const [isEnabled, setIsEnabled] = useState(false); // 是否启用此TTS服务

  // 加载设置
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const storedApiKey = await getStorageItem<string>('siliconflow_api_key') || '';
        const storedModel = await getStorageItem<string>('tts_model') || 'FunAudioLLM/CosyVoice2-0.5B';
        const storedVoice = await getStorageItem<string>('tts_voice') || 'alex';
        const storedUseStream = (await getStorageItem<string>('siliconflow_tts_stream')) === 'true';
        const storedEnableTTS = (await getStorageItem<string>('enable_tts')) !== 'false';
        const storedSelectedTTSService = await getStorageItem<string>('selected_tts_service') || 'siliconflow';
        // MOSS-TTSD 专用配置
        const storedSpeed = parseFloat(await getStorageItem<string>('siliconflow_tts_speed') || '1');
        const storedGain = parseFloat(await getStorageItem<string>('siliconflow_tts_gain') || '0');
        const storedMaxTokens = parseInt(await getStorageItem<string>('siliconflow_tts_max_tokens') || '1600');

        setSettings({
          apiKey: storedApiKey,
          showApiKey: false,
          selectedModel: storedModel,
          selectedVoice: storedVoice,
          useStream: storedUseStream,
          speed: storedSpeed,
          gain: storedGain,
          maxTokens: storedMaxTokens,
        });

        setEnableTTS(storedEnableTTS);
        setIsEnabled(storedSelectedTTSService === 'siliconflow');

        // 设置 TTSManager - 根据模型类型配置不同参数
        const isIndexTTS2 = storedModel === 'IndexTeam/IndexTTS-2';
        const isMossTTSD = storedModel === 'fnlp/MOSS-TTSD-v0.5';
        const hasAdvancedParams = isMossTTSD || isIndexTTS2;
        
        ttsManager.configureEngine('siliconflow', {
          enabled: true,
          apiKey: storedApiKey,
          model: storedModel,
          voice: `${storedModel}:${storedVoice}`,
          useStream: storedUseStream,
          // 高级参数仅对 IndexTTS-2 和 MOSS-TTSD 有效
          ...(hasAdvancedParams && {
            speed: storedSpeed,
            gain: storedGain,
            maxTokens: storedMaxTokens,
          }),
        } as Partial<SiliconFlowTTSConfig>);
        
        // 加载测试文本
        const defaultTestText = t('settings.voice.siliconflow.testText');
        setTestText(defaultTestText);
      } catch (error) {
        logger.error(t('settings.voice.common.loadingError', { service: 'SiliconFlow TTS' }), error);
      }
    };

    loadSettings();
  }, [ttsManager, t]);

  // 保存配置
  const saveConfig = useCallback(async (): Promise<boolean> => {
    try {
      // 验证必要字段
      if (isEnabled && !settings.apiKey.trim()) {
        setUIState(prev => ({
          ...prev,
          saveError: t('settings.voice.siliconflow.apiKeyRequired'),
        }));
        return false;
      }

      // 保存设置到存储
      await setStorageItem('siliconflow_api_key', settings.apiKey);
      await setStorageItem('tts_model', settings.selectedModel);
      await setStorageItem('tts_voice', settings.selectedVoice);
      await setStorageItem('siliconflow_tts_stream', settings.useStream.toString());
      await setStorageItem('enable_tts', enableTTS.toString());
      await setStorageItem('use_capacitor_tts', 'false');
      // MOSS-TTSD 专用配置
      await setStorageItem('siliconflow_tts_speed', (settings.speed ?? 1).toString());
      await setStorageItem('siliconflow_tts_gain', (settings.gain ?? 0).toString());
      await setStorageItem('siliconflow_tts_max_tokens', (settings.maxTokens ?? 1600).toString());

      // 只有启用时才设置为当前服务
      if (isEnabled) {
        await setStorageItem('selected_tts_service', 'siliconflow');
        await setStorageItem('use_siliconflow_tts', 'true');
        await setStorageItem('use_openai_tts', 'false');
        await setStorageItem('use_azure_tts', 'false');
        await setStorageItem('use_capacitor_tts', 'false');
        
        ttsManager.setActiveEngine('siliconflow');
      } else {
        await setStorageItem('use_siliconflow_tts', 'false');
        ttsManager.configureEngine('siliconflow', { enabled: false });
      }

      // 清除错误信息
      setUIState(prev => ({
        ...prev,
        saveError: '',
      }));

      return true;
    } catch (error) {
      logger.error(t('settings.voice.common.saveErrorText', { service: 'SiliconFlow TTS' }), error);
      setUIState(prev => ({
        ...prev,
        saveError: t('settings.voice.common.saveError'),
      }));
      return false;
    }
  }, [settings, enableTTS, isEnabled, ttsManager, t]);

  // 手动保存
  const handleSave = useCallback(async () => {
    const success = await saveConfig();
    if (success) {
      // 保存成功后返回上级页面
      setTimeout(() => {
        navigate('/settings/voice');
      }, 0);
    }
  }, [saveConfig, navigate]);

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

    // 设置为使用 SiliconFlow TTS - 根据模型类型配置不同参数
    const isIndexTTS2 = settings.selectedModel === 'IndexTeam/IndexTTS-2';
    const isMossTTSD = settings.selectedModel === 'fnlp/MOSS-TTSD-v0.5';
    const hasAdvancedParams = isMossTTSD || isIndexTTS2;
    
    ttsManager.configureEngine('siliconflow', {
      enabled: true,
      apiKey: settings.apiKey,
      model: settings.selectedModel,
      voice: `${settings.selectedModel}:${settings.selectedVoice}`,
      useStream: settings.useStream,
      // 高级参数仅对 IndexTTS-2 和 MOSS-TTSD 有效
      ...(hasAdvancedParams && {
        speed: settings.speed ?? 1,
        gain: settings.gain ?? 0,
        maxTokens: settings.maxTokens ?? 1600,
      }),
    } as Partial<SiliconFlowTTSConfig>);
    ttsManager.setActiveEngine('siliconflow');

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
            {t('settings.voice.siliconflow.title')}
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
          {/* 错误提示 */}
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
                label={t('settings.voice.common.enableService', { name: t('settings.voice.services.siliconflow.name') })}
              />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1, ml: 4 }}>
                {t('settings.voice.siliconflow.enableDesc')}
              </Typography>
            </Box>

            <Divider sx={{ mb: 3 }} />

            <SiliconFlowTTSTab
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
            selectedTTSService="siliconflow"
            openaiApiKey=""
            azureApiKey=""
            siliconFlowApiKey={settings.apiKey}
          />
        </Box>
      </Scrollbar>
    </SafeAreaContainer>
  );
};

export default SiliconFlowTTSSettings;
