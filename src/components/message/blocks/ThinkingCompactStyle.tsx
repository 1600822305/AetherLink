import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Collapse,
  Chip,
  useTheme
} from '@mui/material';
import {
  Lightbulb,
  Copy,
  ChevronDown
} from 'lucide-react';
import { styled, keyframes } from '@mui/material/styles';
import { motion } from 'motion/react';

import Markdown from '../Markdown';
import { formatThinkingTimeSeconds } from '../../../shared/utils/thinkingUtils';
import { getThinkingScrollbarStyles } from '../../../shared/utils/scrollbarStyles';
import { useTranslation } from '../../../i18n';

// 滚动预览区域的固定高度
const PREVIEW_MAX_HEIGHT = 160;
const PREVIEW_MIN_HEIGHT = 40;

// 公共动画配置
const getThinkingAnimation = (isThinking: boolean) => ({
  animate: isThinking ? { opacity: [1, 0.3, 1], scale: [1, 1.1, 1] } : { opacity: 1, scale: 1 },
  transition: {
    duration: isThinking ? 1.2 : 0.3,
    ease: "easeInOut" as const,
    repeat: isThinking ? Infinity : 0,
    times: isThinking ? [0, 0.5, 1] : undefined
  }
});

// 公共半透明背景样式
const getGlassBackground = (isDark: boolean) => ({
  backgroundColor: isDark ? 'rgba(30, 30, 30, 0.85)' : 'rgba(255, 255, 255, 0.85)',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
});

// 样式化组件
const StyledPaper = styled(Paper)(({ theme }) => ({
  borderRadius: theme.shape.borderRadius,
  boxShadow: 'none',
  transition: theme.transitions.create(['background-color', 'box-shadow']),
  width: '100%',
  maxWidth: '100%',
  minWidth: 0,
  boxSizing: 'border-box',
  transform: 'translateZ(0)',
  WebkitTapHighlightColor: 'transparent',
  outline: 'none',
  userSelect: 'none'
}));

export interface ThinkingCompactStyleProps {
  expanded: boolean;
  isThinking: boolean;
  thinkingTime: number;
  content: string;
  copied: boolean;
  /** 思考阶段内嵌工具节点（可选） */
  inlineTools?: React.ReactNode;
  onToggleExpanded: () => void;
  onCopy: (e: React.MouseEvent) => void;
}

// 光标闪烁动画
const cursorBlink = keyframes`
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
`;

/**
 * 思考过程紧凑样式组件
 * 圆滑紧凑的折叠式设计，支持展开查看完整内容
 * 思考中时显示滚动预览，自动滚动到最新内容
 */
