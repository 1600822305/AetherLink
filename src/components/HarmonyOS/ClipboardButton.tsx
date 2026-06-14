/**
 * HarmonyOS 适配的剪贴板按钮
 * 自动处理权限请求
 */

import React, { useState } from 'react';
import { IconButton, Tooltip } from '@mui/material';
import { Copy, Check } from 'lucide-react';
import { isHarmonyOS } from '../../shared/utils/platformDetection';
import { HarmonyOSPermission } from '../../shared/config/harmonyOSConfig';
import { harmonyOSPermissionService } from '../../shared/services/platform/harmonyos/HarmonyOSPermissionService';
import HarmonyOSPermissionDialog from './PermissionDialog';
import { platformAdapter } from '../../shared/adapters/PlatformAdapter';
import { createLogger } from '../../shared/services/infra/logger';

const logger = createLogger('HarmonyOSClipboardButton');

interface ClipboardButtonProps {
  text: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
  size?: 'small' | 'medium' | 'large';
  tooltip?: string;
}

/**
 * 剪贴板复制按钮（鸿蒙适配版）
 */
export const HarmonyOSClipboardButton: React.FC<ClipboardButtonProps> = ({
  text,
  onSuccess,
  onError,
  size = 'small',
  tooltip = '复制',
}) => {
  const [copied, setCopied] = useState(false);
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);

  const handleCopy = async () => {
    try {
      // 鸿蒙系统需要先检查权限
      if (isHarmonyOS()) {
        const hasPermission = await harmonyOSPermissionService.hasPermission(
          HarmonyOSPermission.WRITE_CLIPBOARD
        );

        if (!hasPermission) {
          setShowPermissionDialog(true);
          return;
        }
      }

      // 复制到剪贴板
      await platformAdapter.clipboard.writeText(text);

      // 显示成功状态
      setCopied(true);
      onSuccess?.();

      // 2秒后恢复
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      logger.error('[HarmonyOS] 复制失败:', error);
      const errorMessage = error instanceof Error ? error.message : '复制失败';
      onError?.(errorMessage);
    }
  };

  const handlePermissionGranted = async () => {
    setShowPermissionDialog(false);
    // 权限授予后自动重试复制
    await handleCopy();
  };

  return (
    <>
      <Tooltip title={copied ? '已复制' : tooltip}>
        <IconButton
          size={size}
          onClick={handleCopy}
          disabled={copied}
          color={copied ? 'success' : 'default'}
        >
          {copied ? <Check size={18} /> : <Copy size={18} />}
        </IconButton>
      </Tooltip>

      {isHarmonyOS() && (
        <HarmonyOSPermissionDialog
          open={showPermissionDialog}
          onClose={() => setShowPermissionDialog(false)}
          permission={HarmonyOSPermission.WRITE_CLIPBOARD}
          onPermissionGranted={handlePermissionGranted}
          onPermissionDenied={() => {
            onError?.('剪贴板权限被拒绝');
          }}
        />
      )}
    </>
  );
};

export default HarmonyOSClipboardButton;

