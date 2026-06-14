/**
 * HarmonyOS 权限请求对话框
 * 显示权限请求说明和引导
 */

import React, { useState } from 'react';
import {
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Alert,
  Box,
  Chip,
  Divider,
} from '@mui/material';
import BackButtonDialog from '../common/BackButtonDialog';
import {
  Shield,
  AlertCircle,
  CheckCircle,
  Settings,
  Info,
} from 'lucide-react';
import {
  HarmonyOSPermission,
  HARMONYOS_PERMISSION_CONFIG,
} from '../../shared/config/harmonyOSConfig';
import {
  harmonyOSPermissionService,
} from '../../shared/services/platform/harmonyos/HarmonyOSPermissionService';
import { createLogger } from '../../shared/services/infra/logger';

const logger = createLogger('HarmonyOSPermissionDialog');

interface PermissionDialogProps {
  open: boolean;
  onClose: () => void;
  permission: HarmonyOSPermission;
  onPermissionGranted?: () => void;
  onPermissionDenied?: () => void;
}

/**
 * 权限请求对话框组件
 */
export const HarmonyOSPermissionDialog: React.FC<PermissionDialogProps> = ({
  open,
  onClose,
  permission,
  onPermissionGranted,
  onPermissionDenied,
}) => {
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const config = HARMONYOS_PERMISSION_CONFIG[permission];

  const handleRequestPermission = async () => {
    setRequesting(true);
    setError(null);

    try {
      const result = await harmonyOSPermissionService.requestPermission(permission);

      if (result.status === 'granted') {
        onPermissionGranted?.();
        onClose();
      } else if (result.status === 'permanent_denied') {
        setShowSettings(true);
        setError(result.error || '权限被永久拒绝，请在设置中手动开启');
        onPermissionDenied?.();
      } else {
        setError(result.error || '权限被拒绝');
        onPermissionDenied?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '请求权限失败');
      onPermissionDenied?.();
    } finally {
      setRequesting(false);
    }
  };

  const handleOpenSettings = async () => {
    try {
      await harmonyOSPermissionService.openAppSettings();
      onClose();
    } catch (err) {
      logger.error('打开设置失败:', err);
    }
  };

  return (
    <BackButtonDialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
        }
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <Shield size={24} color="#FF9800" />
          <Typography variant="h6">
            {config.name}权限
          </Typography>
          {config.critical && (
            <Chip 
              label="必需" 
              color="error" 
              size="small"
            />
          )}
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box display="flex" flexDirection="column" gap={2}>
          {/* 权限说明 */}
          <Alert severity="info" icon={<Info size={20} />}>
            <Typography variant="body2">
              {config.description}
            </Typography>
          </Alert>

          {/* 使用原因 */}
          <Box>
            <Typography variant="subtitle2" gutterBottom color="text.secondary">
              为什么需要此权限？
            </Typography>
            <Typography variant="body2" color="text.primary">
              {config.reason}
            </Typography>
          </Box>

          <Divider />

          {/* 使用场景 */}
          <Box>
            <Typography variant="subtitle2" gutterBottom color="text.secondary">
              使用场景：
            </Typography>
            <List dense>
              {config.usageScenes.map((scene, index) => (
                <ListItem key={index} sx={{ py: 0.5 }}>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <CheckCircle size={16} color="#4CAF50" />
                  </ListItemIcon>
                  <ListItemText 
                    primary={scene}
                    primaryTypographyProps={{ variant: 'body2' }}
                  />
                </ListItem>
              ))}
            </List>
          </Box>

          {/* 错误提示 */}
          {error && (
            <Alert severity="error" icon={<AlertCircle size={20} />}>
              {error}
            </Alert>
          )}

          {/* 引导到设置 */}
          {showSettings && (
            <Alert 
              severity="warning" 
              icon={<Settings size={20} />}
              action={
                <Button 
                  color="inherit" 
                  size="small"
                  onClick={handleOpenSettings}
                >
                  去设置
                </Button>
              }
            >
              权限已被永久拒绝，请在系统设置中手动开启
            </Alert>
          )}

          {/* 鸿蒙系统提示 */}
          <Alert severity="info" icon={<Shield size={20} />}>
            <Typography variant="caption">
              鸿蒙系统为了保护您的隐私，需要您明确授予此权限
            </Typography>
          </Alert>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={requesting}>
          取消
        </Button>
        {!showSettings ? (
          <Button
            onClick={handleRequestPermission}
            variant="contained"
            color="primary"
            disabled={requesting}
            startIcon={<Shield size={18} />}
          >
            {requesting ? '请求中...' : '授予权限'}
          </Button>
        ) : (
          <Button
            onClick={handleOpenSettings}
            variant="contained"
            color="warning"
            startIcon={<Settings size={18} />}
          >
            打开设置
          </Button>
        )}
      </DialogActions>
    </BackButtonDialog>
  );
};

export default HarmonyOSPermissionDialog;

