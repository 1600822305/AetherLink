import React, { memo, useEffect } from 'react';
import { CssBaseline, ThemeProvider, DialogTitle, DialogContent, DialogContentText, DialogActions, Button } from '@mui/material';
import BackButtonDialog from './common/BackButtonDialog';

import { useAppInitialization } from '../hooks/useAppInitialization';
import { useTheme } from '../hooks/useTheme';
import { useCapacitorSetup } from '../hooks/useCapacitorSetup';
import { useDataPersistence } from '../hooks/useDataPersistence';
// 🚀 性能优化：性能指标追踪
import { recordMetric } from '../utils/performanceMetrics';
import { createLogger } from '../shared/services/infra/logger';

const logger = createLogger('AppContent');

import AppRouter from '../routes';
import AppInitializer from './AppInitializer';
import BackButtonHandler from './BackButtonHandler';
import ExitConfirmDialog from './dialogs/ExitConfirmDialog';
import UpdateNoticeDialog from './dialogs/UpdateNoticeDialog';
import GlobalStyles from './GlobalStyles';
import ErrorBoundary from './ErrorBoundary';
import EnhancedPerformanceMonitor from './debug/EnhancedPerformanceMonitor';
import DevToolsFloatingButton from './debug/DevToolsFloatingButton';
import TitleBar from './common/TitleBar';

const AppContent = memo(() => {
  const { theme, fontSize } = useTheme();
  
  const {
    appInitialized,
    initError,
    retryInitialization
  } = useAppInitialization();

  // 🚀 当应用初始化完成后，移除启动屏（平滑淡出）
  useEffect(() => {
    if (appInitialized) {
      const splash = document.getElementById('S');
      if (splash) {
        // 淡出动画
        splash.style.opacity = '0';
        setTimeout(() => splash.remove(), 300);
      }
      
      if (process.env.NODE_ENV === 'development') {
        logger.info('✅ CSS Variables 系统已初始化');
        // 🚀 性能优化：记录启动屏隐藏时间
        recordMetric('splashScreenHide');
      }
    }
  }, [appInitialized]);
  
  // 设置Capacitor监听器
  useCapacitorSetup();
  
  // P0修复：数据持久化保护，确保退出前数据已保存
  useDataPersistence();

  // 数据重置通知状态
  const [showResetNotice, setShowResetNotice] = React.useState(false);

  // 检查是否需要显示重置通知
  React.useEffect(() => {
    // 这里可以添加检查逻辑，比如检查数据库清理状态
    // 暂时保持原有逻辑
  }, []);

  if (initError) {
    return (
      <ErrorBoundary
        error={initError}
        onRetry={retryInitialization}
      >
        <div>Error occurred</div>
      </ErrorBoundary>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <GlobalStyles fontSize={fontSize} theme={theme} />
      
      {/* Tauri 自定义标题栏 */}
      <TitleBar />
      
      <ErrorBoundary>
        {appInitialized && (
          <>
            <AppInitializer />
            <AppRouter />
            <BackButtonHandler />
            <ExitConfirmDialog />
            <UpdateNoticeDialog />
            {/* 全局性能监控 */}
            <EnhancedPerformanceMonitor />
            {/* 开发者工具悬浮按钮 */}
            <DevToolsFloatingButton />
          </>
        )}
      </ErrorBoundary>

      {/* 数据重置通知对话框 */}
      <BackButtonDialog
        open={showResetNotice}
        onClose={() => setShowResetNotice(false)}
        maxWidth="sm"
        fullWidth
        aria-labelledby="reset-dialog-title"
        aria-describedby="reset-dialog-description"
      >
        <DialogTitle id="reset-dialog-title">
          应用已升级
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="reset-dialog-description">
            应用已升级到全新的消息系统，提供更好的性能和用户体验。为确保兼容性，您之前的聊天记录已重置。现在您可以开始使用全新的系统了！
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowResetNotice(false)} color="primary" autoFocus>
            知道了
          </Button>
        </DialogActions>
      </BackButtonDialog>
    </ThemeProvider>
  );
});

AppContent.displayName = 'AppContent';
export default AppContent;
