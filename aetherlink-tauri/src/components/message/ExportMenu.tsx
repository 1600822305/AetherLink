import React, { useState } from 'react';
import {
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  TextField,
  Divider
} from '@mui/material';
import {
  FileDown,
  Copy,
  Share,
  FileText,
  Brain,
  ExternalLink,
  Image
} from 'lucide-react';
import type { Message } from '../../shared/types/newMessage';
import {
  exportMessageAsMarkdown,
  copyMessageAsMarkdown,
  shareMessage,
  exportToObsidian,
  captureMessageAsImage,
  exportMessageAsImage
} from '../../utils/exportUtils';
import { toastManager } from '../EnhancedToast';

interface ExportMenuProps {
  message: Message;
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
}

interface ObsidianDialogState {
  open: boolean;
  vault: string;
  folder: string;
  processingMethod: '1' | '2' | '3';
  includeReasoning: boolean;
}

export const ExportMenu: React.FC<ExportMenuProps> = ({
  message,
  anchorEl,
  open,
  onClose
}) => {
  const [obsidianDialog, setObsidianDialog] = useState<ObsidianDialogState>({
    open: false,
    vault: '',
    folder: '',
    processingMethod: '3',
    includeReasoning: false
  });

  const handleExportMarkdown = async (includeReasoning = false) => {
    onClose();
    await exportMessageAsMarkdown(message, includeReasoning);
  };

  const handleCopyMarkdown = async (includeReasoning = false) => {
    onClose();
    await copyMessageAsMarkdown(message, includeReasoning);
  };

  const handleShare = async (format: 'text' | 'markdown' = 'text') => {
    onClose();
    await shareMessage(message, format);
  };

  const handleObsidianExport = () => {
    onClose();
    setObsidianDialog(prev => ({ ...prev, open: true }));
  };

  const handleObsidianConfirm = async () => {
    await exportToObsidian(message, {
      vault: obsidianDialog.vault || undefined,
      folder: obsidianDialog.folder || undefined,
      processingMethod: obsidianDialog.processingMethod,
      includeReasoning: obsidianDialog.includeReasoning
    });
    setObsidianDialog(prev => ({ ...prev, open: false }));
  };

  const handleObsidianCancel = () => {
    setObsidianDialog(prev => ({ ...prev, open: false }));
  };

  const handleCaptureImage = async () => {
    onClose();
    // 查找消息元素
    const messageElement = document.getElementById(`message-${message.id}`) as HTMLElement;
    if (messageElement) {
      await captureMessageAsImage(messageElement);
    } else {
      toastManager.error('无法找到消息元素', '操作失败');
    }
  };

  const handleExportImage = async () => {
    onClose();
    // 查找消息元素
    const messageElement = document.getElementById(`message-${message.id}`) as HTMLElement;
    if (messageElement) {
      await exportMessageAsImage(messageElement);
    } else {
      toastManager.error('无法找到消息元素', '操作失败');
    }
  };

  return (
    <>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={onClose}
        disableAutoFocus={true}
        disableRestoreFocus={true}
        disableEnforceFocus={true}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        slotProps={{
          root: {
            slotProps: {
              backdrop: {
                invisible: false,
                sx: {
                  backgroundColor: 'transparent'
                }
              }
            }
          }
        }}
        sx={{
          '& .MuiList-root': {
            '&:focus': {
              outline: 'none'
            }
          }
        }}
      >
        {/* 复制选项 */}
        <MenuItem onClick={() => handleCopyMarkdown(false)}>
          <ListItemIcon>
            <Copy size={16} />
          </ListItemIcon>
          <ListItemText primary="复制为Markdown" />
        </MenuItem>

        <MenuItem onClick={() => handleCopyMarkdown(true)}>
          <ListItemIcon>
            <Brain size={16} />
          </ListItemIcon>
          <ListItemText primary="复制为Markdown（含思考）" />
        </MenuItem>

        <Divider />

        {/* 图片选项 */}
        <MenuItem onClick={handleCaptureImage}>
          <ListItemIcon>
            <Copy size={16} />
          </ListItemIcon>
          <ListItemText primary="复制为图片" />
        </MenuItem>

        <MenuItem onClick={handleExportImage}>
          <ListItemIcon>
            <Image size={16} />
          </ListItemIcon>
          <ListItemText primary="导出为图片" />
        </MenuItem>

        <Divider />

        {/* 导出选项 */}
        <MenuItem onClick={() => handleExportMarkdown(false)}>
          <ListItemIcon>
            <FileDown size={16} />
          </ListItemIcon>
          <ListItemText primary="导出为Markdown" />
        </MenuItem>

        <MenuItem onClick={() => handleExportMarkdown(true)}>
          <ListItemIcon>
            <FileText size={16} />
          </ListItemIcon>
          <ListItemText primary="导出为Markdown（含思考）" />
        </MenuItem>

        <Divider />

        {/* 分享选项 */}
        <MenuItem onClick={() => handleShare('text')}>
          <ListItemIcon>
            <Share size={16} />
          </ListItemIcon>
          <ListItemText primary="分享文本内容" />
        </MenuItem>

        <MenuItem onClick={() => handleShare('markdown')}>
          <ListItemIcon>
            <Share size={16} />
          </ListItemIcon>
          <ListItemText primary="分享Markdown" />
        </MenuItem>

        <Divider />

        {/* 第三方应用 */}
        <MenuItem onClick={handleObsidianExport}>
          <ListItemIcon>
            <ExternalLink size={16} />
          </ListItemIcon>
          <ListItemText primary="导出到Obsidian" />
        </MenuItem>
      </Menu>

      {/* Obsidian导出对话框 */}
      <Dialog
        open={obsidianDialog.open}
        onClose={handleObsidianCancel}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>导出到Obsidian</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Vault名称（可选）"
            value={obsidianDialog.vault}
            onChange={(e) => setObsidianDialog(prev => ({ ...prev, vault: e.target.value }))}
            margin="normal"
            helperText="留空将使用默认Vault"
          />

          <TextField
            fullWidth
            label="文件夹路径（可选）"
            value={obsidianDialog.folder}
            onChange={(e) => setObsidianDialog(prev => ({ ...prev, folder: e.target.value }))}
            margin="normal"
            helperText="例如: Notes/AI对话"
          />

          <FormControl component="fieldset" margin="normal">
            <FormLabel component="legend">处理方式</FormLabel>
            <RadioGroup
              value={obsidianDialog.processingMethod}
              onChange={(e) => setObsidianDialog(prev => ({
                ...prev,
                processingMethod: e.target.value as '1' | '2' | '3'
              }))}
            >
              <FormControlLabel value="3" control={<Radio />} label="新建文件（存在则覆盖）" />
              <FormControlLabel value="1" control={<Radio />} label="追加到文件末尾" />
              <FormControlLabel value="2" control={<Radio />} label="插入到文件开头" />
            </RadioGroup>
          </FormControl>

          <FormControl component="fieldset" margin="normal">
            <FormLabel component="legend">内容选项</FormLabel>
            <RadioGroup
              value={obsidianDialog.includeReasoning ? 'true' : 'false'}
              onChange={(e) => setObsidianDialog(prev => ({
                ...prev,
                includeReasoning: e.target.value === 'true'
              }))}
            >
              <FormControlLabel value="false" control={<Radio />} label="仅导出回答内容" />
              <FormControlLabel value="true" control={<Radio />} label="包含思考过程" />
            </RadioGroup>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleObsidianCancel}>取消</Button>
          <Button onClick={handleObsidianConfirm} variant="contained">
            导出
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ExportMenu;
