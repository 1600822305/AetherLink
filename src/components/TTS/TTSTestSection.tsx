import React from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
} from '@mui/material';
import { Volume2 as VolumeUpIcon } from 'lucide-react';
import { useTranslation } from '../../i18n';

interface TTSTestSectionProps {
  testText: string;
  setTestText: (text: string) => void;
  handleTestTTS: () => Promise<void>;
  isTestPlaying: boolean;
  enableTTS: boolean;
  selectedTTSService: 'siliconflow' | 'openai' | 'azure' | 'capacitor' | 'gemini' | 'elevenlabs' | 'minimax' | 'volcano' | 'webspeech';
  openaiApiKey?: string;
  azureApiKey?: string;
  siliconFlowApiKey?: string;
  geminiApiKey?: string;
  elevenlabsApiKey?: string;
  minimaxApiKey?: string;
}

const TTSTestSection: React.FC<TTSTestSectionProps> = ({
  testText,
  setTestText,
  handleTestTTS,
  isTestPlaying,
  enableTTS,
  selectedTTSService,
  openaiApiKey,
  azureApiKey,
  siliconFlowApiKey,
}) => {
  const { t } = useTranslation();

  return (
    <Box sx={{ mt: { xs: 2, sm: 3 } }}>
      <Typography
        variant="h6"
        sx={{
          mb: { xs: 2, sm: 3 },
          fontWeight: 600,
          fontSize: { xs: '1.1rem', sm: '1.25rem', md: '1.5rem' },
          color: 'text.primary',
        }}
      >
        {t('settings.voice.test.tts.title')}
      </Typography>

      <TextField
        fullWidth
        multiline
        rows={3} // 固定行数
        label={t('settings.voice.test.tts.textLabel')}
        value={testText}
        onChange={(e) => setTestText(e.target.value)}
        variant="outlined"
        sx={{
          mb: { xs: 2, sm: 3 },
          '& .MuiInputBase-root': {
            fontSize: { xs: '0.9rem', sm: '1rem' },
            minHeight: { xs: '80px', sm: '100px' }, // 响应式最小高度
          },
          '& .MuiInputLabel-root': {
            fontSize: { xs: '0.9rem', sm: '1rem' },
          },
          '& .MuiOutlinedInput-notchedOutline': {
            borderRadius: { xs: 1.5, sm: 2 },
          },
        }}
      />

      <Box sx={{
        display: 'flex',
        justifyContent: 'flex-start', // 靠左对齐
        flexDirection: { xs: 'column', sm: 'row' }, // 移动端垂直布局
        gap: { xs: 2, sm: 0 }, // 移动端按钮间距
      }}>
        <Button
          variant="contained"
          color={isTestPlaying ? "error" : "primary"}
          startIcon={<VolumeUpIcon />}
          onClick={handleTestTTS}
          disabled={
            !enableTTS ||
            (selectedTTSService === 'openai' && !openaiApiKey) ||
            (selectedTTSService === 'azure' && !azureApiKey) ||
            (selectedTTSService === 'siliconflow' && !siliconFlowApiKey)
            // Capacitor TTS 不需要 API 密钥，总是可用
          }
          size={window.innerWidth < 600 ? "large" : "medium"} // 移动端大按钮
          sx={{
            minHeight: { xs: 48, sm: 40 }, // 响应式按钮高度
            fontSize: { xs: '0.9rem', sm: '1rem' },
            fontWeight: 600,
            borderRadius: { xs: 2, sm: 1.5 },
            px: { xs: 3, sm: 2 },
            '&:hover': {
              transform: 'translateY(-1px)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            },
            transition: 'all 0.2s ease-in-out',
          }}
        >
          {isTestPlaying ? t('settings.voice.test.tts.stop') : t('settings.voice.test.tts.play')}
        </Button>
      </Box>
    </Box>
  );
};

export default TTSTestSection;
