/**
 * 备份文件列表组件
 * 完全参考 WorkspaceCreateDialog 的实现方式
 */

import React, { useState, useEffect } from 'react';
import {
  Typography,
  Box,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Divider,
  CircularProgress,
  Tooltip,
  Button,
  Chip
} from '@mui/material';
import { useTranslation } from '../../../../../i18n';
import {
  RotateCcw as RestoreIcon,
  Trash2 as DeleteIcon,
  ExternalLink as OpenInNewIcon,
  RefreshCw as RefreshIcon,
  FolderOpen as FolderIcon,
  X as ClearIcon
} from 'lucide-react';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { FileOpener } from '@capacitor-community/file-opener';
import { performFullRestore } from '../../utils/restoreUtils';
import { unifiedFileManager } from '../../../../../shared/services/files/UnifiedFileManagerService';
import { isCapacitor } from '../../../../../shared/utils/platformDetection';

// 备份文件接口
interface BackupFile {
  name: string;
  path: string;
  uri: string;
  ctime: number;
  directory?: string;
}

interface BackupFilesListProps {
  onRestoreSuccess: (message: string) => void;
  onRestoreError: (message: string) => void;
  onFileDeleted: () => void;
  refreshTrigger?: number;
}

// localStorage key
const BACKUP_DIR_KEY = 'backup-custom-directory';

