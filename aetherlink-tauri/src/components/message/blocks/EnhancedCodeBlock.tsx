import React, { useState, useCallback, useMemo } from 'react';
import {
  Box,
  IconButton,
  Tooltip,
  Snackbar,
  Chip,
  Collapse
} from '@mui/material';
import {
  Copy,
  Download,
  Edit,
  Eye,
  ChevronDown,
  ChevronUp,
  WrapText,
  Type,
  Save,
  X,
  Globe,
  Maximize,
  Minimize
} from 'lucide-react';
import { useTheme } from '@mui/material/styles';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import {
  vscDarkPlus,
  vs,
  tomorrow,
  twilight,
  oneDark,
  // 新增更多主题
  atomDark,
  base16AteliersulphurpoolLight,
  cb,
  coldarkCold,
  coldarkDark,
  coy,
  darcula,
  dark,
  duotoneDark,
  duotoneEarth,
  duotoneForest,
  duotoneLight,
  duotoneSea,
  duotoneSpace,
  ghcolors,
  hopscotch,
  lucario,
  materialDark,
  materialLight,
  materialOceanic,
  nord,
  okaidia,
  oneLight,
  pojoaque,
  shadesOfPurple,
  solarizedlight,
  synthwave84,
  xonokai,
  zTouch
} from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useAppSelector } from '../../../shared/store';
import type { CodeMessageBlock } from '../../../shared/types/newMessage';

interface EnhancedCodeBlockProps {
  block: CodeMessageBlock;
  onSave?: (id: string, newContent: string) => void;
}

type ViewMode = 'preview' | 'edit' | 'html';

// 主题映射 - 大幅扩展主题选择
const getHighlightTheme = (codeStyle: string, isDarkMode: boolean) => {
  const themeMap: Record<string, any> = {
    // 自动主题
    'auto': isDarkMode ? vscDarkPlus : vs,

    // 经典主题
    'vs-code-light': vs,
    'vs-code-dark': vscDarkPlus,
    'github-light': ghcolors,
    'github-dark': dark,
    'one-dark-pro': oneDark,
    'one-light': oneLight,
    'tomorrow': tomorrow,
    'twilight': twilight,

    // 流行编辑器主题
    'atom-dark': atomDark,
    'darcula': darcula,
    'nord': nord,
    'dracula': dark,
    'monokai': okaidia,
    'lucario': lucario,

    // Material 系列
    'material-dark': materialDark,
    'material-light': materialLight,
    'material-oceanic': materialOceanic,

    // Duotone 系列
    'duotone-dark': duotoneDark,
    'duotone-light': duotoneLight,
    'duotone-earth': duotoneEarth,
    'duotone-forest': duotoneForest,
    'duotone-sea': duotoneSea,
    'duotone-space': duotoneSpace,

    // 特色主题
    'synthwave-84': synthwave84,
    'shades-of-purple': shadesOfPurple,
    'hopscotch': hopscotch,
    'coldark-cold': coldarkCold,
    'coldark-dark': coldarkDark,
    'solarized-light': solarizedlight,
    'base16-light': base16AteliersulphurpoolLight,
    'coy': coy,
    'cb': cb,
    'pojoaque': pojoaque,
    'xonokai': xonokai,
    'z-touch': zTouch,

    // 兼容旧版本
    'vscDarkPlus': vscDarkPlus,
    'vs': vs,
    'solarizedlight': solarizedlight,
    'solarizeddark': oneDark,
    'material-theme': isDarkMode ? materialDark : materialLight
  };

  return themeMap[codeStyle] || (isDarkMode ? vscDarkPlus : vs);
};

/**
 * 增强版代码块组件
 * 支持预览/编辑模式切换，工具栏，语法高亮等功能
 */
