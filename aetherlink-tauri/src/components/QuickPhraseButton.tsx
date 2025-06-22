import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Box,
  Typography,
  Divider
} from '@mui/material';
import { Plus, BotMessageSquare } from 'lucide-react';
import { CustomIcon } from './icons';
import { useTheme } from '@mui/material/styles';
import QuickPhraseService from '../shared/services/QuickPhraseService';
import type { QuickPhrase } from '../shared/types';
import { dexieStorage } from '../shared/services/storage/DexieStorageService';

interface QuickPhraseButtonProps {
  onInsertPhrase: (content: string) => void;
  assistant?: any;
  disabled?: boolean;
  size?: 'small' | 'medium' | 'large';
}

const QuickPhraseButton: React.FC<QuickPhraseButtonProps> = ({
  onInsertPhrase,
  assistant,
  disabled = false,
  size = 'medium'
}) => {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [globalPhrases, setGlobalPhrases] = useState<QuickPhrase[]>([]);
  const [assistantPhrases, setAssistantPhrases] = useState<QuickPhrase[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    location: 'global' as 'global' | 'assistant'
  });

  // 加载快捷短语
  const loadPhrases = useCallback(async () => {
    try {
      // 加载全局快捷短语
      const global = await QuickPhraseService.getAll();
      setGlobalPhrases(global);

      // 加载助手快捷短语
      if (assistant) {
        const assistantPhrases = QuickPhraseService.getAssistantPhrases(assistant);
        setAssistantPhrases(assistantPhrases);
      }
    } catch (error) {
      console.error('加载快捷短语失败:', error);
    }
  }, [assistant]);

  useEffect(() => {
    loadPhrases();
  }, [loadPhrases]);

  // 打开菜单
  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  // 关闭菜单
  const handleClose = () => {
    setAnchorEl(null);
  };

  // 选择快捷短语
  const handlePhraseSelect = (phrase: QuickPhrase) => {
    onInsertPhrase(phrase.content);
    handleClose();
  };

  // 打开添加对话框
  const handleOpenDialog = () => {
    setDialogOpen(true);
    handleClose();
  };

  // 关闭添加对话框
  const handleCloseDialog = () => {
    setDialogOpen(false);
    setFormData({ title: '', content: '', location: 'global' });
  };

  // 保存快捷短语
  const handleSave = async () => {
    if (!formData.title.trim() || !formData.content.trim()) {
      return;
    }

    try {
      if (formData.location === 'global') {
        // 添加到全局快捷短语
        await QuickPhraseService.add({
          title: formData.title,
          content: formData.content
        });
      } else if (formData.location === 'assistant' && assistant) {
        // 添加到助手快捷短语
        await QuickPhraseService.addAssistantPhrase(
          assistant,
          {
            title: formData.title,
            content: formData.content
          },
          async (updatedAssistant) => {
            await dexieStorage.saveAssistant(updatedAssistant);
            // 发送事件通知其他组件更新
            window.dispatchEvent(new CustomEvent('assistantUpdated', {
              detail: { assistant: updatedAssistant }
            }));
          }
        );
      }

      handleCloseDialog();
      await loadPhrases();
    } catch (error) {
      console.error('保存快捷短语失败:', error);
    }
  };

  // 合并所有短语用于显示
  const allPhrases = useMemo(() => {
    return [...assistantPhrases, ...globalPhrases];
  }, [assistantPhrases, globalPhrases]);

  const iconSize = size === 'large' ? 28 : size === 'small' ? 20 : 24;

  return (
    <>
      <Tooltip title="快捷短语">
        <span>
          <IconButton
            onClick={handleClick}
            disabled={disabled}
            size={size}
            style={{
              color: theme.palette.mode === 'dark' ? '#fff' : '#666',
              padding: size === 'large' ? '10px' : size === 'small' ? '6px' : '8px'
            }}
          >
            <CustomIcon name="quickPhrase" size={iconSize} color="currentColor" />
          </IconButton>
        </span>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        disableAutoFocus={true}
        disableRestoreFocus={true}
        PaperProps={{
          style: {
            maxHeight: 400,
            minWidth: 250,
            maxWidth: 350
          }
        }}
      >
        {allPhrases.length > 0 && [
          ...assistantPhrases.map((phrase) => (
            <MenuItem
              key={phrase.id}
              onClick={() => handlePhraseSelect(phrase)}
              style={{ paddingRight: 16 }}
            >
              <ListItemIcon>
                <BotMessageSquare size={18} />
              </ListItemIcon>
              <ListItemText
                primary={phrase.title}
                secondary={phrase.content.length > 50
                  ? phrase.content.substring(0, 50) + '...'
                  : phrase.content
                }
                secondaryTypographyProps={{
                  style: { fontSize: '0.75rem', opacity: 0.7 }
                }}
              />
            </MenuItem>
          )),

          ...(assistantPhrases.length > 0 && globalPhrases.length > 0 ? [
            <Divider key="divider-1" />
          ] : []),

          ...globalPhrases.map((phrase) => (
            <MenuItem
              key={phrase.id}
              onClick={() => handlePhraseSelect(phrase)}
              style={{ paddingRight: 16 }}
            >
              <ListItemIcon>
                <CustomIcon name="quickPhrase" size={18} color="currentColor" />
              </ListItemIcon>
              <ListItemText
                primary={phrase.title}
                secondary={phrase.content.length > 50
                  ? phrase.content.substring(0, 50) + '...'
                  : phrase.content
                }
                secondaryTypographyProps={{
                  style: { fontSize: '0.75rem', opacity: 0.7 }
                }}
              />
            </MenuItem>
          )),
          <Divider key="divider-2" />
        ]}
        
        <MenuItem onClick={handleOpenDialog}>
          <ListItemIcon>
            <Plus size={18} />
          </ListItemIcon>
          <ListItemText primary="添加快捷短语..." />
        </MenuItem>
      </Menu>

      {/* 添加快捷短语对话框 */}
      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>添加快捷短语</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="标题"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              fullWidth
              size="small"
            />
            
            <TextField
              label="内容"
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              multiline
              rows={4}
              fullWidth
              size="small"
            />
            
            <FormControl component="fieldset">
              <FormLabel component="legend">添加位置</FormLabel>
              <RadioGroup
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value as 'global' | 'assistant' })}
                row
              >
                <FormControlLabel
                  value="global"
                  control={<Radio size="small" />}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <CustomIcon name="quickPhrase" size={16} color="currentColor" />
                      <Typography variant="body2">全局快捷短语</Typography>
                    </Box>
                  }
                />
                {assistant && (
                  <FormControlLabel
                    value="assistant"
                    control={<Radio size="small" />}
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <BotMessageSquare size={16} />
                        <Typography variant="body2">助手提示词</Typography>
                      </Box>
                    }
                  />
                )}
              </RadioGroup>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>取消</Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={!formData.title.trim() || !formData.content.trim()}
          >
            保存
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default QuickPhraseButton;
