/**
 * SolidMessageList - 使用 SolidJS 包装的消息列表组件
 * 外壳用 SolidJS 实现（滚动优化），内容由 React 渲染
 * 使用 SolidBridge 桥接 React 和 SolidJS
 */
import React, { useState, useMemo, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Box, useTheme } from '@mui/material';
import { SolidBridge } from '../../shared/bridges/SolidBridge';
import { MessageListContainer } from '../../solid/components/MessageList';
import type { Message } from '../../shared/types/newMessage';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../../shared/store';
import { upsertManyBlocks } from '../../shared/store/slices/messageBlocksSlice';
import { selectBlocksByIds } from '../../shared/store/selectors/messageBlockSelectors';

import MessageGroup from './MessageGroup';
import VirtualizedMessageContent from './VirtualizedMessageContent';
import SystemPromptBubble from '../prompts/SystemPromptBubble';
import SystemPromptDialog from '../dialogs/SystemPromptDialog';
import type { ChatTopic, Assistant } from '../../shared/types/Assistant';
import { dexieStorage } from '../../shared/services/storage/DexieStorageService';
import { topicCacheManager } from '../../shared/services/topics/TopicCacheManager';
import { getGroupedMessages, MessageGroupingType } from '../../shared/utils/messageGrouping';
import { useKeyboard } from '../../shared/hooks/useKeyboard';
import { ChatScrollController } from '../../shared/services/chat/ChatScrollController';

interface SolidMessageListProps {
  messages: Message[];
  onRegenerate?: (messageId: string) => void;
  onDelete?: (messageId: string) => void;
  onSwitchVersion?: (versionId: string) => void;
  onResend?: (messageId: string) => void;
}

const INITIAL_DISPLAY_COUNT = 15;
const LOAD_MORE_COUNT = 10;

const computeDisplayMessages = (messages: Message[], startIndex: number, displayCount: number) => {
  if (messages.length === 0) return [];
  const actualStartIndex = Math.max(0, startIndex);
  const actualEndIndex = Math.min(messages.length, startIndex + displayCount);
  return messages.slice(actualStartIndex, actualEndIndex);
};

