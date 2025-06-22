import React, { useEffect, useState } from 'react';
import { 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  Button, 
  Typography, 
  Box,
  Paper
} from '@mui/material';
import { MessageCircle, X } from 'lucide-react';

// QQ群链接
const QQ_GROUP_URL = 'http://qm.qq.com/cgi-bin/qm/qr?_wv=1027&k=V-b46WoBNLIM4oc34JMULwoyJ3hyrKac&authKey=q%2FSwCcxda4e55ygtwp3h9adQXhqBLZ9wJdvM0QxTjXQkbxAa2tHoraOGy2fiibyY&noverify=0&group_code=930126592';

// 提示内容版本，每次更新时更改此值
const NOTICE_VERSION = '1.0';

// 检查是否需要显示更新提示
const shouldShowNotice = () => {
  const lastShownVersion = localStorage.getItem('update-notice-version');
  return lastShownVersion !== NOTICE_VERSION;
};

// 设置已显示标记
const markNoticeShown = () => {
  localStorage.setItem('update-notice-version', NOTICE_VERSION);
};

const UpdateNoticeDialog: React.FC = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // 检查是否需要显示提示
    if (shouldShowNotice()) {
      setOpen(true);
    }
  }, []);

  const handleClose = () => {
    setOpen(false);
    markNoticeShown();
  };

  const handleJoinQQGroup = async () => {
    try {
      // 使用传统方法打开链接 - 避免使用Capacitor插件
      window.open(QQ_GROUP_URL, '_blank');
    } catch (error) {
      console.error('打开浏览器失败:', error);
    }
    // 不关闭弹窗，让用户可以继续查看内容
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          boxShadow: 8,
        }
      }}
    >
      <DialogTitle sx={{ 
        pb: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <MessageCircle color="primary" size={24} style={{ marginRight: 8 }} />
          <Typography variant="h6" component="div" fontWeight="bold">
            AetherLink 最新消息
          </Typography>
        </Box>
        <Button
          size="small"
          onClick={handleClose}
          sx={{ minWidth: 'auto', p: 0.5 }}
          color="inherit"
        >
          <X size={20} />
        </Button>
      </DialogTitle>
      
      <DialogContent dividers>
        <Typography variant="body1" paragraph>
          欢迎使用 AetherLink！这是一款功能强大的AI助手应用，我们希望它能够帮助您更高效地完成各种任务。
        </Typography>
        
        <Typography variant="body1" paragraph>
          我们一直在努力改进应用体验，如果您在使用过程中遇到任何问题或有任何建议，欢迎加入我们的QQ交流群进行反馈。
        </Typography>
        
        <Paper
          elevation={2}
          sx={{
            p: 2,
            mt: 2,
            mb: 2,
            borderRadius: 2,
            bgcolor: (theme) => theme.palette.mode === 'dark' 
              ? 'rgba(147, 51, 234, 0.1)' 
              : 'rgba(147, 51, 234, 0.05)',
            border: (theme) => `1px solid ${
              theme.palette.mode === 'dark' 
                ? 'rgba(147, 51, 234, 0.2)' 
                : 'rgba(147, 51, 234, 0.1)'
            }`
          }}
        >
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
            加入我们的用户交流群:
          </Typography>
          <Typography variant="body2" gutterBottom>
            群号: 930126592
          </Typography>
          <Button 
            variant="contained" 
            color="primary"
            onClick={handleJoinQQGroup}
            sx={{ mt: 1 }}
          >
            点击加入QQ群
          </Button>
        </Paper>
        
        <Typography variant="body2" color="text.secondary">
          感谢您的支持，我们将继续努力为您提供更好的服务！
        </Typography>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={handleClose} color="primary">
          我知道了
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default UpdateNoticeDialog; 