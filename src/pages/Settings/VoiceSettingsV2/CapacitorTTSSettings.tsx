import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Slider
} from '@mui/material';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { TTSManager, type CapacitorTTSConfig } from '../../../shared/services/tts-v2';
import { getStorageItem, setStorageItem } from '../../../shared/utils/storage';
import TTSTestSection from '../../../components/TTS/TTSTestSection';
import CustomSwitch from '../../../components/CustomSwitch';
import { useTranslation } from '../../../i18n';
import { cssVar } from '../../../shared/utils/cssVariables';
import { SafeAreaContainer } from '../../../components/settings/SettingComponents';
import Scrollbar from '../../../components/Scrollbar';
import { createLogger } from '../../../shared/services/infra/logger';

const logger = createLogger('CapacitorTTSSettings');

const CapacitorTTSSettings: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const ttsManager = useMemo(() => TTSManager.getInstance(), []);

  const [settings, setSettings] = useState({
    language: 'zh-CN',
    rate: 1.0,
    pitch: 1.0,
    volume: 1.0,
  });

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

  const [uiState, setUIState] = useState({
    saveError: '',
    isTestPlaying: false,
  });

  const [testText, setTestText] = useState(t('settings.voice.capacitorTTS.testText'));
  const [enableTTS, setEnableTTS] = useState(true);
  const [isEnabled, setIsEnabled] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const storedLanguage = await getStorageItem<string>('capacitor_tts_language') || 'zh-CN';
        const storedRate = Number(await getStorageItem<string>('capacitor_tts_rate') || '1.0');
        const storedPitch = Number(await getStorageItem<string>('capacitor_tts_pitch') || '1.0');
        const storedVolume = Number(await getStorageItem<string>('capacitor_tts_volume') || '1.0');
        const storedEnableTTS = (await getStorageItem<string>('enable_tts')) !== 'false';
        const storedSelectedTTSService = await getStorageItem<string>('selected_tts_service') || 'siliconflow';

        setSettings({
          language: storedLanguage,
          rate: storedRate,
          pitch: storedPitch,
          volume: storedVolume,
        });

        setEnableTTS(storedEnableTTS);
        setIsEnabled(storedSelectedTTSService === 'capacitor');

        ttsManager.configureEngine('capacitor', {
          enabled: true,
          language: storedLanguage,
          rate: storedRate,
          pitch: storedPitch,
          volume: storedVolume
        } as Partial<CapacitorTTSConfig>);
      } catch (error) {
        logger.error('加载Capacitor TTS设置失败:', error);
      }
    };

    loadSettings();
  }, [ttsManager, t]);

  const handleSave = useCallback(async () => {
    try {
      await setStorageItem('capacitor_tts_language', settings.language);
      await setStorageItem('capacitor_tts_rate', settings.rate.toString());
      await setStorageItem('capacitor_tts_pitch', settings.pitch.toString());
      await setStorageItem('capacitor_tts_volume', settings.volume.toString());
      await setStorageItem('enable_tts', enableTTS.toString());

      if (isEnabled) {
        await setStorageItem('selected_tts_service', 'capacitor');
        await setStorageItem('use_capacitor_tts', 'true');
        await setStorageItem('use_openai_tts', 'false');
        await setStorageItem('use_azure_tts', 'false');

        // 更新管理器
        ttsManager.configureEngine('capacitor', {
          enabled: true,
          language: settings.language,
          rate: settings.rate,
          pitch: settings.pitch,
          volume: settings.volume
        } as Partial<CapacitorTTSConfig>);
        ttsManager.setActiveEngine('capacitor');
      } else {
        await setStorageItem('use_capacitor_tts', 'false');
        ttsManager.configureEngine('capacitor', { enabled: false });
      }

      navigate('/settings/voice');
    } catch (error) {
      logger.error('保存Capacitor TTS设置失败:', error);
      setUIState(prev => ({
        ...prev,
        saveError: t('settings.voice.common.saveError'),
      }));
    }
  }, [settings, enableTTS, isEnabled, ttsManager, navigate, t]);

  const handleTestTTS = useCallback(async () => {
    if (uiState.isTestPlaying) {
      ttsManager.stop();
      setUIState(prev => ({ ...prev, isTestPlaying: false }));
      return;
    }

    setUIState(prev => ({ ...prev, isTestPlaying: true }));

    // 临时配置用于测试
    ttsManager.configureEngine('capacitor', {
      enabled: true,
      language: settings.language,
      rate: settings.rate,
      pitch: settings.pitch,
      volume: settings.volume
    } as Partial<CapacitorTTSConfig>);
    ttsManager.setActiveEngine('capacitor');

    const success = await ttsManager.speak(testText);
    if (!success) {
      setUIState(prev => ({ ...prev, isTestPlaying: false }));
    }

    // 监听播放结束
    const checkPlaybackStatus = () => {
      if (!ttsManager.isPlaying) {
        setUIState(prev => ({ ...prev, isTestPlaying: false }));
      } else {
        setTimeout(checkPlaybackStatus, 100);
      }
    };
    setTimeout(checkPlaybackStatus, 100);
  }, [settings, testText, ttsManager, uiState.isTestPlaying]);

  return (
    <SafeAreaContainer sx={{ backgroundColor: bgDefault, color: textPrimary }}>
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
          <IconButton edge="start" onClick={() => navigate('/settings/voice')} sx={{ mr: 1.5, color: primaryColor, borderRadius: 2, border: `1px solid ${borderSubtle}`, transition: 'all 0.2s ease', '&:hover': { backgroundColor: hoverBg, transform: 'translateY(-1px)' }, '&:focus-visible': { outline: `2px solid ${primaryColor}`, outlineOffset: '2px' } }}>
            <ArrowLeft />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 700, letterSpacing: '0.03em', textTransform: 'uppercase' }}>
            {t('settings.voice.services.capacitorTTS.name')}
          </Typography>
          <Button variant="contained" onClick={handleSave} sx={{ borderRadius: 2, px: { xs: 2.5, sm: 3 }, py: { xs: 0.9, sm: 1 }, fontWeight: 700 }}>
            {t('settings.voice.common.save')}
          </Button>
        </Toolbar>
      </AppBar>

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
          {uiState.saveError && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setUIState(prev => ({ ...prev, saveError: '' }))}>
              {uiState.saveError}
            </Alert>
          )}

          <Paper sx={{ p: { xs: 2.5, sm: 3 }, mb: { xs: 2, sm: 3 }, borderRadius: { xs: 2, sm: 2.5 }, border: `1px solid ${borderDefault}`, bgcolor: bgPaper, boxShadow: `0 18px 40px -28px ${toolbarShadow}` }}>
            <FormControlLabel
              control={<CustomSwitch checked={isEnabled} onChange={(e) => setIsEnabled(e.target.checked)} />}
              label={t('settings.voice.capacitorTTS.enableService')}
              sx={{ mb: 2 }}
            />
            <Typography variant="body2" sx={{ mb: 3, color: 'text.secondary' }}>
              {t('settings.voice.capacitorTTS.enableDesc')}
            </Typography>

            <Divider sx={{ my: 3 }} />

            <TextField
              fullWidth
              label={t('settings.voice.capacitorTTS.language')}
              value={settings.language}
              onChange={(e) => setSettings(prev => ({ ...prev, language: e.target.value }))}
              sx={{ mb: 3 }}
              helperText={t('settings.voice.capacitorTTS.languageHelper')}
            />

            <Typography gutterBottom>{t('settings.voice.capacitorTTS.rate')}: {settings.rate.toFixed(1)}</Typography>
            <Slider
              value={settings.rate}
              min={0.0}
              max={1.0}
              step={0.1}
              onChange={(_, value) => setSettings(prev => ({ ...prev, rate: value as number }))}
              sx={{ mb: 3 }}
            />

            <Typography gutterBottom>{t('settings.voice.capacitorTTS.pitch')}: {settings.pitch.toFixed(1)}</Typography>
            <Slider
              value={settings.pitch}
              min={0.0}
              max={2.0}
              step={0.1}
              onChange={(_, value) => setSettings(prev => ({ ...prev, pitch: value as number }))}
              sx={{ mb: 3 }}
            />

            <Typography gutterBottom>{t('settings.voice.capacitorTTS.volume')}: {settings.volume.toFixed(1)}</Typography>
            <Slider
              value={settings.volume}
              min={0.0}
              max={1.0}
              step={0.1}
              onChange={(_, value) => setSettings(prev => ({ ...prev, volume: value as number }))}
            />
          </Paper>

          <TTSTestSection
            testText={testText}
            setTestText={setTestText}
            handleTestTTS={handleTestTTS}
            isTestPlaying={uiState.isTestPlaying}
            enableTTS={enableTTS}
            selectedTTSService="capacitor"
            openaiApiKey=""
            azureApiKey=""
            siliconFlowApiKey=""
          />
        </Box>
      </Scrollbar>
    </SafeAreaContainer>
  );
};

export default CapacitorTTSSettings;

