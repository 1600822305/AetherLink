import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useTheme } from '@mui/material';
import { Box, Skeleton, Alert, IconButton, Tooltip, Snackbar, Chip } from '@mui/material';
import { Copy as ContentCopyIcon, ChevronDown as ExpandMoreIcon, ChevronUp as ExpandLessIcon, Code as CodeIcon, ZoomIn as ZoomInIcon, ZoomOut as ZoomOutIcon, RotateCcw as ResetIcon } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, vs } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useAppSelector } from '../../../shared/store';
import mermaid from 'mermaid';

interface MermaidBlockProps {
  code: string;
  id?: string;
  // 新增：消息角色
  messageRole?: 'user' | 'assistant' | 'system';
}

// 生成安全的 CSS ID
const generateSafeId = (baseId?: string): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 9);
  
  if (baseId) {
    // 清理 baseId，只保留字母、数字、连字符和下划线
    const cleanId = baseId.replace(/[^a-zA-Z0-9_-]/g, '-');
    return `mermaid-${cleanId}-${timestamp}-${random}`;
  }
  
  return `mermaid-${timestamp}-${random}`;
};

// 初始化 Mermaid 配置
const initializeMermaid = (isDarkMode: boolean) => {
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'loose',
    theme: isDarkMode ? 'dark' : 'default',
    themeVariables: {
      primaryColor: isDarkMode ? '#90caf9' : '#1976d2',
      primaryTextColor: isDarkMode ? '#ffffff' : '#000000',
      primaryBorderColor: isDarkMode ? '#424242' : '#e0e0e0',
      lineColor: isDarkMode ? '#616161' : '#757575',
      secondaryColor: isDarkMode ? '#424242' : '#f5f5f5',
      tertiaryColor: isDarkMode ? '#616161' : '#fafafa',
      // 添加字体大小控制
      fontSize: '12px'
    },
    flowchart: {
      useMaxWidth: false, // 禁用自动宽度
      htmlLabels: true,
      curve: 'basis'
    },
    sequence: {
      useMaxWidth: false, // 禁用自动宽度
      wrap: true
    },
    gantt: {
      useMaxWidth: false // 禁用自动宽度
    }
  });
};

