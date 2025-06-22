import React, { useState } from 'react';
import { Box, Typography, Button, Chip, useTheme } from '@mui/material';
import type { TranslationMessageBlock } from '../../shared/types/newMessage.ts';
import Markdown from './Markdown';
import { ArrowLeftRight as SwapHoriz } from 'lucide-react';

interface TranslationBlockProps {
  block: TranslationMessageBlock;
}

/**
 * 翻译块组件 - 显示原文和译文
 */
const TranslationBlock: React.FC<TranslationBlockProps> = ({ block }) => {
  const theme = useTheme();
  const [showSource, setShowSource] = useState(false);

  // 切换显示原文/译文
  const toggleShowSource = () => {
    setShowSource(prev => !prev);
  };

  return (
    <Box sx={{ marginTop: 2 }}>
      {/* 标题栏 */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 1
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="caption" sx={{ color: theme.palette.primary.main }}>
            翻译
          </Typography>
          <Chip
            label={`${block.sourceLanguage} → ${block.targetLanguage}`}
            size="small"
            variant="outlined"
            sx={{ height: 20 }}
          />
        </Box>
        <Button
          startIcon={<SwapHoriz />}
          size="small"
          onClick={toggleShowSource}
          sx={{ minWidth: 'auto', px: 1, py: 0 }}
        >
          {showSource ? '显示译文' : '显示原文'}
        </Button>
      </Box>

      {/* 内容区域 */}
      <Box
        sx={{
          backgroundColor: theme.palette.mode === 'dark'
            ? 'rgba(255, 255, 255, 0.05)'
            : 'rgba(0, 0, 0, 0.02)',
          borderRadius: '8px',
          padding: 2,
          transition: 'all 0.3s ease'
        }}
      >
        {showSource ? (
          <Markdown content={block.sourceContent} allowHtml={false} />
        ) : (
          <Markdown content={block.content} allowHtml={false} />
        )}
      </Box>
    </Box>
  );
};

export default TranslationBlock;