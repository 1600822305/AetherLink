import React from 'react';
import { Box, Chip, Typography } from '@mui/material';
import { Clock, MessageSquare, Hash } from 'lucide-react';
import dayjs from 'dayjs';
import type { SearchHit } from '../../shared/services/search/types';
import HighlightedText from './HighlightedText';

interface SearchResultItemProps {
  hit: SearchHit;
  active: boolean;
  onSelect: (hit: SearchHit) => void;
}

/**
 * 单条搜索结果。语义上是按钮(键盘可达 + 回车触发),区别话题命中 / 消息命中。
 */
const SearchResultItem: React.FC<SearchResultItemProps> = ({ hit, active, onSelect }) => {
  const isTopic = hit.kind === 'topic';
  const roleLabel = hit.role === 'assistant' ? '助手' : hit.role === 'system' ? '系统' : '用户';

  return (
    <Box
      role="option"
      aria-selected={active}
      tabIndex={-1}
      onClick={() => onSelect(hit)}
      sx={{
        borderRadius: 2,
        mb: 1,
        p: 1.5,
        cursor: 'pointer',
        border: '1px solid',
        borderColor: active ? 'primary.main' : 'divider',
        bgcolor: active ? 'action.hover' : 'transparent',
        '&:hover': { bgcolor: 'action.hover', borderColor: 'primary.main' },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
        {isTopic ? <Hash size={15} /> : <MessageSquare size={15} />}
        <Typography variant="subtitle2" color="primary" sx={{ fontWeight: 600 }}>
          {hit.topicName}
        </Typography>
        <Chip
          label={isTopic ? '话题' : roleLabel}
          size="small"
          variant="outlined"
          color={isTopic ? 'default' : hit.role === 'assistant' ? 'secondary' : 'primary'}
          sx={{ fontSize: '0.7rem', height: 20 }}
        />
      </Box>

      <Typography
        variant="body2"
        sx={{
          color: 'text.primary',
          mb: 0.5,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          wordBreak: 'break-word',
        }}
      >
        <HighlightedText text={hit.snippet} ranges={hit.matchRanges} />
      </Typography>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
        <Clock size={13} />
        <Typography component="span" variant="caption">
          {hit.createdAt ? dayjs(hit.createdAt).format('YYYY/MM/DD HH:mm') : '未知时间'}
        </Typography>
      </Box>
    </Box>
  );
};

export default SearchResultItem;
