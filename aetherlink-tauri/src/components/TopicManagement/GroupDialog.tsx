import { useState } from 'react';
import { 
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button
} from '@mui/material';
import { useDispatch } from 'react-redux';
import { createGroup } from '../../shared/store/slices/groupsSlice';

interface GroupDialogProps {
  open: boolean;
  onClose: () => void;
  type: 'assistant' | 'topic';
  title?: string;
  assistantId?: string; // 话题分组需要的助手ID
}

export default function GroupDialog({ open, onClose, type, title = '添加分组', assistantId }: GroupDialogProps) {
  const dispatch = useDispatch();
  const [groupName, setGroupName] = useState('');
  const [error, setError] = useState('');
  
  const handleClose = () => {
    setGroupName('');
    setError('');
    onClose();
  };
  
  const handleSubmit = () => {
    if (!groupName.trim()) {
      setError('分组名称不能为空');
      return;
    }

    // 对于话题分组，检查assistantId是否存在
    if (type === 'topic' && !assistantId) {
      setError('创建话题分组需要指定助手');
      return;
    }

    // 创建新分组
    dispatch(createGroup({
      name: groupName.trim(),
      type,
      assistantId: type === 'topic' ? assistantId : undefined
    }));

    handleClose();
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };
  
  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      fullWidth
      maxWidth="xs"
    >
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          label={`${type === 'assistant' ? '助手' : '话题'}分组名称`}
          type="text"
          fullWidth
          variant="outlined"
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          onKeyDown={handleKeyDown}
          error={!!error}
          helperText={error}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>取消</Button>
        <Button 
          onClick={handleSubmit} 
          variant="contained" 
          disableElevation
        >
          确定
        </Button>
      </DialogActions>
    </Dialog>
  );
} 