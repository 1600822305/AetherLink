import React, { useState } from 'react';
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Button,
  Box,
  Typography,
  Alert,
  AlertTitle,
  CircularProgress,
  Divider,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio
} from '@mui/material';
import {
  Upload as FileUploadIcon,
  CheckCircle as FileDownloadDoneIcon,
  MessageSquare as ChatIcon,
  Bot as SmartToyIcon
} from 'lucide-react';
import { importExternalBackupFromFile } from '../../utils/restoreUtils';
import type { ImportMode } from '../../utils/externalBackupUtils';

interface ImportExternalBackupDialogProps {
  open: boolean;
  onClose: () => void;
  onImportSuccess: (message: string) => void;
  onImportError: (message: string) => void;
}

const ImportExternalBackupDialog: React.FC<ImportExternalBackupDialogProps> = ({
  open,
  onClose,
  onImportSuccess,
  onImportError
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    topicsCount: number;
    assistantsCount: number;
    source: string;
    error?: string;
  } | null>(null);
  const [importMode, setImportMode] = useState<ImportMode>('separate');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showModeSelection, setShowModeSelection] = useState(false);

  // 处理文件选择
  const handleFileSelect = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.txt';

    input.onchange = (e: Event) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];

      if (!file) return;

      setSelectedFile(file);

      // 检查是否为 ChatboxAI 格式，如果是则显示模式选择
      if (file.name.toLowerCase().includes('chatbox') ||
          file.name.toLowerCase().endsWith('.txt')) {
        setShowModeSelection(true);
      } else {
        // 其他格式直接导入
        performImport(file, 'separate');
      }
    };

    input.click();
  };

  // 执行导入操作
  const performImport = async (file: File, mode: ImportMode) => {
    setIsLoading(true);

    try {
      // 导入外部备份
      const result = await importExternalBackupFromFile(file, mode);
      setImportResult(result);

      if (result.success) {
        // 成功导入，但不关闭对话框，等用户点击确认
        setShowModeSelection(false);
      } else {
        // 导入失败，显示错误信息
        onImportError(`导入外部备份失败: ${result.error || '未知错误'}`);
        handleClose();
      }
    } catch (error) {
      console.error('导入外部备份失败:', error);
      onImportError('导入外部备份失败: ' + (error instanceof Error ? error.message : '未知错误'));
      handleClose();
    } finally {
      setIsLoading(false);
    }
  };

  // 处理模式选择确认
  const handleModeConfirm = () => {
    if (selectedFile) {
      performImport(selectedFile, importMode);
    }
  };

  // 获取来源名称
  const getSourceName = (source: string): string => {
    switch (source) {
      case 'desktop':
        return 'Cherry Studio ';
      case 'chatboxai':
        return 'ChatboxAI JSON';
      case 'chatboxai-txt':
        return 'ChatboxAI TXT';
      default:
        return '外部AI助手';
    }
  };

  // 处理关闭对话框
  const handleClose = () => {
    if (!isLoading) {
      setImportResult(null);
      setSelectedFile(null);
      setShowModeSelection(false);
      setImportMode('separate');
      onClose();
    }
  };

  // 处理确认完成
  const handleConfirm = () => {
    if (importResult && importResult.success) {
      // 生成成功消息
      let importMessage = `从 ${getSourceName(importResult.source)} 导入成功：\n`;

      if (importResult.topicsCount > 0) {
        importMessage += `• 已导入 ${importResult.topicsCount} 个对话话题\n`;
      }

      if (importResult.assistantsCount > 0) {
        importMessage += `• 已创建 ${importResult.assistantsCount} 个助手\n`;
      }

      onImportSuccess(importMessage);
    }
    handleClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
        }
      }}
    >
      <DialogTitle>
        导入外部AI助手的聊天记录
      </DialogTitle>

      <DialogContent>
        {!importResult && !showModeSelection && (
          <>
            <DialogContentText sx={{ mb: 2 }}>
              支持的备份格式：
            </DialogContentText>

            <Box sx={{ mb: 2 }}>
              <Chip
                label="Cherry Studio JSON"
                color="secondary"
                sx={{ mr: 1, mb: 1 }}
              />
              <Chip
                label="ChatboxAI JSON"
                color="primary"
                sx={{ mr: 1, mb: 1 }}
              />
              <Chip
                label="ChatboxAI TXT"
                color="primary"
                variant="outlined"
                sx={{ mr: 1, mb: 1 }}
              />
            </Box>

            <Alert severity="info" sx={{ mb: 3 }}>
              <AlertTitle>如何导入</AlertTitle>
              • <strong>Cherry Studio JSON</strong>：支持导入的完整备份文件，包含所有对话记录和消息块数据<br/>
              • <strong>ChatboxAI JSON</strong>：从 ChatboxAI 导出的 JSON 备份文件，支持多线程对话和附件<br/>
              • <strong>ChatboxAI TXT</strong>：从 ChatboxAI 导出的 TXT 文本文件，纯文本格式的对话记录<br/>
              • 导入的数据将创建对应的助手和对话，保持原有的对话结构
            </Alert>

            <Button
              variant="contained"
              startIcon={isLoading ? <CircularProgress size={24} color="inherit" /> : <FileUploadIcon />}
              fullWidth
              onClick={handleFileSelect}
              disabled={isLoading}
              sx={{
                py: 1.5,
                borderRadius: 2,
                background: 'linear-gradient(90deg, #9333EA, #754AB4)',
                fontWeight: 600,
                '&:hover': {
                  background: 'linear-gradient(90deg, #8324DB, #6D3CAF)',
                },
              }}
            >
              {isLoading ? '导入中...' : '选择并导入备份文件'}
            </Button>
          </>
        )}

        {showModeSelection && selectedFile && (
          <>
            <DialogContentText sx={{ mb: 2 }}>
              选择导入方式：
            </DialogContentText>

            <Alert severity="info" sx={{ mb: 3 }}>
              <AlertTitle>导入方式说明</AlertTitle>
              检测到 ChatboxAI 格式文件，请选择导入方式：
            </Alert>

            <FormControl component="fieldset" sx={{ mb: 3 }}>
              <FormLabel component="legend">导入模式</FormLabel>
              <RadioGroup
                value={importMode}
                onChange={(e) => setImportMode(e.target.value as ImportMode)}
              >
                <FormControlLabel
                  value="separate"
                  control={<Radio />}
                  label={
                    <Box>
                      <Typography variant="body1" fontWeight={600}>
                        独立助手模式（推荐）
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        每个对话创建一个独立的助手，便于管理和使用
                      </Typography>
                    </Box>
                  }
                />
                <FormControlLabel
                  value="unified"
                  control={<Radio />}
                  label={
                    <Box>
                      <Typography variant="body1" fontWeight={600}>
                        统一助手模式
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        所有对话归到一个助手下，作为不同的话题
                      </Typography>
                    </Box>
                  }
                />
              </RadioGroup>
            </FormControl>

            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="outlined"
                onClick={() => setShowModeSelection(false)}
                disabled={isLoading}
                sx={{ flex: 1 }}
              >
                返回
              </Button>
              <Button
                variant="contained"
                onClick={handleModeConfirm}
                disabled={isLoading}
                startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : null}
                sx={{ flex: 1 }}
              >
                {isLoading ? '导入中...' : '开始导入'}
              </Button>
            </Box>
          </>
        )}

        {importResult && importResult.success && (
          <>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
              <Box sx={{ mb: 1 }}>
                <FileDownloadDoneIcon size={48} style={{ color: '#4caf50' }} />
              </Box>
              <Typography variant="h6" color="success.main">
                导入成功
              </Typography>
              <Typography variant="body2" color="text.secondary" textAlign="center">
                已从 {getSourceName(importResult.source)} 导入数据
              </Typography>
            </Box>

            <Divider sx={{ my: 2 }} />

            <List>
              <ListItem>
                <ListItemIcon>
                  <ChatIcon color="primary" />
                </ListItemIcon>
                <ListItemText
                  primary={`${importResult.topicsCount} 个对话话题`}
                  secondary="导入的对话将出现在您的对话列表中"
                />
              </ListItem>

              <ListItem>
                <ListItemIcon>
                  <SmartToyIcon color="primary" />
                </ListItemIcon>
                <ListItemText
                  primary={`${importResult.assistantsCount} 个助手`}
                  secondary={`已创建"${getSourceName(importResult.source)} 导入助手"`}
                />
              </ListItem>
            </List>

            <Alert severity="success" sx={{ mt: 2 }}>
              导入操作已完成，您可以在助手列表中找到新创建的助手及其对话。
            </Alert>
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button
          onClick={handleClose}
          color="inherit"
          disabled={isLoading}
        >
          取消
        </Button>

        {importResult && importResult.success && (
          <Button
            onClick={handleConfirm}
            variant="contained"
            color="primary"
          >
            完成
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default ImportExternalBackupDialog;