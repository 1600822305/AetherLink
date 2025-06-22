/**
 * 通用滚动条样式工具
 * 提供统一的滚动条样式配置
 */
import type { Theme } from '@mui/material/styles';

/**
 * 获取自定义滚动条样式
 * @param theme MUI主题对象
 * @param width 滚动条宽度，默认6px
 * @returns 滚动条样式对象
 */
export const getScrollbarStyles = (theme: Theme, width: string = '6px') => ({
  '&::-webkit-scrollbar': {
    width: width,
  },
  '&::-webkit-scrollbar-track': {
    backgroundColor: theme.palette.mode === 'dark'
      ? theme.palette.grey[800]
      : theme.palette.grey[100],
    borderRadius: '3px',
  },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: theme.palette.mode === 'dark'
      ? theme.palette.grey[600]
      : theme.palette.grey[400],
    borderRadius: '3px',
    '&:hover': {
      backgroundColor: theme.palette.mode === 'dark'
        ? theme.palette.grey[500]
        : theme.palette.grey[600],
    }
  }
});

/**
 * 获取思考块专用的滚动条样式
 * @param theme MUI主题对象
 * @returns 思考块滚动条样式对象
 */
export const getThinkingScrollbarStyles = (theme: Theme) => ({
  maxHeight: 300,
  overflow: 'auto' as const,
  ...getScrollbarStyles(theme, '6px')
});

/**
 * 获取紧凑型滚动条样式（用于小型弹窗）
 * @param theme MUI主题对象
 * @returns 紧凑型滚动条样式对象
 */
export const getCompactScrollbarStyles = (theme: Theme) => ({
  maxHeight: 200,
  overflow: 'auto' as const,
  ...getScrollbarStyles(theme, '4px')
});
