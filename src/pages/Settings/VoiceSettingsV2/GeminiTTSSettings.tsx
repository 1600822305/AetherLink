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
  Divider,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select
} from '@mui/material';
import {
  ArrowLeft,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { TTSManager, type GeminiTTSConfig } from '../../../shared/services/tts-v2';
import { getStorageItem, setStorageItem } from '../../../shared/utils/storage';
import TTSTestSection from '../../../components/TTS/TTSTestSection';
import CustomSwitch from '../../../components/CustomSwitch';
import { useTranslation } from '../../../i18n';
import { cssVar } from '../../../shared/utils/cssVariables';
import { SafeAreaContainer } from '../../../components/settings/SettingComponents';
import Scrollbar from '../../../components/Scrollbar';
import { createLogger } from '../../../shared/services/infra/logger';

const logger = createLogger('GeminiTTSSettings');
import type { GeminiVoiceName } from '../../../shared/types/voice';
import { GeminiVoiceDescriptions } from '../../../shared/types/voice';

interface GeminiTTSSettingsType {
  apiKey: string;
  showApiKey: boolean;
  model: 'gemini-2.5-flash-preview-tts' | 'gemini-2.5-pro-preview-tts';
  voice: GeminiVoiceName;
  stylePrompt: string;
  useMultiSpeaker: boolean;
  speakers: Array<{ speaker: string; voiceName: GeminiVoiceName }>;
}

const GeminiTTSSettings: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const ttsManager = useMemo(() => TTSManager.getInstance(), []);
  
  // 定时器引用
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const playCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 状态管理
  const [settings, setSettings] = useState<GeminiTTSSettingsType>({
    apiKey: '',
    showApiKey: false,
    model: 'gemini-2.5-flash-preview-tts',
    voice: 'Kore',
    stylePrompt: '',
    useMultiSpeaker: false,
    speakers: [
      { speaker: 'Speaker1', voiceName: 'Kore' },
      { speaker: 'Speaker2', voiceName: 'Puck' }
    ],
  });

  const [uiState, setUIState] = useState({
    isSaved: false,
    saveError: '',
    isTestPlaying: false,
  });

  const [testText, setTestText] = useState('你好，欢迎使用 Google Gemini TTS 服务！这是一个高质量的文本转语音系统。');
  const [enableTTS, setEnableTTS] = useState(true);
  const [isEnabled, setIsEnabled] = useState(false);

  // 加载设置
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const storedApiKey = await getStorageItem<string>('gemini_tts_api_key') || '';
        const storedModel = await getStorageItem<string>('gemini_tts_model') || 'gemini-2.5-flash-preview-tts';
        const storedVoice = await getStorageItem<string>('gemini_tts_voice') || 'Kore';
        const storedStylePrompt = await getStorageItem<string>('gemini_tts_style_prompt') || '';
        const storedUseMultiSpeaker = (await getStorageItem<string>('gemini_tts_multi_speaker')) === 'true';
        const storedSpeakers = await getStorageItem<Array<{ speaker: string; voiceName: GeminiVoiceName }>>('gemini_tts_speakers') || [
          { speaker: 'Speaker1', voiceName: 'Kore' as GeminiVoiceName },
          { speaker: 'Speaker2', voiceName: 'Puck' as GeminiVoiceName }
        ];
        const storedEnableTTS = (await getStorageItem<string>('enable_tts')) !== 'false';
        const storedSelectedTTSService = await getStorageItem<string>('selected_tts_service') || 'siliconflow';

        setSettings({
          apiKey: storedApiKey,
          showApiKey: false,
          model: storedModel as 'gemini-2.5-flash-preview-tts' | 'gemini-2.5-pro-preview-tts',
          voice: storedVoice as GeminiVoiceName,
          stylePrompt: storedStylePrompt,
          useMultiSpeaker: storedUseMultiSpeaker,
          speakers: storedSpeakers,
        });

        setEnableTTS(storedEnableTTS);
        setIsEnabled(storedSelectedTTSService === 'gemini');

        // 设置 TTSManager
        ttsManager.configureEngine('gemini', {
          enabled: true,
          apiKey: storedApiKey,
          model: storedModel,
          voice: storedVoice,
          stylePrompt: storedStylePrompt,
          useMultiSpeaker: storedUseMultiSpeaker,
          speakers: storedSpeakers
        } as Partial<GeminiTTSConfig>);
      } catch (error) {
        logger.error('加载 Gemini TTS 设置失败:', error);
      }
    };

    loadSettings();
  }, [ttsManager, t]);

  // 处理启用状态变更
  const handleEnableChange = useCallback((checked: boolean) => {
    setIsEnabled(checked);
  }, []);

  // 保存设置
  const handleSave = useCallback(async () => {
    try {
      await setStorageItem('gemini_tts_api_key', settings.apiKey);
      await setStorageItem('gemini_tts_model', settings.model);
      await setStorageItem('gemini_tts_voice', settings.voice);
      await setStorageItem('gemini_tts_style_prompt', settings.stylePrompt);
      await setStorageItem('gemini_tts_multi_speaker', settings.useMultiSpeaker.toString());
      await setStorageItem('gemini_tts_speakers', settings.speakers);
      await setStorageItem('enable_tts', enableTTS.toString());
      await setStorageItem('use_capacitor_tts', 'false');

      // 只有启用时才设置为当前服务
      if (isEnabled) {
        await setStorageItem('selected_tts_service', 'gemini');
        await setStorageItem('use_gemini_tts', 'true');
        // 禁用其他TTS服务
        await setStorageItem('use_openai_tts', 'false');
        await setStorageItem('use_azure_tts', 'false');
      }

      // 更新 TTSManager
      ttsManager.configureEngine('gemini', {
        enabled: true,
        apiKey: settings.apiKey,
        model: settings.model,
        voice: settings.voice,
        stylePrompt: settings.stylePrompt,
        useMultiSpeaker: settings.useMultiSpeaker,
        speakers: settings.speakers
      } as Partial<GeminiTTSConfig>);

      if (isEnabled) {
        await setStorageItem('selected_tts_service', 'gemini');
        await setStorageItem('use_gemini_tts', 'true');
        await setStorageItem('use_openai_tts', 'false');
        await setStorageItem('use_azure_tts', 'false');
        await setStorageItem('use_capacitor_tts', 'false');
        
        ttsManager.setActiveEngine('gemini');
      } else {
        await setStorageItem('use_gemini_tts', 'false');
        ttsManager.configureEngine('gemini', { enabled: false });
      }

      setUIState(prev => ({
        ...prev,
        isSaved: true,
        saveError: ''
      }));

      setTimeout(() => {
        navigate('/settings/voice');
      }, 500);
    } catch (error) {
      logger.error('保存 Gemini TTS 设置失败:', error);
      setUIState(prev => ({
        ...prev,
        isSaved: false,
        saveError: t('settings.voice.common.saveErrorText', { service: 'Gemini TTS' })
      }));
    }
  }, [settings, enableTTS, isEnabled, ttsManager, navigate, t]);

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

    // 设置为使用 Gemini TTS
    ttsManager.configureEngine('gemini', {
      enabled: true,
      apiKey: settings.apiKey,
      model: settings.model,
      voice: settings.voice,
      stylePrompt: settings.stylePrompt,
      useMultiSpeaker: settings.useMultiSpeaker,
      speakers: settings.speakers
    } as Partial<GeminiTTSConfig>);
    ttsManager.setActiveEngine('gemini');

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
      if (saveTimeout) clearTimeout(saveTimeout);
      if (playCheckInterval) clearInterval(playCheckInterval);
      if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
      if (uiState.isTestPlaying) {
        ttsManager.stop();
      }
    };
  }, [uiState.isTestPlaying, ttsManager]);

  // 所有30种语音选项
  const voiceOptions: GeminiVoiceName[] = [
    'Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir', 'Leda',
    'Orus', 'Aoede', 'Callirrhoe', 'Autonoe', 'Enceladus', 'Iapetus',
    'Umbriel', 'Algieba', 'Despina', 'Erinome', 'Algenib', 'Rasalgethi',
    'Laomedeia', 'Achernar', 'Alnilam', 'Schedar', 'Gacrux', 'Pulcherrima',
    'Achird', 'Zubenelgenubi', 'Vindemiatrix', 'Sadachbia', 'Sadaltager', 'Sulafat'
  ];

  // 获取主题变量
  const toolbarBg = cssVar('toolbar-bg');
  const toolbarBorder = cssVar('toolbar-border');
  const toolbarShadow = cssVar('toolbar-shadow');
  const textPrimary = cssVar('text-primary');
  const textSecondary = cssVar('text-secondary');
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
            Google Gemini TTS
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
                label={t('settings.voice.common.enableService', { name: 'Gemini TTS' })}
              />
              <Typography variant="body2" sx={{ mt: 1, ml: 4, color: textSecondary }}>
                {t('settings.voice.gemini.enableDesc')}
              </Typography>
            </Box>

            <Divider sx={{ mb: 3 }} />

            {/* API Key */}
            <TextField
              fullWidth
              label={t('settings.voice.gemini.apiKey')}
              type={settings.showApiKey ? 'text' : 'password'}
              value={settings.apiKey}
              onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
              sx={{ mb: 2 }}
              helperText={t('settings.voice.gemini.apiKeyHelp')}
            />

            <FormControlLabel
              control={
                <CustomSwitch
                  checked={settings.showApiKey}
                  onChange={(e) => setSettings({ ...settings, showApiKey: e.target.checked })}
                />
              }
              label={t('settings.voice.common.showApiKey')}
              sx={{ mb: 3 }}
            />

            <Divider sx={{ mb: 3 }} />

            {/* 模型选择 */}
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>{t('settings.voice.gemini.model')}</InputLabel>
              <Select
                value={settings.model}
                label={t('settings.voice.gemini.model')}
                onChange={(e) => setSettings({ ...settings, model: e.target.value as any })}
              >
                <MenuItem value="gemini-2.5-flash-preview-tts">
                  {t('settings.voice.gemini.modelFlash')}
                </MenuItem>
                <MenuItem value="gemini-2.5-pro-preview-tts">
                  {t('settings.voice.gemini.modelPro')}
                </MenuItem>
              </Select>
            </FormControl>

            {/* 语音选择 */}
            {!settings.useMultiSpeaker && (
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>{t('settings.voice.gemini.voice')}</InputLabel>
                <Select
                  value={settings.voice}
                  label={t('settings.voice.gemini.voice')}
                  onChange={(e) => setSettings({ ...settings, voice: e.target.value as GeminiVoiceName })}
                >
                  {voiceOptions.map((voice) => (
                    <MenuItem key={voice} value={voice}>
                      {voice} - {GeminiVoiceDescriptions[voice]}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {/* 风格提示词 */}
            <TextField
              fullWidth
              label={t('settings.voice.gemini.stylePrompt')}
              value={settings.stylePrompt}
              onChange={(e) => setSettings({ ...settings, stylePrompt: e.target.value })}
              placeholder={t('settings.voice.gemini.stylePromptPlaceholder')}
              helperText={t('settings.voice.gemini.stylePromptHelp')}
              sx={{ mb: 3 }}
            />

            <Divider sx={{ mb: 3 }} />

            {/* 多说话人配置 */}
            <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
              {t('settings.voice.gemini.multiSpeaker')}
            </Typography>

            <FormControlLabel
              control={
                <CustomSwitch
                  checked={settings.useMultiSpeaker}
                  onChange={(e) => setSettings({ ...settings, useMultiSpeaker: e.target.checked })}
                />
              }
              label={t('settings.voice.gemini.enableMultiSpeaker')}
              sx={{ mb: 2 }}
            />

            {settings.useMultiSpeaker && (
              <Box sx={{ mt: 2 }}>
                {settings.speakers.map((speaker, index) => (
                  <Box key={index} sx={{ mb: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                    <TextField
                      fullWidth
                      label={t('settings.voice.gemini.speakerName', { number: index + 1 })}
                      value={speaker.speaker}
                      onChange={(e) => {
                        const newSpeakers = [...settings.speakers];
                        newSpeakers[index].speaker = e.target.value;
                        setSettings({ ...settings, speakers: newSpeakers });
                      }}
                      sx={{ mb: 2 }}
                    />
                    <FormControl fullWidth>
                      <InputLabel>{t('settings.voice.gemini.voice')}</InputLabel>
                      <Select
                        value={speaker.voiceName}
                        label={t('settings.voice.gemini.voice')}
                        onChange={(e) => {
                          const newSpeakers = [...settings.speakers];
                          newSpeakers[index].voiceName = e.target.value as GeminiVoiceName;
                          setSettings({ ...settings, speakers: newSpeakers });
                        }}
                      >
                        {voiceOptions.map((voice) => (
                          <MenuItem key={voice} value={voice}>
                            {voice} - {GeminiVoiceDescriptions[voice]}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Box>
                ))}
                <Typography variant="caption" color="text.secondary">
                  {t('settings.voice.gemini.multiSpeakerExample', {
                    speaker1: settings.speakers[0].speaker,
                    speaker2: settings.speakers[1].speaker
                  })}
                </Typography>
              </Box>
            )}
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

export default GeminiTTSSettings;