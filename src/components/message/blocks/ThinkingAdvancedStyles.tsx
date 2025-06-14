import React, { useEffect } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Collapse,
  Chip,
  Drawer,
  Dialog,
  DialogContent,
  useTheme
} from '@mui/material';
import {
  Copy,
  Brain,
  X,
  ChevronRight,
  ChevronDown,
  Sparkles,
  BarChart
} from 'lucide-react';
import { useMediaQuery } from '@mui/material';
import Markdown from '../Markdown';
import { formatThinkingTimeSeconds } from '../../../shared/utils/thinkingUtils';
import { getThinkingScrollbarStyles } from '../../../shared/utils/scrollbarStyles';

interface AdvancedStylesProps {
  displayStyle: string;
  isThinking: boolean;
  thinkingTime: number;
  content: string;
  copied: boolean;
  expanded: boolean;
  streamText: string;
  sidebarOpen: boolean;
  overlayOpen: boolean;
  onToggleExpanded: () => void;
  onCopy: (e: React.MouseEvent) => void;
  onSetSidebarOpen: (open: boolean) => void;
  onSetOverlayOpen: (open: boolean) => void;
  onSetStreamText: (text: string) => void;
}

/**
 * 思考过程高级显示样式组件
 * 包含2025年新增的先进样式
 */
