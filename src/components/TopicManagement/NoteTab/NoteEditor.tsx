import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  IconButton,
  Typography,
  Button,
  CircularProgress
} from '@mui/material';
import { ArrowLeft, Save } from 'lucide-react';
import { simpleNoteService } from '../../../shared/services/notes/SimpleNoteService';
import { toastManager } from '../../EnhancedToast';
import { createLogger } from '../../../shared/services/infra/logger';

const logger = createLogger('NoteEditor');

interface NoteEditorProps {
  path: string;
  onClose: () => void;
}

const NoteEditor: React.FC<NoteEditorProps> = ({ path, onClose }) => {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fileName, setFileName] = useState('');

  useEffect(() => {
    const name = path.split('/').pop() || '';
    setFileName(name);
    loadContent();
  }, [path]);

  const loadContent = async () => {
    setLoading(true);
    try {
      const text = await simpleNoteService.readNote(path);
      setContent(text);
    } catch (error) {
      logger.error('读取笔记失败:', error);
      toastManager.error('读取笔记失败', '错误');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await simpleNoteService.saveNote(path, content);
      toastManager.success('保存成功', '成功');
    } catch (error) {
      logger.error('保存笔记失败:', error);
      toastManager.error('保存失败', '错误');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Toolbar */}
      <Box sx={{ p: 1, display: 'flex', alignItems: 'center', gap: 1, borderBottom: 1, borderColor: 'divider' }}>
        <IconButton onClick={onClose} size="small">
          <ArrowLeft size={18} />
        </IconButton>
        <Typography variant="subtitle1" sx={{ flexGrow: 1, fontWeight: 'medium' }} noWrap title={path}>
          {fileName}
        </Typography>
        <Button
          variant="contained"
          size="small"
          startIcon={<Save size={16} />}
          onClick={handleSave}
          disabled={saving}
        >
          保存
        </Button>
      </Box>

      {/* Editor */}
      <Box sx={{ flexGrow: 1, p: 2, overflow: 'auto' }}>
        <TextField
          fullWidth
          multiline
          variant="standard"
          placeholder="开始写作..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          InputProps={{
            disableUnderline: true,
            sx: { 
              height: '100%', 
              alignItems: 'flex-start',
              fontSize: '1rem',
              fontFamily: 'monospace'
            } 
          }}
          sx={{
            height: '100%',
            '& .MuiInputBase-root': {
              height: '100%'
            }
          }}
        />
      </Box>
    </Box>
  );
};

export default NoteEditor;