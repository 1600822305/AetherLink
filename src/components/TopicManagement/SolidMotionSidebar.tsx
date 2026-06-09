/**
 * SolidMotionSidebar - 使用 SolidJS 实现的侧边栏
 * 支持滑动手势打开/关闭
 * 使用 SolidBridge 桥接 React 和 SolidJS
 */
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Box, IconButton, useMediaQuery, useTheme } from '@mui/material';
import { X as CloseIcon } from 'lucide-react';
import { SolidBridge } from '../../shared/bridges/SolidBridge';
import { AppSidebar } from '../../solid/components/Sidebar/AppSidebar.solid';
import SidebarTabs from './SidebarTabs';
import SidebarResizeHandle from './SidebarResizeHandle';
import { useDialogBackHandler } from '../../hooks/useDialogBackHandler';
import { useAppSelector } from '../../shared/store';
import { Haptics } from '../../shared/utils/hapticFeedback';

// 侧边栏的唯一标识符
const SIDEBAR_DIALOG_ID = 'sidebar-drawer-solid';

interface SolidMotionSidebarProps {
  mobileOpen?: boolean;
  onMobileToggle?: () => void;
  mcpMode?: 'prompt' | 'function';
  toolsEnabled?: boolean;
  onMCPModeChange?: (mode: 'prompt' | 'function') => void;
  onToolsToggle?: (enabled: boolean) => void;
  desktopOpen?: boolean;
  onDesktopToggle?: () => void;
}

// 自定义比较函数
const areSolidMotionSidebarPropsEqual = (
  prevProps: SolidMotionSidebarProps,
  nextProps: SolidMotionSidebarProps
) => {
  return (
    prevProps.mobileOpen === nextProps.mobileOpen &&
    prevProps.desktopOpen === nextProps.desktopOpen &&
    prevProps.mcpMode === nextProps.mcpMode &&
    prevProps.toolsEnabled === nextProps.toolsEnabled &&
    prevProps.onMobileToggle === nextProps.onMobileToggle &&
    prevProps.onDesktopToggle === nextProps.onDesktopToggle &&
    prevProps.onMCPModeChange === nextProps.onMCPModeChange &&
    prevProps.onToolsToggle === nextProps.onToolsToggle
  );
};

