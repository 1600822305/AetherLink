import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  IconButton,
  Menu,
  MenuItem,
  Box,
  useTheme,
  Chip,
  Popover,
  Typography,
  List,
  ListItem,
  ListItemText,
  Button,
  Tooltip
} from '@mui/material';
import {
  MoreVertical,
  Volume2,
  VolumeX,
  History,
  GitBranch,
  Copy,
  RefreshCw,
  Trash2,
  Edit,
  Plus,
  ChevronLeft,
  ChevronRight,
  FileText,
} from 'lucide-react';
import TokenDisplay from '../chat/TokenDisplay';
import type { Message, MessageVersion } from '../../shared/types/newMessage.ts';
import MessageEditor from './MessageEditor';
import UnifiedExportMenu from './UnifiedExportMenu';
import { TTSManager } from '../../shared/services/tts-v2';
import { getMainTextContent } from '../../shared/utils/messageUtils';
import { toastManager } from '../EnhancedToast';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';
import { EventEmitter, EVENT_NAMES } from '../../shared/services/infra/EventService';
import { getStorageItem } from '../../shared/utils/storage';
import { useAppSelector } from '../../shared/store';
import { Clipboard } from '@capacitor/clipboard';
import { Z_INDEX } from '../../shared/constants/zIndex';
import MessageTranslateButton from './MessageTranslateButton';
import { createLogger } from '../../shared/services/infra/logger';

const logger = createLogger('MessageActions');

// 初始化 dayjs 插件和全局语言设置
dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

interface MessageActionsProps {
  message: Message;
  topicId?: string;
  messageIndex?: number; // 消息在列表中的索引，用于分支功能
  onRegenerate?: (messageId: string) => void;
  onDelete?: (messageId: string) => void;
  onSwitchVersion?: (messageId: string) => void;
  onResend?: (messageId: string) => void; // 新增重新发送回调
  renderMode?: 'full' | 'menuOnly' | 'toolbar'; // 新增渲染模式参数
  customTextColor?: string; // 自定义文字颜色
}

// 优化：将样式常量移到组件外部，避免每次渲染重新计算
// 注意：原本的 getThemeColors 函数已迁移到 CSS Variables
// AI 气泡颜色现在通过 CSS Variables 管理

// 优化：将重复的样式对象移到组件外部
const getToolbarIconButtonStyle = (customColor?: string) => ({
  padding: 0.5,
  opacity: 0.8,
  color: customColor || 'text.primary',
  '&:hover': {
    opacity: 1,
    transform: 'scale(1.1)'
  },
  transition: 'all 0.2s ease-in-out'
});

const menuButtonStyle = (isDark: boolean) => ({
  padding: 0.5,
  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.08)',
  borderRadius: '50%',
  width: 20,
  height: 20,
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  opacity: 0.8,
  boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
  '&:hover': {
    opacity: 1,
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.15)'
  }
});

// 删除按钮的特殊样式
const getDeleteButtonStyle = (isClicked: boolean, errorColor: string, customColor?: string) => ({
  ...getToolbarIconButtonStyle(customColor),
  color: isClicked ? errorColor : (customColor || 'text.primary'),
  opacity: isClicked ? 1 : 0.8,
  transform: isClicked ? 'scale(1.1)' : 'scale(1)',
  transition: 'all 0.2s ease-in-out'
});

// 常用样式对象，避免重复创建
const microBubbleContainerStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '2px',
  position: 'relative',
  top: '-1px'
} as const;

const toolbarContainerStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 0.5,
  width: '100%',
  overflow: 'visible', // 允许 token 显示溢出
  minWidth: 0 // 允许 flex 子元素缩小
} as const;

const toolbarButtonGroupStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 0.5,
  flex: 1
} as const;

