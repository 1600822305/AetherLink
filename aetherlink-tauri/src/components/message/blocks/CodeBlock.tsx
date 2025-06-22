import React, { useState, useCallback, useMemo } from 'react';
import { Box, IconButton, Tooltip, Snackbar, useTheme, Chip } from '@mui/material';
import { Copy as ContentCopyIcon, ChevronDown as ExpandMoreIcon, ChevronUp as ExpandLessIcon, Code as CodeIcon } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import {
  vscDarkPlus,
  vs,
  ghcolors,
  dark,
  oneDark,
  oneLight,
  tomorrow,
  twilight,
  atomDark,
  darcula,
  nord,
  okaidia,
  lucario,
  materialDark,
  materialLight,
  materialOceanic,
  duotoneDark,
  duotoneLight,
  duotoneEarth,
  duotoneForest,
  duotoneSea,
  duotoneSpace,
  synthwave84,
  shadesOfPurple,
  hopscotch,
  coldarkCold,
  coldarkDark,
  solarizedlight,
  base16AteliersulphurpoolLight,
  coy,
  cb,
  pojoaque,
  xonokai,
  zTouch
} from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { CodeMessageBlock } from '../../../shared/types/newMessage';
import { useAppSelector } from '../../../shared/store';

interface CodeBlockProps {
  block: CodeMessageBlock;
}

// 主题映射函数 - 与 EnhancedCodeBlock 保持一致
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
 * 代码块组件
 * 按照信息块开发文档创建的新代码块组件
 */
const CodeBlock: React.FC<CodeBlockProps> = ({ block }) => {
  const [copySuccess, setCopySuccess] = useState(false);
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';

  // 从设置中获取默认收起状态和代码主题
  const { codeDefaultCollapsed, codeStyle } = useAppSelector(state => state.settings);
  const [isCollapsed, setIsCollapsed] = useState(codeDefaultCollapsed);

  // 选择语法高亮主题
  const highlightTheme = useMemo(() => {
    return getHighlightTheme(codeStyle, isDarkMode);
  }, [codeStyle, isDarkMode]);

  // 复制代码
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(block.content)
      .then(() => {
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      })
      .catch(err => {
        console.error('复制失败:', err);
      });
  }, [block.content]);

  // 切换折叠状态
  const toggleCollapse = useCallback(() => {
    setIsCollapsed(prev => !prev);
  }, []);

  // 获取语言显示名称
  const getLanguageDisplayName = (language?: string) => {
    if (!language) return 'TEXT';
    return language.toUpperCase();
  };

  // 处理尾部空白字符，参考实现
  const safeCodeContent = useMemo(() => {
    return typeof block.content === 'string' ? block.content.trimEnd() : ''
  }, [block.content]);

  return (
    <Box
      sx={{
        marginY: 1,
        borderRadius: 2,
        border: isDarkMode ? '1px solid #3d4852' : '1px solid #e2e8f0',
        // 移除背景色，让 SyntaxHighlighter 的主题背景色生效
        overflow: 'hidden',
        boxShadow: isDarkMode
          ? '0 1px 3px rgba(0, 0, 0, 0.3)'
          : '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}
    >
      {/* 代码块头部 */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 16px',
          backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc',
          borderBottom: isDarkMode ? '1px solid #3d4852' : '1px solid #e2e8f0'
        }}
      >
        {/* 语言标签 */}
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Chip
            label={getLanguageDisplayName(block.language)}
            size="small"
            sx={{
              backgroundColor: isDarkMode ? '#475569' : '#e2e8f0',
              color: isDarkMode ? '#e2e8f0' : '#475569',
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
            // 移除背景色，保持透明
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
              {getLanguageDisplayName(block.language)} 代码 ({safeCodeContent.split('\n').length} 行)
            </span>
          </Box>
          <ExpandMoreIcon size={16} color={isDarkMode ? '#888' : '#666'} />
        </Box>
      ) : (
        // 展开状态：显示完整代码（带语法高亮）- 移除中间层包装
        <SyntaxHighlighter
          language={block.language || 'text'}
          style={highlightTheme}
          customStyle={{
            margin: 0,
            padding: '1rem',
            fontSize: '14px',
            lineHeight: 1.5,
            // 移除 backgroundColor 设置，让 SyntaxHighlighter 使用主题的背景色
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
          {safeCodeContent}
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
};

export default React.memo(CodeBlock);
