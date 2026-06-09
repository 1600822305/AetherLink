import React, { useState, useEffect } from 'react';
import { Box, Typography, TextField, Button, IconButton, AppBar, Toolbar } from '@mui/material';
import { RotateCcw, ArrowLeft } from 'lucide-react';
import BackButtonDialog from '../../../components/common/BackButtonDialog';
import { getFactExtractionPrompt } from '../../../shared/services/memory/prompts';

interface PromptEditDialogProps {
  open: boolean;
  onClose: () => void;
  currentPrompt: string | undefined;
  onSave: (prompt: string) => void;
}

/**
 * 自定义提示词编辑对话框（全屏）
 */
const PromptEditDialog: React.FC<PromptEditDialogProps> = ({
  open,
  onClose,
  currentPrompt,
  onSave,
}) => {
  const [promptText, setPromptText] = useState('');

  useEffect(() => {
    if (open) {
      setPromptText(currentPrompt || getFactExtractionPrompt());
    }
  }, [open, currentPrompt]);

  const handleReset = () => {
    setPromptText(getFactExtractionPrompt());
  };

  const handleSave = () => {
    onSave(promptText);
    onClose();
  };

  return (
    <BackButtonDialog
      open={open}
      onClose={onClose}
      fullScreen
      sx={{
        '& .MuiDialog-paper': {
          backgroundColor: 'background.default',
        }
      }}
    >
      {/* 顶部导航栏 - 适配安全区域 */}
      <AppBar 
        position="sticky" 
        elevation={0}
        sx={{ 
          backgroundColor: 'background.paper',
          borderBottom: '1px solid',
          borderColor: 'divider',
          paddingTop: 'env(safe-area-inset-top)',
        }}
      >
        <Toolbar>
          <IconButton edge="start" onClick={onClose} sx={{ mr: 1 }}>
            <ArrowLeft size={24} />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1, color: 'text.primary' }}>
            自定义提示词
          </Typography>
          <IconButton onClick={handleReset} title="恢复默认">
            <RotateCcw size={20} />
          </IconButton>
          <Button 
            variant="contained" 
            size="small" 
            onClick={handleSave}
            sx={{ ml: 1 }}
          >
            保存
          </Button>
        </Toolbar>
      </AppBar>

      {/* 内容区域 - 适配安全区域 */}
      <Box 
        sx={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column',
          p: 2,
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)',
          overflow: 'hidden',
        }}
      >
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          此提示词用于自动分析模式，LLM 会根据此提示词从对话中提取用户相关的事实和偏好。
        </Typography>
        
        <TextField
          fullWidth
          multiline
          value={promptText}
          onChange={(e) => setPromptText(e.target.value)}
          sx={{ 
            flex: 1,
            '& .MuiInputBase-root': {
              height: '100%',
              alignItems: 'flex-start',
            },
            '& .MuiInputBase-input': {
              fontFamily: 'monospace',
              fontSize: '0.85rem',
              height: '100% !important',
              overflow: 'auto !important',
            }
          }}
        />
      </Box>
    </BackButtonDialog>
  );
};

export default PromptEditDialog;
