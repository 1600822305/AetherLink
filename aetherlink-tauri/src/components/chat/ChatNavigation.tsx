import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Box, IconButton, Tooltip, Paper, Fade, useMediaQuery, useTheme } from '@mui/material';
import { ChevronUp, ChevronDown, ArrowUp, ArrowDown } from 'lucide-react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../shared/store';

interface ChatNavigationProps {
  containerId: string;
}

const ChatNavigation: React.FC<ChatNavigationProps> = ({ containerId }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isNearButtons, setIsNearButtons] = useState(false);
  const hideTimer = useRef<NodeJS.Timeout | null>(null);
  const lastMoveTime = useRef(0);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const messageNavigation = useSelector((state: RootState) =>
    (state.settings as any).messageNavigation || 'none'
  );

  const resetHideTimer = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
    }
    hideTimer.current = setTimeout(() => {
      if (!isNearButtons) {
        setIsVisible(false);
      }
    }, 3000);
  }, [isNearButtons]);

  const handleMouseEnter = useCallback(() => {
    setIsNearButtons(true);
    setIsVisible(true);
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsNearButtons(false);
    resetHideTimer();
  }, [resetHideTimer]);

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
  }, [resetHideTimer, findAllMessages, getCurrentVisibleIndex, scrollToTop, scrollToMessage]);

  const handleNextMessage = useCallback(() => {
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
  }, [resetHideTimer, findAllMessages, getCurrentVisibleIndex, scrollToBottom, scrollToMessage]);

  const handleScrollToTop = useCallback(() => {
    resetHideTimer();
    scrollToTop();
  }, [resetHideTimer, scrollToTop]);

  const handleScrollToBottom = useCallback(() => {
    resetHideTimer();
    scrollToBottom();
  }, [resetHideTimer, scrollToBottom]);

  useEffect(() => {
    const container = document.getElementById(containerId);
    if (!container) return;

    const handleMouseMove = (e: MouseEvent) => {
      // 桌面端鼠标移动逻辑
      if (isMobile) return;

      const now = Date.now();
      if (now - lastMoveTime.current < 100) return;
      lastMoveTime.current = now;

      const triggerWidth = 100;
      const isInTriggerArea = e.clientX > window.innerWidth - triggerWidth;

      if (isInTriggerArea && !isNearButtons) {
        setIsVisible(true);
        resetHideTimer();
      } else if (!isInTriggerArea && !isNearButtons) {
        setIsVisible(false);
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      // 移动端点击逻辑
      if (!isMobile) return;

      const touch = e.touches[0];
      if (!touch) return;

      const triggerWidth = 80; // 移动端触发区域稍小一些
      const triggerHeight = 200; // 中间区域高度
      const centerY = window.innerHeight / 2;

      const isInTriggerArea = touch.clientX > window.innerWidth - triggerWidth &&
                             touch.clientY > centerY - triggerHeight / 2 &&
                             touch.clientY < centerY + triggerHeight / 2;

      if (isInTriggerArea && !isNearButtons) {
        setIsVisible(true);
        resetHideTimer();
      }
    };

    if (isMobile) {
      window.addEventListener('touchstart', handleTouchStart, { passive: true });
    } else {
      window.addEventListener('mousemove', handleMouseMove);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchstart', handleTouchStart);
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
      }
    };
  }, [containerId, isNearButtons, resetHideTimer, isMobile]);

  // 如果设置为none，不显示导航
  if (messageNavigation !== 'buttons') {
    return null;
  }

  return (
    <>
      {/* 移动端触发区域提示 */}
      {isMobile && !isVisible && (
        <Box
          sx={{
            position: 'fixed',
            right: 0,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 4,
            height: 100,
            bgcolor: 'primary.main',
            opacity: 0.3,
            borderRadius: '4px 0 0 4px',
            zIndex: 999,
            pointerEvents: 'none',
            '@keyframes pulse': {
              '0%': {
                opacity: 0.3,
                transform: 'translateY(-50%) scaleY(1)'
              },
              '50%': {
                opacity: 0.6,
                transform: 'translateY(-50%) scaleY(1.1)'
              },
              '100%': {
                opacity: 0.3,
                transform: 'translateY(-50%) scaleY(1)'
              }
            },
            animation: 'pulse 2s ease-in-out infinite'
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
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 1000,
            pointerEvents: isVisible ? 'auto' : 'none'
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
  );
};

export default ChatNavigation;
