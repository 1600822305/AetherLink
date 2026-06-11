import React from 'react';
import { Box, Typography, Button, Chip, Divider, Alert } from '@mui/material';
import BackButtonDialog from '../../../components/common/BackButtonDialog';
import type { MemoryMaintenanceReport } from '../../../shared/services/memory/maintenance';

interface MaintenanceReportDialogProps {
  open: boolean;
  onClose: () => void;
  report: MemoryMaintenanceReport | null;
  /** dryRun 报告时显示「立即整理」入口 */
  onRunForReal?: () => void;
}

/**
 * 记忆整理报告对话框
 * 展示物理清除结果与近重复记忆簇
 */
const MaintenanceReportDialog: React.FC<MaintenanceReportDialogProps> = ({
  open,
  onClose,
  report,
  onRunForReal,
}) => {
  if (!report) return null;

  const purgeCount = report.dryRun ? report.purge.candidates.length : report.purge.purgedCount;

  return (
    <BackButtonDialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <Box sx={{ p: 2 }}>
        <Typography variant="h6" sx={{ mb: 0.5 }}>
          记忆整理报告{report.dryRun ? '（预览）' : ''}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          共比较 {report.cluster.comparedCount} 条记忆
        </Typography>

        {report.errors.length > 0 && (
          <Alert severity="warning" sx={{ mt: 1.5 }}>
            部分阶段执行失败：{report.errors.join('；')}
          </Alert>
        )}
        {report.aborted && (
          <Alert severity="info" sx={{ mt: 1.5 }}>
            整理已被取消，以下为已完成部分的结果。
          </Alert>
        )}

        <Divider sx={{ my: 1.5 }} />

        {/* 物理清除 */}
        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
          过期软删除清理
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          {report.dryRun
            ? purgeCount > 0
              ? `有 ${purgeCount} 条删除超过保留期的记忆将被物理清除`
              : '没有需要物理清除的记忆'
            : purgeCount > 0
              ? `已物理清除 ${purgeCount} 条删除超过保留期的记忆`
              : '没有需要物理清除的记忆'}
        </Typography>

        {/* 近重复簇 */}
        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
          近重复记忆（{report.cluster.clusters.length} 组）
        </Typography>
        {report.cluster.clusters.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            未发现近重复记忆
          </Typography>
        ) : (
          <Box sx={{ maxHeight: 280, overflow: 'auto' }}>
            {report.cluster.clusters.map((cluster, idx) => (
              <Box
                key={idx}
                sx={{
                  p: 1.5,
                  mb: 1,
                  borderRadius: 1,
                  backgroundColor: theme =>
                    theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
                }}
              >
                <Chip
                  label={`相似度 ${(cluster.maxSimilarity * 100).toFixed(0)}%`}
                  size="small"
                  color="primary"
                  variant="outlined"
                  sx={{ height: 20, fontSize: '0.7rem', mb: 0.5 }}
                />
                {cluster.members.map(member => (
                  <Typography key={member.id} variant="body2" sx={{ mt: 0.5 }}>
                    · {member.memory}
                  </Typography>
                ))}
              </Box>
            ))}
            <Typography variant="caption" color="text.secondary">
              近重复记忆的自动合并将在后续版本提供，目前可在记忆列表中手动处理。
            </Typography>
          </Box>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2 }}>
          <Button onClick={onClose}>关闭</Button>
          {report.dryRun && purgeCount > 0 && onRunForReal && (
            <Button variant="contained" onClick={onRunForReal}>
              立即整理
            </Button>
          )}
        </Box>
      </Box>
    </BackButtonDialog>
  );
};

export default MaintenanceReportDialog;