const BackupFilesList: React.FC<BackupFilesListProps> = ({
  onRestoreSuccess,
  onRestoreError,
  onFileDeleted,
  refreshTrigger = 0
}) => {
  const { t } = useTranslation();
  
  // 状态 - 与工作区完全一致的命名
  const [selectedPath, setSelectedPath] = useState('');
  const [selecting, setSelecting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [backupFiles, setBackupFiles] = useState<BackupFile[]>([]);
  const [processingFile, setProcessingFile] = useState<string | null>(null);
  const [restoreProgress, setRestoreProgress] = useState({
    active: false,
    stage: '',
    progress: 0
  });

  // ==================== 选择文件夹 - 完全复制 WorkspaceCreateDialog ====================
  const selectFolder = async () => {
    try {
      setSelecting(true);

      // 首先检查权限（Tauri 桌面端会自动返回 granted）
      const permissionResult = await unifiedFileManager.checkPermissions();
      if (!permissionResult.granted) {
        console.log('权限未授予，尝试请求权限...');
        const requestResult = await unifiedFileManager.requestPermissions();
        if (!requestResult.granted) {
          console.error('需要文件访问权限:', requestResult.message);
          setSelecting(false);
          return;
        }
      }

      const result = await unifiedFileManager.openSystemFilePicker({
        type: 'directory',
        multiple: false,
        title: '选择备份文件夹'
      });

      console.log('文件选择器返回结果:', JSON.stringify(result, null, 2));

      if (!result.cancelled) {
        // 注意：由于插件的 bug，选择目录时可能被放入 files 数组而不是 directories 数组
        // 所以需要同时检查两个数组
        let selectedDir = null;
        
        if (result.directories && result.directories.length > 0) {
          selectedDir = result.directories[0];
        } else if (result.files && result.files.length > 0) {
          // 插件 bug 绕过：目录可能被错误地放入 files 数组
          selectedDir = result.files[0];
        }

        if (selectedDir) {
          console.log('选择的目录信息:', selectedDir);

          // 优先使用转换后的友好路径，如果没有则使用原始路径
          const pathToUse = (selectedDir as any).displayPath || selectedDir.path || selectedDir.uri || (typeof selectedDir === 'string' ? selectedDir : '');
          
          if (pathToUse) {
            setSelectedPath(pathToUse);
            localStorage.setItem(BACKUP_DIR_KEY, pathToUse);
            console.log('已保存备份目录:', pathToUse);
          }
        } else {
          console.log('未选择任何目录');
        }
      }
    } catch (err) {
      console.error('选择文件夹失败:', err);
    } finally {
      setSelecting(false);
    }
  };

  // 清除路径
  const clearPath = () => {
    setSelectedPath('');
    localStorage.removeItem(BACKUP_DIR_KEY);
    setBackupFiles([]);
  };

  // ==================== 加载备份文件 ====================
  const loadBackupFiles = async () => {
    setLoading(true);
    let allFiles: BackupFile[] = [];

    try {
      // 如果有选择的路径，使用 unifiedFileManager（与工作区一致）
      if (selectedPath) {
        console.log('开始搜索目录:', selectedPath);
        
        const result = await unifiedFileManager.listDirectory({
          path: selectedPath,
          showHidden: false,
          sortBy: 'mtime',
          sortOrder: 'desc'
        });

        console.log('目录列表结果:', result);

        const backups = result.files
          .filter(file => file.name.includes('AetherLink') && file.name.endsWith('.json'))
          .map(file => ({
            name: file.name,
            path: file.path,
            uri: file.path,
            ctime: file.mtime || Date.now(),
            directory: t('dataSettings.backupFilesList.directories.custom')
          }));

        allFiles = [...allFiles, ...backups];
        console.log(`在自定义目录中找到 ${backups.length} 个备份文件`);
      }

      // Capacitor: 额外搜索应用内部目录
      if (isCapacitor()) {
        const appDirs = [
          { path: '', directory: Directory.Documents, label: t('dataSettings.backupFilesList.directories.documents') },
          { path: '', directory: Directory.Data, label: t('dataSettings.backupFilesList.directories.appData') }
        ];

        for (const dir of appDirs) {
          try {
            const result = await Filesystem.readdir({
              path: dir.path,
              directory: dir.directory
            });

            if (result.files) {
              const backups = result.files
                .filter(file => file.name && file.name.includes('AetherLink') && file.name.endsWith('.json'))
                .map(file => ({
                  name: file.name,
                  path: file.uri.split('/').pop() || file.name,
                  uri: file.uri,
                  ctime: file.mtime || Date.now(),
                  directory: dir.label
                }));

              allFiles = [...allFiles, ...backups];
              console.log(`在${dir.label}中找到 ${backups.length} 个备份文件`);
            }
          } catch (e) {
            // 忽略不存在的目录
          }
        }
      }
    } catch (err) {
      console.error('加载备份文件失败:', err);
    }

    // 去重
    const unique = allFiles.filter((file, index, self) => 
      index === self.findIndex(f => f.name === file.name)
    );

    // 排序
    unique.sort((a, b) => b.ctime - a.ctime);
    console.log(`总共找到 ${unique.length} 个备份文件`);

    setBackupFiles(unique);
    setLoading(false);
  };

  // 初始化：从 localStorage 读取
  useEffect(() => {
    const saved = localStorage.getItem(BACKUP_DIR_KEY);
    if (saved) {
      console.log('从 localStorage 读取备份目录:', saved);
      setSelectedPath(saved);
    }
  }, []);

  // 当路径变化或刷新时，加载文件列表
  useEffect(() => {
    loadBackupFiles();
  }, [selectedPath, refreshTrigger]);

  // ==================== 辅助函数 ====================
  const formatDate = (timestamp: number) => {
    if (!timestamp) return t('dataSettings.messages.dateUnknown');
    try {
      return new Date(timestamp).toLocaleString(undefined, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return t('dataSettings.messages.dateInvalid');
    }
  };

  const getBackupType = (fileName: string) => {
    if (fileName.includes('_Full_')) return t('dataSettings.backupFilesList.types.full');
    if (fileName.includes('_Custom_')) return t('dataSettings.backupFilesList.types.custom');
    return t('dataSettings.backupFilesList.types.basic');
  };

  // ==================== 文件操作 ====================
  const handleOpenFile = async (file: BackupFile) => {
    try {
      await FileOpener.open({
        filePath: file.uri,
        contentType: 'application/json'
      });
    } catch (error) {
      console.error('打开文件失败:', error);
      onRestoreError(t('dataSettings.messages.fileNotFound'));
    }
  };

  const handleRestoreFile = async (file: BackupFile) => {
    try {
      setProcessingFile(file.name);
      setRestoreProgress({ active: true, stage: t('dataSettings.restoreProgress.readingFile'), progress: 0.05 });

      const fileContent = await Filesystem.readFile({
        path: file.path,
        directory: Directory.External,
        encoding: Encoding.UTF8
      });

      if (!fileContent.data) {
        throw new Error(t('dataSettings.messages.fileEmpty'));
      }

      const jsonString = typeof fileContent.data === 'string' ? fileContent.data : JSON.stringify(fileContent.data);
      const backupData = JSON.parse(jsonString);

      setRestoreProgress({ active: true, stage: t('dataSettings.restoreProgress.validating'), progress: 0.1 });

      const result = await performFullRestore(backupData, (stage, progress) => {
        setRestoreProgress({ active: true, stage, progress });
      });

      if (result.success) {
        let msg = '';
        if (result.topicsCount > 0) msg += `• ${t('dataSettings.restoreProgress.restoredTopics', { count: result.topicsCount })}\n`;
        if (result.assistantsCount > 0) msg += `• ${t('dataSettings.restoreProgress.restoredAssistants', { count: result.assistantsCount })}\n`;
        if (result.settingsRestored) msg += `• ${t('dataSettings.restoreProgress.restoredSettings')}\n`;
        if (result.localStorageCount > 0) msg += `• ${t('dataSettings.restoreProgress.restoredLocalStorage', { count: result.localStorageCount })}\n`;
        onRestoreSuccess(`${t('dataSettings.restoreProgress.success.full')}\n${msg}\n${t('dataSettings.restoreProgress.restartRequired')}`);
      } else {
        onRestoreError(`${t('dataSettings.messages.restoreFailed')}: ${result.error || t('dataSettings.errors.unknown')}`);
      }
    } catch (error) {
      console.error('恢复失败:', error);
      onRestoreError(`${t('dataSettings.messages.restoreFailed')}: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setProcessingFile(null);
      setTimeout(() => setRestoreProgress({ active: false, stage: '', progress: 0 }), 1000);
    }
  };

  const handleDeleteFile = async (file: BackupFile) => {
    try {
      setProcessingFile(file.name);
      await Filesystem.deleteFile({ path: file.path, directory: Directory.External });
      setBackupFiles(prev => prev.filter(f => f.name !== file.name));
      onFileDeleted();
    } catch (error) {
      console.error('删除失败:', error);
      onRestoreError(`${t('dataSettings.webdav.backupManager.errors.deleteFailed')}: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setProcessingFile(null);
    }
  };

  // ==================== 渲染 ====================
  return (
    <Paper elevation={0} sx={{ p: 2, mt: 3, mb: 3, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
      {/* 标题栏 */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600 }}>
          {t('dataSettings.backupFilesList.title')}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            startIcon={selecting ? <CircularProgress size={14} /> : <FolderIcon size={16} />}
            onClick={selectFolder}
            size="small"
            disabled={loading || selecting}
            sx={{ color: '#2563EB', textTransform: 'none', '&:hover': { backgroundColor: 'rgba(37, 99, 235, 0.08)' } }}
          >
            {t('dataSettings.backupFilesList.selectFolder.button')}
          </Button>
          <Button
            startIcon={<RefreshIcon size={16} />}
            onClick={loadBackupFiles}
            size="small"
            disabled={loading}
            sx={{ color: '#9333EA', textTransform: 'none', '&:hover': { backgroundColor: 'rgba(147, 51, 234, 0.08)' } }}
          >
            {t('dataSettings.backupFilesList.refresh')}
          </Button>
        </Box>
      </Box>

      {/* 当前选择的目录 */}
      {selectedPath && (
        <Box sx={{ mb: 2 }}>
          <Chip
            icon={<FolderIcon size={14} />}
            label={selectedPath}
            onDelete={clearPath}
            deleteIcon={<ClearIcon size={14} />}
            size="small"
            sx={{
              maxWidth: '100%',
              '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
              bgcolor: 'rgba(37, 99, 235, 0.1)',
              color: '#2563EB',
              '& .MuiChip-deleteIcon': { color: '#2563EB', '&:hover': { color: '#1D4ED8' } }
            }}
          />
        </Box>
      )}

      <Divider sx={{ mb: 2 }} />

      {/* 恢复进度 */}
      {restoreProgress.active && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ mb: 1 }}>{restoreProgress.stage}</Typography>
          <Box sx={{ height: 6, width: '100%', bgcolor: '#E9D5FF', borderRadius: 3, overflow: 'hidden' }}>
            <Box sx={{
              height: '100%',
              width: '100%',
              bgcolor: '#9333EA',
              borderRadius: 3,
              transformOrigin: 'left center',
              transform: `scaleX(${restoreProgress.progress})`,
              transition: 'transform 0.3s ease-in-out'
            }} />
          </Box>
        </Box>
      )}

      {/* 文件列表 */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={32} sx={{ color: '#9333EA' }} />
        </Box>
      ) : backupFiles.length === 0 ? (
        <Box sx={{ py: 3, textAlign: 'center' }}>
          <Typography color="text.secondary">{t('dataSettings.backupFilesList.noFiles')}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontSize: '0.75rem' }}>
            {!selectedPath && isCapacitor() ? t('dataSettings.backupFilesList.noCustomDir') : t('dataSettings.backupFilesList.noFilesHint')}
          </Typography>
        </Box>
      ) : (
        <List sx={{ maxHeight: '300px', overflow: 'auto' }}>
          {backupFiles.map((file) => (
            <Box key={file.uri}>
              <ListItem sx={{ py: 1.5, '& .MuiListItemText-root': { maxWidth: 'calc(100% - 120px)' } }}>
                <ListItemText
                  primary={<Typography sx={{ fontWeight: 500 }}>{getBackupType(file.name)}</Typography>}
                  secondary={
                    <Box component="div">
                      <Tooltip title={file.name}>
                        <Typography variant="body2" sx={{ fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {formatDate(file.ctime)}
                        </Typography>
                      </Tooltip>
                      {file.directory && (
                        <Typography variant="body2" sx={{ fontSize: '0.7rem', color: 'text.secondary', mt: 0.5 }}>
                          {t('dataSettings.backupFilesList.location')}: {file.directory}
                        </Typography>
                      )}
                    </Box>
                  }
                  secondaryTypographyProps={{ component: 'div' }}
                />
                <ListItemSecondaryAction sx={{ right: 8 }}>
                  <Tooltip title={t('dataSettings.backupFilesList.actions.restore')}>
                    <IconButton size="small" onClick={() => handleRestoreFile(file)} disabled={!!processingFile} sx={{ color: '#9333EA', padding: '4px' }}>
                      {processingFile === file.name ? <CircularProgress size={20} sx={{ color: '#9333EA' }} /> : <RestoreIcon size={16} />}
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={t('dataSettings.backupFilesList.actions.open')}>
                    <IconButton size="small" onClick={() => handleOpenFile(file)} disabled={!!processingFile} sx={{ color: 'text.secondary', padding: '4px', ml: 0.5 }}>
                      <OpenInNewIcon size={16} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={t('dataSettings.backupFilesList.actions.delete')}>
                    <IconButton size="small" onClick={() => handleDeleteFile(file)} disabled={!!processingFile} sx={{ color: 'error.main', padding: '4px', ml: 0.5 }}>
                      <DeleteIcon size={16} />
                    </IconButton>
                  </Tooltip>
                </ListItemSecondaryAction>
              </ListItem>
              <Divider component="li" />
            </Box>
          ))}
        </List>
      )}
    </Paper>
  );
};

export default BackupFilesList;
