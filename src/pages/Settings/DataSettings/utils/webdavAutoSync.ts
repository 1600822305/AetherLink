import { WebDavBackupService } from '../../../../shared/services/storage/WebDavBackupService';
import { getWebDavConfig } from '../../../../shared/utils/webdavUtils';
import { prepareFullBackupData } from './backupUtils';

/**
 * WebDAV 自动同步装配（组合根）。
 *
 * WebDavBackupService 位于 shared 服务层，不直接依赖上层的备份数据准备逻辑；
 * 这里把具体的数据来源（prepareFullBackupData）注入服务，保持服务层与 UI/工具层解耦。
 */

/**
 * 确保 WebDAV 自动备份的数据来源已注册（幂等）。
 * 在应用启动以及用户在设置中开启自动同步前调用，保证自动备份能拿到完整备份数据。
 */
export function ensureWebDavBackupProvider(): void {
  WebDavBackupService.getInstance().registerBackupDataProvider(() => prepareFullBackupData());
}

/**
 * 应用启动时初始化 WebDAV 自动同步：
 * 1. 注册备份数据来源；
 * 2. 若上次会话启用了自动同步，则根据持久化状态恢复定时备份。
 */
export async function initWebDavAutoSync(): Promise<void> {
  try {
    ensureWebDavBackupProvider();

    const config = await getWebDavConfig();
    if (!config) {
      return;
    }

    await WebDavBackupService.getInstance().resumeAutoSyncIfEnabled(config);
  } catch (error) {
    console.error('[WebDAV] 初始化自动同步失败:', error);
  }
}
