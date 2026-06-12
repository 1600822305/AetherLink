import React, { useState } from 'react';
import {
  DialogActions,
  DialogContent,
  DialogTitle,
  Button,
  Box,
  Typography,
  Alert,
  AlertTitle,
  CircularProgress,
  Chip,
  LinearProgress,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton
} from '@mui/material';
import {
  Upload as FileUploadIcon,
  CheckCircle as SuccessIcon,
  XCircle as ErrorIcon,
  FileJson,
  MessageSquare as ChatIcon,
  Bot as AssistantIcon,
  X as CloseIcon
} from 'lucide-react';
import BackButtonDialog from '../../../../../components/common/BackButtonDialog';
import { useTranslation } from '../../../../../i18n';
import {
  readJSONFromFile,
  readTextFromFile,
  validateBackupData,
  performFullRestore,
  importExternalBackupFromFile
} from '../../utils/restoreUtils';
import type { RestoreMode } from '../../utils/restoreUtils';
import type { ImportMode } from '../../utils/externalBackupUtils';
import { isDesktopBackupFormat } from '../../utils/desktopBackupUtils';
import { isChatboxaiBackupFormat } from '../../utils/importers/chatboxai/chatboxaiJsonParser';
import { isChatboxaiTxtFormat } from '../../utils/importers/chatboxai/chatboxaiTxtParser';

type BackupKind = 'aetherlink' | 'cherry-studio' | 'chatboxai-json' | 'chatboxai-txt';

type Step = 'select' | 'options' | 'progress' | 'result';

interface DetectedFile {
  file: File;
  kind: BackupKind;
  data: any;
}

interface RestoreResult {
  success: boolean;
  topicsCount: number;
  assistantsCount: number;
  settingsRestored?: boolean;
  source?: string;
  error?: string;
}

interface UnifiedRestoreDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

/**
 * 统一的备份导入/恢复全屏对话框：
 * 选择文件 → 自动识别格式 → 选择恢复/导入方式 → 执行 → 结果。
 * 支持 AetherLink 备份（替换/合并）与外部 AI 助手备份（Cherry Studio / ChatboxAI）。
 */
