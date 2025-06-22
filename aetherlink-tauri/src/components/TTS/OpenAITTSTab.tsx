import React, { useCallback } from 'react';
import {
  Stack,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  FormHelperText,
  Slider,
  FormControlLabel,
  Switch,
} from '@mui/material';
import { Eye as VisibilityIcon, EyeOff as VisibilityOffIcon } from 'lucide-react';

// OpenAI TTS配置接口
export interface OpenAITTSSettings {
  apiKey: string;
  showApiKey: boolean;
  selectedModel: string;
  selectedVoice: string;
  selectedFormat: string;
  speed: number;
  useStream: boolean;
}

// 组件Props接口
interface OpenAITTSTabProps {
  settings: OpenAITTSSettings;
  onSettingsChange: (settings: OpenAITTSSettings) => void;
}

// OpenAI TTS模型选项
const OPENAI_MODELS = [
  { value: 'tts-1', label: 'TTS-1 - 标准质量，速度快' },
  { value: 'tts-1-hd', label: 'TTS-1-HD - 高清质量，更自然' },
];

// OpenAI TTS语音选项
const OPENAI_VOICES = [
  { value: 'alloy', label: 'Alloy - 中性，平衡' },
  { value: 'echo', label: 'Echo - 男性，深沉' },
  { value: 'fable', label: 'Fable - 英式，优雅' },
  { value: 'onyx', label: 'Onyx - 男性，深沉有力' },
  { value: 'nova', label: 'Nova - 女性，年轻活泼' },
  { value: 'shimmer', label: 'Shimmer - 女性，温柔' },
];

// OpenAI TTS格式选项
const OPENAI_FORMATS = [
  { value: 'mp3', label: 'MP3 - 通用格式，兼容性好' },
  { value: 'opus', label: 'Opus - 高压缩比，适合网络传输' },
  { value: 'aac', label: 'AAC - 高质量，适合移动设备' },
  { value: 'flac', label: 'FLAC - 无损压缩，最高质量' },
  { value: 'wav', label: 'WAV - 无压缩，最大兼容性' },
  { value: 'pcm', label: 'PCM - 原始音频数据' },
];

/**
 * OpenAI TTS配置组件
 */
export const OpenAITTSTab: React.FC<OpenAITTSTabProps> = ({
  settings,
  onSettingsChange,
}) => {
  // 🚀 性能优化：使用useCallback缓存事件处理函数
  const handleApiKeyChange = useCallback((value: string) => {
    onSettingsChange({ ...settings, apiKey: value });
  }, [settings, onSettingsChange]);

  const handleShowApiKeyToggle = useCallback(() => {
    onSettingsChange({ ...settings, showApiKey: !settings.showApiKey });
  }, [settings, onSettingsChange]);

  const handleModelChange = useCallback((value: string) => {
    onSettingsChange({ ...settings, selectedModel: value });
  }, [settings, onSettingsChange]);

  const handleVoiceChange = useCallback((value: string) => {
    onSettingsChange({ ...settings, selectedVoice: value });
  }, [settings, onSettingsChange]);

  const handleFormatChange = useCallback((value: string) => {
    onSettingsChange({ ...settings, selectedFormat: value });
  }, [settings, onSettingsChange]);

  const handleSpeedChange = useCallback((value: number) => {
    onSettingsChange({ ...settings, speed: value });
  }, [settings, onSettingsChange]);

  const handleStreamToggle = useCallback((checked: boolean) => {
    onSettingsChange({ ...settings, useStream: checked });
  }, [settings, onSettingsChange]);

  return (
    <>
      <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
        OpenAI TTS API 设置
      </Typography>

      <Stack spacing={3}>
        <FormControl fullWidth variant="outlined">
          <TextField
            label="OpenAI API密钥"
            variant="outlined"
            value={settings.apiKey}
            onChange={(e) => handleApiKeyChange(e.target.value)}
            type={settings.showApiKey ? 'text' : 'password'}
            placeholder="请输入OpenAI API密钥"
            helperText="获取API密钥请访问：https://platform.openai.com/api-keys"
            slotProps={{
              input: {
                endAdornment: (
                  <IconButton
                    onClick={handleShowApiKeyToggle}
                    edge="end"
                  >
                    {settings.showApiKey ? <VisibilityOffIcon /> : <VisibilityIcon />}
                  </IconButton>
                ),
              },
            }}
            sx={{ mb: 2 }}
          />
        </FormControl>

        <FormControl fullWidth>
          <InputLabel>TTS模型</InputLabel>
          <Select
            value={settings.selectedModel}
            onChange={(e) => handleModelChange(e.target.value)}
            label="TTS模型"
            MenuProps={{
              disableAutoFocus: true,
              disableRestoreFocus: true
            }}
          >
            {OPENAI_MODELS.map((model) => (
              <MenuItem key={model.value} value={model.value}>
                {model.label}
              </MenuItem>
            ))}
          </Select>
          <FormHelperText>
            TTS-1适合快速生成，TTS-1-HD质量更高但速度较慢
          </FormHelperText>
        </FormControl>

        <FormControl fullWidth>
          <InputLabel>语音选择</InputLabel>
          <Select
            value={settings.selectedVoice}
            onChange={(e) => handleVoiceChange(e.target.value)}
            label="语音选择"
            MenuProps={{
              disableAutoFocus: true,
              disableRestoreFocus: true
            }}
          >
            {OPENAI_VOICES.map((voice) => (
              <MenuItem key={voice.value} value={voice.value}>
                {voice.label}
              </MenuItem>
            ))}
          </Select>
          <FormHelperText>
            选择您喜欢的语音风格，每种语音都有独特的特色
          </FormHelperText>
        </FormControl>

        <FormControl fullWidth>
          <InputLabel>输出格式</InputLabel>
          <Select
            value={settings.selectedFormat}
            onChange={(e) => handleFormatChange(e.target.value)}
            label="输出格式"
            MenuProps={{
              disableAutoFocus: true,
              disableRestoreFocus: true
            }}
          >
            {OPENAI_FORMATS.map((format) => (
              <MenuItem key={format.value} value={format.value}>
                {format.label}
              </MenuItem>
            ))}
          </Select>
          <FormHelperText>
            推荐使用MP3格式，兼容性最好
          </FormHelperText>
        </FormControl>

        <FormControl fullWidth>
          <Typography gutterBottom>语速控制</Typography>
          <Slider
            value={settings.speed}
            min={0.25}
            max={4.0}
            step={0.05}
            onChange={(_, value) => handleSpeedChange(value as number)}
            valueLabelDisplay="auto"
            marks={[
              { value: 0.25, label: '0.25x' },
              { value: 1.0, label: '1.0x' },
              { value: 4.0, label: '4.0x' }
            ]}
          />
          <FormHelperText>
            调整语音播放速度 (0.25x - 4.0x，默认1.0x)
          </FormHelperText>
        </FormControl>

        <FormControlLabel
          control={
            <Switch
              checked={settings.useStream}
              onChange={(e) => handleStreamToggle(e.target.checked)}
              color="primary"
            />
          }
          label="启用流式传输"
        />
        <FormHelperText>
          流式传输可以更快地开始播放，但可能影响音质
        </FormHelperText>
      </Stack>
    </>
  );
};

export default OpenAITTSTab;
