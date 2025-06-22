import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  IconButton,
  Chip,
  CircularProgress,
  Alert,
  Snackbar
} from '@mui/material';
import {
  X as CloseIcon,
  Save as SaveIcon
} from 'lucide-react';
import CodeMirror from '@uiw/react-codemirror';
import { oneDark } from '@codemirror/theme-one-dark';
import { loadLanguage } from '@uiw/codemirror-extensions-langs';
import { EditorView } from '@codemirror/view';

import { advancedFileManagerService } from '../../shared/services/AdvancedFileManagerService';
import { usePinchZoom } from './hooks/usePinchZoom';
import { FileIcon } from './components/FileIcon';
import { ZoomControls } from './components/ZoomControls';
import { formatFileSize, getFileType, getLanguage } from './utils';
import type { MobileFileViewerProps } from './types';

export const MobileFileViewer: React.FC<MobileFileViewerProps> = ({
  open,
  file,
  onClose,
  onSave,
  customFileReader
}) => {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // 双指缩放（MT管理器风格 - 仅缩放字体大小）
  const {
    scale,
    zoomIn,
    zoomOut,
    resetZoom,
    bindGestures,
    canZoomIn,
    canZoomOut
  } = usePinchZoom({
    minScale: 0.5,
    maxScale: 3.0,
    initialScale: 1.0,
    scaleStep: 0.1,
    onScaleChange: (newScale) => {
      console.log('Font scale changed:', newScale);
    }
  });

  const contentRef = useRef<HTMLDivElement>(null);

  // 获取语言扩展
  const getLanguageExtension = (fileName: string) => {
    try {
      const language = getLanguage(fileName);
      const extension = loadLanguage(language as any);
      return extension ? [extension] : [];
    } catch (error) {
      console.warn('Failed to load language extension:', error);
      return [];
    }
  };

  // 自定义主题扩展，确保文字是白色
  const customTheme = EditorView.theme({
    '&': {
      color: '#ffffff !important',
      backgroundColor: '#1e1e1e !important'
    },
    '.cm-content': {
      color: '#ffffff !important',
      caretColor: '#ffffff !important'
    },
    '.cm-editor': {
      color: '#ffffff !important'
    },
    '.cm-line': {
      color: '#ffffff !important'
    },
    '.cm-cursor': {
      borderLeftColor: '#ffffff !important'
    }
  });

  // 获取手势绑定属性
  const gestureProps = bindGestures();

  // 加载文件内容
  const loadFileContent = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const fileType = getFileType(file.name);

      if (fileType === 'text' || fileType === 'code') {
        // 使用自定义文件读取服务或默认服务
        const fileReader = customFileReader || advancedFileManagerService;
        const result = await fileReader.readFile({
          path: file.path,
          encoding: 'utf8'
        });
        setContent(result.content);
      } else if (fileType === 'image') {
        setContent(`图片文件: ${file.name}\n大小: ${formatFileSize(file.size)}\n路径: ${file.path}`);
      } else {
        setContent(`文件类型: ${file.extension || '未知'}\n大小: ${formatFileSize(file.size)}\n路径: ${file.path}\n\n此文件类型暂不支持预览，请使用系统应用打开。`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载文件失败');
    } finally {
      setLoading(false);
    }
  };

  // 保存文件
  const handleSave = async () => {
    if (!file || !onSave) return;

    setSaving(true);
    try {
      await onSave(content);
      setSaveSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (open && file) {
      loadFileContent();
    }
  }, [open, file]);

  if (!file) return null;

  const fileType = getFileType(file.name);
  const canEdit = fileType === 'text' || fileType === 'code';

  return (
    <>
      <Dialog 
        open={open} 
        onClose={onClose} 
        fullScreen
        sx={{
          '& .MuiDialog-paper': {
            margin: 0,
            maxHeight: '100vh',
            height: '100vh'
          }
        }}
      >
        <DialogTitle sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pb: 1,
          backgroundColor: '#252526',
          color: '#cccccc',
          borderBottom: '1px solid #333333',
          flexWrap: 'wrap',
          gap: 1,
          '& .MuiIconButton-root': {
            color: '#cccccc',
            '&:hover': {
              backgroundColor: '#333333'
            }
          }
        }}>
          {/* 左侧：文件图标和名称 */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, flex: '1 1 auto' }}>
            <FileIcon type={fileType} />
            <Typography variant="h6" noWrap sx={{ flex: 1, fontSize: '1.1rem' }}>
              {file.name}
            </Typography>
          </Box>

          {/* 中间：文件信息标签 */}
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
            <Chip
              label={fileType}
              size="small"
              sx={{
                backgroundColor: '#007acc',
                color: 'white',
                height: '20px',
                '& .MuiChip-label': { fontSize: '0.65rem', px: 0.5 }
              }}
            />
            <Chip
              label={formatFileSize(file.size)}
              size="small"
              sx={{
                backgroundColor: '#333333',
                color: '#cccccc',
                height: '20px',
                '& .MuiChip-label': { fontSize: '0.65rem', px: 0.5 }
              }}
            />
            {file.extension && (
              <Chip
                label={`.${file.extension}`}
                size="small"
                sx={{
                  backgroundColor: '#333333',
                  color: '#cccccc',
                  height: '20px',
                  '& .MuiChip-label': { fontSize: '0.65rem', px: 0.5 }
                }}
              />
            )}
          </Box>

          {/* 右侧：缩放控制和关闭按钮 */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {(fileType === 'text' || fileType === 'code') && (
              <ZoomControls
                scale={scale}
                onZoomIn={zoomIn}
                onZoomOut={zoomOut}
                onReset={resetZoom}
                canZoomIn={canZoomIn}
                canZoomOut={canZoomOut}
              />
            )}
            <IconButton onClick={onClose} edge="end" size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent sx={{
          p: 0,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          backgroundColor: '#1e1e1e'
        }}>
          {/* 内容区域 */}
          <Box
            ref={contentRef}
            {...gestureProps}
            sx={{
              flex: 1,
              p: 0,
              overflow: 'auto', // MT管理器风格：允许正常滚动
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#1e1e1e',
              touchAction: 'none', // 修复@use-gesture警告：设置为none以支持手势
              position: 'relative',
              // 边界限制样式
              overscrollBehavior: 'contain', // 防止过度滚动
              // 确保内容不会溢出
              '& > *': {
                maxWidth: '100%'
              }
            }}
          >
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
              </Box>
            ) : error ? (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            ) : (
              <>
                {fileType === 'image' ? (
                  <Box sx={{ textAlign: 'center' }}>
                    <img
                      src={`file://${file.path}`}
                      alt={file.name}
                      style={{
                        maxWidth: '100%',
                        maxHeight: '60vh',
                        objectFit: 'contain',
                        transform: `scale(${scale})`,
                        transformOrigin: 'center',
                        transition: 'transform 0.1s ease-out'
                      }}
                      onError={() => setError('无法加载图片')}
                    />
                  </Box>
                ) : (fileType === 'text' || fileType === 'code') ? (
                  <Box sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    fontSize: `${14 * scale}px`, // MT管理器风格：缩放字体大小而不是整体缩放
                    transformOrigin: 'top left',
                    transition: 'transform 0.1s ease-out',
                    '& .cm-editor': {
                      height: '100% !important',
                      flex: 1,
                      backgroundColor: '#1e1e1e !important'
                    },
                    '& .cm-scroller': {
                      height: '100% !important',
                      flex: 1
                    },
                    '& .cm-focused': {
                      outline: 'none !important'
                    }
                  }}>
                    <CodeMirror
                      value={content}
                      onChange={(value) => setContent(value)}
                      theme={[oneDark, customTheme]}
                      extensions={[
                        ...getLanguageExtension(file.name)
                      ]}
                      basicSetup={{
                        lineNumbers: true,
                        foldGutter: true,
                        dropCursor: false,
                        allowMultipleSelections: false,
                        indentOnInput: true,
                        bracketMatching: true,
                        closeBrackets: true,
                        autocompletion: true,
                        highlightSelectionMatches: false,
                        searchKeymap: true,
                        syntaxHighlighting: true
                      }}
                      style={{
                        fontSize: `${14 * scale}px`, // 动态字体大小
                        height: '100%'
                      }}
                    />
                  </Box>
                ) : (
                  <Typography
                    component="pre"
                    sx={{
                      fontFamily: 'monospace',
                      fontSize: `${14 * scale}px`, // MT管理器风格：缩放字体大小
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      lineHeight: 1.5,
                      color: '#cccccc',
                      padding: '16px'
                    }}
                  >
                    {content}
                  </Typography>
                )}
              </>
            )}
          </Box>
        </DialogContent>

        <DialogActions sx={{
          p: 2,
          gap: 1,
          flexWrap: 'wrap',
          backgroundColor: '#252526',
          borderTop: '1px solid #333333',
          '& .MuiButton-root': {
            color: '#cccccc',
            borderColor: '#333333',
            '&:hover': {
              backgroundColor: '#333333'
            }
          },
          '& .MuiButton-contained': {
            backgroundColor: '#007acc',
            '&:hover': {
              backgroundColor: '#005a9e'
            }
          }
        }}>
          {canEdit && (
            <Button
              onClick={handleSave}
              variant="contained"
              startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
              disabled={saving}
            >
              保存
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Snackbar
        open={saveSuccess}
        autoHideDuration={3000}
        onClose={() => setSaveSuccess(false)}
        message="文件保存成功"
      />
    </>
  );
};
