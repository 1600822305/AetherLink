import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Box, IconButton, useMediaQuery, useTheme } from '@mui/material';
import { X as CloseIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import SidebarTabs from './SidebarTabs';
import { useDialogBackHandler } from '../../hooks/useDialogBackHandler';

// 侧边栏的唯一标识符，用于返回按键处理
const SIDEBAR_DIALOG_ID = 'sidebar-drawer';

interface MotionSidebarProps {
  mobileOpen?: boolean;
  onMobileToggle?: () => void;
  mcpMode?: 'prompt' | 'function';
  toolsEnabled?: boolean;
  onMCPModeChange?: (mode: 'prompt' | 'function') => void;
  onToolsToggle?: (enabled: boolean) => void;
  // 新增：支持桌面端收起功能
  desktopOpen?: boolean;
  onDesktopToggle?: () => void;
}

// Framer Motion 动画配置
const sidebarVariants = {
  open: {
    width: 320,
    opacity: 1,
    visibility: 'visible' as const,
    transition: {
      type: 'tween' as const,
      duration: 0.2,
      ease: [0.25, 0.46, 0.45, 0.94] as const
    }
  },
  closed: {
    width: 0,
    opacity: 0,
    visibility: 'hidden' as const,
    transition: {
      type: 'tween' as const,
      duration: 0.2,
      ease: [0.55, 0.06, 0.68, 0.19] as const
    }
  }
};

const backdropVariants = {
  open: {
    opacity: 1,
    visibility: 'visible' as const,
    transition: {
      duration: 0.2
    }
  },
  closed: {
    opacity: 0,
    visibility: 'hidden' as const,
    transition: {
      duration: 0.2
    }
  }
};

const contentVariants = {
  open: {
    x: 0,
    transition: {
      type: 'tween' as const,
      duration: 0.2,
      ease: [0.25, 0.46, 0.45, 0.94] as const
    }
  },
  closed: {
    x: -320,
    transition: {
      type: 'tween' as const,
      duration: 0.2,
      ease: [0.55, 0.06, 0.68, 0.19] as const
    }
  }
};

// 使用 React.memo 优化组件，避免不必要的重新渲染
const MotionSidebar = React.memo(function MotionSidebar({
  mobileOpen = false,
  onMobileToggle,
  mcpMode,
  toolsEnabled,
  onMCPModeChange,
  onToolsToggle,
  // 新增参数
  desktopOpen = true,
  onDesktopToggle
}: MotionSidebarProps) {
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('md')); // 与ChatPageUI保持一致
  const [showSidebar, setShowSidebar] = useState(!isSmallScreen);

  const drawerWidth = 320;

  useEffect(() => {
    if (isSmallScreen) {
      setShowSidebar(false);
    }
  }, [isSmallScreen]);

  // 使用 useRef 来稳定回调函数引用，避免无限重新渲染
  const onMobileToggleRef = useRef(onMobileToggle);
  const onDesktopToggleRef = useRef(onDesktopToggle);

  // 更新 ref 的值
  useEffect(() => {
    onMobileToggleRef.current = onMobileToggle;
  }, [onMobileToggle]);

  useEffect(() => {
    onDesktopToggleRef.current = onDesktopToggle;
  }, [onDesktopToggle]);

  // 优化：使用稳定的计算逻辑，避免回调函数依赖导致的重新渲染
  const finalOpen = useMemo(() => {
    if (isSmallScreen) {
      return onMobileToggleRef.current ? mobileOpen : showSidebar;
    } else {
      return onDesktopToggleRef.current ? desktopOpen : showSidebar;
    }
  }, [isSmallScreen, mobileOpen, showSidebar, desktopOpen]);

  // 统一的关闭处理函数
  const handleClose = useCallback(() => {
    if (isSmallScreen) {
      // 移动端：优先使用 onMobileToggle，否则使用本地状态
      if (onMobileToggleRef.current) {
        onMobileToggleRef.current();
      } else {
        setShowSidebar(false);
      }
    } else {
      // 桌面端：优先使用 onDesktopToggle，否则使用本地状态
      if (onDesktopToggleRef.current) {
        onDesktopToggleRef.current();
      } else {
        setShowSidebar(false);
      }
    }
  }, [isSmallScreen]);

  // 使用返回按键处理Hook，只在移动端且侧边栏打开时启用
  useDialogBackHandler(
    SIDEBAR_DIALOG_ID,
    isSmallScreen && finalOpen, // 使用统一的 finalOpen 状态
    handleClose // 使用统一的关闭处理函数
  );

  const handleBackdropClick = useCallback(() => {
    if (isSmallScreen) {
      handleClose();
    }
  }, [isSmallScreen, handleClose]);

  // 优化：减少 drawer 的依赖项，避免频繁重新渲染
  const drawer = useMemo(() => (
    <Box sx={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'auto',
      // 自定义滚动条样式
      '&::-webkit-scrollbar': {
        width: '1px', // 故意设计为1px以隐藏滚动条
      },
      '&::-webkit-scrollbar-track': {
        background: 'transparent',
      },
      '&::-webkit-scrollbar-thumb': {
        background: 'rgba(0, 0, 0, 0.2)',
        borderRadius: '3px',
        '&:hover': {
          background: 'rgba(0, 0, 0, 0.3)',
        },
      },
      // Firefox 滚动条样式
      scrollbarWidth: 'thin',
      scrollbarColor: 'rgba(0, 0, 0, 0.2) transparent',
    }}>
      {(isSmallScreen || onDesktopToggle) && (
        <Box sx={{
          display: 'flex',
          justifyContent: 'flex-end',
          p: 1,
          minHeight: 48,
          alignItems: 'center',
        }}>
          <IconButton
            onClick={handleClose}
            sx={{
              transition: 'all 150ms cubic-bezier(0.4, 0, 0.2, 1)',
              '&:hover': {
                backgroundColor: 'rgba(0, 0, 0, 0.04)',
                transform: 'scale(1.05)',
              },
              '&:active': {
                transform: 'scale(0.95)',
              },
              // 移动端优化
              '@media (hover: none)': {
                '&:hover': {
                  backgroundColor: 'transparent',
                  transform: 'none',
                },
                '&:active': {
                  backgroundColor: 'rgba(0, 0, 0, 0.08)',
                  transform: 'scale(0.95)',
                },
              },
            }}
          >
            <CloseIcon size={20} />
          </IconButton>
        </Box>
      )}
      <SidebarTabs
        mcpMode={mcpMode}
        toolsEnabled={toolsEnabled}
        onMCPModeChange={onMCPModeChange}
        onToolsToggle={onToolsToggle}
      />
    </Box>
  ), [isSmallScreen, handleClose, mcpMode, toolsEnabled, onMCPModeChange, onToolsToggle, onDesktopToggle]);

  if (isSmallScreen) {
    // 移动端：使用全屏覆盖模式
    return (
      <AnimatePresence>
        {finalOpen && (
          <>
            {/* 背景遮罩 */}
            <motion.div
              initial="closed"
              animate="open"
              exit="closed"
              variants={backdropVariants}
              onClick={handleBackdropClick}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                zIndex: 1200,
              }}
            />
            
            {/* 侧边栏内容 */}
            <motion.div
              initial="closed"
              animate="open"
              exit="closed"
              variants={contentVariants}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                bottom: 0,
                width: drawerWidth,
                backgroundColor: theme.palette.background.paper,
                zIndex: 1300,
                boxShadow: theme.shadows[16],
                borderRadius: '0 16px 16px 0',
              }}
            >
              {drawer}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    );
  }

  // 桌面端：使用绝对定位，不影响主内容布局
  return (
    <motion.div
      initial={false}
      animate={finalOpen ? "open" : "closed"}
      variants={sidebarVariants}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        height: '100vh',
        backgroundColor: theme.palette.background.paper,
        borderRight: `1px solid ${theme.palette.divider}`,
        overflow: 'hidden',
        zIndex: 1200,
      }}
    >
      {drawer}
    </motion.div>
  );
});

export default MotionSidebar;