const UnifiedRestoreDialog: React.FC<UnifiedRestoreDialogProps> = ({
  open,
  onClose,
  onSuccess,
  onError
}) => {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>('select');
  const [detecting, setDetecting] = useState(false);
  const [detected, setDetected] = useState<DetectedFile | null>(null);
  const [restoreMode, setRestoreMode] = useState<RestoreMode>('replace');
  const [importMode, setImportMode] = useState<ImportMode>('separate');
  const [progress, setProgress] = useState({ stage: '', value: 0 });
  const [result, setResult] = useState<RestoreResult | null>(null);

  const isBusy = detecting || step === 'progress';

  const reset = () => {
    setStep('select');
    setDetecting(false);
    setDetected(null);
    setRestoreMode('replace');
    setImportMode('separate');
    setProgress({ stage: '', value: 0 });
    setResult(null);
  };

  const handleClose = () => {
    if (isBusy) return;
    reset();
    onClose();
  };

  // 选择文件并识别格式
  const handleFileSelect = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.txt';

    input.onchange = async (e: Event) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file) return;

      setDetecting(true);
      try {
        let kind: BackupKind;
        let data: any;

        if (file.name.toLowerCase().endsWith('.txt')) {
          data = await readTextFromFile(file);
          if (!isChatboxaiTxtFormat(data)) {
            throw new Error(t('dataSettings.unifiedRestore.errors.unknownTxt', {
              defaultValue: '无法识别的TXT格式，目前只支持 ChatboxAI 导出的 TXT 文件'
            }));
          }
          kind = 'chatboxai-txt';
        } else {
          data = await readJSONFromFile(file);
          if (data && typeof data === 'object' && data.appInfo && validateBackupData(data)) {
            kind = 'aetherlink';
          } else if (isDesktopBackupFormat(data)) {
            kind = 'cherry-studio';
          } else if (isChatboxaiBackupFormat(data)) {
            kind = 'chatboxai-json';
          } else {
            throw new Error(t('dataSettings.unifiedRestore.errors.unknownFormat', {
              defaultValue: '无法识别的备份格式'
            }));
          }
        }

        setDetected({ file, kind, data });
        setStep('options');
      } catch (error) {
        onError(`${t('dataSettings.unifiedRestore.errors.detectFailed', { defaultValue: '读取备份文件失败' })}: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        setDetecting(false);
      }
    };

    input.click();
  };

  // 执行恢复 / 导入
  const handleStart = async () => {
    if (!detected) return;

    setStep('progress');
    setProgress({ stage: t('dataSettings.restoreProgress.validating'), value: 0.05 });

    try {
      if (detected.kind === 'aetherlink') {
        const res = await performFullRestore(detected.data, (stage, value) => {
          setProgress({ stage, value });
        }, restoreMode);

        setResult({
          success: res.success,
          topicsCount: res.topicsCount,
          assistantsCount: res.assistantsCount,
          settingsRestored: res.settingsRestored,
          error: res.error
        });
      } else {
        setProgress({
          stage: t('dataSettings.unifiedRestore.progress.importing', { defaultValue: '导入数据中...' }),
          value: 0.5
        });
        const res = await importExternalBackupFromFile(detected.file, importMode);

        setResult({
          success: res.success,
          topicsCount: res.topicsCount,
          assistantsCount: res.assistantsCount,
          source: res.source,
          error: res.error
        });
      }
    } catch (error) {
      setResult({
        success: false,
        topicsCount: 0,
        assistantsCount: 0,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    setStep('result');
  };

  // 结果确认
  const handleFinish = () => {
    if (result) {
      if (result.success) {
        const lines: string[] = [];
        if (result.topicsCount > 0) {
          lines.push(`• ${t('dataSettings.restoreProgress.restoredTopics', { count: result.topicsCount })}`);
        }
        if (result.assistantsCount > 0) {
          lines.push(`• ${t('dataSettings.restoreProgress.restoredAssistants', { count: result.assistantsCount })}`);
        }
        if (result.settingsRestored) {
          lines.push(`• ${t('dataSettings.restoreProgress.restoredSettings')}`);
        }
        const header = detected?.kind === 'aetherlink'
          ? t('dataSettings.restoreProgress.success.full')
          : t('dataSettings.unifiedRestore.result.importSuccess', { defaultValue: '导入成功：' });
        onSuccess(`${header}\n${lines.join('\n')}`);
      } else {
        onError(`${t('dataSettings.messages.restoreFailed')}: ${result.error || t('dataSettings.errors.unknown')}`);
      }
    }
    reset();
    onClose();
  };

  const kindLabel = (kind: BackupKind): string => {
    switch (kind) {
      case 'aetherlink':
        return t('dataSettings.unifiedRestore.kinds.aetherlink', { defaultValue: 'AetherLink 备份' });
      case 'cherry-studio':
        return 'Cherry Studio';
      case 'chatboxai-json':
        return 'ChatboxAI JSON';
      case 'chatboxai-txt':
        return 'ChatboxAI TXT';
    }
  };

  return (
    <BackButtonDialog open={open} onClose={handleClose} fullScreen>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {t('dataSettings.unifiedRestore.title', { defaultValue: '导入备份' })}
        <IconButton onClick={handleClose} disabled={isBusy} edge="end" aria-label={t('common.close', { defaultValue: '关闭' })}>
          <CloseIcon size={20} />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        {/* 第一步：选择文件 */}
        {step === 'select' && (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t('dataSettings.unifiedRestore.selectHint', {
                defaultValue: '选择备份文件后会自动识别格式，支持以下来源：'
              })}
            </Typography>

            <Box sx={{ mb: 2 }}>
              <Chip label={t('dataSettings.unifiedRestore.kinds.aetherlink', { defaultValue: 'AetherLink 备份' })} color="success" sx={{ mr: 1, mb: 1 }} />
              <Chip label="Cherry Studio JSON" color="secondary" sx={{ mr: 1, mb: 1 }} />
              <Chip label="ChatboxAI JSON" color="primary" sx={{ mr: 1, mb: 1 }} />
              <Chip label="ChatboxAI TXT" color="primary" variant="outlined" sx={{ mr: 1, mb: 1 }} />
            </Box>

            <Alert severity="info" sx={{ mb: 3 }}>
              <AlertTitle>{t('dataSettings.importExternal.howToImport.title')}</AlertTitle>
              {t('dataSettings.unifiedRestore.howTo', {
                defaultValue: 'AetherLink 备份可选择「替换」或「合并」方式恢复；外部 AI 助手备份（Cherry Studio / ChatboxAI）会以新增方式导入对应的助手和对话，不影响现有数据。'
              })}
            </Alert>

            <Button
              variant="contained"
              startIcon={detecting ? <CircularProgress size={24} color="inherit" /> : <FileUploadIcon />}
              fullWidth
              onClick={handleFileSelect}
              disabled={detecting}
              sx={{ py: 1.5, borderRadius: 2, fontWeight: 600 }}
            >
              {detecting
                ? t('dataSettings.unifiedRestore.detecting', { defaultValue: '识别文件中...' })
                : t('dataSettings.unifiedRestore.selectFile', { defaultValue: '选择备份文件' })}
            </Button>
          </>
        )}

        {/* 第二步：根据格式选择方式并确认 */}
        {step === 'options' && detected && (
          <>
            <List dense sx={{ mb: 1 }}>
              <ListItem disableGutters>
                <ListItemIcon><FileJson /></ListItemIcon>
                <ListItemText
                  primary={detected.file.name}
                  secondary={`${t('dataSettings.unifiedRestore.detectedAs', { defaultValue: '识别为' })}: ${kindLabel(detected.kind)}`}
                />
              </ListItem>
            </List>

            {detected.kind === 'aetherlink' && (
              <>
                <FormControl component="fieldset" sx={{ mb: 2 }}>
                  <FormLabel component="legend">
                    {t('dataSettings.unifiedRestore.restoreMode.title', { defaultValue: '恢复方式' })}
                  </FormLabel>
                  <RadioGroup
                    value={restoreMode}
                    onChange={(e) => setRestoreMode(e.target.value as RestoreMode)}
                  >
                    <FormControlLabel
                      value="replace"
                      control={<Radio />}
                      label={
                        <Box>
                          <Typography variant="body1" fontWeight={600}>
                            {t('dataSettings.unifiedRestore.restoreMode.replace', { defaultValue: '替换（推荐）' })}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {t('dataSettings.unifiedRestore.restoreMode.replaceDescription', {
                              defaultValue: '恢复前清空备份所含的数据类别，恢复后等于备份快照'
                            })}
                          </Typography>
                        </Box>
                      }
                    />
                    <FormControlLabel
                      value="merge"
                      control={<Radio />}
                      label={
                        <Box>
                          <Typography variant="body1" fontWeight={600}>
                            {t('dataSettings.unifiedRestore.restoreMode.merge', { defaultValue: '合并' })}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {t('dataSettings.unifiedRestore.restoreMode.mergeDescription', {
                              defaultValue: '保留设备现有数据，仅按 ID 覆盖同项'
                            })}
                          </Typography>
                        </Box>
                      }
                    />
                  </RadioGroup>
                </FormControl>

                {restoreMode === 'replace' && (
                  <Alert severity="warning" sx={{ mb: 2 }}>
                    {t('dataSettings.unifiedRestore.restoreMode.replaceWarning', {
                      defaultValue: '替换方式会先清空备份中包含的数据类别（如话题、助手等），设备上这些类别的现有数据将被删除且无法恢复。'
                    })}
                  </Alert>
                )}
              </>
            )}

            {(detected.kind === 'chatboxai-json' || detected.kind === 'chatboxai-txt') && (
              <FormControl component="fieldset" sx={{ mb: 2 }}>
                <FormLabel component="legend">{t('dataSettings.importExternal.modeSelection.title')}</FormLabel>
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
                          {t('dataSettings.importExternal.modeSelection.separate.title')}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {t('dataSettings.importExternal.modeSelection.separate.description')}
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
                          {t('dataSettings.importExternal.modeSelection.unified.title')}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {t('dataSettings.importExternal.modeSelection.unified.description')}
                        </Typography>
                      </Box>
                    }
                  />
                </RadioGroup>
              </FormControl>
            )}

            {detected.kind === 'cherry-studio' && (
              <Alert severity="info" sx={{ mb: 2 }}>
                {t('dataSettings.unifiedRestore.externalImportHint', {
                  defaultValue: '导入的数据将以新增方式创建对应的助手和对话，不会影响现有数据。'
                })}
              </Alert>
            )}

            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button variant="outlined" onClick={reset} sx={{ flex: 1 }}>
                {t('dataSettings.importExternal.modeSelection.back')}
              </Button>
              <Button variant="contained" onClick={handleStart} sx={{ flex: 1 }}>
                {detected.kind === 'aetherlink'
                  ? t('dataSettings.unifiedRestore.startRestore', { defaultValue: '开始恢复' })
                  : t('dataSettings.importExternal.modeSelection.startImport')}
              </Button>
            </Box>
          </>
        )}

        {/* 第三步：进度 */}
        {step === 'progress' && (
          <Box sx={{ mt: 4 }}>
            <Typography variant="body2" sx={{ mb: 1 }}>
              {progress.stage}
            </Typography>
            <LinearProgress
              variant="determinate"
              value={progress.value * 100}
              sx={{ height: 8, borderRadius: 4, '& .MuiLinearProgress-bar': { borderRadius: 4 } }}
            />
          </Box>
        )}

        {/* 第四步：结果 */}
        {step === 'result' && result && (
          <>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3, mt: 2 }}>
              {result.success ? (
                <>
                  <SuccessIcon size={48} style={{ color: '#4caf50' }} />
                  <Typography variant="h6" color="success.main" sx={{ mt: 1 }}>
                    {result.success && detected?.kind === 'aetherlink'
                      ? t('dataSettings.messages.restoreSuccess')
                      : t('dataSettings.importExternal.success.title')}
                  </Typography>
                </>
              ) : (
                <>
                  <ErrorIcon size={48} style={{ color: '#f44336' }} />
                  <Typography variant="h6" color="error.main" sx={{ mt: 1 }}>
                    {t('dataSettings.messages.restoreFailed')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ mt: 1 }}>
                    {result.error || t('dataSettings.errors.unknown')}
                  </Typography>
                </>
              )}
            </Box>

            {result.success && (
              <>
                <List>
                  <ListItem>
                    <ListItemIcon><ChatIcon color="#1976d2" /></ListItemIcon>
                    <ListItemText primary={t('dataSettings.restoreProgress.restoredTopics', { count: result.topicsCount })} />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon><AssistantIcon color="#1976d2" /></ListItemIcon>
                    <ListItemText primary={t('dataSettings.restoreProgress.restoredAssistants', { count: result.assistantsCount })} />
                  </ListItem>
                  {result.settingsRestored && (
                    <ListItem>
                      <ListItemIcon><FileJson color="#1976d2" /></ListItemIcon>
                      <ListItemText primary={t('dataSettings.restoreProgress.restoredSettings')} />
                    </ListItem>
                  )}
                </List>

                {detected?.kind === 'aetherlink' && (
                  <Alert severity="info" sx={{ mt: 1 }}>
                    {t('dataSettings.restoreProgress.restartRequired')}
                  </Alert>
                )}
              </>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        {step !== 'result' && (
          <Button onClick={handleClose} color="inherit" disabled={isBusy}>
            {t('dataSettings.importExternal.cancel')}
          </Button>
        )}
        {step === 'result' && (
          <Button onClick={handleFinish} variant="contained" color="primary">
            {t('dataSettings.importExternal.complete')}
          </Button>
        )}
      </DialogActions>
    </BackButtonDialog>
  );
};

export default UnifiedRestoreDialog;
