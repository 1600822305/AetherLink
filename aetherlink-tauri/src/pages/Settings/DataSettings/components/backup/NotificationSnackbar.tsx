import React from 'react';
import { Snackbar, Alert } from '@mui/material';

interface NotificationSnackbarProps {
  open: boolean;
  message: string;
  severity: 'success' | 'error' | 'info' | 'warning';
  onClose: () => void;
}

/**
 * 通知提示组件
 */
const NotificationSnackbar: React.FC<NotificationSnackbarProps> = ({
  open,
  message,
  severity,
  onClose
}) => {
  // 根据不同的severity自定义颜色
  const getAlertColor = (type: string) => {
    switch(type) {
      case 'success': return '#10B981';
      case 'error': return '#EF4444';
      case 'warning': return '#F59E0B';
      case 'info': return '#9333EA';
      default: return '#9333EA';
    }
  };
  
  // 根据消息长度和严重程度调整显示时间
  const getAutoHideDuration = () => {
    // 错误信息显示更长时间
    if (severity === 'error') return 10000;
    
    // 成功信息根据长度调整
    if (message.length > 100) return 8000;
    
    // 默认时间
    return 6000;
  };

  return (
    <Snackbar 
      open={open} 
      autoHideDuration={getAutoHideDuration()} 
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      sx={{
        maxWidth: '90%',
        width: '500px'
      }}
    >
      <Alert 
        onClose={onClose} 
        severity={severity} 
        sx={{ 
          width: '100%',
          borderRadius: 2,
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          whiteSpace: 'pre-line', // 允许换行符
          fontSize: '0.9rem',
          '&.MuiAlert-filledSuccess': {
            bgcolor: getAlertColor('success')
          },
          '&.MuiAlert-filledError': {
            bgcolor: getAlertColor('error')
          },
          '&.MuiAlert-filledWarning': {
            bgcolor: getAlertColor('warning')
          },
          '&.MuiAlert-filledInfo': {
            bgcolor: getAlertColor('info')
          }
        }}
        variant="filled"
      >
        {message}
      </Alert>
    </Snackbar>
  );
};

export default NotificationSnackbar; 