import { useCallback } from 'react';
import { mcpService } from '../shared/services/mcp';
import { getStorageItem, setStorageItem } from '../shared/utils/storage';
import { createLogger } from '../shared/services/infra/logger';

const logger = createLogger('MCP');

/**
 * 自定义Hook：管理MCP服务器状态的通用逻辑
 * 消除MCP组件中的重复代码
 */
export const useMCPServerStateManager = () => {
  /**
   * 处理MCP工具总开关状态变更
   * @param enabled 是否启用MCP工具
   * @param loadServers 重新加载服务器列表的回调函数
   * @param onStateChange 状态变更完成后的回调函数
   */
  const handleMCPToggle = useCallback(async (
    enabled: boolean,
    loadServers?: () => void,
    onStateChange?: (enabled: boolean) => void
  ) => {
    try {
      if (!enabled) {
        // 关闭总开关时，同时关闭所有已启动的MCP服务器
        await mcpService.stopAllActiveServers();
        loadServers?.();
        logger.debug('总开关关闭，已停止所有活跃服务器');

        // 保存并关闭桥梁模式
        const currentBridgeMode = await getStorageItem<boolean>('mcp-bridge-mode');
        if (currentBridgeMode) {
          await setStorageItem('mcp-bridge-mode-saved', true);
          await setStorageItem('mcp-bridge-mode', false);
          logger.debug('桥梁模式已保存并关闭');
        }
      } else {
        // 开启总开关时，恢复之前保存的活跃服务器状态
        if (mcpService.hasSavedActiveServers()) {
          await mcpService.restoreSavedActiveServers();
          loadServers?.();
          logger.debug('总开关开启，已恢复之前的活跃服务器状态');
        }

        // 恢复桥梁模式
        const savedBridgeMode = await getStorageItem<boolean>('mcp-bridge-mode-saved');
        if (savedBridgeMode) {
          await setStorageItem('mcp-bridge-mode', true);
          await setStorageItem('mcp-bridge-mode-saved', false);
          logger.debug('桥梁模式已恢复');
        }
      }
      
      // 调用状态变更回调
      onStateChange?.(enabled);
    } catch (error) {
      const action = enabled ? '恢复服务器状态' : '停止服务器';
      logger.error(`${action}失败:`, error);
      
      // 即使出错也要调用状态变更回调，保持UI状态一致
      onStateChange?.(enabled);
    }
  }, []);

  /**
   * 创建优化的MCP开关处理函数
   * @param loadServers 重新加载服务器列表的回调函数
   * @param onStateChange 状态变更完成后的回调函数
   * @returns 处理函数
   */
  const createMCPToggleHandler = useCallback((
    loadServers?: () => void,
    onStateChange?: (enabled: boolean) => void
  ) => {
    return (enabled: boolean) => handleMCPToggle(enabled, loadServers, onStateChange);
  }, [handleMCPToggle]);

  return {
    handleMCPToggle,
    createMCPToggleHandler
  };
};

export default useMCPServerStateManager;
