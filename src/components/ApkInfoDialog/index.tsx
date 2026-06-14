import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Divider,
  CircularProgress,
  IconButton,
  Chip
} from '@mui/material';
import {
  Package,
  X,
  FileText,
  Hash,
  HardDrive,
  Shield,
  Calendar,
  Folder,
  Eye,
  Download
} from 'lucide-react';
import { DexEditorPlugin } from 'capacitor-dex-editor';
import { createLogger } from '../../shared/services/infra/logger';

const logger = createLogger('ApkInfoDialog');

interface ApkInfoDialogProps {
  open: boolean;
  onClose: () => void;
  apkPath: string;
  fileName: string;
  onBrowse?: () => void;
}

interface ApkInfo {
  packageName?: string;
  versionName?: string;
  versionCode?: number;
  appName?: string;
  size?: number;
  dexCount?: number;
  resourceCount?: number;
  nativeLibCount?: number;
  path?: string;
  lastModified?: number;
}

interface ApkSignature {
  signed?: boolean;
  md5?: string;
  sha1?: string;
  sha256?: string;
}

const ApkInfoDialog: React.FC<ApkInfoDialogProps> = ({
  open,
  onClose,
  apkPath,
  fileName,
  onBrowse
}) => {
  const [loading, setLoading] = useState(true);
  const [apkInfo, setApkInfo] = useState<ApkInfo | null>(null);
  const [signature, setSignature] = useState<ApkSignature | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && apkPath) {
      loadApkInfo();
    }
  }, [open, apkPath]);

  const loadApkInfo = async () => {
    setLoading(true);
    setError(null);

    try {
      // 获取 APK 基本信息
      const infoResult = await DexEditorPlugin.execute({
        action: 'getApkInfo',
        params: { apkPath }
      });

      if (infoResult.success && infoResult.data) {
        setApkInfo(infoResult.data);
      } else {
        setError(infoResult.error || '获取APK信息失败');
      }

      // 获取签名信息
      try {
        const sigResult = await DexEditorPlugin.execute({
          action: 'getApkSignature',
          params: { apkPath }
        });

        if (sigResult.success && sigResult.data) {
          setSignature(sigResult.data);
        }
      } catch {
        // 签名信息获取失败不影响主要功能
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载APK信息失败');
    } finally {
      setLoading(false);
    }
  };

  // 安装 APK
  const handleInstall = async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (DexEditorPlugin as any).execute({
        action: 'installApk',
        params: { apkPath }
      });
    } catch (err) {
      logger.error('Failed to install APK:', err);
    }
  };

  // 查看 APK 内容
  const handleBrowse = () => {
    onBrowse?.();
  };

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '未知';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatDate = (timestamp?: number): string => {
    if (!timestamp) return '未知';
    return new Date(timestamp).toLocaleString('zh-CN');
  };

  const InfoRow: React.FC<{ icon: React.ReactNode; label: string; value: React.ReactNode }> = ({
    icon,
    label,
    value
  }) => (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', py: 1 }}>
      <Box sx={{ mr: 1.5, mt: 0.5, color: 'primary.main' }}>{icon}</Box>
      <Box sx={{ flex: 1 }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          {label}
        </Typography>
        <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
          {value || '未知'}
        </Typography>
      </Box>
    </Box>
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 2 }
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
        <Package size={24} color="#4CAF50" />
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" component="span">
            {apkInfo?.appName || fileName}
          </Typography>
          {apkInfo?.versionName && (
            <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
              v{apkInfo.versionName}
            </Typography>
          )}
        </Box>
        <IconButton onClick={onClose} size="small">
          <X size={20} />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="error">{error}</Typography>
            <Button onClick={loadApkInfo} sx={{ mt: 2 }}>
              重试
            </Button>
          </Box>
        ) : (
          <Box>
            {/* 基本信息 */}
            <InfoRow
              icon={<FileText size={18} />}
              label="包名"
              value={apkInfo?.packageName}
            />

            <InfoRow
              icon={<Hash size={18} />}
              label="版本号"
              value={apkInfo?.versionCode ? `${apkInfo.versionName} (${apkInfo.versionCode})` : apkInfo?.versionName}
            />

            <InfoRow
              icon={<HardDrive size={18} />}
              label="安装包大小"
              value={formatFileSize(apkInfo?.size)}
            />

            <Divider sx={{ my: 1.5 }} />

            {/* 签名信息 */}
            <InfoRow
              icon={<Shield size={18} />}
              label="签名状态"
              value={
                signature?.signed ? (
                  <Chip label="已签名" size="small" color="success" />
                ) : (
                  <Chip label="未签名" size="small" color="warning" />
                )
              }
            />

            {signature?.md5 && (
              <InfoRow
                icon={<Shield size={18} />}
                label="MD5"
                value={
                  <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>
                    {signature.md5}
                  </Typography>
                }
              />
            )}

            <Divider sx={{ my: 1.5 }} />

            {/* 文件统计 */}
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', py: 1 }}>
              {apkInfo?.dexCount !== undefined && (
                <Chip
                  label={`DEX: ${apkInfo.dexCount}`}
                  size="small"
                  variant="outlined"
                />
              )}
              {apkInfo?.resourceCount !== undefined && (
                <Chip
                  label={`资源: ${apkInfo.resourceCount}`}
                  size="small"
                  variant="outlined"
                />
              )}
              {apkInfo?.nativeLibCount !== undefined && (
                <Chip
                  label={`SO库: ${apkInfo.nativeLibCount}`}
                  size="small"
                  variant="outlined"
                />
              )}
            </Box>

            <Divider sx={{ my: 1.5 }} />

            {/* 路径信息 */}
            <InfoRow
              icon={<Folder size={18} />}
              label="APK路径"
              value={apkPath}
            />

            <InfoRow
              icon={<Calendar size={18} />}
              label="最后修改"
              value={formatDate(apkInfo?.lastModified)}
            />
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ justifyContent: 'flex-end', gap: 1, px: 2 }}>
        <Button onClick={handleBrowse} startIcon={<Eye size={16} />} variant="outlined">
          查看
        </Button>
        <Button onClick={handleInstall} startIcon={<Download size={16} />} variant="contained" color="primary">
          安装
        </Button>
        <Button onClick={onClose}>关闭</Button>
      </DialogActions>
    </Dialog>
  );
};

export default ApkInfoDialog;
