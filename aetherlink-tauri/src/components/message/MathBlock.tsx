import React from 'react';
import { Box, useTheme } from '@mui/material';
import type { MathMessageBlock } from '../../shared/types/newMessage.ts';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';

interface MathBlockProps {
  block: MathMessageBlock;
}

/**
 * 数学公式块组件
 */
const MathBlock: React.FC<MathBlockProps> = ({ block }) => {
  const theme = useTheme();

  return (
    <Box
      sx={{
        marginY: 2,
        backgroundColor: theme.palette.mode === 'dark'
          ? 'rgba(255, 255, 255, 0.03)'
          : 'rgba(0, 0, 0, 0.01)',
        padding: 2,
        borderRadius: '8px',
        overflow: 'auto',
        '& .katex': {
          color: theme.palette.text.primary
        }
      }}
    >
      {block.displayMode ? (
        <BlockMath math={block.content} />
      ) : (
        <InlineMath math={block.content} />
      )}
    </Box>
  );
};

export default MathBlock; 