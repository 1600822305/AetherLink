import React from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Collapse,
  Chip,
  Avatar,
  Tooltip,
  useTheme
} from '@mui/material';
import {
  Lightbulb,
  Copy,
  ChevronDown,
  Brain,
  BarChart,
  Sparkles
} from 'lucide-react';
import { styled } from '@mui/material/styles';
import { motion } from 'motion/react';

import Markdown from '../Markdown';
import { formatThinkingTimeSeconds } from '../../../shared/utils/thinkingUtils';
import { getThinkingScrollbarStyles, getCompactScrollbarStyles } from '../../../shared/utils/scrollbarStyles';
import type { ThinkingDisplayStyle } from './ThinkingBlock';
import ThinkingAdvancedStyles from './ThinkingAdvancedStyles';
import ThinkingCompactStyle from './ThinkingCompactStyle';
import { useTranslation } from '../../../i18n';
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

interface ThinkingDisplayRendererProps {
  displayStyle: ThinkingDisplayStyle;
  expanded: boolean;
  isThinking: boolean;
  thinkingTime: number;
  content: string;
  copied: boolean;
  streamText: string;
  sidebarOpen: boolean;
  overlayOpen: boolean;
  updateCounter: number;
  /** 思考阶段内嵌工具节点（可选） */
  inlineTools?: React.ReactNode;
  onToggleExpanded: () => void;
  onCopy: (e: React.MouseEvent) => void;
  onSetSidebarOpen: (open: boolean) => void;
  onSetOverlayOpen: (open: boolean) => void;
  onSetStreamText: (text: string) => void;
}

// 样式化组件
const StyledPaper = styled(Paper)(({ theme }) => ({
  borderRadius: theme.shape.borderRadius,
  boxShadow: 'none',
  transition: theme.transitions.create(['background-color', 'box-shadow']),
  // 性能优化：固定布局属性，避免重排
  width: '100%',
  maxWidth: '100%',
  minWidth: 0,
  boxSizing: 'border-box',
  // 启用硬件加速
  transform: 'translateZ(0)',
  // 禁用点击蓝色高亮
  WebkitTapHighlightColor: 'transparent',
  outline: 'none',
  userSelect: 'none'
  // 移除 willChange - 只在真正需要时才动态添加
}));

/**
 * 思考过程显示渲染器组件
 * 负责根据不同的显示样式渲染思考过程内容
 */
