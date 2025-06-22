import { useEffect } from 'react';
import { useAppState } from '../shared/hooks/useAppState';

/**
 * 对话框返回键处理Hook
 * 自动管理对话框的打开/关闭状态，并处理返回键事件
 */
export const useDialogBackHandler = (
  dialogId: string,
  open: boolean,
  onClose: () => void
) => {
  const { openDialog, closeDialog } = useAppState();

  // 管理对话框状态
  useEffect(() => {
    if (open) {
      openDialog(dialogId);
    } else {
      closeDialog(dialogId);
    }
  }, [open, openDialog, closeDialog, dialogId]);

  // 监听返回键关闭事件
  useEffect(() => {
    const handleCloseDialog = (event: CustomEvent) => {
      if (event.detail.dialogId === dialogId) {
        onClose();
      }
    };

    window.addEventListener('closeDialog', handleCloseDialog as EventListener);
    return () => {
      window.removeEventListener('closeDialog', handleCloseDialog as EventListener);
    };
  }, [onClose, dialogId]);

  // 返回清理函数，用于手动关闭时清理状态
  const handleClose = () => {
    closeDialog(dialogId);
    onClose();
  };

  return { handleClose };
};
