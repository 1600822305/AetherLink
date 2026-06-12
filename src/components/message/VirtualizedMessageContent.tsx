/**
 * VirtualizedMessageContent - 带回收的虚拟化消息渲染（实验特性，flag 默认关）
 *
 * 设计见 PR2：把消息拍平成一维行模型（buildMessageRows），用框架无关的
 * VirtualizerCore 算出可视区间 + 上下 spacer，仅渲染可视区内的行并回收其余 DOM；
 * 用 ResizeObserver 实测行高写回 Core，配合 scroll anchor 在「上方行变高」时锁定视口防跳。
 *
 * 复用既有叶子组件（MessageItem / MultiModelMessageGroup / ConversationDivider），
 * 渲染单元与旧的 MessageGroup 严格一致，保证开关前后视觉无差异。
 * 贴底跟随仍由父级的 ChatScrollController 负责（不在此重复实现）。
 */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Box, useTheme } from '@mui/material';
import { useDispatch } from 'react-redux';
import type { Message } from '../../shared/types/newMessage';
import type { MessageGroupingType } from '../../shared/utils/messageGrouping';
import {
  buildMessageRows,
  collectBlockIdsForRows,
  type MessageRow,
} from './utils/messageRows';
import { isMultiModelGroup } from './utils/askIdGrouping';
import { VirtualizerCore, type VirtualRange } from '../../shared/services/chat/virtualizer';
import MessageItem from './MessageItem';
import MultiModelMessageGroup from './MultiModelMessageGroup';
import ConversationDivider from './ConversationDivider';
import ChatDateHeader from './ChatDateHeader';
import { getMessageDividerSetting } from '../../shared/utils/settingsUtils';
import { useAppSelector } from '../../shared/store';
import { makeSelectBlocksByIds } from '../../shared/store/selectors/messageBlockSelectors';
import { upsertManyBlocks } from '../../shared/store/slices/messageBlocksSlice';
import { dexieStorage } from '../../shared/services/storage/DexieStorageService';

// 估高（仅初值，ResizeObserver 会很快校正为实测值）
const ESTIMATE_DATE_HEADER = 56;
const ESTIMATE_UNIT_SINGLE = 300;
const ESTIMATE_UNIT_MULTI = 420;
// 可视区上下各预渲染的像素
const OVERSCAN_PX = 800;

interface VirtualizedMessageContentProps {
  messages: Message[];
  groupingType: MessageGroupingType;
  /** 滚动容器（Solid 外壳的 #messageList），用于读取 scrollTop/clientHeight 及防跳修正 */
  scrollElement: HTMLElement | null;
  onRegenerate?: (messageId: string) => void;
  onDelete?: (messageId: string) => void;
  onSwitchVersion?: (versionId: string) => void;
  onResend?: (messageId: string) => void;
}

function estimateRow(row: MessageRow): number {
  if (row.kind === 'date-header') return ESTIMATE_DATE_HEADER;
  return isMultiModelGroup(row.unit) ? ESTIMATE_UNIT_MULTI : ESTIMATE_UNIT_SINGLE;
}

