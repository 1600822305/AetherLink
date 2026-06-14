import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Box, Paper, Typography, Fade, useMediaQuery, useTheme, LinearProgress } from '@mui/material';
import { Zap, Database } from 'lucide-react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../shared/store';
import { selectMessagesForTopic } from '../../shared/store/selectors/messageSelectors';
import { estimateMessagesTokens } from '../../shared/services/ai/ContextCondenseService';
import { findModelInProviders } from '../../shared/utils/modelUtils';
import { getMainTextContent } from '../../shared/utils/blockUtils';
import { useKeyboard } from '../../shared/hooks/useKeyboard';
import { Haptics } from '../../shared/utils/hapticFeedback';
import { createLogger } from '../../shared/services/infra/logger';

const logger = createLogger('ContextTokenIndicator');

interface ContextTokenIndicatorProps {
  topicId?: string;
}

/**
 * 上下文Token指示器组件
 * 显示当前对话的上下文长度、Token用量和数据大小
 * 通过左滑呼吸灯触发显示
 */
const ContextTokenIndicator: React.FC<ContextTokenIndicatorProps> = ({
  topicId
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  // 移除折叠状态，完全显示所有信息
  const [isVisible, setIsVisible] = useState(false);
  const { keyboardHeight } = useKeyboard();
  
  // 触摸状态引用
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const touchStartTime = useRef<number>(0);
  const hideTimer = useRef<NodeJS.Timeout | null>(null);
  
  // 获取触觉反馈设置
  const hapticFeedback = useSelector((state: RootState) =>
    (state.settings as any).hapticFeedback
  );
  const isHapticEnabled = hapticFeedback?.enabled && hapticFeedback?.enableOnNavigation;
  
  // 获取Token指示器开关设置
  const showContextTokenIndicator = useSelector((state: RootState) =>
    (state.settings as any).showContextTokenIndicator ?? true
  );
  
  // 重置隐藏计时器
  const resetHideTimer = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
    hideTimer.current = setTimeout(() => {
      setIsVisible(false);
    }, 1500); // 1.5秒后自动隐藏，与导航组件保持一致
  }, []);
  
  // 计算触发区域位置（在导航呼吸灯上方 150px，避免重叠）
  const getTriggerArea = useCallback(() => {
    const triggerWidth = 30; // 与导航一致：30px 触发宽度
    const triggerHeight = 80; // Token 指示器触发高度
    const centerY = keyboardHeight > 0
      ? 56 + (window.innerHeight - keyboardHeight - 80 - 56) / 2 - 150
      : window.innerHeight / 2 - 150; // 上移到中央上方 150px
    
    return {
      left: window.innerWidth - triggerWidth,
      top: centerY - triggerHeight / 2,
      bottom: centerY + triggerHeight / 2,
      width: triggerWidth,
      height: triggerHeight
    };
  }, [keyboardHeight]);
  
  // 移动端左滑触发逻辑
  useEffect(() => {
    if (!isMobile || !showContextTokenIndicator) return;
    
    const handleTouchStart = (e: TouchEvent) => {
      // 🚀 侧边栏打开时不捕获手势，避免与侧边栏左滑关闭冲突
      if (document.body.hasAttribute('data-sidebar-open')) return;
      
      const touch = e.touches[0];
      if (!touch) return;
      
      const area = getTriggerArea();
      const isInTriggerArea = touch.clientX > area.left &&
                             touch.clientY > area.top &&
                             touch.clientY < area.bottom;
      
      if (isInTriggerArea) {
        touchStartX.current = touch.clientX;
        touchStartY.current = touch.clientY;
        touchStartTime.current = Date.now();
      }
    };
    
    const handleTouchMove = (e: TouchEvent) => {
      if (touchStartX.current === 0) return;
      
      const touch = e.touches[0];
      if (!touch) return;
      
      const deltaX = touch.clientX - touchStartX.current;
      const deltaY = Math.abs(touch.clientY - touchStartY.current);
      const deltaTime = Date.now() - touchStartTime.current;
      
      // 左滑触发：向左滑动至少40px
      if (deltaX < -40 && deltaY < 30 && deltaTime < 500) {
        setIsVisible(true);
        resetHideTimer();
        if (isHapticEnabled) {
          Haptics.light();
        }
        touchStartX.current = 0;
        touchStartY.current = 0;
        touchStartTime.current = 0;
      }
    };
    
    const handleTouchEnd = () => {
      touchStartX.current = 0;
      touchStartY.current = 0;
      touchStartTime.current = 0;
    };
    
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    
    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
      }
    };
  }, [isMobile, showContextTokenIndicator, isHapticEnabled, resetHideTimer, getTriggerArea]);
  
  // 桌面端鼠标悬停触发逻辑
  useEffect(() => {
    if (isMobile || !showContextTokenIndicator) return;
    
    let lastMoveTime = 0;
    
    const handleMouseMove = (e: MouseEvent) => {
      const now = Date.now();
      if (now - lastMoveTime < 50) return; // 节流
      lastMoveTime = now;
      
      const area = getTriggerArea();
      const isInTriggerArea = e.clientX > area.left &&
                             e.clientY > area.top &&
                             e.clientY < area.bottom;
      
      if (isInTriggerArea) {
        // 鼠标进入触发区域，显示卡片
        setIsVisible(true);
        resetHideTimer();
      } else if (isVisible) {
        // 卡片已显示时，检查是否在卡片范围内
        const cardElement = document.querySelector('[data-testid="context-token-card"]') as HTMLElement;
        if (cardElement) {
          const cardRect = cardElement.getBoundingClientRect();
          const isInCardArea = e.clientX >= cardRect.left - 10 && // 左边留10px缓冲
                               e.clientX <= cardRect.right + 10 && // 右边留10px缓冲
                               e.clientY >= cardRect.top - 10 && // 上方留10px缓冲
                               e.clientY <= cardRect.bottom + 10; // 下方留10px缓冲
          
          if (isInCardArea) {
            // 在卡片范围内，重置隐藏计时器
            resetHideTimer();
          } else {
            // 离开卡片范围，立即隐藏
            setIsVisible(false);
          }
        } else {
          // 找不到卡片元素，立即隐藏
          setIsVisible(false);
        }
      }
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
      }
    };
  }, [isMobile, showContextTokenIndicator, resetHideTimer, getTriggerArea, isVisible]);
  
  // 获取当前话题的消息
  const currentMessages = useSelector((state: RootState) => {
    if (!topicId) return [];
    const messages = selectMessagesForTopic(state, topicId);
    return Array.isArray(messages) ? messages : [];
  });
  
  // 获取当前模型信息
  const providers = useSelector((state: RootState) => state.settings.providers);
  const currentModelId = useSelector((state: RootState) => state.settings.currentModelId);
  
  // 获取上下文设置
  const [contextSettings, setContextSettings] = useState<{ contextWindowSize: number; contextCount: number }>({
    contextWindowSize: 100000, // 默认 10 万 Token
    contextCount: 20
  });
  
  // 异步加载上下文设置
  useEffect(() => {
    const loadSettings = () => {
      try {
        const appSettingsJSON = localStorage.getItem('appSettings');
        if (appSettingsJSON) {
          const appSettings = JSON.parse(appSettingsJSON);
          setContextSettings({
            contextWindowSize: appSettings.contextWindowSize || 100000,
            contextCount: appSettings.contextCount || 20
          });
        }
      } catch (error) {
        logger.error('读取上下文设置失败:', error);
      }
    };
    
    // 初始加载
    loadSettings();
    
    // 监听 localStorage 变化（其他标签页）
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'appSettings') {
        loadSettings();
      }
    };
    
    // 监听自定义事件（当前页面设置变化）
    const handleAppSettingsChanged = () => {
      loadSettings();
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('appSettingsChanged', handleAppSettingsChanged);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('appSettingsChanged', handleAppSettingsChanged);
    };
  }, []);
  
  // 计算Token统计信息（类似 Roo Code 逻辑）
  const tokenStats = useMemo(() => {
    // 获取模型的上下文窗口大小
    let modelMaxTokens = 4096; // 默认值
    if (currentModelId) {
      const result = findModelInProviders(providers, currentModelId, { includeDisabled: false });
      if (result?.model) {
        modelMaxTokens = result.model.maxTokens || 4096;
      }
    }
    
    // 使用用户设置的窗口大小，如果为 0 则使用模型默认值
    const effectiveMaxTokens = contextSettings.contextWindowSize > 0 
      ? contextSettings.contextWindowSize 
      : modelMaxTokens;
    
    if (!currentMessages || currentMessages.length === 0) {
      return {
        totalTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        modelMaxTokens,
        effectiveMaxTokens,
        usagePercent: 0,
        messageCount: 0,
        contextMessageCount: 0,
        dataSize: 0,
        dataSizeFormatted: '0 B',
        contextCount: contextSettings.contextCount,
        contextWindowSize: contextSettings.contextWindowSize
      };
    }
    
    // 类似 Roo Code：从最近一次 API 调用获取 token 数
    // 找到最后一条 AI 回复消息
    let totalTokens = 0;
    let inputTokens = 0;
    let outputTokens = 0;
    let contextMessages = currentMessages; // 默认所有消息
    
    for (let i = currentMessages.length - 1; i >= 0; i--) {
      const message = currentMessages[i];
      if (message.role === 'assistant' && message.usage) {
        // 使用实际的 usage 信息（输入 + 输出）
        inputTokens = message.usage.promptTokens || 0;
        outputTokens = message.usage.completionTokens || 0;
        totalTokens = inputTokens + outputTokens;
        break;
      }
    }
    
    // 如果没有找到 usage 信息，回退到估算逻辑
    if (totalTokens === 0) {
      // 根据 contextCount 设置限制实际发送的消息数
      const actualMessageCount = contextSettings.contextCount >= 100 
        ? currentMessages.length 
        : Math.min(currentMessages.length, contextSettings.contextCount * 2);
      
      contextMessages = currentMessages.slice(-actualMessageCount);
      totalTokens = estimateMessagesTokens(contextMessages);
      inputTokens = totalTokens;
      outputTokens = 0;
    }
    
    // 计算使用百分比（基于有效上下文窗口）
    const usagePercent = Math.min(100, (totalTokens / effectiveMaxTokens) * 100);
    
    // 计算数据大小（估算最近的消息）
    let dataSize = 0;
    const recentMessages = currentMessages.slice(-10); // 取最近10条消息估算大小
    recentMessages.forEach((msg: any) => {
      const content = getMainTextContent(msg);
      if (content) {
        dataSize += new Blob([content]).size;
      }
    });
    
    // 格式化数据大小
    const formatSize = (bytes: number): string => {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    };
    
    return {
      totalTokens,
      inputTokens,
      outputTokens,
      modelMaxTokens,
      effectiveMaxTokens,
      usagePercent,
      messageCount: currentMessages.length, // 话题总消息数
      contextMessageCount: contextMessages.length, // 实际发送的消息数
      dataSize,
      dataSizeFormatted: formatSize(dataSize),
      contextCount: contextSettings.contextCount,
      contextWindowSize: contextSettings.contextWindowSize
    };
  }, [currentMessages, currentModelId, providers, contextSettings]);
  
  // 格式化数字显示
  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return num.toString();
  };
  
  // 获取进度条颜色
  const getProgressColor = (percent: number): string => {
    if (percent >= 90) return theme.palette.error.main;
    if (percent >= 70) return theme.palette.warning.main;
    return theme.palette.primary.main;
  };
  
  // 计算呼吸灯位置（在导航呼吸灯上方 150px，保持足够间距）
  const indicatorBreathingPosition = useMemo(() => {
    if (keyboardHeight > 0) {
      const visibleHeight = window.innerHeight - keyboardHeight - 80 - 56;
      const centerY = 56 + visibleHeight / 2;
      // 在导航呼吸灯上方 150px
      return {
        top: `${centerY - 150}px`,
        transform: 'translateY(-50%)'
      };
    }
    return {
      top: 'calc(50% - 150px)',
      transform: 'translateY(-50%)'
    };
  }, [keyboardHeight]);

  // 如果设置关闭、没有话题或消息，不显示
  if (!showContextTokenIndicator || !topicId || currentMessages.length === 0) {
    return null;
  }

  return (
    <>
      {/* 呼吸灯指示器 - 位于导航呼吸灯上方，支持桌面端和移动端 */}
      {!isVisible && (
        <Box
          sx={{
            position: 'fixed',
            right: 0,
            top: indicatorBreathingPosition.top,
            transform: indicatorBreathingPosition.transform,
            width: isMobile ? 4 : 6, // 桌面端稍宽
            height: keyboardHeight > 0 ? 40 : (isMobile ? 60 : 80), // 桌面端稍高
            // 根据使用率显示不同颜色（先判断高阈值）
            bgcolor: tokenStats.usagePercent >= 90 
              ? 'error.main' 
              : tokenStats.usagePercent >= 70 
                ? 'warning.main' 
                : 'success.main',
            opacity: isMobile ? 0.4 : 0.5,
            borderRadius: '4px 0 0 4px',
            zIndex: 999,
            pointerEvents: 'none',
            cursor: 'pointer',
            transition: 'all 0.2s ease-out',
            '@keyframes tokenPulse': {
              '0%': {
                opacity: isMobile ? 0.3 : 0.4,
                scaleY: 1
              },
              '50%': {
                opacity: isMobile ? 0.7 : 0.8,
                scaleY: 1.15
              },
              '100%': {
                opacity: isMobile ? 0.3 : 0.4,
                scaleY: 1
              }
            },
            animation: 'tokenPulse 2.5s ease-in-out infinite',
            // 桌面端悬停效果
            ...(!isMobile && {
              '&:hover': {
                opacity: 0.9,
                width: 8
              }
            })
          }}
        />
      )}

      {/* Token信息面板 */}
      <Fade in={isVisible} timeout={300}>
        <Box
          data-testid="context-token-card"
          sx={{
            position: 'fixed',
            right: isMobile ? 8 : 16,
            // 位于导航面板上方
            top: indicatorBreathingPosition.top,
            transform: indicatorBreathingPosition.transform,
            zIndex: 1001, // 高于导航面板
            pointerEvents: isVisible ? 'auto' : 'none',
            transition: 'all 0.2s ease-out'
          }}
        >
          <Paper
            elevation={8}
            sx={{
              borderRadius: 2,
              overflow: 'hidden',
              bgcolor: isMobile ? 'rgba(255, 255, 255, 0.92)' : 'background.paper',
              backdropFilter: 'blur(12px)',
              border: '1px solid',
              borderColor: 'divider',
              minWidth: isMobile ? 140 : 160,
              maxWidth: isMobile ? 180 : 200,
              ...(theme.palette.mode === 'dark' && isMobile && {
                bgcolor: 'rgba(18, 18, 18, 0.92)'
              })
            }}
          >
            {/* Token用量进度条 */}
            <Box sx={{ px: 1.5, py: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Zap size={14} color={getProgressColor(tokenStats.usagePercent)} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.7rem' }}>
                      上下文
                    </Typography>
                    <Typography 
                      variant="caption" 
                      sx={{ 
                        fontSize: '0.65rem',
                        color: getProgressColor(tokenStats.usagePercent)
                      }}
                    >
                      {formatNumber(tokenStats.totalTokens)} | {formatNumber(tokenStats.effectiveMaxTokens)}
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={tokenStats.usagePercent}
                    sx={{
                      height: 4,
                      borderRadius: 2,
                      bgcolor: theme.palette.mode === 'dark' 
                        ? 'rgba(255,255,255,0.1)' 
                        : 'rgba(0,0,0,0.08)',
                      '& .MuiLinearProgress-bar': {
                        bgcolor: getProgressColor(tokenStats.usagePercent),
                        borderRadius: 2
                      }
                    }}
                  />
                </Box>
              </Box>

              {/* Token用量详细信息 */}
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 0.5, 
                py: 0.5,
                borderTop: '1px solid',
                borderColor: 'divider'
              }}>
                <Zap size={12} color={theme.palette.text.secondary} />
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                  Token用量
                </Typography>
                <Typography variant="caption" sx={{ ml: 'auto', fontSize: '0.7rem', fontWeight: 500 }}>
                  上{formatNumber(tokenStats.inputTokens)} 下{formatNumber(tokenStats.outputTokens)}
                </Typography>
              </Box>

              {/* 数据大小 */}
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 0.5, 
                py: 0.5
              }}>
                <Database size={12} color={theme.palette.text.secondary} />
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                  大小
                </Typography>
                <Typography variant="caption" sx={{ ml: 'auto', fontSize: '0.7rem', fontWeight: 500 }}>
                  {tokenStats.dataSizeFormatted}
                </Typography>
              </Box>
            </Box>
          </Paper>
        </Box>
      </Fade>
    </>
  );
};

export default ContextTokenIndicator;
