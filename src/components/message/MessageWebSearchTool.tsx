/**
 * 网络搜索工具消息块组件 - React 包装器
 * 
 * 使用 SolidBridge 桥接 SolidJS 组件，解决 React 版本的掉帧问题
 * 参考 Cherry Studio 的 CitationsList.tsx
 */

import React, { useMemo, memo } from 'react';
import { useTheme } from '@mui/material';
import { SolidBridge } from '../../shared/bridges/SolidBridge';
import { WebSearchTool as SolidWebSearchTool } from '../../solid/components/WebSearchTool/WebSearchTool.solid';
import type { ToolMessageBlock } from '../../shared/types/newMessage';
import { createLogger } from '../../shared/services/infra/logger';

const logger = createLogger('MessageWebSearchTool');

interface MessageWebSearchToolProps {
  block: ToolMessageBlock;
}

interface SearchResult {
  title: string;
  url: string;
  snippet?: string;
  content?: string;
}

/**
 * 从 block 中提取搜索结果
 */
function extractSearchResults(block: ToolMessageBlock): SearchResult[] {
  const toolResponse = block.metadata?.rawMcpToolResponse as any;
  
  // 1. toolResponse.response.webSearchResult
  if (toolResponse?.response?.webSearchResult?.results) {
    return toolResponse.response.webSearchResult.results;
  }
  
  // 2. toolResponse.response.results
  if (toolResponse?.response?.results && Array.isArray(toolResponse.response.results)) {
    return toolResponse.response.results;
  }
  
  // 3. block.content.results
  const content = block.content as any;
  if (content?.results && Array.isArray(content.results)) {
    return content.results;
  }
  
  // 4. block.content.webSearchResult.results
  if (content?.webSearchResult?.results) {
    return content.webSearchResult.results;
  }
  
  return [];
}

/**
 * 网络搜索工具消息块 - 使用 SolidJS 高性能组件
 */
export const MessageWebSearchTool: React.FC<MessageWebSearchToolProps> = memo(({ block }) => {
  const theme = useTheme();
  const themeMode = theme.palette.mode;
  
  // 使用 useMemo 缓存搜索结果提取
  const results = useMemo(() => extractSearchResults(block), [block]);
  
  // 映射 block.status 到 SolidJS 组件接受的状态类型
  const status = useMemo(() => {
    switch (block.status) {
      case 'processing':
      case 'streaming':
        return block.status;
      case 'success':
        return 'success';
      case 'error':
        return 'error';
      default:
        return 'pending';
    }
  }, [block.status]);

  return (
    <SolidBridge
      component={SolidWebSearchTool as any}
      props={{
        status: status as 'pending' | 'processing' | 'streaming' | 'success' | 'error',
        results: results,
        themeMode: themeMode as 'light' | 'dark',
      }}
      debugName="WebSearchTool"
      debug={process.env.NODE_ENV === 'development'}
      onError={(error) => {
        logger.error('SolidJS 组件错误:', error);
      }}
    />
  );
});

// 设置 displayName 便于调试
MessageWebSearchTool.displayName = 'MessageWebSearchTool';

export default MessageWebSearchTool;