const SolidMotionSidebar = React.memo(function SolidMotionSidebar({
  mobileOpen = false,
  onMobileToggle,
  mcpMode,
  toolsEnabled,
  onMCPModeChange,
  onToolsToggle,
  desktopOpen = true,
  onDesktopToggle
}: SolidMotionSidebarProps) {
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('md'));
  const [showSidebar, setShowSidebar] = useState(!isSmallScreen);
  
  // 🚀 性能优化：预热标志 - 桌面端直接渲染，移动端延迟预热
  // 桌面端需要立即显示侧边栏内容，否则路由切换会有白屏闪烁
  const [isPrewarmed, setIsPrewarmed] = useState(!isSmallScreen);

  // 获取触觉反馈设置
  const hapticSettings = useAppSelector((state) => state.settings.hapticFeedback);

  // 用于追踪上一次的打开状态
  const prevOpenRef = useRef<boolean | null>(null);

  // 侧边栏宽度 - 从 localStorage 读取
  const getStoredWidth = useCallback(() => {
    try {
      const appSettings = localStorage.getItem('appSettings');
      if (appSettings) {
        const settings = JSON.parse(appSettings);
        return settings.sidebarWidth || 350;
      }
    } catch (e) {
      console.error('读取侧边栏宽度失败:', e);
    }
    return 350;
  }, []);

  const [drawerWidth, setDrawerWidth] = useState(getStoredWidth);

  // 监听宽度设置变化
  useEffect(() => {
    const handleSettingsChange = (e: CustomEvent) => {
      if (e.detail?.settingId === 'sidebarWidth') {
        setDrawerWidth(e.detail.value);
      }
    };
    window.addEventListener('appSettingsChanged', handleSettingsChange as EventListener);
    return () => {
      window.removeEventListener('appSettingsChanged', handleSettingsChange as EventListener);
    };
  }, []);

  // 拖动调整宽度 - 实时更新
  const handleResizeWidth = useCallback((newWidth: number) => {
    setDrawerWidth(newWidth);
  }, []);

  // 拖动结束 - 保存到 localStorage
  const handleResizeEnd = useCallback((newWidth: number) => {
    try {
      const appSettings = localStorage.getItem('appSettings');
      const settings = appSettings ? JSON.parse(appSettings) : {};
      settings.sidebarWidth = newWidth;
      localStorage.setItem('appSettings', JSON.stringify(settings));
      // 触发事件通知其他组件
      window.dispatchEvent(new CustomEvent('appSettingsChanged', {
        detail: { settingId: 'sidebarWidth', value: newWidth }
      }));
    } catch (e) {
      console.error('保存侧边栏宽度失败:', e);
    }
  }, []);

  useEffect(() => {
    if (isSmallScreen) {
      setShowSidebar(false);
    }
  }, [isSmallScreen]);

  // 🚀 性能优化：预热侧边栏内容
  // 桌面端已在初始化时预热；移动端在主线程空闲时尽早预热，
  // 并在用户从屏幕左缘触摸时立即兜底预热，避免内容树在拖拽动画期间挂载
  useEffect(() => {
    if (isPrewarmed || !isSmallScreen) return;

    let idleId: number | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    if (typeof requestIdleCallback === 'function') {
      idleId = requestIdleCallback(() => setIsPrewarmed(true), { timeout: 300 });
    } else {
      timeoutId = setTimeout(() => setIsPrewarmed(true), 100);
    }

    // 兜底：用户从左缘开始触摸（可能要滑出侧边栏）时立即预热
    const handleEdgeTouch = (e: TouchEvent) => {
      if (e.touches[0]?.clientX <= 30) {
        setIsPrewarmed(true);
      }
    };
    document.addEventListener('touchstart', handleEdgeTouch, { passive: true });

    return () => {
      if (idleId !== null) cancelIdleCallback(idleId);
      if (timeoutId !== null) clearTimeout(timeoutId);
      document.removeEventListener('touchstart', handleEdgeTouch);
    };
  }, [isPrewarmed, isSmallScreen]);

  // 使用 useRef 来稳定回调函数引用
  const onMobileToggleRef = useRef(onMobileToggle);
  const onDesktopToggleRef = useRef(onDesktopToggle);

  useEffect(() => {
    onMobileToggleRef.current = onMobileToggle;
  }, [onMobileToggle]);

  useEffect(() => {
    onDesktopToggleRef.current = onDesktopToggle;
  }, [onDesktopToggle]);

  // 计算最终的打开状态
  const finalOpen = useMemo(() => {
    if (isSmallScreen) {
      return onMobileToggle ? mobileOpen : showSidebar;
    } else {
      return onDesktopToggle ? desktopOpen : showSidebar;
    }
  }, [isSmallScreen, mobileOpen, showSidebar, desktopOpen, onMobileToggle, onDesktopToggle]);

  // 监听侧边栏打开/关闭状态变化，触发触觉反馈
  useEffect(() => {
    if (prevOpenRef.current === null) {
      prevOpenRef.current = finalOpen;
      return;
    }

    if (prevOpenRef.current !== finalOpen) {
      if (hapticSettings?.enabled && hapticSettings?.enableOnSidebar) {
        Haptics.drawerPulse();
      }
      prevOpenRef.current = finalOpen;
    }
  }, [finalOpen, hapticSettings]);

  // 统一的关闭处理函数
  const handleClose = useCallback(() => {
    if (isSmallScreen) {
      if (onMobileToggleRef.current) {
        onMobileToggleRef.current();
      } else {
        setShowSidebar(false);
      }
    } else {
      if (onDesktopToggleRef.current) {
        onDesktopToggleRef.current();
      } else {
        setShowSidebar(false);
      }
    }
  }, [isSmallScreen]);

  // 打开处理函数
  const handleOpen = useCallback(() => {
    if (isSmallScreen) {
      if (onMobileToggleRef.current) {
        onMobileToggleRef.current();
      } else {
        setShowSidebar(true);
      }
    }
  }, [isSmallScreen]);

  // 使用返回按键处理Hook
  useDialogBackHandler(
    SIDEBAR_DIALOG_ID,
    isSmallScreen && finalOpen,
    handleClose
  );

  // 获取主题模式
  const themeMode = theme.palette.mode;

  // 侧边栏内容
  const drawerContent = useMemo(() => (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden', // 改为 hidden，让内部组件自己管理滚动
        // 使用不透明背景色，不受壁纸透明度影响
        backgroundColor: theme.palette.background.paper,
        backgroundImage: 'none',
        opacity: 1,
      }}
    >
      {/* 关闭按钮 - 只在移动端或桌面端可收起时显示 */}
      {(isSmallScreen || onDesktopToggle) && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'flex-end',
            p: 1,
            minHeight: 48,
            alignItems: 'center',
          }}
        >
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
  ), [isSmallScreen, handleClose, mcpMode, toolsEnabled, onMCPModeChange, onToolsToggle, onDesktopToggle, theme.palette.background.paper]);

  // 处理侧边栏状态变化
  const handleOpenChange = useCallback((open: boolean) => {
    if (open) {
      handleOpen();
    } else {
      handleClose();
    }
  }, [handleOpen, handleClose]);

  // Portal 容器
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);

  // 持续监听 Portal 容器（移动端和桌面端都需要）
  useEffect(() => {
    let observer: MutationObserver | null = null;

    const startObserving = () => {
      observer = new MutationObserver(checkContainer);
      observer.observe(document.body, { childList: true, subtree: true });
    };

    const checkContainer = () => {
      const container = document.getElementById('solid-sidebar-content');
      setPortalContainer((prev) => (container !== prev ? container : prev));
      if (container) {
        // 已找到容器，停止全局监听；改为只监听容器是否被移除
        observer?.disconnect();
        observer = null;
        const removalObserver = new MutationObserver(() => {
          if (!document.contains(container)) {
            removalObserver.disconnect();
            setPortalContainer(null);
            startObserving(); // 容器没了，恢复全局监听等待重建
          }
        });
        removalObserver.observe(container.parentNode ?? document.body, { childList: true });
        observer = removalObserver;
      }
    };

    checkContainer();
    if (!document.getElementById('solid-sidebar-content')) {
      startObserving();
    }

    return () => observer?.disconnect();
  }, []); // 注意：依赖改为 []，内部用函数式 setState 避免依赖 portalContainer

  // 🚀 光栅化预热：内容挂载后强制一次 layout，让浏览器提前把屏幕外的
  // 侧边栏图层画好，避免首次打开动画时现场光栅化导致掉帧
  const isRasterWarmedRef = useRef(false);
  useEffect(() => {
    if (!isPrewarmed || !portalContainer || isRasterWarmedRef.current) return;
    const rafId = requestAnimationFrame(() => {
      // portalContainer 的父节点是 Solid 渲染的侧边栏根元素
      const sidebarEl = portalContainer.parentElement ?? portalContainer;
      void sidebarEl.getBoundingClientRect();
      isRasterWarmedRef.current = true;
    });
    return () => cancelAnimationFrame(rafId);
  }, [isPrewarmed, portalContainer]);

  // 移动端和桌面端都使用 SolidJS AppSidebar
  // 移动端：启用手势支持
  // 桌面端：禁用手势支持，性能更好
  return (
    <>
      <SolidBridge
        component={AppSidebar as any}
        props={{
          open: finalOpen,
          onOpenChange: handleOpenChange,
          width: drawerWidth,
          themeMode: themeMode,
          enableSwipeGesture: isSmallScreen, // 只在移动端启用手势
          isDesktop: !isSmallScreen, // 桌面端标识
        }}
        debugName="AppSidebar"
        debug={false}
        style={{ display: 'contents' }}
      />
      {/* 🚀 性能优化：始终渲染 Portal 内容（预热后），避免首次打开时的初始化开销 */}
      {portalContainer && isPrewarmed && createPortal(drawerContent, portalContainer)}
      
      {/* 桌面端拖动调整宽度手柄 */}
      {!isSmallScreen && finalOpen && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: drawerWidth,
            height: '100%',
            zIndex: 1200,
          }}
        >
          <SidebarResizeHandle
            currentWidth={drawerWidth}
            onWidthChange={handleResizeWidth}
            onWidthChangeEnd={handleResizeEnd}
          />
        </Box>
      )}
    </>
  );
}, areSolidMotionSidebarPropsEqual);

export default SolidMotionSidebar;
