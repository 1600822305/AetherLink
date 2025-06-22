import { useCallback, useRef, useEffect } from 'react';
import { createOptimizedToggleHandler } from '../sidebarOptimization';

interface UseSidebarToggleProps {
  isMobile: boolean;
  onMobileToggle?: () => void;
  onDesktopToggle?: () => void;
  localMobileOpen: boolean;
  localDesktopOpen: boolean;
  setLocalMobileOpen: (value: boolean | ((prev: boolean) => boolean)) => void;
  setLocalDesktopOpen: (value: boolean | ((prev: boolean) => boolean)) => void;
}

/**
 * 优化的侧边栏切换Hook
 * 
 * 这个Hook专门处理侧边栏的展开/收起逻辑，包含性能优化和防抖处理
 */
export function useSidebarToggle({
  isMobile,
  onMobileToggle,
  onDesktopToggle,
  localMobileOpen,
  localDesktopOpen,
  setLocalMobileOpen,
  setLocalDesktopOpen,
}: UseSidebarToggleProps) {
  // 使用 ref 来避免不必要的重新渲染
  const isTogglingRef = useRef(false);
  const animationFrameRef = useRef<number | undefined>(undefined);
  
  // 清理动画帧
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // 核心切换逻辑
  const toggleLogic = useCallback(() => {
    if (isMobile) {
      // 移动端逻辑
      if (onMobileToggle) {
        onMobileToggle();
      } else {
        setLocalMobileOpen(prev => !prev);
      }
    } else {
      // 桌面端逻辑
      if (onDesktopToggle) {
        onDesktopToggle();
      } else {
        setLocalDesktopOpen(prev => !prev);
      }
    }
  }, [isMobile, onMobileToggle, onDesktopToggle, setLocalMobileOpen, setLocalDesktopOpen]);

  // 优化的切换处理函数
  const handleToggle = useCallback(
    createOptimizedToggleHandler(
      toggleLogic,
      isTogglingRef,
      animationFrameRef
    ),
    [toggleLogic]
  );

  // 快速切换函数（用于键盘快捷键等场景）
  const handleQuickToggle = useCallback(() => {
    // 跳过防抖，直接执行
    toggleLogic();
  }, [toggleLogic]);

  // 强制打开
  const handleForceOpen = useCallback(() => {
    if (isMobile) {
      if (onMobileToggle && !localMobileOpen) {
        onMobileToggle();
      } else if (!localMobileOpen) {
        setLocalMobileOpen(true);
      }
    } else {
      if (onDesktopToggle && !localDesktopOpen) {
        onDesktopToggle();
      } else if (!localDesktopOpen) {
        setLocalDesktopOpen(true);
      }
    }
  }, [isMobile, onMobileToggle, onDesktopToggle, localMobileOpen, localDesktopOpen, setLocalMobileOpen, setLocalDesktopOpen]);

  // 强制关闭
  const handleForceClose = useCallback(() => {
    if (isMobile) {
      if (onMobileToggle && localMobileOpen) {
        onMobileToggle();
      } else if (localMobileOpen) {
        setLocalMobileOpen(false);
      }
    } else {
      if (onDesktopToggle && localDesktopOpen) {
        onDesktopToggle();
      } else if (localDesktopOpen) {
        setLocalDesktopOpen(false);
      }
    }
  }, [isMobile, onMobileToggle, onDesktopToggle, localMobileOpen, localDesktopOpen, setLocalMobileOpen, setLocalDesktopOpen]);

  return {
    handleToggle,
    handleQuickToggle,
    handleForceOpen,
    handleForceClose,
    isToggling: isTogglingRef.current,
  };
}

/**
 * 简化版的侧边栏切换Hook
 * 适用于只需要基本切换功能的场景
 */
export function useSimpleSidebarToggle(
  isOpen: boolean,
  onToggle: () => void
) {
  const isTogglingRef = useRef(false);
  const animationFrameRef = useRef<number | undefined>(undefined);
  
  // 清理动画帧
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const handleToggle = useCallback(
    createOptimizedToggleHandler(
      onToggle,
      isTogglingRef,
      animationFrameRef
    ),
    [onToggle]
  );

  return {
    handleToggle,
    isToggling: isTogglingRef.current,
    isOpen,
  };
}

/**
 * 键盘快捷键支持的侧边栏切换Hook
 */
export function useSidebarKeyboardShortcuts(
  handleToggle: () => void,
  enabled: boolean = true
) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl/Cmd + B 切换侧边栏
      if ((event.ctrlKey || event.metaKey) && event.key === 'b') {
        event.preventDefault();
        handleToggle();
      }
      
      // ESC 关闭侧边栏（仅移动端）
      if (event.key === 'Escape') {
        // 这里可以添加关闭逻辑
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleToggle, enabled]);
}

/**
 * 侧边栏状态持久化Hook
 */
export function useSidebarPersistence(
  key: string,
  defaultValue: boolean = true
) {
  const getStoredValue = useCallback(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored !== null ? JSON.parse(stored) : defaultValue;
    } catch {
      return defaultValue;
    }
  }, [key, defaultValue]);

  const setStoredValue = useCallback((value: boolean) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // 忽略存储错误
    }
  }, [key]);

  return {
    getStoredValue,
    setStoredValue,
  };
}
