import React from 'react';
import { Box, Typography, useTheme, Paper } from '@mui/material';
import type { TranslationMessageBlock } from '../../../shared/types/newMessage';
import Markdown from '../Markdown';

interface Props {
  block: TranslationMessageBlock;
}

/**
 * 翻译块组件
 * 负责渲染翻译内容
 */
const TranslationBlock: React.FC<Props> = ({ block }) => {
  const theme = useTheme();

  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold', color: theme.palette.primary.main }}>
        翻译 ({block.sourceLanguage} → {block.targetLanguage})
      </Typography>

      <Paper
        variant="outlined"
        sx={{
          p: 1.5,
          backgroundColor: theme.palette.mode === 'dark' ? 'rgba(0, 0, 0, 0.1)' : 'rgba(0, 0, 0, 0.03)',
          borderColor: theme.palette.divider
        }}
      >
        <Box sx={{ mb: 1 }}>
          <Typography variant="caption" sx={{ color: theme.palette.text.secondary, display: 'block', mb: 0.5 }}>
            原文:
          </Typography>
          <Box sx={{ pl: 1, borderLeft: `2px solid ${theme.palette.grey[400]}` }}>
            <Typography variant="body2">
              {block.sourceContent}
            </Typography>
          </Box>
        </Box>

        <Box>
          <Typography variant="caption" sx={{ color: theme.palette.primary.main, display: 'block', mb: 0.5 }}>
            翻译:
          </Typography>
          <Box>
            <Markdown content={block.content} allowHtml={false} />
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

export default React.memo(TranslationBlock);
