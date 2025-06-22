import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Fab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Paper,
  Divider,
  Chip,
  Alert,
  Switch,
  FormControlLabel,
  AppBar,
  Toolbar,
  alpha
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import {
  Plus as AddIcon,
  Edit as EditIcon,
  Trash2 as DeleteIcon,
  ArrowLeft
} from 'lucide-react';
import { CustomIcon } from './icons';
import { useTheme } from '@mui/material/styles';
import QuickPhraseService from '../shared/services/QuickPhraseService';
import type { QuickPhrase } from '../shared/types';
import type { RootState } from '../shared/store';
import { setShowQuickPhraseButton } from '../shared/store/settingsSlice';

const QuickPhraseSettings: React.FC = () => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleBack = () => {
    navigate('/settings');
  };

  // 从Redux获取快捷短语按钮显示设置
  const showQuickPhraseButton = useSelector((state: RootState) => state.settings.showQuickPhraseButton ?? true);

  const [phrases, setPhrases] = useState<QuickPhrase[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPhrase, setEditingPhrase] = useState<QuickPhrase | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    content: ''
  });

  // 加载快捷短语
  const loadPhrases = useCallback(async () => {
    try {
      setLoading(true);
      const allPhrases = await QuickPhraseService.getAll();
      setPhrases(allPhrases);
    } catch (error) {
      console.error('加载快捷短语失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPhrases();
  }, [loadPhrases]);

  // 打开添加对话框
  const handleAdd = () => {
    setEditingPhrase(null);
    setFormData({ title: '', content: '' });
    setDialogOpen(true);
  };

  // 打开编辑对话框
  const handleEdit = (phrase: QuickPhrase) => {
    setEditingPhrase(phrase);
    setFormData({
      title: phrase.title,
      content: phrase.content
    });
    setDialogOpen(true);
  };

  // 删除快捷短语
  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个快捷短语吗？')) return;

    try {
      await QuickPhraseService.delete(id);
      await loadPhrases();
    } catch (error) {
      console.error('删除快捷短语失败:', error);
    }
  };

  // 关闭对话框
  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingPhrase(null);
    setFormData({ title: '', content: '' });
  };

  // 保存快捷短语
  const handleSave = async () => {
    if (!formData.title.trim() || !formData.content.trim()) {
      return;
    }

    try {
      if (editingPhrase) {
        // 更新现有短语
        await QuickPhraseService.update(editingPhrase.id, {
          title: formData.title,
          content: formData.content
        });
      } else {
        // 添加新短语
        await QuickPhraseService.add({
          title: formData.title,
          content: formData.content
        });
      }

      handleCloseDialog();
      await loadPhrases();
    } catch (error) {
      console.error('保存快捷短语失败:', error);
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography>加载中...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{
      flexGrow: 1,
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      bgcolor: (theme) => theme.palette.mode === 'light'
        ? alpha(theme.palette.primary.main, 0.02)
        : alpha(theme.palette.background.default, 0.9),
    }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 1,
          bgcolor: 'background.paper',
          color: 'text.primary',
          borderBottom: 1,
          borderColor: 'divider',
          backdropFilter: 'blur(8px)',
        }}
      >
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            onClick={handleBack}
            aria-label="back"
            sx={{
              color: (theme) => theme.palette.primary.main,
            }}
          >
            <ArrowLeft size={24} />
          </IconButton>
          <Typography
            variant="h6"
            component="div"
            sx={{
              flexGrow: 1,
              fontWeight: 600,
            }}
          >
            快捷短语管理
          </Typography>
        </Toolbar>
      </AppBar>
      <Box sx={{
        flexGrow: 1,
        overflowY: 'auto',
        p: 2,
        mt: 8,
        '&::-webkit-scrollbar': {
          width: '6px',
        },
        '&::-webkit-scrollbar-thumb': {
          backgroundColor: 'rgba(0,0,0,0.1)',
          borderRadius: '3px',
        },
      }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3, px: 1 }}>
          管理您的快捷短语，在聊天时快速插入常用内容。
        </Typography>

        {/* 快捷短语按钮显示控制 */}
        <Paper sx={{ p: 2, mb: 3, border: `1px solid ${theme.palette.divider}`, borderRadius: 2 }}>
          <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
            显示设置
          </Typography>
          <FormControlLabel
            control={
              <Switch
                checked={showQuickPhraseButton}
                onChange={(e) => dispatch(setShowQuickPhraseButton(e.target.checked))}
              />
            }
            label="在输入框显示快捷短语按钮"
          />
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            控制是否在聊天输入框中显示快捷短语按钮
          </Typography>
        </Paper>

        {phrases.length === 0 ? (
          <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2 }}>
            <Box sx={{ opacity: 0.3, mb: 2 }}>
              <CustomIcon name="quickPhrase" size={48} color="currentColor" />
            </Box>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              还没有快捷短语
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              创建您的第一个快捷短语，让聊天更高效
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleAdd}
            >
              添加快捷短语
            </Button>
          </Paper>
        ) : (
          <>
            <List>
              {phrases.map((phrase, index) => (
                <React.Fragment key={phrase.id}>
                  <ListItem
                    sx={{
                      bgcolor: 'background.paper',
                      borderRadius: 1,
                      mb: 1,
                      border: `1px solid ${theme.palette.divider}`
                    }}
                  >
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="subtitle1" fontWeight="medium">
                            {phrase.title}
                          </Typography>
                          <Chip
                            size="small"
                            label={`${phrase.content.length} 字符`}
                            variant="outlined"
                          />
                        </Box>
                      }
                      secondary={
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{
                            mt: 1,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden'
                          }}
                        >
                          {phrase.content}
                        </Typography>
                      }
                    />
                    <ListItemSecondaryAction>
                      <IconButton
                        edge="end"
                        onClick={() => handleEdit(phrase)}
                        size="small"
                        sx={{ mr: 1 }}
                      >
                        <EditIcon size={18} />
                      </IconButton>
                      <IconButton
                        edge="end"
                        onClick={() => handleDelete(phrase.id)}
                        size="small"
                        color="error"
                      >
                        <DeleteIcon size={18} />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                  {index < phrases.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>

            <Fab
              color="primary"
              aria-label="添加快捷短语"
              onClick={handleAdd}
              sx={{
                position: 'fixed',
                bottom: 24,
                right: 24
              }}
            >
              <AddIcon />
            </Fab>
          </>
        )}

        {/* 添加/编辑对话框 */}
        <Dialog
          open={dialogOpen}
          onClose={handleCloseDialog}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            {editingPhrase ? '编辑快捷短语' : '添加快捷短语'}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
              <TextField
                label="标题"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                fullWidth
                size="small"
                placeholder="为您的快捷短语起个名字"
              />
              
              <TextField
                label="内容"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                multiline
                rows={6}
                fullWidth
                size="small"
                placeholder="输入快捷短语的内容..."
              />

              {formData.content && (
                <Alert severity="info" sx={{ mt: 1 }}>
                  内容长度：{formData.content.length} 字符
                </Alert>
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>取消</Button>
            <Button
              onClick={handleSave}
              variant="contained"
              disabled={!formData.title.trim() || !formData.content.trim()}
            >
              {editingPhrase ? '更新' : '添加'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Box>
  );
};

export default QuickPhraseSettings;
