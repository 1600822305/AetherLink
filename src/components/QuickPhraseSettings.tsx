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
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();

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
      console.error(t('settings.quickPhrase.log.loadFailed'), error);
    } finally {
      setLoading(false);
    }
  }, [t]);

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
    if (!confirm(t('settings.quickPhrase.confirmDelete'))) return;

    try {
      await QuickPhraseService.delete(id);
      await loadPhrases();
    } catch (error) {
      console.error(t('settings.quickPhrase.log.deleteFailed'), error);
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
      console.error(t('settings.quickPhrase.log.saveFailed'), error);
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography>{t('settings.quickPhrase.loading')}</Typography>
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
            {t('settings.quickPhrase.title')}
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
          {t('settings.quickPhrase.subtitle')}
        </Typography>

        {/* 快捷短语按钮显示控制 */}
        <Paper sx={{ p: 2, mb: 3, border: `1px solid ${theme.palette.divider}`, borderRadius: 2 }}>
          <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
            {t('settings.quickPhrase.displaySettings.title')}
          </Typography>
          <FormControlLabel
            control={
              <Switch
                checked={showQuickPhraseButton}
                onChange={(e) => dispatch(setShowQuickPhraseButton(e.target.checked))}
              />
            }
            label={t('settings.quickPhrase.displaySettings.label')}
          />
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            {t('settings.quickPhrase.displaySettings.caption')}
          </Typography>
        </Paper>

        {phrases.length === 0 ? (
          <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2 }}>
            <Box sx={{ opacity: 0.3, mb: 2 }}>
              <CustomIcon name="quickPhrase" size={48} color="currentColor" />
            </Box>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              {t('settings.quickPhrase.empty.title')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t('settings.quickPhrase.empty.subtitle')}
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleAdd}
            >
              {t('settings.quickPhrase.add')}
            </Button>
          </Paper>
        ) : (
          <Paper sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 2, overflow: 'hidden' }}>
            <List disablePadding>
              {phrases.map((phrase, index) => (
                <React.Fragment key={phrase.id}>
                  <ListItem>
                    <ListItemText
                      primary={
                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                          {phrase.title}
                        </Typography>
                      }
                      secondary={
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{
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
                      <IconButton edge="end" aria-label="edit" onClick={() => handleEdit(phrase)}>
                        <EditIcon size={20} />
                      </IconButton>
                      <IconButton edge="end" aria-label="delete" onClick={() => handleDelete(phrase.id)} sx={{ ml: 1 }}>
                        <DeleteIcon size={20} />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                  {index < phrases.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          </Paper>
        )}
      </Box>
      <Fab color="primary" aria-label="add" sx={{ position: 'fixed', bottom: 32, right: 32 }} onClick={handleAdd}>
        <AddIcon />
      </Fab>
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingPhrase ? t('settings.quickPhrase.dialog.editTitle') : t('settings.quickPhrase.dialog.addTitle')}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label={t('settings.quickPhrase.dialog.form.title')}
            type="text"
            fullWidth
            variant="outlined"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label={t('settings.quickPhrase.dialog.form.content')}
            type="text"
            fullWidth
            multiline
            rows={4}
            variant="outlined"
            value={formData.content}
            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>{t('common.cancel')}</Button>
          <Button onClick={handleSave} variant="contained">{t('common.save')}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default QuickPhraseSettings;
