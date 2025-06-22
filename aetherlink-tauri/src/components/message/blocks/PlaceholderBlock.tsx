import React from 'react';
import { Box, CircularProgress } from '@mui/material';
import { MessageBlockStatus, MessageBlockType } from '../../../shared/types/newMessage';
import type { PlaceholderMessageBlock } from '../../../shared/types/newMessage';

interface PlaceholderBlockProps {
  block: PlaceholderMessageBlock;
}

/**
 * 占位符块组件 - 参考最佳实例实现
 * 用于在流式输出开始时显示加载状态
 */
const PlaceholderBlock: React.FC<PlaceholderBlockProps> = ({ block }) => {
  // 只在处理状态且类型为UNKNOWN时显示
  if (block.status === MessageBlockStatus.PROCESSING && block.type === MessageBlockType.UNKNOWN) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          height: 32,
          marginTop: '-5px',
          marginBottom: '5px'
        }}
      >
        <CircularProgress size={16} sx={{ mr: 1 }} />
        <Box sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
          正在生成回复...
        </Box>
      </Box>
    );
  }
  
  return null;
};

export default React.memo(PlaceholderBlock);
