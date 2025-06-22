import { dexieStorage } from './DexieStorageService';

export class DatabaseCleanupService {
  /**
   * 清理旧数据，准备使用新系统
   */
  static async cleanupDatabase(): Promise<void> {
    try {
      console.log('[DatabaseCleanupService] 开始清理旧数据');
      
      // 清理旧消息和话题
      await dexieStorage.deleteAllMessages();
      await dexieStorage.deleteAllTopics();
      
      // 确保消息块表存在
      await dexieStorage.createMessageBlocksTable();
      
      console.log('[DatabaseCleanupService] 数据清理完成，准备使用新系统');
      
      // 设置标记，表示已完成清理
      localStorage.setItem('system_upgraded_to_blocks', 'true');
      
      return;
    } catch (error) {
      console.error('[DatabaseCleanupService] 清理数据失败:', error);
      throw error;
    }
  }
  
  /**
   * 检查是否需要清理数据
   */
  static needsCleanup(): boolean {
    return localStorage.getItem('system_upgraded_to_blocks') !== 'true';
  }
} 