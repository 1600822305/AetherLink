import React from 'react';
import { Box, CircularProgress, Typography, Paper, IconButton } from '@mui/material';
import { X as CloseIcon, CheckCircle as CheckCircleIcon, AlertCircle as ErrorIcon } from 'lucide-react';

export type ScraperStatus = 'parsing' | 'success' | 'error' | 'idle';

interface UrlScraperStatusProps {
  status: ScraperStatus;
  url: string;
  error?: string;
  onClose: () => void;
}

const UrlScraperStatus: React.FC<UrlScraperStatusProps> = ({
  status,
  url,
  error,
  onClose
}) => {
  // 根据不同状态显示不同的组件
  const renderStatusContent = () => {
    switch (status) {
      case 'parsing':
        return (
          <>
            <CircularProgress size={20} sx={{ mr: 1 }} />
            <Typography variant="body2">
              正在解析网页内容...
            </Typography>
          </>
        );
      case 'success':
        return (
          <>
            <CheckCircleIcon color="green" style={{ marginRight: 8 }} />
            <Typography variant="body2">
              网页内容已解析，发送以将其添加到您的消息
            </Typography>
          </>
        );
      case 'error':
        return (
          <>
            <ErrorIcon color="red" style={{ marginRight: 8 }} />
            <Typography variant="body2" color="error">
              {error || '网页解析失败'}
            </Typography>
          </>
        );
      default:
        return null;
    }
  };

  if (status === 'idle') {
    return null;
  }

  return (
    <Paper
      elevation={1}
      sx={{
        width: '100%',
        maxWidth: '600px',
        p: 1,
        mb: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderRadius: '8px',
        backgroundColor: status === 'error' ? '#FFF5F5' : '#F6FAFE'
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', overflow: 'hidden', flexGrow: 1 }}>
        {renderStatusContent()}
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', ml: 1 }}>
        <Typography variant="caption" noWrap sx={{ maxWidth: '150px', mr: 1, color: 'text.secondary' }}>
          {url}
        </Typography>
        <IconButton size="small" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
    </Paper>
  );
};

export default UrlScraperStatus;