import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  IconButton,
  Alert,
  Snackbar,
  Collapse,
  useTheme
} from '@mui/material';
import BackButtonDialog from '../common/BackButtonDialog';
import {
  X as CloseIcon,
  Save as SaveIcon,
  Info as InfoIcon
} from 'lucide-react';
import CodeMirror from '@uiw/react-codemirror';
import { oneDark } from '@codemirror/theme-one-dark';
import { loadLanguage } from '@uiw/codemirror-extensions-langs';
import { EditorView } from '@codemirror/view';

import { unifiedFileManager } from '../../shared/services/files/UnifiedFileManagerService';
import { formatFileSize, getFileType, getLanguage, isEditableFile } from './utils';
import type { DesktopFileViewerProps, WorkspaceFile, EditorSettings } from './types';
import { createLogger } from '../../shared/services/infra/logger';

const logger = createLogger('DesktopFileViewer');

// 简化的桌面缩放控制组件
const DesktopZoomControls: React.FC<{
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  canZoomIn: boolean;
  canZoomOut: boolean;
}> = ({ scale, onZoomIn, onZoomOut, onReset, canZoomIn, canZoomOut }) => (
  <Box sx={{
    display: 'flex',
    alignItems: 'center',
    gap: 1,
    padding: '4px 8px',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 1,
    border: '1px solid rgba(0, 0, 0, 0.1)'
  }}>
    <IconButton size="small" onClick={onZoomOut} disabled={!canZoomOut}>
      <Typography sx={{ fontSize: '16px' }}>-</Typography>
    </IconButton>
    <Typography variant="caption" sx={{ minWidth: '45px', textAlign: 'center' }}>
      {Math.round(scale * 100)}%
    </Typography>
    <IconButton size="small" onClick={onZoomIn} disabled={!canZoomIn}>
      <Typography sx={{ fontSize: '16px' }}>+</Typography>
    </IconButton>
    <IconButton size="small" onClick={onReset}>
      <Typography sx={{ fontSize: '12px' }}>重置</Typography>
    </IconButton>
  </Box>
);

// 简化的文件信息面板组件
const FileInfoPanel: React.FC<{ file: WorkspaceFile; compact?: boolean }> = ({ file, compact = false }) => {
  if (compact) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, padding: '4px 8px' }}>
        <Typography variant="body2" sx={{ fontWeight: 500 }}>{file.name}</Typography>
        <Typography variant="caption" color="text.secondary">
          {formatFileSize(file.size)}
        </Typography>
      </Box>
    );
  }
  return (
    <Box sx={{ padding: 2, backgroundColor: 'rgba(0, 0, 0, 0.02)', borderRadius: 1 }}>
      <Typography variant="h6" sx={{ fontWeight: 500, mb: 1 }}>{file.name}</Typography>
      <Typography variant="body2" color="text.secondary">
        大小: {formatFileSize(file.size)}
      </Typography>
      <Typography variant="caption" sx={{ fontFamily: 'monospace', display: 'block', mt: 1 }}>
        {file.path}
      </Typography>
    </Box>
  );
};

// 简化的桌面缩放 hook
const useDesktopZoom = (options: {
  minScale?: number;
  maxScale?: number;
  initialScale?: number;
  scaleStep?: number;
} = {}) => {
  const { minScale = 0.5, maxScale = 3.0, initialScale = 1.0, scaleStep = 0.25 } = options;
  const [scale, setScale] = useState(initialScale);

  const zoomIn = useCallback(() => {
    setScale(prev => Math.min(maxScale, prev + scaleStep));
  }, [maxScale, scaleStep]);

  const zoomOut = useCallback(() => {
    setScale(prev => Math.max(minScale, prev - scaleStep));
  }, [minScale, scaleStep]);

  const resetZoom = useCallback(() => {
    setScale(initialScale);
  }, [initialScale]);

  return {
    scale,
    zoomIn,
    zoomOut,
    resetZoom,
    setScale,
    canZoomIn: scale < maxScale,
    canZoomOut: scale > minScale
  };
};

