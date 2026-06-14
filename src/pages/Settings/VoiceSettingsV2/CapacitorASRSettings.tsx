import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  AppBar,
  Toolbar,
  IconButton,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  FormControlLabel,
  Button,
} from '@mui/material';
import {
  ArrowLeft,
  Mic,
  Square
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getStorageItem, setStorageItem } from '../../../shared/utils/storage';
import { useVoiceRecognition } from '../../../shared/hooks/useVoiceRecognition';
import CustomSwitch from '../../../components/CustomSwitch';
import type { VoiceRecognitionSettings } from '../../../shared/types/voice';
import { useTranslation } from '../../../i18n';
import { SafeAreaContainer } from '../../../components/settings/SettingComponents';
import { createLogger } from '../../../shared/services/infra/logger';

const logger = createLogger('CapacitorASRSettings');
import Scrollbar from '../../../components/Scrollbar';

const CapacitorASRSettings: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  // 状态管理
  const [settings, setSettings] = useState<VoiceRecognitionSettings>({
    enabled: true,
    language: 'zh-CN',
    autoStart: false,
    silenceTimeout: 2000,
    maxResults: 5,
    partialResults: true,
    permissionStatus: 'unknown',
    provider: 'capacitor',
  });

  const [uiState, setUIState] = useState({
    saveError: '',
  });

  const [isListening] = useState(false);

  // 引入语音识别hook
  const {
    recognitionText,
    permissionStatus,
    error,
    startRecognition,
    stopRecognition,
  } = useVoiceRecognition();

  // 加载设置
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const storedSpeechRecognitionEnabled = (await getStorageItem<string>('speech_recognition_enabled')) !== 'false';
        const storedSpeechRecognitionLanguage = await getStorageItem<string>('speech_recognition_language') || 'zh-CN';
        const storedSpeechRecognitionAutoStart = (await getStorageItem<string>('speech_recognition_auto_start')) === 'true';
        const storedSpeechRecognitionSilenceTimeout = Number(await getStorageItem<string>('speech_recognition_silence_timeout') || '2000');
        const storedSpeechRecognitionMaxResults = Number(await getStorageItem<string>('speech_recognition_max_results') || '5');
        const storedSpeechRecognitionPartialResults = (await getStorageItem<string>('speech_recognition_partial_results')) !== 'false';

        setSettings({
          enabled: storedSpeechRecognitionEnabled,
          language: storedSpeechRecognitionLanguage,
          autoStart: storedSpeechRecognitionAutoStart,
          silenceTimeout: storedSpeechRecognitionSilenceTimeout,
          maxResults: storedSpeechRecognitionMaxResults,
          partialResults: storedSpeechRecognitionPartialResults,
          permissionStatus: 'unknown',
          provider: 'capacitor',
        });
      } catch (error) {
        logger.error(t('settings.voice.common.loadingError', { service: 'Capacitor ASR' }), error);
      }
    };

    loadSettings();
  }, [t]);

  // 保存设置
  const handleSave = useCallback(async () => {
    try {
      await setStorageItem('speech_recognition_enabled', settings.enabled.toString());
      await setStorageItem('speech_recognition_language', settings.language);
      await setStorageItem('speech_recognition_auto_start', settings.autoStart.toString());
      await setStorageItem('speech_recognition_silence_timeout', settings.silenceTimeout.toString());
      await setStorageItem('speech_recognition_max_results', settings.maxResults.toString());
      await setStorageItem('speech_recognition_partial_results', settings.partialResults.toString());
      await setStorageItem('speech_recognition_provider', 'capacitor');

      // 保存成功后返回上级页面
      setTimeout(() => {
        navigate('/settings/voice');
      }, 0);

    } catch (error) {
      logger.error(t('settings.voice.common.saveErrorText', { service: 'Capacitor ASR' }), error);
      setUIState(prev => ({
        ...prev,
        saveError: t('settings.voice.common.saveError'),
      }));
    }
  }, [settings, navigate, t]);




  const handleBack = () => {
    navigate('/settings/voice');
  };

  const handleSettingsChange = (key: keyof VoiceRecognitionSettings, value: any) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  return (
    <SafeAreaContainer sx={{
      width: '100vw',
      overflow: 'hidden',
      bgcolor: 'background.default'
    }}>
      {/* 顶部导航栏 */}
      <AppBar
        position="static"
        elevation={0}
        sx={{
          bgcolor: 'background.paper',
          color: 'text.primary',
          borderBottom: 1,
          borderColor: 'divider',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          background: 'rgba(255, 255, 255, 0.8)',
          '@media (prefers-color-scheme: dark)': {
            background: 'rgba(18, 18, 18, 0.8)',
          },
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 56, sm: 64 }, px: { xs: 1, sm: 2, md: 3 } }}>
          <IconButton
            edge="start"
            onClick={handleBack}
            aria-label={t('settings.voice.back')}
            size="large"
            sx={{
              color: 'primary.main',
              mr: { xs: 1, sm: 2 },
              '&:hover': {
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
                transform: 'scale(1.05)',
              },
              transition: 'all 0.2s ease-in-out',
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
            {t('settings.voice.capacitor.title')}
          </Typography>
          <Button
            onClick={handleSave}
            variant="contained"
            sx={{
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              '&:hover': {
                bgcolor: 'primary.dark',
              },
              borderRadius: 2,
              px: 3,
            }}
          >
            {t('settings.voice.common.save')}
          </Button>
        </Toolbar>
      </AppBar>

      {/* 可滚动的内容区域 */}
      <Scrollbar
        style={{
          flexGrow: 1,
          padding: '16px',
        }}
      >
        <Box
          sx={{
            width: '100%',
          }}
        >
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
              p: 3,
              mb: 3,
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              background: 'background.paper',
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
            }}
          >
            <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
              {t('settings.voice.capacitor.config')}
            </Typography>

            {/* 启用开关 */}
            <Box sx={{ mb: 3 }}>
              <FormControlLabel
                control={
                  <CustomSwitch
                    checked={settings.enabled}
                    onChange={(e) => handleSettingsChange('enabled', e.target.checked)}
                  />
                }
                label={t('settings.voice.capacitor.enable')}
              />
            </Box>

            {/* 语言选择 */}
            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel>{t('settings.voice.capacitor.language.label')}</InputLabel>
              <Select
                value={settings.language}
                onChange={(e) => handleSettingsChange('language', e.target.value)}
                label={t('settings.voice.capacitor.language.label')}
                MenuProps={{
                  disableAutoFocus: true,
                  disableRestoreFocus: true
                }}
              >
                <MenuItem value="zh-CN">{t('settings.voice.capacitor.language.zhCN')}</MenuItem>
                <MenuItem value="en-US">{t('settings.voice.capacitor.language.enUS')}</MenuItem>
                <MenuItem value="ja-JP">{t('settings.voice.capacitor.language.jaJP')}</MenuItem>
                <MenuItem value="ko-KR">{t('settings.voice.capacitor.language.koKR')}</MenuItem>
                <MenuItem value="fr-FR">{t('settings.voice.capacitor.language.frFR')}</MenuItem>
                <MenuItem value="de-DE">{t('settings.voice.capacitor.language.deDE')}</MenuItem>
                <MenuItem value="es-ES">{t('settings.voice.capacitor.language.esES')}</MenuItem>
              </Select>
              <FormHelperText>{t('settings.voice.capacitor.language.helper')}</FormHelperText>
            </FormControl>

            {/* 自动开始 */}
            <Box sx={{ mb: 3 }}>
              <FormControlLabel
                control={
                  <CustomSwitch
                    checked={settings.autoStart}
                    onChange={(e) => handleSettingsChange('autoStart', e.target.checked)}
                  />
                }
                label={t('settings.voice.capacitor.autoStart.label')}
              />
              <FormHelperText>{t('settings.voice.capacitor.autoStart.helper')}</FormHelperText>
            </Box>

            {/* 部分结果 */}
            <Box sx={{ mb: 3 }}>
              <FormControlLabel
                control={
                  <CustomSwitch
                    checked={settings.partialResults}
                    onChange={(e) => handleSettingsChange('partialResults', e.target.checked)}
                  />
                }
                label={t('settings.voice.capacitor.partialResults.label')}
              />
              <FormHelperText>{t('settings.voice.capacitor.partialResults.helper')}</FormHelperText>
            </Box>

            {/* 权限状态 */}
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {t('settings.voice.capacitor.permission.status', { status: permissionStatus })}
            </Typography>

            {/* 权限请求按钮 */}
            <Button
              variant="contained"
              startIcon={<Mic size={16} />}
              onClick={() => startRecognition()}
              disabled={isListening}
              color="primary"
              sx={{ mb: 2 }}
            >
              {t('settings.voice.capacitor.permission.checkAndRequest')}
            </Button>
          </Paper>

          {/* 测试区域 */}
          <Paper
            elevation={0}
            sx={{
              p: 3,
              mb: 3,
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              background: 'background.paper',
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
            }}
          >
            <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
              {t('settings.voice.capacitor.test.title')}
            </Typography>

            {/* 测试按钮 */}
            <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
              <Button
                variant={isListening ? "outlined" : "contained"}
                startIcon={isListening ? <Square size={16} /> : <Mic size={16} />}
                onClick={() => isListening ? stopRecognition() : startRecognition()}
                disabled={!settings.enabled}
                color={isListening ? "error" : "primary"}
              >
                {isListening ? t('settings.voice.capacitor.test.stop') : t('settings.voice.capacitor.test.start')}
              </Button>
            </Box>

            {/* 识别结果 */}
            {recognitionText && (
              <Alert severity="info" sx={{ mb: 3 }}>
                {t('settings.voice.capacitor.test.result', { text: recognitionText })}
              </Alert>
            )}

            {/* 错误信息 */}
            {error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {t('settings.voice.capacitor.test.error', { message: error.message || t('common.unknownError') || 'Unknown error' })}
              </Alert>
            )}

            <Typography variant="body2" color="text.secondary">
              {t('settings.voice.capacitor.test.hint')}
            </Typography>
          </Paper>
        </Box>
      </Scrollbar>
    </SafeAreaContainer>
  );
};

export default CapacitorASRSettings;
