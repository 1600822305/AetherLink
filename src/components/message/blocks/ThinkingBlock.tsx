import React, { useState, useEffect, useCallback, useReducer, useMemo } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../../shared/store';
import type { ThinkingMessageBlock } from '../../../shared/types/newMessage';
import { MessageBlockStatus, isTerminalBlockStatus } from '../../../shared/types/newMessage';
import { EventEmitter, EVENT_NAMES } from '../../../shared/services/infra/EventEmitter';
import { useDeepMemo } from '../../../hooks/useMemoization';
import ThinkingDisplayRenderer from './ThinkingDisplayRenderer';
import { useTranslation } from '../../../i18n';

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
  const { t } = useTranslation();
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
  const isTerminal = isTerminalBlockStatus(block.status);
  const [copied, setCopied] = useState(false);

  // 计时驱动：用时间戳推进，避免计数器累加漂移
  const startMs = block.thinkingStartTime ?? Date.parse(block.createdAt);
  const [nowTick, setNowTick] = useState(() => Date.now());

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
      EventEmitter.emit(EVENT_NAMES.UI_COPY_SUCCESS || 'ui:copy_success', { content: t('settings.appearance.thinkingProcess.preview.texts.copySuccess') });
    }
  }, [block.content, t]);

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

  // 思考时间计时器：仅在思考中按时间戳实时刷新；终态后冻结（与 status 解耦，
  // 即使某条收尾路径漏改状态也只是不再刷新，不会出现计数器停不下来）
  useEffect(() => {
    if (!isThinking) return;
    const timer = setInterval(() => setNowTick(Date.now()), 100);
    return () => clearInterval(timer);
  }, [isThinking]);

  // 显示用思考耗时：终态优先用收尾定格的 thinking_millsec，缺失则按时间戳兜底；
  // 思考中则用「当前时刻 − 起始时刻」实时派生。
  const thinkingTime = useMemo(() => {
    if (isTerminal) {
      if (typeof block.thinking_millsec === 'number' && block.thinking_millsec > 0) {
        return block.thinking_millsec;
      }
      const endMs = block.updatedAt ? Date.parse(block.updatedAt) : Date.now();
      if (!Number.isNaN(startMs) && !Number.isNaN(endMs)) {
        return Math.max(0, endMs - startMs);
      }
      return block.thinking_millsec || 0;
    }
    if (!Number.isNaN(startMs)) {
      return Math.max(0, nowTick - startMs);
    }
    return block.thinking_millsec || 0;
  }, [isTerminal, block.thinking_millsec, block.updatedAt, startMs, nowTick]);

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
