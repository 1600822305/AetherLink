import React from 'react';
import { Box, Button, CircularProgress } from '@mui/material';
import {
  Upload as BackupIcon,
  Download as FileDownloadIcon,
  CloudDownload as CloudDownloadIcon,
  Save as SaveAltIcon,
  Settings as SettingsIcon,
  Trash2 as DeleteSweepIcon,
  Database as StorageIcon,
  CloudUpload as CloudSyncIcon,
  Cloud as CloudIcon
} from 'lucide-react';
import { alpha } from '@mui/material/styles';

interface BackupButtonsProps {
  isLoading: boolean;
  onBasicBackup: () => void;
  onFullBackup: () => void;
  onSelectiveBackup: () => void; // 新增选择性备份
  onRestore: () => void;
  onImportExternal: () => void;
  onClearAll: () => void;
  onDiagnoseDatabase?: () => void; // 新增数据库诊断功能
  onWebDavBackup?: () => void; // WebDAV 备份
  onWebDavRestore?: () => void; // WebDAV 恢复
  onWebDavSettings?: () => void; // WebDAV 设置
}

/**
 * 备份按钮组件
 */
const BackupButtons: React.FC<BackupButtonsProps> = ({
  isLoading,
  onBasicBackup,
  onFullBackup,
  onSelectiveBackup,
  onRestore,
  onImportExternal,
  onClearAll,
  onDiagnoseDatabase,
  onWebDavBackup,
  onWebDavRestore,
  onWebDavSettings
}) => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 1 }}>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
        <Button
          variant="contained"
          startIcon={isLoading ? <CircularProgress size={24} color="inherit" /> : <BackupIcon />}
          fullWidth
          onClick={onBasicBackup}
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
          {isLoading ? '备份中...' : '备份聊天和助手'}
        </Button>

        <Button
          variant="contained"
          startIcon={isLoading ? <CircularProgress size={24} color="inherit" /> : <SaveAltIcon />}
          fullWidth
          onClick={onFullBackup}
          disabled={isLoading}
          sx={{
            py: 1.5,
            borderRadius: 2,
            backgroundColor: '#6B7280',
            fontWeight: 600,
            '&:hover': {
              backgroundColor: '#4B5563',
            },
          }}
        >
          {isLoading ? '备份中...' : '完整系统备份'}
        </Button>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
        <Button
          variant="outlined"
          startIcon={<SettingsIcon />}
          fullWidth
          onClick={onSelectiveBackup}
          disabled={isLoading}
          sx={{
            py: 1.5,
            borderRadius: 2,
            borderColor: '#9333EA',
            color: '#9333EA',
            '&:hover': {
              borderColor: '#8324DB',
              bgcolor: alpha('#9333EA', 0.05),
            },
          }}
        >
          选择性备份
        </Button>

        <Button
          variant="outlined"
          startIcon={<FileDownloadIcon />}
          fullWidth
          onClick={onRestore}
          disabled={isLoading}
          sx={{
            py: 1.5,
            borderRadius: 2,
            borderColor: 'divider',
            '&:hover': {
              borderColor: '#9333EA',
              bgcolor: alpha('#9333EA', 0.05),
            },
          }}
        >
          导入备份文件并恢复
        </Button>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
        <Button
          variant="outlined"
          startIcon={<CloudDownloadIcon />}
          fullWidth
          onClick={onImportExternal}
          disabled={isLoading}
          sx={{
            py: 1.5,
            borderRadius: 2,
            borderColor: '#2563EB',
            color: '#2563EB',
            '&:hover': {
              borderColor: '#1D4ED8',
              bgcolor: alpha('#2563EB', 0.05),
            },
          }}
        >
          导入其他AI助手备份
        </Button>

        <Button
          variant="outlined"
          color="error"
          startIcon={<DeleteSweepIcon />}
          fullWidth
          onClick={onClearAll}
          disabled={isLoading}
          sx={{
            py: 1.5,
            borderRadius: 2,
            borderColor: '#d32f2f',
            color: '#d32f2f',
            '&:hover': {
              borderColor: '#b71c1c',
              bgcolor: alpha('#d32f2f', 0.05),
            },
          }}
        >
          清理全部助手和话题
        </Button>
      </Box>

      {/* WebDAV 云备份按钮 */}
      {(onWebDavBackup || onWebDavRestore || onWebDavSettings) && (
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
          {onWebDavSettings && (
            <Button
              variant="outlined"
              startIcon={<CloudIcon />}
              fullWidth
              onClick={onWebDavSettings}
              disabled={isLoading}
              sx={{
                py: 1.5,
                borderRadius: 2,
                borderColor: '#3B82F6',
                color: '#3B82F6',
                '&:hover': {
                  borderColor: '#2563EB',
                  bgcolor: alpha('#3B82F6', 0.05),
                },
              }}
            >
              WebDAV 云备份设置
            </Button>
          )}

          {onWebDavBackup && (
            <Button
              variant="outlined"
              startIcon={<CloudSyncIcon />}
              fullWidth
              onClick={onWebDavBackup}
              disabled={isLoading}
              sx={{
                py: 1.5,
                borderRadius: 2,
                borderColor: '#8B5CF6',
                color: '#8B5CF6',
                '&:hover': {
                  borderColor: '#7C3AED',
                  bgcolor: alpha('#8B5CF6', 0.05),
                },
              }}
            >
              备份到 WebDAV
            </Button>
          )}

          {onWebDavRestore && (
            <Button
              variant="outlined"
              startIcon={<CloudDownloadIcon />}
              fullWidth
              onClick={onWebDavRestore}
              disabled={isLoading}
              sx={{
                py: 1.5,
                borderRadius: 2,
                borderColor: '#06B6D4',
                color: '#06B6D4',
                '&:hover': {
                  borderColor: '#0891B2',
                  bgcolor: alpha('#06B6D4', 0.05),
                },
              }}
            >
              从 WebDAV 恢复
            </Button>
          )}
        </Box>
      )}

      {/* 数据库诊断按钮 */}
      {onDiagnoseDatabase && (
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<StorageIcon />}
            fullWidth
            onClick={onDiagnoseDatabase}
            disabled={isLoading}
            sx={{
              py: 1.5,
              borderRadius: 2,
              borderColor: '#10B981',
              color: '#10B981',
              '&:hover': {
                borderColor: '#059669',
                bgcolor: alpha('#10B981', 0.05),
              },
            }}
          >
            数据库诊断与修复
          </Button>
        </Box>
      )}
    </Box>
  );
};

export default BackupButtons;