import React, { useState } from 'react';
import {
  Box,
  Typography,
  AppBar,
  Toolbar,
  IconButton,
  Container,
  Paper,
  Button,
  Divider,
  Alert,
  Snackbar,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  FormControlLabel,
  Checkbox,
  Avatar
} from '@mui/material';
import {
  ArrowLeft as ArrowBackIcon,
  Upload as BackupIcon,
  RotateCcw as SettingsBackupRestoreIcon,
  Folder as FolderIcon,
  Database as DataSaverOnIcon,
  CloudUpload as CloudUploadIcon
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { FileOpener } from '@capacitor-community/file-opener';
import { getAllTopicsFromDB, getAllAssistantsFromDB } from '../../../shared/services/storage/storageService';
import { alpha } from '@mui/material/styles';

const DEFAULT_BACKUP_DIRECTORY = 'AetherLink/backups';

const AdvancedBackupPage: React.FC = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'info' as 'success' | 'error' | 'info'
  });

  // 备份选项
  const [backupOptions, setBackupOptions] = useState({
    includeChats: true,
    includeAssistants: true,
    includeSettings: true,
    includeLocalStorage: true,
    includeIndexedDB: true
  });

  // 返回上一级页面
  const handleBack = () => {
    navigate('/settings/data');
  };

  // 显示提示信息
  const showMessage = (message: string, severity: 'success' | 'error' | 'info' = 'info') => {
    setSnackbar({
      open: true,
      message,
      severity
    });
  };

  // 关闭提示信息
  const handleCloseSnackbar = () => {
    setSnackbar({...snackbar, open: false});
  };

  // 复制到剪贴板功能
  const copyToClipboard = async (text: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      console.error('复制到剪贴板失败:', error);
      // 备用方法
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textarea);
        return success;
      } catch (fallbackError) {
        console.error('备用剪贴板方法也失败:', fallbackError);
        return false;
      }
    }
  };

  // 更新备份选项
  const handleOptionChange = (option: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setBackupOptions({
      ...backupOptions,
      [option]: event.target.checked
    });
  };

  // 创建完整备份
  const createFullBackup = async () => {
    try {
      setIsLoading(true);

      // 准备备份数据
      const backupData: Record<string, any> = {
        timestamp: Date.now(),
        appInfo: {
          version: '1.0.0',
          name: 'AetherLink',
          backupVersion: 3 // 新的备份版本，用于识别
        }
      };

      // 1. 备份对话和助手数据 (如果选中)
      if (backupOptions.includeChats) {
        const allTopics = await getAllTopicsFromDB();
        backupData.topics = allTopics;
      }

      if (backupOptions.includeAssistants) {
        const allAssistants = await getAllAssistantsFromDB();
        backupData.assistants = allAssistants;
      }

      // 2. 备份设置数据 (如果选中)
      if (backupOptions.includeSettings) {
        const settingsJson = localStorage.getItem('settings');
        backupData.settings = settingsJson ? JSON.parse(settingsJson) : {};
      }

      // 3. 备份其他localStorage数据 (如果选中)
      if (backupOptions.includeLocalStorage) {
        const localStorageItems: Record<string, any> = {};
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key !== 'settings' && !key.startsWith('aetherlink-migration') && key !== 'idb-migration-done') {
            try {
              const value = localStorage.getItem(key);
              if (value) {
                // 尝试解析JSON，如果失败则存储原始字符串
                try {
                  localStorageItems[key] = JSON.parse(value);
                } catch {
                  localStorageItems[key] = value;
                }
              }
            } catch (e) {
              console.error(`读取localStorage项 "${key}" 失败:`, e);
            }
          }
        }
        backupData.localStorage = localStorageItems;
      }

      // 备份设置位置信息
      backupData.backupSettings = {
        location: localStorage.getItem('backup-location') || DEFAULT_BACKUP_DIRECTORY,
        storageType: localStorage.getItem('backup-storage-type') || 'documents'
      };

      // 创建文件名 - 包含更多详细信息
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupTypes = [];
      if (backupOptions.includeChats) backupTypes.push('Chats');
      if (backupOptions.includeAssistants) backupTypes.push('Assistants');
      if (backupOptions.includeSettings) backupTypes.push('Settings');
      if (backupOptions.includeLocalStorage) backupTypes.push('LocalStorage');

      const fileName = `AetherLink_FullBackup_${backupTypes.join('_')}_${timestamp}.json`;

      // 将JSON转换为字符串
      const jsonString = JSON.stringify(backupData, null, 2); // 美化JSON格式，方便查看

      // 首先创建临时文件
      const tempPath = fileName;

      await Filesystem.writeFile({
        path: tempPath,
        data: jsonString,
        directory: Directory.Cache,
        encoding: Encoding.UTF8
      });

      // 获取临时文件URI
      const tempFileResult = await Filesystem.getUri({
        path: tempPath,
        directory: Directory.Cache
      });

      if (tempFileResult && tempFileResult.uri) {
        try {
          // 尝试使用Share API调用系统的分享/保存功能
          await Share.share({
            title: '保存完整应用备份',
            text: '选择位置保存完整备份文件',
            url: tempFileResult.uri,
            dialogTitle: '选择保存位置'
          });

          showMessage('请在系统分享菜单中选择"保存到设备"或文件管理器应用', 'info');
        } catch (shareError) {
          console.error('分享文件失败:', shareError);

          // 尝试使用文件打开器
          try {
            await FileOpener.open({
              filePath: tempFileResult.uri,
              contentType: 'application/json'
            });

            showMessage('文件已打开，请使用"另存为"保存到您想要的位置', 'info');
          } catch (openError) {
            console.error('打开文件失败:', openError);
            // 回退到保存到下载目录
            await saveToDownloadDirectory(fileName, jsonString);
          }
        }
      } else {
        // 无法获取临时文件URI，回退到下载目录
        await saveToDownloadDirectory(fileName, jsonString);
      }
    } catch (error) {
      console.error('创建完整备份失败:', error);
      showMessage('创建备份失败: ' + (error as Error).message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // 保存到下载目录
  const saveToDownloadDirectory = async (fileName: string, jsonString: string) => {
    try {
      // 确保下载目录存在
      const downloadDir = "Download";
      try {
        await Filesystem.mkdir({
          path: downloadDir,
          directory: Directory.External,
          recursive: true
        });
      } catch (mkdirError) {
        console.log('目录可能已存在:', mkdirError);
      }

      // 写入文件到下载目录
      const filePath = `${downloadDir}/${fileName}`;
      await Filesystem.writeFile({
        path: filePath,
        data: jsonString,
        directory: Directory.External,
        encoding: Encoding.UTF8
      });

      // 获取完整URI以显示
      const uriResult = await Filesystem.getUri({
        path: filePath,
        directory: Directory.External
      });

      if (uriResult && uriResult.uri) {
        // 尝试使用FileOpener打开文件所在目录
        try {
          await FileOpener.open({
            filePath: uriResult.uri,
            contentType: 'application/json'
          });

          const copied = await copyToClipboard(uriResult.uri);
          showMessage(
            `备份已保存到下载目录: ${uriResult.uri}${copied ? ' (已复制到剪贴板)' : ''}`,
            'success'
          );
        } catch (openError) {
          console.error('打开文件失败，但文件已保存:', openError);
          const copied = await copyToClipboard(uriResult.uri);
          showMessage(
            `备份已保存到下载目录: ${uriResult.uri}${copied ? ' (已复制到剪贴板)' : ''}`,
            'success'
          );
        }
      } else {
        showMessage('备份已保存到下载目录', 'success');
      }
    } catch (error) {
      console.error('保存到下载目录失败:', error);

      // 回退到保存到内部存储根目录
      try {
        await Filesystem.writeFile({
          path: fileName,
          data: jsonString,
          directory: Directory.External,
          encoding: Encoding.UTF8
        });

        const uriResult = await Filesystem.getUri({
          path: fileName,
          directory: Directory.External
        });

        if (uriResult && uriResult.uri) {
          const copied = await copyToClipboard(uriResult.uri);
          showMessage(
            `备份已保存到内部存储根目录: ${uriResult.uri}${copied ? ' (已复制到剪贴板)' : ''}`,
            'success'
          );
        } else {
          showMessage('备份已保存到内部存储根目录', 'success');
        }
      } catch (fallbackError) {
        console.error('保存到内部存储根目录也失败:', fallbackError);
        showMessage('保存备份失败: ' + (fallbackError as Error).message, 'error');
      }
    }
  };

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
            onClick={handleBack}
            aria-label="back"
            sx={{
              color: (theme) => theme.palette.primary.main,
            }}
          >
            <ArrowBackIcon />
          </IconButton>
          <Typography
            variant="h6"
            component="div"
            sx={{
              flexGrow: 1,
              fontWeight: 600,
              backgroundImage: 'linear-gradient(90deg, #9333EA, #754AB4)',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            高级备份
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
        <Container maxWidth="sm" sx={{ my: 2 }}>
          <Paper
            elevation={0}
            sx={{
              p: 3,
              mb: 3,
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.paper',
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
              <Avatar
                sx={{
                  width: 56,
                  height: 56,
                  bgcolor: '#9333EA',
                  fontSize: '1.5rem',
                  mr: 2,
                  boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
                }}
              >
                <CloudUploadIcon />
              </Avatar>
              <Box>
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 600,
                    backgroundImage: 'linear-gradient(90deg, #9333EA, #754AB4)',
                    backgroundClip: 'text',
                    color: 'transparent',
                  }}
                >
                  完整应用备份
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  自定义备份内容并导出到您选择的位置
                </Typography>
              </Box>
            </Box>

            <Divider sx={{ my: 2 }} />

            <Alert
              severity="info"
              variant="outlined"
              sx={{
                mb: 3,
                borderRadius: 2,
                '& .MuiAlert-icon': {
                  color: '#9333EA',
                }
              }}
            >
              高级备份功能允许您选择需要备份的数据类型，并将所有数据保存到自定义位置。
              此功能非常适合在应用更新前或跨设备迁移时使用。
            </Alert>

            <Typography
              variant="subtitle1"
              sx={{
                mb: 2,
                fontWeight: 600,
                color: 'text.primary'
              }}
            >
              选择要备份的数据:
            </Typography>

            <List sx={{ mb: 3 }}>
              <Paper
                elevation={0}
                sx={{
                  mb: 2,
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  overflow: 'hidden',
                  transition: 'all 0.2s',
                  '&:hover': {
                    boxShadow: '0 4px 8px rgba(0,0,0,0.05)',
                    borderColor: (theme) => alpha(theme.palette.primary.main, 0.3),
                  }
                }}
              >
                <ListItem sx={{ p: 0 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={backupOptions.includeChats}
                        onChange={handleOptionChange('includeChats')}
                        color="primary"
                        sx={{ ml: 2 }}
                      />
                    }
                    label={
                      <Box sx={{ py: 1 }}>
                        <Typography variant="body1" fontWeight={500}>聊天记录</Typography>
                        <Typography variant="caption" color="text.secondary">
                          包含所有对话历史和消息
                        </Typography>
                      </Box>
                    }
                    sx={{ width: '100%' }}
                  />
                </ListItem>
              </Paper>

              <Paper
                elevation={0}
                sx={{
                  mb: 2,
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  overflow: 'hidden',
                  transition: 'all 0.2s',
                  '&:hover': {
                    boxShadow: '0 4px 8px rgba(0,0,0,0.05)',
                    borderColor: (theme) => alpha(theme.palette.primary.main, 0.3),
                  }
                }}
              >
                <ListItem sx={{ p: 0 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={backupOptions.includeAssistants}
                        onChange={handleOptionChange('includeAssistants')}
                        color="primary"
                        sx={{ ml: 2 }}
                      />
                    }
                    label={
                      <Box sx={{ py: 1 }}>
                        <Typography variant="body1" fontWeight={500}>助手数据</Typography>
                        <Typography variant="caption" color="text.secondary">
                          包含所有自定义助手及其关联话题
                        </Typography>
                      </Box>
                    }
                    sx={{ width: '100%' }}
                  />
                </ListItem>
              </Paper>

              <Paper
                elevation={0}
                sx={{
                  mb: 2,
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  overflow: 'hidden',
                  transition: 'all 0.2s',
                  '&:hover': {
                    boxShadow: '0 4px 8px rgba(0,0,0,0.05)',
                    borderColor: (theme) => alpha(theme.palette.primary.main, 0.3),
                  }
                }}
              >
                <ListItem sx={{ p: 0 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={backupOptions.includeSettings}
                        onChange={handleOptionChange('includeSettings')}
                        color="primary"
                        sx={{ ml: 2 }}
                      />
                    }
                    label={
                      <Box sx={{ py: 1 }}>
                        <Typography variant="body1" fontWeight={500}>应用设置</Typography>
                        <Typography variant="caption" color="text.secondary">
                          包含主题、模型、API密钥等设置
                        </Typography>
                      </Box>
                    }
                    sx={{ width: '100%' }}
                  />
                </ListItem>
              </Paper>

              <Paper
                elevation={0}
                sx={{
                  mb: 2,
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  overflow: 'hidden',
                  transition: 'all 0.2s',
                  '&:hover': {
                    boxShadow: '0 4px 8px rgba(0,0,0,0.05)',
                    borderColor: (theme) => alpha(theme.palette.primary.main, 0.3),
                  }
                }}
              >
                <ListItem sx={{ p: 0 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={backupOptions.includeLocalStorage}
                        onChange={handleOptionChange('includeLocalStorage')}
                        color="primary"
                        sx={{ ml: 2 }}
                      />
                    }
                    label={
                      <Box sx={{ py: 1 }}>
                        <Typography variant="body1" fontWeight={500}>本地存储数据</Typography>
                        <Typography variant="caption" color="text.secondary">
                          包含所有其他应用数据（偏好设置、历史记录等）
                        </Typography>
                      </Box>
                    }
                    sx={{ width: '100%' }}
                  />
                </ListItem>
              </Paper>
            </List>

            <Button
              variant="contained"
              startIcon={isLoading ? <CircularProgress size={24} color="inherit" /> : <BackupIcon />}
              onClick={createFullBackup}
              disabled={isLoading || (!backupOptions.includeChats && !backupOptions.includeAssistants &&
                                    !backupOptions.includeSettings && !backupOptions.includeLocalStorage)}
              fullWidth
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
              {isLoading ? '正在创建备份...' : '创建完整备份'}
            </Button>
          </Paper>

          <Paper
            elevation={0}
            sx={{
              p: 3,
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.paper',
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
            }}
          >
            <Typography
              variant="h6"
              sx={{
                mb: 2,
                fontWeight: 600,
                backgroundImage: 'linear-gradient(90deg, #9333EA, #754AB4)',
                backgroundClip: 'text',
                color: 'transparent',
              }}
            >
              备份说明
            </Typography>
            <Divider sx={{ mb: 2 }} />

            <List disablePadding>
              <ListItem sx={{ px: 0, py: 1.5 }}>
                <ListItemIcon>
                  <SettingsBackupRestoreIcon style={{ color: '#9333EA' }} />
                </ListItemIcon>
                <ListItemText
                  primary={<Typography variant="body1" fontWeight={500}>备份将保存为JSON文件</Typography>}
                  secondary="您可以选择保存位置，便于跨设备迁移"
                />
              </ListItem>

              <ListItem sx={{ px: 0, py: 1.5 }}>
                <ListItemIcon>
                  <FolderIcon style={{ color: '#9333EA' }} />
                </ListItemIcon>
                <ListItemText
                  primary={<Typography variant="body1" fontWeight={500}>推荐保存到云端</Typography>}
                  secondary="如Google Drive、Dropbox或其他云存储服务"
                />
              </ListItem>

              <ListItem sx={{ px: 0, py: 1.5 }}>
                <ListItemIcon>
                  <DataSaverOnIcon style={{ color: '#9333EA' }} />
                </ListItemIcon>
                <ListItemText
                  primary={<Typography variant="body1" fontWeight={500}>定期备份</Typography>}
                  secondary="建议在重要更新或更改前创建备份"
                />
              </ListItem>
            </List>
          </Paper>
        </Container>
      </Box>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={snackbar.severity}
          sx={{
            width: '100%',
            borderRadius: 2,
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          }}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default AdvancedBackupPage;