const ThinkingCompactStyle: React.FC<ThinkingCompactStyleProps> = ({
  expanded,
  isThinking,
  thinkingTime,
  content,
  copied,
  inlineTools,
  onToggleExpanded,
  onCopy
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevIsThinkingRef = useRef(isThinking);

  // 内层折叠：仅控制思考过程文本；外层 expanded 控制思考+工具调用整体
  const [thinkingExpanded, setThinkingExpanded] = useState(true);

  const toggleThinkingExpanded = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setThinkingExpanded((prev) => !prev);
  }, []);
  
  // 格式化思考时间（毫秒转为秒，保留1位小数）
  const formattedThinkingTime = formatThinkingTimeSeconds(thinkingTime).toFixed(1);

  // 提取最新的思考步骤用于预览
  const previewContent = useMemo(() => {
    if (!content) return '';

    // 匹配 Markdown 标题 (#, ##, ...) 或加粗行 (**Text**)
    // 这种格式通常用于标记思考步骤
    const lines = content.split('\n');
    let lastStepIndex = -1;

    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      // 检查是否是标题 (以 # 开头) 或 加粗行 (以 ** 开头且以 ** 结尾)
      if (line.match(/^#{1,6}\s/) || (line.match(/^\*\*.+\*\*$/))) {
        lastStepIndex = i;
        break;
      }
    }

    if (lastStepIndex !== -1) {
      // 找到了最新的步骤标题，截取从该标题开始的内容
      // 如果内容过少（例如刚输出标题），可能需要多包含一些上下文，或者就只显示这个
      // 这里策略是：始终显示最后一个被识别为"步骤标题"的行之后的所有内容
      return lines.slice(lastStepIndex).join('\n');
    }

    // 如果没有找到明显的步骤标记，则显示全部内容（依赖自动滚动）
    // 或者可以回退到显示最后 N 行，但使用 Markdown 组件渲染全部内容 + 自动滚动通常更稳健
    return content;
  }, [content]);

  // 自动滚动到底部（思考中时）
  // 注意：如果是截取了最新步骤，通常不需要强制滚动到底部，因为内容本身就是最新的
  // 但为了保险（例如最新步骤内容也很长），我们还是保留滚动逻辑，但可以优化一下体验
  useEffect(() => {
    if (isThinking && scrollRef.current) {
      // 如果是截取模式，且内容没有溢出容器太多，可能不需要强制滚动到底部
      // 但简单起见，保持滚动到底部通常是正确的行为，因为正在生成新 token
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [previewContent, isThinking]); // 依赖项改为 previewContent

  // 思考完成后自动折叠（通过触发父组件的 onToggleExpanded）
  useEffect(() => {
    if (prevIsThinkingRef.current && !isThinking && expanded) {
      // 延迟一点收起，让用户看到最终结果
      const timer = setTimeout(() => {
        onToggleExpanded();
      }, 800);
      return () => clearTimeout(timer);
    }
    prevIsThinkingRef.current = isThinking;
  }, [isThinking, expanded, onToggleExpanded]);

  // 辅助函数：处理复制按钮点击，阻止事件冒泡
  const handleCopyClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCopy(e);
  };

  return (
    <StyledPaper
      onClick={onToggleExpanded}
      elevation={0}
      sx={{
        cursor: 'pointer',
        mb: 1.5,
        border: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
        borderRadius: '16px',
        overflow: 'hidden',
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        ...getGlassBackground(theme.palette.mode === 'dark'),
        '&:hover': {
          backgroundColor: theme.palette.mode === 'dark' ? 'rgba(45, 45, 45, 0.92)' : 'rgba(250, 250, 250, 0.95)',
          borderColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
          transform: 'translateY(-1px)',
          boxShadow: theme.palette.mode === 'dark' 
            ? '0 4px 12px rgba(0,0,0,0.3)' 
            : '0 4px 12px rgba(0,0,0,0.08)',
        }
      }}
    >
      {/* 标题栏 */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          px: 1.5,
          py: 1,
          borderBottom: (expanded || isThinking) ? `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'}` : 'none'
        }}
      >
        <motion.div {...getThinkingAnimation(isThinking)} style={{ marginRight: theme.spacing(0.75) }}>
          <Lightbulb size={16} color={isThinking ? theme.palette.warning.main : theme.palette.text.secondary} />
        </motion.div>

        <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1, gap: 0.75 }}>
          <Typography variant="body2" component="span" sx={{ fontWeight: 500, fontSize: '0.8rem' }}>
            {t('settings.appearance.thinkingProcess.preview.texts.thinkingProcess')}
          </Typography>
          <Chip
            label={isThinking ? t('settings.appearance.thinkingProcess.preview.texts.thinkingInProgress', { time: formattedThinkingTime }) : t('settings.appearance.thinkingProcess.preview.texts.thinkingCompleteTime', { time: formattedThinkingTime })}
            size="small"
            color={isThinking ? "warning" : "default"}
            variant="outlined"
            sx={{ 
              height: 18, 
              fontSize: '0.65rem',
              borderRadius: '9px',
              '& .MuiChip-label': { px: 1 }
            }}
          />
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
          <IconButton
            size="small"
            onClick={handleCopyClick}
            color={copied ? "success" : "default"}
            sx={{ 
              p: 0.5,
              borderRadius: '8px',
              '&:hover': { backgroundColor: theme.palette.action.hover }
            }}
          >
            <Copy size={14} />
          </IconButton>

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 24,
              height: 24,
              borderRadius: '8px',
              transition: 'background-color 0.2s',
              '&:hover': { backgroundColor: theme.palette.action.hover }
            }}
          >
            <ChevronDown
              size={16}
              style={{
                transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            />
          </Box>
        </Box>
      </Box>

      {/* 思考中时的滚动预览区域 */}
      {isThinking && !expanded && (
        <Box
          ref={scrollRef}
          onClick={(e) => e.stopPropagation()}
          sx={{
            minHeight: PREVIEW_MIN_HEIGHT,
            maxHeight: PREVIEW_MAX_HEIGHT,
            overflow: 'hidden',
            position: 'relative',
            px: 1.5,
            pt: 1.5,
            pb: 1,
            fontSize: '0.75rem',
            lineHeight: 1.4,
            color: theme.palette.text.secondary,
            backgroundColor: theme.palette.mode === 'dark'
              ? 'rgba(0,0,0,0.2)'
              : 'rgba(0,0,0,0.02)',
            // 移除 flex 沉底布局，改为默认顶部对齐，因为我们只显示最新片段
            // 移除顶部遮罩，因为我们从标题开始显示
          }}
        >
          <Box
            sx={{
              // 针对 Markdown 预览的样式调整
              '& p': { my: 0.25 }, // 进一步减小段落间距
              '& ul, & ol': { my: 0.25, pl: 2 },
              '& li': { my: 0.1 },
              '& h1, & h2, & h3, & h4, & h5, & h6': {
                mt: 1.5, // 增加标题上间距，区分段落
                mb: 0.5,
                fontSize: '0.8rem', // 稍微减小标题字号
                fontWeight: 600,
                color: theme.palette.text.primary,
                lineHeight: 1.3
              },
              '& pre': {
                my: 0.5,
                p: 0.75,
                borderRadius: 1,
                backgroundColor: theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.05)',
                overflowX: 'auto',
                fontSize: '0.7rem'
              },
              // 第一个元素的上边距设为0
              '& > *:first-of-type': { mt: 0 },
              // 最后一个元素添加光标
              '& > *:last-child::after': {
                content: '""',
                display: 'inline-block',
                width: '2px',
                height: '12px',
                backgroundColor: theme.palette.warning.main,
                animation: `${cursorBlink} 1s infinite`,
                verticalAlign: 'middle',
                ml: 0.5
              }
            }}
          >
            <Markdown content={previewContent} allowHtml={false} />
          </Box>
        </Box>
      )}

      {/* 外层展开：思考过程（可内层折叠）+ 工具调用 */}
      <Collapse in={expanded} timeout={0}>
        {/* 内层折叠头：仅在存在内嵌工具时显示，用于单独收起思考文本 */}
        {inlineTools && (
          <Box
            onClick={toggleThinkingExpanded}
            sx={{
              display: 'flex',
              alignItems: 'center',
              px: 1.5,
              py: 0.5,
              cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
              '&:hover': { backgroundColor: theme.palette.action.hover }
            }}
          >
            <Typography variant="caption" color="text.secondary" sx={{ flexGrow: 1 }}>
              {t('settings.appearance.thinkingProcess.preview.texts.thinkingContent')}
            </Typography>
            <ChevronDown
              size={14}
              style={{
                transform: thinkingExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            />
          </Box>
        )}
        <Collapse in={!inlineTools || thinkingExpanded} timeout={0}>
          <Box sx={{
            px: 1.5,
            py: 1.25,
            width: '100%',
            maxWidth: '100%',
            minWidth: 0,
            boxSizing: 'border-box',
            ...getThinkingScrollbarStyles(theme)
          }}>
            <Markdown content={content} allowHtml={false} />
          </Box>
        </Collapse>
        {inlineTools && (
          <Box
            onClick={(e) => e.stopPropagation()}
            sx={{
              px: 1.5,
              pb: 1.25,
              pt: thinkingExpanded ? 0 : 0.75,
              cursor: 'default',
            }}
          >
            {inlineTools}
          </Box>
        )}
      </Collapse>

      {/* 外层折叠且思考中：仍显示工具调用，方便观察进行中的调用 */}
      {inlineTools && !expanded && isThinking && (
        <Box
          onClick={(e) => e.stopPropagation()}
          sx={{
            px: 1.5,
            pb: 1.25,
            pt: 1.25,
            borderTop: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'}`,
            cursor: 'default',
          }}
        >
          {inlineTools}
        </Box>
      )}
    </StyledPaper>
  );
};

export default React.memo(ThinkingCompactStyle);
