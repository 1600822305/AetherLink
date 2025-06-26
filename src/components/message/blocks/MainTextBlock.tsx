import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { Box } from '@mui/material';
import { throttle } from 'lodash';
import type { RootState } from '../../../shared/store';
import { messageBlocksSelectors } from '../../../shared/store/slices/messageBlocksSlice';
import type { MainTextMessageBlock, ToolMessageBlock } from '../../../shared/types/newMessage';
import { MessageBlockType, MessageBlockStatus } from '../../../shared/types/newMessage';
import Markdown from '../Markdown';
import ToolBlock from './ToolBlock';
import { hasToolUseTags, fixBrokenToolTags } from '../../../shared/utils/mcpToolParser';
import {
  shouldUseHighPerformanceMode,
  getHighPerformanceUpdateInterval
} from '../../../shared/utils/performanceSettings';
import HighPerformanceStreamingContainer from './HighPerformanceStreamingContainer';

interface Props {
  block: MainTextMessageBlock;
  role: string;
  messageId?: string;
}

// 在 MainTextBlock 中传递角色信息
const MainTextBlock: React.FC<Props> = ({ block, role, messageId }) => {
  const content = block.content || '';
  const isUserMessage = role === 'user';
  const isStreaming = block.status === MessageBlockStatus.STREAMING;

  // 获取当前消息的工具块，使用 useMemo 优化性能
  const toolBlocks = useSelector((state: RootState) => {
    if (!messageId) return [];
    const entities = messageBlocksSelectors.selectEntities(state);
    return Object.values(entities).filter(
      (block): block is ToolMessageBlock =>
        block?.type === MessageBlockType.TOOL &&
        block.messageId === messageId
    );
  }, (left, right) => {
    // 自定义比较函数，只有当工具块实际发生变化时才重新渲染
    if (left.length !== right.length) return false;
    return left.every((leftBlock, index) => {
      const rightBlock = right[index];
      return leftBlock?.id === rightBlock?.id &&
             leftBlock?.status === rightBlock?.status &&
             leftBlock?.content === rightBlock?.content;
    });
  });

  // 获取用户输入渲染设置
  const renderUserInputAsMarkdown = useSelector((state: RootState) => state.settings.renderUserInputAsMarkdown);

  // 🚀 流式输出节流机制
  const [throttledContent, setThrottledContent] = useState(content);
  const contentRef = useRef(content);
  const useHighPerformance = shouldUseHighPerformanceMode(isStreaming);

  // 🎯 节流机制独立于高性能渲染模式
  const shouldUseThrottling = isStreaming; // 只要是流式输出就可以使用节流

  // 创建节流更新函数
  const throttledUpdate = useMemo(() => {
    if (!shouldUseThrottling) {
      return null;
    }

    const interval = getHighPerformanceUpdateInterval();

    return throttle(() => {
      setThrottledContent(contentRef.current);
    }, interval);
  }, [shouldUseThrottling]);

  // 更新内容
  useEffect(() => {
    contentRef.current = content;

    if (throttledUpdate && shouldUseThrottling) {
      throttledUpdate();
    } else {
      // 非流式状态时，立即更新
      setThrottledContent(content);
    }
  }, [content, throttledUpdate, shouldUseThrottling]);

  // 清理节流函数
  useEffect(() => {
    return () => throttledUpdate?.cancel();
  }, [throttledUpdate]);

  // 决定使用哪个内容进行渲染
  const displayContent = shouldUseThrottling ? throttledContent : content;

  // 🚀 高性能流式渲染容器（仅在流式且启用高性能时使用）
  const highPerformanceRenderer = useMemo(() => {
    if (useHighPerformance && isStreaming && !isUserMessage) {
      return (
        <HighPerformanceStreamingContainer
          content={displayContent}
          isStreaming={isStreaming}
          onComplete={() => {
            // 流式完成后，确保显示完整内容
            setThrottledContent(content);
          }}
        />
      );
    }
    return null;
  }, [useHighPerformance, isStreaming, isUserMessage, displayContent, content]);

  // 处理内容和工具块的原位置渲染
  const renderedContent = useMemo(() => {
    // 🚀 如果启用了高性能渲染且正在流式输出，使用高性能容器
    if (highPerformanceRenderer) {
      return highPerformanceRenderer;
    }

    // 创建一个临时的 block 对象，使用节流后的内容
    const displayBlock = { ...block, content: displayContent };

    // 如果是用户消息且设置为不渲染markdown，则显示纯文本
    if (isUserMessage && !renderUserInputAsMarkdown) {
      return (
        <Box sx={{
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          lineHeight: 1.6,
          fontFamily: 'inherit'
        }}>
          {displayContent}
        </Box>
      );
    }

    //  使用工具解析器的检测函数，支持自动修复被分割的标签
    const hasTools = hasToolUseTags(displayContent);

    if (isUserMessage || !hasTools) {
      // 传递消息角色，使用节流后的内容
      return <Markdown block={displayBlock} messageRole={role as 'user' | 'assistant' | 'system'} />;
    }

    // 使用已经获取的工具块

    //  使用修复后的内容进行工具标签处理（使用节流后的内容）
    const fixedContent = fixBrokenToolTags(displayContent);

    // 检测工具标签和工具块的匹配情况
    const toolUseMatches = fixedContent.match(/<tool_use[\s\S]*?<\/tool_use>/gi) || [];

    if (toolBlocks.length === 0) {
      // 没有工具块，移除工具标签
      if (toolUseMatches.length > 0) {
        console.warn(`[MainTextBlock] 工具块缺失：检测到 ${toolUseMatches.length} 个工具标签但没有工具块`);
      }
      const cleanContent = fixedContent.replace(/<tool_use[\s\S]*?<\/tool_use>/gi, '');
      return <Markdown content={cleanContent} allowHtml={false} />;
    }

    // 分割内容并插入工具块
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let toolIndex = 0;

    // 使用更宽松的正则表达式匹配工具标签
    const toolUseRegex = /<tool_use[\s\S]*?<\/tool_use>/gi;
    let match;

    while ((match = toolUseRegex.exec(fixedContent)) !== null) {
      // 添加工具标签前的文本
      if (match.index > lastIndex) {
        const textBefore = fixedContent.slice(lastIndex, match.index);
        if (textBefore.trim()) {
          parts.push(
            <Markdown key={`text-${parts.length}`} content={textBefore} allowHtml={false} />
          );
        }
      }

      // 添加工具块（如果存在）
      if (toolIndex < toolBlocks.length) {
        const toolBlock = toolBlocks[toolIndex];
        // 只在开发环境输出调试信息
        if (process.env.NODE_ENV === 'development' && toolIndex === 0) {
          console.log(`[MainTextBlock] 渲染 ${toolBlocks.length} 个工具块，消息ID: ${messageId}`);
        }
        parts.push(
          <div key={`tool-${toolBlock.id}`} style={{ margin: '16px 0' }}>
            <ToolBlock block={toolBlock} />
          </div>
        );
        toolIndex++;
      } else {
        // 如果工具块不够，显示占位符
        console.warn(`[MainTextBlock] 工具块不足，跳过第 ${toolIndex} 个工具标签`);
        parts.push(
          <div key={`placeholder-${toolIndex}`} style={{ margin: '16px 0', padding: '8px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
            <span style={{ color: '#666' }}>工具调用处理中...</span>
          </div>
        );
        toolIndex++;
      }

      lastIndex = match.index + match[0].length;
    }

    // 添加剩余的文本
    if (lastIndex < fixedContent.length) {
      const textAfter = fixedContent.slice(lastIndex);
      if (textAfter.trim()) {
        parts.push(
          <Markdown key={`text-${parts.length}`} content={textAfter} allowHtml={false} />
        );
      }
    }

    return <>{parts}</>;
  }, [displayContent, isUserMessage, toolBlocks, messageId, renderUserInputAsMarkdown, block, role, highPerformanceRenderer]);

  if (!displayContent.trim()) {
    return null;
  }

  return (
    <div className="main-text-block">
      {renderedContent}
    </div>
  );
};

export default MainTextBlock;
