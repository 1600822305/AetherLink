import React, { useState, useEffect, useCallback, useReducer } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../../shared/store';
import type { ThinkingMessageBlock } from '../../../shared/types/newMessage';
import { MessageBlockStatus } from '../../../shared/types/newMessage';
import { EventEmitter, EVENT_NAMES } from '../../../shared/services/EventEmitter';
import { useDeepMemo } from '../../../hooks/useMemoization';
import ThinkingDisplayRenderer from './ThinkingDisplayRenderer';

// 思考过程显示样式类型
export type ThinkingDisplayStyle = 'compact' | 'full' | 'hidden' | 'minimal' | 'bubble' | 'timeline' | 'card' | 'inline' |
  'stream' | 'dots' | 'wave' | 'sidebar' | 'overlay' | 'breadcrumb' | 'floating' | 'terminal';

// 思考过程显示样式常量
export const ThinkingDisplayStyle = {
  COMPACT: 'compact' as ThinkingDisplayStyle,
  FULL: 'full' as ThinkingDisplayStyle,
  HIDDEN: 'hidden' as ThinkingDisplayStyle,
  MINIMAL: 'minimal' as ThinkingDisplayStyle,
  BUBBLE: 'bubble' as ThinkingDisplayStyle,
  TIMELINE: 'timeline' as ThinkingDisplayStyle,
  CARD: 'card' as ThinkingDisplayStyle,
  INLINE: 'inline' as ThinkingDisplayStyle,
  // 2025年新增的先进样式
  STREAM: 'stream' as ThinkingDisplayStyle,
  DOTS: 'dots' as ThinkingDisplayStyle,
  WAVE: 'wave' as ThinkingDisplayStyle,
  SIDEBAR: 'sidebar' as ThinkingDisplayStyle,
  OVERLAY: 'overlay' as ThinkingDisplayStyle,
  BREADCRUMB: 'breadcrumb' as ThinkingDisplayStyle,
  FLOATING: 'floating' as ThinkingDisplayStyle,
  TERMINAL: 'terminal' as ThinkingDisplayStyle
};

interface Props {
  block: ThinkingMessageBlock;
}

/**
 * 思考块组件
 * 显示AI的思考过程，支持多种显示样式
 */
const ThinkingBlock: React.FC<Props> = ({ block }) => {
  // 从设置中获取思考过程显示样式
  const thinkingDisplayStyle = useSelector((state: RootState) =>
    (state.settings as any).thinkingDisplayStyle || 'compact'
  );

  // 从设置中获取是否自动折叠思考过程
  const thoughtAutoCollapse = useSelector((state: RootState) =>
    (state.settings as any).thoughtAutoCollapse !== false
  );

  // 状态管理
  const [expanded, setExpanded] = useState(!thoughtAutoCollapse);
  const isThinking = block.status === MessageBlockStatus.STREAMING;
  const [thinkingTime, setThinkingTime] = useState(() => block.thinking_millsec || 0);
  const [copied, setCopied] = useState(false);

  // 高级样式状态
  const [streamText, setStreamText] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [overlayOpen, setOverlayOpen] = useState(false);

  // 强制更新机制
  const [updateCounter, forceUpdate] = useReducer(state => state + 1, 0);
  const [content, setContent] = useState(block.content || '');

  // 使用记忆化的block内容，避免不必要的重渲染
  const memoizedContent = useDeepMemo(() => content, [content, updateCounter]);

  // 复制思考内容到剪贴板
  const handleCopy = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); // 防止触发折叠/展开
    if (block.content) {
      navigator.clipboard.writeText(block.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      EventEmitter.emit(EVENT_NAMES.UI_COPY_SUCCESS || 'ui:copy_success', { content: '已复制思考内容' });
    }
  }, [block.content]);

  // 切换折叠/展开状态
  const toggleExpanded = useCallback(() => {
    setExpanded(!expanded);
  }, [expanded]);

  // 监听内容变化
  useEffect(() => {
    setContent(block.content || '');
  }, [block.content]);

  // 流式输出事件监听
  useEffect(() => {
    if (isThinking) {
      const thinkingDeltaHandler = () => {
        const newContent = block.content || '';
        setContent(newContent);
        forceUpdate();
      };

      const unsubscribeThinkingDelta = EventEmitter.on(EVENT_NAMES.STREAM_THINKING_DELTA, thinkingDeltaHandler);
      const unsubscribeThinkingComplete = EventEmitter.on(EVENT_NAMES.STREAM_THINKING_COMPLETE, thinkingDeltaHandler);

      return () => {
        unsubscribeThinkingDelta();
        unsubscribeThinkingComplete();
      };
    }
  }, [isThinking, block.content]);

  // 确保内容与block同步
  useEffect(() => {
    const newContent = block.content || '';
    if (newContent !== content) {
      setContent(newContent);
    }
  }, [block.content, content]);

  // 思考时间计时器
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;

    if (isThinking) {
      timer = setInterval(() => {
        setThinkingTime(prev => prev + 100);
      }, 100);
    }

    return () => {
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [isThinking]);

  // 思考完成时设置最终时间
  useEffect(() => {
    if (!isThinking && block.thinking_millsec && block.thinking_millsec !== thinkingTime) {
      setThinkingTime(block.thinking_millsec);
    }
  }, [isThinking, block.thinking_millsec]);

  // 自动折叠逻辑
  useEffect(() => {
    if (!isThinking && thoughtAutoCollapse) {
      setExpanded(false);
    }
  }, [isThinking, thoughtAutoCollapse]);

  // 使用显示渲染组件
  return (
    <ThinkingDisplayRenderer
      displayStyle={thinkingDisplayStyle}
      expanded={expanded}
      isThinking={isThinking}
      thinkingTime={thinkingTime}
      content={memoizedContent}
      copied={copied}
      streamText={streamText}
      sidebarOpen={sidebarOpen}
      overlayOpen={overlayOpen}
      updateCounter={updateCounter}
      onToggleExpanded={toggleExpanded}
      onCopy={handleCopy}
      onSetSidebarOpen={setSidebarOpen}
      onSetOverlayOpen={setOverlayOpen}
      onSetStreamText={setStreamText}
    />
  );
};

export default React.memo(ThinkingBlock);
