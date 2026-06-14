/**
 * TitleBar - Tauri 自定义标题栏组件
 * 仅在 Tauri 桌面端显示
 */
import React, { memo, useCallback, useState, useEffect } from 'react';
import { Box, IconButton, Typography, useTheme } from '@mui/material';
import { Minus, Square, X } from 'lucide-react';
import { isTauri } from '../../shared/utils/platformDetection';
import { createLogger } from '../../shared/services/infra/logger';

const logger = createLogger('TitleBar');

interface TitleBarProps {
  title?: string;
}

const TitleBar: React.FC<TitleBarProps> = memo(({ title = 'AetherLink' }) => {
  const theme = useTheme();
  const [isMaximized, setIsMaximized] = useState(false);
  const [isTauriEnv, setIsTauriEnv] = useState(false);

  // 检测 Tauri 环境（需要在客户端执行）
  useEffect(() => {
    const tauriDetected = isTauri();
    setIsTauriEnv(tauriDetected);
    
    if (tauriDetected) {
      document.body.setAttribute('data-tauri', 'true');
    }
    return () => {
      document.body.removeAttribute('data-tauri');
    };
  }, []);

  // 检查窗口是否最大化
  useEffect(() => {
    if (!isTauri()) return;

    const checkMaximized = async () => {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const win = getCurrentWindow();
        const maximized = await win.isMaximized();
        setIsMaximized(maximized);
      } catch (e) {
        logger.error('检查窗口状态失败:', e);
      }
    };

    checkMaximized();

    // 监听窗口大小变化
    const handleResize = () => {
      checkMaximized();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 开始拖动窗口
  const handleStartDrag = useCallback(async (e: React.MouseEvent) => {
    if (!isTauri()) return;
    // 只响应主按钮（左键）
    if (e.button !== 0) return;
    
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const win = getCurrentWindow();
      await win.startDragging();
    } catch (e) {
      logger.error('开始拖动失败:', e);
    }
  }, []);

  // 最小化窗口
  const handleMinimize = useCallback(async () => {
    if (!isTauri()) return;
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const win = getCurrentWindow();
      await win.minimize();
    } catch (e) {
      logger.error('最小化失败:', e);
    }
  }, []);

  // 最大化/还原窗口
  const handleMaximize = useCallback(async () => {
    if (!isTauri()) return;
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const win = getCurrentWindow();
      await win.toggleMaximize();
      setIsMaximized(!isMaximized);
    } catch (e) {
      logger.error('最大化失败:', e);
    }
  }, [isMaximized]);

  // 关闭窗口
  const handleClose = useCallback(async () => {
    if (!isTauri()) return;
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const win = getCurrentWindow();
      await win.close();
    } catch (e) {
      logger.error('关闭失败:', e);
    }
  }, []);

  // 非 Tauri 环境不渲染
  if (!isTauriEnv) {
    return null;
  }

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 44,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: theme.palette.background.default,
        borderBottom: `1px solid ${theme.palette.divider}`,
        zIndex: 9999,
        userSelect: 'none',
        WebkitAppRegion: 'drag',
      }}
      onMouseDown={handleStartDrag}
    >
      {/* 左侧标题 */}
      <Box sx={{ display: 'flex', alignItems: 'center', pl: 1.5, gap: 1 }}>
        <Typography
          variant="caption"
          sx={{
            fontSize: 12,
            fontWeight: 500,
            color: theme.palette.text.secondary,
            letterSpacing: 0.5,
          }}
        >
          {title}
        </Typography>
      </Box>

      {/* 右侧窗口控制按钮 */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          height: '100%',
          WebkitAppRegion: 'no-drag',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* 最小化 */}
        <IconButton
          size="small"
          onClick={handleMinimize}
          sx={{
            borderRadius: 0,
            width: 46,
            height: '100%',
            color: theme.palette.text.secondary,
            transition: 'background 0.15s, color 0.15s',
            '&:hover': {
              backgroundColor: 'rgba(128, 128, 128, 0.3)',
            },
            '&:active': {
              backgroundColor: 'rgba(128, 128, 128, 0.4)',
            },
          }}
        >
          <Minus size={14} />
        </IconButton>

        {/* 最大化/还原 */}
        <IconButton
          size="small"
          onClick={handleMaximize}
          sx={{
            borderRadius: 0,
            width: 46,
            height: '100%',
            color: theme.palette.text.secondary,
            transition: 'background 0.15s, color 0.15s',
            '&:hover': {
              backgroundColor: 'rgba(128, 128, 128, 0.3)',
            },
            '&:active': {
              backgroundColor: 'rgba(128, 128, 128, 0.4)',
            },
          }}
        >
          {isMaximized ? <Square size={14} /> : <Square size={14} />}
        </IconButton>

        {/* 关闭 */}
        <IconButton
          size="small"
          onClick={handleClose}
          sx={{
            borderRadius: 0,
            width: 46,
            height: '100%',
            color: theme.palette.text.secondary,
            transition: 'background 0.15s, color 0.15s',
            '&:hover': {
              backgroundColor: '#e81123',
              color: '#fff',
            },
            '&:active': {
              backgroundColor: '#c50e1f',
              color: '#fff',
            },
          }}
        >
          <X size={17} />
        </IconButton>
      </Box>
    </Box>
  );
});

TitleBar.displayName = 'TitleBar';

export default TitleBar;
