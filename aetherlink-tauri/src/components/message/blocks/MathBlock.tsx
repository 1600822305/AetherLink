import React from 'react';
import { Box, Paper, useTheme } from '@mui/material';
import type { MathMessageBlock } from '../../../shared/types/newMessage';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';

interface Props {
  block: MathMessageBlock;
}

/**
 * 数学公式块组件
 * 负责渲染数学公式
 */
const MathBlock: React.FC<Props> = ({ block }) => {
  const theme = useTheme();

  // 尝试渲染数学公式，如果失败则显示原始内容
  const renderMath = () => {
    try {
      if (block.displayMode) {
        return <BlockMath math={block.content} />;
      } else {
        return <InlineMath math={block.content} />;
      }
    } catch (error) {
      console.error('数学公式渲染失败:', error);
      return (
        <Box component="pre" sx={{
          p: 1,
          backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255, 0, 0, 0.1)' : 'rgba(255, 0, 0, 0.05)',
          borderRadius: '4px',
          overflowX: 'auto'
        }}>
          {block.content}
        </Box>
      );
    }
  };

  return (
    <Box sx={{ my: 1 }}>
      <Paper
        variant="outlined"
        sx={{
          p: 2,
          backgroundColor: theme.palette.mode === 'dark' ? 'rgba(0, 0, 0, 0.1)' : 'rgba(0, 0, 0, 0.02)',
          display: 'flex',
          justifyContent: 'center',
          overflow: 'auto'
        }}
      >
        {renderMath()}
      </Paper>
    </Box>
  );
};

export default React.memo(MathBlock);
