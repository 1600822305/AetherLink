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
  Avatar
} from '@mui/material';
import CustomSwitch from '../../../components/CustomSwitch';
import {
  ArrowLeft as ArrowBackIcon,
  Upload as BackupIcon,
  RotateCcw as SettingsBackupRestoreIcon,
  Folder as FolderIcon,
  Database as DataSaverOnIcon,
  CloudUpload as CloudUploadIcon
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../../i18n';
import { prepareFullBackupData, createAndShareBackupFile } from './utils/backupUtils';
import { alpha } from '@mui/material/styles';
import { SafeAreaContainer } from '../../../components/settings/SettingComponents';
import { createLogger } from '../../../shared/services/infra/logger';

const logger = createLogger('AdvancedBackupPage');
import Scrollbar from '../../../components/Scrollbar';

const AdvancedBackupPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
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
    // 额外的核心数据类别：轻量类默认开启，文件/图片体积大默认关闭
    includeKnowledge: true,
    includeMemories: true,
    includeQuickPhrases: true,
    includeSkills: true,
    includeFiles: false,
    includeImages: false
  });

  // 备份类别配置（数据驱动渲染开关列表，便于维护与扩展）
  const backupOptionConfigs: {
    key: keyof typeof backupOptions;
    label: string;
    description: string;
  }[] = [
    {
      key: 'includeChats',
      label: t('dataSettings.advancedBackup.fullBackup.chats.label'),
      description: t('dataSettings.advancedBackup.fullBackup.chats.description')
    },
    {
      key: 'includeAssistants',
      label: t('dataSettings.advancedBackup.fullBackup.assistants.label'),
      description: t('dataSettings.advancedBackup.fullBackup.assistants.description')
    },
    {
      key: 'includeSettings',
      label: t('dataSettings.advancedBackup.fullBackup.settings.label'),
      description: t('dataSettings.advancedBackup.fullBackup.settings.description')
    },
    {
      key: 'includeLocalStorage',
      label: t('dataSettings.advancedBackup.fullBackup.localStorage.label'),
      description: t('dataSettings.advancedBackup.fullBackup.localStorage.description')
    },
    {
      key: 'includeKnowledge',
      label: t('dataSettings.advancedBackup.fullBackup.knowledge.label', { defaultValue: '知识库' }),
      description: t('dataSettings.advancedBackup.fullBackup.knowledge.description', { defaultValue: '知识库及其文档' })
    },
    {
      key: 'includeMemories',
      label: t('dataSettings.advancedBackup.fullBackup.memories.label', { defaultValue: '长期记忆' }),
      description: t('dataSettings.advancedBackup.fullBackup.memories.description', { defaultValue: '助手长期记忆 / 知识图谱' })
    },
    {
      key: 'includeQuickPhrases',
      label: t('dataSettings.advancedBackup.fullBackup.quickPhrases.label', { defaultValue: '快捷短语' }),
      description: t('dataSettings.advancedBackup.fullBackup.quickPhrases.description', { defaultValue: '快捷短语列表' })
    },
    {
      key: 'includeSkills',
      label: t('dataSettings.advancedBackup.fullBackup.skills.label', { defaultValue: '技能' }),
      description: t('dataSettings.advancedBackup.fullBackup.skills.description', { defaultValue: '技能配置' })
    },
    {
      key: 'includeFiles',
      label: t('dataSettings.advancedBackup.fullBackup.files.label', { defaultValue: '文件（体积较大）' }),
      description: t('dataSettings.advancedBackup.fullBackup.files.description', { defaultValue: '已上传文件的完整内容，默认关闭以控制备份体积' })
    },
    {
      key: 'includeImages',
      label: t('dataSettings.advancedBackup.fullBackup.images.label', { defaultValue: '图片（体积较大）' }),
      description: t('dataSettings.advancedBackup.fullBackup.images.description', { defaultValue: '图片二进制数据，默认关闭以控制备份体积' })
    }
  ];

  // 是否至少选择了一个类别
  const hasAnySelected = Object.values(backupOptions).some(Boolean);

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

      // 复用与手动备份一致的完整备份数据：
      // 话题已加载消息/消息块、设置取自 Redux store、localStorage 已过滤敏感项、备份版本号正确(5)
      // 额外类别（知识库/记忆/快捷短语/技能/文件/图片）按用户勾选按需加载，避免无谓体积开销
      const fullData = await prepareFullBackupData({
        includeKnowledge: backupOptions.includeKnowledge,
        includeMemories: backupOptions.includeMemories,
        includeQuickPhrases: backupOptions.includeQuickPhrases,
        includeSkills: backupOptions.includeSkills,
        includeFiles: backupOptions.includeFiles,
        includeImages: backupOptions.includeImages
      });

      // 按用户选择的类别过滤
      const backupData: Record<string, any> = {
        timestamp: fullData.timestamp,
        appInfo: fullData.appInfo
      };
      if (backupOptions.includeChats) backupData.topics = fullData.topics;
      if (backupOptions.includeAssistants) backupData.assistants = fullData.assistants;
      if (backupOptions.includeSettings) {
        backupData.settings = fullData.settings;
        backupData.backupSettings = fullData.backupSettings;
      }
      if (backupOptions.includeLocalStorage) backupData.localStorage = fullData.localStorage;

      // 扩展类别已按 options 决定是否加载，存在即写入备份
      const extendedKeys = [
        'knowledgeBases', 'knowledgeDocuments', 'memories',
        'quickPhrases', 'skills', 'files', 'images', 'imageMetadata'
      ] as const;
      for (const key of extendedKeys) {
        if (fullData[key] !== undefined) backupData[key] = fullData[key];
      }

      // 创建文件名 - 包含更多详细信息
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupTypes = [];
      if (backupOptions.includeChats) backupTypes.push('Chats');
      if (backupOptions.includeAssistants) backupTypes.push('Assistants');
      if (backupOptions.includeSettings) backupTypes.push('Settings');
      if (backupOptions.includeLocalStorage) backupTypes.push('LocalStorage');
      if (backupOptions.includeKnowledge) backupTypes.push('Knowledge');
      if (backupOptions.includeMemories) backupTypes.push('Memories');
      if (backupOptions.includeQuickPhrases) backupTypes.push('QuickPhrases');
      if (backupOptions.includeSkills) backupTypes.push('Skills');
      if (backupOptions.includeFiles) backupTypes.push('Files');
      if (backupOptions.includeImages) backupTypes.push('Images');

      const fileName = `AetherLink_FullBackup_${backupTypes.join('_')}_${timestamp}.json`;

      // 复用统一的保存/分享逻辑：Web 端直接下载，移动端走系统分享并回退到下载目录
      await createAndShareBackupFile(
        fileName,
        backupData,
        (message) => showMessage(message, 'success'),
        (error) => showMessage(t('dataSettings.messages.backupFailed') + ': ' + error.message, 'error')
      );
    } catch (error) {
      logger.error('创建完整备份失败:', error);
      showMessage(t('dataSettings.messages.backupFailed') + ': ' + (error as Error).message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaContainer>
      <AppBar
        position="static"
        elevation={0}
        sx={{
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
            }}
          >
            {t('dataSettings.advancedBackup.title')}
          </Typography>
        </Toolbar>
      </AppBar>

      <Scrollbar
        style={{
          flexGrow: 1,
          padding: '16px',
          paddingBottom: 'var(--content-bottom-padding)',
        }}
      >
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
                  }}
                >
                  {t('dataSettings.advancedBackup.fullBackup.title')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('dataSettings.advancedBackup.fullBackup.description')}
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
              {t('dataSettings.advancedBackup.fullBackup.info')}
            </Alert>

            <Typography
              variant="subtitle1"
              sx={{
                mb: 2,
                fontWeight: 600,
                color: 'text.primary'
              }}
            >
              {t('dataSettings.advancedBackup.fullBackup.selectData')}
            </Typography>

            <List sx={{ mb: 3 }}>
              {backupOptionConfigs.map((option) => (
                <Paper
                  key={option.key}
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
                        <Box sx={{ ml: 2 }}>
                          <CustomSwitch
                            checked={backupOptions[option.key]}
                            onChange={handleOptionChange(option.key)}
                          />
                        </Box>
                      }
                      label={
                        <Box sx={{ py: 1 }}>
                          <Typography variant="body1" fontWeight={500}>{option.label}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {option.description}
                          </Typography>
                        </Box>
                      }
                      sx={{ width: '100%' }}
                    />
                  </ListItem>
                </Paper>
              ))}
            </List>

            <Button
              variant="contained"
              startIcon={isLoading ? <CircularProgress size={24} color="inherit" /> : <BackupIcon />}
              onClick={createFullBackup}
              disabled={isLoading || !hasAnySelected}
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
              {isLoading ? t('dataSettings.advancedBackup.fullBackup.creating') : t('dataSettings.advancedBackup.fullBackup.createButton')}
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
              }}
            >
              {t('dataSettings.advancedBackup.fullBackup.instructions.title')}
            </Typography>
            <Divider sx={{ mb: 2 }} />

            <List disablePadding>
              <ListItem sx={{ px: 0, py: 1.5 }}>
                <ListItemIcon>
                  <SettingsBackupRestoreIcon style={{ color: '#9333EA' }} />
                </ListItemIcon>
                <ListItemText
                  primary={<Typography variant="body1" fontWeight={500}>{t('dataSettings.advancedBackup.fullBackup.instructions.jsonFile.primary')}</Typography>}
                  secondary={t('dataSettings.advancedBackup.fullBackup.instructions.jsonFile.secondary')}
                  primaryTypographyProps={{ component: 'div' }}
                />
              </ListItem>

              <ListItem sx={{ px: 0, py: 1.5 }}>
                <ListItemIcon>
                  <FolderIcon style={{ color: '#9333EA' }} />
                </ListItemIcon>
                <ListItemText
                  primary={<Typography variant="body1" fontWeight={500}>{t('dataSettings.advancedBackup.fullBackup.instructions.cloud.primary')}</Typography>}
                  secondary={t('dataSettings.advancedBackup.fullBackup.instructions.cloud.secondary')}
                  primaryTypographyProps={{ component: 'div' }}
                />
              </ListItem>

              <ListItem sx={{ px: 0, py: 1.5 }}>
                <ListItemIcon>
                  <DataSaverOnIcon style={{ color: '#9333EA' }} />
                </ListItemIcon>
                <ListItemText
                  primary={<Typography variant="body1" fontWeight={500}>{t('dataSettings.advancedBackup.fullBackup.instructions.regular.primary')}</Typography>}
                  secondary={t('dataSettings.advancedBackup.fullBackup.instructions.regular.secondary')}
                  primaryTypographyProps={{ component: 'div' }}
                />
              </ListItem>
            </List>
          </Paper>
        </Container>
      </Scrollbar>

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
    </SafeAreaContainer>
  );
};

export default AdvancedBackupPage;