export const DesktopFileViewer: React.FC<DesktopFileViewerProps> = ({
  open,
  file,
  onClose,
  onSave,
  customFileReader,
  width = '95vw',
  height = '90vh',
  maxWidth = 1600,
  maxHeight = '95vh'
}) => {
  const theme = useTheme();
  const [content, setContent] = useState<string>('');
  const [originalContent, setOriginalContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // 编辑器设置
  const [editorSettings, setEditorSettings] = useState<EditorSettings>({
    fontSize: 14,
    lineNumbers: true,
    wordWrap: false,
    theme: theme.palette.mode === 'dark' ? 'dark' : 'light',
    minimap: false,
    folding: true
  });

  // 缩放控制
  const {
    scale,
    zoomIn,
    zoomOut,
    resetZoom,
    canZoomIn,
    canZoomOut
  } = useDesktopZoom({
    minScale: 0.5,
    maxScale: 3.0,
    initialScale: 1.0,
    scaleStep: 0.25
  });

  const contentRef = useRef<HTMLDivElement>(null);

  // 获取语言扩展
  const getLanguageExtension = useCallback((fileName: string) => {
    try {
      const language = getLanguage(fileName);
      const extension = loadLanguage(language as any);
      return extension ? [extension] : [];
    } catch (error) {
      logger.warn('Failed to load language extension:', error);
      return [];
    }
  }, []);

  // 自定义亮色主题
  const lightTheme = useMemo(() => EditorView.theme({
    '&': {
      color: '#24292e',
      backgroundColor: '#ffffff'
    },
    '.cm-content': {
      caretColor: '#24292e'
    },
    '.cm-focused': {
      outline: '1px solid #0366d6'
    },
    '.cm-scroller': {
      fontFamily: 'Monaco, Menlo, "Ubuntu Mono", Consolas, source-code-pro, monospace'
    },
    '.cm-gutters': {
      backgroundColor: '#f6f8fa',
      color: '#6a737d',
      border: 'none'
    },
    '.cm-activeLineGutter': {
      backgroundColor: '#f1f8ff'
    },
    '.cm-activeLine': {
      backgroundColor: '#f1f8ff'
    },
    '.cm-selectionBackground': {
      backgroundColor: '#c8e1ff'
    },
    '.cm-searchMatch': {
      backgroundColor: '#ffdf5d'
    },
    '.cm-searchMatch.cm-searchMatch-selected': {
      backgroundColor: '#ff9632'
    }
  }, { dark: false }), []);

  // 检查是否有未保存的更改
  useEffect(() => {
    setHasChanges(content !== originalContent && originalContent !== '');
  }, [content, originalContent]);

  // 清理定时器
  useEffect(() => {
    if (saveSuccess) {
      const timer = setTimeout(() => setSaveSuccess(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [saveSuccess]);

  useEffect(() => {
    if (copySuccess) {
      const timer = setTimeout(() => setCopySuccess(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [copySuccess]);



  // 加载文件内容
  const loadFileContent = useCallback(async () => {
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const fileType = getFileType(file.name);

      if (fileType === 'text' || fileType === 'code') {
        // 使用自定义文件读取服务或默认服务
        const fileReader = customFileReader || unifiedFileManager;
        const result = await fileReader.readFile({
          path: file.path,
          encoding: 'utf8'
        });
        setContent(result.content);
        setOriginalContent(result.content);
      } else if (fileType === 'image') {
        setContent(`图片文件: ${file.name}\n大小: ${formatFileSize(file.size)}\n路径: ${file.path}`);
        setOriginalContent('');
      } else {
        setContent(`文件类型: ${file.extension || '未知'}\n大小: ${formatFileSize(file.size)}\n路径: ${file.path}\n\n此文件类型暂不支持预览，请使用系统应用打开。`);
        setOriginalContent('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载文件失败');
    } finally {
      setLoading(false);
    }
  }, [file, customFileReader]);

  // 当文件变化时加载内容
  useEffect(() => {
    if (open && file) {
      loadFileContent();
    } else {
      setContent('');
      setOriginalContent('');
      setHasChanges(false);
    }
  }, [open, file, loadFileContent]);

  // 保存文件
  const handleSave = useCallback(async () => {
    if (!onSave || !hasChanges) return;

    setSaving(true);
    try {
      await onSave(content);
      setOriginalContent(content);
      setSaveSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }, [onSave, content, hasChanges]);

  // 复制内容
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopySuccess(true);
    } catch (err) {
      setError('复制失败：' + (err instanceof Error ? err.message : '未知错误'));
    }
  }, [content]);

  // 编辑器设置更改
  const handleSettingsChange = useCallback((newSettings: Partial<EditorSettings>) => {
    setEditorSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

  // 关闭处理（带确认）
  const handleClose = useCallback(() => {
    if (hasChanges) {
      if (window.confirm('有未保存的更改，确定要关闭吗？')) {
        onClose();
      }
    } else {
      onClose();
    }
  }, [hasChanges, onClose]);

  // 快捷键支持
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + S 保存
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (onSave && hasChanges && !saving) {
          handleSave();
        }
      }
      // Ctrl/Cmd + = 放大
      else if ((e.ctrlKey || e.metaKey) && e.key === '=') {
        e.preventDefault();
        if (canZoomIn) zoomIn();
      }
      // Ctrl/Cmd + - 缩小
      else if ((e.ctrlKey || e.metaKey) && e.key === '-') {
        e.preventDefault();
        if (canZoomOut) zoomOut();
      }
      // ESC 关闭（当没有未保存更改时）
      else if (e.key === 'Escape' && !hasChanges) {
        handleClose();
      }
    };

    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [open, onSave, hasChanges, saving, handleSave, canZoomIn, canZoomOut, zoomIn, zoomOut, handleClose]);

  if (!file) return null;

  const fileType = getFileType(file.name);
  const isEditable = isEditableFile(file.name);

  return (
    <>
      <BackButtonDialog
        open={open}
        onClose={handleClose}
        maxWidth={false}
        fullWidth={false}
        slotProps={{
          paper: {
            sx: {
              width,
              height,
              maxWidth,
              maxHeight,
              margin: 1,
              display: 'flex',
              flexDirection: 'column',
              borderRadius: 2,
              overflow: 'hidden'
            }
          }
        }}
        // 桌面端特有的属性
        disableEscapeKeyDown={hasChanges} // 有未保存更改时禁用ESC关闭
        sx={{
          '& .MuiBackdrop-root': {
            backgroundColor: 'rgba(0, 0, 0, 0.8)'
          }
        }}
      >
        <DialogTitle sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pb: 1,
          borderBottom: '1px solid rgba(0, 0, 0, 0.1)'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 500 }}>
              {file.name}
            </Typography>
            {hasChanges && (
              <Typography variant="caption" color="warning.main" sx={{ fontWeight: 500 }}>
                • 未保存
              </Typography>
            )}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton
              size="small"
              onClick={() => setShowInfo(!showInfo)}
              color={showInfo ? 'primary' : 'default'}
            >
              <InfoIcon size={18} />
            </IconButton>
            <IconButton size="small" onClick={handleClose}>
              <CloseIcon size={18} />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent sx={{
          p: 0,
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          overflow: 'hidden',
          minHeight: 0 // 重要：允许flex子元素收缩
        }}>
          {/* 文件信息面板 */}
          <Collapse in={showInfo}>
            <Box sx={{ p: 2, borderBottom: '1px solid rgba(0, 0, 0, 0.1)' }}>
              <FileInfoPanel file={file} />
            </Box>
          </Collapse>

          {/* 编辑器工具栏 */}
          {isEditable && (
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              padding: '8px 16px',
              borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
              backgroundColor: 'rgba(0, 0, 0, 0.02)'
            }}>
              {onSave && (
                <Button
                  size="small"
                  variant="contained"
                  onClick={handleSave}
                  disabled={!hasChanges || saving}
                  startIcon={<SaveIcon size={16} />}
                >
                  {saving ? '保存中...' : '保存'}
                </Button>
              )}
              <Button size="small" onClick={handleCopy} startIcon={<Typography>📋</Typography>}>
                复制
              </Button>
              <Box sx={{ marginLeft: 'auto', display: 'flex', gap: 1 }}>
                <Button
                  size="small"
                  onClick={() => handleSettingsChange({ wordWrap: !editorSettings.wordWrap })}
                  variant={editorSettings.wordWrap ? 'contained' : 'outlined'}
                >
                  自动换行
                </Button>
                <Button
                  size="small"
                  onClick={() => handleSettingsChange({ lineNumbers: !editorSettings.lineNumbers })}
                  variant={editorSettings.lineNumbers ? 'contained' : 'outlined'}
                >
                  行号
                </Button>
                <Button
                  size="small"
                  onClick={() => handleSettingsChange({ theme: editorSettings.theme === 'dark' ? 'light' : 'dark' })}
                  variant="outlined"
                >
                  {editorSettings.theme === 'dark' ? '亮色' : '暗色'}
                </Button>
              </Box>
            </Box>
          )}

          {/* 缩放控制 */}
          <Box sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '8px 16px',
            borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
            backgroundColor: 'rgba(0, 0, 0, 0.01)'
          }}>
            <FileInfoPanel file={file} compact />
            <DesktopZoomControls
              scale={scale}
              onZoomIn={zoomIn}
              onZoomOut={zoomOut}
              onReset={resetZoom}
              canZoomIn={canZoomIn}
              canZoomOut={canZoomOut}
            />
          </Box>

          {/* 内容区域 */}
          <Box
            ref={contentRef}
            sx={{
              flex: 1,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: editorSettings.theme === 'dark' ? '#1e1e1e' : '#ffffff',
              minHeight: 0 // 重要：允许flex子元素收缩
            }}
          >
            {loading ? (
              <Box sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                flex: 1,
                p: 4
              }}>
                <Typography>加载中...</Typography>
              </Box>
            ) : error ? (
              <Box sx={{ p: 2 }}>
                <Alert severity="error">{error}</Alert>
              </Box>
            ) : (
              <>
                {fileType === 'image' ? (
                  <Box sx={{
                    textAlign: 'center',
                    p: 2,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    flex: 1
                  }}>
                    <img
                      src={`file://${file.path}`}
                      alt={file.name}
                      style={{
                        maxWidth: '100%',
                        maxHeight: '100%',
                        objectFit: 'contain',
                        transform: `scale(${scale})`,
                        transformOrigin: 'center',
                        transition: 'transform 0.2s ease-out'
                      }}
                      onError={() => setError('无法加载图片')}
                    />
                  </Box>
                ) : (fileType === 'text' || fileType === 'code') && isEditable ? (
                  <Box sx={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: 0,
                    overflow: 'hidden',
                    '& .cm-editor': {
                      height: '100% !important',
                      flex: 1,
                      fontSize: `${editorSettings.fontSize * scale}px !important`,
                      minHeight: 0
                    },
                    '& .cm-scroller': {
                      height: '100% !important',
                      flex: 1,
                      minHeight: 0
                    },
                    '& .cm-content': {
                      minHeight: '100% !important'
                    },
                    '& .cm-focused': {
                      outline: 'none !important'
                    }
                  }}>
                    <CodeMirror
                      value={content}
                      onChange={(value) => setContent(value)}
                      theme={editorSettings.theme === 'dark' ? oneDark : lightTheme}
                      extensions={[
                        ...getLanguageExtension(file.name),
                        ...(editorSettings.wordWrap ? [EditorView.lineWrapping] : [])
                      ]}
                      basicSetup={{
                        lineNumbers: editorSettings.lineNumbers,
                        foldGutter: editorSettings.folding,
                        dropCursor: false,
                        allowMultipleSelections: true,
                        indentOnInput: true,
                        bracketMatching: true,
                        closeBrackets: true,
                        autocompletion: true,
                        highlightSelectionMatches: true,
                        searchKeymap: true,
                        syntaxHighlighting: true
                      }}
                      style={{
                        height: '100%',
                        fontSize: `${editorSettings.fontSize * scale}px`
                      }}
                    />
                  </Box>
                ) : (
                  <Box sx={{ p: 2, flex: 1 }}>
                    <Typography
                      component="pre"
                      sx={{
                        fontFamily: 'monospace',
                        fontSize: `${editorSettings.fontSize * scale}px`,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        lineHeight: 1.5,
                        color: editorSettings.theme === 'dark' ? '#cccccc' : '#333333',
                        backgroundColor: 'transparent',
                        margin: 0
                      }}
                    >
                      {content}
                    </Typography>
                  </Box>
                )}
              </>
            )}
          </Box>
        </DialogContent>

        <DialogActions sx={{
          justifyContent: 'space-between',
          px: 3,
          py: 2,
          borderTop: '1px solid rgba(0, 0, 0, 0.1)'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {hasChanges && (
              <Typography variant="caption" color="warning.main">
                有未保存的更改
              </Typography>
            )}
          </Box>

          <Box sx={{ display: 'flex', gap: 1 }}>
            {onSave && hasChanges && (
              <Button
                variant="contained"
                startIcon={<SaveIcon size={16} />}
                onClick={handleSave}
                disabled={saving}
                color="primary"
              >
                {saving ? '保存中...' : '保存'}
              </Button>
            )}
            <Button onClick={handleClose} variant="outlined">
              {hasChanges ? '取消' : '关闭'}
            </Button>
          </Box>
        </DialogActions>
      </BackButtonDialog>

      {/* 保存成功提示 */}
      <Snackbar
        open={saveSuccess}
        autoHideDuration={3000}
        onClose={() => setSaveSuccess(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity="success" onClose={() => setSaveSuccess(false)}>
          文件保存成功
        </Alert>
      </Snackbar>

      {/* 复制成功提示 */}
      <Snackbar
        open={copySuccess}
        autoHideDuration={2000}
        onClose={() => setCopySuccess(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity="success" onClose={() => setCopySuccess(false)}>
          内容已复制到剪贴板
        </Alert>
      </Snackbar>

      {/* 错误提示 */}
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      </Snackbar>
    </>
  );
};