const SolidMessageList: React.FC<SolidMessageListProps> = React.memo(({
  messages,
  onRegenerate,
  onDelete,
  onSwitchVersion,
  onResend
}) => {
  const theme = useTheme();
  const dispatch = useDispatch();

  // 错误处理状态
  const [error, setError] = useState<string | null>(null);
  const [isRecovering, setIsRecovering] = useState(false);
  const loadedBlockIdsRef = useRef<Set<string>>(new Set());

  // 键盘状态监听 - 用于在键盘弹出时自动滚动到底部
  const { keyboardHeight } = useKeyboard();

  // Portal 容器
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);

  // 显示状态
  const [displayCount, setDisplayCount] = useState(INITIAL_DISPLAY_COUNT);

  // 话题和助手信息
  const [currentTopic, setCurrentTopic] = useState<ChatTopic | null>(null);
  const [currentAssistant, setCurrentAssistant] = useState<Assistant | null>(null);
  const [promptDialogOpen, setPromptDialogOpen] = useState(false);

  // Redux 状态
  const currentTopicId = useSelector((state: RootState) => state.messages.currentTopicId);

  // 汇总当前消息涉及的块ID列表，用于按需查询
  const allBlockIds = useMemo(() => {
    const ids: string[] = [];
    messages.forEach(m => {
      if (m.blocks && m.blocks.length > 0) {
        ids.push(...m.blocks);
      }
    });
    return ids;
  }, [messages]);

  // 仅选择当前消息涉及的块实体
  const relatedBlocks = useSelector((state: RootState) => selectBlocksByIds(state, allBlockIds));
  const relatedBlockSet = useMemo(() => {
    const set = new Set<string>();
    relatedBlocks.forEach(b => set.add(b.id));
    return set;
  }, [relatedBlocks]);
  const showSystemPromptBubble = useSelector((state: RootState) =>
    state.settings.showSystemPromptBubble !== false
  );
  const autoScrollToBottom = useSelector((state: RootState) =>
    state.settings.autoScrollToBottom !== false
  );
  const messageGroupingType = useSelector((state: RootState) =>
    state.settings.messageGrouping || 'byDate'
  );
  const chatBackground = useSelector((state: RootState) =>
    state.settings.chatBackground || { enabled: false }
  );
  // 实验特性：带回收的虚拟化消息列表（默认开启）。关闭后回退到旧的切片+加载更多路径（kill-switch）。
  const virtualized = useSelector((state: RootState) =>
    state.settings.experimentalVirtualizedList === true
  );

  // 计算显示的消息
  const displayMessages = useMemo(() => {
    const startIndex = Math.max(0, messages.length - displayCount);
    return computeDisplayMessages(messages, startIndex, displayCount);
  }, [messages, displayCount]);

  const hasMore = useMemo(() => displayCount < messages.length, [displayCount, messages.length]);

  // 消息分组
  const groupedMessages = useMemo(() => {
    return Object.entries(getGroupedMessages(displayMessages, messageGroupingType as MessageGroupingType));
  }, [displayMessages, messageGroupingType]);

  const groupStartIndices = useMemo(() => {
    const indices = new Map<string, number>();
    let cumulative = 0;
    for (const [date, msgs] of groupedMessages) {
      indices.set(date, cumulative);
      cumulative += msgs.length;
    }
    return indices;
  }, [groupedMessages]);

  // 错误处理函数
  const handleError = useCallback((error: any, context: string, options: { showToUser?: boolean; canRecover?: boolean } = {}) => {
    const { showToUser = false, canRecover = false } = options;
    console.error(`[SolidMessageList] ${context} 错误:`, error);

    if (showToUser) {
      const errorMessage = error?.message || '发生未知错误';
      setError(`${context}: ${errorMessage}`);

      if (canRecover) {
        setIsRecovering(true);
        setTimeout(() => {
          setError(null);
          setIsRecovering(false);
        }, 3000);
      }
    }
  }, []);

  const recoverFromError = useCallback(() => {
    setError(null);
    setIsRecovering(false);
  }, []);

  // 加载话题和助手
  useEffect(() => {
    const loadTopicAndAssistant = async () => {
      if (!currentTopicId) return;
      try {
        const topic = await topicCacheManager.getTopic(currentTopicId);
        if (topic) {
          setCurrentTopic(topic);
          if (topic.assistantId) {
            const assistant = await dexieStorage.getAssistant(topic.assistantId);
            if (assistant) {
              setCurrentAssistant(assistant);
            }
          }
        }
      } catch (error) {
        handleError(error, '加载话题和助手信息', { showToUser: true, canRecover: true });
      }
    };
    loadTopicAndAssistant();
  }, [currentTopicId, handleError]);

  // 简化的块加载逻辑（虚拟化开启时改由 VirtualizedMessageContent 按可视区懒加载，此处跳过全量加载）
  useEffect(() => {
    if (virtualized) return;
    let isActive = true;

    const loadMissingBlocks = async () => {
      const pendingBlockIds: string[] = [];

      for (const message of messages) {
        if (!message.blocks || message.blocks.length === 0) continue;

        for (const blockId of message.blocks) {
          if (relatedBlockSet.has(blockId)) continue;
          if (loadedBlockIdsRef.current.has(blockId)) continue;

          pendingBlockIds.push(blockId);
          loadedBlockIdsRef.current.add(blockId);
        }
      }

      if (pendingBlockIds.length === 0) {
        return;
      }

      const blocks = await Promise.all(
        pendingBlockIds.map(async blockId => {
          try {
            const block = await dexieStorage.getMessageBlock(blockId);
            if (!block) {
              loadedBlockIdsRef.current.delete(blockId);
            }
            return block;
          } catch (error) {
            loadedBlockIdsRef.current.delete(blockId);
            handleError(error, `加载块 ${blockId} 失败`, { showToUser: false });
            return null;
          }
        })
      );

      if (!isActive) {
        return;
      }

      const validBlocks = blocks.filter((b): b is NonNullable<typeof b> => Boolean(b));
      if (validBlocks.length > 0) {
        dispatch(upsertManyBlocks(validBlocks));
      }
    };

    loadMissingBlocks();

    return () => {
      isActive = false;
    };
  }, [messages, relatedBlockSet, dispatch, handleError, virtualized]);

  // 监听 Portal 容器
  useEffect(() => {
    const checkContainer = () => {
      const container = document.getElementById('messageList');
      if (container !== portalContainer) {
        setPortalContainer(container);
      }
    };

    checkContainer();

    const observer = new MutationObserver(checkContainer);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, [portalContainer]);

  // ⭐ 监听助手更新事件
  const currentAssistantRef = useRef(currentAssistant);
  currentAssistantRef.current = currentAssistant;

  useEffect(() => {
    const handleAssistantUpdated = (event: CustomEvent) => {
      const updatedAssistant = event.detail.assistant;
      if (currentAssistantRef.current && updatedAssistant.id === currentAssistantRef.current.id) {
        setCurrentAssistant(updatedAssistant);
      }
    };

    window.addEventListener('assistantUpdated', handleAssistantUpdated as EventListener);
    return () => {
      window.removeEventListener('assistantUpdated', handleAssistantUpdated as EventListener);
    };
  }, []);

  // 记录加载前的滚动高度，用于保持位置
  const prevScrollHeightRef = useRef<number | null>(null);
  const prevDisplayCountRef = useRef(displayCount);
  // 防止滚到顶时同一手势内重复触发加载（同步守卫，加载并补偿滚动位置后在 layout effect 复位）
  const isLoadingMoreRef = useRef(false);

  // 加载更多消息：滚到顶时由 Solid 外壳的 onScrollToTop 自动触发，同步切片（无人为延迟）
  const loadMoreMessages = useCallback(() => {
    if (!hasMore || isLoadingMoreRef.current) return;

    // 记录当前滚动高度，供加载后补偿位置
    const container = document.getElementById('messageList');
    prevScrollHeightRef.current = container?.scrollHeight || null;

    isLoadingMoreRef.current = true;
    setDisplayCount(prev => prev + LOAD_MORE_COUNT);
  }, [hasMore]);

  // ⭐ 加载更多后保持滚动位置（prepend 历史不跳屏），并复位重入守卫
  useLayoutEffect(() => {
    if (prevScrollHeightRef.current !== null && displayCount > prevDisplayCountRef.current) {
      const container = document.getElementById('messageList');
      if (container) {
        const heightDiff = container.scrollHeight - prevScrollHeightRef.current;
        container.scrollTop += heightDiff;
      }
      prevScrollHeightRef.current = null;
    }
    prevDisplayCountRef.current = displayCount;
    isLoadingMoreRef.current = false;
  }, [displayCount, displayMessages]);

  // 处理提示词气泡点击
  const handlePromptBubbleClick = useCallback(() => {
    setPromptDialogOpen(true);
  }, []);

  const handlePromptDialogClose = useCallback(() => {
    setPromptDialogOpen(false);
  }, []);

  const handlePromptSave = useCallback((updatedTopic: any) => {
    setCurrentTopic(updatedTopic);
  }, []);

  // 内容元素引用（供 ResizeObserver 观察增高）
  const contentElRef = useRef<HTMLDivElement | null>(null);

  // 自动下滑控制器（贴底状态机）
  const controllerRef = useRef<ChatScrollController | null>(null);

  // 用 ref 保存开关，避免开关变化时重建控制器
  const autoScrollEnabledRef = useRef(autoScrollToBottom);
  useEffect(() => {
    autoScrollEnabledRef.current = autoScrollToBottom;
  }, [autoScrollToBottom]);

  // 在滚动容器与内容元素就绪后创建控制器
  useEffect(() => {
    const container = portalContainer;
    const content = contentElRef.current;
    if (!container || !content) return;

    const controller = new ChatScrollController(container, content, {
      isEnabled: () => autoScrollEnabledRef.current,
    });
    controllerRef.current = controller;
    // 暴露给 ChatNavigation 的「滑到底」按钮复用
    (window as any).__chatScrollController = controller;

    // 初始进入置底
    controller.pinToBottom('auto');

    return () => {
      controller.destroy();
      if (controllerRef.current === controller) {
        controllerRef.current = null;
      }
      if ((window as any).__chatScrollController === controller) {
        delete (window as any).__chatScrollController;
      }
    };
  }, [portalContainer]);

  // 流式内容增长 / 思考 / 工具 / 图片异步加载等所有撑高，统一由
  // ChatScrollController 内部的 ResizeObserver 被动跟随，无需在此监听业务事件。

  // ⭐ 用户自己发送新消息时强制置底；AI 新消息仅在已贴底时跟随
  // 取「本次新增的消息」判断而非仅看末条，避免用户/助手消息在同一渲染批次追加时漏判
  const prevMessagesLengthRef = useRef(messages.length);
  useEffect(() => {
    const prevLength = prevMessagesLengthRef.current;
    if (messages.length > prevLength) {
      const added = messages.slice(prevLength);
      if (added.some(m => m.role === 'user')) {
        controllerRef.current?.pinToBottom('auto');
      }
    }
    prevMessagesLengthRef.current = messages.length;
  }, [messages]);

  // ⭐ 键盘弹出时置底
  const prevKeyboardHeightRef = useRef(keyboardHeight);
  useEffect(() => {
    if (keyboardHeight > 0 && prevKeyboardHeightRef.current === 0) {
      setTimeout(() => {
        controllerRef.current?.pinToBottom('auto');
      }, 100);
    }
    prevKeyboardHeightRef.current = keyboardHeight;
  }, [keyboardHeight]);

  // ⭐ 初始加载与话题切换时置底
  const prevTopicIdRef = useRef(currentTopicId);
  const isInitialLoadRef = useRef(true);

  useEffect(() => {
    const isTopicChange = prevTopicIdRef.current !== currentTopicId;

    if (isTopicChange || isInitialLoadRef.current) {
      if (isTopicChange) {
        setDisplayCount(INITIAL_DISPLAY_COUNT);
        prevTopicIdRef.current = currentTopicId;
      }

      if (displayMessages.length > 0 && currentTopicId) {
        setTimeout(() => {
          controllerRef.current?.pinToBottom('auto');
          isInitialLoadRef.current = false;
        }, 150);
      }
    }
  }, [currentTopicId, displayMessages.length]);

  // SolidJS 组件的 props
  const solidProps = useMemo(() => ({
    themeMode: theme.palette.mode,
    onScrollToTop: loadMoreMessages,
    chatBackground
  }), [theme.palette.mode, loadMoreMessages, chatBackground]);

  // React 内容
  const messageContent = useMemo(() => (
    <Box ref={contentElRef} sx={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 错误提示 */}
      {error && (
        <Box
          sx={{
            position: 'sticky',
            top: 0,
            zIndex: 1000,
            bgcolor: theme.palette.error.main,
            color: theme.palette.error.contrastText,
            p: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderRadius: 1,
            mb: 1,
            mx: 2
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ fontSize: '16px' }}>⚠️</Box>
            <Box>{error}</Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {isRecovering && (
              <Box sx={{ fontSize: '12px', opacity: 0.8 }}>
                自动恢复中...
              </Box>
            )}
            <Box
              sx={{
                cursor: 'pointer',
                fontSize: '18px',
                '&:hover': { opacity: 0.7 }
              }}
              onClick={recoverFromError}
            >
              ✕
            </Box>
          </Box>
        </Box>
      )}

      {/* 系统提示词气泡 */}
      {showSystemPromptBubble && (
        <SystemPromptBubble
          topic={currentTopic}
          assistant={currentAssistant}
          onClick={handlePromptBubbleClick}
          key={`prompt-bubble-${currentTopic?.id || 'no-topic'}-${currentAssistant?.id || 'no-assistant'}`}
        />
      )}

      {/* 系统提示词对话框 */}
      <SystemPromptDialog
        open={promptDialogOpen}
        onClose={handlePromptDialogClose}
        topic={currentTopic}
        assistant={currentAssistant}
        onSave={handlePromptSave}
      />

      {/* 消息列表 */}
      {(virtualized ? messages.length === 0 : displayMessages.length === 0) ? (
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: theme.palette.text.secondary,
            fontStyle: 'normal',
            fontSize: '14px',
            minHeight: '200px'
          }}
        >
          新的对话开始了，请输入您的问题
        </Box>
      ) : virtualized ? (
        /* 实验路径：带回收的虚拟化渲染（仅渲染可视区 ± overscan） */
        <VirtualizedMessageContent
          messages={messages}
          groupingType={messageGroupingType as MessageGroupingType}
          scrollElement={portalContainer}
          onRegenerate={onRegenerate}
          onDelete={onDelete}
          onSwitchVersion={onSwitchVersion}
          onResend={onResend}
        />
      ) : (
        /* 旧路径（kill-switch）：按日期分组渲染；滚到顶由外壳 onScrollToTop 自动加载更多 */
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          {groupedMessages.map(([date, msgs]) => {
            const previousMessagesCount = groupStartIndices.get(date) || 0;
            return (
              <MessageGroup
                key={date}
                date={date}
                messages={msgs}
                expanded={true}
                startIndex={previousMessagesCount}
                onRegenerate={onRegenerate}
                onDelete={onDelete}
                onSwitchVersion={onSwitchVersion}
                onResend={onResend}
              />
            );
          })}
        </Box>
      )}

      {/* 底部占位 */}
      <div style={{ height: '35px', minHeight: '35px', width: '100%' }} />
    </Box>
  ), [
    error, isRecovering, recoverFromError,
    showSystemPromptBubble, currentTopic, currentAssistant, handlePromptBubbleClick,
    promptDialogOpen, handlePromptDialogClose, handlePromptSave,
    displayMessages.length, theme, groupedMessages, groupStartIndices,
    onRegenerate, onDelete, onSwitchVersion, onResend,
    virtualized, messages, messageGroupingType, portalContainer
  ]);

  return (
    <>
      <SolidBridge
        component={MessageListContainer as any}
        props={solidProps}
        debugName="MessageListContainer"
        debug={false}
        style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, overflow: 'hidden' }}
      />
      {/* 通过 Portal 将 React 内容渲染到 Solid 组件内部 */}
      {portalContainer && createPortal(messageContent, portalContainer)}
    </>
  );
});

SolidMessageList.displayName = 'SolidMessageList';

export default SolidMessageList;
