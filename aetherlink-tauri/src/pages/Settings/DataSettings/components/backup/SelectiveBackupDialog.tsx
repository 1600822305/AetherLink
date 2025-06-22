import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Box,
  Alert,
  AlertTitle,
  Chip
} from '@mui/material';
import { Settings as SettingsIcon } from 'lucide-react';
import type { SelectiveBackupOptions } from '../../utils/selectiveBackupUtils';

interface SelectiveBackupDialogProps {
  open: boolean;
  options: SelectiveBackupOptions;
  isLoading: boolean;
  onClose: () => void;
  onOptionChange: (option: keyof SelectiveBackupOptions) => void;
  onBackup: () => void;
}

/**
 * 选择性备份对话框组件
 */
const SelectiveBackupDialog: React.FC<SelectiveBackupDialogProps> = ({
  open,
  options,
  isLoading,
  onClose,
  onOptionChange,
  onBackup
}) => {
  // 检查是否有选中的选项
  const isAnyOptionSelected = Object.values(options).some(value => value);
  
  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
        }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 1,
        pb: 1
      }}>
        <SettingsIcon size={24} color="#9333EA" />
        选择性备份
      </DialogTitle>
      
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" paragraph>
          选择需要备份的内容：
        </Typography>
        
        <FormGroup>
          <FormControlLabel
            control={
              <Checkbox 
                checked={options.modelConfig} 
                onChange={() => onOptionChange('modelConfig')}
                sx={{ 
                  color: "#9333EA", 
                  "&.Mui-checked": { color: "#9333EA" } 
                }}
              />
            }
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2">
                  模型配置
                </Typography>
                <Chip 
                  label="推荐" 
                  size="small" 
                  color="primary" 
                  sx={{ 
                    height: 20, 
                    fontSize: '0.7rem',
                    bgcolor: '#9333EA',
                    color: 'white'
                  }} 
                />
              </Box>
            }
          />
        </FormGroup>

        <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
          <Typography variant="caption" color="text.secondary">
            <strong>模型配置包含：</strong><br/>
            • 所有模型提供商设置<br/>
            • API密钥配置<br/>
            • 默认模型选择<br/>
            • 网络搜索设置
          </Typography>
        </Box>

        {/* 未来扩展区域的占位符 */}
        <Box sx={{ mt: 2 }}>
          <Alert severity="info" sx={{ bgcolor: 'rgba(147, 51, 234, 0.05)' }}>
            <AlertTitle sx={{ color: '#9333EA' }}>即将推出</AlertTitle>
            <Typography variant="body2" color="text.secondary">
              更多备份选项正在开发中，包括聊天记录、助手配置等。
            </Typography>
          </Alert>
        </Box>
      </DialogContent>
      
      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button 
          onClick={onClose} 
          color="inherit"
          disabled={isLoading}
        >
          取消
        </Button>
        <Button 
          onClick={onBackup} 
          variant="contained" 
          disabled={isLoading || !isAnyOptionSelected}
          sx={{ 
            bgcolor: "#9333EA", 
            "&:hover": { bgcolor: "#8324DB" },
            "&:disabled": { 
              bgcolor: "grey.300",
              color: "grey.500"
            }
          }}
        >
          {isLoading ? '备份中...' : '创建备份'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SelectiveBackupDialog;
