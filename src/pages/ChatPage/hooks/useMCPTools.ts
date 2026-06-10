import { useState, useCallback, useEffect } from 'react';
import { getStorageItem, setStorageItem } from '../../../shared/utils/storage';

/**
 * MCP 工具开关和模式管理钩子
 * 使用 Dexie 统一存储（与 useMCP 保持一致）
 */
export const useMCPTools = () => {
  const [toolsEnabled, setToolsEnabled] = useState(false);
  const [mcpMode, setMcpMode] = useState<'prompt' | 'function'>('function');

  // 从 Dexie 异步加载初始状态
  useEffect(() => {
    (async () => {
      const savedEnabled = await getStorageItem<boolean>('mcp-tools-enabled');
      if (savedEnabled !== null) setToolsEnabled(savedEnabled);

      const savedMode = await getStorageItem<string>('mcp-mode');
      if (savedMode === 'prompt' || savedMode === 'function') setMcpMode(savedMode);
    })();
  }, []);

  const toggleToolsEnabled = useCallback(() => {
    setToolsEnabled((prev: boolean) => {
      const newValue = !prev;
      setStorageItem('mcp-tools-enabled', newValue);
      return newValue;
    });
  }, []);

  const handleMCPModeChange = useCallback((mode: 'prompt' | 'function') => {
    setMcpMode(mode);
    setStorageItem('mcp-mode', mode);
  }, []);

  return {
    toolsEnabled,
    mcpMode,
    toggleToolsEnabled,
    handleMCPModeChange
  };
};
