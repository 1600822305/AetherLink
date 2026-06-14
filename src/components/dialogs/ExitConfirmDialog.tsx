import React from 'react';
import {
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button
} from '@mui/material';
import BackButtonDialog from '../common/BackButtonDialog';
import { useLocation } from 'react-router-dom';
import { useAppState } from '../../shared/hooks/useAppState';
import { getPlatformInfo } from '../../shared/utils/platformDetection';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { createLogger } from '../../shared/services/infra/logger';

const logger = createLogger('ExitConfirmDialog');

/**
 * 退出确认对话框组件
 * 当用户点击返回键时显示，询问用户是否要退出应用
 * 只在聊天页面和欢迎页面显示
 * 
 * 适配说明：
 * - Capacitor 原生平台：使用 App.exitApp()
 * - Tauri 平台：使用 @tauri-apps/api/window 的 close()
 * - Web 平台：使用 window.close()
 */
const ExitConfirmDialog: React.FC = () => {
  const location = useLocation();
  const { showExitConfirm, setShowExitConfirm } = useAppState();

  // 只在聊天页面和欢迎页面显示退出确认对话框
  const shouldShowDialog = showExitConfirm && (
    location.pathname === '/chat' ||
    location.pathname === '/welcome'
  );

  // 处理取消按钮点击
  const handleCancel = () => {
    setShowExitConfirm(false);
  };

  // 处理确认退出按钮点击
  const handleConfirm = async () => {
    setShowExitConfirm(false);
    
    const platformInfo = getPlatformInfo();
    
    // Capacitor 原生平台：使用 exitApp()
    if (platformInfo.isCapacitor && Capacitor.isNativePlatform()) {
      try {
        await CapApp.exitApp();
        return;
      } catch (error) {
        logger.error('Capacitor exitApp 失败:', error);
      }
    }
    
    // Tauri 平台：使用窗口 close API
    if (platformInfo.isTauri) {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        await getCurrentWindow().close();
        return;
      } catch (error) {
        logger.error('Tauri close 失败:', error);
      }
    }
    
    // Web 平台或其他情况：使用 window.close()
    window.close();
  };

  return (
    <BackButtonDialog
      open={shouldShowDialog}
      onClose={handleCancel}
      aria-labelledby="exit-dialog-title"
      aria-describedby="exit-dialog-description"
    >
      <DialogTitle id="exit-dialog-title">
        确认退出
      </DialogTitle>
      <DialogContent>
        <DialogContentText id="exit-dialog-description">
          您确定要退出应用吗？
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCancel} color="primary">
          取消
        </Button>
        <Button onClick={handleConfirm} color="primary" autoFocus>
          退出
        </Button>
      </DialogActions>
    </BackButtonDialog>
  );
};

export default ExitConfirmDialog;