const ThinkingDisplayRenderer: React.FC<ThinkingDisplayRendererProps> = ({
  displayStyle,
  expanded,
  isThinking,
  thinkingTime,
  content,
  copied,
  streamText,
  sidebarOpen,
  overlayOpen,
  updateCounter: _updateCounter,
  inlineTools,
  onToggleExpanded,
  onCopy,
  onSetSidebarOpen,
  onSetOverlayOpen,
  onSetStreamText
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  
  // 格式化思考时间（毫秒转为秒，保留1位小数）
  const formattedThinkingTime = formatThinkingTimeSeconds(thinkingTime).toFixed(1);

  // 辅助函数：处理复制按钮点击，阻止事件冒泡
  const handleCopyClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCopy(e);
  };

  // 如果设置为隐藏思考过程，则不显示
  if (displayStyle === 'hidden') {
    return null;
  }

  // 紧凑模式 - 使用独立组件
  const renderCompactStyle = () => (
    <ThinkingCompactStyle
      expanded={expanded}
      isThinking={isThinking}
      thinkingTime={thinkingTime}
      content={content}
      copied={copied}
      inlineTools={inlineTools}
      onToggleExpanded={onToggleExpanded}
      onCopy={onCopy}
    />
  );

  // 完整显示样式
  const renderFullStyle = () => (
    <StyledPaper
      elevation={0}
      sx={{
        mb: 2,
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: '8px',
        overflow: 'hidden',
        width: '100%', // 固定占满屏幕宽度
        maxWidth: '100%', // 确保不超出屏幕
        minWidth: 0, // 允许收缩
        ...getGlassBackground(theme.palette.mode === 'dark'),
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          p: 1.5,
          borderBottom: `1px solid ${theme.palette.divider}`
        }}
      >
        <motion.div {...getThinkingAnimation(isThinking)} style={{ marginRight: theme.spacing(1) }}>
          <Lightbulb size={20} color={isThinking ? theme.palette.warning.main : theme.palette.primary.main} />
        </motion.div>

        <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1, gap: 1 }}>
          <Typography variant="subtitle2" component="span">
            {isThinking ? t('settings.appearance.thinkingProcess.preview.texts.deepThinking') : t('settings.appearance.thinkingProcess.preview.texts.deepThinkingProcess')}
          </Typography>
          <Chip
            label={`${formattedThinkingTime}s`}
            size="small"
            color={isThinking ? "warning" : "primary"}
            sx={{ height: 20 }}
          />
        </Box>

        <IconButton
          size="small"
          onClick={onCopy}
          color={copied ? "success" : "default"}
        >
          <Copy size={16} />
        </IconButton>
      </Box>

      <Box sx={{
        p: 2,
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
        ...getThinkingScrollbarStyles(theme)
      }}>
        <Markdown content={content} allowHtml={false} />
      </Box>
      {inlineTools && (
        <Box sx={{ px: 2, pb: 2, pt: 0 }}>
          {inlineTools}
        </Box>
      )}
    </StyledPaper>
  );

  // 极简模式 - 只显示一个小图标
  const renderMinimalStyle = () => (
    <Box sx={{ position: 'relative', display: 'inline-block', mb: 1 }}>
      <Tooltip title={t('settings.appearance.thinkingProcess.preview.texts.thinkingProcessWithTime', { time: formattedThinkingTime })} placement="top">
        <IconButton
          onClick={onToggleExpanded}
          size="small"
          sx={{
            p: 0.5,
            backgroundColor: isThinking ? theme.palette.warning.light : theme.palette.grey[200],
            transition: 'all 0.2s ease',
            '&:hover': {
              backgroundColor: isThinking ? theme.palette.warning.main : theme.palette.grey[300],
            }
          }}
        >
          <motion.div {...getThinkingAnimation(isThinking)}>
            <Lightbulb size={16} color={isThinking ? theme.palette.warning.contrastText : theme.palette.text.secondary}
            />
          </motion.div>
        </IconButton>
      </Tooltip>
      {expanded && (
        <Box sx={{
          position: 'absolute',
          top: 0, // 与小灯泡顶部对齐
          left: '100%', // 显示在小灯泡右边
          ml: 1, // 右边间距
          zIndex: 999,
          width: '90vw', // 使用视口宽度的90%
          maxWidth: '600px', // 适中的最大宽度
          minWidth: '300px' // 最小宽度保证
        }}>
          <Paper
            elevation={4}
            sx={{
              borderRadius: '18px 18px 18px 4px',
              overflow: 'hidden',
              backgroundColor: theme.palette.mode === 'dark'
                ? 'rgba(30, 30, 30, 0.95)'
                : 'rgba(255, 255, 255, 0.98)',
              backdropFilter: 'blur(10px)',
              width: '100%' // 确保Paper也占满宽度
            }}
          >
            <Box sx={{ p: 2, borderBottom: `1px solid ${theme.palette.divider}` }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">
                  {t('settings.appearance.thinkingProcess.preview.texts.thinkingProcessWithTime', { time: formattedThinkingTime })}
                </Typography>
                <IconButton
                  size="small"
                  onClick={onCopy}
                  color={copied ? "success" : "default"}
                >
                  <Copy size={16} />
                </IconButton>
              </Box>
            </Box>
            <Box sx={{
              p: 2,
              ...getThinkingScrollbarStyles(theme)
            }}>
              <Markdown content={content} allowHtml={false} />
            </Box>
          </Paper>
        </Box>
      )}
    </Box>
  );

  // 气泡模式 - 类似聊天气泡
  const renderBubbleStyle = () => (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
      <Avatar
        sx={{
          width: 32,
          height: 32,
          mr: 1,
          backgroundColor: isThinking ? theme.palette.warning.main : theme.palette.primary.main
        }}
      >
        <Brain size={18} />
      </Avatar>
      <Box
        onClick={onToggleExpanded}
        sx={{
          backgroundColor: 'var(--theme-msg-block-bg)',
          borderRadius: '18px 18px 18px 4px',
          p: 1.5,
          cursor: 'pointer',
          maxWidth: '80%',
          transition: 'all 0.2s ease',
          // 禁用点击蓝色高亮
          WebkitTapHighlightColor: 'transparent',
          outline: 'none',
          userSelect: 'none',
          '&:hover': {
            backgroundColor: 'var(--theme-msg-block-bg-hover)',
          }
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', mb: expanded ? 1 : 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1, gap: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 500 }} component="span">
              💭 {isThinking ? t('settings.appearance.thinkingProcess.preview.texts.thinking') : t('settings.appearance.thinkingProcess.preview.texts.thinkingComplete')}
            </Typography>
            <Chip
              label={`${formattedThinkingTime}s`}
              size="small"
              variant="outlined"
              sx={{ height: 18, fontSize: '0.7rem' }}
            />
          </Box>
          <IconButton
            size="small"
            onClick={handleCopyClick}
            sx={{ ml: 1, p: 0.5 }}
            color={copied ? "success" : "default"}
          >
            <Copy size={14} />
          </IconButton>
        </Box>
        <Collapse in={expanded} timeout={0}>
          <Box sx={{
            mt: 1,
            ...getThinkingScrollbarStyles(theme)
          }}>
            <Markdown content={content} allowHtml={false} />
          </Box>
        </Collapse>
      </Box>
    </Box>
  );

  // 时间线模式 - 左侧有时间线指示器
  const renderTimelineStyle = () => (
    <Box sx={{ display: 'flex', mb: 2 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mr: 2 }}>
        <motion.div
          animate={isThinking ? {
            scale: [1, 1.3, 1],
            boxShadow: [
              '0 0 0 0 rgba(255, 193, 7, 0.7)',
              '0 0 0 10px rgba(255, 193, 7, 0)',
              '0 0 0 0 rgba(255, 193, 7, 0)'
            ]
          } : {
            scale: 1,
            boxShadow: '0 0 0 0 rgba(255, 193, 7, 0)'
          }}
          transition={{
            duration: isThinking ? 1.5 : 0.3,
            ease: "easeInOut",
            repeat: isThinking ? Infinity : 0
          }}
          style={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            backgroundColor: isThinking ? theme.palette.warning.main : theme.palette.success.main
          }}
        />
        <Box
          sx={{
            width: 2,
            minHeight: 40,
            height: expanded ? 'auto' : 40,
            backgroundColor: theme.palette.divider,
            mt: 1
          }}
        />
      </Box>
      <Box sx={{ flex: 1 }}>
        <Box
          onClick={onToggleExpanded}
          sx={{
            cursor: 'pointer',
            p: 1.5,
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 2,
            backgroundColor: theme.palette.background.paper,
            transition: 'all 0.2s ease',
            // 禁用点击蓝色高亮
            WebkitTapHighlightColor: 'transparent',
            outline: 'none',
            userSelect: 'none',
            '&:hover': {
              borderColor: theme.palette.primary.main,
              boxShadow: `0 0 0 1px ${theme.palette.primary.main}20`
            }
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', mb: expanded ? 1 : 0 }}>
            <BarChart size={20} color={theme.palette.text.secondary} style={{ marginRight: theme.spacing(1) }} />
            <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1, gap: 1 }}>
              <Typography variant="subtitle2" component="span">
                {isThinking ? t('settings.appearance.thinkingProcess.preview.texts.thinkingStream') : t('settings.appearance.thinkingProcess.preview.texts.thinkingProcess')}
              </Typography>
              <Chip
                label={`${formattedThinkingTime}s`}
                size="small"
                color={isThinking ? "warning" : "default"}
              />
            </Box>
            <IconButton
              size="small"
              onClick={handleCopyClick}
              color={copied ? "success" : "default"}
            >
              <Copy size={16} />
            </IconButton>
            <ChevronDown
              size={20}
              style={{
                transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s'
              }}
            />
          </Box>
          <Collapse in={expanded} timeout={0}>
            <Box sx={{
              pl: 4,
              ...getThinkingScrollbarStyles(theme)
            }}>
              <Markdown content={content} allowHtml={false} />
            </Box>
          </Collapse>
        </Box>
      </Box>
    </Box>
  );

  // 卡片模式 - 更突出的卡片设计
  const renderCardStyle = () => (
    <Box
      sx={{
        mb: 2,
        borderRadius: 3,
        background: `linear-gradient(135deg, ${theme.palette.primary.main}10, ${theme.palette.secondary.main}10)`,
        border: `2px solid ${theme.palette.primary.main}20`,
        overflow: 'hidden',
        transition: 'all 0.3s ease',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: `0 8px 25px ${theme.palette.primary.main}20`,
          border: `2px solid ${theme.palette.primary.main}40`,
        }
      }}
    >
      <Box
        onClick={onToggleExpanded}
        sx={{
          cursor: 'pointer',
          p: 2,
          background: `linear-gradient(90deg, ${theme.palette.primary.main}05, transparent)`,
          // 禁用点击蓝色高亮
          WebkitTapHighlightColor: 'transparent',
          outline: 'none',
          userSelect: 'none',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', mb: expanded ? 1.5 : 0 }}>
          <motion.div
            animate={isThinking ? {
              boxShadow: [
                `0 0 5px ${theme.palette.warning.main}`,
                `0 0 20px ${theme.palette.warning.main}`,
                `0 0 5px ${theme.palette.warning.main}`
              ]
            } : {
              boxShadow: `0 0 5px ${theme.palette.warning.main}20`
            }}
            transition={{
              duration: isThinking ? 2 : 0.3,
              ease: "easeInOut",
              repeat: isThinking ? Infinity : 0
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 40,
              height: 40,
              borderRadius: '50%',
              backgroundColor: isThinking ? theme.palette.warning.main : theme.palette.primary.main,
              marginRight: theme.spacing(2)
            }}
          >
            <Sparkles size={20} color="white" />
          </motion.div>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
              {isThinking ? t('settings.appearance.thinkingProcess.preview.texts.aiDeepThinking') : t('settings.appearance.thinkingProcess.preview.texts.thinkingProcessComplete')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('settings.appearance.thinkingProcess.preview.texts.timeSpent', { time: formattedThinkingTime })}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton
              size="small"
              onClick={onCopy}
              color={copied ? "success" : "primary"}
              sx={{
                backgroundColor: theme.palette.background.paper,
                '&:hover': { backgroundColor: theme.palette.action.hover }
              }}
            >
              <Copy size={16} />
            </IconButton>
            <ChevronDown
              size={20}
              color={theme.palette.primary.main}
              style={{
                transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.3s'
              }}
            />
          </Box>
        </Box>
        <Collapse in={expanded} timeout={0}>
          <Box
            sx={{
              p: 2,
              backgroundColor: theme.palette.background.paper,
              borderRadius: 2,
              border: `1px solid ${theme.palette.divider}`,
              ...getThinkingScrollbarStyles(theme)
            }}
          >
            <Markdown content={content} allowHtml={false} />
          </Box>
        </Collapse>
      </Box>
    </Box>
  );

  // 内联模式 - 嵌入在消息中
  const renderInlineStyle = () => (
    <Box sx={{ position: 'relative', width: '100%', mb: 1 }}>
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          backgroundColor: 'var(--theme-msg-block-bg)',
          borderRadius: 1,
          p: 0.5,
          border: `1px dashed ${theme.palette.divider}`,
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          // 禁用点击蓝色高亮
          WebkitTapHighlightColor: 'transparent',
          outline: 'none',
          userSelect: 'none',
          '&:hover': {
            backgroundColor: 'var(--theme-msg-block-bg-hover)',
          }
        }}
        onClick={onToggleExpanded}
      >
        <motion.div {...getThinkingAnimation(isThinking)} style={{ marginRight: theme.spacing(0.5) }}>
          <Lightbulb size={14} color={isThinking ? theme.palette.warning.main : theme.palette.text.secondary} />
        </motion.div>
        <Typography variant="caption" sx={{ mr: 0.5 }}>
          {isThinking ? t('settings.appearance.thinkingProcess.preview.texts.thinkingInProgressSimple') : t('settings.appearance.thinkingProcess.preview.texts.thinkingSimple')}
        </Typography>
        <Chip
          label={`${formattedThinkingTime}s`}
          size="small"
          variant="outlined"
          sx={{ height: 16, fontSize: '0.6rem', mr: 0.5 }}
        />
        <IconButton
          size="small"
          onClick={onCopy}
          sx={{ p: 0.25 }}
          color={copied ? "success" : "default"}
        >
          <Copy size={12} />
        </IconButton>
      </Box>
      {expanded && (
        <Box
          sx={{
            position: 'absolute',
            bottom: '100%',
            left: 0,
            right: 0, // 使气泡占满整个容器宽度
            mb: 0.5,
            zIndex: 1000,
            width: '100%' // 使用100%宽度，自适应父容器
          }}
        >
          <Paper
            elevation={6}
            sx={{
            borderRadius: '18px 18px 18px 4px',
            overflow: 'hidden',
            backgroundColor: 'var(--theme-bg-elevated)',
            backdropFilter: 'blur(10px)',
            opacity: 0.98,
            width: '100%' // 确保Paper也占满宽度
          }}
        >
          <Box sx={{ p: 1.5, borderBottom: `1px solid ${theme.palette.divider}` }}>
            <Typography variant="caption" color="text.secondary">
              {t('settings.appearance.thinkingProcess.preview.texts.thinkingContent')}
            </Typography>
          </Box>
            <Box sx={{
              p: 1.5,
              ...getCompactScrollbarStyles(theme)
            }}>
              <Markdown content={content} allowHtml={false} />
            </Box>
          </Paper>
        </Box>
      )}
    </Box>
  );

  // 思考点动画模式 - 类似聊天应用的"正在输入"
  const renderDotsStyle = () => (
    <Box sx={{ mb: 2, position: 'relative' }}>
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        p: 1.5,
        backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
        borderRadius: '20px',
        minWidth: isThinking ? 120 : 'auto',
        transition: 'all 0.3s ease'
      }}>
        <Brain size={18} color={theme.palette.primary.main} />
        {isThinking ? (
          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
            <Typography variant="body2" sx={{ mr: 1 }}>{t('settings.appearance.thinkingProcess.preview.texts.aiThinking')}</Typography>
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                animate={{
                  scale: [0, 1, 0]
                }}
                transition={{
                  duration: 1.4,
                  ease: "easeInOut",
                  repeat: Infinity,
                  delay: i * 0.16
                }}
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  backgroundColor: theme.palette.primary.main
                }}
              />
            ))}
          </Box>
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2">{t('settings.appearance.thinkingProcess.preview.texts.thinkingComplete')}</Typography>
            <Chip label={`${formattedThinkingTime}s`} size="small" />
            <IconButton size="small" onClick={onToggleExpanded}>
              <ChevronDown
                size={16}
                style={{
                  transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s'
                }}
              />
            </IconButton>
            <IconButton size="small" onClick={onCopy} color={copied ? "success" : "default"}>
              <Copy size={14} />
            </IconButton>
          </Box>
        )}
      </Box>
      {/* 展开的思考内容 */}
      {!isThinking && expanded && (
        <Box sx={{
          mt: 1,
          p: 2,
          backgroundColor: theme.palette.background.paper,
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: 2,
          boxShadow: theme.shadows[4]
        }}>
          <Markdown content={content} allowHtml={false} />
        </Box>
      )}
    </Box>
  );

  // 根据样式选择渲染方法
  const renderStyle = (): React.ReactNode => {
    // 检查是否是高级样式
    const advancedStyles = ['stream', 'wave', 'sidebar', 'overlay', 'breadcrumb', 'floating', 'terminal'];
    if (advancedStyles.includes(displayStyle)) {
      return (
        <ThinkingAdvancedStyles
          displayStyle={displayStyle}
          isThinking={isThinking}
          thinkingTime={thinkingTime}
          content={content}
          copied={copied}
          expanded={expanded}
          streamText={streamText}
          sidebarOpen={sidebarOpen}
          overlayOpen={overlayOpen}
          onToggleExpanded={onToggleExpanded}
          onCopy={onCopy}
          onSetSidebarOpen={onSetSidebarOpen}
          onSetOverlayOpen={onSetOverlayOpen}
          onSetStreamText={onSetStreamText}
        />
      );
    }

    switch (displayStyle) {
      case 'full':
        return renderFullStyle();
      case 'minimal':
        return renderMinimalStyle();
      case 'bubble':
        return renderBubbleStyle();
      case 'timeline':
        return renderTimelineStyle();
      case 'card':
        return renderCardStyle();
      case 'inline':
        return renderInlineStyle();
      case 'dots':
        return renderDotsStyle();
      case 'compact':
      default:
        return renderCompactStyle();
    }
  };

  // compact / full 两种样式已在各自卡片内部嵌入工具，其余样式在卡片下方补充展示，避免丢块
  const inlineToolsHandledInternally = displayStyle === 'compact' || displayStyle === 'full';

  if (!inlineTools || inlineToolsHandledInternally) {
    return <>{renderStyle()}</>;
  }

  return (
    <Box sx={{ width: '100%' }}>
      {renderStyle()}
      <Box sx={{ mt: -0.5, mb: 1.5 }}>
        {inlineTools}
      </Box>
    </Box>
  );
};

export default React.memo(ThinkingDisplayRenderer);
