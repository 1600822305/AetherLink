import React, { startTransition, useCallback, useMemo, useEffect, useState, useRef } from 'react';
import {
  ListItemButton,
  ListItemText,
  ListItemAvatar,
  Avatar,
  IconButton,
  Typography,
  Box,
  useTheme,
} from '@mui/material';
import { MoreVertical, Trash, AlertTriangle } from 'lucide-react';
import { useSelector } from 'react-redux';
import type { Assistant } from '../../../shared/types/Assistant';
import type { RootState } from '../../../shared/store';

import LucideIconRenderer from './LucideIconRenderer';
import { isLucideIcon } from './iconUtils';

interface AssistantItemProps {
  assistant: Assistant;
  isSelected: boolean;
  onSelectAssistant: (assistant: Assistant) => void;
  onOpenMenu: (event: React.MouseEvent, assistant: Assistant) => void;
  onDeleteAssistant: (assistantId: string, event: React.MouseEvent) => void;
}

/**
 * 单个助手项组件 - 直接从Redux读取最新话题数
 */
function AssistantItem({
  assistant,
  isSelected,
  onSelectAssistant,
  onOpenMenu,
  onDeleteAssistant
}: AssistantItemProps) {
  // 获取主题信息，用于修复图标颜色问题
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';

  // 直接从Redux读取最新的助手数据，获取实时话题数
  const reduxAssistant = useSelector((state: RootState) =>
    state.assistants.assistants.find(a => a.id === assistant.id)
  );

  // 删除确认状态
  const [pendingDelete, setPendingDelete] = useState(false);
  const deleteTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 长按相关状态
  const longPressTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const isLongPressRef = useRef(false);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (deleteTimeoutRef.current) {
        clearTimeout(deleteTimeoutRef.current);
      }
      if (longPressTimeoutRef.current) {
        clearTimeout(longPressTimeoutRef.current);
      }
    };
  }, []);

  const handleOpenMenu = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    onOpenMenu(event, assistant);
  }, [assistant, onOpenMenu]);

  const handleDeleteClick = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();

    if (pendingDelete) {
      // 第二次点击，执行删除
      onDeleteAssistant(assistant.id, event);
      setPendingDelete(false);
      if (deleteTimeoutRef.current) {
        clearTimeout(deleteTimeoutRef.current);
        deleteTimeoutRef.current = null;
      }
    } else {
      // 第一次点击，进入确认状态
      setPendingDelete(true);
      // 3秒后自动重置
      deleteTimeoutRef.current = setTimeout(() => {
        setPendingDelete(false);
        deleteTimeoutRef.current = null;
      }, 3000);
    }
  }, [assistant.id, onDeleteAssistant, pendingDelete]);

  // 桌面端右键菜单
  const handleContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onOpenMenu(event, assistant);
  }, [onOpenMenu, assistant]);

  // 启动长按定时器
  const startPressTimer = useCallback((target: HTMLElement) => {
    isLongPressRef.current = false;
    longPressTimeoutRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      const syntheticEvent = {
        stopPropagation: () => {},
        preventDefault: () => {},
        currentTarget: target,
        target: target,
      } as unknown as React.MouseEvent;
      onOpenMenu(syntheticEvent, assistant);
    }, 400);
  }, [onOpenMenu, assistant]);

  // 触摸开始
  const handleTouchStart = useCallback((event: React.TouchEvent) => {
    const touch = event.touches[0];
    const target = event.currentTarget as HTMLElement;
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
    startPressTimer(target);
  }, [startPressTimer]);

  // 触摸移动（取消长按）
  const handleTouchMove = useCallback((event: React.TouchEvent) => {
    if (!touchStartPosRef.current || !longPressTimeoutRef.current) return;
    
    const touch = event.touches[0];
    const deltaX = Math.abs(touch.clientX - touchStartPosRef.current.x);
    const deltaY = Math.abs(touch.clientY - touchStartPosRef.current.y);
    
    if (deltaX > 10 || deltaY > 10) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  }, []);

  // 触摸结束
  const handleTouchEnd = useCallback(() => {
    // 如果已经触发长按，不清除
    if (isLongPressRef.current) return;
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
    touchStartPosRef.current = null;
  }, []);

  // 点击处理（避免长按后触发点击）
  const handleClick = useCallback(() => {
    if (isLongPressRef.current) {
      isLongPressRef.current = false;
      return;
    }
    startTransition(() => {
      onSelectAssistant(assistant);
    });
  }, [assistant, onSelectAssistant]);

  // 直接从Redux读取最新话题数，实时更新
  const topicCount = useMemo(() => {
    // 优先使用Redux中的最新数据
    const currentAssistant = reduxAssistant || assistant;
    const count = currentAssistant.topics?.length || currentAssistant.topicIds?.length || 0;
    return count;
  }, [reduxAssistant, assistant]);

  // 缓存头像显示内容 - 支持自定义头像、Lucide图标和emoji
  const avatarContent = useMemo(() => {
    // 如果有自定义头像，直接返回null（让Avatar组件使用src属性）
    if (assistant.avatar) {
      return null;
    }

    const iconOrEmoji = assistant.emoji || assistant.name.charAt(0);

    // 如果是Lucide图标名称，渲染Lucide图标
    if (isLucideIcon(iconOrEmoji)) {
      // 修复图标颜色逻辑：
      // - 选中状态：白色图标（因为背景是primary.main蓝色）
      // - 未选中状态：根据主题模式决定颜色
      //   - 深色模式：白色图标（因为背景是grey.300浅灰色）
      //   - 浅色模式：深色图标（因为背景是grey.300浅灰色）
      const iconColor = isSelected
        ? 'white'
        : isDarkMode
          ? '#ffffff'
          : '#424242';

      return (
        <LucideIconRenderer
          iconName={iconOrEmoji}
          size={18}
          color={iconColor}
        />
      );
    }

    // 否则显示emoji或首字母
    return iconOrEmoji;
  }, [assistant.avatar, assistant.emoji, assistant.name, isSelected, isDarkMode]);

  // 缓存样式对象，避免每次渲染都创建新对象
  const avatarSx = useMemo(() => {
    // 修复背景颜色逻辑：
    // - 选中状态：使用primary.main（蓝色）
    // - 未选中状态：根据主题模式使用合适的背景色
    //   - 深色模式：使用较深的灰色
    //   - 浅色模式：使用较浅的灰色
    const bgColor = isSelected
      ? 'primary.main'
      : isDarkMode
        ? 'grey.700'  // 深色模式用深灰色背景
        : 'grey.300'; // 浅色模式用浅灰色背景

    return {
      width: 32,
      height: 32,
      fontSize: '1.2rem',
      bgcolor: bgColor,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: '25%', // 方圆形头像
    };
  }, [isSelected, isDarkMode]);

  const primaryTextSx = useMemo(() => ({
    fontWeight: isSelected ? 600 : 400,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  }), [isSelected]);

  return (
    <ListItemButton
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      selected={isSelected}
      sx={{
        borderRadius: '8px',
        mb: 1,
        '&.Mui-selected': {
          backgroundColor: 'rgba(25, 118, 210, 0.08)',
        },
        '&.Mui-selected:hover': {
          backgroundColor: 'rgba(25, 118, 210, 0.12)',
        }
      }}
    >
      <ListItemAvatar>
        <Avatar
          src={assistant.avatar}
          sx={{
            ...avatarSx,
            // 如果有自定义头像，调整背景色
            bgcolor: assistant.avatar
              ? 'transparent'
              : isSelected
                ? 'primary.main'
                : isDarkMode
                  ? 'grey.700'  // 深色模式用深灰色背景
                  : 'grey.300'  // 浅色模式用浅灰色背景
          }}
        >
          {avatarContent}
        </Avatar>
      </ListItemAvatar>
      <ListItemText
        primary={
          <Typography
            variant="body2"
            sx={primaryTextSx}
          >
            {assistant.name}
          </Typography>
        }
        secondary={
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block' }}
          >
            {topicCount} 个话题
          </Typography>
        }
      />
      <Box sx={{ display: 'flex' }}>
        <IconButton
          size="small"
          onClick={handleOpenMenu}
          aria-label={`助手选项：${assistant.name}`}
          aria-haspopup="true"
          sx={{ opacity: 0.6 }}
        >
          <MoreVertical size={16} />
        </IconButton>
        <IconButton
          size="small"
          onClick={handleDeleteClick}
          sx={{
            opacity: pendingDelete ? 1 : 0.6,
            color: pendingDelete ? 'error.main' : 'inherit',
            '&:hover': { color: 'error.main' },
            transition: 'all 0.2s ease-in-out'
          }}
          title={pendingDelete ? '再次点击确认删除' : '删除助手'}
          aria-label={pendingDelete ? `再次点击确认删除助手：${assistant.name}` : `删除助手：${assistant.name}`}
        >
          {pendingDelete ? <AlertTriangle size={16} /> : <Trash size={16} />}
        </IconButton>
      </Box>
    </ListItemButton>
  );
}

export default AssistantItem;
