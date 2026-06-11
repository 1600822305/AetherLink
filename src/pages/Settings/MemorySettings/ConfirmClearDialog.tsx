import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import BackButtonDialog from '../../../components/common/BackButtonDialog';

interface ConfirmClearDialogProps {
  open: boolean;
  assistantName?: string;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * 清空全部记忆的二次确认对话框
 */
const ConfirmClearDialog: React.FC<ConfirmClearDialogProps> = ({
  open,
  assistantName,
  onClose,
  onConfirm,
}) => (
  <BackButtonDialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ mb: 1 }}>清空全部记忆</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        确定要清空{assistantName ? `「${assistantName}」` : '当前助手'}的全部记忆吗？此操作不可撤销。
      </Typography>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
        <Button onClick={onClose}>取消</Button>
        <Button variant="contained" color="error" onClick={onConfirm}>
          清空
        </Button>
      </Box>
    </Box>
  </BackButtonDialog>
);

export default ConfirmClearDialog;
