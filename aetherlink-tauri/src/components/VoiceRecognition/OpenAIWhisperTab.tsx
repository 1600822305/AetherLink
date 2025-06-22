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
import { openAIWhisperService } from '../../shared/services/OpenAIWhisperService';

interface OpenAIWhisperTabProps {
  settings: OpenAIWhisperSettings;
  onSettingsChange: (settings: OpenAIWhisperSettings) => void;
}

const OpenAIWhisperTab: React.FC<OpenAIWhisperTabProps> = ({ settings, onSettingsChange }) => {

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
        OpenAI Whisper 语音识别设置
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        OpenAI Whisper是一个强大的语音识别模型，支持多种语言。您需要有OpenAI的API密钥才能使用此功能。
      </Alert>

      {/* API密钥输入 */}
      <TextField
        fullWidth
        label="OpenAI API密钥"
        value={settings.apiKey}
        onChange={(e) => handleChange('apiKey', e.target.value)}
        type={settings.showApiKey ? 'text' : 'password'}
        margin="normal"
        sx={{ mb: 3 }}
        helperText="请输入您的OpenAI API密钥"
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                aria-label="切换API密钥可见性"
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
        <InputLabel>Whisper模型</InputLabel>
        <Select
          value={settings.model}
          onChange={(e) => handleChange('model', e.target.value)}
          label="Whisper模型"
        >
          {openAIWhisperService.getAvailableModels().map((model) => (
            <MenuItem key={model} value={model}>
              {model}
            </MenuItem>
          ))}
        </Select>
        <FormHelperText>
          目前只有whisper-1一个模型可用
        </FormHelperText>
      </FormControl>

      {/* 语言选择 */}
      <FormControl fullWidth margin="normal" sx={{ mb: 3 }}>
        <InputLabel>语言</InputLabel>
        <Select
          value={settings.language || ''}
          onChange={(e) => handleChange('language', e.target.value || undefined)}
          label="语言"
        >
          <MenuItem value="">自动检测</MenuItem>
          <MenuItem value="zh">中文</MenuItem>
          <MenuItem value="en">英语</MenuItem>
          <MenuItem value="ja">日语</MenuItem>
          <MenuItem value="ko">韩语</MenuItem>
          <MenuItem value="fr">法语</MenuItem>
          <MenuItem value="de">德语</MenuItem>
          <MenuItem value="es">西班牙语</MenuItem>
          <MenuItem value="ru">俄语</MenuItem>
        </Select>
        <FormHelperText>
          指定音频的语言可以提高转录准确性，留空则自动检测
        </FormHelperText>
      </FormControl>

      {/* 温度参数 */}
      <Box sx={{ mb: 3 }}>
        <Typography id="temperature-slider" gutterBottom>
          温度: {settings.temperature}
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
          较高的值会使输出更加随机，较低的值则使输出更加确定。建议设置为0以获得最准确的结果。
        </FormHelperText>
      </Box>

      {/* 响应格式 */}
      <FormControl fullWidth margin="normal" sx={{ mb: 3 }}>
        <InputLabel>响应格式</InputLabel>
        <Select
          value={settings.responseFormat || 'json'}
          onChange={(e) => handleChange('responseFormat', e.target.value as any)}
          label="响应格式"
        >
          <MenuItem value="json">JSON</MenuItem>
          <MenuItem value="text">纯文本</MenuItem>
          <MenuItem value="srt">SRT</MenuItem>
          <MenuItem value="verbose_json">详细JSON</MenuItem>
          <MenuItem value="vtt">VTT</MenuItem>
        </Select>
        <FormHelperText>
          选择API返回的响应格式，一般使用默认的JSON格式即可
        </FormHelperText>
      </FormControl>
    </Box>
  );
};

export default OpenAIWhisperTab;