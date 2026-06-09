import React from 'react';
import { Box } from '@mui/material';
import type { MatchRange } from '../../shared/services/search/types';

interface HighlightedTextProps {
  text: string;
  ranges: MatchRange[];
}

/**
 * 安全高亮:把文本按区间切成 [普通文本, <mark>命中</mark>, ...] 的 React 节点。
 * 不使用 dangerouslySetInnerHTML,彻底杜绝消息正文中的 HTML/脚本注入。
 */
const HighlightedText: React.FC<HighlightedTextProps> = ({ text, ranges }) => {
  if (!ranges || ranges.length === 0) {
    return <>{text}</>;
  }

  const nodes: React.ReactNode[] = [];
  let cursor = 0;

  ranges.forEach((range, i) => {
    const start = Math.max(0, Math.min(range.start, text.length));
    const end = Math.max(start, Math.min(range.end, text.length));
    if (start > cursor) {
      nodes.push(text.slice(cursor, start));
    }
    if (end > start) {
      nodes.push(
        <Box
          key={`mark-${i}`}
          component="mark"
          sx={{
            backgroundColor: 'warning.light',
            color: 'warning.contrastText',
            px: '2px',
            borderRadius: '3px',
            fontWeight: 600,
          }}
        >
          {text.slice(start, end)}
        </Box>
      );
    }
    cursor = end;
  });

  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }

  return <>{nodes}</>;
};

export default HighlightedText;
