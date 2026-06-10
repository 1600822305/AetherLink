import React, { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppState } from '../shared/hooks/useAppState';
import { initBackButtonListener, useBackButton } from '../shared/hooks/useBackButton';
import { getBackToFromHistory } from '../shared/hooks/useSmartBack';

/**
 * 处理设置页面的智能返回逻辑
 * @param pathname 当前路径
 * @param navigate 导航函数
 */
const handleSettingsBack = (pathname: string, navigate: (path: string) => void) => {
  // 跨上下文跳转（如从聊天页弹窗进入设置页）携带的来源路径优先
  const backTo = getBackToFromHistory();
  if (backTo) {
    navigate(backTo);
    return;
  }

  // 去除查询参数，只保留路径部分
  const pathWithoutQuery = pathname.split('?')[0];
  
  // 特殊处理：笔记编辑页面根据 from 参数决定返回位置
  if (pathWithoutQuery === '/settings/notes/edit') {
    const urlParams = new URLSearchParams(pathname.split('?')[1] || '');
    const from = urlParams.get('from');
    if (from === 'chat') {
      navigate('/chat');
      return;
    }
    // 默认返回到笔记设置页面
    navigate('/settings/notes');
    return;
  }
  
  // 设置页面的层级关系映射
  const settingsRoutes: { [key: string]: string } = {
    // 主设置页面返回聊天页面
    '/settings': '/chat',

    // 一级设置页面返回主设置页面
    '/settings/appearance': '/settings',
    '/settings/behavior': '/settings',
    '/settings/default-model': '/settings',
    '/settings/assistant-model': '/settings',
    '/settings/agent-prompts': '/settings',
    '/settings/ai-debate': '/settings',
    '/settings/model-combo': '/settings',
    '/settings/web-search': '/settings',
    '/settings/mcp-server': '/settings',
    '/settings/quick-phrases': '/settings',
    '/settings/workspace': '/settings',
    '/settings/knowledge': '/settings',
    '/settings/data': '/settings',
    '/settings/notion': '/settings',
    '/settings/voice': '/settings',
    '/settings/about': '/settings',
    '/settings/notes': '/settings',
    '/settings/skills': '/settings',
    '/settings/memory': '/settings',
    '/settings/context-condense': '/settings',
    '/settings/vision-recognition': '/settings',
    '/settings/network-proxy': '/settings',
    
    // 开发者工具(三级页面) - 从关于我们进入
    '/devtools': '/settings/about',

    // 二级设置页面返回对应的一级页面
    '/settings/appearance/chat-interface': '/settings/appearance',
    '/settings/appearance/message-bubble': '/settings/appearance',
    '/settings/appearance/toolbar-customization': '/settings/appearance',
    '/settings/appearance/thinking-process': '/settings/appearance',
    '/settings/appearance/input-box': '/settings/appearance',
    '/settings/appearance/top-toolbar': '/settings/appearance',
    '/settings/appearance/theme-style': '/settings/appearance',
    '/settings/data/advanced-backup': '/settings/data',
    '/settings/assistant-model-settings': '/settings',
    '/settings/voice/tts/capacitor': '/settings/voice',
    '/settings/voice/tts/siliconflow': '/settings/voice',
    '/settings/voice/tts/openai': '/settings/voice',
    '/settings/voice/tts/azure': '/settings/voice',
    '/settings/voice/tts/gemini': '/settings/voice',
    '/settings/voice/tts/elevenlabs': '/settings/voice',
    '/settings/voice/tts/minimax': '/settings/voice',
    '/settings/voice/tts/volcano': '/settings/voice',
    '/settings/voice/asr/capacitor': '/settings/voice',
    '/settings/voice/asr/openai-whisper': '/settings/voice',
    '/settings/add-provider': '/settings/default-model',
  };

  // 处理动态路由（如 /settings/model-provider/:providerId）
  if (pathWithoutQuery.startsWith('/settings/model-provider/')) {
    // 检查是否是四级页面（如 /settings/model-provider/:providerId/advanced-api）
    const modelProviderMatch = pathWithoutQuery.match(/^\/settings\/model-provider\/([^/]+)(?:\/(.+))?$/);
    if (modelProviderMatch) {
      const providerId = modelProviderMatch[1];
      const subPath = modelProviderMatch[2];
      
      // 如果有子路径（如 advanced-api 或 multi-key），说明是四级页面，返回到三级页面
      if (subPath) {
        navigate(`/settings/model-provider/${providerId}`);
        return;
      }
      // 如果没有子路径，说明是三级页面，返回到二级页面
      navigate('/settings/default-model');
      return;
    }
    // 如果匹配失败，默认返回到二级页面
    navigate('/settings/default-model');
    return;
  }
  if (pathWithoutQuery.startsWith('/settings/skills/') && pathWithoutQuery !== '/settings/skills') {
    navigate('/settings/skills');
    return;
  }
  if (pathWithoutQuery.startsWith('/settings/mcp-server/') && pathWithoutQuery !== '/settings/mcp-server') {
    navigate('/settings/mcp-server?tab=0');
    return;
  }
  if (pathWithoutQuery.startsWith('/settings/mcp-assistant/')) {
    // /settings/mcp-assistant/:serverId/domain/:domain → 返回助手详情
    const domainMatch = pathWithoutQuery.match(/^\/settings\/mcp-assistant\/([^/]+)\/domain\/.+$/);
    if (domainMatch) {
      navigate(`/settings/mcp-assistant/${domainMatch[1]}`);
      return;
    }
    // /settings/mcp-assistant/:serverId → 返回 MCP 设置（智能助手 tab）
    navigate('/settings/mcp-server?tab=2');
    return;
  }
  if (pathWithoutQuery.startsWith('/settings/model-combo/') && pathWithoutQuery !== '/settings/model-combo') {
    navigate('/settings/model-combo');
    return;
  }
  if (pathWithoutQuery.startsWith('/settings/workspace/') && pathWithoutQuery !== '/settings/workspace') {
    navigate('/settings/workspace');
    return;
  }
  
  // 处理知识库相关页面
  if (pathWithoutQuery === '/knowledge/create') {
    navigate('/settings/knowledge');
    return;
  }
  if (pathWithoutQuery.startsWith('/knowledge/') && pathWithoutQuery !== '/knowledge') {
    // Level 4: /knowledge/:id/document/:fileName → 返回 Level 3
    const knowledgeDocMatch = pathWithoutQuery.match(/^\/knowledge\/([^/]+)\/document\/.+$/);
    if (knowledgeDocMatch) {
      navigate(`/knowledge/${knowledgeDocMatch[1]}`);
      return;
    }
    // Level 3.5: /knowledge/:id/edit → 返回 Level 3
    const knowledgeEditMatch = pathWithoutQuery.match(/^\/knowledge\/([^/]+)\/edit$/);
    if (knowledgeEditMatch) {
      navigate(`/knowledge/${knowledgeEditMatch[1]}`);
      return;
    }
    // Level 3: /knowledge/:id → 返回 Level 2
    navigate('/settings/knowledge');
    return;
  }

  // 查找对应的返回路径
  const backPath = settingsRoutes[pathWithoutQuery];
  if (backPath) {
    navigate(backPath);
  } else {
    // 如果没有找到对应的路径，默认返回主设置页面
    navigate('/settings');
  }
};