const EnhancedCodeBlock: React.FC<EnhancedCodeBlockProps> = ({ block, onSave }) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  
  // 从 Redux store 获取设置
  const {
    codeEditor,
    codeShowLineNumbers,
    codeCollapsible,
    codeWrappable,
    codeStyle,
    codeDefaultCollapsed
  } = useAppSelector(state => state.settings);

  // 处理尾部空白字符，参考实现
  const safeCodeContent = useMemo(() => {
    return typeof block.content === 'string' ? block.content.trimEnd() : ''
  }, [block.content]);

  // 本地状态
  const [viewMode, setViewMode] = useState<ViewMode>('preview');
  const [isCollapsed, setIsCollapsed] = useState(codeDefaultCollapsed);
  const [isWrapped, setIsWrapped] = useState(codeWrappable);
  const [copySuccess, setCopySuccess] = useState(false);
  const [editContent, setEditContent] = useState(safeCodeContent);
  const [isFullExpanded, setIsFullExpanded] = useState(false);

  // 复制代码
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(safeCodeContent)
      .then(() => {
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      })
      .catch(err => {
        console.error('复制失败:', err);
      });
  }, [safeCodeContent]);

  // 下载代码
  const handleDownload = useCallback(() => {
    const fileName = `code-${Date.now()}.${block.language || 'txt'}`;
    const blob = new Blob([safeCodeContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [safeCodeContent, block.language]);

  // 切换视图模式（预览 -> 编辑 -> HTML预览 -> 预览）
  const toggleViewMode = useCallback(() => {
    if (viewMode === 'preview') {
      setViewMode('edit');
      setEditContent(safeCodeContent);
    } else if (viewMode === 'edit') {
      // 如果是HTML代码，切换到HTML预览模式
      if (block.language === 'html' || block.language === 'htm') {
        setViewMode('html');
      } else {
        setViewMode('preview');
      }
    } else {
      setViewMode('preview');
    }
  }, [viewMode, safeCodeContent, block.language]);

  // 保存编辑内容
  const handleSave = useCallback(() => {
    if (onSave && editContent !== safeCodeContent) {
      onSave(block.id, editContent);
    }
    setViewMode('preview');
  }, [onSave, editContent, safeCodeContent, block.id]);

  // 切换折叠状态
  const toggleCollapse = useCallback(() => {
    setIsCollapsed(prev => !prev);
  }, []);

  // 切换换行状态
  const toggleWrap = useCallback(() => {
    setIsWrapped(prev => !prev);
  }, []);

  // 获取语言显示名称
  const getLanguageDisplayName = (language?: string) => {
    if (!language) return 'TEXT';
    return language.toUpperCase();
  };

  // 判断是否需要显示折叠按钮 - 始终显示（如果启用了折叠功能）
  const shouldShowCollapseButton = useMemo(() => {
    return codeCollapsible; // 只要启用了折叠功能就显示按钮，不管行数
  }, [codeCollapsible]);

  // 获取语法高亮主题
  const highlightTheme = useMemo(() => {
    return getHighlightTheme(codeStyle, isDarkMode);
  }, [codeStyle, isDarkMode]);

  // 工具栏按钮
  const toolbarButtons = useMemo(() => {
    const buttons = [];

    // 复制按钮
    buttons.push(
      <Tooltip key="copy" title="复制代码">
        <IconButton size="small" onClick={handleCopy}>
          <Copy size={16} />
        </IconButton>
      </Tooltip>
    );

    // 下载按钮
    buttons.push(
      <Tooltip key="download" title="下载代码">
        <IconButton size="small" onClick={handleDownload}>
          <Download size={16} />
        </IconButton>
      </Tooltip>
    );

    // 编辑/预览切换按钮（仅在启用编辑器时显示）
    if (codeEditor) {
      // 对于HTML代码，只在编辑模式或预览模式时显示编辑按钮
      // HTML预览模式由单独的HTML预览按钮处理
      const isHtmlCode = block.language === 'html' || block.language === 'htm';

      if (!isHtmlCode || viewMode !== 'html') {
        const getViewModeTitle = () => {
          if (viewMode === 'preview') return '编辑代码';
          if (viewMode === 'edit') return isHtmlCode ? 'HTML预览' : '预览代码';
          return '预览代码';
        };

        const getViewModeIcon = () => {
          if (viewMode === 'preview') return <Edit size={16} />;
          if (viewMode === 'edit') return isHtmlCode ? <Globe size={16} /> : <Eye size={16} />;
          return <Eye size={16} />;
        };

        buttons.push(
          <Tooltip key="edit" title={getViewModeTitle()}>
            <IconButton size="small" onClick={toggleViewMode}>
              {getViewModeIcon()}
            </IconButton>
          </Tooltip>
        );
      }
    }

    // HTML相关按钮（仅对HTML代码显示）
    if (block.language === 'html' || block.language === 'htm') {
      // HTML预览/代码预览切换按钮（不在编辑模式时显示）
      if (viewMode !== 'edit') {
        buttons.push(
          <Tooltip key="html-preview" title={viewMode === 'html' ? '代码预览' : 'HTML预览'}>
            <IconButton size="small" onClick={() => setViewMode(viewMode === 'html' ? 'preview' : 'html')}>
              {viewMode === 'html' ? <Eye size={16} /> : <Globe size={16} />}
            </IconButton>
          </Tooltip>
        );
      }

      // 全展开按钮（仅在HTML预览模式显示）
      if (viewMode === 'html') {
        buttons.push(
          <Tooltip key="full-expand" title={isFullExpanded ? '恢复正常大小' : '全屏展开'}>
            <IconButton size="small" onClick={() => setIsFullExpanded(!isFullExpanded)}>
              {isFullExpanded ? <Minimize size={16} /> : <Maximize size={16} />}
            </IconButton>
          </Tooltip>
        );
      }
    }

    // 换行切换按钮（仅在启用换行时显示）
    if (codeWrappable) {
      buttons.push(
        <Tooltip key="wrap" title={isWrapped ? '取消换行' : '启用换行'}>
          <IconButton size="small" onClick={toggleWrap}>
            {isWrapped ? <Type size={16} /> : <WrapText size={16} />}
          </IconButton>
        </Tooltip>
      );
    }

    // 折叠按钮（仅在需要时显示）
    if (shouldShowCollapseButton) {
      buttons.push(
        <Tooltip key="collapse" title={isCollapsed ? '展开代码' : '折叠代码'}>
          <IconButton size="small" onClick={toggleCollapse}>
            {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </IconButton>
        </Tooltip>
      );
    }

    return buttons;
  }, [
    handleCopy, 
    handleDownload, 
    codeEditor, 
    viewMode, 
    toggleViewMode, 
    codeWrappable, 
    isWrapped, 
    toggleWrap, 
    shouldShowCollapseButton, 
    isCollapsed, 
    toggleCollapse
  ]);

  return (
    <Box
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: 2,
        overflow: 'hidden',
        // 移除背景色，让 SyntaxHighlighter 的主题背景色生效
        position: 'relative',
        // 桌面端hover显示工具栏
        '@media (hover: hover)': {
          '&:hover .code-toolbar': {
            opacity: 1
          }
        },
        // 移动端始终显示工具栏
        '@media (hover: none)': {
          '& .code-toolbar': {
            opacity: 1
          }
        }
      }}
    >
      {/* 头部：语言标签和工具栏 */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1,
          backgroundColor: isDarkMode ? 'grey.800' : 'grey.100',
          borderBottom: 1,
          borderColor: 'divider'
        }}
      >
        <Chip
          label={getLanguageDisplayName(block.language)}
          size="small"
          variant="outlined"
          sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}
        />
        
        <Box 
          className="code-toolbar"
          sx={{ 
            display: 'flex', 
            gap: 0.5,
            opacity: 0,
            transition: 'opacity 0.2s ease'
          }}
        >
          {toolbarButtons}
        </Box>
      </Box>

      {/* 代码内容区域 - 根据视图模式显示不同内容 */}
      <Collapse in={!isCollapsed} timeout="auto">
        {viewMode === 'html' ? (
          // HTML 预览模式
          isFullExpanded ? (
            // 全屏模式 - 覆盖整个屏幕
            <Box
              sx={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 9999,
                backgroundColor: isDarkMode ? '#0f172a' : '#ffffff',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              {/* 全屏模式的标题栏 */}
              <Box
                sx={{
                  backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc',
                  padding: '8px 16px',
                  borderBottom: `1px solid ${isDarkMode ? '#3d4852' : '#e2e8f0'}`,
                  fontSize: '0.75rem',
                  color: isDarkMode ? '#94a3b8' : '#64748b',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <span>HTML 预览 (全屏模式)</span>
                <IconButton
                  size="small"
                  onClick={() => setIsFullExpanded(false)}
                  sx={{ color: isDarkMode ? '#94a3b8' : '#64748b' }}
                >
                  <X size={16} />
                </IconButton>
              </Box>
              {/* 全屏模式的内容区域 */}
              <Box sx={{ flex: 1, overflow: 'hidden' }}>
                <iframe
                  srcDoc={safeCodeContent}
                  style={{
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    backgroundColor: 'white'
                  }}
                  sandbox="allow-scripts allow-same-origin"
                  title="HTML Preview"
                />
              </Box>
            </Box>
          ) : (
            // 普通HTML预览模式 - 直接显示iframe，不添加额外的边框和标题
            <Box
              sx={{
                backgroundColor: isDarkMode ? '#0f172a' : '#ffffff',
                overflow: 'auto',
                maxHeight: codeCollapsible && !isCollapsed ? '600px' : 'none'
              }}
            >
              <iframe
                srcDoc={safeCodeContent}
                style={{
                  width: '100%',
                  minHeight: '400px',
                  height: '500px',
                  border: 'none',
                  backgroundColor: 'white'
                }}
                sandbox="allow-scripts allow-same-origin"
                title="HTML Preview"
              />
            </Box>
          )
        ) : (
          // 代码预览/编辑模式
          <SyntaxHighlighter
            language={block.language || 'text'}
            style={highlightTheme}
            showLineNumbers={codeShowLineNumbers}
            wrapLines={isWrapped}
            wrapLongLines={isWrapped}
            customStyle={{
              margin: 0,
              padding: '1rem',
              fontSize: '0.875rem',
              lineHeight: 1.5,
              border: 'none',
              borderRadius: 0,
              overflow: 'auto',
              maxHeight: codeCollapsible && !isCollapsed ? '400px' : 'none',
              minWidth: '100%'
            }}
            codeTagProps={{
              style: {
                fontFamily: 'Monaco, Menlo, "Ubuntu Mono", Consolas, source-code-pro, monospace',
                display: 'block',
                // 编辑模式下让代码可编辑
                ...(viewMode === 'edit' && {
                  outline: 'none',
                  whiteSpace: 'pre-wrap',
                  wordWrap: 'break-word'
                })
              },
              // 编辑模式下添加可编辑属性
              ...(viewMode === 'edit' && {
                contentEditable: true,
                suppressContentEditableWarning: true,
                onInput: (e: any) => {
                  const newContent = e.target.textContent || '';
                  // 只有当内容真正改变时才更新
                  if (newContent !== editContent) {
                    setEditContent(newContent);
                  }
                }
              })
            }}
            lineNumberStyle={{
              minWidth: '2.5em',
              paddingRight: '1em',
              textAlign: 'right',
              opacity: 0.5,
              userSelect: 'none'
            }}
          >
            {viewMode === 'edit' ? editContent : safeCodeContent}
          </SyntaxHighlighter>
        )}

        {/* 编辑模式的操作按钮 */}
        {viewMode === 'edit' && (
          <Box sx={{
            p: 1,
            display: 'flex',
            gap: 1,
            justifyContent: 'flex-end',
            borderTop: 1,
            borderColor: 'divider'
          }}>
            <Tooltip title="保存更改">
              <IconButton
                size="small"
                onClick={handleSave}
                color="primary"
                sx={{
                  backgroundColor: 'primary.main',
                  color: 'white',
                  '&:hover': {
                    backgroundColor: 'primary.dark'
                  }
                }}
              >
                <Save size={16} />
              </IconButton>
            </Tooltip>
            <Tooltip title="取消编辑">
              <IconButton
                size="small"
                onClick={() => {
                  setEditContent(safeCodeContent);
                  setViewMode('preview');
                }}
                sx={{
                  backgroundColor: 'grey.300',
                  color: 'grey.700',
                  '&:hover': {
                    backgroundColor: 'grey.400'
                  }
                }}
              >
                <X size={16} />
              </IconButton>
            </Tooltip>
          </Box>
        )}
      </Collapse>

      <Snackbar
        open={copySuccess}
        autoHideDuration={2000}
        message="代码已复制到剪贴板"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
};

export default React.memo(EnhancedCodeBlock);
