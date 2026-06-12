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
  const { harvest, reembed, consolidate } = report;
  const handledIds = new Set<string>([
    ...consolidate.merged.flatMap(m => [m.keptId, ...m.removedIds]),
    ...consolidate.expired.map(e => e.id),
    ...consolidate.conflicts.flatMap(c => [c.winnerId, ...c.loserIds]),
  ]);
  // 只展示未被 LLM 整合处理的簇，避免与整合结果重复
  const remainingClusters = report.cluster.clusters.filter(
    cluster => !cluster.members.some(m => handledIds.has(m.id))
  );

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

        {/* 回顾提取 */}
        {(harvest.scannedTopics > 0 || harvest.extractedFacts.length > 0) && (
          <>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
              回顾提取
            </Typography>
            {report.dryRun ? (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                {harvest.candidates.length > 0
                  ? `有 ${harvest.candidates.length} 个话题共 ${harvest.candidates.reduce((sum, c) => sum + c.pendingMessages, 0)} 条新消息待提取${
                      harvest.deferredTopics > 0 ? `，另有 ${harvest.deferredTopics} 个话题顺延` : ''
                    }`
                  : '没有需要回顾提取的新消息'}
              </Typography>
            ) : (
              <>
                <Typography variant="body2" color="text.secondary" sx={{ mb: harvest.extractedFacts.length > 0 ? 0.5 : 1.5 }}>
                  {`已回顾 ${harvest.processedTopics} 个话题，提取 ${harvest.extractedFacts.length} 条事实（新增 ${harvest.addedCount}、更新 ${harvest.updatedCount}）${
                    harvest.deferredTopics > 0 ? `，${harvest.deferredTopics} 个话题顺延到下次` : ''
                  }`}
                </Typography>
                {harvest.extractedFacts.length > 0 && (
                  <Box sx={{ maxHeight: 160, overflow: 'auto', mb: 1.5 }}>
                    {harvest.extractedFacts.map((fact, idx) => (
                      <Box key={`fact-${idx}`} sx={{ mb: 0.5 }}>
                        <Chip label="提取" size="small" color="info" variant="outlined" sx={{ height: 20, fontSize: '0.7rem', mr: 0.5 }} />
                        <Typography variant="body2" component="span">{fact}</Typography>
                      </Box>
                    ))}
                  </Box>
                )}
              </>
            )}
          </>
        )}

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

        {/* 向量修复 */}
        {reembed.candidateCount > 0 && (
          <>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
              向量修复
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              {report.dryRun
                ? `有 ${reembed.candidateCount} 条记忆的向量缺失或来自其他嵌入模型，将被重算`
                : `已重算 ${reembed.reembeddedCount} 条记忆的向量${
                    reembed.deferredCount > 0 ? `，剩余 ${reembed.deferredCount} 条顺延到下次` : ''
                  }`}
            </Typography>
          </>
        )}

        {/* LLM 整合结果 */}
        {!report.dryRun &&
          (consolidate.merged.length > 0 ||
            consolidate.expired.length > 0 ||
            consolidate.conflicts.length > 0) && (
            <>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                智能整合（用了 {consolidate.llmCallsUsed} 次 LLM 调用）
              </Typography>
              <Box sx={{ maxHeight: 200, overflow: 'auto', mb: 1.5 }}>
                {consolidate.merged.map((m, idx) => (
                  <Box key={`merge-${idx}`} sx={{ mb: 0.5 }}>
                    <Chip label={`合并 ${m.removedIds.length + 1} 条`} size="small" color="success" variant="outlined" sx={{ height: 20, fontSize: '0.7rem', mr: 0.5 }} />
                    <Typography variant="body2" component="span">{m.mergedText}</Typography>
                  </Box>
                ))}
                {consolidate.expired.map((e, idx) => (
                  <Box key={`expire-${idx}`} sx={{ mb: 0.5 }}>
                    <Chip label="过期" size="small" color="warning" variant="outlined" sx={{ height: 20, fontSize: '0.7rem', mr: 0.5 }} />
                    <Typography variant="body2" component="span">{e.memory}</Typography>
                  </Box>
                ))}
                {consolidate.conflicts.map((c, idx) => (
                  <Box key={`conflict-${idx}`} sx={{ mb: 0.5 }}>
                    <Chip label={`冲突解决（淘汰 ${c.loserIds.length} 条）`} size="small" color="error" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
                  </Box>
                ))}
              </Box>
            </>
          )}

        {/* 近重复簇 */}
        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
          {report.dryRun ? '近重复记忆' : '未处理的近重复记忆'}（{remainingClusters.length} 组）
        </Typography>
        {remainingClusters.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            未发现近重复记忆
          </Typography>
        ) : (
          <Box sx={{ maxHeight: 280, overflow: 'auto' }}>
            {remainingClusters.map((cluster, idx) => (
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
              {report.dryRun
                ? '执行「立即整理」后将由 LLM 自动合并/清理这些记忆。'
                : '超出本次 LLM 预算或被判定保留的簇，会在下次整理时继续处理。'}
            </Typography>
          </Box>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2 }}>
          <Button onClick={onClose}>关闭</Button>
          {report.dryRun && (purgeCount > 0 || report.cluster.clusters.length > 0 || reembed.candidateCount > 0 || harvest.candidates.length > 0) && onRunForReal && (
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
