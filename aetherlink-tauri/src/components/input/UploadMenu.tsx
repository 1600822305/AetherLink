import React from 'react';
import { Menu, MenuItem, ListItemIcon, ListItemText, Divider } from '@mui/material';
import { Image, Camera, FileText, ArrowLeftRight } from 'lucide-react';
import { CustomIcon } from '../icons';

interface UploadMenuProps {
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  onImageUpload: (source: 'camera' | 'photos') => void;
  onFileUpload: () => void;
  onMultiModelSend?: () => void;
  showMultiModel?: boolean;
  // AI辩论相关
  onAIDebate?: () => void;
  showAIDebate?: boolean;
  isDebating?: boolean;
  // 快捷短语相关
  onQuickPhrase?: () => void;
  showQuickPhrase?: boolean;
}

const UploadMenu: React.FC<UploadMenuProps> = ({
  anchorEl,
  open,
  onClose,
  onImageUpload,
  onFileUpload,
  onMultiModelSend,
  showMultiModel = false,
  // AI辩论相关
  onAIDebate,
  showAIDebate = false,
  isDebating = false,
  // 快捷短语相关
  onQuickPhrase,
  showQuickPhrase = false,
}) => {
  return (
    <Menu
      anchorEl={anchorEl}
      open={open}
      onClose={onClose}
      disableAutoFocus={true}
      disableRestoreFocus={true}
      disableEnforceFocus={true}
      anchorOrigin={{
        vertical: 'top',
        horizontal: 'center',
      }}
      transformOrigin={{
        vertical: 'bottom',
        horizontal: 'center',
      }}
      slotProps={{
        paper: {
          sx: {
            minWidth: '200px',
            borderRadius: '12px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          }
        },
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
      <MenuItem
        onClick={() => {
          onImageUpload('photos');
          onClose();
        }}
        sx={{ py: 1.5 }}
      >
        <ListItemIcon>
          <Image size={20} color="#1976d2" />
        </ListItemIcon>
        <ListItemText primary="从相册选择图片" />
      </MenuItem>

      <MenuItem
        onClick={() => {
          onImageUpload('camera');
          onClose();
        }}
        sx={{ py: 1.5 }}
      >
        <ListItemIcon>
          <Camera size={20} color="#9c27b0" />
        </ListItemIcon>
        <ListItemText primary="拍摄照片" />
      </MenuItem>

      <MenuItem
        onClick={() => {
          onFileUpload();
          onClose();
        }}
        sx={{ py: 1.5 }}
      >
        <ListItemIcon>
          <FileText size={20} color="#4caf50" />
        </ListItemIcon>
        <ListItemText primary="上传文件" />
      </MenuItem>

      {/* AI辩论选项 */}
      {showAIDebate && onAIDebate && [
        <Divider key="ai-debate-divider" sx={{ my: 0.5 }} />,
        <MenuItem
          key="ai-debate-item"
          onClick={() => {
            onAIDebate();
            onClose();
          }}
          sx={{ py: 1.5 }}
        >
          <ListItemIcon>
            <CustomIcon name="aiDebate" size={20} color="currentColor" />
          </ListItemIcon>
          <ListItemText
            primary={isDebating ? "停止AI辩论" : "开始AI辩论"}
            secondary={isDebating ? "结束当前辩论" : "多AI角色辩论功能"}
            sx={{
              '& .MuiListItemText-secondary': {
                fontSize: '0.75rem',
                color: 'text.secondary'
              }
            }}
          />
        </MenuItem>
      ]}

      {/* 快捷短语选项 */}
      {showQuickPhrase && onQuickPhrase && [
        <Divider key="quick-phrase-divider" sx={{ my: 0.5 }} />,
        <MenuItem
          key="quick-phrase-item"
          onClick={() => {
            onQuickPhrase();
            onClose();
          }}
          sx={{ py: 1.5 }}
        >
          <ListItemIcon>
            <CustomIcon name="quickPhrase" size={20} color="currentColor" />
          </ListItemIcon>
          <ListItemText
            primary="快捷短语"
            secondary="插入预设的文本短语"
            sx={{
              '& .MuiListItemText-secondary': {
                fontSize: '0.75rem',
                color: 'text.secondary'
              }
            }}
          />
        </MenuItem>
      ]}

      {/* 多模型选项 */}
      {showMultiModel && onMultiModelSend && [
        <Divider key="multi-model-divider" sx={{ my: 0.5 }} />,
        <MenuItem
          key="multi-model-item"
          onClick={() => {
            onMultiModelSend();
            onClose();
          }}
          sx={{ py: 1.5 }}
        >
          <ListItemIcon>
            <ArrowLeftRight size={20} />
          </ListItemIcon>
          <ListItemText
            primary="发送到多个模型"
            secondary="同时向多个AI模型发送消息"
            sx={{
              '& .MuiListItemText-secondary': {
                fontSize: '0.75rem',
                color: 'text.secondary'
              }
            }}
          />
        </MenuItem>
      ]}
    </Menu>
  );
};

export default UploadMenu;