const ThinkingAdvancedStyles: React.FC<AdvancedStylesProps> = ({
  displayStyle,
  isThinking,
  thinkingTime,
  content,
  copied,
  expanded,
  streamText,
  sidebarOpen,
  overlayOpen,
  onToggleExpanded,
  onCopy,
  onSetSidebarOpen,
  onSetOverlayOpen,
  onSetStreamText
}) => {
  const theme = useTheme();
  const formattedThinkingTime = formatThinkingTimeSeconds(thinkingTime).toFixed(1);

  // 流式文字显示模式 - 逐字显示思考内容
  const renderStreamStyle = () => {
    // 流式文字效果
    useEffect(() => {
      if (isThinking && content) {
        let index = 0;
        const timer = setInterval(() => {
          if (index < content.length) {
            onSetStreamText(content.substring(0, index + 1));
            index++;
          } else {
            clearInterval(timer);
          }
        }, 50); // 每50ms显示一个字符

        return () => clearInterval(timer);
      } else if (!isThinking) {
        onSetStreamText(content);
      }
    }, [isThinking, content]);

    return (
      <Box sx={{ mb: 2, position: 'relative' }}>
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          mb: 1,
          p: 1,
          backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
          borderRadius: 1,
          border: `1px solid ${theme.palette.divider}`
        }}>
          <Brain size={16} color={theme.palette.primary.main} style={{ marginRight: 8 }} />
          <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
            {isThinking ? '正在思考...' : '思考完成'} ({formattedThinkingTime}s)
          </Typography>
          <Box sx={{ ml: 'auto' }}>
            <IconButton size="small" onClick={onCopy} color={copied ? "success" : "default"}>
              <Copy size={14} />
            </IconButton>
          </Box>
        </Box>
        <Box sx={{
          fontFamily: 'monospace',
          fontSize: '0.9rem',
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
          p: 2,
          backgroundColor: theme.palette.background.paper,
          borderRadius: 1,
          border: `1px solid ${theme.palette.divider}`,
          minHeight: 100,
          position: 'relative',
          '&::after': isThinking ? {
            content: '"▋"',
            animation: 'blink 1s infinite',
            '@keyframes blink': {
              '0%, 50%': { opacity: 1 },
              '51%, 100%': { opacity: 0 }
            }
          } : {}
        }}>
          <Markdown content={streamText} allowHtml={false} />
        </Box>
      </Box>
    );
  };

  // 波浪形思维流动可视化
  const renderWaveStyle = () => (
    <Box sx={{ mb: 2, position: 'relative' }}>
      <Box sx={{
        height: 60,
        background: `linear-gradient(90deg, ${theme.palette.primary.main}20, ${theme.palette.secondary.main}20)`,
        borderRadius: 2,
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        px: 2
      }}>
        {/* 波浪动画背景 */}
        <Box sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: isThinking ?
            `repeating-linear-gradient(90deg, transparent, transparent 10px, ${theme.palette.primary.main}10 10px, ${theme.palette.primary.main}10 20px)` :
            'none',
          animation: isThinking ? 'wave 2s linear infinite' : 'none',
          '@keyframes wave': {
            '0%': { transform: 'translateX(-20px)' },
            '100%': { transform: 'translateX(20px)' }
          }
        }} />
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, zIndex: 1 }}>
          <Sparkles size={20} color={theme.palette.primary.main} />
          <Typography variant="body2">
            {isThinking ? '思维波动中...' : '思考完成'} ({formattedThinkingTime}s)
          </Typography>
          <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
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
              <Copy size={16} />
            </IconButton>
          </Box>
        </Box>
      </Box>
      <Collapse in={expanded}>
        <Box sx={{
          mt: 1,
          p: 2,
          backgroundColor: theme.palette.background.paper,
          borderRadius: 2,
          border: `1px solid ${theme.palette.divider}`,
          ...getThinkingScrollbarStyles(theme)
        }}>
          <Markdown content={content} allowHtml={false} />
        </Box>
      </Collapse>
    </Box>
  );

  // 侧边栏滑出式显示 - 移动端友好版本
  const renderSidebarStyle = () => {
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    return (
    <Box sx={{ mb: 2 }}>
      <Box
        onClick={() => onSetSidebarOpen(!sidebarOpen)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          p: 1.5,
          backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
          borderRadius: 2,
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          '&:hover': {
            backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
          }
        }}
      >
        <Brain size={18} color={theme.palette.primary.main} />
        <Typography variant="body2" sx={{ fontWeight: 500, flexGrow: 1 }}>
          {isThinking ? '查看思考过程...' : '查看思考详情'}
        </Typography>
        <Chip
          label={`${formattedThinkingTime}s`}
          size="small"
          color={isThinking ? "warning" : "primary"}
          sx={{ height: 20 }}
        />
        <ChevronRight size={16} />
      </Box>

      <Drawer
        anchor={isMobile ? 'bottom' : 'right'}
        open={sidebarOpen}
        onClose={() => onSetSidebarOpen(false)}
        PaperProps={{
          sx: {
            // 移动端：从底部滑出，占据大部分屏幕高度
            // 桌面端：从右侧滑出，固定宽度
            width: { xs: '100%', sm: 400 },
            height: { xs: '85vh', sm: '100vh' },
            backgroundColor: theme.palette.background.default,
            // 移动端圆角设计
            borderTopLeftRadius: { xs: 16, sm: 0 },
            borderTopRightRadius: { xs: 16, sm: 0 },
            // 移动端安全区域适配
            paddingBottom: { xs: 'env(safe-area-inset-bottom)', sm: 0 },
            // 设置为flex容器，确保内容区域能正确占用剩余空间
            display: 'flex',
            flexDirection: 'column'
          }
        }}
        ModalProps={{
          keepMounted: true, // 提升移动端性能
        }}
      >
        {/* 移动端拖拽指示器 */}
        <Box sx={{
          display: { xs: 'flex', sm: 'none' },
          justifyContent: 'center',
          pt: 1,
          pb: 0.5
        }}>
          <Box sx={{
            width: 32,
            height: 4,
            backgroundColor: theme.palette.divider,
            borderRadius: 2
          }} />
        </Box>

        <Box sx={{
          p: { xs: 2, sm: 2 },
          borderBottom: `1px solid ${theme.palette.divider}`,
          // 移动端粘性标题
          position: { xs: 'sticky', sm: 'static' },
          top: 0,
          backgroundColor: theme.palette.background.default,
          zIndex: 1
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6" sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>
              思考过程详情
            </Typography>
            <IconButton
              onClick={() => onSetSidebarOpen(false)}
              sx={{
                // 移动端更大的点击区域
                p: { xs: 1.5, sm: 1 }
              }}
            >
              <X size={20} />
            </IconButton>
          </Box>
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            mt: 1,
            flexWrap: { xs: 'wrap', sm: 'nowrap' }
          }}>
            <Chip
              label={`耗时 ${formattedThinkingTime}s`}
              size="small"
              color={isThinking ? "warning" : "primary"}
            />
            <IconButton
              size="small"
              onClick={onCopy}
              color={copied ? "success" : "default"}
              sx={{
                // 移动端更大的点击区域
                p: { xs: 1, sm: 0.5 }
              }}
            >
              <Copy size={16} />
            </IconButton>
          </Box>
        </Box>

        <Box sx={{
          p: { xs: 2, sm: 2 },
          flex: 1,
          // 移动端优化的滚动体验
          WebkitOverflowScrolling: 'touch',
          // 只需要滚动条样式，不要任何高度限制
          overflow: 'auto',
          '&::-webkit-scrollbar': {
            width: '6px',
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
        }}>
          <Markdown content={content} allowHtml={false} />
        </Box>
      </Drawer>
    </Box>
    );
  };

  // 全屏半透明覆盖层
  const renderOverlayStyle = () => (
    <Box sx={{ mb: 2 }}>
      <Box
        onClick={() => onSetOverlayOpen(!overlayOpen)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          p: 1.5,
          backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
          borderRadius: 2,
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          '&:hover': {
            backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
          }
        }}
      >
        <Brain size={18} color={theme.palette.primary.main} />
        <Typography variant="body2" sx={{ fontWeight: 500, flexGrow: 1 }}>
          {isThinking ? '沉浸式思考体验' : '查看完整思考'}
        </Typography>
        <Chip
          label={`${formattedThinkingTime}s`}
          size="small"
          color={isThinking ? "warning" : "primary"}
          sx={{ height: 20 }}
        />
      </Box>

      <Dialog
        open={overlayOpen}
        onClose={() => onSetOverlayOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(10px)'
          }
        }}
      >
        <DialogContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h5">AI思考过程</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip
                label={`耗时 ${formattedThinkingTime}s`}
                color={isThinking ? "warning" : "primary"}
              />
              <IconButton
                onClick={onCopy}
                color={copied ? "success" : "default"}
              >
                <Copy size={20} />
              </IconButton>
              <IconButton onClick={() => onSetOverlayOpen(false)}>
                <X size={20} />
              </IconButton>
            </Box>
          </Box>
          <Box sx={{
            ...getThinkingScrollbarStyles(theme),
            maxHeight: '70vh'
          }}>
            <Markdown content={content} allowHtml={false} />
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  );

  // 悬浮气泡跟随鼠标 - 重新实现
  const renderFloatingStyle = () => {
    const [mousePosition, setMousePosition] = React.useState({ x: 0, y: 0 });
    const [isHovering, setIsHovering] = React.useState(false);
    const [showTooltip, setShowTooltip] = React.useState(false);
    const containerRef = React.useRef<HTMLDivElement>(null);

    // 鼠标移动处理
    const handleMouseMove = React.useCallback((e: React.MouseEvent) => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setMousePosition({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        });
      }
    }, []);

    // 鼠标进入处理
    const handleMouseEnter = React.useCallback(() => {
      setIsHovering(true);
      setShowTooltip(true);
    }, []);

    // 鼠标离开处理
    const handleMouseLeave = React.useCallback(() => {
      setIsHovering(false);
      setShowTooltip(false);
    }, []);

    // 点击复制处理
    const handleCopyClick = React.useCallback((e: React.MouseEvent) => {
      e.stopPropagation();
      onCopy(e);
    }, [onCopy]);

    return (
      <Box sx={{ mb: 2, position: 'relative' }}>
        {/* 主要触发区域 */}
        <Box
          ref={containerRef}
          onMouseMove={handleMouseMove}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          sx={{
            display: 'flex',
            alignItems: 'center',
            p: 1.5,
            backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
            borderRadius: '20px',
            cursor: 'default',
            border: `2px solid ${theme.palette.primary.main}30`,
            position: 'relative',
            overflow: 'visible',
            transition: 'all 0.3s ease',
            '&:hover': {
              backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
              borderColor: theme.palette.primary.main + '60',
              transform: 'translateY(-2px)',
              boxShadow: `0 8px 25px ${theme.palette.primary.main}20`,
            }
          }}
        >
          <Sparkles size={20} color={theme.palette.primary.main} style={{ marginRight: 12 }} />
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {isThinking ? '💫 思维粒子活跃中...' : '✨ 悬浮查看思考过程'}
          </Typography>
          <Chip
            label={`${formattedThinkingTime}s`}
            size="small"
            color={isThinking ? "warning" : "primary"}
            sx={{ ml: 1, height: 22 }}
          />
          <Box sx={{ ml: 'auto' }}>
            <IconButton
              size="small"
              onClick={handleCopyClick}
              color={copied ? "success" : "default"}
              sx={{
                transition: 'all 0.2s ease',
                '&:hover': { transform: 'scale(1.1)' }
              }}
            >
              <Copy size={16} />
            </IconButton>
          </Box>

          {/* 动态粒子效果 */}
          {isThinking && (
            <>
              {[...Array(3)].map((_, i) => (
                <Box
                  key={i}
                  sx={{
                    position: 'absolute',
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    backgroundColor: theme.palette.primary.main,
                    left: `${20 + i * 30}%`,
                    animation: `float${i} 3s infinite ease-in-out`,
                    animationDelay: `${i * 0.5}s`,
                    [`@keyframes float${i}`]: {
                      '0%': { transform: 'translateY(0px) scale(0)', opacity: 0 },
                      '50%': { transform: 'translateY(-25px) scale(1)', opacity: 1 },
                      '100%': { transform: 'translateY(-50px) scale(0)', opacity: 0 }
                    }
                  }}
                />
              ))}
            </>
          )}
        </Box>

        {/* 跟随鼠标的悬浮气泡 */}
        {showTooltip && (
          <Box
            sx={{
              position: 'fixed',
              left: mousePosition.x + (containerRef.current?.getBoundingClientRect().left || 0) + 20,
              top: mousePosition.y + (containerRef.current?.getBoundingClientRect().top || 0) - 10,
              maxWidth: 350,
              backgroundColor: theme.palette.mode === 'dark'
                ? 'rgba(0, 0, 0, 0.95)'
                : 'rgba(255, 255, 255, 0.98)',
              backdropFilter: 'blur(12px)',
              border: `1px solid ${theme.palette.primary.main}40`,
              borderRadius: '12px',
              boxShadow: `0 8px 32px ${theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.15)'}`,
              zIndex: 9999,
              p: 2,
              pointerEvents: 'none',
              opacity: isHovering ? 1 : 0,
              transform: `scale(${isHovering ? 1 : 0.8})`,
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              '&::before': {
                content: '""',
                position: 'absolute',
                bottom: '100%',
                left: '20px',
                width: 0,
                height: 0,
                borderLeft: '8px solid transparent',
                borderRight: '8px solid transparent',
                borderBottom: `8px solid ${theme.palette.mode === 'dark' ? 'rgba(0, 0, 0, 0.95)' : 'rgba(255, 255, 255, 0.98)'}`,
              }
            }}
          >
            <Typography variant="caption" color="primary" sx={{ fontWeight: 600, mb: 1, display: 'block' }}>
              💭 完整思考过程
            </Typography>
            <Box sx={{
              fontSize: '0.8rem',
              lineHeight: 1.4,
              color: theme.palette.text.primary,
              ...getThinkingScrollbarStyles(theme),
              maxHeight: 300
            }}>
              <Markdown content={content} allowHtml={false} />
            </Box>
          </Box>
        )}


      </Box>
    );
  };

  // 终端命令行式逐行显示 - 真正的终端模式
  const renderTerminalStyle = () => {
    const lines = content.split('\n').filter(line => line.trim());
    const [displayedLines, setDisplayedLines] = React.useState<string[]>([]);
    const [currentLineIndex, setCurrentLineIndex] = React.useState(0);
    const [showCursor, setShowCursor] = React.useState(true);

    // 逐行显示效果 - 思考完成时开始显示
    React.useEffect(() => {
      if (!isThinking && lines.length > 0) {
        // 重置状态
        setDisplayedLines([]);
        setCurrentLineIndex(0);

        // 开始逐行显示
        let index = 0;
        const timer = setInterval(() => {
          if (index < lines.length) {
            setDisplayedLines(prev => [...prev, lines[index]]);
            setCurrentLineIndex(index + 1);
            index++;
          } else {
            clearInterval(timer);
          }
        }, 150); // 每150ms显示一行

        return () => clearInterval(timer);
      }
    }, [isThinking, content]); // 依赖content而不是lines.length

    // 光标闪烁效果
    React.useEffect(() => {
      const cursorTimer = setInterval(() => {
        setShowCursor(prev => !prev);
      }, 500);

      return () => clearInterval(cursorTimer);
    }, []);

    // 重置显示状态 - 当思考状态改变时
    React.useEffect(() => {
      if (isThinking) {
        setDisplayedLines([]);
        setCurrentLineIndex(0);
      }
    }, [isThinking]);

    return (
      <Box sx={{ mb: 2 }}>
        <Box sx={{
          backgroundColor: '#1a1a1a',
          color: '#00ff00',
          fontFamily: 'Monaco, "Cascadia Code", "Fira Code", monospace',
          fontSize: '0.85rem',
          borderRadius: 1,
          overflow: 'hidden',
          border: '1px solid #333',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
        }}>
          {/* 终端标题栏 - 点击任意位置都可以展开/折叠 */}
          <Box
            onClick={onToggleExpanded}
            sx={{
              backgroundColor: '#333',
              color: '#fff',
              p: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              cursor: 'pointer',
              '&:hover': {
                backgroundColor: '#444',
              }
            }}
          >
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <Box sx={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#ff5f56' }} />
              <Box sx={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#ffbd2e' }} />
              <Box sx={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#27ca3f' }} />
            </Box>
            <Typography variant="caption" sx={{ color: '#ccc', ml: 1 }}>
              AI-思考进程 - {isThinking ? '运行中' : '已完成'} ({formattedThinkingTime}s)
            </Typography>
            <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1 }}>
              <ChevronDown
                size={14}
                style={{
                  transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s',
                  color: '#ccc'
                }}
              />
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation(); // 阻止事件冒泡
                  onCopy(e);
                }}
                sx={{ color: '#ccc' }}
              >
                <Copy size={14} />
              </IconButton>
            </Box>
          </Box>

          {/* 终端内容 - 只有展开时才显示 */}
          {expanded && (
            <Box sx={{
              p: 2,
              minHeight: 200,
              maxHeight: 500,
              overflow: 'auto',
              '&::-webkit-scrollbar': {
                width: '8px',
              },
              '&::-webkit-scrollbar-track': {
                background: '#333',
              },
              '&::-webkit-scrollbar-thumb': {
                background: '#666',
                borderRadius: '4px',
              },
              '&::-webkit-scrollbar-thumb:hover': {
                background: '#888',
              }
            }}>
            {/* 命令提示符 */}
            <Typography component="div" sx={{ mb: 1, color: '#00ff00' }}>
              $ ai-think --process --verbose --output-stream
            </Typography>

            {isThinking ? (
              <Box>
                <Typography component="div" sx={{ color: '#ffff00', mb: 1 }}>
                  [INFO] 初始化思考模块...
                </Typography>
                <Typography component="div" sx={{ color: '#00ffff', mb: 1 }}>
                  [PROC] 正在分析问题空间...
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography component="span" sx={{ color: '#ff9500' }}>
                    [EXEC] 实时思考流
                  </Typography>
                  {[0, 1, 2].map((i) => (
                    <Box
                      key={i}
                      component="span"
                      sx={{
                        color: '#00ff00',
                        animation: `blink 1s infinite`,
                        animationDelay: `${i * 0.3}s`,
                        '@keyframes blink': {
                          '0%, 50%': { opacity: 1 },
                          '51%, 100%': { opacity: 0 }
                        }
                      }}
                    >
                      .
                    </Box>
                  ))}
                </Box>

                {/* 实时思考内容流 */}
                <Box sx={{ mt: 2, pt: 1, borderTop: '1px solid #333' }}>
                  <Typography component="div" sx={{ color: '#888', mb: 1 }}>
                    --- 思考流输出 ---
                  </Typography>
                  {content.split('\n').slice(0, 3).map((line, index) => (
                    <Typography
                      key={index}
                      component="div"
                      sx={{
                        color: '#ccc',
                        mb: 0.5,
                        opacity: 0.7,
                        fontSize: '0.8rem'
                      }}
                    >
                      {line.trim() && `> ${line.trim()}`}
                    </Typography>
                  ))}
                  <Typography component="span" sx={{ color: '#00ff00' }}>
                    {showCursor ? '█' : ' '}
                  </Typography>
                </Box>
              </Box>
            ) : (
              <Box>
                <Typography component="div" sx={{ color: '#ffff00', mb: 1 }}>
                  [INFO] 思考进程已完成
                </Typography>
                <Typography component="div" sx={{ color: '#00ffff', mb: 1 }}>
                  [PROC] 输出完整思考流到终端...
                </Typography>

                {/* 逐行显示思考内容 */}
                <Box sx={{ mt: 2, pt: 1, borderTop: '1px solid #333' }}>
                  <Typography component="div" sx={{ color: '#888', mb: 1 }}>
                    --- 思考流输出 ---
                  </Typography>

                  {/* 显示已输出的行 */}
                  {displayedLines.map((line, index) => (
                    <Typography
                      key={`line-${index}`}
                      component="div"
                      sx={{
                        color: '#ccc',
                        mb: 0.3,
                        fontSize: '0.8rem',
                        lineHeight: 1.3,
                        whiteSpace: 'pre-wrap',
                        animation: 'fadeIn 0.3s ease-in',
                        '@keyframes fadeIn': {
                          '0%': { opacity: 0, transform: 'translateX(-10px)' },
                          '100%': { opacity: 1, transform: 'translateX(0)' }
                        }
                      }}
                    >
                      {line}
                    </Typography>
                  ))}

                  {/* 显示进度或完成状态 */}
                  {currentLineIndex < lines.length ? (
                    <Typography component="div" sx={{ color: '#ff9500', mt: 1 }}>
                      [STREAM] 输出进度: {currentLineIndex}/{lines.length} 行
                      <Typography component="span" sx={{ color: '#00ff00', ml: 1 }}>
                        {showCursor ? '█' : ' '}
                      </Typography>
                    </Typography>
                  ) : displayedLines.length > 0 && (
                    <Box sx={{ mt: 1 }}>
                      <Typography component="div" sx={{ color: '#00ff00', mb: 0.5 }}>
                        [DONE] 思考流输出完成 - 退出代码: 0
                      </Typography>
                      <Typography component="div" sx={{ color: '#888', mb: 0.5 }}>
                        总计: {lines.length} 行
                      </Typography>
                      <Typography component="div" sx={{ color: '#00ff00' }}>
                        $ {showCursor ? '█' : ' '}
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Box>
            )}
          </Box>
          )}
        </Box>
      </Box>
    );
  };

  // 面包屑式步骤展示 - 重新实现
  const renderBreadcrumbStyle = () => {
    // 更智能的步骤提取：寻找关键思考节点
    const extractKeySteps = (text: string) => {
      if (!text || text.trim() === '') return [];

      const lines = text.split('\n').filter(line => line.trim());
      const keySteps = [];

      // 寻找包含关键词的行作为步骤
      const keyWords = ['分析', '考虑', '思考', '判断', '结论', '总结', '首先', '然后', '接下来', '最后', '因此', '所以'];

      for (let i = 0; i < lines.length && keySteps.length < 6; i++) {
        const line = lines[i].trim();
        if (line.length > 10) { // 过滤太短的行
          // 检查是否包含关键词或者是列表项
          const hasKeyWord = keyWords.some(word => line.includes(word));
          const isListItem = /^[\d\-\*\+]/.test(line);
          const isQuestion = line.includes('?') || line.includes('？');

          if (hasKeyWord || isListItem || isQuestion || keySteps.length === 0) {
            keySteps.push(line);
          }
        }
      }

      // 如果没找到关键步骤，就取前几行
      if (keySteps.length === 0) {
        return lines.slice(0, 4);
      }

      return keySteps;
    };

    const steps = extractKeySteps(content);
    const hasSteps = steps.length > 0;

    return (
      <Box sx={{ mb: 2 }}>
        {/* 标题栏 */}
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          mb: 2,
          p: 1.5,
          backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
          borderRadius: 2,
          border: `1px solid ${theme.palette.divider}`
        }}>
          <BarChart size={18} color={theme.palette.primary.main} style={{ marginRight: 8 }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            思考路径
          </Typography>
          <Chip
            label={`${formattedThinkingTime}s`}
            size="small"
            color={isThinking ? "warning" : "success"}
            sx={{ ml: 1, height: 20 }}
          />
          <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1 }}>
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
              <Copy size={16} />
            </IconButton>
          </Box>
        </Box>

        {/* 步骤面包屑 */}
        {hasSteps && (
          <Box sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 1,
            alignItems: 'center',
            mb: expanded ? 2 : 0,
            p: 1,
            backgroundColor: theme.palette.background.paper,
            borderRadius: 1,
            border: `1px solid ${theme.palette.divider}`
          }}>
            {steps.map((step, index) => (
              <React.Fragment key={index}>
                <Chip
                  label={`${index + 1}. ${step.slice(0, 40)}${step.length > 40 ? '...' : ''}`}
                  size="small"
                  variant={index === steps.length - 1 && isThinking ? "filled" : "outlined"}
                  color={
                    index === steps.length - 1 && isThinking
                      ? "warning"
                      : index < steps.length - 1 || !isThinking
                        ? "primary"
                        : "default"
                  }
                  sx={{
                    maxWidth: 250,
                    height: 28,
                    '& .MuiChip-label': {
                      fontSize: '0.75rem',
                      fontWeight: 500
                    },
                    animation: index === steps.length - 1 && isThinking ? 'pulse 2s infinite' : 'none',
                    '@keyframes pulse': {
                      '0%': { opacity: 1, transform: 'scale(1)' },
                      '50%': { opacity: 0.7, transform: 'scale(1.05)' },
                      '100%': { opacity: 1, transform: 'scale(1)' }
                    }
                  }}
                />
                {index < steps.length - 1 && (
                  <ChevronRight
                    size={14}
                    color={theme.palette.text.secondary}
                    style={{ margin: '0 4px' }}
                  />
                )}
              </React.Fragment>
            ))}

            {/* 思考中的动画指示器 */}
            {isThinking && (
              <>
                <ChevronRight
                  size={14}
                  color={theme.palette.text.secondary}
                  style={{ margin: '0 4px' }}
                />
                <Box sx={{
                  display: 'flex',
                  gap: 0.5,
                  alignItems: 'center',
                  px: 1.5,
                  py: 0.5,
                  borderRadius: 1,
                  backgroundColor: theme.palette.warning.main + '20',
                  border: `1px dashed ${theme.palette.warning.main}40`
                }}>
                  <Typography variant="caption" sx={{ color: theme.palette.warning.main, fontWeight: 600 }}>
                    思考中
                  </Typography>
                  {[0, 1, 2].map((i) => (
                    <Box
                      key={i}
                      sx={{
                        width: 4,
                        height: 4,
                        borderRadius: '50%',
                        backgroundColor: theme.palette.warning.main,
                        animation: `bounce 1.4s infinite ease-in-out`,
                        animationDelay: `${i * 0.16}s`,
                        '@keyframes bounce': {
                          '0%, 80%, 100%': { transform: 'scale(0)' },
                          '40%': { transform: 'scale(1)' }
                        }
                      }}
                    />
                  ))}
                </Box>
              </>
            )}
          </Box>
        )}

        {/* 完整思考内容 */}
        {expanded && (
          <Box sx={{
            p: 2,
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 2,
            boxShadow: theme.shadows[1]
          }}>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
              💭 完整思考过程：
            </Typography>
            <Box sx={{
              ...getThinkingScrollbarStyles(theme),
              maxHeight: 400
            }}>
              <Markdown content={content} allowHtml={false} />
            </Box>
          </Box>
        )}
      </Box>
    );
  };

  // 根据样式选择渲染方法
  switch (displayStyle) {
    case 'stream':
      return renderStreamStyle();
    case 'wave':
      return renderWaveStyle();
    case 'sidebar':
      return renderSidebarStyle();
    case 'overlay':
      return renderOverlayStyle();
    case 'breadcrumb':
      return renderBreadcrumbStyle();
    case 'floating':
      return renderFloatingStyle();
    case 'terminal':
      return renderTerminalStyle();
    default:
      return null;
  }
};

export default React.memo(ThinkingAdvancedStyles);
