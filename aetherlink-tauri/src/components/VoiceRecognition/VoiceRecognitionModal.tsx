import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Chip,
  IconButton,
} from '@mui/material';
import { Mic, MicOff, X, Volume2 } from 'lucide-react';

interface VoiceRecognitionModalProps {
  open: boolean;
  onClose: () => void;
  isListening: boolean;
  recognitionText: string;
  permissionStatus: 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale' | 'unknown';
  error: any;
  onStartRecognition: () => void;
  onStopRecognition: () => void;
  onRequestPermissions: () => void;
  language: string;
}

const VoiceRecognitionModal: React.FC<VoiceRecognitionModalProps> = ({
  open,
  onClose,
  isListening,
  recognitionText,
  permissionStatus,
  error,
  onStartRecognition,
  onStopRecognition,
  onRequestPermissions,
  language,
}) => {
  const getPermissionStatusColor = () => {
    switch (permissionStatus) {
      case 'granted': return 'success';
      case 'denied': return 'error';
      case 'prompt':
      case 'prompt-with-rationale': return 'warning';
      default: return 'default';
    }
  };

  const getPermissionStatusText = () => {
    switch (permissionStatus) {
      case 'granted': return '已授权';
      case 'denied': return '已拒绝';
      case 'prompt': return '需要授权';
      case 'prompt-with-rationale': return '需要说明';
      case 'unknown': return '未知状态';
      default: return '检查中...';
    }
  };

  const getLanguageDisplayName = (lang: string) => {
    switch (lang) {
      case 'zh-CN': return '中文 (普通话)';
      case 'en-US': return 'English (US)';
      case 'en-GB': return 'English (UK)';
      case 'ja-JP': return '日本語';
      case 'ko-KR': return '한국어';
      default: return lang;
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          minHeight: 400,
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pb: 1,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Volume2 size={20} color="#1976d2" />
          <Typography variant="h6" component="div">
            语音识别
          </Typography>
        </Box>
        <IconButton
          onClick={onClose}
          size="small"
          sx={{ color: 'text.secondary' }}
        >
          <X size={18} />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        {/* 权限状态 */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            权限状态
          </Typography>
          <Chip
            label={getPermissionStatusText()}
            color={getPermissionStatusColor() as any}
            size="small"
            sx={{ mr: 1 }}
          />
          <Chip
            label={getLanguageDisplayName(language)}
            variant="outlined"
            size="small"
          />
        </Box>

        {/* 错误提示 */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error.message || '语音识别出现错误'}
          </Alert>
        )}

        {/* 权限请求 */}
        {permissionStatus !== 'granted' && (
          <Alert severity="warning" sx={{ mb: 3 }}>
            <Typography variant="body2" sx={{ mb: 1 }}>
              需要麦克风权限才能使用语音识别功能
            </Typography>
            <Button
              variant="outlined"
              size="small"
              onClick={onRequestPermissions}
            >
              请求权限
            </Button>
          </Alert>
        )}

        {/* 语音识别状态 */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            py: 4,
            minHeight: 200,
            justifyContent: 'center',
          }}
        >
          {isListening ? (
            <>
              <Box
                sx={{
                  position: 'relative',
                  mb: 3,
                  animation: 'pulse 1.5s ease-in-out infinite',
                  '@keyframes pulse': {
                    '0%': { transform: 'scale(1)', opacity: 1 },
                    '50%': { transform: 'scale(1.1)', opacity: 0.7 },
                    '100%': { transform: 'scale(1)', opacity: 1 },
                  },
                }}
              >
                <CircularProgress
                  size={80}
                  thickness={3}
                  color="secondary"
                  sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    marginTop: '-40px',
                    marginLeft: '-40px',
                  }}
                />
                <Mic
                  size={48}
                  color="#9c27b0"
                  style={{ zIndex: 1 }}
                />
              </Box>
              <Typography variant="h6" color="secondary" sx={{ mb: 1 }}>
                正在聆听...
              </Typography>
              <Typography variant="body2" color="text.secondary">
                请开始说话
              </Typography>
            </>
          ) : (
            <>
              <MicOff
                size={48}
                color="#9e9e9e"
                style={{ marginBottom: 16 }}
              />
              <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
                语音识别已停止
              </Typography>
              <Typography variant="body2" color="text.secondary">
                点击开始按钮开始语音识别
              </Typography>
            </>
          )}
        </Box>

        {/* 识别结果 */}
        {recognitionText && (
          <Box
            sx={{
              mt: 3,
              p: 2,
              bgcolor: 'background.default',
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              识别结果:
            </Typography>
            <Typography variant="body1" sx={{ wordBreak: 'break-word' }}>
              {recognitionText}
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} color="inherit">
          关闭
        </Button>
        {permissionStatus === 'granted' && (
          <Button
            variant="contained"
            color={isListening ? "error" : "primary"}
            onClick={isListening ? onStopRecognition : onStartRecognition}
            startIcon={isListening ? <MicOff size={16} /> : <Mic size={16} />}
          >
            {isListening ? "停止识别" : "开始识别"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default VoiceRecognitionModal;
