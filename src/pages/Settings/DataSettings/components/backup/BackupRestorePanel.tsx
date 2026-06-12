import React, { useState, useEffect } from 'react';
import { LinearProgress, Typography, Box, DialogActions, DialogContent, DialogContentText, DialogTitle, Button } from '@mui/material';
import BackButtonDialog from '../../../../../components/common/BackButtonDialog';
import { useTranslation } from '../../../../../i18n';
import {
  Save,
  Folder,
  RotateCcw,
  Settings,
  CloudDownload,
  CloudUpload,
  Cloud,
  Database,
} from 'lucide-react';
import { SettingGroup, SettingItem, YStack } from '../../../../../components/settings/SettingComponents';
import BackupFilesList from './BackupFilesList';
import SelectiveBackupDialog from './SelectiveBackupDialog';
import UnifiedRestoreDialog from './UnifiedRestoreDialog';
import DatabaseDiagnosticDialog from './DatabaseDiagnosticDialog';
import NotificationSnackbar from './NotificationSnackbar';
import WebDavSettings from '../webdav/WebDavSettings';
import WebDavBackupManager from '../webdav/WebDavBackupManager';
import WebDavConfigDialog from '../webdav/WebDavConfigDialog';
import {
  prepareBasicBackupData,
  prepareFullBackupData,
  ensureBackupDirectory,
  createAndShareBackupFile
} from '../../utils/backupUtils';
import {
  performSelectiveBackup,
  getDefaultSelectiveBackupOptions
} from '../../utils/selectiveBackupUtils';
import type { SelectiveBackupOptions } from '../../utils/selectiveBackupUtils';
import {
  performFullRestore,
} from '../../utils/restoreUtils';
import { dexieStorage } from '../../../../../shared/services/storage/DexieStorageService';
import type { WebDavConfig } from '../../../../../shared/types';
import { WebDavBackupService } from '../../../../../shared/services/storage/WebDavBackupService';
import { getWebDavConfig, saveWebDavConfig } from '../../../../../shared/utils/webdavUtils';

/**
 * 备份恢复面板组件
 */
