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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  InputAdornment
} from '@mui/material';
import {
  ArrowLeft,
  Eye,
  EyeOff,
  ChevronRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { TTSManager, type MiniMaxTTSConfig, MINIMAX_VOICES, MINIMAX_MODELS, MINIMAX_EMOTIONS, MINIMAX_LANGUAGE_BOOST } from '../../../shared/services/tts-v2';
import { getStorageItem, setStorageItem } from '../../../shared/utils/storage';
import { cssVar } from '../../../shared/utils/cssVariables';
import TTSTestSection from '../../../components/TTS/TTSTestSection';
import CustomSwitch from '../../../components/CustomSwitch';
import { useTranslation } from '../../../i18n';
import { SafeAreaContainer } from '../../../components/settings/SettingComponents';
import FullScreenSelector, { type SelectorGroup } from '../../../components/TTS/FullScreenSelectorSolid';
import { createLogger } from '../../../shared/services/infra/logger';

const logger = createLogger('MiniMaxTTSSettings');

interface MiniMaxSettings {
  apiKey: string;
  showApiKey: boolean;
  groupId: string;
  model: string;
  voiceId: string;
  emotion: string;
  speed: number;
  pitch: number;
  languageBoost: string;
  useStream: boolean;
}

const MiniMaxTTSSettings: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const ttsManager = useMemo(() => TTSManager.getInstance(), []);
  
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const playCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [settings, setSettings] = useState<MiniMaxSettings>({
    apiKey: '',
    showApiKey: false,
    groupId: '',
    model: 'speech-02-hd',
    voiceId: 'female-tianmei',
    emotion: 'neutral',
    speed: 1.0,
    pitch: 0,
    languageBoost: '',
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

  // 全屏选择器状态
  const [voiceSelectorOpen, setVoiceSelectorOpen] = useState(false);
  const [emotionSelectorOpen, setEmotionSelectorOpen] = useState(false);

  // 音色分组数据
  const voiceGroups: SelectorGroup[] = useMemo(() => [{
    name: '可用音色',
    items: MINIMAX_VOICES.map(v => ({
      key: v.id,
      label: v.name,
      subLabel: v.description,
    })),
  }], []);

  // 情感分组数据
  const emotionGroups: SelectorGroup[] = useMemo(() => [{
    name: '情感风格',
    items: MINIMAX_EMOTIONS.map(e => ({
      key: e.id,
      label: e.name,
      subLabel: e.description,
    })),
  }], []);

  // 获取当前选中的名称
  const selectedVoiceName = useMemo(() => 
    MINIMAX_VOICES.find(v => v.id === settings.voiceId)?.name || settings.voiceId,
  [settings.voiceId]);

  const selectedEmotionName = useMemo(() => 
    MINIMAX_EMOTIONS.find(e => e.id === settings.emotion)?.name || settings.emotion,
  [settings.emotion]);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const storedApiKey = await getStorageItem<string>('minimax_tts_api_key') || '';
        const storedGroupId = await getStorageItem<string>('minimax_tts_group_id') || '';
        const storedModel = await getStorageItem<string>('minimax_tts_model') || 'speech-02-hd';
        const storedVoiceId = await getStorageItem<string>('minimax_tts_voice') || 'female-tianmei';
        const storedEmotion = await getStorageItem<string>('minimax_tts_emotion') || 'neutral';
        const storedSpeed = Number(await getStorageItem<string>('minimax_tts_speed') || '1.0');
        const storedPitch = Number(await getStorageItem<string>('minimax_tts_pitch') || '0');
        const storedLanguageBoost = await getStorageItem<string>('minimax_tts_language_boost') || '';
        const storedUseStream = (await getStorageItem<string>('minimax_tts_stream')) === 'true';
        const storedEnableTTS = (await getStorageItem<string>('enable_tts')) !== 'false';
        const storedSelectedTTSService = await getStorageItem<string>('selected_tts_service') || 'siliconflow';

        setSettings({
          apiKey: storedApiKey,
          showApiKey: false,
          groupId: storedGroupId,
          model: storedModel,
          voiceId: storedVoiceId,
          emotion: storedEmotion,
          speed: storedSpeed,
          pitch: storedPitch,
          languageBoost: storedLanguageBoost,
          useStream: storedUseStream,
        });

        setEnableTTS(storedEnableTTS);
        setIsEnabled(storedSelectedTTSService === 'minimax');

        ttsManager.configureEngine('minimax', {
          enabled: true,
          apiKey: storedApiKey,
          groupId: storedGroupId,
          model: storedModel,
          voiceId: storedVoiceId,
          emotion: storedEmotion,
          speed: storedSpeed,
          pitch: storedPitch,
          languageBoost: storedLanguageBoost,
          useStream: storedUseStream,
        } as Partial<MiniMaxTTSConfig>);
        
        setTestText(t('settings.voice.minimax.testText') || '你好，这是 MiniMax 语音合成的测试。');
      } catch (error) {
        logger.error('加载 MiniMax TTS 设置失败:', error);
      }
    };

    loadSettings();
  }, [ttsManager, t]);

  const handleSave = useCallback(async () => {
    try {
      await setStorageItem('minimax_tts_api_key', settings.apiKey);
      await setStorageItem('minimax_tts_group_id', settings.groupId);
      await setStorageItem('minimax_tts_model', settings.model);
      await setStorageItem('minimax_tts_voice', settings.voiceId);
      await setStorageItem('minimax_tts_emotion', settings.emotion);
      await setStorageItem('minimax_tts_speed', settings.speed.toString());
      await setStorageItem('minimax_tts_pitch', settings.pitch.toString());
      await setStorageItem('minimax_tts_language_boost', settings.languageBoost);
      await setStorageItem('minimax_tts_stream', settings.useStream.toString());
      await setStorageItem('enable_tts', enableTTS.toString());

      ttsManager.configureEngine('minimax', {
        enabled: true,
        apiKey: settings.apiKey,
        groupId: settings.groupId,
        model: settings.model,
        voiceId: settings.voiceId,
        emotion: settings.emotion,
        speed: settings.speed,
        pitch: settings.pitch,
        languageBoost: settings.languageBoost,
        useStream: settings.useStream,
      } as Partial<MiniMaxTTSConfig>);

      if (isEnabled) {
        await setStorageItem('selected_tts_service', 'minimax');
        ttsManager.setActiveEngine('minimax');
      } else {
        ttsManager.configureEngine('minimax', { enabled: false });
      }

      setTimeout(() => {
        navigate('/settings/voice');
      }, 0);

    } catch (error) {
      logger.error('保存 MiniMax TTS 设置失败:', error);
      setUIState(prev => ({
        ...prev,
        saveError: t('settings.voice.common.saveError'),
      }));
    }
  }, [settings, enableTTS, isEnabled, ttsManager, navigate, t]);

  const handleEnableChange = useCallback((enabled: boolean) => {
    setIsEnabled(enabled);
  }, []);

  const handleTestTTS = useCallback(async () => {
    if (uiState.isTestPlaying) {
      ttsManager.stop();
      if (playCheckIntervalRef.current) {
        clearInterval(playCheckIntervalRef.current);
      }
      setUIState(prev => ({ ...prev, isTestPlaying: false }));
      return;
    }

    if (!settings.apiKey || !settings.groupId) {
      setUIState(prev => ({ ...prev, saveError: t('settings.voice.common.apiKeyRequired') }));
      return;
    }

    setUIState(prev => ({ ...prev, isTestPlaying: true }));

    ttsManager.configureEngine('minimax', {
      enabled: true,
      apiKey: settings.apiKey,
      groupId: settings.groupId,
      model: settings.model,
      voiceId: settings.voiceId,
      emotion: settings.emotion,
      speed: settings.speed,
      pitch: settings.pitch,
      languageBoost: settings.languageBoost,
      useStream: settings.useStream,
    } as Partial<MiniMaxTTSConfig>);
    ttsManager.setActiveEngine('minimax');

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

  useEffect(() => {
    const saveTimeout = saveTimeoutRef.current;
    const playCheckInterval = playCheckIntervalRef.current;
    return () => {
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }
      if (playCheckInterval) {
        clearInterval(playCheckInterval);
      }
      if (uiState.isTestPlaying) {
        ttsManager.stop();
      }
    };
  }, [uiState.isTestPlaying, ttsManager]);

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
              '&:hover': { backgroundColor: hoverBg },
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
            MiniMax TTS
          </Typography>
          <Button
            onClick={handleSave}
            variant="contained"
            sx={{ borderRadius: 2, px: { xs: 2.5, sm: 3 }, py: { xs: 0.9, sm: 1 }, fontWeight: 700 }}
          >
            {t('settings.voice.common.save')}
          </Button>
        </Toolbar>
      </AppBar>

      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          pt: 2,
          pb: 'var(--content-bottom-padding)',
          px: { xs: 1.5, sm: 2.5, md: 4 },
        }}
      >
        <Box sx={{ maxWidth: 960, mx: 'auto', width: '100%' }}>
          {uiState.isSaved && (
            <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }}>
              {t('settings.voice.common.saveSuccess')}
            </Alert>
          )}

          {uiState.saveError && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
              {uiState.saveError}
            </Alert>
          )}

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

            <Box sx={{ mb: 3 }}>
              <FormControlLabel
                control={
                  <CustomSwitch
                    checked={isEnabled}
                    onChange={(e) => handleEnableChange(e.target.checked)}
                  />
                }
                label={t('settings.voice.common.enableService', { name: 'MiniMax TTS' })}
              />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1, ml: 4 }}>
                {t('settings.voice.minimax.enableDesc') || '启用后将使用 MiniMax 进行语音合成，支持高质量中文和粤语'}
              </Typography>
            </Box>

            <Divider sx={{ mb: 3 }} />

            {/* API Key */}
            <TextField
              fullWidth
              label="API Key"
              type={settings.showApiKey ? 'text' : 'password'}
              value={settings.apiKey}
              onChange={(e) => setSettings(prev => ({ ...prev, apiKey: e.target.value }))}
              sx={{ mb: 2 }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setSettings(prev => ({ ...prev, showApiKey: !prev.showApiKey }))}
                      edge="end"
                    >
                      {settings.showApiKey ? <EyeOff size={20} /> : <Eye size={20} />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              helperText={t('settings.voice.minimax.apiKeyHelper') || '从 MiniMax 控制台获取 API Key'}
            />

            {/* Group ID */}
            <TextField
              fullWidth
              label="Group ID"
              value={settings.groupId}
              onChange={(e) => setSettings(prev => ({ ...prev, groupId: e.target.value }))}
              sx={{ mb: 3 }}
              helperText={t('settings.voice.minimax.groupIdHelper') || '从 MiniMax 控制台获取 Group ID'}
            />

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
              {/* 模型选择 */}
              <Box sx={{ width: { xs: '100%', sm: 'calc(50% - 8px)' } }}>
                <FormControl fullWidth>
                  <InputLabel>模型</InputLabel>
                  <Select
                    value={settings.model}
                    label="模型"
                    onChange={(e) => setSettings(prev => ({ ...prev, model: e.target.value }))}
                  >
                    {MINIMAX_MODELS.map((model) => (
                      <MenuItem key={model.id} value={model.id}>
                        {model.name} - {model.description}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>

              {/* 语音选择 - 点击打开全屏选择器 */}
              <Box sx={{ width: { xs: '100%', sm: 'calc(50% - 8px)' } }}>
                <TextField
                  fullWidth
                  label="语音"
                  value={selectedVoiceName}
                  onClick={() => setVoiceSelectorOpen(true)}
                  InputProps={{
                    readOnly: true,
                    endAdornment: (
                      <InputAdornment position="end">
                        <ChevronRight size={18} />
                      </InputAdornment>
                    ),
                    sx: { cursor: 'pointer' }
                  }}
                  sx={{ cursor: 'pointer' }}
                />
              </Box>

              {/* 情感 - 点击打开全屏选择器 */}
              <Box sx={{ width: { xs: '100%', sm: 'calc(50% - 8px)' } }}>
                <TextField
                  fullWidth
                  label="情感"
                  value={selectedEmotionName}
                  onClick={() => setEmotionSelectorOpen(true)}
                  InputProps={{
                    readOnly: true,
                    endAdornment: (
                      <InputAdornment position="end">
                        <ChevronRight size={18} />
                      </InputAdornment>
                    ),
                    sx: { cursor: 'pointer' }
                  }}
                  sx={{ cursor: 'pointer' }}
                />
              </Box>

              {/* 语言增强 */}
              <Box sx={{ width: { xs: '100%', sm: 'calc(50% - 8px)' } }}>
                <FormControl fullWidth>
                  <InputLabel>语言增强</InputLabel>
                  <Select
                    value={settings.languageBoost}
                    label="语言增强"
                    onChange={(e) => setSettings(prev => ({ ...prev, languageBoost: e.target.value }))}
                  >
                    {MINIMAX_LANGUAGE_BOOST.map((lang) => (
                      <MenuItem key={lang.id} value={lang.id}>
                        {lang.name} - {lang.description}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>

              {/* 语速 */}
              <Box sx={{ width: { xs: '100%', sm: 'calc(50% - 8px)' } }}>
                <Typography gutterBottom>语速: {settings.speed.toFixed(2)}</Typography>
                <Slider
                  value={settings.speed}
                  min={0.5}
                  max={2.0}
                  step={0.05}
                  onChange={(_, value) => setSettings(prev => ({ ...prev, speed: value as number }))}
                />
              </Box>

              {/* 音调 */}
              <Box sx={{ width: { xs: '100%', sm: 'calc(50% - 8px)' } }}>
                <Typography gutterBottom>音调: {settings.pitch}</Typography>
                <Slider
                  value={settings.pitch}
                  min={-12}
                  max={12}
                  step={1}
                  onChange={(_, value) => setSettings(prev => ({ ...prev, pitch: value as number }))}
                />
              </Box>

              {/* 流式传输 */}
              <Box sx={{ width: { xs: '100%', sm: 'calc(50% - 8px)' } }}>
                <FormControlLabel
                  control={
                    <CustomSwitch
                      checked={settings.useStream}
                      onChange={(e) => setSettings(prev => ({ ...prev, useStream: e.target.checked }))}
                    />
                  }
                  label="流式传输"
                />
              </Box>
            </Box>
          </Paper>

          <TTSTestSection
            testText={testText}
            setTestText={setTestText}
            handleTestTTS={handleTestTTS}
            isTestPlaying={uiState.isTestPlaying}
            enableTTS={enableTTS}
            selectedTTSService="minimax"
          />
        </Box>
      </Box>

      {/* 音色全屏选择器 */}
      <FullScreenSelector
        open={voiceSelectorOpen}
        onClose={() => setVoiceSelectorOpen(false)}
        title="选择语音"
        groups={voiceGroups}
        selectedKey={settings.voiceId}
        onSelect={(key) => setSettings(prev => ({ ...prev, voiceId: key }))}
      />

      {/* 情感全屏选择器 */}
      <FullScreenSelector
        open={emotionSelectorOpen}
        onClose={() => setEmotionSelectorOpen(false)}
        title="选择情感"
        groups={emotionGroups}
        selectedKey={settings.emotion}
        onSelect={(key) => setSettings(prev => ({ ...prev, emotion: key }))}
      />
    </SafeAreaContainer>
  );
};

export default MiniMaxTTSSettings;
