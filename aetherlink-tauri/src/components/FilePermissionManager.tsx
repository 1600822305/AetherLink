import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Alert,
  Chip,
  CircularProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider
} from '@mui/material';
import {
  Shield,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Folder,
  Image,
  FileText,
  Settings
} from 'lucide-react';
import { advancedFileManagerService } from '../shared/services/AdvancedFileManagerService';
import { toastManager } from './EnhancedToast';

interface PermissionStatus {
  granted: boolean;
  message: string;
  loading: boolean;
}

export const FilePermissionManager: React.FC = () => {
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>({
    granted: false,
    message: '',
    loading: true
  });
  const [requesting, setRequesting] = useState(false);

  // 检查权限状态
  const checkPermissions = async () => {
    try {
      setPermissionStatus(prev => ({ ...prev, loading: true }));
      const result = await advancedFileManagerService.checkPermissions();
      setPermissionStatus({
        granted: result.granted,
        message: result.message,
        loading: false
      });
    } catch (error) {
      setPermissionStatus({
        granted: false,
        message: '检查权限失败: ' + (error instanceof Error ? error.message : String(error)),
        loading: false
      });
    }
  };

  // 请求权限
  const requestPermissions = async () => {
    try {
      setRequesting(true);
      const result = await advancedFileManagerService.requestPermissions();
      setPermissionStatus({
        granted: result.granted,
        message: result.message,
        loading: false
      });
      
      if (!result.granted) {
        // 如果权限被拒绝，提供更详细的指导
        setPermissionStatus(prev => ({
          ...prev,
          message: '权限被拒绝。请在系统设置中手动授予"所有文件访问权限"。'
        }));
      }
    } catch (error) {
      setPermissionStatus({
        granted: false,
        message: '请求权限失败: ' + (error instanceof Error ? error.message : String(error)),
        loading: false
      });
    } finally {
      setRequesting(false);
    }
  };

  // 打开系统设置
  const openSystemSettings = async () => {
    try {
      // 尝试打开应用设置页面
      const { Capacitor } = await import('@capacitor/core');
      if (Capacitor.isNativePlatform()) {
        // 在原生平台上，可以尝试打开应用设置
        const { Browser } = await import('@capacitor/browser');
        await Browser.open({
          url: 'app-settings:'
        });
      } else {
        // 在Web平台上显示指导信息
        toastManager.info('请前往：设置 > 应用 > AetherLink > 权限 > 文件和媒体 > 允许管理所有文件', '权限设置指导');
      }
    } catch (error) {
      // 如果无法打开设置，显示手动指导
      toastManager.info('请手动前往：设置 > 应用 > AetherLink > 权限 > 文件和媒体 > 允许管理所有文件', '权限设置指导');
    }
  };

  useEffect(() => {
    checkPermissions();
  }, []);

  const getStatusIcon = () => {
    if (permissionStatus.loading) {
      return <CircularProgress size={24} />;
    }
    return permissionStatus.granted ? 
      <CheckCircle color="success" /> : 
      <XCircle color="error" />;
  };

  const getStatusColor = () => {
    if (permissionStatus.loading) return 'info';
    return permissionStatus.granted ? 'success' : 'error';
  };

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Shield size={24} />
          <Typography variant="h6">文件访问权限</Typography>
          <Chip 
            icon={getStatusIcon()}
            label={permissionStatus.granted ? '已授权' : '未授权'}
            color={getStatusColor()}
            variant="outlined"
          />
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          为了使用文件管理功能，应用需要访问设备存储的权限。
        </Typography>

        {/* 权限说明 */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            权限用途：
          </Typography>
          <List dense>
            <ListItem>
              <ListItemIcon>
                <Folder size={20} />
              </ListItemIcon>
              <ListItemText 
                primary="浏览文件和文件夹" 
                secondary="查看设备上的文件结构"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <FileText size={20} />
              </ListItemIcon>
              <ListItemText 
                primary="编辑文本文件" 
                secondary="查看和编辑代码、文档等文件"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <Image size={20} />
              </ListItemIcon>
              <ListItemText 
                primary="访问媒体文件" 
                secondary="查看图片、视频、音频文件"
              />
            </ListItem>
          </List>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* 状态显示 */}
        {permissionStatus.message && (
          <Alert 
            severity={permissionStatus.granted ? 'success' : 'warning'} 
            sx={{ mb: 2 }}
            icon={permissionStatus.granted ? <CheckCircle /> : <AlertTriangle />}
          >
            {permissionStatus.message}
          </Alert>
        )}

        {/* 操作按钮 */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {!permissionStatus.granted && (
            <Button
              variant="contained"
              onClick={requestPermissions}
              disabled={requesting || permissionStatus.loading}
              startIcon={requesting ? <CircularProgress size={16} /> : <Shield />}
            >
              {requesting ? '请求中...' : '授权文件访问'}
            </Button>
          )}
          
          <Button
            variant="outlined"
            onClick={checkPermissions}
            disabled={permissionStatus.loading}
            startIcon={<Shield />}
          >
            检查权限状态
          </Button>

          {!permissionStatus.granted && (
            <Button
              variant="outlined"
              onClick={openSystemSettings}
              startIcon={<Settings />}
            >
              手动设置
            </Button>
          )}
        </Box>

        {/* 帮助信息 */}
        {!permissionStatus.granted && (
          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2">
              <strong>如果自动授权失败：</strong><br />
              1. 点击"手动设置"按钮<br />
              2. 在系统设置中找到"文件和媒体"权限<br />
              3. 开启"允许管理所有文件"选项
            </Typography>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};