/**
 * 处理移动端返回键的组件
 * 
 * 统一支持：
 * - Capacitor Android/iOS: 使用 @capacitor/app 的 backButton 事件
 * - Tauri Android: 通过 MainActivity.kt 转发的 Escape 键事件
 * - Tauri Desktop / Web: Escape 键
 * 
 * 功能：
 * 1. 优先关闭打开的对话框（LIFO 顺序）
 * 2. 根据当前路由智能返回上级页面
 * 3. 在主页面显示退出确认对话框
 */
const BackButtonHandler: React.FC = () => {
  const navigate = useNavigate();
  const { 
    setShowExitConfirm, 
    hasOpenDialogs, 
    closeLastDialog 
  } = useAppState();

  // 初始化全局返回键监听器（只需一次）
  useEffect(() => {
    initBackButtonListener();
  }, []);

  // 处理返回键的逻辑
  const handleBackButton = useCallback((): boolean => {
    // 获取当前路径
    const currentPath = window.location.hash.replace('#', '') || '/';
    
    console.log('[BackButtonHandler] 返回键触发, 当前路径:', currentPath);

    // 优先处理对话框关闭
    if (hasOpenDialogs()) {
      const closed = closeLastDialog();
      if (closed) {
        console.log('[BackButtonHandler] 已关闭对话框');
        return true; // 已处理
      }
    }

    // 根据当前路径决定行为
    if (currentPath === '/chat' || currentPath === '/welcome') {
      // 在主页面，显示退出确认对话框
      setShowExitConfirm(true);
      return true;
    } 
    
    if (currentPath.startsWith('/settings') || currentPath === '/devtools' || currentPath.startsWith('/knowledge/')) {
      // 在设置页面、开发者工具页面或知识库详情页面，智能返回到上级页面
      handleSettingsBack(currentPath, navigate);
      return true;
    }
    
    // 在其他页面，返回到聊天页面
    navigate('/chat');
    return true;
  }, [navigate, setShowExitConfirm, hasOpenDialogs, closeLastDialog]);

  // 使用统一的返回键 Hook
  useBackButton(handleBackButton, [handleBackButton]);

  // 这是一个纯逻辑组件，不渲染任何UI
  return null;
};

export default BackButtonHandler;
