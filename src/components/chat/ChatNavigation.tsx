import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Box, IconButton, Tooltip, Paper, Fade, useMediaQuery, useTheme } from '@mui/material';
import { ChevronUp, ChevronDown, ArrowUp, ArrowDown, Scroll } from 'lucide-react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../../shared/store';
import { updateSettings } from '../../shared/store/settingsSlice';
import { Haptics } from '../../shared/utils/hapticFeedback';
import { useKeyboard } from '../../shared/hooks/useKeyboard';
import ContextTokenIndicator from './ContextTokenIndicator';
import { getChatScrollController } from '../../shared/services/chat/scrollControllerRegistry';

interface ChatNavigationProps {
  containerId: string;
  topicId?: string; // 当前话题ID，用于Token指示器
}

const ChatNavigation: React.FC<ChatNavigationProps> = ({ containerId, topicId }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isNearButtons, setIsNearButtons] = useState(false);
  const hideTimer = useRef<NodeJS.Timeout | null>(null);
  const lastMoveTime = useRef(0);
  const scrollTimer = useRef<NodeJS.Timeout | null>(null);
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const touchStartTime = useRef<number>(0);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const dispatch = useDispatch();
  
  // 获取键盘高度，用于动态调整导航位置
  const { keyboardHeight } = useKeyboard();

  const messageNavigation = useSelector((state: RootState) =>
    (state.settings as any).messageNavigation || 'none'
  );

  const showNavigationOnScroll = useSelector((state: RootState) =>
    (state.settings as any).showNavigationOnScroll ?? false
  );

  const hapticFeedback = useSelector((state: RootState) =>
    (state.settings as any).hapticFeedback
  );

  // 判断是否启用导航触觉反馈
  const isNavigationHapticEnabled = hapticFeedback?.enabled && hapticFeedback?.enableOnNavigation;

  const resetHideTimer = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
    hideTimer.current = setTimeout(() => {
      if (!isNearButtons) {
        setIsVisible(false);
      }
    }, 1500);
  }, [isNearButtons]);

  const handleMouseEnter = useCallback(() => {
    if (isMobile) return; // 移动端不处理鼠标事件
    setIsNearButtons(true);
    setIsVisible(true);
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, [isMobile]);

  const handleMouseLeave = useCallback(() => {
    if (isMobile) return; // 移动端不处理鼠标事件
    setIsNearButtons(false);
    resetHideTimer();
  }, [resetHideTimer, isMobile]);

  // 查找所有消息元素
  const findAllMessages = useCallback(() => {
    const container = document.getElementById(containerId);
    if (!container) return [];

    const allMessages = Array.from(container.querySelectorAll('[id^="message-"]'));
    return allMessages as HTMLElement[];
  }, [containerId]);

  const scrollToMessage = useCallback((element: HTMLElement) => {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const scrollToTop = useCallback(() => {
    const container = document.getElementById(containerId);
    if (container) {
      container.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [containerId]);

  const scrollToBottom = useCallback(() => {
    // 优先走统一的贴底控制器，确保点击后恢复「跟随底部」状态
    const controller = getChatScrollController();
    if (controller) {
      controller.pinToBottom('smooth');
      return;
    }
    const container = document.getElementById(containerId);
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    }
  }, [containerId]);

  const getCurrentVisibleIndex = useCallback(() => {
    const allMessages = findAllMessages();
    if (allMessages.length === 0) return -1;

    const container = document.getElementById(containerId);
    if (!container) return -1;

    const containerRect = container.getBoundingClientRect();
    const containerTop = containerRect.top;
    const containerBottom = containerRect.bottom;

    for (let i = 0; i < allMessages.length; i++) {
      const messageRect = allMessages[i].getBoundingClientRect();
      const messageTop = messageRect.top;
      const messageBottom = messageRect.bottom;

      if (messageTop >= containerTop && messageBottom <= containerBottom) {
        return i;
      }

      if (messageTop < containerBottom && messageBottom > containerTop) {
        return i;
      }
    }

    return -1;
  }, [findAllMessages, containerId]);

  const handlePrevMessage = useCallback(() => {
    if (isNavigationHapticEnabled) {
      Haptics.light(); // 触觉反馈
    }
    resetHideTimer();
    const allMessages = findAllMessages();

    if (allMessages.length === 0) {
      return scrollToTop();
    }

    const visibleIndex = getCurrentVisibleIndex();

    if (visibleIndex === -1) {
      return scrollToTop();
    }

    const targetIndex = visibleIndex - 1;

    if (targetIndex < 0) {
      return scrollToTop();
    }

    scrollToMessage(allMessages[targetIndex]);
  }, [resetHideTimer, findAllMessages, getCurrentVisibleIndex, scrollToTop, scrollToMessage, isNavigationHapticEnabled]);

  const handleNextMessage = useCallback(() => {
    if (isNavigationHapticEnabled) {
      Haptics.light(); // 触觉反馈
    }
    resetHideTimer();
    const allMessages = findAllMessages();

    if (allMessages.length === 0) {
      return scrollToBottom();
    }

    const visibleIndex = getCurrentVisibleIndex();

    if (visibleIndex === -1) {
      return scrollToBottom();
    }

    const targetIndex = visibleIndex + 1;

    if (targetIndex >= allMessages.length) {
      return scrollToBottom();
    }

    scrollToMessage(allMessages[targetIndex]);
  }, [resetHideTimer, findAllMessages, getCurrentVisibleIndex, scrollToBottom, scrollToMessage, isNavigationHapticEnabled]);

  const handleScrollToTop = useCallback(() => {
    if (isNavigationHapticEnabled) {
      Haptics.light(); // 触觉反馈
    }
    resetHideTimer();
    scrollToTop();
  }, [resetHideTimer, scrollToTop, isNavigationHapticEnabled]);

  const handleScrollToBottom = useCallback(() => {
    if (isNavigationHapticEnabled) {
      Haptics.light(); // 触觉反馈
    }
    resetHideTimer();
    scrollToBottom();
  }, [resetHideTimer, scrollToBottom, isNavigationHapticEnabled]);

  const handleToggleScrollNavigation = useCallback(() => {
    if (isNavigationHapticEnabled) {
      Haptics.soft(); // 触觉反馈 - 使用soft反馈作为开关切换
    }
    dispatch(updateSettings({
      showNavigationOnScroll: !showNavigationOnScroll
    }));
  }, [dispatch, showNavigationOnScroll, isNavigationHapticEnabled]);

  useEffect(() => {
    const container = document.getElementById(containerId);
    if (!container) return;

    const handleMouseMove = (e: MouseEvent) => {
      // 桌面端鼠标移动逻辑
      if (isMobile) return;

      const now = Date.now();
      if (now - lastMoveTime.current < 100) return;
      lastMoveTime.current = now;

      const triggerWidth = 30;
      const centerY = window.innerHeight / 2;
      const triggerHeight = 120;
      
      // 导航呼吸灯区域：右侧边缘，从中央开始往下（避免与 Token 呼吸灯重叠）
      // Token 呼吸灯在中央上方 150px，所以导航从中央开始
      const isInTriggerArea = e.clientX > window.innerWidth - triggerWidth &&
                             e.clientY > centerY - 30 &&
                             e.clientY < centerY + triggerHeight;

      if (isInTriggerArea && !isNearButtons) {
        setIsVisible(true);
        resetHideTimer();
      } else if (!isInTriggerArea && !isNearButtons) {
        setIsVisible(false);
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      // 移动端左滑显示导航：在呼吸灯区域左滑触发
      if (!isMobile) return;
      
      // 🚀 侧边栏打开时不捕获手势，避免与侧边栏左滑关闭冲突
      if (document.body.hasAttribute('data-sidebar-open')) return;

      const touch = e.touches[0];
      if (!touch) return;

      const triggerWidth = 80; // 移动端触发区域（呼吸灯区域）
      const triggerHeight = 120; // 减小高度，避免与 Token 呼吸灯重叠
      const centerY = window.innerHeight / 2;

      // 检查是否在呼吸灯区域（右侧边缘，从中央往下延伸）
      // Token 呼吸灯在中央上方 150px，导航呼吸灯从中央开始往下
      const isInTriggerArea = touch.clientX > window.innerWidth - triggerWidth &&
                             touch.clientY > centerY - 30 && // 中央上方只留 30px
                             touch.clientY < centerY + triggerHeight - 30; // 主要向下延伸

      if (isInTriggerArea) {
        // 记录触摸起始位置和时间
        touchStartX.current = touch.clientX;
        touchStartY.current = touch.clientY;
        touchStartTime.current = Date.now();
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      // 检测左滑显示：从右侧呼吸灯向左滑动显示导航面板
      if (!isMobile) return;
      if (touchStartX.current === 0) return; // 没有在触发区域开始触摸

      const touch = e.touches[0];
      if (!touch) return;

      const deltaX = touch.clientX - touchStartX.current;
      const deltaY = Math.abs(touch.clientY - touchStartY.current);
      const deltaTime = Date.now() - touchStartTime.current;

      // 左滑显示条件：向左滑动至少50px，垂直偏移小于30px，时间小于500ms
      if (deltaX < -50 && deltaY < 30 && deltaTime < 500) {
        setIsVisible(true);
        setIsNearButtons(false);
        resetHideTimer();
        // 触发触觉反馈
        if (isNavigationHapticEnabled) {
          Haptics.light();
        }
        // 重置触摸状态
        touchStartX.current = 0;
        touchStartY.current = 0;
        touchStartTime.current = 0;
      }
    };

    const handleTouchEnd = () => {
      // 重置触摸状态
      if (!isMobile) return;
      touchStartX.current = 0;
      touchStartY.current = 0;
      touchStartTime.current = 0;
    };

    if (isMobile) {
      window.addEventListener('touchstart', handleTouchStart, { passive: true });
      window.addEventListener('touchmove', handleTouchMove, { passive: true });
      window.addEventListener('touchend', handleTouchEnd, { passive: true });
    } else {
      window.addEventListener('mousemove', handleMouseMove);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
        hideTimer.current = null;
      }
    };
  }, [containerId, isNearButtons, resetHideTimer, isMobile, isNavigationHapticEnabled]);

  // 监听滚动事件
  useEffect(() => {
    if (!showNavigationOnScroll) return;
    const container = document.getElementById(containerId);
    if (!container) return;

    let throttleTimer: NodeJS.Timeout | null = null;
    const handleScroll = () => {
      if (throttleTimer) return;
      throttleTimer = setTimeout(() => {
        throttleTimer = null;
        if (scrollTimer.current) clearTimeout(scrollTimer.current);
        setIsVisible(true);
        scrollTimer.current = setTimeout(() => {
          setIsVisible(prev => isNearButtons ? prev : false);
          scrollTimer.current = null;
        }, 1000);
      }, 50);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (throttleTimer) clearTimeout(throttleTimer);
      if (scrollTimer.current) {
        clearTimeout(scrollTimer.current);
        scrollTimer.current = null;
      }
    };
  }, [containerId, showNavigationOnScroll, isNearButtons]);

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
        hideTimer.current = null;
      }
      if (scrollTimer.current) {
        clearTimeout(scrollTimer.current);
        scrollTimer.current = null;
      }
    };
  }, []);

  // 计算导航组件的垂直位置
  // 当键盘弹出时，导航应该在可视消息列表区域的中间
  const navigationPosition = useMemo(() => {
    if (keyboardHeight > 0) {
      // 键盘弹出时：计算可视区域的中心点
      // 可视区域 = 屏幕高度 - 键盘高度 - 输入框高度（约80px）- AppBar高度（约56px）
      const visibleHeight = window.innerHeight - keyboardHeight - 80 - 56;
      const centerY = 56 + visibleHeight / 2; // 从AppBar底部开始计算
      return {
        top: `${centerY}px`,
        transform: 'translateY(-50%)',
        // 键盘弹出时缩小导航尺寸
        scale: 0.85
      };
    }
    // 键盘隐藏时：正常居中
    return {
      top: '50%',
      transform: 'translateY(-50%)',
      scale: 1
    };
  }, [keyboardHeight]);

  // 是否显示导航按钮
  const showNavigation = messageNavigation === 'buttons';

  return (
    <>
      {/* Token用量指示器 - 完全独立，有自己的呼吸灯和触发逻辑 */}
      <ContextTokenIndicator topicId={topicId} />

      {/* 以下内容仅在启用对话导航时显示 */}
      {showNavigation && (
        <>
          {/* 触发区域提示：呼吸灯 - 支持桌面端和移动端 */}
          {!isVisible && (
            <Box
              sx={{
                position: 'fixed',
                right: 0,
                top: navigationPosition.top,
                transform: navigationPosition.transform,
                width: isMobile ? 4 : 6, // 桌面端稍宽
                height: keyboardHeight > 0 ? 60 : (isMobile ? 100 : 120), // 桌面端稍高
                bgcolor: 'primary.main',
                opacity: isMobile ? 0.3 : 0.4,
                borderRadius: '4px 0 0 4px',
                zIndex: 999,
                pointerEvents: 'none',
                transition: 'all 0.2s ease-out',
                '@keyframes pulse': {
                  '0%': {
                    opacity: isMobile ? 0.3 : 0.35,
                    scaleY: 1
                  },
                  '50%': {
                    opacity: isMobile ? 0.6 : 0.7,
                    scaleY: 1.1
                  },
                  '100%': {
                    opacity: isMobile ? 0.3 : 0.35,
                    scaleY: 1
                  }
                },
                animation: 'pulse 2s ease-in-out infinite',
                // 桌面端悬停效果
                ...(!isMobile && {
                  '&:hover': {
                    opacity: 0.8,
                    width: 8
                  }
                })
              }}
            />
          )}

          <Fade in={isVisible} timeout={300}>
        <Box
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          sx={{
            position: 'fixed',
            right: isMobile ? 8 : 16,
            top: navigationPosition.top,
            transform: `${navigationPosition.transform} scale(${navigationPosition.scale})`,
            zIndex: 1000,
            pointerEvents: isVisible ? 'auto' : 'none',
            transition: 'all 0.2s ease-out' // 平滑过渡动画
          }}
        >
        <Paper
          elevation={8}
          sx={{
            display: 'flex',
            flexDirection: 'column',
            borderRadius: isMobile ? 2 : 2,
            overflow: 'hidden',
            // 移动端使用半透明背景
            bgcolor: isMobile ? 'rgba(255, 255, 255, 0.85)' : 'background.paper',
            backdropFilter: 'blur(8px)',
            border: '1px solid',
            borderColor: 'divider',
            minWidth: isMobile ? 36 : 'auto', // 减小移动端宽度
            // 深色模式下的背景
            ...(theme.palette.mode === 'dark' && isMobile && {
              bgcolor: 'rgba(18, 18, 18, 0.85)'
            })
          }}
        >
          {/* 滚动时显示导航开关按钮 */}
          <Tooltip 
            title={showNavigationOnScroll ? "滚动时显示导航：已开启" : "滚动时显示导航：已关闭"} 
            placement="left" 
            disableHoverListener={isMobile}
          >
            <IconButton
              onClick={handleToggleScrollNavigation}
              size="small"
              sx={{
                borderRadius: 0,
                minHeight: isMobile ? 36 : 'auto',
                minWidth: isMobile ? 36 : 'auto',
                padding: isMobile ? '6px' : '8px',
                bgcolor: showNavigationOnScroll ? 'action.selected' : 'transparent',
                '&:hover': {
                  bgcolor: 'action.hover'
                },
                '&:active': {
                  bgcolor: 'action.selected'
                }
              }}
            >
              <Scroll size={isMobile ? 18 : 20} style={{ 
                opacity: showNavigationOnScroll ? 1 : 0.5 
              }} />
            </IconButton>
          </Tooltip>

          <Tooltip title="回到顶部" placement="left" disableHoverListener={isMobile}>
            <IconButton
              onClick={handleScrollToTop}
              size="small"
              sx={{
                borderRadius: 0,
                minHeight: isMobile ? 36 : 'auto', // 减小移动端高度
                minWidth: isMobile ? 36 : 'auto',  // 减小移动端宽度
                padding: isMobile ? '6px' : '8px', // 调整内边距
                '&:hover': {
                  bgcolor: 'action.hover'
                },
                '&:active': {
                  bgcolor: 'action.selected'
                }
              }}
            >
              <ArrowUp size={isMobile ? 18 : 20} />
            </IconButton>
          </Tooltip>

          <Tooltip title="上一条消息" placement="left" disableHoverListener={isMobile}>
            <IconButton
              onClick={handlePrevMessage}
              size="small"
              sx={{
                borderRadius: 0,
                minHeight: isMobile ? 36 : 'auto',
                minWidth: isMobile ? 36 : 'auto',
                padding: isMobile ? '6px' : '8px',
                '&:hover': {
                  bgcolor: 'action.hover'
                },
                '&:active': {
                  bgcolor: 'action.selected'
                }
              }}
            >
              <ChevronUp size={isMobile ? 18 : 20} />
            </IconButton>
          </Tooltip>

          <Tooltip title="下一条消息" placement="left" disableHoverListener={isMobile}>
            <IconButton
              onClick={handleNextMessage}
              size="small"
              sx={{
                borderRadius: 0,
                minHeight: isMobile ? 36 : 'auto',
                minWidth: isMobile ? 36 : 'auto',
                padding: isMobile ? '6px' : '8px',
                '&:hover': {
                  bgcolor: 'action.hover'
                },
                '&:active': {
                  bgcolor: 'action.selected'
                }
              }}
            >
              <ChevronDown size={isMobile ? 18 : 20} />
            </IconButton>
          </Tooltip>

          <Tooltip title="回到底部" placement="left" disableHoverListener={isMobile}>
            <IconButton
              onClick={handleScrollToBottom}
              size="small"
              sx={{
                borderRadius: 0,
                minHeight: isMobile ? 36 : 'auto',
                minWidth: isMobile ? 36 : 'auto',
                padding: isMobile ? '6px' : '8px',
                '&:hover': {
                  bgcolor: 'action.hover'
                },
                '&:active': {
                  bgcolor: 'action.selected'
                }
              }}
            >
              <ArrowDown size={isMobile ? 18 : 20} />
            </IconButton>
          </Tooltip>
        </Paper>
        </Box>
      </Fade>
        </>
      )}
    </>
  );
};

export default ChatNavigation;
