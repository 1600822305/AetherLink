import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Box, Typography, IconButton, Button, useTheme, Snackbar, useMediaQuery, ButtonGroup } from '@mui/material';
import { X, Save, Copy, RotateCcw } from 'lucide-react';
import CodeMirror from '@uiw/react-codemirror';
import type { ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { EditorView, keymap } from '@codemirror/view';
import { oneDark } from '@codemirror/theme-one-dark';
import { vscodeLight, vscodeDark } from '@uiw/codemirror-theme-vscode';
import { githubLight, githubDark } from '@uiw/codemirror-theme-github';
import { tokyoNight } from '@uiw/codemirror-theme-tokyo-night';
import { dracula } from '@uiw/codemirror-theme-dracula';
import { nord } from '@uiw/codemirror-theme-nord';
import { materialLight, materialDark } from '@uiw/codemirror-theme-material';
import { solarizedLight, solarizedDark } from '@uiw/codemirror-theme-solarized';
import { monokai } from '@uiw/codemirror-theme-monokai';
import BackButtonDialog from '../common/BackButtonDialog';
import { useDialogBackHandler } from '../../hooks/useDialogBackHandler';
import { useKeyboard } from '../../shared/hooks/useKeyboard';
import { useAppSelector, useAppDispatch } from '../../shared/store';
import { setEditorZoomLevel } from '../../shared/store/settingsSlice';
import { createLogger } from '../../shared/services/infra/logger';

const logger = createLogger('CodeEditorDrawer');

// 语言支持 - 按需导入
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { sql } from '@codemirror/lang-sql';
import { xml } from '@codemirror/lang-xml';
import { java } from '@codemirror/lang-java';
import { cpp } from '@codemirror/lang-cpp';
import { php } from '@codemirror/lang-php';
import { rust } from '@codemirror/lang-rust';
import { go } from '@codemirror/lang-go';

// ============ 类型定义 ============
interface CodeEditorDrawerProps {
  open: boolean;
  onClose: () => void;
  initialContent: string;
  language: string;
  onSave?: (newContent: string) => void;
  title?: string;
  readOnly?: boolean;
}

// ============ 语言映射（组件外部常量） ============
const LANGUAGE_MAP: Record<string, () => any> = {
  javascript: () => javascript(),
  js: () => javascript(),
  typescript: () => javascript({ typescript: true }),
  ts: () => javascript({ typescript: true }),
  jsx: () => javascript({ jsx: true }),
  tsx: () => javascript({ jsx: true, typescript: true }),
  python: () => python(),
  py: () => python(),
  html: () => html(),
  css: () => css(),
  scss: () => css(),
  less: () => css(),
  json: () => json(),
  markdown: () => markdown(),
  md: () => markdown(),
  sql: () => sql(),
  xml: () => xml(),
  java: () => java(),
  cpp: () => cpp(),
  c: () => cpp(),
  'c++': () => cpp(),
  php: () => php(),
  rust: () => rust(),
  rs: () => rust(),
  go: () => go(),
  golang: () => go(),
};

// ============ 工具函数 ============
const getLanguageExtension = (lang: string) => {
  const normalizedLang = lang.toLowerCase().trim();
  const factory = LANGUAGE_MAP[normalizedLang];
  return factory ? factory() : null;
};

// ============ 组件 ============
const CodeEditorDrawer: React.FC<CodeEditorDrawerProps> = ({
  open,
  onClose,
  initialContent,
  language,
  onSave,
  title,
  readOnly = false,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  // 从 Redux store 获取代码主题设置
  const { editorTheme, editorZoomLevel } = useAppSelector(state => state.settings);
  const dispatch = useAppDispatch();
  
  // 添加fallback值防止undefined和NaN
  const safeEditorTheme = editorTheme || 'oneDark';
  const zoomLevel = editorZoomLevel || 1.0;
  
  // 键盘适配 - 在移动端锁定键盘，避免其他组件响应
  useKeyboard({ lock: isMobile && open });

  // 状态
  const [content, setContent] = useState(initialContent);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string }>({
    open: false,
    message: '',
  });

  // Refs
  const editorRef = useRef<ReactCodeMirrorRef>(null);
  const saveCallbackRef = useRef(onSave);
  const contentRef = useRef(content);
  const initialContentRef = useRef(initialContent);
  const prevOpenRef = useRef(false);

  const DIALOG_ID = 'code-editor-dialog';

  // 使用对话框返回键处理Hook
  const { handleClose } = useDialogBackHandler(DIALOG_ID, open, onClose);

  // 保持 refs 最新
  useEffect(() => {
    saveCallbackRef.current = onSave;
  }, [onSave]);

  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  useEffect(() => {
    initialContentRef.current = initialContent;
  }, [initialContent]);

  // 只在对话框打开瞬间重置内容，避免 initialContent 变化时丢失用户编辑
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setContent(initialContent);
    }
    prevOpenRef.current = open;
  }, [open, initialContent]);

  // 计算是否有修改
  const hasChanges = content !== initialContent;

  // 行数统计
  const lineCount = useMemo(() => content.split('\n').length, [content]);

  // 统一的保存逻辑
  const doSave = useCallback(() => {
    if (readOnly) return;
    if (saveCallbackRef.current && contentRef.current !== initialContentRef.current) {
      saveCallbackRef.current(contentRef.current);
      setSnackbar({ open: true, message: '保存成功' });
      // 延迟关闭确保用户看到成功提示
      setTimeout(() => {
        handleClose();
      }, 300);
    }
  }, [readOnly, handleClose]);

  // 复制处理
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      setSnackbar({ open: true, message: '已复制到剪贴板' });
    } catch (err) {
      setSnackbar({ open: true, message: '复制失败' });
    }
  }, [content]);

  // 重置处理
  const handleReset = useCallback(() => {
    setContent(initialContent);
    setSnackbar({ open: true, message: '已重置' });
  }, [initialContent]);

  // 关闭处理（带确认）
  const handleCloseWithConfirm = useCallback(() => {
    if (hasChanges) {
      const confirmed = window.confirm('有未保存的修改，确定要关闭吗？');
      if (!confirmed) return;
    }
    handleClose();
  }, [hasChanges, handleClose]);

  // CodeMirror 扩展（缓存）- 只包含语言和布局，不包含主题
  const extensions = useMemo(() => {
    const exts: any[] = [];

    // 1. 语言支持
    const langExt = getLanguageExtension(language);
    if (langExt) {
      exts.push(langExt);
    }

    // 2. 只在非只读模式添加保存快捷键和缩放快捷键
    if (!readOnly) {
      exts.push(
        keymap.of([
          {
            key: 'Mod-s',
            run: () => {
              document.dispatchEvent(new CustomEvent('code-editor-save'));
              return true;
            },
            preventDefault: true,
          },
          // 缩放快捷键
          {
            key: 'Mod-+',
            run: () => {
              const newZoom = Math.min(zoomLevel + 0.1, 1.5);
              dispatch(setEditorZoomLevel(newZoom));
              setSnackbar({ open: true, message: `缩放: ${Math.round(newZoom * 100)}%` });
              return true;
            },
            preventDefault: true,
          },
          {
            key: 'Mod-=',
            run: () => {
              const newZoom = Math.min(zoomLevel + 0.1, 1.5);
              dispatch(setEditorZoomLevel(newZoom));
              setSnackbar({ open: true, message: `缩放: ${Math.round(newZoom * 100)}%` });
              return true;
            },
            preventDefault: true,
          },
          {
            key: 'Mod--',
            run: () => {
              const newZoom = Math.max(zoomLevel - 0.1, 0.6);
              dispatch(setEditorZoomLevel(newZoom));
              setSnackbar({ open: true, message: `缩放: ${Math.round(newZoom * 100)}%` });
              return true;
            },
            preventDefault: true,
          },
          {
            key: 'Mod-0',
            run: () => {
              dispatch(setEditorZoomLevel(1.0));
              setSnackbar({ open: true, message: '缩放: 100%' });
              return true;
            },
            preventDefault: true,
          },
        ])
      );
    }

    // 3. 编辑器布局样式 - 匹配外部预览样式并支持缩放
    exts.push(
      EditorView.theme({
        '.cm-scroller': {
          fontFamily: '"Fira Code", "JetBrains Mono", Consolas, Monaco, monospace',
          fontSize: `${13 * zoomLevel}px`,
          overflow: 'auto',
          lineHeight: 1.5,
          minHeight: '100%',
        },
        '.cm-content': {
          minHeight: '100%',
          padding: `${12 * zoomLevel}px ${16 * zoomLevel}px`,
        },
        '.cm-gutters': {
          minHeight: '100%',
          fontSize: `${13 * zoomLevel}px`,
        },
        '.cm-line': {
          minHeight: `${1.5 * zoomLevel}em`,
        }
      })
    );

    return exts;
  }, [language, isMobile, readOnly, zoomLevel, dispatch]);

  // 编辑器主题 - 直接从Redux获取，无需复杂映射
  const codeMirrorTheme = useMemo(() => {
    logger.debug('🎨 Editor Theme:', safeEditorTheme);
    
    // 直接返回对应的CodeMirror主题
    switch (safeEditorTheme) {
      case 'oneDark':
        return oneDark;
      case 'githubLight':
        return githubLight;
      case 'githubDark':
        return githubDark;
      case 'vscodeLight':
        return vscodeLight;
      case 'vscodeDark':
        return vscodeDark;
      case 'tokyoNight':
        return tokyoNight;
      case 'dracula':
        return dracula;
      case 'nord':
        return nord;
      case 'materialLight':
        return materialLight;
      case 'materialDark':
        return materialDark;
      case 'solarizedLight':
        return solarizedLight;
      case 'solarizedDark':
        return solarizedDark;
      case 'monokai':
        return monokai;
      default:
        logger.debug('→ Using oneDark (fallback)');
        return oneDark;
    }
  }, [safeEditorTheme]);

  // 优化的事件监听器 - 只依赖doSave，避免频繁重建
  useEffect(() => {
    const handleSaveEvent = () => doSave();
    document.addEventListener('code-editor-save', handleSaveEvent);
    return () => {
      document.removeEventListener('code-editor-save', handleSaveEvent);
    };
  }, [doSave]);

  return (
    <>
      <BackButtonDialog
        open={open}
        onClose={handleCloseWithConfirm}
        maxWidth={isMobile ? false : "lg"}
        fullWidth={isMobile ? true : false}
        fullScreen={isMobile}
        PaperProps={{
          sx: {
            borderRadius: 2,
            backdropFilter: 'blur(10px)',
            border: theme.palette.mode === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)',
            // flex布局确保子元素填满
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            // 移动端全屏适配
            ...(isMobile && {
              margin: 0,
              maxHeight: '100vh',
              height: '100vh',
            }),
            // 桌面端固定高度
            ...(!isMobile && {
              height: '80vh',
              maxHeight: '800px',
            })
          }
        }}
      >
        {/* 头部 */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2,
            py: 1.5,
            borderBottom: 1,
            borderColor: 'divider',
            flexShrink: 0,
            // 移动端适配顶部安全区域
            ...(isMobile && {
              paddingTop: 'calc(16px + var(--safe-area-top, 0px))',
              minHeight: '64px'
            })
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant={isMobile ? "h6" : "subtitle1"} fontWeight="medium">
              {title || `编辑 ${language.toUpperCase()}`}
            </Typography>
            {hasChanges && (
              <Typography
                variant="caption"
                sx={{
                  px: 1,
                  py: 0.25,
                  borderRadius: 1,
                  bgcolor: 'warning.main',
                  color: 'warning.contrastText',
                }}
              >
                已修改
              </Typography>
            )}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {hasChanges && (
              <IconButton size="small" onClick={handleReset} title="重置">
                <RotateCcw size={18} />
              </IconButton>
            )}
            
            <IconButton size="small" onClick={handleCopy} title="复制">
              <Copy size={18} />
            </IconButton>

            {!readOnly && (
              <Button
                size="small"
                variant="contained"
                startIcon={<Save size={16} />}
                onClick={doSave}
                disabled={!hasChanges}
                sx={{ ml: 1 }}
              >
                保存
              </Button>
            )}

            <IconButton size="small" onClick={handleCloseWithConfirm} sx={{ ml: 0.5 }}>
              <X size={20} />
            </IconButton>
          </Box>
        </Box>

        {/* 编辑器 */}
        <Box sx={{ 
          flex: 1, 
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0, // 重要：允许flex子元素收缩
          bgcolor: 'transparent', // 透明背景，让CodeMirror主题显示
          ...(isMobile && {
            px: 2
          })
        }}>
          <CodeMirror
            ref={editorRef}
            value={content}
            onChange={setContent}
            height="100%"
            style={{ 
              flex: 1, 
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
            }}
            theme={codeMirrorTheme}
            extensions={extensions}
            readOnly={readOnly}
            autoFocus={!isMobile}
            basicSetup={{
              lineNumbers: true,
              highlightActiveLineGutter: true,
              highlightActiveLine: true,
              foldGutter: true,
              dropCursor: true,
              allowMultipleSelections: true,
              indentOnInput: true,
              syntaxHighlighting: true,
              bracketMatching: true,
              closeBrackets: true,
              autocompletion: true,
              rectangularSelection: true,
              crosshairCursor: false,
              highlightSelectionMatches: true,
              searchKeymap: true,
            }}
          />
        </Box>

        {/* 底部状态栏 */}
        <Box
          sx={{
            px: 2,
            py: 0.75,
            borderTop: 1,
            borderColor: 'divider',
            bgcolor: 'action.hover',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0,
            // 移动端按钮区域适配
          ...(isMobile && {
            minHeight: '72px',
            paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))'
          })  
          }}
        >
          <Typography variant="caption" color="text.secondary">
            {language.toUpperCase()} • {lineCount} 行
          </Typography>
          
          {/* 缩放控制按钮组 */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ButtonGroup variant="outlined" size="small">
              <Button 
                onClick={() => {
                  const newZoom = Math.max(zoomLevel - 0.1, 0.6);
                  dispatch(setEditorZoomLevel(newZoom));
                  setSnackbar({ open: true, message: `缩放: ${Math.round(newZoom * 100)}%` });
                }}
                sx={{ minWidth: '32px', px: 1 }}
              >
                -
              </Button>
              <Button 
                disabled 
                sx={{ 
                  minWidth: '48px',
                  bgcolor: 'action.selected',
                  color: 'text.primary',
                  fontWeight: 'medium',
                  fontSize: '0.75rem'
                }}
              >
                {Math.round(zoomLevel * 100)}%
              </Button>
              <Button 
                onClick={() => {
                  const newZoom = Math.min(zoomLevel + 0.1, 1.5);
                  dispatch(setEditorZoomLevel(newZoom));
                  setSnackbar({ open: true, message: `缩放: ${Math.round(newZoom * 100)}%` });
                }}
                sx={{ minWidth: '32px', px: 1 }}
              >
                +
              </Button>
              <Button 
                onClick={() => {
                  dispatch(setEditorZoomLevel(1.0));
                  setSnackbar({ open: true, message: '缩放: 100%' });
                }}
                sx={{ minWidth: '48px', fontSize: '0.75rem' }}
              >
                重置
              </Button>
            </ButtonGroup>
            
            <Typography variant="caption" color="text.secondary">
              {!isMobile ? 'Ctrl+S 保存' : '⌘+S 保存'}
            </Typography>
          </Box>
        </Box>
      </BackButtonDialog>

      {/* 提示消息 */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={2000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        message={snackbar.message}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      />
    </>
  );
};

export default CodeEditorDrawer;
