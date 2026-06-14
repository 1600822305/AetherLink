import React from 'react';
import {
  Box,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  InputAdornment,
  IconButton,
  Alert,
  Slider,
} from '@mui/material';
import { Eye as Visibility, EyeOff as VisibilityOff } from 'lucide-react';
import type { OpenAIWhisperSettings } from '../../shared/types/voice';
import { openAIWhisperService } from '../../shared/services/tts-v2/OpenAIWhisperService';
import { useTranslation } from '../../i18n';

interface OpenAIWhisperTabProps {
  settings: OpenAIWhisperSettings;
  onSettingsChange: (settings: OpenAIWhisperSettings) => void;
}

const OpenAIWhisperTab: React.FC<OpenAIWhisperTabProps> = ({ settings, onSettingsChange }) => {
  const { t } = useTranslation();

  const handleChange = <K extends keyof OpenAIWhisperSettings>(key: K, value: OpenAIWhisperSettings[K]) => {
    onSettingsChange({
      ...settings,
      [key]: value
    });
  };

  const toggleShowApiKey = () => {
    handleChange('showApiKey', !settings.showApiKey);
  };

  return (
    <Box sx={{ py: 1 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        {t('settings.voice.tabSettings.whisper.title')}
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        {t('settings.voice.tabSettings.whisper.info')}
      </Alert>

      {/* API密钥输入 */}
      <TextField
        fullWidth
        label={t('settings.voice.tabSettings.whisper.apiKey')}
        value={settings.apiKey}
        onChange={(e) => handleChange('apiKey', e.target.value)}
        type={settings.showApiKey ? 'text' : 'password'}
        margin="normal"
        sx={{ mb: 3 }}
        helperText={t('settings.voice.tabSettings.whisper.apiKeyHelper')}
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                aria-label={t('settings.voice.tabSettings.whisper.toggleApiKeyVisibility')}
                onClick={toggleShowApiKey}
                edge="end"
              >
                {settings.showApiKey ? <VisibilityOff /> : <Visibility />}
              </IconButton>
            </InputAdornment>
          ),
        }}
      />

      {/* 模型选择 */}
      <FormControl fullWidth margin="normal" sx={{ mb: 3 }}>
        <InputLabel>{t('settings.voice.tabSettings.whisper.model')}</InputLabel>
        <Select
          value={settings.model}
          onChange={(e) => handleChange('model', e.target.value)}
          label={t('settings.voice.tabSettings.whisper.model')}
        >
          {openAIWhisperService.getAvailableModels().map((model) => (
            <MenuItem key={model} value={model}>
              {model}
            </MenuItem>
          ))}
        </Select>
        <FormHelperText>
          {t('settings.voice.tabSettings.whisper.modelHelper')}
        </FormHelperText>
      </FormControl>

      {/* 语言选择 */}
      <FormControl fullWidth margin="normal" sx={{ mb: 3 }}>
        <InputLabel shrink>{t('settings.voice.tabSettings.whisper.language')}</InputLabel>
        <Select
          value={settings.language || ''}
          onChange={(e) => handleChange('language', e.target.value || undefined)}
          label={t('settings.voice.tabSettings.whisper.language')}
          displayEmpty
        >
          <MenuItem value="">{t('settings.voice.tabSettings.whisper.languageAuto')}</MenuItem>
          <MenuItem value="zh">{t('settings.voice.tabSettings.whisper.languageZh')}</MenuItem>
          <MenuItem value="en">{t('settings.voice.tabSettings.whisper.languageEn')}</MenuItem>
          <MenuItem value="ja">{t('settings.voice.tabSettings.whisper.languageJa')}</MenuItem>
          <MenuItem value="ko">{t('settings.voice.tabSettings.whisper.languageKo')}</MenuItem>
          <MenuItem value="fr">{t('settings.voice.tabSettings.whisper.languageFr')}</MenuItem>
          <MenuItem value="de">{t('settings.voice.tabSettings.whisper.languageDe')}</MenuItem>
          <MenuItem value="es">{t('settings.voice.tabSettings.whisper.languageEs')}</MenuItem>
          <MenuItem value="ru">{t('settings.voice.tabSettings.whisper.languageRu')}</MenuItem>
        </Select>
        <FormHelperText>
          {t('settings.voice.tabSettings.whisper.languageHelper')}
        </FormHelperText>
      </FormControl>

      {/* 温度参数 */}
      <Box sx={{ mb: 3 }}>
        <Typography id="temperature-slider" gutterBottom>
          {t('settings.voice.tabSettings.whisper.temperature')}: {settings.temperature}
        </Typography>
        <Slider
          aria-labelledby="temperature-slider"
          value={settings.temperature || 0}
          onChange={(_, value) => handleChange('temperature', value as number)}
          step={0.1}
          marks
          min={0}
          max={1}
          valueLabelDisplay="auto"
        />
        <FormHelperText>
          {t('settings.voice.tabSettings.whisper.temperatureHelper')}
        </FormHelperText>
      </Box>

      {/* 响应格式 */}
      <FormControl fullWidth margin="normal" sx={{ mb: 3 }}>
        <InputLabel>{t('settings.voice.tabSettings.whisper.responseFormat')}</InputLabel>
        <Select
          value={settings.responseFormat || 'json'}
          onChange={(e) => handleChange('responseFormat', e.target.value as any)}
          label={t('settings.voice.tabSettings.whisper.responseFormat')}
        >
          <MenuItem value="json">JSON</MenuItem>
          <MenuItem value="text">Plain Text</MenuItem>
          <MenuItem value="srt">SRT</MenuItem>
          <MenuItem value="verbose_json">Verbose JSON</MenuItem>
          <MenuItem value="vtt">VTT</MenuItem>
        </Select>
        <FormHelperText>
          {t('settings.voice.tabSettings.whisper.responseFormatHelper')}
        </FormHelperText>
      </FormControl>
    </Box>
  );
};

export default OpenAIWhisperTab;
