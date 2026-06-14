import React, { useState } from 'react';
import {
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  IconButton,
  Alert,
  Tabs,
  Tab,
  Snackbar,
  alpha
} from '@mui/material';
import BackButtonDialog from '../common/BackButtonDialog';
import { X, Copy, Download, Share2 } from 'lucide-react';
import type { AppearanceConfig } from '../../shared/utils/appearanceConfig';
import { generateShareLink, encodeAppearanceConfig, exportAppearanceConfigToFile, exportAppearanceConfigToFolder } from '../../shared/utils/appearanceConfig';
import { Capacitor } from '@capacitor/core';
import { createLogger } from '../../shared/services/infra/logger';

const logger = createLogger('ShareAppearanceDialog');

interface ShareAppearanceDialogProps {
  open: boolean;
  onClose: () => void;
  config: AppearanceConfig;
}

const ShareAppearanceDialog: React.FC<ShareAppearanceDialogProps> = ({ open, onClose, config }) => {
  const [tabValue, setTabValue] = useState(0);
  const [shareLink, setShareLink] = useState('');
  const [shareCode, setShareCode] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  // 生成分享内容
  React.useEffect(() => {
    if (open) {
      try {
        const link = generateShareLink(config);
        const code = encodeAppearanceConfig(config);
        setShareLink(link);
        setShareCode(code);
      } catch (error) {
        logger.error('生成分享内容失败:', error);
      }
    }
  }, [open, config]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareLink).then(() => {
      setSnackbarMessage('分享链接已复制到剪贴板');
      setSnackbarOpen(true);
    });
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(shareCode).then(() => {
      setSnackbarMessage('分享码已复制到剪贴板');
      setSnackbarOpen(true);
    });
  };

  const handleDownloadConfig = async () => {
    try {
      const filename = `appearance-config-${new Date().getTime()}.json`;
      
      // 如果是原生平台，使用文件夹选择器
      if (Capacitor.isNativePlatform()) {
        const savedPath = await exportAppearanceConfigToFolder(config, filename);
        setSnackbarMessage(`配置已保存到: ${savedPath}`);
        setSnackbarOpen(true);
      } else {
        // Web 平台使用浏览器下载
        exportAppearanceConfigToFile(config, filename);
        setSnackbarMessage('配置文件已下载到浏览器下载文件夹');
        setSnackbarOpen(true);
      }
    } catch (error) {
      if (error instanceof Error && error.message === '用户取消选择') {
        return; // 用户取消，不显示错误
      }
      setSnackbarMessage('导出失败，请重试');
      setSnackbarOpen(true);
    }
  };

  const handleShare = async () => {
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({
          title: '我的外观设置',
          text: '快来试试我的外观设置吧！',
          url: shareLink
        });
      } catch (error) {
        logger.error('分享失败:', error);
      }
    } else {
      handleCopyLink();
    }
  };

  return (
    <>
      <BackButtonDialog
        open={open}
        onClose={onClose}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          }
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          pb: 1
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Share2 size={24} />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              分享我的外观设置
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <X size={20} />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ pt: 2 }}>
          <Tabs 
            value={tabValue} 
            onChange={(_, newValue) => setTabValue(newValue)}
            sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab label="分享链接" />
            <Tab label="分享码" />
          </Tabs>

          {/* 分享链接 */}
          {tabValue === 0 && (
            <Box>
              <Alert severity="info" sx={{ mb: 2 }}>
                复制下方链接分享给好友，他们点击后即可应用你的外观设置
              </Alert>
              <TextField
                fullWidth
                multiline
                rows={3}
                value={shareLink}
                InputProps={{
                  readOnly: true,
                  sx: {
                    fontFamily: 'monospace',
                    fontSize: '0.875rem',
                    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.05),
                  }
                }}
                sx={{ mb: 2 }}
              />
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<Copy size={18} />}
                  onClick={handleCopyLink}
                >
                  复制链接
                </Button>
                {typeof navigator !== 'undefined' && 'share' in navigator && (
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<Share2 size={18} />}
                    onClick={handleShare}
                  >
                    分享
                  </Button>
                )}
              </Box>
            </Box>
          )}

          {/* 分享码 */}
          {tabValue === 1 && (
            <Box>
              <Alert severity="info" sx={{ mb: 2 }}>
                复制下方分享码，好友可以在导入设置中粘贴使用
              </Alert>
              <TextField
                fullWidth
                multiline
                rows={6}
                value={shareCode}
                InputProps={{
                  readOnly: true,
                  sx: {
                    fontFamily: 'monospace',
                    fontSize: '0.75rem',
                    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.05),
                    wordBreak: 'break-all',
                  }
                }}
                sx={{ mb: 2 }}
              />
              <Button
                fullWidth
                variant="contained"
                startIcon={<Copy size={18} />}
                onClick={handleCopyCode}
              >
                复制分享码
              </Button>
            </Box>
          )}

          <Box sx={{ mt: 3, pt: 2, borderTop: 1, borderColor: 'divider' }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              其他选项
            </Typography>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<Download size={18} />}
              onClick={handleDownloadConfig}
            >
              导出为文件
            </Button>
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} variant="text">
            关闭
          </Button>
        </DialogActions>
      </BackButtonDialog>

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={() => setSnackbarOpen(false)}
        message={snackbarMessage}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </>
  );
};

export default ShareAppearanceDialog;
