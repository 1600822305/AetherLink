import { useState, useMemo } from 'react';
import { Box, IconButton, Drawer, SwipeableDrawer, useMediaQuery, useTheme } from '@mui/material';
import { X as CloseIcon } from 'lucide-react';
import SidebarTabs from './SidebarTabs';
import {
  getDesktopDrawerStyles,
  getDrawerContentStyles,
  getCloseButtonStyles,
  getCloseButtonInteractionStyles,
} from './sidebarOptimization';
import { useSidebarToggle, useSidebarKeyboardShortcuts } from './hooks/useSidebarToggle';

interface SidebarProps {
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

export default function Sidebar({
  mobileOpen = false,
  onMobileToggle,
  mcpMode,
  toolsEnabled,
  onMCPModeChange,
  onToolsToggle,
  // 新增参数
  desktopOpen = true,
  onDesktopToggle
}: SidebarProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [localMobileOpen, setLocalMobileOpen] = useState(false);
  const [localDesktopOpen, setLocalDesktopOpen] = useState(true);

  const drawerWidth = 340;

  // 使用优化的侧边栏切换Hook
  const { handleToggle: handleDrawerToggle } = useSidebarToggle({
    isMobile,
    onMobileToggle,
    onDesktopToggle,
    localMobileOpen,
    localDesktopOpen,
    setLocalMobileOpen,
    setLocalDesktopOpen,
  });

  // 添加键盘快捷键支持
  useSidebarKeyboardShortcuts(handleDrawerToggle, true);

  // 使用 useMemo 缓存计算结果
  const isOpen = useMemo(() => {
    return isMobile
      ? (onMobileToggle ? mobileOpen : localMobileOpen)
      : (onDesktopToggle ? desktopOpen : localDesktopOpen);
  }, [isMobile, onMobileToggle, mobileOpen, localMobileOpen, onDesktopToggle, desktopOpen, localDesktopOpen]);

  // 使用 useMemo 缓存抽屉内容，避免不必要的重新渲染
  const drawer = useMemo(() => (
    <Box sx={getDrawerContentStyles()}>
      {/* 显示收起按钮：移动端始终显示，桌面端在有控制函数时显示 */}
      {(isMobile || onDesktopToggle) && (
        <Box sx={getCloseButtonStyles()}>
          <IconButton
            onClick={handleDrawerToggle}
            sx={getCloseButtonInteractionStyles()}
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
  ), [isMobile, onDesktopToggle, handleDrawerToggle, mcpMode, toolsEnabled, onMCPModeChange, onToolsToggle]);

  // 优化的桌面端样式
  const desktopDrawerSx = useMemo(() => getDesktopDrawerStyles(drawerWidth, isOpen), [drawerWidth, isOpen]);

  return (
    <>
      {isMobile ? (
        <SwipeableDrawer
          anchor="left"
          variant="temporary"
          open={isOpen}
          onClose={handleDrawerToggle}
          onOpen={handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile.
          }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
            },
          }}
        >
          {drawer}
        </SwipeableDrawer>
      ) : (
        <Drawer
          variant="persistent"
          sx={desktopDrawerSx}
          open={isOpen}
        >
          {drawer}
        </Drawer>
      )}
    </>
  );
}