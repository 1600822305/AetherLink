import { useState, useCallback } from 'react';

/**
 * MCP 工具开关和模式管理钩子
 * 从 localStorage 读取并持久化状态
 */
export const useMCPTools = () => {
  // MCP 工具开关状态 - 从 localStorage 读取并持久化
  const [toolsEnabled, setToolsEnabled] = useState(() => {
    const saved = localStorage.getItem('mcp-tools-enabled');
    return saved !== null ? JSON.parse(saved) : false; // 默认关闭
  });

  // MCP 工具调用模式 - 从 localStorage 读取
  const [mcpMode, setMcpMode] = useState<'prompt' | 'function'>(() => {
    const saved = localStorage.getItem('mcp-mode');
    return (saved as 'prompt' | 'function') || 'function';
  });

  // MCP 工具开关切换
  const toggleToolsEnabled = useCallback(() => {
    setToolsEnabled((prev: boolean) => {
      const newValue = !prev;
      localStorage.setItem('mcp-tools-enabled', JSON.stringify(newValue));
      return newValue;
    });
  }, []);

  // MCP 模式切换
  const handleMCPModeChange = useCallback((mode: 'prompt' | 'function') => {
    setMcpMode(mode);
    localStorage.setItem('mcp-mode', mode);
  }, []);

  return {
    toolsEnabled,
    mcpMode,
    toggleToolsEnabled,
    handleMCPModeChange
  };
};
