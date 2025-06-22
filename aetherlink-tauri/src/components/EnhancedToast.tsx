import React, { useState, useEffect } from 'react';
import {
  Snackbar,
  Alert,
  AlertTitle,
  Box,
  IconButton,
  LinearProgress,
  Typography,
  Slide
} from '@mui/material';
import type { SlideProps } from '@mui/material';
import {
  X,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Info,
  Upload
} from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'upload';

interface ToastMessage {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
  progress?: number;
  showProgress?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface EnhancedToastProps {
  messages: ToastMessage[];
  onClose: (id: string) => void;
  maxVisible?: number;
}

function SlideTransition(props: SlideProps) {
  return <Slide {...props} direction="up" />;
}

const EnhancedToast: React.FC<EnhancedToastProps> = ({
  messages,
  onClose,
  maxVisible = 3
}) => {
  const [visibleMessages, setVisibleMessages] = useState<ToastMessage[]>([]);

  useEffect(() => {
    // 只显示最新的几条消息
    setVisibleMessages(messages.slice(-maxVisible));
  }, [messages, maxVisible]);

  const getIcon = (type: ToastType) => {
    switch (type) {
      case 'success':
        return <CheckCircle size={20} />;
      case 'error':
        return <AlertCircle size={20} />;
      case 'warning':
        return <AlertTriangle size={20} />;
      case 'info':
        return <Info size={20} />;
      case 'upload':
        return <Upload size={20} />;
      default:
        return <Info size={20} />;
    }
  };

  const getSeverity = (type: ToastType): 'success' | 'error' | 'warning' | 'info' => {
    switch (type) {
      case 'upload':
        return 'info';
      default:
        return type;
    }
  };

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        maxWidth: '400px',
        width: '100%'
      }}
    >
      {visibleMessages.map((toast, index) => (
        <Snackbar
          key={toast.id}
          open={true}
          autoHideDuration={toast.duration || 6000}
          onClose={() => onClose(toast.id)}
          TransitionComponent={SlideTransition}
          sx={{
            position: 'relative',
            transform: `translateY(${-index * 8}px)`,
            zIndex: 9999 - index,
            '& .MuiSnackbar-root': {
              position: 'relative'
            }
          }}
        >
          <Alert
            severity={getSeverity(toast.type)}
            icon={getIcon(toast.type)}
            sx={{
              width: '100%',
              alignItems: 'flex-start',
              '& .MuiAlert-message': {
                width: '100%',
                padding: 0
              },
              '& .MuiAlert-action': {
                padding: '4px 0 0 0',
                marginRight: 0
              }
            }}
            action={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {toast.action && (
                  <Typography
                    variant="button"
                    sx={{
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      fontSize: '0.75rem',
                      '&:hover': {
                        opacity: 0.8
                      }
                    }}
                    onClick={toast.action.onClick}
                  >
                    {toast.action.label}
                  </Typography>
                )}
                <IconButton
                  size="small"
                  onClick={() => onClose(toast.id)}
                  sx={{ color: 'inherit' }}
                >
                  <X size={16} />
                </IconButton>
              </Box>
            }
          >
            <Box sx={{ width: '100%' }}>
              {toast.title && (
                <AlertTitle sx={{ marginBottom: '4px', fontSize: '0.875rem' }}>
                  {toast.title}
                </AlertTitle>
              )}
              <Typography variant="body2" sx={{ marginBottom: toast.showProgress ? '8px' : 0 }}>
                {toast.message}
              </Typography>

              {toast.showProgress && (
                <Box sx={{ width: '100%', marginTop: '8px' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <Typography variant="caption" color="textSecondary">
                      进度
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      {Math.round(toast.progress || 0)}%
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant={toast.progress !== undefined ? 'determinate' : 'indeterminate'}
                    value={toast.progress}
                    sx={{
                      height: '4px',
                      borderRadius: '2px',
                      backgroundColor: 'rgba(255, 255, 255, 0.2)',
                      '& .MuiLinearProgress-bar': {
                        borderRadius: '2px'
                      }
                    }}
                  />
                </Box>
              )}
            </Box>
          </Alert>
        </Snackbar>
      ))}
    </Box>
  );
};

// Toast管理器
class ToastManager {
  private messages: ToastMessage[] = [];
  private listeners: ((messages: ToastMessage[]) => void)[] = [];

  subscribe(listener: (messages: ToastMessage[]) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach(listener => listener([...this.messages]));
  }

  show(toast: Omit<ToastMessage, 'id'>) {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const message: ToastMessage = { ...toast, id };

    this.messages.push(message);
    this.notify();

    // 自动移除消息
    if (toast.duration !== 0) {
      setTimeout(() => {
        this.remove(id);
      }, toast.duration || 6000);
    }

    return id;
  }

  remove(id: string) {
    this.messages = this.messages.filter(m => m.id !== id);
    this.notify();
  }

  clear() {
    this.messages = [];
    this.notify();
  }

  // 便捷方法
  success(message: string, title?: string, options?: Partial<ToastMessage>) {
    return this.show({ type: 'success', message, title, ...options });
  }

  error(message: string, title?: string, options?: Partial<ToastMessage>) {
    return this.show({ type: 'error', message, title, ...options });
  }

  warning(message: string, title?: string, options?: Partial<ToastMessage>) {
    return this.show({ type: 'warning', message, title, ...options });
  }

  info(message: string, title?: string, options?: Partial<ToastMessage>) {
    return this.show({ type: 'info', message, title, ...options });
  }

  upload(message: string, title?: string, options?: Partial<ToastMessage>) {
    return this.show({
      type: 'upload',
      message,
      title,
      showProgress: true,
      duration: 0, // 不自动消失
      ...options
    });
  }

  updateProgress(id: string, progress: number, message?: string) {
    const messageIndex = this.messages.findIndex(m => m.id === id);
    if (messageIndex !== -1) {
      this.messages[messageIndex] = {
        ...this.messages[messageIndex],
        progress,
        ...(message && { message })
      };
      this.notify();
    }
  }
}

export const toastManager = new ToastManager();
export default EnhancedToast;