const BackupRestorePanel: React.FC = () => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState({
    active: false,
    stage: '',
    progress: 0
  });
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'info' as 'success' | 'error' | 'info' | 'warning'
  });

  // 备份文件列表刷新触发器
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // 选择性备份对话框状态
  const [selectiveBackupOpen, setSelectiveBackupOpen] = useState(false);
  const [selectiveBackupOptions, setSelectiveBackupOptions] = useState<SelectiveBackupOptions>(
    getDefaultSelectiveBackupOptions()
  );



  // 导入备份对话框状态
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);

  // 清理确认对话框状态
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

  // 数据库诊断对话框状态
  const [databaseDiagnosticOpen, setDatabaseDiagnosticOpen] = useState(false);

  // WebDAV 相关状态
  const [webdavConfig, setWebdavConfig] = useState<WebDavConfig | null>(null);
  const [webdavSettingsOpen, setWebdavSettingsOpen] = useState(false);
  const [webdavBackupManagerOpen, setWebdavBackupManagerOpen] = useState(false);
  const [webdavConfigDialogOpen, setWebdavConfigDialogOpen] = useState(false);

  const webdavService = WebDavBackupService.getInstance();

  // 初始化 WebDAV 配置
  useEffect(() => {
    const loadWebDavConfig = async () => {
      try {
        const config = await getWebDavConfig();
        if (config) {
          setWebdavConfig(config);
          await webdavService.initialize(config);
        }
      } catch (error) {
        console.error('加载 WebDAV 配置失败:', error);
      }
    };

    loadWebDavConfig();
  }, []);

  // 显示提示信息
  const showMessage = (message: string, severity: 'success' | 'error' | 'info' | 'warning' = 'info') => {
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

  // 刷新备份文件列表
  const refreshBackupFilesList = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  // 处理基本备份
  const handleBasicBackup = async () => {
    try {
      setIsLoading(true);

      // 确保目录存在
      await ensureBackupDirectory();

      // 准备备份数据
      const backupData = await prepareBasicBackupData();

      // 创建文件名
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `AetherLink_Backup_${timestamp}.json`;

      // 创建并共享备份文件
      await createAndShareBackupFile(
        fileName,
        backupData,
        (message) => showMessage(message, 'success'),
        (error) => showMessage('创建备份失败: ' + error.message, 'error'),
        refreshBackupFilesList // 添加备份完成后的回调
      );
    } catch (error) {
      console.error('创建备份失败:', error);
      showMessage(t('dataSettings.messages.backupFailed') + ': ' + (error instanceof Error ? error.message : t('dataSettings.errors.unknown')), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // 处理完整备份
  const handleFullBackup = async () => {
    try {
      setIsLoading(true);

      // 准备完整备份数据
      const backupData = await prepareFullBackupData();

      // 创建文件名
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `AetherLink_Backup_Full_${timestamp}.json`;

      // 创建并共享备份文件
      await createAndShareBackupFile(
        fileName,
        backupData,
        (message) => showMessage(message, 'info'),
        (error) => showMessage('创建备份失败: ' + error.message, 'error'),
        refreshBackupFilesList // 添加备份完成后的回调
      );
    } catch (error) {
      console.error('创建自定义位置备份失败:', error);
      showMessage(t('dataSettings.messages.backupFailed') + ': ' + (error instanceof Error ? error.message : t('dataSettings.errors.unknown')), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // 选择性备份相关函数
  const openSelectiveBackupDialog = () => {
    setSelectiveBackupOptions(getDefaultSelectiveBackupOptions());
    setSelectiveBackupOpen(true);
  };

  const closeSelectiveBackupDialog = () => {
    setSelectiveBackupOpen(false);
  };

  const handleSelectiveBackupOptionChange = (option: keyof SelectiveBackupOptions) => {
    setSelectiveBackupOptions(prev => ({
      ...prev,
      [option]: !prev[option]
    }));
  };

  const handleSelectiveBackup = async () => {
    try {
      setIsLoading(true);
      closeSelectiveBackupDialog();

      await performSelectiveBackup(
        selectiveBackupOptions,
        (message) => {
          showMessage(message, 'success');
          refreshBackupFilesList();
        },
        (error) => showMessage(t('dataSettings.messages.selectiveBackupFailed') + ': ' + error.message, 'error')
      );
    } catch (error) {
      console.error('创建选择性备份失败:', error);
      showMessage(t('dataSettings.messages.backupFailed') + ': ' + (error instanceof Error ? error.message : t('dataSettings.errors.unknown')), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // 打开导入备份对话框
  const openRestoreDialog = () => {
    setRestoreDialogOpen(true);
  };

  // 关闭导入备份对话框
  const closeRestoreDialog = () => {
    setRestoreDialogOpen(false);
  };

  // 处理清理所有数据
  const handleClearAll = () => {
    // 打开确认对话框
    setClearConfirmOpen(true);
  };

  // 确认彻底清理所有数据
  const confirmClearAll = async () => {
    setClearConfirmOpen(false);
    setIsLoading(true);

    try {
      // 使用dexieStorage清理所有数据
      await dexieStorage.clearDatabase();

      // 显示成功消息
      showMessage(t('dataSettings.dataManagement.clearAll.success'), 'success');
      refreshBackupFilesList(); // 刷新备份文件列表
    } catch (error) {
      console.error('确认清理所有数据时出错:', error);
      showMessage(t('dataSettings.messages.clearFailed') + ': ' + (error instanceof Error ? error.message : String(error)), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // 取消清理
  const cancelClearAll = () => {
    setClearConfirmOpen(false);
  };

  // 打开数据库诊断对话框
  const openDatabaseDiagnosticDialog = () => {
    setDatabaseDiagnosticOpen(true);
  };

  // 关闭数据库诊断对话框
  const closeDatabaseDiagnosticDialog = () => {
    setDatabaseDiagnosticOpen(false);
  };

  // 处理备份文件列表中的还原成功
  const handleBackupRestoreSuccess = (message: string) => {
    showMessage(message, 'success');
  };

  // 处理备份文件列表中的错误
  const handleBackupError = (message: string) => {
    showMessage(message, 'error');
  };

  // 处理备份文件删除
  const handleFileDeleted = () => {
      showMessage(t('dataSettings.backupFilesList.deleted'), 'info');
    // 刷新备份文件列表
    refreshBackupFilesList();
  };

  // WebDAV 功能处理函数
  const handleWebDavSettings = () => {
    setWebdavSettingsOpen(true);
  };

  const handleWebDavBackup = async () => {
    if (!webdavConfig) {
      setWebdavConfigDialogOpen(true);
      return;
    }

    try {
      setIsLoading(true);

      // 准备完整备份数据（包含设置、本地存储等）
      const backupData = await prepareFullBackupData();

      // 上传到 WebDAV
      const result = await webdavService.backupToWebDav(backupData);

      if (result.success) {
        showMessage(t('dataSettings.messages.webdavBackupSuccess'), 'success');
      } else {
        showMessage(`${t('dataSettings.messages.webdavBackupFailed')}: ${result.error}`, 'error');
      }
    } catch (error) {
      showMessage(`${t('dataSettings.messages.webdavBackupFailed')}: ${error instanceof Error ? error.message : String(error)}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleWebDavRestoreOpen = () => {
    if (!webdavConfig) {
      setWebdavConfigDialogOpen(true);
      return;
    }
    setWebdavBackupManagerOpen(true);
  };

  const handleWebDavConfigSave = async (config: WebDavConfig) => {
    try {
      await saveWebDavConfig(config);
      setWebdavConfig(config);
      showMessage(t('dataSettings.messages.webdavConfigSaved'), 'success');
    } catch (error) {
      showMessage(`${t('dataSettings.messages.configSaveFailed')}: ${error instanceof Error ? error.message : String(error)}`, 'error');
    }
  };

  const handleWebDavRestoreFile = async (_fileName: string, data: any) => {
    try {
      setIsLoading(true);

      // 使用现有的恢复逻辑
      const result = await performFullRestore(data, (stage, progress) => {
        setRestoreProgress({
          active: true,
          stage,
          progress
        });
      });

      if (result.success) {
        showMessage(t('dataSettings.messages.webdavRestoreSuccess'), 'success');
      } else {
        showMessage(`${t('dataSettings.messages.webdavRestoreFailed')}: ${result.error}`, 'error');
      }
    } catch (error) {
      showMessage(`${t('dataSettings.messages.webdavRestoreFailed')}: ${error instanceof Error ? error.message : String(error)}`, 'error');
    } finally {
      setIsLoading(false);
      setRestoreProgress({
        active: false,
        stage: '',
        progress: 0
      });
    }
  };

  return (
    <YStack sx={{ gap: 3 }}>
      {/* 恢复进度 */}
      {restoreProgress.active && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ mb: 1 }}>
            {restoreProgress.stage}
          </Typography>
          <LinearProgress
            variant="determinate"
            value={restoreProgress.progress * 100}
            sx={{
              height: 8,
              borderRadius: 4,
              '& .MuiLinearProgress-bar': {
                borderRadius: 4,
              }
            }}
          />
        </Box>
      )}

      {/* 备份与恢复分组 */}
      <SettingGroup title={t('dataSettings.backupAndRestore.title')}>
        <SettingItem
          title={t('dataSettings.backupAndRestore.basicBackup.title')}
          description={t('dataSettings.backupAndRestore.basicBackup.description')}
          icon={<Save size={24} />}
          onClick={handleBasicBackup}
          disabled={isLoading}
          showArrow={false}
        />
        <SettingItem
          title={t('dataSettings.backupAndRestore.fullBackup.title')}
          description={t('dataSettings.backupAndRestore.fullBackup.description')}
          icon={<Save size={24} />}
          onClick={handleFullBackup}
          disabled={isLoading}
          showArrow={false}
        />
        <SettingItem
          title={t('dataSettings.backupAndRestore.selectiveBackup.title')}
          description={t('dataSettings.backupAndRestore.selectiveBackup.description')}
          icon={<Settings size={24} />}
          onClick={openSelectiveBackupDialog}
          disabled={isLoading}
          showArrow={false}
        />
        <SettingItem
          title={t('dataSettings.backupAndRestore.unifiedRestore.title', { defaultValue: '导入备份' })}
          description={t('dataSettings.backupAndRestore.unifiedRestore.description', { defaultValue: '导入 AetherLink 或其他 AI 助手的备份文件并恢复数据' })}
          icon={<Folder size={24} />}
          onClick={openRestoreDialog}
          disabled={isLoading}
          showArrow={false}
        />
      </SettingGroup>

      {/* 云备份分组 */}
      <SettingGroup title={t('dataSettings.cloudBackup.title')}>
        <SettingItem
          title={t('dataSettings.cloudBackup.webdavSettings.title')}
          description={t('dataSettings.cloudBackup.webdavSettings.description')}
          icon={<Cloud size={24} />}
          onClick={handleWebDavSettings}
          disabled={isLoading}
          showArrow={false}
        />
        <SettingItem
          title={t('dataSettings.cloudBackup.backupToWebdav.title')}
          description={t('dataSettings.cloudBackup.backupToWebdav.description')}
          icon={<CloudUpload size={24} />}
          onClick={handleWebDavBackup}
          disabled={isLoading}
          showArrow={false}
        />
        <SettingItem
          title={t('dataSettings.cloudBackup.restoreFromWebdav.title')}
          description={t('dataSettings.cloudBackup.restoreFromWebdav.description')}
          icon={<CloudDownload size={24} />}
          onClick={handleWebDavRestoreOpen}
          disabled={isLoading}
          showArrow={false}
        />
      </SettingGroup>

      {/* 数据管理分组 */}
      <SettingGroup title={t('dataSettings.dataManagement.title')}>
        <SettingItem
          title={t('dataSettings.dataManagement.diagnostic.title')}
          description={t('dataSettings.dataManagement.diagnostic.description')}
          icon={<Database size={24} />}
          onClick={openDatabaseDiagnosticDialog}
          disabled={isLoading}
          showArrow={false}
        />
        <SettingItem
          title={isLoading ? t('dataSettings.dataManagement.clearAll.clearing') : t('dataSettings.dataManagement.clearAll.title')}
          description={t('dataSettings.dataManagement.clearAll.description')}
          icon={<RotateCcw size={24} />}
          onClick={handleClearAll}
          disabled={isLoading}
          danger={true}
          showArrow={false}
        />
      </SettingGroup>

      {/* 备份文件列表 */}
      <BackupFilesList
        onRestoreSuccess={handleBackupRestoreSuccess}
        onRestoreError={handleBackupError}
        onFileDeleted={handleFileDeleted}
        refreshTrigger={refreshTrigger}
      />

      {/* 选择性备份对话框 */}
      <SelectiveBackupDialog
        open={selectiveBackupOpen}
        options={selectiveBackupOptions}
        isLoading={isLoading}
        onClose={closeSelectiveBackupDialog}
        onOptionChange={handleSelectiveBackupOptionChange}
        onBackup={handleSelectiveBackup}
      />

      {/* 清理确认对话框 */}
      <BackButtonDialog
        open={clearConfirmOpen}
        onClose={cancelClearAll}
        aria-labelledby="clear-dialog-title"
        aria-describedby="clear-dialog-description"
      >
        <DialogTitle id="clear-dialog-title" color="error">
          {t('dataSettings.dataManagement.clearAll.confirm.title')}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="clear-dialog-description" dangerouslySetInnerHTML={{
            __html: `<strong>${t('dataSettings.dataManagement.clearAll.confirm.warning')}</strong><br/><br/>${t('dataSettings.dataManagement.clearAll.confirm.message')}`
          }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={cancelClearAll} color="primary">
            {t('dataSettings.dataManagement.clearAll.confirm.cancel')}
          </Button>
          <Button onClick={confirmClearAll} color="error" variant="contained">
            {t('dataSettings.dataManagement.clearAll.confirm.confirm')}
          </Button>
        </DialogActions>
      </BackButtonDialog>

      <NotificationSnackbar
        open={snackbar.open}
        message={snackbar.message}
        severity={snackbar.severity}
        onClose={handleCloseSnackbar}
      />

      {/* 统一导入备份对话框 */}
      <UnifiedRestoreDialog
        open={restoreDialogOpen}
        onClose={closeRestoreDialog}
        onSuccess={handleBackupRestoreSuccess}
        onError={handleBackupError}
      />

      {/* 数据库诊断对话框 */}
      <DatabaseDiagnosticDialog
        open={databaseDiagnosticOpen}
        onClose={closeDatabaseDiagnosticDialog}
      />

      {/* WebDAV 设置对话框 */}
      <BackButtonDialog
        open={webdavSettingsOpen}
        onClose={() => setWebdavSettingsOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>{t('dataSettings.webdav.settings.title')}</DialogTitle>
        <DialogContent>
          <WebDavSettings onConfigChange={setWebdavConfig} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWebdavSettingsOpen(false)}>
            {t('common.close', { defaultValue: '关闭' })}
          </Button>
        </DialogActions>
      </BackButtonDialog>

      {/* WebDAV 配置对话框 */}
      <WebDavConfigDialog
        open={webdavConfigDialogOpen}
        onClose={() => setWebdavConfigDialogOpen(false)}
        onSave={handleWebDavConfigSave}
        initialConfig={webdavConfig}
      />

      {/* WebDAV 备份管理器 */}
      <WebDavBackupManager
        open={webdavBackupManagerOpen}
        onClose={() => setWebdavBackupManagerOpen(false)}
        config={webdavConfig}
        onRestore={handleWebDavRestoreFile}
      />
    </YStack>
  );
};

export default BackupRestorePanel;