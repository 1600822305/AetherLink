import React, { useState, useRef } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Chip,
} from '@mui/material';
import { Mic as MicIcon, Square as StopIcon, RotateCcw as ReplayIcon } from 'lucide-react';
import { openAIWhisperService } from '../../shared/services/OpenAIWhisperService';
import type { OpenAIWhisperSettings, WhisperTranscriptionResponse } from '../../shared/types/voice';

interface WhisperTestSectionProps {
  settings: OpenAIWhisperSettings;
  enabled: boolean;
}

const WhisperTestSection: React.FC<WhisperTestSectionProps> = ({ settings, enabled }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcription, setTranscription] = useState<WhisperTranscriptionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // 开始录制
  const startRecording = async () => {
    try {
      setError(null);
      setTranscription(null);

      // 检查API密钥
      if (!settings.apiKey) {
        setError('请先设置OpenAI API密钥');
        return;
      }

      // 应用设置到服务
      openAIWhisperService.setApiKey(settings.apiKey);
      openAIWhisperService.setModel(settings.model);
      if (settings.language) {
        openAIWhisperService.setLanguage(settings.language);
      }
      openAIWhisperService.setTemperature(settings.temperature || 0);
      openAIWhisperService.setResponseFormat(settings.responseFormat || 'json');

      // 请求麦克风权限并开始录制
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.addEventListener('dataavailable', (event) => {
        audioChunksRef.current.push(event.data);
      });

      mediaRecorder.addEventListener('stop', async () => {
        try {
          setIsRecording(false);
          setIsProcessing(true);

          // 创建音频Blob
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

          // 调用Whisper API转录
          const result = await openAIWhisperService.transcribeAudio(audioBlob);
          setTranscription(result);
        } catch (err: any) {
          setError(err.message || '转录失败');
        } finally {
          setIsProcessing(false);
          // 停止所有轨道
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
          }
        }
      });

      // 开始录制
      mediaRecorder.start();
      setIsRecording(true);

      // 设置定时器自动停止录制
      setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
      }, 5000);
    } catch (err: any) {
      setError(err.message || '无法访问麦克风');
      setIsRecording(false);
    }
  };

  // 停止录制
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  // 清除结果
  const clearResults = () => {
    setTranscription(null);
    setError(null);
  };

  return (
    <Box sx={{ mt: 4, mb: 2 }}>
      <Typography variant="h6" gutterBottom>
        测试OpenAI Whisper语音识别
      </Typography>

      {!enabled && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          请先启用语音识别功能
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <Button
          variant="contained"
          color={isRecording ? "error" : "primary"}
          startIcon={isRecording ? <StopIcon /> : <MicIcon />}
          onClick={isRecording ? stopRecording : startRecording}
          disabled={!enabled || isProcessing || !settings.apiKey}
        >
          {isRecording ? "停止录制" : "开始录制"}
        </Button>

        <Button
          variant="outlined"
          startIcon={<ReplayIcon />}
          onClick={clearResults}
          disabled={isRecording || isProcessing || (!transcription && !error)}
        >
          清除结果
        </Button>
      </Box>

      {isProcessing && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, my: 3 }}>
          <CircularProgress size={24} />
          <Typography>正在处理音频...</Typography>
        </Box>
      )}

      {transcription && (
        <Paper
          elevation={1}
          sx={{
            p: 3,
            mb: 3,
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
          }}
        >
          <Typography variant="subtitle1" gutterBottom fontWeight={500}>
            识别结果:
          </Typography>

          <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
            {transcription.text}
          </Typography>

          {transcription.language && (
            <Chip
              label={`检测到语言: ${transcription.language}`}
              color="primary"
              size="small"
              sx={{ mt: 2, mr: 1 }}
            />
          )}

          {transcription.duration && (
            <Chip
              label={`音频时长: ${transcription.duration.toFixed(2)}秒`}
              color="secondary"
              size="small"
              sx={{ mt: 2 }}
            />
          )}
        </Paper>
      )}

      <Alert severity="info" sx={{ mb: 2 }}>
        提示: 点击"开始录制"按钮，系统将录制5秒的音频，然后自动使用OpenAI Whisper API进行转录。
      </Alert>
    </Box>
  );
};

export default WhisperTestSection;