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
import { TTSManager, type ElevenLabsTTSConfig, ELEVENLABS_VOICES, ELEVENLABS_MODELS, ELEVENLABS_OUTPUT_FORMATS } from '../../../shared/services/tts-v2';
import { getStorageItem, setStorageItem } from '../../../shared/utils/storage';
import { cssVar } from '../../../shared/utils/cssVariables';
import TTSTestSection from '../../../components/TTS/TTSTestSection';
import CustomSwitch from '../../../components/CustomSwitch';
import { useTranslation } from '../../../i18n';
import { SafeAreaContainer } from '../../../components/settings/SettingComponents';
import FullScreenSelector, { type SelectorGroup } from '../../../components/TTS/FullScreenSelectorSolid';
import { createLogger } from '../../../shared/services/infra/logger';

const logger = createLogger('ElevenLabsTTSSettings');

interface ElevenLabsSettings {
  apiKey: string;
  showApiKey: boolean;
  modelId: string;
  voiceId: string;
  outputFormat: string;
  stability: number;
  similarityBoost: number;
  style: number;
  useSpeakerBoost: boolean;
  speed: number;
}

const ElevenLabsTTSSettings: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const ttsManager = useMemo(() => TTSManager.getInstance(), []);
  
  // 定时器引用
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const playCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 状态管理
  const [settings, setSettings] = useState<ElevenLabsSettings>({
    apiKey: '',
    showApiKey: false,
    modelId: 'eleven_multilingual_v2',
    voiceId: 'JBFqnCBsd6RMkjVDRZzb',
    outputFormat: 'mp3_44100_128',
    stability: 0.5,
    similarityBoost: 0.75,
    style: 0,
    useSpeakerBoost: true,
    speed: 1.0,
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
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false);
  const [formatSelectorOpen, setFormatSelectorOpen] = useState(false);

  // 音色分组数据
  const voiceGroups: SelectorGroup[] = useMemo(() => [{
    name: '预设语音',
    items: ELEVENLABS_VOICES.map(v => ({
      key: v.id,
      label: v.name,
      subLabel: v.description,
    })),
  }], []);

  // 模型分组数据
  const modelGroups: SelectorGroup[] = useMemo(() => [{
    name: '可用模型',
    items: ELEVENLABS_MODELS.map(m => ({
      key: m.id,
      label: m.name,
      subLabel: m.description,
    })),
  }], []);

  // 格式分组数据
  const formatGroups: SelectorGroup[] = useMemo(() => [{
    name: '输出格式',
    items: ELEVENLABS_OUTPUT_FORMATS.map(f => ({
      key: f.id,
      label: f.name,
      subLabel: f.description,
    })),
  }], []);

  // 获取当前选中的名称
  const selectedVoiceName = useMemo(() => 
    ELEVENLABS_VOICES.find(v => v.id === settings.voiceId)?.name || settings.voiceId,
  [settings.voiceId]);

  const selectedModelName = useMemo(() => 
    ELEVENLABS_MODELS.find(m => m.id === settings.modelId)?.name || settings.modelId,
  [settings.modelId]);

  const selectedFormatName = useMemo(() => 
    ELEVENLABS_OUTPUT_FORMATS.find(f => f.id === settings.outputFormat)?.name || settings.outputFormat,
  [settings.outputFormat]);

  // 加载设置
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const storedApiKey = await getStorageItem<string>('elevenlabs_tts_api_key') || '';
        const storedModelId = await getStorageItem<string>('elevenlabs_tts_model') || 'eleven_multilingual_v2';
        const storedVoiceId = await getStorageItem<string>('elevenlabs_tts_voice') || 'JBFqnCBsd6RMkjVDRZzb';
        const storedOutputFormat = await getStorageItem<string>('elevenlabs_tts_format') || 'mp3_44100_128';
        const storedStability = Number(await getStorageItem<string>('elevenlabs_tts_stability') || '0.5');
        const storedSimilarityBoost = Number(await getStorageItem<string>('elevenlabs_tts_similarity_boost') || '0.75');
        const storedStyle = Number(await getStorageItem<string>('elevenlabs_tts_style') || '0');
        const storedUseSpeakerBoost = (await getStorageItem<string>('elevenlabs_tts_speaker_boost')) !== 'false';
        const storedSpeed = Number(await getStorageItem<string>('elevenlabs_tts_speed') || '1.0');
        const storedEnableTTS = (await getStorageItem<string>('enable_tts')) !== 'false';
        const storedSelectedTTSService = await getStorageItem<string>('selected_tts_service') || 'siliconflow';

        setSettings({
          apiKey: storedApiKey,
          showApiKey: false,
          modelId: storedModelId,
          voiceId: storedVoiceId,
          outputFormat: storedOutputFormat,
          stability: storedStability,
          similarityBoost: storedSimilarityBoost,
          style: storedStyle,
          useSpeakerBoost: storedUseSpeakerBoost,
          speed: storedSpeed,
        });

        setEnableTTS(storedEnableTTS);
        setIsEnabled(storedSelectedTTSService === 'elevenlabs');

        // 设置 TTSManager
        ttsManager.configureEngine('elevenlabs', {
          enabled: true,
          apiKey: storedApiKey,
          modelId: storedModelId,
          voiceId: storedVoiceId,
          outputFormat: storedOutputFormat,
          stability: storedStability,
          similarityBoost: storedSimilarityBoost,
          style: storedStyle,
          useSpeakerBoost: storedUseSpeakerBoost,
          speed: storedSpeed,
        } as Partial<ElevenLabsTTSConfig>);
        
        // 加载测试文本
        setTestText(t('settings.voice.elevenlabs.testText') || 'Hello, this is a test of ElevenLabs text to speech.');
      } catch (error) {
        logger.error('加载 ElevenLabs TTS 设置失败:', error);
      }
    };

    loadSettings();
  }, [ttsManager, t]);

  // 保存设置
  const handleSave = useCallback(async () => {
    try {
      await setStorageItem('elevenlabs_tts_api_key', settings.apiKey);
      await setStorageItem('elevenlabs_tts_model', settings.modelId);
      await setStorageItem('elevenlabs_tts_voice', settings.voiceId);
      await setStorageItem('elevenlabs_tts_format', settings.outputFormat);
      await setStorageItem('elevenlabs_tts_stability', settings.stability.toString());
      await setStorageItem('elevenlabs_tts_similarity_boost', settings.similarityBoost.toString());
      await setStorageItem('elevenlabs_tts_style', settings.style.toString());
      await setStorageItem('elevenlabs_tts_speaker_boost', settings.useSpeakerBoost.toString());
      await setStorageItem('elevenlabs_tts_speed', settings.speed.toString());
      await setStorageItem('enable_tts', enableTTS.toString());

      // 更新 TTSManager
      ttsManager.configureEngine('elevenlabs', {
        enabled: true,
        apiKey: settings.apiKey,
        modelId: settings.modelId,
        voiceId: settings.voiceId,
        outputFormat: settings.outputFormat,
        stability: settings.stability,
        similarityBoost: settings.similarityBoost,
        style: settings.style,
        useSpeakerBoost: settings.useSpeakerBoost,
        speed: settings.speed,
      } as Partial<ElevenLabsTTSConfig>);

      if (isEnabled) {
        await setStorageItem('selected_tts_service', 'elevenlabs');
        ttsManager.setActiveEngine('elevenlabs');
      } else {
        ttsManager.configureEngine('elevenlabs', { enabled: false });
      }

      // 保存成功后返回上级页面
      setTimeout(() => {
        navigate('/settings/voice');
      }, 0);

    } catch (error) {
      logger.error('保存 ElevenLabs TTS 设置失败:', error);
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

    // 设置为使用 ElevenLabs TTS
    ttsManager.configureEngine('elevenlabs', {
      enabled: true,
      apiKey: settings.apiKey,
      modelId: settings.modelId,
      voiceId: settings.voiceId,
      outputFormat: settings.outputFormat,
      stability: settings.stability,
      similarityBoost: settings.similarityBoost,
      style: settings.style,
      useSpeakerBoost: settings.useSpeakerBoost,
      speed: settings.speed,
    } as Partial<ElevenLabsTTSConfig>);
    ttsManager.setActiveEngine('elevenlabs');

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
            ElevenLabs TTS
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

      {/* 可滚动的内容区域 */}
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
          {/* 保存结果提示 */}
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
                label={t('settings.voice.common.enableService', { name: 'ElevenLabs TTS' })}
              />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1, ml: 4 }}>
                {t('settings.voice.elevenlabs.enableDesc') || '启用后将使用 ElevenLabs 进行语音合成，提供高质量多语言语音'}
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
              sx={{ mb: 3 }}
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
              helperText={t('settings.voice.elevenlabs.apiKeyHelper') || '从 ElevenLabs 控制台获取 API Key'}
            />

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
              {/* 模型选择 - 点击打开全屏选择器 */}
              <Box sx={{ width: { xs: '100%', sm: 'calc(50% - 8px)' } }}>
                <TextField
                  fullWidth
                  label="模型"
                  value={selectedModelName}
                  onClick={() => setModelSelectorOpen(true)}
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

              {/* 输出格式 - 点击打开全屏选择器 */}
              <Box sx={{ width: { xs: '100%', sm: 'calc(50% - 8px)' } }}>
                <TextField
                  fullWidth
                  label="输出格式"
                  value={selectedFormatName}
                  onClick={() => setFormatSelectorOpen(true)}
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

              {/* 稳定性 */}
              <Box sx={{ width: { xs: '100%', sm: 'calc(50% - 8px)' } }}>
                <Typography gutterBottom>稳定性: {settings.stability.toFixed(2)}</Typography>
                <Slider
                  value={settings.stability}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={(_, value) => setSettings(prev => ({ ...prev, stability: value as number }))}
                />
              </Box>

              {/* 相似度增强 */}
              <Box sx={{ width: { xs: '100%', sm: 'calc(50% - 8px)' } }}>
                <Typography gutterBottom>相似度增强: {settings.similarityBoost.toFixed(2)}</Typography>
                <Slider
                  value={settings.similarityBoost}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={(_, value) => setSettings(prev => ({ ...prev, similarityBoost: value as number }))}
                />
              </Box>

              {/* 风格 */}
              <Box sx={{ width: { xs: '100%', sm: 'calc(50% - 8px)' } }}>
                <Typography gutterBottom>风格: {settings.style.toFixed(2)}</Typography>
                <Slider
                  value={settings.style}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={(_, value) => setSettings(prev => ({ ...prev, style: value as number }))}
                />
              </Box>

              {/* 说话者增强 */}
              <Box sx={{ width: { xs: '100%', sm: 'calc(50% - 8px)' } }}>
                <FormControlLabel
                  control={
                    <CustomSwitch
                      checked={settings.useSpeakerBoost}
                      onChange={(e) => setSettings(prev => ({ ...prev, useSpeakerBoost: e.target.checked }))}
                    />
                  }
                  label="说话者增强"
                />
              </Box>
            </Box>
          </Paper>

          {/* 测试区域 */}
          <TTSTestSection
            testText={testText}
            setTestText={setTestText}
            handleTestTTS={handleTestTTS}
            isTestPlaying={uiState.isTestPlaying}
            enableTTS={enableTTS}
            selectedTTSService="elevenlabs"
            openaiApiKey=""
            azureApiKey=""
            siliconFlowApiKey=""
          />
        </Box>
      </Box>

      {/* 模型全屏选择器 */}
      <FullScreenSelector
        open={modelSelectorOpen}
        onClose={() => setModelSelectorOpen(false)}
        title="选择模型"
        groups={modelGroups}
        selectedKey={settings.modelId}
        onSelect={(key) => setSettings(prev => ({ ...prev, modelId: key }))}
      />

      {/* 语音全屏选择器 */}
      <FullScreenSelector
        open={voiceSelectorOpen}
        onClose={() => setVoiceSelectorOpen(false)}
        title="选择语音"
        groups={voiceGroups}
        selectedKey={settings.voiceId}
        onSelect={(key) => setSettings(prev => ({ ...prev, voiceId: key }))}
      />

      {/* 格式全屏选择器 */}
      <FullScreenSelector
        open={formatSelectorOpen}
        onClose={() => setFormatSelectorOpen(false)}
        title="选择输出格式"
        groups={formatGroups}
        selectedKey={settings.outputFormat}
        onSelect={(key) => setSettings(prev => ({ ...prev, outputFormat: key }))}
      />
    </SafeAreaContainer>
  );
};

export default ElevenLabsTTSSettings;