const MermaidBlock: React.FC<MermaidBlockProps> = ({ code, id, messageRole }) => {
  const theme = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const svgContainerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // 缩放和拖拽状态
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  // 从 Redux store 获取 mermaid 设置
  const mermaidEnabled = useAppSelector(state => state.settings.mermaidEnabled);
  
  // 新逻辑：用户输入的Mermaid不渲染，只有AI回答才渲染
  const shouldRender = mermaidEnabled && messageRole === 'assistant';
  
  const isDarkMode = theme.palette.mode === 'dark';
  
  // 生成唯一且安全的ID
  const mermaidId = useRef(generateSafeId(id));

  // 复制代码功能
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code)
      .then(() => {
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      })
      .catch(err => {
        console.error('复制失败:', err);
      });
  }, [code]);

  // 缩放功能
  const handleZoomIn = useCallback(() => {
    setScale(prev => Math.min(prev * 1.2, 3)); // 最大3倍
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale(prev => Math.max(prev / 1.2, 0.3)); // 最小0.3倍
  }, []);

  const handleResetZoom = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  // 鼠标拖拽功能
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) { // 左键
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
      e.preventDefault();
    }
  }, [position]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // 滚轮缩放功能
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale(prev => Math.max(0.3, Math.min(3, prev * delta)));
  }, []);

  // 切换折叠状态
  const toggleCollapse = useCallback(() => {
    setIsCollapsed(prev => {
      const newCollapsed = !prev;
      // 如果从折叠状态展开，需要重新渲染图表
      if (!newCollapsed && mermaidEnabled && containerRef.current) {
        // 清空容器内容，强制重新渲染
        containerRef.current.innerHTML = '';
        setIsLoading(true);
      }
      return newCollapsed;
    });
  }, [mermaidEnabled]);

  useEffect(() => {
    let mounted = true;

    const renderDiagram = async () => {
      if (!containerRef.current || !code.trim() || isCollapsed) return;

      try {
        setIsLoading(true);
        setError(null);

        // 重新初始化以应用主题变化
        initializeMermaid(isDarkMode);

        // 验证语法
        const isValid = await mermaid.parse(code);
        if (!isValid) {
          throw new Error('Invalid Mermaid syntax');
        }

        // 渲染图表
        const { svg } = await mermaid.render(mermaidId.current, code);

        if (mounted && containerRef.current) {
          containerRef.current.innerHTML = svg;

          // 设置固定宽度样式，类似代码块
          const svgElement = containerRef.current.querySelector('svg');
          // 在 useEffect 中的 SVG 样式设置部分
          if (svgElement) {
          // 设置更合适的宽度和居中显示
          svgElement.style.width = '100%';
          svgElement.style.maxWidth = '600px'; // 从 800px 调整为 600px
          svgElement.style.height = 'auto';
          svgElement.style.display = 'block';
          svgElement.style.margin = '0 auto';

            // 确保 viewBox 存在以支持缩放
            if (!svgElement.getAttribute('viewBox')) {
              const bbox = svgElement.getBBox();
              svgElement.setAttribute('viewBox', `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`);
            }
          }
        }
      } catch (err) {
        console.error('Mermaid render error:', err);
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to render diagram');
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    if (mermaidEnabled && !isCollapsed) {
      // 添加小延迟确保DOM完全渲染
      const timer = setTimeout(() => {
        renderDiagram();
      }, 50);

      return () => {
        clearTimeout(timer);
        mounted = false;
      };
    } else {
      setIsLoading(false);
    }

    return () => {
      mounted = false;
    };
  }, [code, isDarkMode, mermaidEnabled, isCollapsed]);
  
  // 如果禁用了 mermaid，则渲染为普通代码块
  if (!shouldRender) {
    return (
      <Box
        sx={{
          marginY: 1,
          borderRadius: 2,
          border: isDarkMode ? '1px solid #3d4852' : '1px solid #e2e8f0',
          overflow: 'hidden',
          boxShadow: isDarkMode
            ? '0 1px 3px rgba(0, 0, 0, 0.3)'
            : '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}
      >
        {/* 代码块头部 */}
        <Box sx={{ /* ... */ }}>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Chip label="MERMAID"
              size="small"
              sx={{
                backgroundColor: isDarkMode ? '#475569' : '#e2e8f0',
                color: isDarkMode ? '#e2e8f0' : '#475569',
                fontWeight: 'bold',
                fontSize: '11px'
              }}
            />
            <Chip
              label={messageRole === 'user' ? "用户输入" : "已禁用"}
              size="small"
              sx={{
                backgroundColor: isDarkMode ? '#dc2626' : '#fef2f2',
                color: isDarkMode ? '#fca5a5' : '#dc2626',
                fontWeight: 'bold',
                fontSize: '11px'
              }}
            />
          </Box>

          {/* 工具栏 */}
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {/* 折叠/展开按钮 */}
            <Tooltip title={isCollapsed ? "展开代码块" : "折叠代码块"}>
              <IconButton
                size="small"
                onClick={toggleCollapse}
                sx={{
                  color: isDarkMode ? '#ffffff' : '#666666',
                  '&:hover': {
                    backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                  }
                }}
              >
                {isCollapsed ? <ExpandMoreIcon fontSize="small" /> : <ExpandLessIcon fontSize="small" />}
              </IconButton>
            </Tooltip>

            {/* 复制按钮 */}
            <Tooltip title="复制代码">
              <IconButton
                size="small"
                onClick={handleCopy}
                sx={{
                  color: isDarkMode ? '#ffffff' : '#666666',
                  '&:hover': {
                    backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                  }
                }}
              >
                <ContentCopyIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* 代码内容区域 */}
        {isCollapsed ? (
          // 折叠状态：显示简化信息
          <Box
            sx={{
              padding: '16px',
              color: isDarkMode ? '#94a3b8' : '#64748b',
              cursor: 'pointer',
              '&:hover': {
                backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.5)' : 'rgba(248, 250, 252, 0.5)'
              }
            }}
            onClick={toggleCollapse}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CodeIcon size={16} color={isDarkMode ? '#888' : '#666'} />
              <span style={{
                color: isDarkMode ? '#ccc' : '#666',
                fontSize: '14px'
              }}>
                Mermaid 代码 ({code.split('\n').length} 行) - 图表渲染已禁用
              </span>
            </Box>
            <ExpandMoreIcon size={16} color={isDarkMode ? '#888' : '#666'} />
          </Box>
        ) : (
          // 展开状态：显示完整代码（带语法高亮）
          <SyntaxHighlighter
            language="mermaid"
            style={isDarkMode ? vscDarkPlus : vs}
            customStyle={{
              margin: 0,
              padding: '1rem',
              fontSize: '14px',
              lineHeight: 1.5,
              border: 'none',
              borderRadius: 0,
              overflow: 'auto',
              maxHeight: '500px',
              minWidth: '100%'
            }}
            codeTagProps={{
              style: {
                fontFamily: 'Monaco, Menlo, "Ubuntu Mono", Consolas, source-code-pro, monospace',
                display: 'block'
              }
            }}
          >
            {code}
          </SyntaxHighlighter>
        )}

        <Snackbar
          open={copySuccess}
          autoHideDuration={2000}
          message="代码已复制到剪贴板"
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ my: 2, mx: 1 }}>
        Mermaid渲染错误: {error}
      </Alert>
    );
  }

  return (
    <Box
      sx={{
        marginY: 1,
        borderRadius: 2,
        border: isDarkMode ? '1px solid #3d4852' : '1px solid #e2e8f0',
        overflow: 'hidden',
        boxShadow: isDarkMode
          ? '0 1px 3px rgba(0, 0, 0, 0.3)'
          : '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}
    >
      {/* 图表头部 */}
      <Box sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 16px',
        backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc',
        borderBottom: isDarkMode ? '1px solid #3d4852' : '1px solid #e2e8f0'
      }}>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Chip label="MERMAID"
            size="small"
            sx={{
              backgroundColor: isDarkMode ? '#475569' : '#e2e8f0',
              color: isDarkMode ? '#e2e8f0' : '#475569',
              fontWeight: 'bold',
              fontSize: '11px'
            }}
          />
          <Chip
            label="已渲染"
            size="small"
            sx={{
              backgroundColor: isDarkMode ? '#059669' : '#d1fae5',
              color: isDarkMode ? '#a7f3d0' : '#059669',
              fontWeight: 'bold',
              fontSize: '11px'
            }}
          />
          {!isCollapsed && (
            <Chip
              label={`${Math.round(scale * 100)}%`}
              size="small"
              sx={{
                backgroundColor: isDarkMode ? '#374151' : '#f3f4f6',
                color: isDarkMode ? '#d1d5db' : '#374151',
                fontWeight: 'bold',
                fontSize: '11px'
              }}
            />
          )}
        </Box>

        {/* 工具栏 */}
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {/* 缩放控制按钮 */}
          {!isCollapsed && (
            <>
              <Tooltip title="放大">
                <IconButton
                  size="small"
                  onClick={handleZoomIn}
                  disabled={scale >= 3}
                  sx={{
                    color: isDarkMode ? '#ffffff' : '#666666',
                    '&:hover': {
                      backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                    }
                  }}
                >
                  <ZoomInIcon fontSize="small" />
                </IconButton>
              </Tooltip>

              <Tooltip title="缩小">
                <IconButton
                  size="small"
                  onClick={handleZoomOut}
                  disabled={scale <= 0.3}
                  sx={{
                    color: isDarkMode ? '#ffffff' : '#666666',
                    '&:hover': {
                      backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                    }
                  }}
                >
                  <ZoomOutIcon fontSize="small" />
                </IconButton>
              </Tooltip>

              <Tooltip title="重置缩放">
                <IconButton
                  size="small"
                  onClick={handleResetZoom}
                  sx={{
                    color: isDarkMode ? '#ffffff' : '#666666',
                    '&:hover': {
                      backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                    }
                  }}
                >
                  <ResetIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </>
          )}

          {/* 折叠/展开按钮 */}
          <Tooltip title={isCollapsed ? "展开图表" : "折叠图表"}>
            <IconButton
              size="small"
              onClick={toggleCollapse}
              sx={{
                color: isDarkMode ? '#ffffff' : '#666666',
                '&:hover': {
                  backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                }
              }}
            >
              {isCollapsed ? <ExpandMoreIcon fontSize="small" /> : <ExpandLessIcon fontSize="small" />}
            </IconButton>
          </Tooltip>

          {/* 复制按钮 */}
          <Tooltip title="复制代码">
            <IconButton
              size="small"
              onClick={handleCopy}
              sx={{
                color: isDarkMode ? '#ffffff' : '#666666',
                '&:hover': {
                  backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                }
              }}
            >
              <ContentCopyIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* 图表内容区域 */}
      {isCollapsed ? (
        // 折叠状态：显示简化信息
        <Box
          sx={{
            padding: '16px',
            color: isDarkMode ? '#94a3b8' : '#64748b',
            cursor: 'pointer',
            '&:hover': {
              backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.5)' : 'rgba(248, 250, 252, 0.5)'
            }
          }}
          onClick={toggleCollapse}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'center' }}>
            <span style={{
              color: isDarkMode ? '#ccc' : '#666',
              fontSize: '14px'
            }}>
              Mermaid 图表已折叠 - 点击展开
            </span>
            <ExpandMoreIcon size={16} color={isDarkMode ? '#888' : '#666'} />
          </Box>
        </Box>
      ) : (
        // 展开状态：显示图表
        <Box
          sx={{
            width: '100%',
            minHeight: isLoading ? '120px' : '300px', // 增加最小高度以便拖拽
            overflow: 'hidden', // 改为hidden以支持拖拽
            p: 2,
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'background.paper',
            cursor: isDragging ? 'grabbing' : 'grab',
            // 移动端适配
            '@media (max-width: 600px)': {
              p: 1,
              minHeight: isLoading ? '100px' : '200px'
            }
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        >
          {isLoading && (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100px',
                gap: 1.5
              }}
            >
              <Skeleton
                variant="rectangular"
                width="70%"
                height={80}
                sx={{ borderRadius: 1 }}
              />
              <Box sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                正在渲染图表...
              </Box>
            </Box>
          )}

          {/* 使用提示 */}
          {!isLoading && (
            <Box
              sx={{
                position: 'absolute',
                bottom: 8,
                right: 8,
                backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.9)',
                color: isDarkMode ? '#ffffff' : '#666666',
                padding: '4px 8px',
                borderRadius: 1,
                fontSize: '10px',
                opacity: 0.7,
                pointerEvents: 'none',
                zIndex: 1
              }}
            >
              拖拽移动 • 滚轮缩放
            </Box>
          )}

          <div
            ref={svgContainerRef}
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
              transformOrigin: 'center center',
              transition: isDragging ? 'none' : 'transform 0.2s ease',
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <div
              ref={containerRef}
              style={{
                textAlign: 'center',
                lineHeight: 'normal',
                overflow: 'visible',
                width: 'auto',
                height: 'auto',
                minHeight: '50px'
              }}
            />
          </div>
        </Box>
      )}

      <Snackbar
        open={copySuccess}
        autoHideDuration={2000}
        message="代码已复制到剪贴板"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
};

export default MermaidBlock;