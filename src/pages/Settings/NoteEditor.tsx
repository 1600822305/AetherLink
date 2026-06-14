import { useCallback, useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AppBar,
  Box,
  IconButton,
  Toolbar,
  Typography,
  CircularProgress
} from '@mui/material';
import { ArrowLeft as ArrowBackIcon, Save } from 'lucide-react';
import { simpleNoteService } from '../../shared/services/notes/SimpleNoteService';
import { toastManager } from '../../components/EnhancedToast';
import { NoteEditorView } from '../../components/NoteEditor';
import { SafeAreaContainer } from '../../components/settings/SettingComponents';
import { createLogger } from '../../shared/services/infra/logger';

const logger = createLogger('NoteEditor');

const NoteEditor: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const filePath = searchParams.get('path');
  const fileName = searchParams.get('name');
  const from = searchParams.get('from'); // 获取来源参数

  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // 保存原始内容，用于比较是否真正修改
  const originalContentRef = useRef<string>('');

  // 根据来源决定返回路径
  const getBackPath = useCallback(() => {
    return from === 'chat' ? '/chat' : '/settings/notes';
  }, [from]);

  useEffect(() => {
    if (!filePath) {
      toastManager.error('未指定文件路径', '错误');
      navigate(getBackPath());
      return;
    }

    loadFile();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filePath, getBackPath]);

  const loadFile = async () => {
    if (!filePath) return;

    setLoading(true);
    try {
      const fileContent = await simpleNoteService.readNote(filePath);
      setContent(fileContent);
      // 保存原始内容用于比较
      originalContentRef.current = fileContent;
      setHasUnsavedChanges(false);
    } catch (error) {
      logger.error('读取文件失败:', error);
      toastManager.error('读取文件失败', '错误');
      navigate(getBackPath());
    } finally {
      setLoading(false);
    }
  };

  const handleSave = useCallback(async () => {
    if (!filePath || saving) return;

    setSaving(true);
    try {
      await simpleNoteService.saveNote(filePath, content);
      // 保存成功后，更新原始内容引用
      originalContentRef.current = content;
      setHasUnsavedChanges(false);
      toastManager.success('保存成功', '成功');
    } catch (error) {
      logger.error('保存失败:', error);
      toastManager.error('保存失败', '错误');
    } finally {
      setSaving(false);
    }
  }, [filePath, content, saving]);

  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent);
    // 只有内容真正改变时才标记为未保存
    const hasRealChanges = newContent !== originalContentRef.current;
    setHasUnsavedChanges(hasRealChanges);
  }, []);

  const handleBack = useCallback(() => {
    const backPath = getBackPath();
    if (hasUnsavedChanges) {
      if (window.confirm('有未保存的更改，确定要离开吗？')) {
        navigate(backPath);
      }
    } else {
      navigate(backPath);
    }
  }, [hasUnsavedChanges, navigate, getBackPath]);

  // 自动保存（可选）
  useEffect(() => {
    if (!hasUnsavedChanges || !filePath) return;

    const timer = setTimeout(() => {
      handleSave();
    }, 2000); // 2秒后自动保存

    return () => clearTimeout(timer);
  }, [content, hasUnsavedChanges, filePath, handleSave]);

  if (loading) {
    return (
      <SafeAreaContainer sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'column',
        gap: 2
      }}>
        <CircularProgress />
        <Typography color="text.secondary">加载中...</Typography>
      </SafeAreaContainer>
    );
  }

  return (
    <SafeAreaContainer>
      <AppBar
        position="static"
        elevation={0}
        sx={{
          bgcolor: 'background.paper',
          color: 'text.primary',
          borderBottom: 1,
          borderColor: 'divider',
          backdropFilter: 'blur(8px)'
        }}
      >
        <Toolbar>
          <IconButton edge="start" onClick={handleBack} aria-label="back" sx={{ color: 'primary.main', mr: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 600 }}>
            {fileName || '编辑笔记'}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {hasUnsavedChanges && (
              <Typography variant="caption" color="warning.main" sx={{ mr: 1 }}>
                未保存
              </Typography>
            )}
            <IconButton
              color="primary"
              onClick={handleSave}
              disabled={saving || !hasUnsavedChanges}
              sx={{
                bgcolor: 'primary.main',
                color: 'white',
                '&:hover': {
                  bgcolor: 'primary.dark'
                },
                '&.Mui-disabled': {
                  bgcolor: 'action.disabledBackground',
                  color: 'action.disabled'
                }
              }}
            >
              <Save size={20} />
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>

      <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
        <NoteEditorView
          content={content}
          onContentChange={handleContentChange}
          fileName={fileName || '未命名笔记'}
          readOnly={false}
        />
      </Box>
    </SafeAreaContainer>
  );
};

export default NoteEditor;
