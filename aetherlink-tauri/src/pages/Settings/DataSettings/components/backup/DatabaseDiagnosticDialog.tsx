import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  CircularProgress,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Paper,
  Alert,
  LinearProgress
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  AlertTriangle as WarningIcon,
  Database as StorageIcon,
  Trash2 as CleaningServicesIcon,
  Link as LinkIcon,
  Link2Off as LinkOffIcon,
  RotateCcw as ReplayIcon,
  Trash as DeleteSweepIcon,
  Wrench as BuildIcon,
  Construction as ConstructionIcon,
  AlertTriangle as ReportProblemIcon
} from 'lucide-react';
import { cleanupOldDatabases, getDatabaseStatus, type DatabaseStatus } from '../../../../../shared/services/storage/storageService';
import { TopicStatsService } from '../../../../../shared/services/topics/TopicStatsService';
import { AssistantService } from '../../../../../shared/services';
import Dexie from 'dexie';
import { toastManager } from '../../../../../components/EnhancedToast';

interface DatabaseDiagnosticDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * 数据库诊断对话框组件
 */
const DatabaseDiagnosticDialog: React.FC<DatabaseDiagnosticDialogProps> = ({
  open,
  onClose
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);
  const [isCleaningTopics, setIsCleaningTopics] = useState(false);
  const [isFixingReferences, setIsFixingReferences] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<DatabaseStatus | null>(null);
  const [repairResult, setRepairResult] = useState<{
    found: number;
    cleaned: number;
    current: string;
  } | null>(null);
  const [topicCleanResult, setTopicCleanResult] = useState<{
    removed: number;
    total: number;
  } | null>(null);
  const [referenceFixResult, setReferenceFixResult] = useState<{
    assistantsFixed: number;
    totalAssistants: number;
    totalRemoved: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 执行数据库诊断
  const runDiagnostic = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // 获取数据库状态
      const status = await getDatabaseStatus();
      setDiagnosticResult(status);
    } catch (err) {
      console.error('数据库诊断失败:', err);
      setError('数据库诊断失败: ' + (err instanceof Error ? err.message : '未知错误'));
    } finally {
      setIsLoading(false);
    }
  };

  // 修复数据库问题
  const repairDatabase = async () => {
    try {
      if (!window.confirm('此操作将清理旧版本数据库。如果您正在使用v6版本，建议谨慎操作。确定要继续吗？')) {
        return;
      }

      setIsRepairing(true);
      setError(null);

      // 清理旧数据库（仅清理不同名称的旧数据库，不会影响当前版本）
      const result = await cleanupOldDatabases();
      setRepairResult(result);

      // 重新获取数据库状态
      const status = await getDatabaseStatus();
      setDiagnosticResult(status);
    } catch (err) {
      console.error('数据库修复失败:', err);
      setError('数据库修复失败: ' + (err instanceof Error ? err.message : '未知错误'));
    } finally {
      setIsRepairing(false);
    }
  };

  // 清理无效话题
  const cleanupInvalidTopics = async () => {
    try {
      setIsCleaningTopics(true);
      setError(null);

      // 清理无效话题
      const result = await TopicStatsService.cleanupInvalidTopics();
      setTopicCleanResult(result);
      console.log(`清理完成: 已删除 ${result.removed} 个无效话题，剩余 ${result.total} 个话题`);

      // 重新获取数据库状态
      const status = await getDatabaseStatus();
      setDiagnosticResult(status);
    } catch (err) {
      console.error('清理无效话题失败:', err);
      setError('清理无效话题失败: ' + (err instanceof Error ? err.message : '未知错误'));
    } finally {
      setIsCleaningTopics(false);
    }
  };

  // 修复助手话题引用
  const fixAssistantTopicReferences = async () => {
    try {
      setIsFixingReferences(true);
      setError(null);

      // 修复所有助手的话题引用
      const result = await AssistantService.validateAndFixAllAssistantsTopicReferences();
      setReferenceFixResult(result);
      console.log(`修复完成: 已修复 ${result.assistantsFixed} 个助手的话题引用，共移除 ${result.totalRemoved} 个无效引用`);

      // 重新获取数据库状态
      const status = await getDatabaseStatus();
      setDiagnosticResult(status);
    } catch (err) {
      console.error('修复助手话题引用失败:', err);
      setError('修复助手话题引用失败: ' + (err instanceof Error ? err.message : '未知错误'));
    } finally {
      setIsFixingReferences(false);
    }
  };

  // 重建数据库
  const rebuildDatabase = async () => {
    try {
      if (!window.confirm('此操作将删除并重建数据库，可能导致数据丢失。确定要继续吗？')) {
        return;
      }

      setIsRepairing(true);
      setError(null);

      // 手动创建一个新的数据库实例用于删除操作
      // const tempDb = new Dexie('aetherlink-db-new');
      // await tempDb.delete();
      // console.log('尝试删除 aetherlink-db-new 数据库');
      // 改用 Dexie.delete()
      await Dexie.delete('aetherlink-db-new');
      console.log('已调用 Dexie.delete(\'aetherlink-db-new\')');

      // 重新获取数据库状态，这将触发数据库重建
      const status = await getDatabaseStatus();
      setDiagnosticResult(status);

      setRepairResult({
        found: 1,
        cleaned: 1,
        current: 'aetherlink-db-new'
      });

      toastManager.success('数据库已重建。请重启应用以确保更改生效。', '重建成功');
    } catch (err) {
      console.error('数据库重建失败:', err);
      setError('数据库重建失败: ' + (err instanceof Error ? err.message : '未知错误'));
    } finally {
      setIsRepairing(false);
    }
  };

  // 对话框打开时自动执行诊断
  useEffect(() => {
    if (open) {
      runDiagnostic();
    }
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: 2,
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)'
          }
        }
      }}
    >
      <DialogTitle sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        borderBottom: '1px solid',
        borderColor: 'divider',
        pb: 2
      }}>
        <StorageIcon color="#10B981" />
        <Typography variant="h6">数据库诊断与修复</Typography>
      </DialogTitle>

      <DialogContent sx={{ py: 3 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {isLoading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4 }}>
            <CircularProgress size={40} sx={{ color: '#10B981', mb: 2 }} />
            <Typography>正在诊断数据库...</Typography>
          </Box>
        ) : diagnosticResult ? (
          <Box>
            <Paper
              elevation={0}
              sx={{
                p: 2,
                mb: 3,
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider'
              }}
            >
              <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
                数据库状态
              </Typography>

              <List dense>
                <ListItem>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <StorageIcon size={16} color="#1976d2" />
                  </ListItemIcon>
                  <ListItemText
                    primary="当前数据库"
                    secondary={diagnosticResult.currentDB}
                  />
                </ListItem>

                <ListItem>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    {diagnosticResult.databases.length > 1 ? (
                      <WarningIcon size={16} color="#ed6c02" />
                    ) : (
                      <CheckCircleIcon size={16} color="#2e7d32" />
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary="检测到的数据库"
                    secondary={
                      diagnosticResult.databases.length > 0
                        ? diagnosticResult.databases.join(', ')
                        : '无'
                    }
                  />
                </ListItem>

                <ListItem>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <CheckCircleIcon size={16} color="#2e7d32" />
                  </ListItemIcon>
                  <ListItemText
                    primary="数据存储"
                    secondary={
                      diagnosticResult.objectStores.length > 0
                        ? diagnosticResult.objectStores.join(', ')
                        : '无'
                    }
                  />
                </ListItem>

                <Divider sx={{ my: 1 }} />

                <ListItem>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <CheckCircleIcon size={16} color="#2e7d32" />
                  </ListItemIcon>
                  <ListItemText
                    primary="话题数量"
                    secondary={diagnosticResult.topicsCount}
                  />
                </ListItem>

                <ListItem>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <CheckCircleIcon size={16} color="#2e7d32" />
                  </ListItemIcon>
                  <ListItemText
                    primary="助手数量"
                    secondary={diagnosticResult.assistantsCount}
                  />
                </ListItem>
              </List>

              {diagnosticResult.databases.length > 1 && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  检测到多个数据库，可能导致数据冲突。建议点击"修复数据库"按钮清理旧数据库。
                </Alert>
              )}

              {diagnosticResult.missingStores && diagnosticResult.missingStores.length > 0 && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  数据库缺少以下对象存储: {diagnosticResult.missingStores.join(', ')}。
                  建议重启应用或清除浏览器缓存后重试。
                </Alert>
              )}
            </Paper>

            {repairResult && (
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  mb: 3,
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: repairResult.cleaned > 0 ? 'success.50' : undefined
                }}
              >
                <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
                  修复结果
                </Typography>

                <List dense>
                  <ListItem>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      {repairResult.found > 0 ? (
                        <WarningIcon size={16} color="#ed6c02" />
                      ) : (
                        <CheckCircleIcon size={16} color="#2e7d32" />
                      )}
                    </ListItemIcon>
                    <ListItemText
                      primary="发现旧数据库"
                      secondary={repairResult.found}
                    />
                  </ListItem>

                  <ListItem>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <CheckCircleIcon size={16} color="#2e7d32" />
                    </ListItemIcon>
                    <ListItemText
                      primary="已清理数据库"
                      secondary={repairResult.cleaned}
                    />
                  </ListItem>

                  <ListItem>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <CheckCircleIcon size={16} color="#2e7d32" />
                    </ListItemIcon>
                    <ListItemText
                      primary="当前使用数据库"
                      secondary={repairResult.current}
                    />
                  </ListItem>
                </List>

                {repairResult.cleaned > 0 ? (
                  <Alert severity="success" sx={{ mt: 2 }}>
                    成功清理 {repairResult.cleaned} 个旧数据库。建议重启应用以确保更改生效。
                  </Alert>
                ) : repairResult.found > 0 ? (
                  <Alert severity="warning" sx={{ mt: 2 }}>
                    发现 {repairResult.found} 个旧数据库，但清理失败。请尝试重启应用后再次修复。
                  </Alert>
                ) : (
                  <Alert severity="info" sx={{ mt: 2 }}>
                    未发现需要清理的旧数据库。
                  </Alert>
                )}
              </Paper>
            )}

            {topicCleanResult && (
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  mb: 3,
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: topicCleanResult.removed > 0 ? 'success.50' : undefined
                }}
              >
                <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
                  话题清理结果
                </Typography>

                <List dense>
                  <ListItem>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <CleaningServicesIcon size={16} color="#1976d2" />
                    </ListItemIcon>
                    <ListItemText
                      primary="已清理无效话题"
                      secondary={topicCleanResult.removed}
                    />
                  </ListItem>

                  <ListItem>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <CheckCircleIcon size={16} color="#2e7d32" />
                    </ListItemIcon>
                    <ListItemText
                      primary="剩余话题数量"
                      secondary={topicCleanResult.total}
                    />
                  </ListItem>
                </List>

                {topicCleanResult.removed > 0 ? (
                  <Alert severity="success" sx={{ mt: 2 }}>
                    成功清理 {topicCleanResult.removed} 个无效话题。
                  </Alert>
                ) : (
                  <Alert severity="info" sx={{ mt: 2 }}>
                    未发现需要清理的无效话题。
                  </Alert>
                )}
              </Paper>
            )}

            {referenceFixResult && (
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  mb: 3,
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: referenceFixResult.totalRemoved > 0 ? 'success.50' : undefined
                }}
              >
                <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
                  助手话题引用修复结果
                </Typography>

                <List dense>
                  <ListItem>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <LinkIcon size={16} color="#1976d2" />
                    </ListItemIcon>
                    <ListItemText
                      primary="已修复助手数量"
                      secondary={referenceFixResult.assistantsFixed}
                    />
                  </ListItem>

                  <ListItem>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <LinkOffIcon size={16} color="#ed6c02" />
                    </ListItemIcon>
                    <ListItemText
                      primary="已移除无效引用"
                      secondary={referenceFixResult.totalRemoved}
                    />
                  </ListItem>

                  <ListItem>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <CheckCircleIcon size={16} color="#2e7d32" />
                    </ListItemIcon>
                    <ListItemText
                      primary="助手总数"
                      secondary={referenceFixResult.totalAssistants}
                    />
                  </ListItem>
                </List>

                {referenceFixResult.totalRemoved > 0 ? (
                  <Alert severity="success" sx={{ mt: 2 }}>
                    成功修复 {referenceFixResult.assistantsFixed} 个助手的话题引用，移除了 {referenceFixResult.totalRemoved} 个无效引用。
                  </Alert>
                ) : (
                  <Alert severity="info" sx={{ mt: 2 }}>
                    所有助手的话题引用都是有效的，无需修复。
                  </Alert>
                )}
              </Paper>
            )}
          </Box>
        ) : null}

        {(isRepairing || isCleaningTopics || isFixingReferences) && (
          <Box sx={{ width: '100%', mt: 2 }}>
            <Typography variant="body2" sx={{ mb: 1 }}>
              {isRepairing
                ? '正在修复数据库...'
                : isCleaningTopics
                  ? '正在清理无效话题...'
                  : '正在修复助手话题引用...'}
            </Typography>
            <LinearProgress sx={{ height: 6, borderRadius: 3, '& .MuiLinearProgress-bar': { backgroundColor: '#10B981' } }} />
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{
        px: 3,
        py: 2,
        borderTop: '1px solid',
        borderColor: 'divider',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <Button
          onClick={onClose}
          sx={{ color: 'text.secondary' }}
        >
          关闭
        </Button>

        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap', justifyContent:'flex-end' }}>
          <Button
            variant="outlined"
            onClick={runDiagnostic}
            disabled={isLoading || isRepairing || isCleaningTopics || isFixingReferences}
            startIcon={<ReplayIcon size={16} />}
            sx={{
              borderColor: '#10B981',
              color: '#10B981',
              '&:hover': {
                borderColor: '#059669',
                bgcolor: 'rgba(16, 185, 129, 0.05)',
              }
            }}
          >
            重新诊断
          </Button>

          <Button
            variant="outlined"
            onClick={cleanupInvalidTopics}
            disabled={isLoading || isRepairing || isCleaningTopics || isFixingReferences}
            startIcon={<DeleteSweepIcon size={16} />}
            sx={{
              borderColor: '#3B82F6',
              color: '#3B82F6',
              '&:hover': {
                borderColor: '#2563EB',
                bgcolor: 'rgba(59, 130, 246, 0.05)',
              }
            }}
          >
            清理无效话题
          </Button>

          <Button
            variant="outlined"
            onClick={fixAssistantTopicReferences}
            disabled={isLoading || isRepairing || isCleaningTopics || isFixingReferences}
            startIcon={<BuildIcon size={16} />}
            sx={{
              borderColor: '#8B5CF6',
              color: '#8B5CF6',
              '&:hover': {
                borderColor: '#7C3AED',
                bgcolor: 'rgba(139, 92, 246, 0.05)',
              }
            }}
          >
            修复话题引用
          </Button>

          <Button
            variant="contained"
            onClick={repairDatabase}
            disabled={isLoading || isRepairing || isCleaningTopics || isFixingReferences || !!(diagnosticResult && diagnosticResult.databases.length <= 1)}
            startIcon={<ConstructionIcon size={16} />}
            sx={{
              bgcolor: '#10B981',
              '&:hover': {
                bgcolor: '#059669',
              }
            }}
          >
            修复数据库
          </Button>

          {diagnosticResult && diagnosticResult.missingStores && diagnosticResult.missingStores.length > 0 && (
            <Button
              variant="contained"
              onClick={rebuildDatabase}
              disabled={isLoading || isRepairing || isCleaningTopics || isFixingReferences}
              startIcon={<ReportProblemIcon size={16} />}
              sx={{
                bgcolor: '#EF4444',
                '&:hover': {
                  bgcolor: '#DC2626',
                }
              }}
            >
              重建数据库
            </Button>
          )}
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default DatabaseDiagnosticDialog;