const MessageActions: React.FC<MessageActionsProps> = React.memo(({
  message,
  topicId,
  messageIndex = 0,
  onRegenerate,
  onDelete,
  onSwitchVersion,
  onResend,
  renderMode = 'full', // 默认为完整渲染模式
  customTextColor
}) => {
  const isUser = message.role === 'user';
  const theme = useTheme();

  // 获取工具栏按钮样式
  const toolbarIconButtonStyle = getToolbarIconButtonStyle(customTextColor);

  // 获取版本切换样式设置
  const settings = useAppSelector((state) => state.settings);
  const versionSwitchStyle = (settings as any).versionSwitchStyle || 'popup';

  // 检查是否显示小功能气泡
  const showMicroBubbles = settings.showMicroBubbles !== false;

  // 检查是否显示TTS播放按钮
  const showTTSButton = (settings as any).showTTSButton !== false;

  // 菜单状态 - 内存泄漏防护：避免存储DOM引用
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const menuOpen = Boolean(anchorEl);

  // 编辑对话框状态
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  // 版本切换弹出框状态 - 内存泄漏防护：避免存储DOM引用
  const [versionAnchorEl, setVersionAnchorEl] = useState<null | HTMLElement>(null);
  const versionPopoverOpen = Boolean(versionAnchorEl);

  // 导出菜单状态 - 使用布尔值控制上拉抽屉
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  // 内存泄漏防护：组件卸载时清理DOM引用和定时器
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      setAnchorEl(null);
      setVersionAnchorEl(null);
      setExportMenuOpen(false);
      // 清理删除按钮定时器
      if (deleteTimerRef.current) {
        clearTimeout(deleteTimerRef.current);
      }
    };
  }, []);
  // 删除按钮状态（两次点击确认）
  const [deleteButtonClicked, setDeleteButtonClicked] = useState(false);
  // 删除按钮定时器引用，防止多个定时器
  const deleteTimerRef = useRef<NodeJS.Timeout | null>(null);

  // TTS播放状态
  const [isPlaying, setIsPlaying] = useState(false);
  // TTS功能启用状态
  const [enableTTS, setEnableTTS] = useState(true);

  // 组件挂载状态，防止内存泄漏
  const mountedRef = useRef(true);

  // 简化TTS初始化 - 只获取启用状态，不重复加载配置
  useEffect(() => {
    const loadTTSEnabled = async () => {
      try {
        const enabled = await getStorageItem<string>('enable_tts');
        const isEnabled = enabled !== 'false'; // 默认启用
        setEnableTTS(isEnabled);
      } catch (error) {
        logger.error('获取TTS启用状态失败:', error);
        setEnableTTS(true); // 默认启用
      }
    };

    loadTTSEnabled();
  }, []);

  // 播放状态管理 - 使用 TTSManager 事件系统
  useEffect(() => {
    const tts = TTSManager.getInstance();

    // 检查当前播放状态
    const checkPlayingStatus = () => {
      if (!mountedRef.current) return;
      const shouldBePlaying = tts.isPlaying && tts.currentMessageId === message.id;
      setIsPlaying(shouldBePlaying);
    };

    // 初始检查
    checkPlayingStatus();

    // 监听 TTSManager 事件
    const unsubscribe = tts.addEventListener((event) => {
      if (!mountedRef.current) return;
      if (event.type === 'start' || event.type === 'end' || event.type === 'error') {
        checkPlayingStatus();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [message.id]);

  // 打开菜单 - 优化：使用useCallback
  const handleMenuClick = useCallback((event: React.MouseEvent<HTMLElement>) => {
    logger.debug('三点菜单被点击', { renderMode, messageId: message.id });
    event.preventDefault();
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  }, []);

  // 关闭菜单 - 优化：使用useCallback
  const handleMenuClose = useCallback(() => {
    setAnchorEl(null);
  }, []);

  // 复制消息内容到剪贴板 - 优化：使用useCallback，修复依赖项
  const handleCopyContent = useCallback(async () => {
    if (!message) return;

    try {
      logger.debug('开始复制内容', { messageId: message.id, renderMode });

      // 使用工具函数获取主文本内容
      const textContent = getMainTextContent(message);
      logger.debug('获取到的文本内容', textContent?.substring(0, 100) + '...');

      if (!textContent || !textContent.trim()) {
        logger.warn('没有可复制的内容');
        alert('没有可复制的内容');
        return;
      }

      // 优先使用Capacitor Clipboard插件（移动端）
      try {
        await Clipboard.write({
          string: textContent
        });
        logger.debug('Capacitor复制成功');
      } catch (capacitorError) {
        logger.debug('Capacitor复制失败，尝试Web API', capacitorError);
        // 如果Capacitor失败，回退到Web API
        await navigator.clipboard.writeText(textContent);
        logger.debug('Web API复制成功');
      }

      // 显示成功提示
      logger.debug('复制内容成功');

      // 发送复制成功事件，用于UI提示（检查是否有监听器）
      if (EventEmitter.listenerCount('ui:copy_success') > 0) {
        EventEmitter.emit('ui:copy_success', { content: '已复制消息内容' });
      }

    } catch (error) {
      logger.error('复制内容失败', error);
      toastManager.error('复制失败: ' + (error instanceof Error ? error.message : '未知错误'), '复制错误');
    } finally {
      // 确保菜单在操作完成后关闭
      handleMenuClose();
    }
  }, [message, handleMenuClose, renderMode]); // 添加缺失的依赖项

  // 打开编辑对话框 - 优化：使用useCallback
  const handleEditClick = useCallback(() => {
    setEditDialogOpen(true);
    handleMenuClose();
  }, [handleMenuClose]);

  // 删除消息 - 根据渲染模式使用不同的删除逻辑
  const handleDeleteClick = useCallback(() => {
    logger.debug('删除消息:', message.id);

    try {
      if (onDelete) {
        onDelete(message.id);
        logger.debug('删除消息成功');
      } else {
        logger.warn('没有删除回调函数');
      }
    } catch (error) {
      logger.error('删除消息失败:', error);
      toastManager.error('删除失败: ' + (error instanceof Error ? error.message : '未知错误'), '删除错误');
    } finally {
      // 重置删除按钮状态
      setDeleteButtonClicked(false);
      // 关闭菜单
      handleMenuClose();
    }
  }, [onDelete, message.id, handleMenuClose]);

  // 工具栏模式的删除 - 保留两次点击确认逻辑，修复多定时器问题
  const handleToolbarDeleteClick = useCallback(() => {
    // 清理之前的定时器
    if (deleteTimerRef.current) {
      clearTimeout(deleteTimerRef.current);
    }

    if (!deleteButtonClicked) {
      // 第一次点击：变红，准备删除
      setDeleteButtonClicked(true);
      // 3秒后自动重置状态
      deleteTimerRef.current = setTimeout(() => {
        if (mountedRef.current) {
          setDeleteButtonClicked(false);
        }
      }, 3000);
    } else {
      // 第二次点击：执行删除
      if (onDelete) {
        onDelete(message.id);
      }
      setDeleteButtonClicked(false);
    }
  }, [deleteButtonClicked, onDelete, message.id]);

  // 重新生成消息 - 优化：使用useCallback
  const handleRegenerateClick = useCallback(() => {
    if (onRegenerate) {
      onRegenerate(message.id);
    }
    handleMenuClose();
  }, [onRegenerate, message.id, handleMenuClose]);

  // 重新发送消息（用户消息）- 优化：使用useCallback
  const handleResendClick = useCallback(() => {
    if (onResend) {
      onResend(message.id);
    }
    handleMenuClose();
  }, [onResend, message.id, handleMenuClose]);

  // 创建分支 - 使用最佳实例的事件机制
  const handleCreateBranch = useCallback(() => {
    if (messageIndex === undefined) {
      logger.error('无法创建分支: 缺少messageIndex');
      return;
    }

    // 发送NEW_BRANCH事件，传递消息索引
    EventEmitter.emit(EVENT_NAMES.NEW_BRANCH, messageIndex);

    handleMenuClose();
  }, [handleMenuClose, messageIndex]);

  // 文本转语音 - 使用 TTSManager
  const handleTextToSpeech = useCallback(async () => {
    try {
      const tts = TTSManager.getInstance();
      const content = getMainTextContent(message);

      // 检查当前是否正在播放这条消息
      if (tts.isPlaying && tts.currentMessageId === message.id) {
        tts.stop();
        setIsPlaying(false);
        return;
      }

      // 立即设置播放状态
      setIsPlaying(true);

      // 使用 TTSManager 播放
      const success = await tts.speak(content, message.id);

      // 检查组件是否已卸载
      if (!mountedRef.current) return;

      if (!success) {
        setIsPlaying(false);
        alert('文本转语音失败');
      }
    } catch (error) {
      logger.error('TTS错误:', error);
      setIsPlaying(false);
      alert('文本转语音失败');
    }

    handleMenuClose();
  }, [message, handleMenuClose]);

  // 检查是否有多个版本 - 放宽条件，对象存在且长度至少为1也显示历史按钮，方便调试
  // 旧逻辑: const hasMultipleVersions = Array.isArray(message.versions) && message.versions.length > 1;
  const hasMultipleVersions = Array.isArray(message.versions) && message.versions.length >= 1;

  // 获取当前版本号 - 根据 currentVersionId 确定
  const getCurrentVersionNumber = useMemo(() => {
    if (!message.versions || message.versions.length === 0) return 1;

    // 如果有 currentVersionId，找到对应版本的索引
    if (message.currentVersionId) {
      const versionIndex = message.versions.findIndex(v => v.id === message.currentVersionId);
      if (versionIndex >= 0) {
        return versionIndex + 1; // 版本从1开始计数
      }
    }

    // 默认显示最新版本
    return message.versions.length + 1;
  }, [message.versions, message.currentVersionId]);

  // 按照 Chatbox 原理：总版本数 = 历史版本数 + 当前版本
  const getTotalVersionCount = useMemo(() => {
    const historyVersionCount = message.versions?.length || 0;
    return historyVersionCount + 1; // 历史版本 + 当前版本
  }, [message.versions]);

  // 获取当前版本索引 - 用于箭头式切换
  const currentVersionIndex = useMemo(() => {
    if (!message.versions || message.versions.length === 0) return -1;

    if (message.currentVersionId) {
      return message.versions.findIndex(v => v.id === message.currentVersionId);
    }

    return -1; // -1 表示当前是最新版本
  }, [message.versions, message.currentVersionId]);

  // 计算总版本数（包括最新版本）
  const totalVersions = useMemo(() => {
    return (message.versions?.length || 0) + 1;
  }, [message.versions]);

  // 箭头式切换 - 前一个版本
  const handlePreviousVersion = useCallback(() => {
    if (!message.versions || message.versions.length === 0) return;

    if (currentVersionIndex === -1) {
      // 当前是最新版本，切换到最后一个历史版本
      const lastVersion = message.versions[message.versions.length - 1];
      if (lastVersion && onSwitchVersion) {
        onSwitchVersion(lastVersion.id);
      }
    } else if (currentVersionIndex > 0) {
      // 切换到前一个版本
      const prevVersion = message.versions[currentVersionIndex - 1];
      if (prevVersion && onSwitchVersion) {
        onSwitchVersion(prevVersion.id);
      }
    }
  }, [message.versions, currentVersionIndex, onSwitchVersion]);

  // 箭头式切换 - 后一个版本
  const handleNextVersion = useCallback(() => {
    if (!message.versions || message.versions.length === 0) return;

    if (currentVersionIndex === -1) {
      // 已经是最新版本，无需操作
      return;
    } else if (currentVersionIndex === message.versions.length - 1) {
      // 当前是最后一个历史版本，切换到最新版本
      if (onSwitchVersion) {
        onSwitchVersion('latest');
      }
    } else {
      // 切换到下一个版本
      const nextVersion = message.versions[currentVersionIndex + 1];
      if (nextVersion && onSwitchVersion) {
        onSwitchVersion(nextVersion.id);
      }
    }
  }, [message.versions, currentVersionIndex, onSwitchVersion]);

  // 切换到特定版本 - 保留原有函数
  const handleSwitchToVersion = useCallback((versionId: string) => {
    if (onSwitchVersion) {
      onSwitchVersion(versionId);
    }

    // 关闭弹窗
    setVersionAnchorEl(null);
  }, [onSwitchVersion]);

  // 切换到最新版本 - 保留原有函数
  const handleSwitchToLatest = useCallback(() => {
    if (onSwitchVersion) {
      // 传递特殊标记'latest'表示切换到最新版本
      onSwitchVersion('latest');
    }

    // 关闭弹窗
    setVersionAnchorEl(null);
  }, [onSwitchVersion]);

  // 手动创建当前版本 - 保留原有函数
  const handleCreateVersion = useCallback(() => {
    if (onSwitchVersion) {
      // 使用特殊标记'create'表示创建新版本
      onSwitchVersion('create');
    }

    // 关闭弹窗
    setVersionAnchorEl(null);
  }, [onSwitchVersion]);

  // 导出功能处理 - 打开上拉抽屉
  const handleExportClick = useCallback(() => {
    setExportMenuOpen(true);
    handleMenuClose();
  }, [handleMenuClose]);

  const handleExportMenuClose = useCallback(() => {
    setExportMenuOpen(false);
  }, []);

  // 删除特定版本 - 保留原有函数
  const handleDeleteVersion = useCallback((versionId: string, event: React.MouseEvent) => {
    // 阻止事件冒泡，避免触发切换版本
    event.stopPropagation();

    if (onSwitchVersion) {
      // 使用特殊前缀'delete:'表示删除版本
      onSwitchVersion(`delete:${versionId}`);
    }
  }, [onSwitchVersion]);

  // 格式化时间 - 优化：使用useCallback，locale已全局设置
  const formatTime = useCallback((dateString: string) => {
    try {
      return dayjs(dateString).fromNow();
    } catch (error) {
      logger.error('日期格式化错误:', error);
      return '未知时间';
    }
  }, []);

  // 获取版本源信息的显示文本
  const getVersionSourceText = useCallback((version: MessageVersion) => {
    const source = version.metadata?.source;
    if (!source) return '';

    switch (source) {
      case 'regenerate':
        return '重新生成';
      case 'manual':
        return '手动保存';
      case 'auto_before_switch':
        return '自动保存';
      default:
        return '';
    }
  }, []);

  return (
    <>
      {/* 根据renderMode决定渲染哪些部分 */}
      {renderMode === 'full' && showMicroBubbles && (
        /* 只显示版本指示器和播放按钮，不显示三点菜单 */
        <Box sx={microBubbleContainerStyle}>
          {/* 只有助手消息且有多个版本时显示版本指示器 */}
          {!isUser && hasMultipleVersions && (
            <>
              {versionSwitchStyle === 'arrows' ? (
                // 箭头式版本切换
                <Box sx={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: 'var(--theme-msg-ai-bg)',
                  borderRadius: '10px',
                  padding: '0 2px',
                  height: '20px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                  border: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)'}`,
                  marginRight: '2px',
                  '&:hover': {
                    backgroundColor: 'var(--theme-msg-ai-bg-active)',
                    borderColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.15)'
                  }
                }}>
                  <IconButton
                    size="small"
                    onClick={handlePreviousVersion}
                    disabled={currentVersionIndex <= 0 && message.currentVersionId !== undefined}
                    sx={{
                      padding: 0,
                      opacity: currentVersionIndex <= 0 && message.currentVersionId !== undefined ? 0.3 : 0.7,
                      '&:hover': { opacity: 1 },
                      color: 'var(--theme-text-primary)'
                    }}
                  >
                    <ChevronLeft size={12} />
                  </IconButton>

                  <Typography
                    variant="caption"
                    sx={{
                      fontSize: '10px',
                      fontWeight: 'medium',
                      color: 'var(--theme-text-primary)',
                      mx: 0.5,
                      userSelect: 'none'
                    }}
                  >
                    {message.currentVersionId ? currentVersionIndex + 1 : totalVersions}/{totalVersions}
                  </Typography>

                  <IconButton
                    size="small"
                    onClick={handleNextVersion}
                    disabled={currentVersionIndex === -1}
                    sx={{
                      padding: 0,
                      opacity: currentVersionIndex === -1 ? 0.3 : 0.7,
                      '&:hover': { opacity: 1 },
                      color: 'var(--theme-text-primary)'
                    }}
                  >
                    <ChevronRight size={12} />
                  </IconButton>
                </Box>
              ) : (
                // 默认弹出式版本切换
                <Chip
                  size="small"
                  label={`版本 ${getCurrentVersionNumber}/${getTotalVersionCount}`}
                  variant="filled"
                  color="info"
                  onClick={(e) => setVersionAnchorEl(e.currentTarget)}
                  icon={<History size={12} />}
                  sx={{
                    height: 18,
                    paddingLeft: '2px',
                    paddingRight: '4px',
                    fontSize: '10px',
                    fontWeight: 'medium',
                    opacity: 0.95,
                    backgroundColor: 'var(--theme-msg-ai-bg)',
                    color: 'var(--theme-text-primary)',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                    borderRadius: '10px',
                    border: 'none',
                    marginRight: '2px',
                    '&:hover': {
                      opacity: 1,
                      cursor: 'pointer',
                      backgroundColor: 'var(--theme-msg-ai-bg-active)'
                    },
                    '& .MuiChip-icon': {
                      ml: 0.3,
                      mr: -0.3,
                      fontSize: '10px',
                      color: 'var(--theme-text-primary)'
                    },
                    '& .MuiChip-label': {
                      padding: '0 4px',
                      lineHeight: 1.2
                    }
                  }}
                />
              )}
            </>
          )}

          {enableTTS && showTTSButton && (
            <Chip
              size="small"
              label={isPlaying ? "播放中" : "播放"}
              variant="filled"
              color="primary"
              onClick={handleTextToSpeech}
              icon={isPlaying ? <Volume2 size={12} /> : <VolumeX size={12} />}
              sx={{
                height: 18,
                paddingLeft: '2px',
                paddingRight: '4px',
                fontSize: '10px',
                fontWeight: 'medium',
                opacity: 0.95,
                backgroundColor: isPlaying ? 
                  (isUser ? 'var(--theme-msg-user-bg-active)' : 'var(--theme-msg-ai-bg-active)') : 
                  (isUser ? 'var(--theme-msg-user-bg)' : 'var(--theme-msg-ai-bg)'),
                color: 'var(--theme-text-primary)',
                boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                borderRadius: '10px',
                border: versionSwitchStyle === 'arrows' ?
                  `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)'}` : 'none',
                '&:hover': {
                  opacity: 1,
                  cursor: 'pointer',
                  backgroundColor: isUser ? 'var(--theme-msg-user-bg-active)' : 'var(--theme-msg-ai-bg-active)',
                  borderColor: versionSwitchStyle === 'arrows' ?
                    (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.15)') : undefined
                },
                '& .MuiChip-icon': {
                  ml: 0.3,
                  mr: -0.3,
                  fontSize: '10px',
                  color: 'var(--theme-text-primary)'
                },
                '& .MuiChip-label': {
                  padding: '0 4px',
                  lineHeight: 1.2
                }
              }}
            />
          )}
        </Box>
      )}

      {/* 三点菜单按钮 - 只在menuOnly模式下显示 */}
      {renderMode === 'menuOnly' && (
        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation(); // 防止事件冒泡
            handleMenuClick(e);
          }}
          sx={{
            ...menuButtonStyle(theme.palette.mode === 'dark'),
            zIndex: Z_INDEX.MESSAGE.TOOLBAR_BUTTON, // 确保按钮在最上层
          }}
        >
          <MoreVertical size={14} />
        </IconButton>
      )}

      {/* 工具栏模式 - 显示操作按钮 */}
      {renderMode === 'toolbar' && (
        <Box sx={toolbarContainerStyle}>
          {/* 用户消息：Token显示在左侧 */}
          {isUser && (
            <Box sx={{ flexShrink: 0, overflow: 'visible', minWidth: 0 }}>
              <TokenDisplay
                currentMessage={message}
                showCurrentMessage={true}
              />
            </Box>
          )}
          {/* 工具栏按钮组 */}
          <Box sx={{ ...toolbarButtonGroupStyle, justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
            {/* 复制按钮 */}
            <Tooltip title="复制内容">
              <IconButton
                size="small"
                onClick={handleCopyContent}
                sx={toolbarIconButtonStyle}
              >
                <Copy size={16} />
              </IconButton>
            </Tooltip>

          {/* 编辑按钮 */}
          <Tooltip title="编辑">
            <IconButton
              size="small"
              onClick={handleEditClick}
              sx={toolbarIconButtonStyle}
            >
              <Edit size={16} />
            </IconButton>
          </Tooltip>

          {/* 导出/保存按钮 - 合并了分享文件、导出信息、保存为笔记 */}
          <Tooltip title="导出/保存">
            <IconButton
              size="small"
              onClick={handleExportClick}
              sx={toolbarIconButtonStyle}
            >
              <FileText size={16} />
            </IconButton>
          </Tooltip>

          {/* 用户消息：重新发送 */}
          {isUser && (
            <Tooltip title="重新发送">
              <IconButton
                size="small"
                onClick={handleResendClick}
                sx={toolbarIconButtonStyle}
              >
                <RefreshCw size={16} />
              </IconButton>
            </Tooltip>
          )}

          {/* AI消息：重新生成 */}
          {!isUser && (
            <Tooltip title="重新生成">
              <IconButton
                size="small"
                onClick={handleRegenerateClick}
                sx={toolbarIconButtonStyle}
              >
                <RefreshCw size={16} />
              </IconButton>
            </Tooltip>
          )}

          {/* 语音播放 - 对所有消息显示 */}
          {enableTTS && showTTSButton && (
            <Tooltip title={isPlaying ? "停止播放" : "语音播放"}>
              <IconButton
                size="small"
                onClick={handleTextToSpeech}
                sx={{
                  ...toolbarIconButtonStyle,
                  opacity: isPlaying ? 1 : 0.8,
                }}
              >
                {isPlaying ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </IconButton>
            </Tooltip>
          )}

          {/* 翻译按钮 - AI消息显示 */}
          {!isUser && (
            <MessageTranslateButton
              message={message}
              buttonStyle={toolbarIconButtonStyle}
              size={16}
            />
          )}

          {/* AI消息：版本历史 */}
          {!isUser && hasMultipleVersions && (
            <Tooltip title="版本历史">
              <IconButton
                size="small"
                onClick={(e) => setVersionAnchorEl(e.currentTarget)}
                sx={toolbarIconButtonStyle}
              >
                <History size={16} />
              </IconButton>
            </Tooltip>
          )}

          {/* 分支按钮 */}
          <Tooltip title="创建分支">
            <IconButton
              size="small"
              onClick={handleCreateBranch}
              sx={toolbarIconButtonStyle}
            >
              <GitBranch size={16} />
            </IconButton>
          </Tooltip>

          {/* 删除按钮 */}
          <Tooltip title={deleteButtonClicked ? "再次点击确认删除" : "删除"}>
            <IconButton
              size="small"
              onClick={handleToolbarDeleteClick}
              sx={getDeleteButtonStyle(deleteButtonClicked, theme.palette.error.main, customTextColor)}
            >
              <Trash2 size={16} />
            </IconButton>
          </Tooltip>

          </Box>

          {/* AI消息：Token显示在右侧 */}
          {!isUser && (
            <Box sx={{ flexShrink: 0, overflow: 'visible', minWidth: 0 }}>
              <TokenDisplay
                currentMessage={message}
                showCurrentMessage={true}
              />
            </Box>
          )}
        </Box>
      )}

      {/* 版本切换弹出框 */}
      <Popover
        open={versionPopoverOpen}
        anchorEl={versionAnchorEl}
        onClose={() => setVersionAnchorEl(null)}
        disableAutoFocus={true}
        disableRestoreFocus={true}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        PaperProps={{
          sx: {
            maxWidth: '260px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
            borderRadius: '8px',
            mt: 0.5
          }
        }}
      >
        <Box sx={{ p: 0.5 }}>
          <Typography variant="subtitle2" sx={{ px: 0.5, py: 0.25, fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
            <span>消息版本历史</span>
            <Button
              size="small"
              startIcon={<Plus size={13} />}
              onClick={handleCreateVersion}
              variant="outlined"
              color="primary"
              sx={{ fontSize: '0.7rem', py: 0.1, px: 0.5, minWidth: 'auto', height: '20px' }}
            >
              保存当前
            </Button>
          </Typography>
          {/* 版本数量指示器 */}
          {message.versions && message.versions.length > 5 && (
            <Typography
              variant="caption"
              sx={{
                display: 'block',
                textAlign: 'center',
                color: theme.palette.text.secondary,
                fontSize: '0.7rem',
                mb: 0.5
              }}
            >
              显示 5/{message.versions.length + 1} 个版本，滑动查看更多
            </Typography>
          )}
          <List
            dense
            sx={{
              // 计算最大高度 = 单个项目高度(约28px) * 5 = 140px
              maxHeight: '140px',
              overflow: 'auto',
              py: 0,
              // 添加滚动条样式
              '&::-webkit-scrollbar': {
                width: '6px',
              },
              '&::-webkit-scrollbar-track': {
                background: 'transparent',
              },
              '&::-webkit-scrollbar-thumb': {
                background: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)',
                borderRadius: '3px',
              },
              '&::-webkit-scrollbar-thumb:hover': {
                background: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)',
              }
            }}
          >
            {/* 显示所有历史版本 */}
            {message.versions?.map((version, index) => {
              const isCurrentVersion = message.currentVersionId === version.id;
              const sourceText = getVersionSourceText(version);
              return (
                <ListItem
                  key={version.id}
                  onClick={() => handleSwitchToVersion(version.id)}
                  sx={{
                    borderRadius: '4px',
                    mb: 0.2,
                    py: 0.2,
                    px: 1,
                    backgroundColor: isCurrentVersion
                      ? (theme.palette.mode === 'dark' ? 'rgba(25, 118, 210, 0.2)' : 'rgba(25, 118, 210, 0.1)')
                      : 'transparent',
                    '&:hover': {
                      backgroundColor: theme.palette.mode === 'dark'
                        ? 'rgba(255, 255, 255, 0.08)'
                        : 'rgba(0, 0, 0, 0.04)'
                    },
                    cursor: 'pointer',
                    position: 'relative'
                  }}
                >
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                        <span>{`版本 ${index + 1}${isCurrentVersion ? ' (当前)' : ''}`}</span>
                        {sourceText && (
                          <Chip
                            label={sourceText}
                            size="small"
                            sx={{
                              height: 14,
                              fontSize: '0.6rem',
                              backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                              '& .MuiChip-label': { px: 0.5, py: 0 }
                            }}
                          />
                        )}
                      </Box>
                    }
                    secondary={formatTime(version.createdAt)}
                    primaryTypographyProps={{ fontSize: '0.85rem', margin: 0, lineHeight: 1.2 }}
                    secondaryTypographyProps={{ fontSize: '0.7rem', margin: 0, lineHeight: 1.2 }}
                    sx={{ margin: 0 }}
                  />
                  {!isCurrentVersion && (
                    <IconButton
                      size="small"
                      onClick={(e) => handleDeleteVersion(version.id, e)}
                      sx={{
                        position: 'absolute',
                        right: 0,
                        padding: '2px',
                        opacity: 0,
                        transition: 'opacity 0.2s',
                        '&:hover': { opacity: 1, backgroundColor: 'rgba(255, 0, 0, 0.1)' },
                        '.MuiListItem-root:hover &': { opacity: 0.5 }
                      }}
                    >
                      <Trash2 size={13} color={theme.palette.error.main} />
                    </IconButton>
                  )}
                </ListItem>
              );
            })}

            {/* 始终显示最新版本（如果不是历史版本） */}
            {message.versions && message.versions.length > 0 && (
              <ListItem
                key="latest"
                onClick={handleSwitchToLatest}
                sx={{
                  borderRadius: '4px',
                  mb: 0.2,
                  py: 0.2,
                  px: 1,
                  backgroundColor: !message.currentVersionId
                    ? (theme.palette.mode === 'dark' ? 'rgba(25, 118, 210, 0.2)' : 'rgba(25, 118, 210, 0.1)')
                    : 'transparent',
                  '&:hover': {
                    backgroundColor: theme.palette.mode === 'dark'
                      ? 'rgba(255, 255, 255, 0.08)'
                      : 'rgba(0, 0, 0, 0.04)'
                  },
                  cursor: 'pointer'
                }}
              >
                <ListItemText
                  primary={`版本 ${getTotalVersionCount}${!message.currentVersionId ? ' (当前)' : ''}`}
                  secondary="最新版本"
                  primaryTypographyProps={{ fontSize: '0.85rem', margin: 0, lineHeight: 1.2 }}
                  secondaryTypographyProps={{ fontSize: '0.7rem', margin: 0, lineHeight: 1.2 }}
                  sx={{ margin: 0 }}
                />
              </ListItem>
            )}
          </List>
          {/* 滑动提示箭头 - 当有超过5个版本时显示 */}
          {message.versions && message.versions.length > 5 && (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                mt: 0.5,
                opacity: 0.7,
                animation: 'pulse 1.5s infinite ease-in-out',
                '@keyframes pulse': {
                  '0%': { opacity: 0.3, transform: 'translateY(-1px)' },
                  '50%': { opacity: 0.7, transform: 'translateY(2px)' },
                  '100%': { opacity: 0.3, transform: 'translateY(-1px)' }
                }
              }}
            >
              <span style={{ fontSize: '12px', color: theme.palette.text.secondary }}>
                ︾
              </span>
            </Box>
          )}
        </Box>
      </Popover>

      <Menu
        anchorEl={anchorEl}
        open={menuOpen}
        onClose={handleMenuClose}
        disableAutoFocus={true}
        disableRestoreFocus={true}
        disableEnforceFocus={true}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left', // 改为left，避免菜单覆盖主聊天内容
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left', // 改为left，确保菜单从左侧展开
        }}
        slotProps={{
          paper: {
            sx: {
              zIndex: Z_INDEX.MENU.DROPDOWN,
              pointerEvents: 'auto' // 确保菜单可以接收点击事件
            }
          },
          root: {
            slotProps: {
              backdrop: {
                invisible: false,
                sx: {
                  backgroundColor: 'transparent'
                }
              }
            }
          }
        }}
        sx={{
          '& .MuiList-root': {
            zIndex: Z_INDEX.MENU.DROPDOWN,
            '&:focus': {
              outline: 'none'
            }
          }
        }}
      >
        <MenuItem
          onClick={(e) => {
            logger.debug('复制菜单项被点击');
            e.stopPropagation();
            handleCopyContent();
          }}
        >
          复制内容
        </MenuItem>
        <MenuItem onClick={handleExportClick} sx={{ display: 'flex', alignItems: 'center' }}>
          <FileText size={16} style={{ marginRight: '8px' }} />
          导出/保存
        </MenuItem>
        <MenuItem onClick={handleEditClick}>编辑</MenuItem>

        {/* 用户消息特有功能 */}
        {isUser && <MenuItem onClick={handleResendClick}>重新发送</MenuItem>}

        {/* AI消息特有功能 */}
        {!isUser && [
          <MenuItem key="regenerate" onClick={handleRegenerateClick}>重新生成</MenuItem>,
          <MenuItem key="versions" onClick={() => {
            handleMenuClose();
            // 使用消息ID作为DOM元素ID参考
            const messageElement = document.getElementById(`message-${message.id}`);
            setVersionAnchorEl(messageElement || document.body);
          }}>查看历史版本</MenuItem>
        ]}

        {/* 通用功能 */}
        <MenuItem onClick={handleCreateBranch} sx={{ display: 'flex', alignItems: 'center' }}>
          <GitBranch size={16} style={{ marginRight: '8px' }} />
          分支
        </MenuItem>
        <MenuItem onClick={handleDeleteClick}>删除</MenuItem>
      </Menu>

      {/* 编辑对话框 */}
      <MessageEditor
        message={message}
        topicId={topicId}
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
      />

      {/* 统一导出/保存菜单 */}
      <UnifiedExportMenu
        message={message}
        open={exportMenuOpen}
        onClose={handleExportMenuClose}
      />
    </>
  );
}, (prevProps, nextProps) => {
  // 自定义比较函数，只在关键props变化时重新渲染
  // 添加更多状态检查，确保复制功能状态正确
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.blocks?.length === nextProps.message.blocks?.length &&
    prevProps.message.currentVersionId === nextProps.message.currentVersionId &&
    prevProps.message.versions?.length === nextProps.message.versions?.length &&
    prevProps.message.updatedAt === nextProps.message.updatedAt &&
    prevProps.message.createdAt === nextProps.message.createdAt &&
    prevProps.topicId === nextProps.topicId &&
    prevProps.messageIndex === nextProps.messageIndex &&
    prevProps.renderMode === nextProps.renderMode &&
    prevProps.customTextColor === nextProps.customTextColor
  );
});

export default MessageActions;