const VirtualizedMessageContent: React.FC<VirtualizedMessageContentProps> = ({
  messages,
  groupingType,
  scrollElement,
  onRegenerate,
  onDelete,
  onSwitchVersion,
  onResend,
}) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const dispatch = useDispatch();

  // 分割线开关（与 MessageGroup 行为一致：读一次 + 监听设置变更事件）
  const [showMessageDivider, setShowMessageDivider] = useState<boolean>(true);
  useEffect(() => {
    const read = () => {
      try {
        setShowMessageDivider(getMessageDividerSetting());
      } catch {
        // 保持默认
      }
    };
    read();
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'appSettings') read();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('appSettingsChanged', read);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('appSettingsChanged', read);
    };
  }, []);

  // 行模型
  const rows = useMemo(
    () => buildMessageRows(messages, groupingType),
    [messages, groupingType]
  );

  // 虚拟化核心（持久实例）
  const coreRef = useRef<VirtualizerCore | null>(null);
  if (coreRef.current === null) {
    coreRef.current = new VirtualizerCore({
      count: rows.length,
      estimateSize: () => ESTIMATE_UNIT_SINGLE,
      overscanPx: OVERSCAN_PX,
    });
  }

  // 行高缓存（按 row.key，跨行重排仍有效）
  const heightByKeyRef = useRef<Map<string, number>>(new Map());
  // 当前行数组的引用，供 estimateSize 闭包读取最新值（在 effect 里更新以符合 hooks 规则）
  const rowsRef = useRef<MessageRow[]>(rows);

  // 滚动容器的 ref 镜像：用于在回调里读写 scrollTop（避免直接修改 props 触发 lint，且回调引用稳定）
  const scrollElRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    scrollElRef.current = scrollElement;
  }, [scrollElement]);

  const [range, setRange] = useState<VirtualRange>({
    startIndex: 0,
    endIndex: -1,
    padTop: 0,
    padBottom: 0,
  });

  const recomputeRange = useCallback(() => {
    const core = coreRef.current;
    const el = scrollElement;
    if (!core || !el) return;
    const next = core.getRange(el.scrollTop, el.clientHeight);
    setRange((prev) =>
      prev.startIndex === next.startIndex &&
      prev.endIndex === next.endIndex &&
      prev.padTop === next.padTop &&
      prev.padBottom === next.padBottom
        ? prev
        : next
    );
  }, [scrollElement]);

  // 行模型变化时，把 count + 已知实测高度同步进 Core（按 key 重映射，处理重排/合并）
  useEffect(() => {
    const core = coreRef.current;
    if (!core) return;
    rowsRef.current = rows;
    core.setEstimateSize((index) => {
      const r = rowsRef.current[index];
      return r ? estimateRow(r) : ESTIMATE_UNIT_SINGLE;
    });
    core.setCount(rows.length);
    const heights = heightByKeyRef.current;
    for (let i = 0; i < rows.length; i++) {
      const h = heights.get(rows[i].key);
      if (h !== undefined) core.setMeasured(i, h);
    }
    recomputeRange();
  }, [rows, recomputeRange]);

  // 监听滚动容器：scroll（rAF 节流）+ 尺寸变化
  useEffect(() => {
    const el = scrollElement;
    if (!el) return;
    let rafId: number | null = null;
    const onScroll = () => {
      if (rafId != null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        recomputeRange();
      });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    const ro = new ResizeObserver(() => recomputeRange());
    ro.observe(el);
    recomputeRange();
    return () => {
      el.removeEventListener('scroll', onScroll);
      ro.disconnect();
      if (rafId != null) cancelAnimationFrame(rafId);
    };
  }, [scrollElement, recomputeRange]);

  // 单行实测回调：写回 Core；若变更的是「视口上方」的行，用 anchor 修正 scrollTop 防跳
  const handleMeasure = useCallback(
    (key: string, index: number, height: number) => {
      const core = coreRef.current;
      if (!core) return;
      if (heightByKeyRef.current.get(key) === height) return;
      heightByKeyRef.current.set(key, height);

      const el = scrollElRef.current;
      const scrollTop = el ? el.scrollTop : 0;
      // 变更前以当前几何捕获视口顶部锚点
      const anchor = el ? core.captureAnchor(scrollTop) : null;
      const changed = core.setMeasured(index, height);
      if (changed && el && anchor) {
        // 仅当变更行在锚点之上才会改变锚点偏移；否则 resolveScrollTop 返回原值（无操作）
        const corrected = core.resolveScrollTop(anchor);
        if (Math.abs(corrected - scrollTop) > 0.5) {
          el.scrollTop = corrected;
        }
      }
      recomputeRange();
    },
    [recomputeRange]
  );

  // 可视区（含 overscan 的渲染行）涉及的块按需加载
  const visibleRows = useMemo(() => {
    if (range.endIndex < range.startIndex) return [];
    return rows.slice(range.startIndex, range.endIndex + 1);
  }, [rows, range.startIndex, range.endIndex]);

  const visibleBlockIds = useMemo(
    () => collectBlockIdsForRows(visibleRows),
    [visibleRows]
  );
  const selectBlocksByIds = useMemo(() => makeSelectBlocksByIds(), []);
  const loadedBlocks = useAppSelector((state) => selectBlocksByIds(state, visibleBlockIds));
  const loadedBlockIdSet = useMemo(() => {
    const set = new Set<string>();
    loadedBlocks.forEach((b) => set.add(b.id));
    return set;
  }, [loadedBlocks]);
  const requestedBlockIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    const load = async () => {
      const pending = visibleBlockIds.filter(
        (id) => !loadedBlockIdSet.has(id) && !requestedBlockIdsRef.current.has(id)
      );
      if (pending.length === 0) return;
      pending.forEach((id) => requestedBlockIdsRef.current.add(id));
      const blocks = await Promise.all(
        pending.map(async (id) => {
          try {
            const block = await dexieStorage.getMessageBlock(id);
            if (!block) requestedBlockIdsRef.current.delete(id);
            return block;
          } catch {
            requestedBlockIdsRef.current.delete(id);
            return null;
          }
        })
      );
      if (!active) return;
      const valid = blocks.filter((b): b is NonNullable<typeof b> => Boolean(b));
      if (valid.length > 0) dispatch(upsertManyBlocks(valid));
    };
    load();
    return () => {
      active = false;
    };
  }, [visibleBlockIds, loadedBlockIdSet, dispatch]);

  const renderUnit = useCallback(
    (row: Extract<MessageRow, { kind: 'unit' }>) => {
      const { unit } = row;
      if (isMultiModelGroup(unit)) {
        return (
          <MultiModelMessageGroup
            userMessage={unit.userMessage}
            assistantMessages={unit.assistantMessages}
            onRegenerate={onRegenerate}
            onDelete={onDelete}
            onSwitchVersion={onSwitchVersion}
            onResend={onResend}
          />
        );
      }
      return (
        <>
          <MessageItem
            message={unit}
            messageIndex={row.messageIndex}
            onRegenerate={onRegenerate}
            onDelete={onDelete}
            onSwitchVersion={onSwitchVersion}
            onResend={onResend}
          />
          {row.showDivider && (
            <ConversationDivider show={showMessageDivider} style="subtle" />
          )}
        </>
      );
    },
    [onRegenerate, onDelete, onSwitchVersion, onResend, showMessageDivider]
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: range.padTop }} aria-hidden />
      {visibleRows.map((row, i) => {
        const index = range.startIndex + i;
        return (
          <MeasuredRow key={row.key} rowKey={row.key} index={index} onMeasure={handleMeasure}>
            {row.kind === 'date-header' ? (
              <ChatDateHeader date={row.date} isDarkMode={isDarkMode} />
            ) : (
              renderUnit(row)
            )}
          </MeasuredRow>
        );
      })}
      <div style={{ height: range.padBottom }} aria-hidden />
    </Box>
  );
};

interface MeasuredRowProps {
  rowKey: string;
  index: number;
  onMeasure: (key: string, index: number, height: number) => void;
  children: React.ReactNode;
}

/** 用 ResizeObserver 监测单行高度并上报 Core */
const MeasuredRow: React.FC<MeasuredRowProps> = ({ rowKey, index, onMeasure, children }) => {
  const ref = useRef<HTMLDivElement | null>(null);
  // 用 ref 持有最新回调/索引，避免因它们变化而重建 observer（在 effect 里更新以符合 hooks 规则）
  const onMeasureRef = useRef(onMeasure);
  const indexRef = useRef(index);
  useEffect(() => {
    onMeasureRef.current = onMeasure;
    indexRef.current = index;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const report = () => {
      const h = el.getBoundingClientRect().height;
      if (h > 0) onMeasureRef.current(rowKey, indexRef.current, h);
    };
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => ro.disconnect();
  }, [rowKey]);

  return (
    <div ref={ref} data-row-key={rowKey}>
      {children}
    </div>
  );
};

export default React.memo(VirtualizedMessageContent);
