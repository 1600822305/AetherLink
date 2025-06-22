import React, { memo } from 'react';
import { CssBaseline, ThemeProvider, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button } from '@mui/material';

import { useAppInitialization } from '../hooks/useAppInitialization';
import { useTheme } from '../hooks/useTheme';
import { useCapacitorSetup } from '../hooks/useCapacitorSetup';

import AppRouter from '../routes';
import AppInitializer from './AppInitializer';
import BackButtonHandler from './BackButtonHandler';
import ExitConfirmDialog from './ExitConfirmDialog';
import UpdateNoticeDialog from './UpdateNoticeDialog';
import GlobalStyles from './GlobalStyles';
import LoadingScreen from './LoadingScreen';
import ErrorBoundary from './ErrorBoundary';

const AppContent = memo(() => {
  const { theme, fontSize } = useTheme();
  const {
    appInitialized,
    initializationProgress,
    initializationStep,
    isFirstInstall,
    initError,
    retryInitialization
  } = useAppInitialization();
  
  // 设置Capacitor监听器
  useCapacitorSetup();

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
      
      <ErrorBoundary>
        {appInitialized ? (
          <>
            <AppInitializer />
            <AppRouter />
            <BackButtonHandler />
            <ExitConfirmDialog />
            <UpdateNoticeDialog />
          </>
        ) : (
          <LoadingScreen
            progress={initializationProgress}
            step={initializationStep}
            isFirstInstall={isFirstInstall}
          />
        )}
      </ErrorBoundary>

      {/* 数据重置通知对话框 */}
      <Dialog
        open={showResetNotice}
        onClose={() => setShowResetNotice(false)}
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
      </Dialog>
    </ThemeProvider>
  );
});

AppContent.displayName = 'AppContent';
export default AppContent;
